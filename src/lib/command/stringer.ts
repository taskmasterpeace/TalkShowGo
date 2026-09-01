// THE STRINGER — research agent. Subject/question -> YouTube (trusted channels first) ->
// transcripts -> impartial LLM parse -> cited evidence + answers. Server derives every
// citation URL from the source map, so the model can never invent one.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { excludedTerms, isExcluded } from './openrouter-web'

const ROOT = process.cwd()
const YTDLP = process.env.YTDLP_PATH || 'C:/Users/taskm/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe'
const OR_KEY = process.env.OPENROUTER_API_KEY

export function loadConfig(): any {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'research', 'config.json'), 'utf8')) } catch { return {} }
}

export type Assignment = { kind: 'subject' | 'question'; text: string; questions: string[] }
export type Src = { id: string; medium: 'youtube'; source_class: string; trust: string; title: string; publisher: string; url: string; video_id: string; published_at: string | null; transcript_status: string; words: number }

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
  // filter so highly-relevant older sources aren't excluded), merged by `add`
  const runs = opts.dual ? [{ ...mf, sort_by: 'upload_date' }, { sort_by: 'relevance' }] : [mf]
  for (const filt of runs) {
    try {
      const res: any = await yt.search(query, { type: 'video', ...filt })
      for (const v of (res?.videos || res?.results || []).slice(0, cfg.youtube?.global_results || 6)) add(v, 'commentary', 'discovered')
    } catch { /* global search failed for this filter */ }
  }
  const arr = Object.values(out)
  arr.forEach((s, i) => { s.id = 'S' + String(i + 1).padStart(3, '0') })
  return arr
}

export function fetchTranscript(videoId: string, capWords: number): { text: string; words: number; status: string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsg_str_'))
  try {
    execFileSync(YTDLP, ['--skip-download', '--write-auto-sub', '--write-sub', '--sub-lang', 'en', '--sub-format', 'vtt', '-o', path.join(tmp, 'v'), ytUrl(videoId)], { timeout: 60000, stdio: 'pipe' })
    const vtt = fs.readdirSync(tmp).find(f => f.endsWith('.vtt'))
    if (!vtt) return { text: '', words: 0, status: 'missing' }
    const raw = fs.readFileSync(path.join(tmp, vtt), 'utf8')
    const seen = new Set<string>(); const lines: string[] = []
    for (let l of raw.split('\n')) {
      l = l.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
      if (!l || /^(WEBVTT|Kind:|Language:)/.test(l) || /-->/.test(l) || seen.has(l)) continue
      seen.add(l); lines.push(l)
    }
    const words = lines.join(' ').split(/\s+/)
    const text = words.slice(0, capWords).join(' ')
    return { text, words: words.length, status: 'ok' }
  } catch { return { text: '', words: 0, status: 'failed' } }
  finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}

const PARSE_SYS = `You are an IMPARTIAL research analyst for a talk show. From the transcript material below (each block labeled [Sxxx | publisher | title]), extract evidence and answer the questions. HARD RULES:
- Cite every factual claim to a source id that appears in the material. NEVER invent a fact, a quote, or a source id.
- Label each claim: FACT (stated as fact by the source), ATTRIBUTED_CLAIM (someone's claim/opinion, reported), or ANALYSIS (an interpretation).
- Do NOT lean, argue, or editorialize. Present what the sources say, including where they DISAGREE.
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

export async function parseMaterial(assignment: Assignment, withText: { id: string }[], material: string, cfg: any) {
  if (!OR_KEY) throw new Error('OPENROUTER_API_KEY missing')
  const t0 = Date.now()
  const user = `ASSIGNMENT (${assignment.kind}): ${assignment.text}\nQUESTIONS TO ANSWER:\n${(assignment.questions.length ? assignment.questions : ['(none posed - propose candidate questions)']).map((q, i) => (i + 1) + '. ' + q).join('\n')}\n\nMATERIAL (${withText.length} sources):\n${material}`
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.parser?.model || 'google/gemini-2.5-flash-lite', temperature: cfg.parser?.temperature ?? 0.1, max_tokens: cfg.parser?.max_output_tokens || 5000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: PARSE_SYS }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(120000),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error?.message || ('parser http ' + r.status))
  const content = j.choices?.[0]?.message?.content || '{}'
  const mined = parseMined(content)
  return { mined, ms: Date.now() - t0, usage: j.usage }
}

export async function runStringer(assignment: Assignment, trusted: { channel_id: string; name: string }[], opts: { mode?: YtMode; dual?: boolean } = {}) {
  const cfg = loadConfig()
  const id = 'str_' + Math.random().toString(36).slice(2, 10)
  const now = new Date().toISOString()
  // 1) search YouTube (mode-aware: current/context/legacy/original/reaction; dual = freshness+relevance)
  const sources = await ytSearch(assignment.text + (assignment.questions[0] ? ' ' + assignment.questions[0] : ''), trusted, cfg, opts)
  // 2) transcripts for the top N
  const capWords = cfg.youtube?.transcript_words_per_video || 12000
  let totalWords = 0
  const withText: Src[] = []
  const blocks: string[] = []
  for (const s of sources.slice(0, cfg.youtube?.transcript_limit || 6)) {
    if (totalWords >= (cfg.youtube?.transcript_words_total || 60000)) { s.transcript_status = 'skipped'; continue }
    const tr = fetchTranscript(s.video_id, capWords)
    s.transcript_status = tr.status; s.words = tr.words
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
  fs.writeFileSync(path.join(dir, result.id + '.json'), JSON.stringify(result, null, 2) + '\n')
}

export function listStringers(limit = 12): any[] {
  const dir = path.join(ROOT, 'lab', 'research', 'stringer')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.startsWith('str_') && f.endsWith('.json')).sort().reverse().slice(0, limit)
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { return null } }).filter(Boolean)
}
