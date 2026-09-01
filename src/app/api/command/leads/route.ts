import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { extractLeads, materialFromPull, saveLeads } from '@/lib/command/leads'
import { loadConfig } from '@/lib/command/stringer'

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

  try {
    const { leads, ms, raw } = await extractLeads(material, String(body.context || ''), loadConfig())
    if (!leads.length) return NextResponse.json({ ok: true, pulled_from: pullFile, feed_count: material.length, ms, counts: { total: 0, auto: 0, expand: 0, store: 0, ignore: 0 }, leads: [], byBand: { auto: [], expand: [], store: [], ignore: [] }, _debug_raw: String(raw || '').slice(0, 700) })
    const byBand = { auto: leads.filter(l => l.band === 'auto'), expand: leads.filter(l => l.band === 'expand'), store: leads.filter(l => l.band === 'store'), ignore: leads.filter(l => l.band === 'ignore') }
    const out = { pulled_from: pullFile, beat: report.beat || null, mined_at: new Date().toISOString(), feed_count: material.length, ms, counts: { total: leads.length, auto: byBand.auto.length, expand: byBand.expand.length, store: byBand.store.length, ignore: byBand.ignore.length }, leads }
    saveLeads(pullFile, out)
    return NextResponse.json({ ok: true, ...out, byBand })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'lead miner failed: ' + String(e?.message || e).slice(0, 160), stage: 'mine', retryable: true }, { status: 502 })
  }
}
