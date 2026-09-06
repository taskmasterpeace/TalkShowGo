// THE STRINGER — research agent. Subject/question -> YouTube (trusted channels first) ->
// transcripts -> impartial LLM parse -> cited evidence + answers. Server derives every
// citation URL from the source map, so the model can never invent one.
import fs from 'node:fs'
import path from 'node:path'
import { excludedTerms, isExcluded } from './openrouter-web'
import { fetchTranscriptSegments, type TranscriptSegment } from './transcript'

const ROOT = process.cwd()
const OR_KEY = () => process.env.OPENROUTER_API_KEY // per-call: a key saved in SETTINGS works without a restart

export function loadConfig(): any {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'research', 'config.json'), 'utf8')) } catch { return {} }
}

export type Assignment = { kind: 'subject' | 'question'; text: string; questions: string[] }
export type Src = { id: string; medium: 'youtube'; source_class: string; trust: string; title: string; publisher: string; url: string; video_id: string; published_at: string | null; transcript_status: string; words: number; transcript_segments?: TranscriptSegment[] }

const ytUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

// Dual-mode YouTube (Story Resolution Loop). Innertube can't do publishedBefore ranges (that needs
// the Data API), so LEGACY leans on relevance + the era living in the query; CURRENT filters to
// recent uploads. `dual` runs a freshness pass AND a relevance pass and merges (the spec's two-search
// rule) so "latest OR relevant" is never an either/or.
export type YtMode = 'current' | 'context' | 'legacy' | 'original' | 'reaction'
const YT_MODES: Record<YtMode, any> = {
  current: { sort_by: 'upload_date', upload_date: 'month' },
  context: { sort_by: 'relevance' },
  legacy: { sort_by: 'relevance', upload_date: 'all' },
  original: { sort_by: 'relevance' },
  reaction: { sort_by: 'relevance' },
}

async function ytSearch(query: string, trusted: { channel_id: string; name: string }[], cfg: any, opts: { mode?: YtMode; dual?: boolean } = {}): Promise<Src[]> {
  const mode: YtMode = (opts.mode && YT_MODES[opts.mode]) ? opts.mode : 'context'
  const mf = YT_MODES[mode]
  const { Innertube } = await import('youtubei.js')
  const yt = await Innertube.create({ retrieve_player: false })
  const out: Record<string, Src> = {}
  // Robert's standing rule: never source from / surface a flagged outlet (e.g. LTBR).
  // Normalized match catches spacing/casing/curly-apostrophe variants ("LET’S TALK BATTLE RAP").
  const exTerms = excludedTerms(cfg)
  const add = (v: any, cls: string, trust: string, ch?: string) => {
    const vid = v?.id || v?.video_id
    if (!vid || out[vid]) return
    const title = v?.title?.text || v?.title || '(untitled)'
    const publisher = v?.author?.name || ch || 'YouTube'
    if (isExcluded(`${title} ${publisher}`, exTerms)) return
    out[vid] = {
      id: '', medium: 'youtube', source_class: cls, trust,
      title, publisher, url: ytUrl(vid), video_id: vid,
      published_at: v?.published?.text || null, transcript_status: 'pending', words: 0,
    }
  }
  // trusted channels first
  for (const ch of trusted.slice(0, cfg.youtube?.trusted_channels_max || 5)) {
    try {
      const chan: any = await yt.getChannel(ch.channel_id)
      let vids: any = null
      try { vids = await chan.search(query) } catch { vids = null }
      const list = vids?.videos || vids?.results || []
      for (const v of list.slice(0, cfg.youtube?.results_per_trusted_channel || 2)) add(v, 'reporting', 'configured', ch.name)
    } catch { /* channel unreachable */ }
  }
  // global search(es): apply the mode filter; `dual` runs a freshness pass + a relevance pass, merged
  // dual: a freshness pass (mode's recency filter) + an all-time relevance pass (drop the recency
  // filter so highly-relevant older sources aren't excluded)
  const runs = opts.dual ? [{ ...mf, sort_by: 'upload_date' }, { sort_by: 'relevance' }] : [mf]
  const lists: any[][] = []
  for (const filt of runs) {
    try {
      const res: any = await yt.search(query, { type: 'video', ...filt })
      lists.push((res?.videos || res?.results || []).slice(0, cfg.youtube?.global_results || 6))
    } catch { lists.push([]) /* this filter failed */ }
  }
  // INTERLEAVE the passes (freshness[0], relevance[0], freshness[1], …) so a capped transcript
  // budget draws from BOTH, instead of one pass filling the cap before the other is reached
  const maxLen = Math.max(0, ...lists.map(l => l.length))
  for (let i = 0; i < maxLen; i++) for (const list of lists) if (list[i]) add(list[i], 'commentary', 'discovered')
  const arr = Object.values(out)
  arr.forEach((s, i) => { s.id = 'S' + String(i + 1).padStart(3, '0') })
  return arr
}

