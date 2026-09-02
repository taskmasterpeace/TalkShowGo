import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { interviewQuestions, humanDelivery, mergeDelivery, delegateSlug } from '@/lib/command/agent-brief'
import { transcribeWav, wavSeconds } from '@/lib/command/stt'
import { decodeAudio, nextTake, saveClip, ownedWav } from '@/lib/command/audio-intake'
import { askFollowups } from '@/lib/command/followups'
import { appendLog } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
const ROOT = process.cwd()

const bad = (error: string, stage: string, status = 400, retryable = false) => NextResponse.json({ ok: false, error, stage, retryable }, { status })
const delegateDir = (briefingId: string, slug: string) => path.join(ROOT, 'lab', 'briefings', briefingId, 'delegates', slug)

/** THE DELEGATE, human path. All calls carry {briefing_id, delegate:{name, persona_note?}} plus:
 *  (nothing)                                              → the show's interview questions for this person
 *  {question, audio_b64, mime}                            → one recorded take: saved to lab/briefings/<id>/delegates/<slug>/take-<n>.<ext>,
 *                                                           converted to take-<n>.wav (24kHz mono), transcribed verbatim → {transcript, wav, seconds, ms}
 *  {transcript_so_far:[{q,a}], followups:true}            → 2-3 follow-up questions, each with 3-4 tappable choices → {followups:[{q, choices}]}
 *  {answers:[{q,a,source?,wav?}], voice?:{sample_wav, ref_text}} → saves their VERBATIM take as a human delegate delivery;
 *                                                           `voice` (their longest take + its transcript) is kept on the delivery for the floor to clone
 *  The recording intake (mime map, limits, take numbering, path guard) and the follow-up writer are shared with the
 *  public take link (/api/take/<token>) through lib/command/audio-intake.ts and lib/command/followups.ts. */
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
  const slug = delegateSlug(delegate.name)
  const dir = delegateDir(b.briefing_id, slug)

  // ---- VOICE: one recorded take -> raw file -> 24kHz mono wav -> verbatim transcript ----
  if (typeof b.audio_b64 === 'string') {
    const t0 = Date.now()
    const dec = decodeAudio(b.audio_b64, b.mime)
    if (!dec.ok) return bad(dec.error, 'validate', dec.status)
    const { buf, mime } = dec
    const n = nextTake(dir)
    let wav: string
    try { wav = saveClip(dir, buf, dec.ext, n).wav } catch (e: any) {
      const error = String(e?.message || e).slice(0, 200)
      appendLog({ kind: 'cast', stage: 'transcribe', ok: false, ref: b.briefing_id, ms: Date.now() - t0, summary: `${delegate.name} take ${n}: could not convert the recording`, error, meta: { delegate: slug, take: n, mime, bytes: buf.length } })
      return bad('could not convert the recording: ' + error, 'convert', 502, true)
    }
    try {
      const { text, ms, seconds } = await transcribeWav(wav)
      const words = text ? text.split(/\s+/).length : 0
      // sidecar so a take on disk is never anonymous: which question, what was heard, how long
      fs.writeFileSync(path.join(dir, `take-${n}.json`), JSON.stringify({ take: n, question: String(b.question || '').slice(0, 240), transcript: text, seconds, mime, bytes: buf.length, wav, created_at: new Date().toISOString() }, null, 2) + '\n')
      appendLog({ kind: 'cast', stage: 'transcribe', ok: true, ref: b.briefing_id, ms: Date.now() - t0, summary: `${delegate.name} take ${n} (${seconds}s) transcribed · ${words} words${text ? '' : ' · no speech heard'}`, meta: { delegate: slug, take: n, seconds, words, wav, stt_ms: ms } })
      return NextResponse.json({ ok: true, transcript: text, wav, seconds, ms, take: n, empty: !text })
    } catch (e: any) {
      const error = String(e?.message || e).slice(0, 200)
      appendLog({ kind: 'cast', stage: 'transcribe', ok: false, ref: b.briefing_id, ms: Date.now() - t0, summary: `${delegate.name} take ${n}: transcription failed`, error, meta: { delegate: slug, take: n, wav } })
      return bad('transcription failed: ' + error, 'transcribe', 502, true)
    }
  }

  // ---- FOLLOW-UPS: multiple choice, built from what they actually said + the briefing ----
  if (b.followups === true) {
    if (!Array.isArray(b.transcript_so_far)) return bad('transcript_so_far required', 'validate')
    const sofar = b.transcript_so_far.filter((x: any) => x && typeof x.a === 'string' && x.a.trim()).map((x: any) => ({ q: String(x.q || '').slice(0, 240), a: String(x.a).trim().slice(0, 2000) })).slice(0, 12)
    if (!sofar.length) return bad('answer at least one question first', 'validate')
    const moves = (briefing.moves || []).map((m: any) => `- (${m.kind}) ${m.headline}: ${m.body}`).join('\n')
    const context = `THE QUESTION THE SHOW ASKS: ${briefing.question?.text}\n\nTHE BRIEFING MOVES:\n${moves}`
    const out = await askFollowups({ personName: delegate.name, personaNote: delegate.persona_note, context, sofar })
    appendLog({ kind: 'cast', stage: 'followups', ok: true, ref: b.briefing_id, ms: out.ms, summary: `${delegate.name}: ${out.followups.length} follow-up${out.followups.length === 1 ? '' : 's'} with choices${out.fallback ? ' (standard set, model unavailable)' : ''}`, error: out.error || null, meta: { delegate: slug, answered: sofar.length, fallback: out.fallback } })
    return NextResponse.json({ ok: true, followups: out.followups, ms: out.ms, fallback: out.fallback })
  }

  try {
    if (Array.isArray(b.answers)) {
      const answers = b.answers.filter((x: any) => x && typeof x === 'object').map((x: any) => { const wav = ownedWav(x.wav, dir); return { q: x.q, a: x.a, source: x.source, ...(wav ? { wav } : {}) } })
      let voice: { sample_wav: string; ref_text: string; seconds: number } | null = null
      if (b.voice && typeof b.voice === 'object') {
        const sample = ownedWav(b.voice.sample_wav, dir)
        if (!sample) return bad("voice.sample_wav must be one of this delegate's recorded takes", 'validate')
        const refText = String(b.voice.ref_text || '').trim()
        if (!refText) return bad('voice.ref_text required (the exact transcript of the sample)', 'validate')
        voice = { sample_wav: sample, ref_text: refText, seconds: wavSeconds(sample) }
      }
      const delivery = humanDelivery(briefing, delegate, answers, voice)
      if (!delivery) return NextResponse.json({ ok: false, error: 'no answers were given', stage: 'validate', retryable: false }, { status: 400 })
      const saved = mergeDelivery(b.briefing_id, delivery)
      const by = (s: string) => delivery.interview.filter(x => x.source === s).length
      appendLog({ kind: 'cast', stage: 'interview', ok: true, ref: b.briefing_id, summary: `${delegate.name} answered ${delivery.interview.length} questions (${by('voice')} voice · ${by('typed')} typed · ${by('choice')} choice) · saved verbatim as a human delegate${voice ? ` · voice sample kept (${voice.seconds}s)` : ''}`, meta: { verdict: delivery.stance.answer, voice: !!voice, sample_wav: voice?.sample_wav } })
      return NextResponse.json({ ok: true, delivery, saved })
    }
    const { questions, ms } = await interviewQuestions(briefing, delegate)
    return NextResponse.json({ ok: true, questions, ms })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), stage: 'interview', retryable: true }, { status: 502 })
  }
}
