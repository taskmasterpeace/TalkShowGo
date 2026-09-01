// RESEARCH LEAD MINER — the Story Resolution Loop's missing module (lab/STORY_RESOLUTION_LOOP.md).
// Reads a pull's feed items and extracts scored RESEARCH LEADS: the people/accounts/URLs/events/
// historical refs worth ANOTHER search — each routed to a source + search mode, each with a Lead
// Value Score so the loop auto-chases the 80-100s and banks the rest (no uncontrolled crawl).
// This is the Orangeburg behavior automated: don't start from zero, follow the leads.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OR_KEY = process.env.OPENROUTER_API_KEY
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const DESTINATIONS = ['X', 'YOUTUBE_CURRENT', 'YOUTUBE_CONTEXT', 'YOUTUBE_LEGACY', 'YOUTUBE_ORIGINAL', 'YOUTUBE_REACTION', 'WEB'] as const

// Lead Value Score bands (Robert's spec): what the loop does with a lead
export function band(score: number): 'auto' | 'expand' | 'store' | 'ignore' {
  if (score >= 80) return 'auto'      // auto-investigate
  if (score >= 60) return 'expand'    // expand if research budget allows
  if (score >= 40) return 'store'     // store, don't auto-pursue
  return 'ignore'
}

const SYS = `You are the RESEARCH LEAD EXTRACTOR for a talk show. Given today's feed items about a story, find the RESEARCH LEADS: anything mentioned that could MATERIALLY change our understanding or lead to primary evidence — a person, account, org, claim, quote, event, url, video/interview/podcast, hashtag, place, date, historical reference, product, law, court case, report, statistic.
HARD RULE: only extract things a NEW SEARCH could resolve into evidence / reaction / contradiction / a primary source. Do NOT extract contextual color ("this reminds me of the dot-com bubble" is NOT a lead). Prefer the ORIGINATOR of a claim over the loudest repost.
For each lead: route it to the best source + search mode, write the exact search query to run, and score its VALUE 0-100 weighing: relevance, novelty (do we already know it?), specificity (can we actually search it?), evidence-potential, recurrence (do multiple sources mention it?), authority (credible/relevant source?), controversy, visual value, context value, producer value.
Destinations: X (recent statements/reactions/who-first/how-widespread), YOUTUBE_CURRENT (last few days), YOUTUBE_CONTEXT (recent explainer), YOUTUBE_LEGACY (historical interview/speech/clip), YOUTUBE_ORIGINAL (a named speaker/channel/event), YOUTUBE_REACTION (commentary), WEB (article/record/site).
Output STRICT JSON only: {"leads":[{"type":"PERSON|ACCOUNT|ORG|CLAIM|QUOTE|EVENT|URL|VIDEO|INTERVIEW|PODCAST|HASHTAG|PLACE|DATE|HISTORICAL|PRODUCT|LAW|COURT_CASE|REPORT|STATISTIC","value":"the exact searchable thing","why":"the evidence it could produce","destination":"...","query":"the search string","score":0-100}]}
Score honestly — most leads are 40-70; reserve 80+ for leads likely to yield PRIMARY evidence or a decisive reaction.`

export type Lead = { id: string; type: string; value: string; why: string; destination: string; query: string; score: number; band: string }

// robust parse: whole object, else first/last brace, else element-wise recover the leads array so
// one malformed element (or trailing model junk) can't fail the whole mine
function parseLeads(content: string): any[] {
  const t = String(content || '').trim()
  const tryP = (x: string) => { try { return JSON.parse(x) } catch { return null } }
  let o = tryP(t)
  if (!o) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) o = tryP(t.slice(a, b + 1)) }
  if (o && Array.isArray(o.leads)) return o.leads
  const m = /"leads"\s*:\s*\[/.exec(t); if (!m) return []
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

export async function extractLeads(material: string[], storyContext: string, cfg: any = {}) {
  if (!OR_KEY) throw new Error('OPENROUTER_API_KEY missing')
  const t0 = Date.now()
  const user = `STORY CONTEXT: ${storyContext || '(a fresh feed — infer the stories)'}\n\nFEED ITEMS (index from 0):\n${material.map((m, i) => i + '. ' + m).join('\n')}`
  const r = await fetch(OR_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.leads?.model || 'google/gemini-2.5-flash-lite', temperature: 0.3, max_tokens: 4000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(120000),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error?.message || ('leads http ' + r.status))
  const content = j.choices?.[0]?.message?.content || '{}'
  const seen = new Set<string>()
  const leads: Lead[] = parseLeads(content)
    .filter((l: any) => l && l.value && l.query)
    .map((l: any, i: number) => {
      const score = Math.max(0, Math.min(100, Math.round(+l.score || 0)))
      return {
        id: 'L' + String(i + 1).padStart(3, '0'),
        type: String(l.type || 'CLAIM').toUpperCase(),
        value: String(l.value).slice(0, 160),
        why: String(l.why || '').slice(0, 240),
        destination: (DESTINATIONS as readonly string[]).includes(String(l.destination)) ? l.destination : 'WEB',
        query: String(l.query).slice(0, 200),
        score, band: band(score),
      }
    })
    .filter((l: Lead) => { const k = l.value.toLowerCase().trim(); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a: Lead, b: Lead) => b.score - a.score)
  return { leads, ms: Date.now() - t0, usage: j.usage, raw: content }
}

// Build the flat feed material from a pull report (same shape the topic miner uses)
export function materialFromPull(report: any): string[] {
  const material: string[] = []
  for (const s of report?.twitter || []) for (const t of s?.top || []) material.push(`[X @${s.handle}] ${t.text} (♥${t.likes || 0} rt${t.rts || 0}) ${t.created || ''}`)
  for (const c of report?.youtube || []) for (const v of c?.videos || []) material.push(`[YT ${c.channel}] "${v.title}" ${v.published || ''}`)
  return material
}

export function saveLeads(pullFile: string, out: any) {
  const dir = path.join(ROOT, 'lab', 'runs')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, pullFile.replace(/^pull_/, 'leads_')), JSON.stringify(out, null, 2) + '\n')
}
