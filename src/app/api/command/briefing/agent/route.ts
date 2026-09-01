import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { briefAgents, saveDeliveries } from '@/lib/command/agent-brief'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const ROOT = process.cwd()

/** POST {briefing_id, cast_ids} — brief each host on the Briefing (packed to its Model-DNA
 *  context budget), then one in-character stance call on its DNA engine. Closed evidence. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  if (!b.briefing_id || !Array.isArray(b.cast_ids) || !b.cast_ids.length) {
    return NextResponse.json({ ok: false, error: 'briefing_id + cast_ids[] required', stage: 'validate', retryable: false }, { status: 400 })
  }
  if (!/^brf_[a-z0-9]+$/.test(b.briefing_id)) return NextResponse.json({ ok: false, error: 'bad briefing_id' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.json')
  if (!fs.existsSync(p)) return NextResponse.json({ ok: false, error: 'briefing not found', stage: 'load', retryable: false }, { status: 404 })
  try {
    const briefing = JSON.parse(fs.readFileSync(p, 'utf8'))
    const result = await briefAgents(briefing, b.cast_ids.slice(0, 6))
    saveDeliveries(b.briefing_id, result)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), stage: 'agent-brief', retryable: true }, { status: 502 })
  }
}