/** Delegates to lib/command/transcript's yt-dlp + parseVtt (the timestamped-transcript lib WS-2 built
 *  for the YOUTUBE page) and keeps this function's original return shape so runStringer doesn't change.
 *  `segments` is new: the source object in the dossier stores it (capped) so a claim can later cite
 *  video_id@mm:ss instead of just a bare source id. */
export async function fetchTranscript(videoId: string, capWords: number): Promise<{ text: string; words: number; status: string; segments: TranscriptSegment[] }> {
  try {
    const tr = await fetchTranscriptSegments(videoId, { capWords })
    return { text: tr.text, words: tr.words, status: 'ok', segments: tr.segments }
  } catch (e: any) {
    const missing = /no captions available/i.test(String(e?.message || e))
    return { text: '', words: 0, status: missing ? 'missing' : 'failed', segments: [] }
  }
}

const PARSE_SYS = `You are an IMPARTIAL research analyst for a talk show. From the transcript material below (each block labeled [Sxxx | publisher | title]), extract evidence and answer the questions. HARD RULES:
- Cite every factual claim to a source id that appears in the material. NEVER invent a fact, a quote, or a source id.
- Label each claim: FACT (stated as fact by the source), ATTRIBUTED_CLAIM (someone's claim/opinion, reported), or ANALYSIS (an interpretation).
- Do NOT lean, argue, or editorialize. Present what the sources say, including where they DISAGREE.
- CAPTURE THE DISAGREEMENT AS EVIDENCE: when sources hold DIFFERENT opinions, criticisms, or alternative views on the assignment, extract EACH competing view as its OWN separate ATTRIBUTED_CLAIM entry in "evidence" (who argues what, and their reason) - a talk show debates from these receipts, so both sides need real ammunition. Never collapse opposing opinions into one claim, and never drop the minority/critical view. If the material is entirely one-sided, say so in context.unknowns rather than inventing an opposing view.
- Quotes must be short and verbatim from the material.
Output STRICT JSON only:
{"evidence":[{"claim":"...","truth_label":"FACT|ATTRIBUTED_CLAIM|ANALYSIS","source_id":"S001","quote":"..."}],
"answers":[{"question":"...","direct_answer":"...","evidence_ids":["S001"],"unknowns":["..."],"confidence":"high|medium|low"}],
"context":{"summary":"neutral 2-3 sentence overview","disputes":["where sources disagree"],"unknowns":["what the material does not answer"]},
"candidate_questions":["only if the assignment is a SUBJECT not a question: 3-5 debatable questions the show could ask"]}`

// Recover brace-balanced objects under an array key, parsing each independently so ONE malformed
// element (a bad escape in a model-emitted quote) costs that element, not the whole response.
function recoverArray(text: string, key: string): any[] {
  const m = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(text)
  if (!m) return []
  let i = m.index + m[0].length
  const out: any[] = []
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++
    if (i >= text.length || text[i] === ']' || text[i] !== '{') break
    let depth = 0, inStr = false, esc = false
    const start = i
    for (; i < text.length; i++) {
      const ch = text[i]
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
      if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { i++; break } }
    }
    try { out.push(JSON.parse(text.slice(start, i))) } catch { /* skip malformed element */ }
  }
  return out
}

