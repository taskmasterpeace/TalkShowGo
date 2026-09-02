import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { rankStories } from '@/lib/command/producer'
import { loadConfig } from '@/lib/command/stringer'
import { logTimer } from '@/lib/command/log'
import { effectiveClusters } from '@/lib/command/cluster-overrides'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
const ROOT = process.cwd()

/** GET — the most recent producer story ranking (if any). */
export function GET() {
  const dir = path.join(ROOT, 'lab', 'runs')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('producer_') && f.endsWith('.json')).sort().reverse() : []
  if (!files.length) return NextResponse.json({ ok: true, ranking: null })
  try { return NextResponse.json({ ok: true, ranking: JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8')) }) }
  catch { return NextResponse.json({ ok: true, ranking: null }) }
}

/** POST {file?, format?} — PRODUCER STORY RANKING (Story Resolution Loop). Scores each mined topic for
 *  SHOW VALUE (how good a talk-show segment it makes, NOT how verified it is); for a debate show
 *  contrasting-viewpoints/conflict is the top-weighted signal. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}
  const dir = path.join(ROOT, 'lab', 'runs')
  let clusterFiles: string[] = [], topicFiles: string[] = []
  try { const all = fs.existsSync(dir) ? fs.readdirSync(dir) : []; clusterFiles = all.filter(f => f.startsWith('clusters_') && f.endsWith('.json')).sort().reverse(); topicFiles = all.filter(f => f.startsWith('topics_') && f.endsWith('.json')).sort().reverse() } catch { /* fs error -> handled below */ }
  // prefer the fresh Event-Fingerprint clusters; fall back to the topic miner
  let srcFile = (body.file && /^(clusters|topics)_[\w:.-]+\.json$/.test(body.file) && [...clusterFiles, ...topicFiles].includes(body.file)) ? body.file : (clusterFiles[0] || topicFiles[0])
  if (!srcFile) return NextResponse.json({ ok: false, error: 'no clusters or topics — run CLUSTER (or the topic miner) first' }, { status: 400 })

  let data: any
  try { data = JSON.parse(fs.readFileSync(path.join(dir, srcFile), 'utf8')) } catch { return NextResponse.json({ ok: false, error: 'source file unreadable' }, { status: 500 }) }
  if (!data || typeof data !== 'object') return NextResponse.json({ ok: false, error: 'source file is empty' }, { status: 400 })
  // clusters → candidate shape rankStories expects. Rank the HUMAN-ADJUSTED view (pins / merges /
  // renames applied, dismissed dropped); skip weak "topic" clusters. Pinned stories are flagged so
  // the producer's ranking can never bury what the human marked as today's story.
  let effective: any[] = []
  if (srcFile.startsWith('clusters_')) { try { effective = effectiveClusters(srcFile).clusters } catch { effective = data.clusters || [] } }
  const candidates = srcFile.startsWith('clusters_')
    ? effective.filter((c: any) => c && c.kind !== 'topic' && !c.dismissed).map((c: any) => ({ title: c.title, why_today: (c.pinned ? '[PINNED BY THE PRODUCER AS TODAY\'S STORY] ' : '') + (c.why_moving || ''), angle: '', evidence: c.evidence || [], kind: c.kind, pinned: !!c.pinned, human: !!c.human }))
    : (Array.isArray(data.topics) ? data.topics : [])
  if (!candidates.length) return NextResponse.json({ ok: false, error: 'no stories to rank in ' + srcFile }, { status: 400 })

  const format = String(body.format || 'debate')
  const t = logTimer()
  try {
    const rankedRaw = (await rankStories(candidates, { format }, loadConfig()))
    const { ms, usage } = rankedRaw
    // a story the producer PINNED is today's story: it goes first no matter what the model scored
    const pinnedTitles = new Set(candidates.filter((c: any) => c.pinned).map((c: any) => String(c.title).trim().toLowerCase()))
    const ranked = rankedRaw.ranked.map((r: any) => ({ ...r, pinned: pinnedTitles.has(String(r.title).trim().toLowerCase()) }))
      .sort((a: any, b: any) => (Number(b.pinned) - Number(a.pinned)) || ((b.show_value || 0) - (a.show_value || 0)))
    // zero ranked is a parse/model failure, not a result — never overwrite the last good ranking with it
    if (!ranked.length) {
      t.done({ kind: 'rank', stage: 'parse', ok: false, beat: data.beat || null, ref: srcFile, summary: `0 ranked from ${candidates.length} candidates`, error: 'producer returned no ranking' })
      return NextResponse.json({ ok: false, error: 'the producer returned no ranking — retry', stage: 'parse', retryable: true, pulled_from: srcFile, ms }, { status: 502 })
    }
    const counts = { total: ranked.length, debatable: ranked.filter(r => r.debatable).length }
    const out = { pulled_from: srcFile, beat: data.beat || null, ranked_at: new Date().toISOString(), format, counts, ms, usage, ranked }
    fs.writeFileSync(path.join(dir, srcFile.replace(/^(clusters|topics)_/, 'producer_')), JSON.stringify(out, null, 2) + '\n')
    t.done(() => ({ kind: 'rank', stage: 'rank', ok: true, beat: data.beat || null, ref: srcFile, summary: `${ranked.length} ranked · ${counts.debatable} debatable · top: ${ranked[0]?.title} (${ranked[0]?.show_value})`, meta: { format, top3: ranked.slice(0, 3).map(r => `${r.show_value} ${r.title}`) } }))
    return NextResponse.json({ ok: true, pulled_from: srcFile, ranked, counts, ms })
  } catch (e: any) {
    t.done({ kind: 'rank', stage: 'rank', ok: false, beat: data.beat || null, ref: srcFile, summary: 'producer rank failed', error: String(e?.message || e) })
    return NextResponse.json({ ok: false, error: 'producer rank failed: ' + String(e?.message || e).slice(0, 160), stage: 'rank' }, { status: 502 })
  }
}
