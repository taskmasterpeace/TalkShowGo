// FOLLOW-UPS — after a real person answers in their own words, the show asks 2-3 short follow-ups with
// tappable choices, written from what they ACTUALLY said plus some context (a briefing's question and
// moves for the STRINGER interview; the beat's show name and latest headlines for a take link). One cheap
// gemini-2.5-flash-lite call; never throws; falls back to two honest standard questions.

export type Followup = { q: string; choices: string[] }
export type FollowupsArgs = { personName: string; personaNote?: string | null; context: string; sofar: { q: string; a: string }[] }
export type FollowupsResult = { followups: Followup[]; ms: number; fallback: boolean; error?: string }

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const FOLLOWUP_MODEL = 'google/gemini-2.5-flash-lite'

export const noDash = (s: string) => s.replace(/\s*[—–]\s*/g, ', ').replace(/\s*,\s*$/, '').trim()
export const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// try direct JSON, then a fenced block, then the last balanced-looking object (a model that wraps JSON in prose)
export function parseJsonLoose(text: string): any {
  const t = String(text || '').trim()
  try { return JSON.parse(t) } catch { /* not raw json */ }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) { try { return JSON.parse(fenced[1]) } catch { /* keep trying */ } }
  const first = t.indexOf('{'), last = t.lastIndexOf('}')
  if (first >= 0 && last > first) { try { return JSON.parse(t.slice(first, last + 1)) } catch { /* give up */ } }
  return null
}

/** One JSON-mode chat completion on OpenRouter. Throws on a missing key, a network failure or an API error. */
export async function openrouterJson(sys: string, user: string, o: { model?: string; temperature?: number; maxTokens?: number; timeoutMs?: number } = {}): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY missing')
  const r = await fetch(OR_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: o.model || FOLLOWUP_MODEL, temperature: o.temperature ?? 0.5, max_tokens: o.maxTokens ?? 700, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 45000),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error?.message || ('openrouter ' + r.status))
  return String(j.choices?.[0]?.message?.content || '')
}

// if the model is down or answers junk, the show still has two honest follow-ups to tap through
export const FALLBACK_FOLLOWUPS: Followup[] = [
  { q: 'How sure are you about that?', choices: ['Dead certain', 'Pretty sure', 'Leaning that way', 'Could go either way'] },
  { q: 'What would change your mind?', choices: ['Nothing, this is settled', 'Seeing it again with fresh eyes', 'Numbers I have not seen yet', 'Someone I trust saying otherwise'] },
]

/** Model output -> at most 3 clean follow-ups: no repeats of what was already asked, 2-4 distinct choices each, no "other" option, no em-dashes. */
export function parseFollowups(raw: string, alreadyAsked: string[]): Followup[] {
  const asked = new Set(alreadyAsked.map(norm))
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
  return followups
}

const SYS = `You write FOLLOW-UP QUESTIONS for a talk show. The person answering is a real listener the show invited to speak for a point of view, not a house host. They were given the CONTEXT below and have just answered the show's first questions in their own words. Read what they ACTUALLY said, then write 2 or 3 short follow-ups that sharpen THEIR take: pin down a specific pick, test the reason behind a claim they made, find out how sure they are, or what would change their mind. Rules: plain spoken and short; neutral, never leading; no jargon; no em-dashes; never repeat a question already asked; never invent facts that are not in the context or in their answers. Every follow-up carries 3 or 4 multiple-choice options, each under 10 words, clearly different from one another, covering the realistic range of answers. The person can always answer in their own words instead, so do NOT include an "other" or "something else" option.
Output STRICT JSON: {"followups":[{"q":"...","choices":["...","...","..."]}]}`

/** ONE flash-lite call -> 2-3 follow-ups with choices. Never throws: falls back to the standard set (minus anything already asked). */
export async function askFollowups(a: FollowupsArgs): Promise<FollowupsResult> {
  const t0 = Date.now()
  const asked = a.sofar.map(x => x.q)
  const user = `THE PERSON: ${a.personName}${a.personaNote ? ' (' + a.personaNote + ')' : ''}\n\nCONTEXT:\n${a.context || '(none)'}\n\nWHAT THEY SAID SO FAR:\n${a.sofar.map(x => `Q: ${x.q}\nA: ${x.a}`).join('\n\n')}`
  let raw = ''
  let error: string | undefined
  try { raw = await openrouterJson(SYS, user, { temperature: 0.5, maxTokens: 700 }) }
  catch (e: any) { error = String(e?.message || e).slice(0, 160) }
  const followups = parseFollowups(raw, asked)
  if (followups.length) return { followups, ms: Date.now() - t0, fallback: false }
  const askedN = new Set(asked.map(norm))
  return { followups: FALLBACK_FOLLOWUPS.filter(f => !askedN.has(norm(f.q))), ms: Date.now() - t0, fallback: true, error: error || 'model returned no usable follow-ups' }
}
