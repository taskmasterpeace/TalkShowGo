import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { interviewQuestions, humanDelivery, mergeDelivery, delegateSlug } from '@/lib/command/agent-brief'
import { transcribeWav, toWav, wavSeconds } from '@/lib/command/stt'
import { appendLog } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
const ROOT = process.cwd()
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'
const FOLLOWUP_MODEL = 'google/gemini-2.5-flash-lite'
const MAX_AUDIO_BYTES = 25 * 1024 * 1024
// container by mime (codec params stripped): what MediaRecorder hands us across Chrome / Firefox / Safari, plus a raw wav
const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'video/mp4': 'mp4', 'audio/x-m4a': 'mp4', 'audio/m4a': 'mp4',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/vnd.wave': 'wav',
}

const bad = (error: string, stage: string, status = 400, retryable = false) => NextResponse.json({ ok: false, error, stage, retryable }, { status })
const delegateDir = (briefingId: string, slug: string) => path.join(ROOT, 'lab', 'briefings', briefingId, 'delegates', slug)
// a wav path the client hands back is only honored if it is one of THIS delegate's takes on disk (no path games)
function ownedWav(p: unknown, dir: string): string | null {
  if (typeof p !== 'string' || !p.trim()) return null
  const abs = path.resolve(p.trim())
  const inside = abs.toLowerCase().startsWith((dir + path.sep).toLowerCase())
  return inside && /\.wav$/i.test(abs) && fs.existsSync(abs) ? abs : null
}
const nextTake = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []).map(f => Number((f.match(/^take-(\d+)\./) || [])[1])).filter(Number.isFinite).reduce((m, n) => Math.max(m, n), 0) + 1
const noDash = (s: string) => s.replace(/\s*[—–]\s*/g, ', ').replace(/\s*,\s*$/, '').trim()
const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// try direct JSON, then a fenced block, then the last balanced-looking object (a model that wraps JSON in prose)
function parseJsonLoose(text: string): any {
  const t = String(text || '').trim()
  try { return JSON.parse(t) } catch { /* not raw json */ }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) { try { return JSON.parse(fenced[1]) } catch { /* keep trying */ } }
  const first = t.indexOf('{'), last = t.lastIndexOf('}')
  if (first >= 0 && last > first) { try { return JSON.parse(t.slice(first, last + 1)) } catch { /* give up */ } }
  return null
}

type Followup = { q: string; choices: string[] }
// if the model is down or answers junk, the show still has two honest follow-ups to tap through
const FALLBACK_FOLLOWUPS: Followup[] = [
  { q: 'How sure are you about that?', choices: ['Dead certain', 'Pretty sure', 'Leaning that way', 'Could go either way'] },
  { q: 'What would change your mind?', choices: ['Nothing, this is settled', 'Seeing it again with fresh eyes', 'Numbers I have not seen yet', 'Someone I trust saying otherwise'] },
]

/** ONE gemini-2.5-flash-lite call: 2-3 follow-ups built from what the person ACTUALLY said + the briefing,
 *  each with 3-4 short multiple-choice options. "Something else" is implicit (the page always offers a
 *  free-text box), so the model is told not to emit an "other" option. Never throws: falls back. */
