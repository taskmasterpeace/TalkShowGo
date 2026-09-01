import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { clusterStories, saveClusters } from '@/lib/command/fingerprint'
import { materialFromPull } from '@/lib/command/leads'
import { loadConfig } from '@/lib/command/stringer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
const ROOT = process.cwd()

/** GET — the most recent story-cluster set (if any). */
export function GET() {
  const dir = path.join(ROOT, 'lab', 'runs')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('clusters_') && f.endsWith('.json')).sort().reverse() : []
  if (!files.length) return NextResponse.json({ ok: true, clusters: null })
  try { return NextResponse.json({ ok: true, clusters: JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8')) }) }
  catch { return NextResponse.json({ ok: true, clusters: null }) }
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

  try {
    const { clusters, ms } = await clusterStories(material, loadConfig())
    const counts = {
      stories: clusters.filter(c => c.kind === 'story').length,
      substories: clusters.filter(c => c.kind === 'substory').length,
      topics: clusters.filter(c => c.kind === 'topic').length,
    }
    const out = { pulled_from: pullFile, beat: report.beat || null, clustered_at: new Date().toISOString(), feed_count: material.length, ms, counts, clusters }
    saveClusters(pullFile, out)
    return NextResponse.json({ ok: true, pulled_from: pullFile, clusters, counts, ms })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'clustering failed: ' + String(e?.message || e).slice(0, 160), stage: 'cluster', retryable: true }, { status: 502 })
  }
}
