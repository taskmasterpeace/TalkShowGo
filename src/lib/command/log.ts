// ACTIVITY LOG (control room) - one JSON line per pipeline action, append-only, at
// lab/logs/activity.jsonl. The routes (pull, topics, research, web, briefing, expand; later
// cluster, leads, rank, cast, build) write here and /command/log reads it with facet filters.
// Plain JSONL on purpose: lab/engine/make_show.mjs (a Node script, no TS) appends with fs directly:
//   fs.appendFileSync('lab/logs/activity.jsonl', JSON.stringify({ ts, kind, stage, ok, beat, ref, ms, summary, error, meta }) + '\n')
import fs from 'node:fs'
import path from 'node:path'

export type LogKind = 'pull' | 'topics' | 'cluster' | 'leads' | 'expand' | 'rank' | 'research' | 'web' | 'briefing' | 'cast' | 'build' | 'scout' | 'take' | 'sim' | 'system' | 'youtube' | 'janitor' | 'settings'
export const LOG_KINDS: LogKind[] = ['pull', 'topics', 'cluster', 'leads', 'expand', 'rank', 'research', 'web', 'briefing', 'cast', 'build', 'scout', 'take', 'sim', 'system', 'youtube', 'janitor', 'settings']

export type LogEvent = {
  ts: string
  kind: LogKind
  stage?: string
  ok: boolean
  beat?: string | null
  ref?: string | null      // the artifact id: str_xxx / brf_xxx / pull_...json / show slug
  ms?: number | null
  summary: string
  error?: string | null
  meta?: Record<string, any>
}
export type LogInput = Omit<LogEvent, 'ts'> & { ts?: string }
export type LogQuery = { kind?: string[]; beat?: string; since?: string; q?: string; okOnly?: boolean; errorsOnly?: boolean; limit?: number }
export type LogCounts = { total: number; errors: number; byKind: Record<string, number>; byBeat: Record<string, number>; file_total: number }

export const LOG_FILE = path.join(process.cwd(), 'lab', 'logs', 'activity.jsonl')
const WHOLE_READ_MAX = 10 * 1024 * 1024   // read the whole file up to 10MB
const TAIL_BYTES = 2 * 1024 * 1024        // beyond that, only the last 2MB
const LIMIT_DEFAULT = 200
const LIMIT_MAX = 1000

const clip = (s: unknown, n: number) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n - 1) + '…' : t }

/** Keep meta one level deep and small: primitives, short strings, short arrays; nested objects become clipped JSON. */
function shallowMeta(meta: unknown): Record<string, any> | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  const out: Record<string, any> = {}
  let n = 0
  for (const [k, v] of Object.entries(meta as Record<string, any>)) {
    if (v === undefined) continue
    if (++n > 16) break
    if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string') out[k] = clip(v, 160)
    else if (Array.isArray(v)) out[k] = v.slice(0, 12).map(x => (x === null || typeof x === 'number' || typeof x === 'boolean') ? x : clip(typeof x === 'string' ? x : safeJson(x), 80))
    else out[k] = clip(safeJson(v), 160)
  }
  return Object.keys(out).length ? out : undefined
}
function safeJson(v: unknown): string { try { return JSON.stringify(v) ?? String(v) } catch { return '[unserializable]' } }

function normalize(e: LogInput): LogEvent {
  const ms = e.ms == null ? NaN : Number(e.ms)
  // key order is deliberate: humans tail the raw file, so it reads ts · kind · stage · ok · beat · ref · ms · summary · error · meta
  const out: LogEvent = {
    ts: e.ts && Number.isFinite(Date.parse(e.ts)) ? e.ts : new Date().toISOString(),
    kind: (e.kind || 'system') as LogKind,
    ...(e.stage ? { stage: clip(e.stage, 40) } : {}),
    ok: !!e.ok,
    ...(e.beat ? { beat: clip(e.beat, 60) } : {}),
    ...(e.ref ? { ref: clip(e.ref, 80) } : {}),
    ...(Number.isFinite(ms) ? { ms: Math.max(0, Math.round(ms)) } : {}),
    summary: clip(e.summary || '', 200),
    ...(e.error ? { error: clip(e.error, 200) } : {}),
  }
  const meta = shallowMeta(e.meta)
  if (meta) out.meta = meta
  return out
}

/** Append one line. NEVER throws: a logging failure must never break a route. Accepts the event or a
 *  thunk that builds it, so a throw while composing the summary (a missing field) is swallowed too. */
