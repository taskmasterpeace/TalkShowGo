// PRODUCER STORY RANKING — the Story Resolution Loop's producer module (lab/STORY_RESOLUTION_LOOP.md).
// Reads the mined topics for a beat and scores each for SHOW VALUE: how good a TALK-SHOW segment it
// makes, NOT how verified it is (a perfectly-sourced story can still be a terrible show). Same research
// feed, different producer. For a DEBATE show, contrasting-viewpoints/conflict is the top-weighted
// signal — a first-class ranking dimension, not an afterthought.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OR_KEY = process.env.OPENROUTER_API_KEY
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const FORMATS = ['debate', 'explainer', 'hot-take', 'interview'] as const

export type Ranked = {
  title: string; show_value: number; rationale: string; best_angle: string
  best_format: string; contrasting_viewpoints: string[]; debatable: boolean
}

// robust parse: whole object, else first/last brace, else element-wise recover the ranked array so
// one malformed element (or trailing model junk gemini appends) can't fail the whole ranking
function parseRanked(content: string): any[] {
  const t = String(content || '').trim()
  const tryP = (x: string) => { try { return JSON.parse(x) } catch { return null } }
  let o = tryP(t)
  if (!o) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) o = tryP(t.slice(a, b + 1)) }
  if (!o) { const a = t.indexOf('['), b = t.lastIndexOf(']'); if (a >= 0 && b > a) o = tryP(t.slice(a, b + 1)) }
  if (Array.isArray(o)) return o                    // the model emitted a bare array — accept it
  if (o && Array.isArray(o.ranked)) return o.ranked
  const m = /"ranked"\s*:\s*\[/.exec(t); if (!m) return []
  let i = m.index + m[0].length; const out: any[] = []
  while (i < t.length) {
    while (i < t.length && /[\s,]/.test(t[i])) i++
    if (i >= t.length || t[i] === ']' || t[i] !== '{') break
    let d = 0, inS = false, esc = false; const st = i
    for (; i < t.length; i++) { const c = t[i]; if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue } if (c === '"') inS = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { i++; break } } }
    const e = tryP(t.slice(st, i)); if (e) out.push(e)
  }
  return out
}

export async function rankStories(topics: any[], opts: { format?: string } = {}, cfg: any = {}) {
  if (!OR_KEY) throw new Error('OPENROUTER_API_KEY missing')
  const t0 = Date.now()
  const format = String(opts.format || 'debate')
  const sys = `You are the executive producer of a ${format} talk show. Score each candidate story for SHOW VALUE (how good a segment it makes), NOT how verified it is — a perfectly-sourced story can still be a terrible show.
Score each story weighing: newsworthiness, recency, conversation_volume, conflict (contrasting viewpoints — WEIGHT THIS HIGHEST for a debate show), novelty, emotional_intensity, recognizable_characters, available_evidence, available_visuals, comedic_potential, opinion_potential, explainability, show_fit (does it fit a ${format} show).
For a debate show, prioritize stories with REAL contrasting viewpoints — two defensible sides the desk can actually argue. If a story has no genuine second side, set debatable=false and contrasting_viewpoints=[].
Keep each title EXACTLY as given so it can be matched back. Score honestly — reserve 80+ for stories that would genuinely lead a segment.
Output STRICT JSON only: {"ranked":[{"title":"<exact story title>","show_value":0-100,"rationale":"one line on why it's worth a show or not","best_angle":"the sharpest angle to run it","best_format":"debate|explainer|hot-take|interview","contrasting_viewpoints":["side A","side B"],"debatable":true|false}]}`
  const user = `CANDIDATE STORIES (score every one):\n${topics.map((t: any, i: number) => `${i}. "${t.title}" [kind:${t.kind || '?'} · overlap_sources:${t.overlap_sources ?? 0}]\n   why_today: ${t.why_today || ''}\n   angle: ${t.angle || ''}\n   evidence: ${(t.evidence || []).slice(0, 6).join(' | ')}`).join('\n\n')}`
  const r = await fetch(OR_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.producer?.model || 'google/gemini-2.5-flash-lite', temperature: 0.3, max_tokens: 4000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(120000),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error?.message || ('rank http ' + r.status))
  const content = j.choices?.[0]?.message?.content || '{}'
  const seen = new Set<string>()
  const ranked: Ranked[] = parseRanked(content)
    .filter((x: any) => x && x.title)
    .map((x: any) => {
      const show_value = Math.max(0, Math.min(100, Math.round(+x.show_value || 0)))
      const cv = Array.isArray(x.contrasting_viewpoints) ? x.contrasting_viewpoints.map((s: any) => String(s).slice(0, 120)).filter(Boolean).slice(0, 4) : []
      return {
        title: String(x.title).slice(0, 200),
        show_value,
        rationale: String(x.rationale || '').slice(0, 240),
        best_angle: String(x.best_angle || '').slice(0, 240),
        best_format: (FORMATS as readonly string[]).includes(String(x.best_format)) ? String(x.best_format) : 'debate',
        contrasting_viewpoints: cv,
        debatable: typeof x.debatable === 'boolean' ? x.debatable : cv.length >= 2,
      }
    })
    .filter((x: Ranked) => { const k = x.title.toLowerCase().trim(); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a: Ranked, b: Ranked) => b.show_value - a.show_value)
  return { ranked, ms: Date.now() - t0, usage: j.usage }
}

export function saveRanking(topicsFile: string, out: any) {
  const dir = path.join(ROOT, 'lab', 'runs')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, topicsFile.replace(/^topics_/, 'producer_')), JSON.stringify(out, null, 2) + '\n')
}