// Never throws AND always returns the right shape (arrays where arrays are expected): strict parse
// first, else element-wise salvage. A model that returns "null" or {"evidence":{}} can't 502 us.
function parseMined(content: string): any {
  const t = String(content || '').trim()
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  let o: any = null
  try { o = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t) } catch { /* salvage below */ }
  if (!o || typeof o !== 'object' || Array.isArray(o)) o = { evidence: recoverArray(t, 'evidence'), answers: recoverArray(t, 'answers') }
  return {
    evidence: Array.isArray(o.evidence) ? o.evidence : [],
    answers: Array.isArray(o.answers) ? o.answers : [],
    context: o.context && typeof o.context === 'object' && !Array.isArray(o.context) ? o.context : {},
    candidate_questions: Array.isArray(o.candidate_questions) ? o.candidate_questions : [],
  }
}

// The evidence-mining LLM. Free-first: a local Ollama box (Mac Mini / cupcake — the same qwen the
// topic miner uses) costs nothing, so we try it FIRST, then fall back to the cheap cloud model only
// if the local box is off. A 3s liveness probe means a DOWN box fails fast instead of hanging the
// full parse timeout. Provider order comes from cfg.parser.provider, split on '+' (e.g.
// "local + openrouter" = free first, paid fallback). Robert is wary of API spend — this makes a
// research run $0 whenever a home box is on.
const OLLAMA_DEFAULT = process.env.PARSER_LOCAL_URL || 'http://192.168.1.238:11434' // Mac Mini (GPU-independent; IP was .217, now .238 - needs a router DHCP reservation)

async function parserLocal(user: string, cfg: any): Promise<{ content: string; usage: any }> {
  const base = String(cfg.parser?.local_url || OLLAMA_DEFAULT).replace(/\/$/, '')
  const model = cfg.parser?.local_model || 'qwen3.5'
  // fast liveness probe so an OFF box fails in ~3s, not after the long parse timeout
  await fetch(base + '/api/tags', { signal: AbortSignal.timeout(3000) }).then(r => { if (!r.ok) throw 0 }).catch(() => { throw new Error('parser-local unreachable') })
  const r = await fetch(base + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, stream: false, think: false, format: 'json',
      messages: [{ role: 'system', content: PARSE_SYS + '\n/no_think' }, { role: 'user', content: user }],
      options: { temperature: cfg.parser?.temperature ?? 0.1, num_predict: cfg.parser?.max_output_tokens || 5000, num_ctx: cfg.parser?.local_num_ctx || 32768 },
    }),
    signal: AbortSignal.timeout(cfg.parser?.local_timeout_ms || 120000),
  })
  if (!r.ok) throw new Error('parser-local http ' + r.status)
  const j = await r.json()
  const content = String(j.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || '{}'
  return { content, usage: { free: true, provider: 'local', prompt_tokens: j.prompt_eval_count ?? null, completion_tokens: j.eval_count ?? null } }
}

async function parserOpenRouter(user: string, cfg: any): Promise<{ content: string; usage: any }> {
  if (!OR_KEY()) throw new Error('OPENROUTER_API_KEY missing')
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + OR_KEY(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.parser?.model || 'google/gemini-2.5-flash-lite', temperature: cfg.parser?.temperature ?? 0.1, max_tokens: cfg.parser?.max_output_tokens || 5000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: PARSE_SYS }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(120000),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error?.message || ('parser http ' + r.status))
  return { content: j.choices?.[0]?.message?.content || '{}', usage: j.usage }
}

