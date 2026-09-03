// FREE web supplement — the "Perplexica" path, minus the heavy app.
// Perplexica is just SearXNG (self-hosted meta-search) + an LLM synthesizer. We wire that SUBSTANCE
// straight into THE STRINGER for $0: SearXNG returns real cited results, and the STRINGER's own
// downstream parseMaterial (already free on cupcake) mines the evidence from the snippet digest.
// An optional local-LLM synthesis (Mac Mini Ollama / cupcake — GPU-independent, free) kicks in ONLY
// when one is configured AND reachable; otherwise the raw snippet digest is used, so the free path
// has ZERO hard dependency on any model being up. Same {answer, citations} shape as webResearch, so
// it drops in ahead of the paid OpenRouter/Perplexity providers. Robert is wary of API spend — this
// is why the RESEARCH button costs nothing by default.
import { excludedTerms, isExcluded, type WebCitation } from './openrouter-web'

const WEB_SYS = `You are an IMPARTIAL research analyst for a talk show. Using ONLY the numbered web-result snippets provided, give a factual, neutral summary that answers the query. HARD RULES:
- Report only what the snippets say. Do NOT lean, argue, editorialize, or give an opinion.
- Where snippets disagree, say so plainly. Prefer names, dates, and numbers over characterization.
- Refer to a source by its publisher and headline so each claim can be traced. Be concise.`

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// SearXNG's Google engine frequently gets rate-limited/captcha'd and surfaces the search engine's OWN
// help/account boilerplate ("Delete your activity", cookie/consent pages) as high-scoring junk. These
// are never a real reporting source, so drop them before they pollute the citations or (worse) count
// as a "distinct publisher" in the impartiality audit.
const JUNK_HOST = /(^|\.)(support|accounts|policies|myactivity|login|help|consent|privacy)\.(google|microsoft|apple|yahoo|bing)\.[a-z.]+$/i
const JUNK_TITLE = /^(delete your activity|manage your google|ver o eliminar|browsing history|search history|sign in|cookie)/i
function isJunk(x: { url: string; title?: string }): boolean {
  const h = hostname(x.url)
  return JUNK_HOST.test(h) || h === 'google.com' || h === 'bing.com' || JUNK_TITLE.test(String(x.title || '').trim())
}

type SxResult = { url: string; title?: string; content?: string; engine?: string }

// Optional neutral synthesis on a LOCAL, free model (OpenAI-compatible /v1/chat/completions —
// Ollama, cupcake, LM Studio all speak it). Blank url => skip (use the raw snippet digest).
// qwen3-family models emit <think>…</think>; strip it. Any failure returns '' so we fall back cleanly.
async function localSynthesize(query: string, digest: string, cfg: any): Promise<string> {
  const base = String(cfg.web?.local_llm_url || process.env.LOCAL_LLM_URL || '').replace(/\/$/, '')
  if (!base) return ''
  const model = cfg.web?.local_llm_model || process.env.LOCAL_LLM_MODEL || 'qwen3.5'
  try {
    const r = await fetch(base + '/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: 600, stream: false,
        messages: [{ role: 'system', content: WEB_SYS }, { role: 'user', content: `Query: ${query}\n\nSnippets:\n${digest}` }],
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!r.ok) return ''
    const j = await r.json()
    const txt = j.choices?.[0]?.message?.content || ''
    return String(txt).replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  } catch { return '' }
}

// Query SearXNG's JSON API and shape it exactly like webResearch's return. Returns null (never throws
// past the fetch) when SearXNG is down or yields no usable, non-excluded results — caller falls through.
export async function searxngResearch(query: string, cfg: any): Promise<{ answer: string; citations: WebCitation[]; provider: string; usage?: any } | null> {
  const base = String(cfg.web?.searxng_url || process.env.SEARXNG_URL || 'http://localhost:8888').replace(/\/$/, '')
  const terms = excludedTerms(cfg)
  // bias toward reporting (general + news) so we don't drown in forum/help chatter
  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&language=en&safesearch=0&categories=general,news`
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error('searxng http ' + r.status)
  const j = await r.json()

  const maxN = cfg.web?.max_results || 6
  const seen = new Set<string>()
  const top: SxResult[] = []
  for (const x of (j.results || []) as SxResult[]) {
    if (!x?.url || (!x.content && !x.title)) continue
    if (isJunk(x)) continue // search-engine help/consent boilerplate, never a real source
    if (isExcluded(`${x.url} ${x.title || ''} ${x.content || ''}`, terms)) continue
    if (seen.has(x.url)) continue
    seen.add(x.url)
    top.push(x)
    if (top.length >= maxN) break
  }
  if (!top.length) return null

  const citations: WebCitation[] = top.map(x => ({ url: x.url, title: x.title || query, publisher: hostname(x.url) }))
  // The digest: one clearly-attributed line per source so parseMaterial (or the local LLM) can bind
  // each mined claim back to its [Sxxx | publisher | title] label in web-supplement.
  const digest = top.map((x, i) =>
    `(${i + 1}) [${hostname(x.url)}] "${(x.title || '').replace(/\s+/g, ' ').trim()}": ${String(x.content || '').replace(/\s+/g, ' ').trim()}`
  ).join('\n')

  let answer = await localSynthesize(query, digest, cfg)
  if (!answer.trim()) {
    answer = `Web reporting for "${query}". Each numbered item is one source; attribute a claim to the source whose publisher and headline match it.\n${digest}`
  }
  if (isExcluded(answer, terms)) return null // synthesis leaned on an excluded outlet
  return { answer, citations, provider: 'searxng', usage: { free: true, results: top.length } }
}
