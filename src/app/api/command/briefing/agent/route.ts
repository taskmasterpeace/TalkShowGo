import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { briefAgents, saveDeliveries } from '@/lib/command/agent-brief'
import { logTimer } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const ROOT = process.cwd()

/** POST {briefing_id, cast_ids} — brief each host on the Briefing (packed to its Model-DNA
 *  context budget), then one in-character stance call on its DNA engine. Closed evidence. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  const castIds: any[] = Array.from(new Set(Array.isArray(b.cast_ids) ? b.cast_ids : []))   // distinct: two of the same host is one host
  const delegates = Array.isArray(b.delegates) ? b.delegates.filter((d: any) => d && d.name).slice(0, 4) : []
  if (!b.briefing_id || (!castIds.length && !delegates.length)) {
    return NextResponse.json({ ok: false, error: 'briefing_id + at least one of cast_ids[] / delegates[] required', stage: 'validate', retryable: false }, { status: 400 })
  }
  if (!/^brf_[a-z0-9]+$/.test(b.briefing_id)) return NextResponse.json({ ok: false, error: 'bad briefing_id' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.json')
  if (!fs.existsSync(p)) return NextResponse.json({ ok: false, error: 'briefing not found', stage: 'load', retryable: false }, { status: 404 })
  // validate host ids up front — an unknown id is a 400, never a saved "briefing" with nobody in it
  let knownHosts: string[] = []
  try { knownHosts = (JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), 'utf8')).hosts || []).map((h: any) => h.id) } catch { /* cast unreadable -> fall through to briefAgents' own errors */ }
  const unknown = castIds.filter((id: any) => typeof id !== 'string' || (knownHosts.length && !knownHosts.includes(id)))
  if (unknown.length) return NextResponse.json({ ok: false, error: `unknown host id(s): ${unknown.join(', ')} — valid: ${knownHosts.join(', ')}`, stage: 'validate', retryable: false }, { status: 400 })
  const t = logTimer()
  try {
    const briefing = JSON.parse(fs.readFileSync(p, 'utf8'))
    const result = await briefAgents(briefing, castIds.slice(0, 6), delegates)
    // nothing briefed is a failure, not a result — and it must never overwrite a good stance file
    if (!(result.deliveries || []).some((d: any) => d.ok)) {
      t.done({ kind: 'cast', stage: 'brief', ok: false, ref: b.briefing_id, summary: `0 of ${(result.deliveries || []).length} voices briefed`, error: 'no voice could be briefed' })
      return NextResponse.json({ ok: false, error: 'no voice could be briefed — nothing was saved', stage: 'agent-brief', retryable: true, deliveries: result.deliveries }, { status: 422 })
    }
    const saved = saveDeliveries(b.briefing_id, result)
    t.done(() => { const ok = (result.deliveries || []).filter((d: any) => d.ok); return { kind: 'cast', stage: 'brief', ok: true, ref: b.briefing_id, summary: `${ok.length}/${result.deliveries.length} voices briefed · ${ok.map((d: any) => d.name).join(', ')}${saved.promoted ? '' : ' · kept prior stances (fewer hosts)'}`, meta: { hosts: castIds, delegates: delegates.map((d: any) => d.name), promoted: saved.promoted } } })
    return NextResponse.json({ ok: true, ...result, saved })
  } catch (e: any) {
    t.done({ kind: 'cast', stage: 'brief', ok: false, ref: b.briefing_id, summary: 'cast brief failed', error: String(e?.message || e) })
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), stage: 'agent-brief', retryable: true }, { status: 502 })
  }
}