export async function parseMaterial(assignment: Assignment, withText: { id: string }[], material: string, cfg: any) {
  const t0 = Date.now()
  const user = `ASSIGNMENT (${assignment.kind}): ${assignment.text}\nQUESTIONS TO ANSWER:\n${(assignment.questions.length ? assignment.questions : ['(none posed - propose candidate questions)']).map((q, i) => (i + 1) + '. ' + q).join('\n')}\n\nMATERIAL (${withText.length} sources):\n${material}`
  const callers: Record<string, () => Promise<{ content: string; usage: any }>> = {
    openrouter: () => parserOpenRouter(user, cfg), local: () => parserLocal(user, cfg), cupcake: () => parserLocal(user, cfg), ollama: () => parserLocal(user, cfg),
  }
  const order = String(cfg.parser?.provider || 'openrouter').split('+').map(s => s.trim().toLowerCase()).filter(s => callers[s])
  if (!order.length) order.push('openrouter')
  let content = '{}', usage: any = null, lastErr: any = null
  for (const p of order) {
    try { const out = await callers[p](); if (out.content && out.content.trim()) { content = out.content; usage = out.usage; break } } catch (e) { lastErr = e }
  }
  if (usage === null && lastErr) throw lastErr // every provider failed
  const mined = parseMined(content)
  return { mined, ms: Date.now() - t0, usage }
}

