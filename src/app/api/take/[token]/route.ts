import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { personByToken } from '@/lib/command/people'
import { promptsFor, contextFor, latestBriefingFor } from '@/lib/command/prompts'
import { askFollowups } from '@/lib/command/followups'
import { decodeAudio, nextTake, saveClip, ownedWav, cleanSpeech, trimWav } from '@/lib/command/audio-intake'
import { transcribeWav, wavSeconds } from '@/lib/command/stt'
import { takeDir, saveTake, type TakeAnswer, type TakeVoice } from '@/lib/command/takes'
import { appendLog } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// THE TAKE LINK — the single intake for a person's take on a beat. A phone adapter, an email adapter and the
// public page all post through here with the person's token; nothing else authenticates them.
//   GET                                          -> who this link is for, the show, and the prompts to answer
//   POST {audio_b64, mime, take?}                -> one recorded clip: kept as lab/takes/<beat>/<slug>/take-<n>[.k].wav, transcribed verbatim
//   POST {followups:true, transcript_so_far}     -> 2-3 follow-ups with tappable choices, from what they said + the beat's recent context
//   POST {answers[], voice?, take?, prompt?, via?} -> the take, saved as take-<n>.json (used_in null until a show seats it)
// An unknown or malformed token is a bare 404 either way: the link is the secret, so the response never hints.
const MAX_STT_SECONDS = 180   // a ramble is kept whole on disk; only its first 3 minutes are transcribed (and seated)
const REF_MAX_SECONDS = 20    // Breeze clone ref spec: 10-20s, exact transcript
const MAX_TEXT = 6000         // humanDelivery's verbatim cap
const VIA = new Set(['link', 'phone', 'email', 'sim'])

const nope = () => NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
const bad = (error: string, stage: string, status = 400, retryable = false) => NextResponse.json({ ok: false, error, stage, retryable }, { status })
const showOf = (beat: any) => ({ name: String(beat?.show?.name || beat?.name || 'THE SHOW'), tagline: String(beat?.show?.tagline || '') })
// a clip reference from the client is a basename (what we hand out) or a full path; either way it must be this person's own wav
const ownedClip = (v: unknown, dir: string) => typeof v === 'string' && v.trim() ? ownedWav(path.isAbsolute(v.trim()) ? v.trim() : path.join(dir, path.basename(v.trim())), dir) : null
const clipExists = (dir: string, n: number) => fs.existsSync(dir) && fs.readdirSync(dir).some(f => f.startsWith(`take-${n}.`) && !f.endsWith('.json'))
const takeDone = (dir: string, n: number) => fs.existsSync(path.join(dir, `take-${n}.json`))
// the take number a visit keeps across a re-record and its final save; a stale or finished number falls through to the next free one
const takeNumber = (dir: string, wanted: unknown) => Number.isInteger(wanted) && (wanted as number) >= 1 && clipExists(dir, wanted as number) && !takeDone(dir, wanted as number) ? (wanted as number) : nextTake(dir)

