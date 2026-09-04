import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { buildBriefing, saveBriefing, listBriefings } from '@/lib/command/briefing'
import { appendLog, logTimer } from '@/lib/command/log'

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
  if (!fs.existsSync(p)) {
    appendLog({ kind: 'briefing', stage: 'load', ok: false, ref: b.stringer_id, summary: `briefing · dossier ${b.stringer_id} not found`, error: 'dossier not found' })
    return NextResponse.json({ ok: false, error: 'dossier not found', stage: 'load', retryable: false }, { status: 404 })
  }
  const stringer = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (!(stringer.evidence || []).some((e: any) => e.valid_source)) {
    appendLog({ kind: 'briefing', stage: 'evidence', ok: false, ref: b.stringer_id, summary: `briefing · ${b.stringer_id} has no cited evidence · ${stringer.assignment?.text || ''}`, error: 'dossier has no cited evidence to build from' })
    return NextResponse.json({ ok: false, error: 'dossier has no cited evidence to build from', stage: 'evidence', retryable: false }, { status: 422 })
  }
  const moveCount = Math.min(8, Math.max(3, b.move_count || 5))
  const t = logTimer()
  try {
    const briefing = await buildBriefing(stringer, String(b.final_question).slice(0, 300), moveCount)
    if ((stringer as any).beat) (briefing as any).beat = (stringer as any).beat   // inherit the dossier's beat stamp
    saveBriefing(briefing)
    t.done(() => ({
      kind: 'briefing', stage: 'briefing', ok: true, ref: briefing.id,
      summary: `${briefing.moves.length} moves · neutrality ${briefing.audit.status}${briefing.audit.uncited_moves.length ? ` · ${briefing.audit.uncited_moves.length} uncited` : ''}${briefing.audit.loaded_language.length ? ` · ${briefing.audit.loaded_language.length} loaded` : ''} · ${briefing.title}`,
      meta: { stringer_id: stringer.id, question: briefing.question.text, question_type: briefing.question.type, non_leading: briefing.audit.question_is_non_leading, moves_requested: moveCount, model_ms: briefing.elapsed_ms },
    }))
    return NextResponse.json({ ok: true, ...briefing })
  } catch (e: any) {
    t.done(() => ({ kind: 'briefing', stage: 'briefing', ok: false, ref: b.stringer_id, summary: `briefing failed · ${stringer.assignment?.text || b.stringer_id}`, error: String(e?.message || e), meta: { stringer_id: b.stringer_id, question: String(b.final_question).slice(0, 200), moves_requested: moveCount } }))
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), stage: 'briefing', retryable: true }, { status: 502 })
  }
}
