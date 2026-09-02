import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { extractLeads, materialFromPull, saveLeads } from '@/lib/command/leads'
import { loadConfig } from '@/lib/command/stringer'
import { logTimer } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
const ROOT = process.cwd()

/** GET — the most recent lead queue (if any). */
export function GET() {
  const dir = path.join(ROOT, 'lab', 'runs')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('leads_') && f.endsWith('.json')).sort().reverse() : []
  if (!files.length) return NextResponse.json({ ok: true, queue: null })
  try { return NextResponse.json({ ok: true, queue: JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8')) }) }
  catch { return NextResponse.json({ ok: true, queue: null }) }
}

/** POST {file?, context?} — RESEARCH LEAD MINER (Story Resolution Loop). Extracts scored,
 *  source-routed research leads from a pull's feed so the loop can chase the high-value ones. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}
  const pullsDir = path.join(ROOT, 'lab', 'runs')
  const pulls = fs.existsSync(pullsDir) ? fs.readdirSync(pullsDir).filter(f => f.startsWith('pull_') && f.endsWith('.json')).sort().reverse() : []
  const pullFile = (body.file && /^pull_[\w:.-]+\.json$/.test(body.file) && pulls.includes(body.file)) ? body.file : pulls[0]
  if (!pullFile) return NextResponse.json({ ok: false, error: 'no pull report — run PULL first', stage: 'load' }, { status: 400 })

  let report: any
  try { report = JSON.parse(fs.readFileSync(path.join(pullsDir, pullFile), 'utf8')) } catch { return NextResponse.json({ ok: false, error: 'pull unreadable' }, { status: 500 }) }
  const material = materialFromPull(report)
  if (!material.length) return NextResponse.json({ ok: false, error: 'pull report is empty' }, { status: 400 })

  const t = logTimer()
  try {
    const { leads, ms, raw } = await extractLeads(material, String(body.context || ''), loadConfig())
    // zero leads is NOT a success: never save it, never report ok:true, never leak raw model text to the client
    if (!leads.length) {
      console.error('[leads] 0 leads parsed from model output; raw head:', String(raw || '').slice(0, 300))
      t.done({ kind: 'leads', stage: 'parse', ok: false, beat: report.beat || null, ref: pullFile, summary: `0 leads from ${material.length} items`, error: raw ? 'model text but no leads parsed' : 'no leads returned' })
      return NextResponse.json({ ok: false, error: raw ? 'the miner returned text but no leads could be parsed — retry' : 'the miner returned no leads for this feed', stage: 'parse', retryable: true, pulled_from: pullFile, feed_count: material.length, ms }, { status: 502 })
    }
    const byBand = { auto: leads.filter(l => l.band === 'auto'), expand: leads.filter(l => l.band === 'expand'), store: leads.filter(l => l.band === 'store'), ignore: leads.filter(l => l.band === 'ignore') }
    const out = { pulled_from: pullFile, beat: report.beat || null, mined_at: new Date().toISOString(), feed_count: material.length, ms, counts: { total: leads.length, auto: byBand.auto.length, expand: byBand.expand.length, store: byBand.store.length, ignore: byBand.ignore.length }, leads }
    saveLeads(pullFile, out)
    t.done(() => ({ kind: 'leads', stage: 'mine', ok: true, beat: report.beat || null, ref: pullFile, summary: `${leads.length} leads · ${byBand.auto.length} auto · ${byBand.expand.length} expand`, meta: { auto: byBand.auto.slice(0, 6).map(l => l.value), archived: leads.filter(l => l.since || l.until).length } }))
    return NextResponse.json({ ok: true, ...out, byBand })
  } catch (e: any) {
    t.done({ kind: 'leads', stage: 'mine', ok: false, beat: report.beat || null, ref: pullFile, summary: 'lead miner failed', error: String(e?.message || e) })
    return NextResponse.json({ ok: false, error: 'lead miner failed: ' + String(e?.message || e).slice(0, 160), stage: 'mine', retryable: true }, { status: 502 })
  }
}