// THE BRIEF — inform the person BEFORE asking. A cold "what's your take on the captains?" is useless if
// they don't know who the captains are. The beat's latest briefing is already impartial + neutrality-audited,
// so its event/stat/fact/context moves ARE the briefing to read them. Null when the beat has nothing yet.
function briefFor(beat: any): { headline: string; points: { headline: string; detail: string }[]; question: string | null } | null {
  const brf = latestBriefingFor(beat)
  const moves = brf && Array.isArray(brf.moves) ? brf.moves : []
  const points = moves
    .filter((m: any) => ['event', 'stat', 'fact', 'larger_context', 'context'].includes(m.kind))
    .slice(0, 6)
    .map((m: any) => ({ headline: String(m.headline || '').slice(0, 120), detail: String(m.body || '').slice(0, 260) }))
    .filter((p: any) => p.detail)
  if (!points.length) return null
  return { headline: String(brf.title || brf.question?.text || 'Here is what is going on').slice(0, 160), points, question: brf.question?.text ? String(brf.question.text).slice(0, 200) : null }
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const hit = personByToken(params.token)
  if (!hit) { appendLog({ kind: 'take', stage: 'denied', ok: false, summary: 'take link opened with an unknown token', error: 'unknown token' }); return nope() }
  const { beat, person } = hit
  const p = await promptsFor(beat, person)
  const brief = briefFor(beat)
  appendLog({ kind: 'take', stage: 'open', ok: true, beat: beat.id, ref: person.slug, ms: p.ms, summary: `${person.name} opened their take link · ${p.prompts.length} prompts (${p.source})${brief ? ' · briefed' : ''}`, error: p.error || null, meta: { source: p.source, has_context: !!p.context, has_brief: !!brief } })
  return NextResponse.json({ ok: true, show: showOf(beat), person: { name: person.name, slug: person.slug, relation: person.relation }, beat: beat.id, prompts: p.prompts, prompts_source: p.source, brief, max_seconds: MAX_STT_SECONDS })
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const hit = personByToken(params.token)
  if (!hit) { appendLog({ kind: 'take', stage: 'denied', ok: false, summary: 'take posted with an unknown token', error: 'unknown token' }); return nope() }
  const { beat, person } = hit
  const b = (await req.json().catch(() => ({} as any))) || {}
  const dir = takeDir(beat.id, person.slug)
  const ref = person.slug

  // ---- FAN DEPTH (Robert 2026-09-05): the page asks HOW they keep up (behavioral, never "are you a superfan")
  //      and this regenerates their questions for that level - casual gets big-feel, diehard gets the insider debate. ----
  // (guard: a final SAVE also carries depth for persistence - only a PURE depth request retunes; never swallow a save)
  if (typeof b.depth === 'string' && ['casual', 'regular', 'diehard'].includes(b.depth) && !Array.isArray(b.answers) && !b.audio_b64 && !b.ask && !b.followups) {
    const p = await promptsFor(beat, person, process.cwd(), b.depth as 'casual' | 'regular' | 'diehard')
    appendLog({ kind: 'take', stage: 'depth', ok: true, beat: beat.id, ref, summary: `${person.name} follows "${b.depth}" · ${p.prompts.length} prompts retuned (${p.source})`, meta: { depth: b.depth, source: p.source } })
    return NextResponse.json({ ok: true, prompts: p.prompts, source: p.source })
  }

  // ---- ASK: the person, being informed, has a question -> IMPARTIAL web lookup (SearXNG-first, free).
  //      This is the "look it up on the internet" step: name the captains, the pros/cons, then answer follow-ups. ----
  if (typeof b.ask === 'string' && b.ask.trim()) {
    const q = b.ask.trim().slice(0, 300); const t0 = Date.now()
    try {
      const { webResearch } = await import('@/lib/command/openrouter-web')
      const { loadConfig } = await import('@/lib/command/stringer')
      const res = await webResearch(q, loadConfig())
      const raw = String(res.answer || '').trim()
      // the web result is dossier-formatted ("(1) [nytimes.com]..."); turn it into a plain spoken catch-up for a fan
      let answer = raw
      if (raw && process.env.OPENROUTER_API_KEY) {
        try {
          const rr = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', temperature: 0.4, max_tokens: 240, messages: [{ role: 'system', content: 'A fan asked a question while getting caught up on a sports/culture story. Turn the web findings into a direct, impartial answer in 2 to 3 plain spoken sentences, like a knowledgeable friend catching them up. No citations, no numbered lists, no "web reporting" preamble, no em-dashes. If the findings do not actually answer it, say so plainly in one sentence.' }, { role: 'user', content: `Question: ${q}\n\nWeb findings:\n${raw.slice(0, 2200)}` }] }), signal: AbortSignal.timeout(30000) })
          const jj = await rr.json(); const t = String(jj.choices?.[0]?.message?.content || '').trim(); if (t) answer = t
        } catch { /* synthesis is gravy; fall back to the raw web text */ }
      }
      appendLog({ kind: 'take', stage: 'ask', ok: !!answer, beat: beat.id, ref, ms: Date.now() - t0, summary: `${person.name} asked: "${q.slice(0, 60)}"${answer ? '' : ' (no answer found)'}`, meta: { provider: res.provider, sources: (res.citations || []).length } })
      return NextResponse.json({ ok: true, answer: answer || "I could not pin that down from the sources right now. Try asking another way, or go with what you have.", sources: (res.citations || []).slice(0, 4).map((c: any) => ({ title: c.title, url: c.url, publisher: c.publisher })) })
    } catch (e: any) { return bad('lookup failed: ' + String(e?.message || e).slice(0, 120), 'ask', 502, true) }
  }

  // ---- ONE CLIP: raw -> 24kHz mono wav -> verbatim transcript (capped at 3 minutes of speech) ----
  if (typeof b.audio_b64 === 'string') {
    const t0 = Date.now()
    const dec = decodeAudio(b.audio_b64, b.mime)
    if (!dec.ok) { appendLog({ kind: 'take', stage: 'clip', ok: false, beat: beat.id, ref, summary: `${person.name}: clip refused`, error: dec.error }); return bad(dec.error, 'validate', dec.status) }
    const n = takeNumber(dir, b.take)
    let wav: string
    try { wav = saveClip(dir, dec.buf, dec.ext, n).wav } catch (e: any) {
      const error = String(e?.message || e).slice(0, 200)
      appendLog({ kind: 'take', stage: 'clip', ok: false, beat: beat.id, ref, ms: Date.now() - t0, summary: `${person.name} take ${n}: could not convert the recording`, error, meta: { take: n, mime: dec.mime, bytes: dec.buf.length } })
      return bad('could not convert the recording: ' + error, 'convert', 502, true)
    }
    const seconds = wavSeconds(wav)
    const capped = seconds > MAX_STT_SECONDS
    try {
      let sttWav = wav
      if (capped) sttWav = trimWav(wav, wav.replace(/\.wav$/i, '.stt.wav'), MAX_STT_SECONDS)
      const r = await transcribeWav(sttWav)
      const text = cleanSpeech(r.text).slice(0, MAX_TEXT)
      const words = text ? text.split(/\s+/).length : 0
      appendLog({ kind: 'take', stage: 'clip', ok: true, beat: beat.id, ref, ms: Date.now() - t0, summary: `${person.name} take ${n} (${Math.round(seconds)}s) transcribed · ${words} words${text ? '' : ' · no speech heard'}${capped ? ` · capped at ${MAX_STT_SECONDS}s` : ''}`, meta: { take: n, seconds, words, wav, stt_ms: r.ms, capped } })
      return NextResponse.json({ ok: true, transcript: text, seconds, kept_seconds: capped ? MAX_STT_SECONDS : seconds, capped, take: n, wav: path.basename(wav), mime: dec.mime, empty: !text, ms: Date.now() - t0 })
    } catch (e: any) {
      const error = String(e?.message || e).slice(0, 200)
      appendLog({ kind: 'take', stage: 'clip', ok: false, beat: beat.id, ref, ms: Date.now() - t0, summary: `${person.name} take ${n}: transcription failed`, error, meta: { take: n, wav } })
      return bad('transcription failed: ' + error, 'transcribe', 502, true)
    }
  }

  // ---- FOLLOW-UPS: from what they actually said + whatever the beat knows right now ----
  if (b.followups === true) {
    if (!Array.isArray(b.transcript_so_far)) return bad('transcript_so_far required', 'validate')
    const sofar = b.transcript_so_far.filter((x: any) => x && typeof x.a === 'string' && x.a.trim()).map((x: any) => ({ q: String(x.q || '').slice(0, 240), a: cleanSpeech(x.a).slice(0, 2000) })).slice(0, 12)
    if (!sofar.length) return bad('say something first', 'validate')
    const show = showOf(beat)
    const ctx = contextFor(beat)
    const context = ctx.text || `THE SHOW: ${show.name}${show.tagline ? ' (' + show.tagline + ')' : ''}\n${String(beat.description || '').slice(0, 400)}`
    const out = await askFollowups({ personName: person.name, personaNote: person.relation || null, context, sofar })
    appendLog({ kind: 'take', stage: 'followups', ok: true, beat: beat.id, ref, ms: out.ms, summary: `${person.name}: ${out.followups.length} follow-up${out.followups.length === 1 ? '' : 's'} with choices${out.fallback ? ' (standard set, model unavailable)' : ''}`, error: out.error || null, meta: { answered: sofar.length, fallback: out.fallback, has_context: !!ctx.text } })
    return NextResponse.json({ ok: true, followups: out.followups, ms: out.ms, fallback: out.fallback })
  }

  // ---- THE TAKE: their words, saved as-is; the longest recorded clip becomes their voice for the floor ----
  if (Array.isArray(b.answers)) {
    const t0 = Date.now()
    const answers: TakeAnswer[] = []
    for (const x of b.answers) {
      if (!x || typeof x !== 'object' || typeof x.a !== 'string') continue
      const a = cleanSpeech(x.a).slice(0, MAX_TEXT)
      if (!a) continue
      const wav = ownedClip(x.wav, dir)
      const source: TakeAnswer['source'] = x.source === 'voice' && wav ? 'voice' : x.source === 'choice' ? 'choice' : 'typed'
      answers.push({ q: String(x.q || '').slice(0, 240), a, source, ...(wav ? { wav } : {}) })
    }
    if (!answers.length) { appendLog({ kind: 'take', stage: 'take', ok: false, beat: beat.id, ref, summary: `${person.name}: take had no words, nothing saved`, error: 'empty take' }); return bad('nothing to save: no words in this take', 'validate') }
    // voice: what the client names (guarded), else the longest recorded clip; cut a Breeze-length ref off a long one
    let voice: (TakeVoice & { full_wav?: string; trimmed?: boolean }) | null = null
    let sample: string | null = null, refText = ''
    if (b.voice && typeof b.voice === 'object') {
      sample = ownedClip(b.voice.sample_wav, dir)
      if (!sample) return bad("voice.sample_wav must be one of this person's recorded clips", 'validate')
      refText = cleanSpeech(b.voice.ref_text)
      if (!refText) return bad('voice.ref_text required (the exact words on the sample)', 'validate')
    } else {
      const spoken = answers.filter(x => x.wav).map(x => ({ x, s: wavSeconds(x.wav!) })).sort((p, q) => q.s - p.s)[0]
      if (spoken) { sample = spoken.x.wav!; refText = spoken.x.a }
    }
    if (sample) {
      const full = wavSeconds(sample)
      if (full > REF_MAX_SECONDS + 2) {
        try {
          const cut = trimWav(sample, sample.replace(/\.wav$/i, '.ref.wav'), REF_MAX_SECONDS)
          let cutText = ''
          try { cutText = cleanSpeech((await transcribeWav(cut)).text) } catch { /* fall back to the head of their transcript */ }
          voice = { sample_wav: cut, ref_text: cutText || refText.split(/\s+/).slice(0, 55).join(' '), seconds: wavSeconds(cut), full_wav: sample, trimmed: true }
        } catch (e: any) { voice = { sample_wav: sample, ref_text: refText, seconds: full } }
      } else voice = { sample_wav: sample, ref_text: refText, seconds: full }
    }
    const n = takeNumber(dir, b.take)
    const prompts: string[] | undefined = Array.isArray(b.prompts) ? b.prompts.filter((q: any) => typeof q === 'string').map((q: string) => q.slice(0, 240)).slice(0, 6) : undefined
    const main = answers[0]
    const take = saveTake(beat.id, { slug: person.slug, name: person.name }, {
      take: n, prompt: String(b.prompt || prompts?.[0] || main.q || '').slice(0, 240), prompts, transcript: main.a, answers,
      seconds: main.wav ? wavSeconds(main.wav) : null, wav: main.wav || voice?.full_wav || voice?.sample_wav || null, mime: typeof b.mime === 'string' ? b.mime.slice(0, 40) : null,
      voice, capped: b.capped === true, via: VIA.has(String(b.via)) ? String(b.via) : 'link', ...(typeof b.depth === 'string' && ['casual','regular','diehard'].includes(b.depth) ? { depth: b.depth } : {}),
    })
    const by = (s: string) => answers.filter(x => x.source === s).length
    appendLog({ kind: 'take', stage: 'take', ok: true, beat: beat.id, ref, ms: Date.now() - t0, summary: `${person.name} dropped take ${n} · ${answers.length} answer${answers.length === 1 ? '' : 's'} (${by('voice')} voice · ${by('typed')} typed · ${by('choice')} choice)${voice ? ` · voice ref ${Math.round(voice.seconds)}s${voice.trimmed ? ' (cut from ' + Math.round(wavSeconds(voice.full_wav!)) + 's)' : ''}` : ''} · in the inbox`, meta: { take: n, words: main.a.split(/\s+/).length, voice: !!voice, via: take.via, path: take.path } })
    const { path: _p, ...pub } = take
    return NextResponse.json({ ok: true, take: { ...pub, wav: pub.wav ? path.basename(pub.wav) : null, voice: voice ? { seconds: voice.seconds, trimmed: !!voice.trimmed } : null }, on_next_show: true })
  }

  return bad('send audio_b64, followups:true, or answers[]', 'validate')
}
