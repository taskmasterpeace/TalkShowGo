// WEB SUPPLEMENT for THE STRINGER. When YouTube transcripts don't reach enough distinct
// publishers, this pulls an IMPARTIAL web summary + real citations so the dossier can be
// re-parsed against fresh reporting. Every citation URL is taken from the provider's own
// annotations, never invented. Primary: OpenRouter web plugin (Gemini). Fallback: Perplexity.
const OR_KEY = process.env.OPENROUTER_API_KEY

const WEB_SYS = `You are an IMPARTIAL research analyst for a talk show. Using current web sources, give a factual, neutral summary that answers the query. HARD RULES:
- Report only what the sources say. Do NOT lean, argue, editorialize, or give an opinion.
- Where sources disagree, say so plainly.
- Prefer names, dates, and numbers over characterization. Be concise.`

export type WebCitation = { url: string; title: string; publisher: string }

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// --- Robert's standing rule: never source from / surface a flagged outlet (e.g. LTBR). ---
// Match on an alphanumeric-collapsed form so spacing, casing, and curly vs straight apostrophes
// ("LET’S TALK BATTLE RAP", "letstalkbattlerap.com", "Let's Talk Battle Rap") all normalize equal.
const norm = (s: any) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function excludedTerms(cfg: any): string[] {
  return (cfg?.impartiality?.excluded_publishers || []).map((s: string) => norm(s)).filter(Boolean)
}
export function isExcluded(hay: string, terms: string[]): boolean {
  if (!terms.length) return false
  const h = norm(hay)
  return terms.some(t => h.includes(t))
}

// Both OpenRouter (web plugin) and Perplexity surface citations as url_citation annotations
// on the message; Perplexity may additionally return a bare citations array on the message or
// the response. Pull from all of them and dedupe by URL.
function extractCitations(msg: any, body: any): WebCitation[] {
  const out: WebCitation[] = []
  const seen = new Set<string>()
  const push = (url: string, title: string) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    out.push({ url, title: title || '', publisher: hostname(url) })
  }
  for (const a of (msg?.annotations || [])) {
    if (a?.url_citation?.url || a?.type === 'url_citation') push(a.url_citation?.url || a.url, a.url_citation?.title || a.title || '')
  }
  for (const c of (msg?.citations || body?.citations || [])) {
    if (typeof c === 'string') push(c, '')
    else if (c?.url) push(c.url, c.title || c.name || '')
  }
  return out
}

function dropExcluded(citations: WebCitation[], terms: string[]): WebCitation[] {
  if (!terms.length) return citations
  return citations.filter(c => !isExcluded(`${c.url} ${c.publisher} ${c.title}`, terms))
}

async function callOpenRouter(payload: any): Promise<any> {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(60000),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error?.message || ('web http ' + r.status))
  return j
}

// A synthesis that drew on an excluded outlet is dropped WHOLE (citations AND answer text): in a
// cite-everything architecture there is no way to keep the good half without risking the outlet's
// name or a misattributed claim. We have YouTube + other queries to fall back on.
export async function webResearch(query: string, cfg: any): Promise<{ answer: string; citations: WebCitation[]; provider: string; usage?: any }> {
  const terms = excludedTerms(cfg)

  // 0) FREE path FIRST — SearXNG (self-hosted) + optional local synthesis. Zero API cost, so it's the
  // default (Robert is wary of API spend). On by default; set web.searxng=false to force the paid path.
  // SearXNG down / no usable results just falls through to the paid providers below.
  if (cfg.web?.searxng !== false) {
    try {
      const { searxngResearch } = await import('./searxng-web')
      const free = await searxngResearch(query, cfg)
      if (free?.citations?.length) return free
    } catch { /* SearXNG unreachable or empty -> paid fallback */ }
  }

  // Paid fallbacks need the OpenRouter key. If it's absent, the free path was our only shot.
  if (!OR_KEY) return { answer: '', citations: [], provider: 'web' }
  const messages = [{ role: 'system', content: WEB_SYS }, { role: 'user', content: query }]
  const clean = (m: any, j: any, provider: string) => {
    const answer = m?.content || ''
    if (isExcluded(answer, terms)) return null // answer text itself names/leans on an excluded outlet
    const citations = dropExcluded(extractCitations(m, j), terms)
    return citations.length ? { answer, citations, provider, usage: j?.usage } : null
  }

  // 1) primary — OpenRouter web plugin (Gemini). A primary throw must NOT skip the fallback.
  try {
    const j1 = await callOpenRouter({
      model: cfg.web?.openrouter_model || 'google/gemini-2.5-flash-lite',
      temperature: 0, max_tokens: 600,
      plugins: [{ id: 'web', max_results: cfg.web?.max_results || 6 }],
      messages,
    })
    const r1 = clean(j1.choices?.[0]?.message || {}, j1, 'openrouter-web')
    if (r1) return r1
  } catch { /* fall through to Perplexity */ }

  // 2) fallback — Perplexity sonar (native web, no plugins)
  try {
    const j2 = await callOpenRouter({
      model: cfg.web?.perplexity_model || 'perplexity/sonar',
      temperature: 0, max_tokens: 600,
      messages,
    })
    const r2 = clean(j2.choices?.[0]?.message || {}, j2, 'perplexity')
    if (r2) return r2
  } catch { /* neither produced usable, non-excluded citations */ }

  return { answer: '', citations: [], provider: 'web' }
}
