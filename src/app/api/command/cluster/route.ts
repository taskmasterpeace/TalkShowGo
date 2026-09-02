import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { clusterStories, saveClusters } from '@/lib/command/fingerprint'
import { materialFromPull } from '@/lib/command/leads'
import { loadConfig } from '@/lib/command/stringer'
import { logTimer } from '@/lib/command/log'
import { effectiveClusters } from '@/lib/command/cluster-overrides'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
const ROOT = process.cwd()

/** GET — the most recent story-cluster set (if any). */
export function GET() {
  const dir = path.join(ROOT, 'lab', 'runs')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('clusters_') && f.endsWith('.json')).sort().reverse() : []
  if (!files.length) return NextResponse.json({ ok: true, clusters: null })
  // the human's edits (pin / rename / merge / split / dismiss) replay over the AI's clusters on every read
  try { const eff = effectiveClusters(files[0]); return NextResponse.json({ ok: true, clusters: { ...eff.envelope, file: files[0], clusters: eff.clusters, overrides: eff.overrides } }) }
  catch { try { return NextResponse.json({ ok: true, clusters: { ...JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8')), file: files[0] } }) } catch { return NextResponse.json({ ok: true, clusters: null }) } }
}

/** POST {file?} — EVENT FINGERPRINT + STORY CLUSTERING (Story Resolution Loop, stage 2). Clusters a
 *  pull's feed by whether sources are the SAME event/claim (not the same subject) → Story/Substory/Topic. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}
  const pullsDir = path.join(ROOT, 'lab', 'runs')
  const pulls = fs.existsSync(pullsDir) ? fs.readdirSync(pullsDir).filter(f => f.startsWith('pull_') && f.endsWith('.json')).sort().reverse() : []
  const pullFile = (body.file && /^pull_[\w:.-]+\.json$/.test(body.file) && pulls.includes(body.file)) ? body.file : pulls[0]
  if (!pullFile) return NextResponse.json({ ok: false, error: 'no pull report - run PULL first', stage: 'load' }, { status: 400 })

  let report: any
  try { report = JSON.parse(fs.readFileSync(path.join(pullsDir, pullFile), 'utf8')) } catch { return NextResponse.json({ ok: false, error: 'pull unreadable' }, { status: 500 }) }
  const material = materialFromPull(report)
  if (!material.length) return NextResponse.json({ ok: false, error: 'pull report is empty' }, { status: 400 })

  const t = logTimer()
  try {
    const { clusters, ms } = await clusterStories(material, loadConfig())
    // zero clusters is a parse/model failure, not a result — never overwrite the last good run with it
    if (!clusters.length) {
      t.done({ kind: 'cluster', stage: 'parse', ok: false, beat: report.beat || null, ref: pullFile, summary: `0 clusters from ${material.length} items`, error: 'clusterer returned no usable clusters' })
      return NextResponse.json({ ok: false, error: 'the clusterer returned no usable clusters — retry', stage: 'parse', retryable: true, pulled_from: pullFile, ms }, { status: 502 })
    }
    const counts = {
      stories: clusters.filter(c => c.kind === 'story').length,
      substories: clusters.filter(c => c.kind === 'substory').length,
      topics: clusters.filter(c => c.kind === 'topic').length,
    }
    const out = { pulled_from: pullFile, beat: report.beat || null, clustered_at: new Date().toISOString(), feed_count: material.length, ms, counts, clusters }
    saveClusters(pullFile, out)
    t.done(() => ({ kind: 'cluster', stage: 'cluster', ok: true, beat: report.beat || null, ref: pullFile, summary: `${clusters.length} clusters (${counts.stories} stories · ${counts.substories} sub · ${counts.topics} topic) from ${material.length} items`, meta: { top: clusters.slice(0, 5).map(c => c.title) } }))
    return NextResponse.json({ ok: true, pulled_from: pullFile, clusters, counts, ms })
  } catch (e: any) {
    t.done({ kind: 'cluster', stage: 'cluster', ok: false, beat: report.beat || null, ref: pullFile, summary: 'clustering failed', error: String(e?.message || e) })
    return NextResponse.json({ ok: false, error: 'clustering failed: ' + String(e?.message || e).slice(0, 160), stage: 'cluster', retryable: true }, { status: 502 })
  }
}
