import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { interviewQuestions, humanDelivery, mergeDelivery } from '@/lib/command/agent-brief'
import { appendLog } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
const ROOT = process.cwd()

/** THE DELEGATE, human path.
 *  POST {briefing_id, delegate:{name, persona_note?}}              → the show's interview questions for this person
 *  POST {briefing_id, delegate, answers:[{q,a}]}                   → saves their VERBATIM take as a human delegate delivery */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  if (!b.briefing_id || !/^brf_[a-z0-9]+$/.test(b.briefing_id)) {
    return NextResponse.json({ ok: false, error: 'valid briefing_id required', stage: 'validate', retryable: false }, { status: 400 })
  }
  const d = b.delegate || {}
  if (!d.name || typeof d.name !== 'string' || !d.name.trim()) {
    return NextResponse.json({ ok: false, error: 'delegate.name required', stage: 'validate', retryable: false }, { status: 400 })
  }
  const delegate = { name: d.name.trim().slice(0, 80), persona_note: String(d.persona_note || '').slice(0, 240) }
  const p = path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.json')
  if (!fs.existsSync(p)) return NextResponse.json({ ok: false, error: 'briefing not found', stage: 'load', retryable: false }, { status: 404 })
  let briefing: any
  try { briefing = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return NextResponse.json({ ok: false, error: 'briefing unreadable', stage: 'load' }, { status: 500 }) }

  try {
    if (Array.isArray(b.answers)) {
      const delivery = humanDelivery(briefing, delegate, b.answers)
      if (!delivery) return NextResponse.json({ ok: false, error: 'no answers were given', stage: 'validate', retryable: false }, { status: 400 })
      const saved = mergeDelivery(b.briefing_id, delivery)
      appendLog({ kind: 'cast', stage: 'interview', ok: true, ref: b.briefing_id, summary: `${delegate.name} answered ${delivery.interview.length} questions · saved verbatim as a human delegate`, meta: { verdict: delivery.stance.answer } })
      return NextResponse.json({ ok: true, delivery, saved })
    }
    const { questions, ms } = await interviewQuestions(briefing, delegate)
    return NextResponse.json({ ok: true, questions, ms })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), stage: 'interview', retryable: true }, { status: 502 })
  }
}
