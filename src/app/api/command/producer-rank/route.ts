import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { rankStories, saveRanking } from '@/lib/command/producer'
import { loadConfig } from '@/lib/command/stringer'

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
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('topics_') && f.endsWith('.json')).sort().reverse() : []
  const topicsFile = (body.file && /^topics_[\w:.-]+\.json$/.test(body.file) && files.includes(body.file)) ? body.file : files[0]
  if (!topicsFile) return NextResponse.json({ ok: false, error: 'no topics — run the topic miner first' }, { status: 400 })

  let topics: any
  try { topics = JSON.parse(fs.readFileSync(path.join(dir, topicsFile), 'utf8')) } catch { return NextResponse.json({ ok: false, error: 'topics file unreadable' }, { status: 500 }) }
  const candidates = Array.isArray(topics.topics) ? topics.topics : []
  if (!candidates.length) return NextResponse.json({ ok: false, error: 'topics file has no stories' }, { status: 400 })

  const format = String(body.format || 'debate')
  try {
    const { ranked, ms, usage } = await rankStories(candidates, { format }, loadConfig())
    const counts = { total: ranked.length, debatable: ranked.filter(r => r.debatable).length }
    const out = { pulled_from: topicsFile, beat: topics.beat || null, ranked_at: new Date().toISOString(), format, counts, ms, usage, ranked }
    saveRanking(topicsFile, out)
    return NextResponse.json({ ok: true, pulled_from: topicsFile, ranked, counts, ms })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'producer rank failed: ' + String(e?.message || e).slice(0, 160), stage: 'rank' }, { status: 502 })
  }
}
