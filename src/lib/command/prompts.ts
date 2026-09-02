// PROMPTS FOR A PERSON'S TAKE — what the take link asks. A person on a beat is not handed a briefing;
// they are asked, in plain spoken words, what they think. If the beat has a recent briefing or cluster
// run, three tailored questions come from flash-lite (neutral, short, no em-dashes, like
// interviewQuestions in agent-brief.ts); otherwise a show-aware generic set phrased from the beat's
// `show` block. The same context feeds their follow-ups.
import fs from 'node:fs'
import path from 'node:path'
import { noDash, parseJsonLoose, openrouterJson } from './followups'

export type Flavor = 'sports' | 'town' | 'general'
export type BeatContext = {
  briefing: { id: string; title: string; question: string; created_at: string } | null
  headlines: string[]          // the briefing's move headlines
  cluster_headlines: string[]  // the latest cluster run's story titles
  text: string                 // the plain-text block handed to the models ('' when the beat has nothing recent)
}
export type PromptsResult = { prompts: string[]; source: 'custom' | 'tailored' | 'generic'; context: string; ms: number; error?: string }

const STOP = new Set(['south', 'north', 'east', 'west', 'county', 'city', 'state', 'united', 'daily', 'weekly', 'report', 'radio', 'show', 'hour', 'club', 'house', 'story', 'history', 'their', 'there', 'about', 'every', 'building', 'template', 'sports', 'local', 'street', 'news', 'first'])
const words = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean)

function beatText(beat: any): string {
  const cases = Array.isArray(beat?.cases) ? beat.cases.map((c: any) => `${c?.id || ''} ${c?.title || ''}`).join(' ') : ''
  return [beat?.id, beat?.name, beat?.description, beat?.show?.name, beat?.show?.tagline, cases].filter(Boolean).join(' ').toLowerCase()
}
export function beatFlavor(beat: any): Flavor {
  const t = beatText(beat)
  if (/\b(nfl|nba|mlb|nhl|mls|ncaa|team|game|games|season|playoff|playoffs|roster|trade|trades|injury|injuries|quarterback|coach|huddle|falcons|pacers|football|basketball|baseball|hockey|soccer)\b/.test(t)) return 'sports'
  if (/\b(town|city|county|local|council|mayor|police|sheriff|school|downtown|neighborhood|community)\b/.test(t)) return 'town'
  return 'general'
}

export function genericPrompts(beat: any): string[] {
  const show = String(beat?.show?.name || beat?.name || 'the show').trim()
  switch (beatFlavor(beat)) {
    case 'sports': return ['What did you make of the game?', 'Anything about trades, injuries, or the season you want on the record?', "What's your prediction?"]
    case 'town': return ["What's going on around town that people should be talking about?", 'Anything the local coverage is getting wrong?', "What's your call on how it plays out?"]
    default: return [`What do you want on the record for ${show} this week?`, "What's everybody getting wrong right now?", "In one sentence, what's your verdict?"]
  }
}

/** Does a piece of text (a briefing question, a title) belong to this beat? Matched on the beat name, the show name, or a distinctive id token. */
export function beatMentioned(text: string, beat: any): boolean {
  const t = ' ' + words(text).join(' ') + ' '
  if (!t.trim()) return false
  const tokens = new Set<string>()
  for (const src of [beat?.id, beat?.name, beat?.show?.name]) for (const w of words(src)) if (w.length >= 5 && !STOP.has(w)) tokens.add(w)
  return Array.from(tokens).some(w => t.includes(' ' + w + ' '))
}

const readJson = (p: string) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }

/** Newest briefing (by created_at) whose title or question mentions the beat, within maxAgeDays. */
export function latestBriefingFor(beat: any, root = process.cwd(), maxAgeDays = 14): any | null {
  const dir = path.join(root, 'lab', 'briefings')
  if (!fs.existsSync(dir)) return null
  const cutoff = Date.now() - maxAgeDays * 86400e3
  let best: any = null
  for (const f of fs.readdirSync(dir)) {
    if (!/^brf_[a-z0-9]+\.json$/.test(f)) continue
    const b = readJson(path.join(dir, f))
    if (!b || !b.id) continue
    const ts = Date.parse(b.created_at || '')
    if (!Number.isFinite(ts) || ts < cutoff) continue
    if (!beatMentioned(`${b.title || ''} ${b.question?.text || ''}`, beat)) continue
    if (!best || ts > Date.parse(best.created_at)) best = b
  }
  return best
}