async function askFollowups(briefing: any, delegate: any, sofar: { q: string; a: string }[]): Promise<{ followups: Followup[]; ms: number; fallback: boolean; error?: string }> {
  const t0 = Date.now()
  const asked = new Set(sofar.map(x => norm(x.q)))
  const moves = (briefing.moves || []).map((m: any) => `- (${m.kind}) ${m.headline}: ${m.body}`).join('\n')
  const sys = `You write FOLLOW-UP QUESTIONS for a talk show's delegate interview. The delegate is a real person a viewer named to represent a point of view, not a house host. They read an impartial briefing and have just answered the show's first questions in their own words. Read what they ACTUALLY said, then write 2 or 3 short follow-ups that sharpen THEIR take: pin down a specific pick, test the reason behind a claim they made, find out how sure they are, or what would change their mind. Rules: plain spoken and short; neutral, never leading; no jargon; no em-dashes; never repeat a question already asked; never invent facts that are not in the briefing or in their answers. Every follow-up carries 3 or 4 multiple-choice options, each under 10 words, clearly different from one another, covering the realistic range of answers. The person can always answer in their own words instead, so do NOT include an "other" or "something else" option.
Output STRICT JSON: {"followups":[{"q":"...","choices":["...","...","..."]}]}`
  const user = `THE PERSON: ${delegate.name}${delegate.persona_note ? ' (' + delegate.persona_note + ')' : ''}\n\nTHE QUESTION THE SHOW ASKS: ${briefing.question?.text}\n\nTHE BRIEFING MOVES:\n${moves}\n\nWHAT THEY SAID SO FAR:\n${sofar.map(x => `Q: ${x.q}\nA: ${x.a}`).join('\n\n')}`
  let raw = ''
  let error: string | undefined
  try {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) throw new Error('OPENROUTER_API_KEY missing')
    const r = await fetch(OR_URL, {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: FOLLOWUP_MODEL, temperature: 0.5, max_tokens: 700, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
      signal: AbortSignal.timeout(45000),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error?.message || ('openrouter ' + r.status))
    raw = String(j.choices?.[0]?.message?.content || '')
  } catch (e: any) { error = String(e?.message || e).slice(0, 160) }

  const parsed = parseJsonLoose(raw)
  const followups: Followup[] = []
  const seenQ = new Set<string>()
  for (const f of Array.isArray(parsed?.followups) ? parsed.followups : []) {
    const q = noDash(String(f?.q || '')).slice(0, 240)
    if (!q || asked.has(norm(q)) || seenQ.has(norm(q))) continue
    const choices: string[] = []
    const seenC = new Set<string>()
    for (const c of Array.isArray(f?.choices) ? f.choices : []) {
      const t = noDash(String(c || '')).slice(0, 80)
      if (!t || seenC.has(norm(t)) || /^(something|anything) else\b|^other\b|^none of (the above|these)/i.test(t)) continue
      seenC.add(norm(t)); choices.push(t)
      if (choices.length === 4) break
    }
    if (choices.length < 2) continue
    seenQ.add(norm(q)); followups.push({ q, choices })
    if (followups.length === 3) break
  }
  if (followups.length) return { followups, ms: Date.now() - t0, fallback: false }
  return { followups: FALLBACK_FOLLOWUPS.filter(f => !asked.has(norm(f.q))), ms: Date.now() - t0, fallback: true, error: error || 'model returned no usable follow-ups' }
}

/** THE DELEGATE, human path. All calls carry {briefing_id, delegate:{name, persona_note?}} plus:
 *  (nothing)                                              → the show's interview questions for this person
 *  {question, audio_b64, mime}                            → one recorded take: saved to lab/briefings/<id>/delegates/<slug>/take-<n>.<ext>,
 *                                                           converted to take-<n>.wav (24kHz mono), transcribed verbatim → {transcript, wav, seconds, ms}
 *  {transcript_so_far:[{q,a}], followups:true}            → 2-3 follow-up questions, each with 3-4 tappable choices → {followups:[{q, choices}]}
 *  {answers:[{q,a,source?,wav?}], voice?:{sample_wav, ref_text}} → saves their VERBATIM take as a human delegate delivery;
 *                                                           `voice` (their longest take + its transcript) is kept on the delivery for the floor to clone */
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
    const mime = String(b.mime || 'audio/webm').split(';')[0].trim().toLowerCase()
    const ext = EXT_BY_MIME[mime]
    if (!ext) return bad(`unsupported audio type: ${mime || '(none)'} (webm, ogg, mp4 or wav)`, 'validate')
    const b64 = b.audio_b64.replace(/^data:[^,]*,/, '').trim()
    if (b64.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 4) return bad('recording too large (max 25MB)', 'validate', 413)
    const buf = Buffer.from(b64, 'base64')
    if (buf.length > MAX_AUDIO_BYTES) return bad('recording too large (max 25MB)', 'validate', 413)
    if (buf.length < 512) return bad('that recording is empty: hold RECORD and talk for a few seconds', 'validate')
    fs.mkdirSync(dir, { recursive: true })
    const n = nextTake(dir)
    const raw = path.join(dir, `take-${n}.${ext === 'wav' ? 'orig.wav' : ext}`)
    const wav = path.join(dir, `take-${n}.wav`)
    fs.writeFileSync(raw, buf)
    try { toWav(raw, wav) } catch (e: any) {
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

  // ---- FOLLOW-UPS: multiple choice, built from what they actually said ----
  if (b.followups === true) {
    if (!Array.isArray(b.transcript_so_far)) return bad('transcript_so_far required', 'validate')
    const sofar = b.transcript_so_far.filter((x: any) => x && typeof x.a === 'string' && x.a.trim()).map((x: any) => ({ q: String(x.q || '').slice(0, 240), a: String(x.a).trim().slice(0, 2000) })).slice(0, 12)
    if (!sofar.length) return bad('answer at least one question first', 'validate')
    const out = await askFollowups(briefing, delegate, sofar)
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
