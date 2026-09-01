import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { buildBriefing, saveBriefing, listBriefings } from '@/lib/command/briefing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
const ROOT = process.cwd()

/** GET — recent briefings. */
export async function GET() {
  return NextResponse.json({ ok: true, briefings: listBriefings() })
}

/** POST {stringer_id, final_question, move_count?} — THE BRIEFING: order a dossier's cited
 *  evidence into "one move at a time" cards ending on the question. Uses only the ledger. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({} as any))
  if (!b.stringer_id || !b.final_question) {
    return NextResponse.json({ ok: false, error: 'stringer_id + final_question required', stage: 'validate', retryable: false }, { status: 400 })
  }
  if (!/^str_[a-z0-9]+$/.test(b.stringer_id)) return NextResponse.json({ ok: false, error: 'bad stringer_id' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'research', 'stringer', b.stringer_id + '.json')
  if (!fs.existsSync(p)) return NextResponse.json({ ok: false, error: 'dossier not found', stage: 'load', retryable: false }, { status: 404 })
  const stringer = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (!(stringer.evidence || []).some((e: any) => e.valid_source)) {
    return NextResponse.json({ ok: false, error: 'dossier has no cited evidence to build from', stage: 'evidence', retryable: false }, { status: 422 })
  }
  try {
    const briefing = await buildBriefing(stringer, String(b.final_question).slice(0, 300), Math.min(8, Math.max(3, b.move_count || 5)))
    saveBriefing(briefing)
    return NextResponse.json({ ok: true, ...briefing })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), stage: 'briefing', retryable: true }, { status: 502 })
  }
}