export async function runStringer(assignment: Assignment, trusted: { channel_id: string; name: string }[], opts: { mode?: YtMode; dual?: boolean } = {}) {
  const cfg = loadConfig()
  const id = 'str_' + Math.random().toString(36).slice(2, 10)
  const now = new Date().toISOString()
  // 1) search YouTube (mode-aware: current/context/legacy/original/reaction; dual = freshness+relevance).
  //    Beyond the neutral query, run a CONTROVERSY/REACTION pass so the transcripts contain the DISAGREEMENT a
  //    debate show needs - a one-sided factual ledger yields a one-sided "debate" (see engine SELF_IMPROVE_LOG
  //    root-cause). INTERLEAVE the two result sets so reaction sources reach the transcribed top-N, not just
  //    appended after the facts. Controllable via cfg.stringer.controversy_pass (default on).
  const baseQ = assignment.text + (assignment.questions[0] ? ' ' + assignment.questions[0] : '')
  const primary = await ytSearch(baseQ, trusted, cfg, opts)
  let sources = primary
  if (cfg.stringer?.controversy_pass !== false) {
    try {
      const angleTerms = cfg.stringer?.controversy_terms || 'reaction analysis debate'
      const angleQ = `${assignment.text.replace(/\?+\s*$/, '').slice(0, 90)} ${angleTerms}`
      const angle = await ytSearch(angleQ, trusted, cfg, opts)
      const seen = new Set<string>(); const merged: Src[] = []
      for (let i = 0; i < Math.max(primary.length, angle.length); i++) {
        for (const s of [primary[i], angle[i]]) if (s && !seen.has(s.video_id)) { seen.add(s.video_id); merged.push(s) }
      }
      sources = merged
      // RELEVANCE filter: a controversy query attracts off-topic clickbait/AI-slop/foreign fiction whose titles
      // merely share a word ("reaction", "secret"). Keep only sources whose title shares a DISCRIMINATING subject
      // token (real "Falcons/captains" content will; spam won't). Only trims when it leaves >= 3 sources, so a
      // thinly-covered real topic is never filtered down to nothing.
      const generic = new Set('does did will what when were with from have they their team this that then than best good this year time week game show talk news full live 2026 2025 reaction analysis debate should about right pick season'.split(/\s+/))
      const subjTokens = (assignment.text.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !generic.has(w))
      if (subjTokens.length) {
        const kept = sources.filter(s => subjTokens.some(w => (s.title || '').toLowerCase().includes(w)))
        if (kept.length >= 3) sources = kept
      }
    } catch { /* angle pass is best-effort; the neutral results stand on their own */ }
  }
  // 2) transcripts for the top N
  const capWords = cfg.youtube?.transcript_words_per_video || 12000
  let totalWords = 0
  const withText: Src[] = []
  const blocks: string[] = []
  for (const s of sources.slice(0, cfg.youtube?.transcript_limit || 6)) {
    if (totalWords >= (cfg.youtube?.transcript_words_total || 60000)) { s.transcript_status = 'skipped'; continue }
    const tr = await fetchTranscript(s.video_id, capWords)
    s.transcript_status = tr.status; s.words = tr.words
    if (tr.segments.length) s.transcript_segments = tr.segments.slice(0, 400) // so a claim can cite video_id@mm:ss
    if (tr.status === 'ok' && tr.text) { withText.push(s); blocks.push(`[${s.id} | ${s.publisher} | ${s.title}]\n${tr.text}`); totalWords += tr.words }
  }
  // 3) parse (impartial)
  const warnings: string[] = []
  let mined: any = { evidence: [], answers: [], context: {}, candidate_questions: [] }, ms = 0, cost = 0
  if (withText.length) {
    try { const p = await parseMaterial(assignment, withText, blocks.join('\n\n'), cfg); mined = p.mined; ms = p.ms }
    catch (e: any) { warnings.push('parse failed: ' + String(e?.message || e).slice(0, 120)) }
  } else warnings.push('no usable transcripts found on YouTube for this query')

  // 4) server derives citation URLs from the source map (anti-hallucination) + audit
  const srcById = Object.fromEntries(sources.map(s => [s.id, s]))
  // only sources whose transcript was actually SHOWN to the model can be cited — a source that was
  // searched-but-not-transcribed must never validate a (hallucinated) claim attributed to it
  const shown = new Set(withText.map(s => s.id))
  const evidence = (mined.evidence || []).map((e: any, i: number) => {
    const src = srcById[e.source_id]
    return { id: 'E' + String(i + 1).padStart(3, '0'), claim: e.claim, truth_label: e.truth_label, source_id: e.source_id || null, source_name: src?.publisher || null, url: src?.url || null, quote: e.quote || null, valid_source: !!src && shown.has(e.source_id) }
  })
  const publishers = new Set(withText.map(s => s.publisher))
  const uncited = evidence.filter((e: any) => (e.truth_label === 'FACT' || e.truth_label === 'ATTRIBUTED_CLAIM') && !e.valid_source).map((e: any) => e.claim)
  const audit = {
    status: (uncited.length === 0 && publishers.size >= (cfg.impartiality?.min_distinct_publishers || 2)) ? 'pass' : 'needs_review',
    distinct_publishers: publishers.size, uncited_claims: uncited, warnings,
    needs_web: withText.length === 0 || publishers.size < (cfg.impartiality?.min_distinct_publishers || 2),
  }
  return {
    schema_version: 1, id, created_at: now, updated_at: now, status: withText.length ? 'complete' : 'partial',
    assignment: { ...assignment, mode: opts.mode || 'context', dual: !!opts.dual, as_of: now },
    sources, evidence,
    answers: mined.answers || [], context: mined.context || {}, candidate_questions: mined.candidate_questions || [],
    audit, usage: { youtube_results: sources.length, transcripts: withText.length, transcript_words: totalWords, parse_ms: ms },
  }
}

export function saveStringer(result: any) {
  const dir = path.join(ROOT, 'lab', 'research', 'stringer')
  fs.mkdirSync(dir, { recursive: true })
  const sp = path.join(dir, result.id + '.json')
  fs.writeFileSync(sp + '.tmp', JSON.stringify(result, null, 2) + '\n'); fs.renameSync(sp + '.tmp', sp) // atomic: a torn artifact 500s every later read
}

export function listStringers(limit = 12): any[] {
  const dir = path.join(ROOT, 'lab', 'research', 'stringer')
  if (!fs.existsSync(dir)) return []
  // ids are random strings: "recent" must come from mtime, never from sorting the names
  return fs.readdirSync(dir).filter(f => /^str_[a-z0-9]+\.json$/.test(f))
    .map(f => ({ f, m: (() => { try { return fs.statSync(path.join(dir, f)).mtimeMs } catch { return 0 } })() }))
    .sort((a, b) => b.m - a.m).slice(0, limit)
    .map(({ f }) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { return null } }).filter(Boolean)
}