/** Newest lab/runs/clusters_* for the beat (by filename suffix, else the `beat` field inside) -> story titles. */
export function latestClusterFor(beat: any, root = process.cwd()): { file: string; titles: string[] } | null {
  const dir = path.join(root, 'lab', 'runs')
  if (!fs.existsSync(dir) || !beat?.id) return null
  const files = fs.readdirSync(dir).filter(f => f.startsWith('clusters_') && f.endsWith('.json')).sort().reverse()
  for (const f of files) {
    const bySuffix = f.endsWith(`_${beat.id}.json`)
    if (!bySuffix && /_[a-z0-9-]+\.json$/.test(f.replace(/^clusters_\d{4}-\d{2}-\d{2}T[\d-]+/, ''))) continue   // stamped for another beat
    const j = readJson(path.join(dir, f))
    if (!j || (!bySuffix && j.beat !== beat.id)) continue
    const clusters = Array.isArray(j.clusters) ? j.clusters : []
    const stories = clusters.filter((c: any) => c?.kind === 'story' && c.title)
    const titles = (stories.length ? stories : clusters).map((c: any) => String(c.title || '').trim()).filter(Boolean).slice(0, 8)
    return { file: f, titles }
  }
  return null
}

/** Everything recent the beat knows, as one plain-text block (for tailored prompts and follow-ups). */
export function contextFor(beat: any, root = process.cwd()): BeatContext {
  const b = latestBriefingFor(beat, root)
  const c = latestClusterFor(beat, root)
  const headlines: string[] = b ? (b.moves || []).map((m: any) => String(m?.headline || '').trim()).filter(Boolean).slice(0, 8) : []
  const cluster_headlines = c?.titles || []
  const L: string[] = []
  if (b || cluster_headlines.length) L.push(`THE SHOW: ${beat?.show?.name || beat?.name || 'the show'}${beat?.show?.tagline ? ' (' + beat.show.tagline + ')' : ''}`)
  if (b) {
    L.push(`THE QUESTION THE SHOW IS ASKING: ${b.question?.text || b.title || ''}`)
    const moves = (b.moves || []).slice(0, 8).map((m: any) => `- ${m?.headline || ''}${m?.body ? ': ' + String(m.body).slice(0, 300) : ''}`).filter((s: string) => s.length > 2)
    if (moves.length) L.push('THE BRIEFING MOVES:\n' + moves.join('\n'))
  }
  if (cluster_headlines.length) L.push('WHAT IS IN THE NEWS ON THIS BEAT RIGHT NOW:\n' + cluster_headlines.map(t => '- ' + t).join('\n'))
  return {
    briefing: b ? { id: b.id, title: String(b.title || ''), question: String(b.question?.text || ''), created_at: String(b.created_at || '') } : null,
    headlines, cluster_headlines, text: L.join('\n\n'),
  }
}

const SYS = `You write the QUESTIONS a talk show sends to a real person on its beat: a fan, a neighbor, a family member the show has invited to weigh in through a private link. They have NOT read anything; they just live it. Write exactly 3 SHORT, plain-spoken, NEUTRAL questions in the second person that would get THIS person talking about what is going on right now (the context below), the way a friend would ask. The first invites their overall take, the second digs into one concrete thing from the context, the third asks for a one-line prediction or verdict. No leading questions, no jargon, no em-dashes, nothing over 20 words.
Output STRICT JSON: {"questions":["...","...","..."]}`

/** The prompts a person sees on their take link. Custom prompts win; else tailored from recent context; else the generic set. Never throws. */
export async function promptsFor(beat: any, person: any, root = process.cwd()): Promise<PromptsResult> {
  const t0 = Date.now()
  const custom: string[] = Array.isArray(person?.custom_prompts) ? person.custom_prompts.filter((q: any) => typeof q === 'string' && q.trim()).map((q: string) => noDash(q).slice(0, 240)) : []
  if (person?.prompts_mode === 'custom' && custom.length) return { prompts: custom, source: 'custom', context: contextFor(beat, root).text, ms: Date.now() - t0 }
  const ctx = contextFor(beat, root)
  if (ctx.text) {
    try {
      const user = `THE PERSON: ${person?.name || 'a listener'}${person?.relation ? ' (' + person.relation + ')' : ''}\n\n${ctx.text}`
      const raw = await openrouterJson(SYS, user, { temperature: 0.5, maxTokens: 400 })
      const j = parseJsonLoose(raw)
      const qs: string[] = Array.isArray(j?.questions) ? j.questions.filter((q: any) => typeof q === 'string' && q.trim()).map((q: string) => noDash(q.trim()).slice(0, 160)).slice(0, 3) : []
      if (qs.length >= 2) return { prompts: qs, source: 'tailored', context: ctx.text, ms: Date.now() - t0 }
      return { prompts: genericPrompts(beat), source: 'generic', context: ctx.text, ms: Date.now() - t0, error: 'model returned no usable questions' }
    } catch (e: any) {
      return { prompts: genericPrompts(beat), source: 'generic', context: ctx.text, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 160) }
    }
  }
  return { prompts: genericPrompts(beat), source: 'generic', context: '', ms: Date.now() - t0 }
}