export function appendLog(e: LogInput | (() => LogInput)): void {
  try {
    const ev = normalize(typeof e === 'function' ? e() : e)
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    fs.appendFileSync(LOG_FILE, JSON.stringify(ev) + '\n')
  } catch { /* best-effort by design */ }
}

/** Stopwatch: `const t = logTimer()` before the work, `t.done({...})` after; ms = elapsed unless set. */
export function logTimer() {
  const t0 = Date.now()
  return {
    elapsed: () => Date.now() - t0,
    done: (partial: LogInput | (() => LogInput)) => appendLog(() => {
      const p = typeof partial === 'function' ? partial() : partial
      return { ...p, ms: p.ms ?? (Date.now() - t0) }
    }),
  }
}

function readRaw(): string {
  try {
    if (!fs.existsSync(LOG_FILE)) return ''
    const size = fs.statSync(LOG_FILE).size
    if (size <= WHOLE_READ_MAX) return fs.readFileSync(LOG_FILE, 'utf8')
    const fd = fs.openSync(LOG_FILE, 'r')
    try {
      const buf = Buffer.alloc(TAIL_BYTES)
      const n = fs.readSync(fd, buf, 0, TAIL_BYTES, size - TAIL_BYTES)
      const s = buf.toString('utf8', 0, n)
      return s.slice(s.indexOf('\n') + 1) // drop the torn first line
    } finally { fs.closeSync(fd) }
  } catch { return '' }
}

function parseLines(raw: string): LogEvent[] {
  const out: LogEvent[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const o = JSON.parse(line)
      if (o && typeof o === 'object' && typeof o.ts === 'string' && typeof o.kind === 'string') out.push({ ...o, ok: !!o.ok, summary: String(o.summary ?? '') })
    } catch { /* skip a torn or foreign line */ }
  }
  return out
}

/** "1h" | "24h" | "48h" | "7d" | "30m" | ISO date | "all" -> epoch ms lower bound (null = no bound). */
export function sinceToMs(since?: string | null): number | null {
  const s = String(since || '').trim()
  if (!s || s === 'all') return null
  const m = /^(\d+)\s*([mhd])$/i.exec(s)
  if (m) return Date.now() - Number(m[1]) * ({ m: 60e3, h: 3600e3, d: 86400e3 } as Record<string, number>)[m[2].toLowerCase()]
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().trim()

/** Query with facet counts. total/errors reflect every filter; byKind ignores the kind filter and
 *  byBeat ignores the beat filter, so a chip's number reads "how many are behind this chip". */
export function queryLog(opts: LogQuery = {}): { events: LogEvent[]; counts: LogCounts } {
  const all = parseLines(readRaw())
  const sinceMs = sinceToMs(opts.since)
  const q = norm(opts.q)
  const kinds = new Set((opts.kind || []).map(norm).filter(Boolean))
  const beat = norm(opts.beat)

  const base = all.filter(e => {
    if (sinceMs != null && !(Date.parse(e.ts) >= sinceMs)) return false
    if (opts.errorsOnly && e.ok) return false
    if (opts.okOnly && !e.ok) return false
    if (q && !`${e.kind} ${e.stage || ''} ${e.beat || ''} ${e.ref || ''} ${e.summary} ${e.error || ''} ${e.meta ? safeJson(e.meta) : ''}`.toLowerCase().includes(q)) return false
    return true
  })
  const kindOk = (e: LogEvent) => !kinds.size || kinds.has(norm(e.kind))
  const beatOk = (e: LogEvent) => !beat || norm(e.beat) === beat
  const byKind: Record<string, number> = {}
  const byBeat: Record<string, number> = {}
  for (const e of base) {
    if (beatOk(e)) byKind[e.kind] = (byKind[e.kind] || 0) + 1
    if (kindOk(e) && e.beat) byBeat[e.beat] = (byBeat[e.beat] || 0) + 1
  }
  const matched = base.filter(e => kindOk(e) && beatOk(e))
  const limit = Math.min(LIMIT_MAX, Math.max(1, Math.round(Number(opts.limit) || LIMIT_DEFAULT)))
  // newest first: the file is append-ordered, so a stable sort on ts (index as tiebreak) also settles
  // any out-of-order lines from external writers like the engine script
  const events = matched
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (Date.parse(b.e.ts) - Date.parse(a.e.ts)) || (b.i - a.i))
    .slice(0, limit)
    .map(x => x.e)
  return { events, counts: { total: matched.length, errors: matched.filter(e => !e.ok).length, byKind, byBeat, file_total: all.length } }
}

/** Events only (newest first, default 200, max 1000). */
export function readLog(opts: LogQuery = {}): LogEvent[] { return queryLog(opts).events }
