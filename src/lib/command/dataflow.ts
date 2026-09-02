// HOW THE DATA TRAVELS (server-only). Assembles ONE pull's journey through the Story Resolution Loop:
//   PULL -> CLUSTER -> LEADS -> RANK -> DOSSIERS -> BRIEFINGS -> STANCES -> SHOWS
// with real counts, real samples and the ids that link one hop to the next, so a producer can SEE the
// pipeline instead of reading a diagram of boxes. Reads only the artifacts the routes already write:
//   lab/runs/pull_<stamp>.json         the search (X handles + YouTube channels inside the window)
//   lab/runs/clusters_<stamp>.json     + cluster_overrides_<stamp>.json (human ops, replayed via effectiveClusters)
//   lab/runs/leads_<stamp>.json        scored research leads routed to a source
//   lab/runs/producer_<stamp>.json     show-value ranking
//   lab/research/stringer/str_*.json   cited dossiers (expanded from a lead, or built for a ranked story)
//   lab/briefings/brf_*.json (+ .agents.json)   moves toward a question, and each host's stance
//   lab/shows/<slug>/status.json       the built show (floor + audio)
//   lab/logs/activity.jsonl            per-action timings
// The same <stamp> ties pull -> clusters -> leads -> producer (each writer replaces the prefix).
// Never throws: a missing file is an empty stage with a reason, not an error.
import fs from 'node:fs'
import path from 'node:path'
import { effectiveClusters } from '@/lib/command/cluster-overrides'
import { materialFromPull } from '@/lib/command/leads'
import { queryLog, type LogEvent } from '@/lib/command/log'

const ROOT = process.cwd()
const RUNS = path.join(ROOT, 'lab', 'runs')
const STRINGER = path.join(ROOT, 'lab', 'research', 'stringer')
const BRIEFINGS = path.join(ROOT, 'lab', 'briefings')
const SHOWS = path.join(ROOT, 'lab', 'shows')

export type Medium = 'x' | 'youtube' | 'web'
export type StageKey = 'pull' | 'cluster' | 'leads' | 'rank' | 'dossiers' | 'briefings' | 'stances' | 'shows'
export type Tone = 'ok' | 'warn' | 'err' | 'info' | ''
export type Chip = { label: string; tone?: Tone }
export type SubCount = { label: string; value: number | string; tone?: Tone }
/** one thing that came back at a hop: a feed item, a cluster, a lead, a ranked story, a dossier, a briefing, a stance, a show */
export type Sample = {
  id: string                 // unique across the whole journey: feed:3 · C001 · L002 · rank:0 · str_x · brf_x · stance:brf_x:cast · show:slug
  text: string
  sub?: string
  medium?: Medium
  url?: string | null
  n?: number | null
  nLabel?: string
  chips?: Chip[]
  meta?: Record<string, any>
}
export type Timing = { ts: string; kind: string; stage: string | null; ok: boolean; beat: string | null; ref: string | null; ms: number | null; summary: string }
export type Stage = {
  key: StageKey
  name: string
  what: string               // plain-English: what happens at this hop
  count: number
  subcounts: SubCount[]
  sample: Sample[]           // the top few
  rest: Sample[]             // the remainder (so a UI can show "+ N more")
  file: string | null
  at: string | null
  ms: number | null          // elapsed for this hop (the run's own ms, or the sum across linked artifacts)
  ms_source: 'log' | 'file' | null
  timing?: Timing | null     // the newest matching activity-log event for this hop
  empty?: string             // why the count is 0
  detail?: Record<string, any>
}
export type EdgeVia = 'item' | 'story' | 'title' | 'lead' | 'lead-value' | 'entity' | 'stringer' | 'briefing'
export type Edge = { from: string; to: string; via: EdgeVia }
export type PullRef = { file: string; beat: string | null; pulled_at: string | null; items: number }
export type Journey = {
  built_at: string
  beat: string | null
  pull: string | null
  stamp: string | null
  pulls: PullRef[]           // the pulls available for this beat (newest first)
  beats: string[]            // every beat seen across recent pulls
  story: string | null       // set when traced to one story
  story_error?: string
  stages: Stage[]
  edges: Edge[]
  timings: Timing[]
  error?: string
}

// ---------- small, defensive helpers ----------
const arr = (x: any): any[] => (Array.isArray(x) ? x : [])
const num = (x: any): number => { const n = Number(x); return Number.isFinite(n) ? n : 0 }
const str = (x: any): string => String(x ?? '')
const clip = (s: unknown, n: number) => { const t = str(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
const readJson = (p: string): any => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const listJson = (dir: string, prefix: string): string[] => { try { return fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort().reverse() } catch { return [] } }
const exists = (p: string) => { try { return fs.existsSync(p) } catch { return false } }
const isPullName = (f: unknown) => /^pull_[\w:.-]+\.json$/.test(str(f))
const stampOf = (pullFile: string) => path.basename(pullFile).replace(/^pull_/, '').replace(/\.json$/i, '')
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'and', 'or', 'vs', 'to', 'for', 'at', 'by', 'with', 'is', 'are', 'was', 'were', 'from', 'its', 'this', 'that', 'as', 'it', 'be', 'rt'])
const norm = (s: unknown) => str(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
const toks = (s: string) => new Set(s.split(' ').filter(t => t.length > 1 && !STOP.has(t)))
/** 1 = same text · 0.85 = one contains the other (>= 8 chars) · else token Jaccard (0..1) */
function similar(a: unknown, b: unknown): number {
  const x = norm(a), y = norm(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const [s, l] = x.length <= y.length ? [x, y] : [y, x]
  if (s.length >= 8 && ` ${l} `.includes(` ${s} `)) return 0.85
  const tx = toks(x), ty = toks(y)
  if (!tx.size || !ty.size) return 0
  let inter = 0
  tx.forEach(t => { if (ty.has(t)) inter++ })
  return inter / (tx.size + ty.size - inter)
}
/** a named entity (2+ words, or 6+ chars) appears whole-word inside a text */
function entityIn(text: unknown, entity: unknown): boolean {
  const e = norm(entity), t = norm(text)
  if (!e || !t) return false
  const words = e.split(' ').filter(w => !STOP.has(w))
  if (!(words.length >= 2 || e.length >= 6)) return false
  return ` ${t} `.includes(` ${e} `)
}
const stripSourcePrefix = (s: unknown) => str(s).replace(/^\[(x|yt)\s[^\]]*\]\s*/i, '')

const KIND_TONE: Record<string, Tone> = { story: 'ok', substory: 'info', topic: '' }
const BAND_TONE: Record<string, Tone> = { auto: 'err', expand: 'warn', store: 'info', ignore: '' }
const TRUTH_TONE: Record<string, Tone> = { FACT: 'ok', ATTRIBUTED_CLAIM: 'warn', ANALYSIS: 'info' }
const auditTone = (s: unknown): Tone => (s === 'pass' ? 'ok' : s ? 'warn' : '')
const showTone = (s: unknown): Tone => (s === 'done' ? 'ok' : s === 'error' || s === 'cancelled' ? 'err' : 'warn')

// ---------- the pull ----------
type FeedItem = { index: number; medium: Medium; source: string; text: string; url: string | null; likes: number; rts: number; when: string | null }
/** the flat feed in the SAME order as materialFromPull (twitter tops, then youtube videos), so a
 *  cluster's item_indices map back to the real posts (with url, likes, medium) */
function feedFromPull(report: any): FeedItem[] {
  const out: FeedItem[] = []
  for (const s of arr(report?.twitter)) for (const t of arr(s?.top)) out.push({ index: out.length, medium: 'x', source: '@' + str(s?.handle || '?'), text: str(t?.text), url: t?.url ? str(t.url) : null, likes: num(t?.likes), rts: num(t?.rts), when: t?.created ? str(t.created) : null })
  for (const c of arr(report?.youtube)) for (const v of arr(c?.videos)) out.push({ index: out.length, medium: 'youtube', source: str(c?.channel || '?'), text: str(v?.title), url: v?.url ? str(v.url) : null, likes: 0, rts: 0, when: v?.published ? str(v.published) : null })
  return out
}
function feedSample(f: FeedItem): Sample {
  const eng = f.likes + 2 * f.rts
  return {
    id: 'feed:' + f.index, medium: f.medium, text: f.text || '(no text)', sub: `${f.source}${f.when ? ' · ' + f.when : ''}`, url: f.url,
    n: f.medium === 'x' ? eng : null, nLabel: f.medium === 'x' ? 'engagement' : undefined,
    chips: f.medium === 'x' ? [{ label: `♥ ${f.likes}` }, { label: `rt ${f.rts}` }] : [{ label: 'VIDEO', tone: 'info' }],
    meta: { index: f.index, source: f.source, likes: f.likes, rts: f.rts, when: f.when },
  }
}

function pickPull(opts: { beat?: string; pull?: string }): { file: string | null; report: any; beat: string | null; pulls: PullRef[]; beats: string[] } {
  const files = listJson(RUNS, 'pull_')
  const load = (f: string) => { const r = readJson(path.join(RUNS, f)); return r ? { file: f, beat: r.beat ? str(r.beat) : null, pulled_at: r.pulled_at ? str(r.pulled_at) : null, items: materialFromPull(r).length, report: r } : null }
  const metas = files.slice(0, 80).map(load).filter(Boolean) as { file: string; beat: string | null; pulled_at: string | null; items: number; report: any }[]
  const beats = Array.from(new Set(metas.map(m => m.beat).filter(Boolean))) as string[]
  const want = isPullName(opts.pull) ? str(opts.pull) : null
  let chosen = want ? (metas.find(m => m.file === want) || (files.includes(want) ? load(want) : null)) : null
  const beat = chosen?.beat || (opts.beat ? str(opts.beat) : null)
  const forBeat = beat ? metas.filter(m => m.beat === beat) : metas
  if (!chosen) chosen = forBeat[0] || null
  return { file: chosen?.file || null, report: chosen?.report || null, beat: chosen?.beat || beat, pulls: forBeat.map(m => ({ file: m.file, beat: m.beat, pulled_at: m.pulled_at, items: m.items })), beats }
}

function stagePull(file: string | null, report: any, feed: FeedItem[]): Stage {
  const base: Stage = { key: 'pull', name: 'PULL', what: 'the search: what the beat\'s X handles and YouTube channels said inside the window', count: 0, subcounts: [], sample: [], rest: [], file, at: report?.pulled_at || null, ms: null, ms_source: null }
  if (!file || !report) return { ...base, file: null, empty: 'no pull yet: run PULL on the DESK' }
  const tw = arr(report.twitter), yt = arr(report.youtube)
  const twOk = tw.filter(s => !s?.error), twErr = tw.filter(s => s?.error)
  const ytOk = yt.filter(c => !c?.error), ytErr = yt.filter(c => c?.error)
  const inWindow = twOk.reduce((n: number, s: any) => n + num(s?.in_window), 0)
  const xKept = feed.filter(f => f.medium === 'x').length
  const ytKept = feed.filter(f => f.medium === 'youtube').length
  const subcounts: SubCount[] = [
    { label: 'window', value: `${num(report.timespan_hours) || '?'}h` },
    { label: 'X posts in window', value: inWindow },
    { label: 'X posts kept (top per handle)', value: xKept },
    { label: 'X handles', value: `${twOk.length} polled · ${twOk.filter(s => num(s?.in_window) > 0).length} with posts · ${twErr.length} errored`, tone: twErr.length ? 'warn' : '' },
    { label: 'YouTube videos', value: ytKept },
    { label: 'YouTube channels', value: `${ytOk.length} polled · ${ytErr.length} errored`, tone: ytErr.length ? 'warn' : '' },
  ]
  if (report.twitter_error) subcounts.push({ label: 'X error', value: clip(report.twitter_error, 70), tone: 'err' })
  if (report.youtube_error) subcounts.push({ label: 'YouTube error', value: clip(report.youtube_error, 70), tone: 'err' })
  const samples = feed.map(feedSample).sort((a, b) => (b.n || 0) - (a.n || 0))
  const sources = [
    ...tw.map(s => ({ medium: 'x' as Medium, name: '@' + str(s?.handle || '?'), label: s?.label ? str(s.label) : null, in_window: num(s?.in_window), kept: arr(s?.top).length, error: s?.error ? str(s.error) : null })),
    ...yt.map(c => ({ medium: 'youtube' as Medium, name: str(c?.channel || '?'), label: null as string | null, in_window: num(c?.in_window), kept: arr(c?.videos).length, error: c?.error ? str(c.error) : null, via: c?.via ? str(c.via) : null })),
  ]
  return { ...base, count: feed.length, subcounts, sample: samples.slice(0, 5), rest: samples.slice(5), detail: { sources, totals: report.totals || null }, ...(feed.length ? {} : { empty: 'the pull came back empty: nothing inside the window' }) }
}

// ---------- clusters ----------
function itemsOf(c: any): { index: number; text: string }[] {
  if (arr(c?.items).length) return arr(c.items).map((i: any) => ({ index: num(i?.index), text: str(i?.text) }))
  const idx = arr(c?.item_indices), ev = arr(c?.evidence)
  if (idx.length) return idx.map((n: any, k: number) => ({ index: num(n), text: str(ev[k]) }))
  return ev.map((t: any) => ({ index: -1, text: str(t) }))
}
const fingerprintLine = (c: any) => {
  const f = c?.event_fingerprint || {}
  return [f.subject, f.action, f.object].filter(Boolean).map(str).join(' ') + (f.claim ? ` · ${str(f.claim)}` : '')
}
function clusterSample(c: any, original: Map<string, string>): Sample {
  const items = itemsOf(c)
  const kind = str(c.kind || 'topic')
  const chips: Chip[] = [{ label: kind.toUpperCase(), tone: KIND_TONE[kind] ?? '' }]
  if (c.pinned) chips.push({ label: 'PINNED', tone: 'err' })
  if (c.human) chips.push({ label: 'HUMAN', tone: 'warn' })
  if (c.dismissed) chips.push({ label: 'DISMISSED', tone: '' })
  const orig = original.get(str(c.id))
  return {
    id: str(c.id), text: str(c.title || '(untitled)'), sub: clip(fingerprintLine(c), 160) || str(c.why_moving), n: items.length, nLabel: 'items', chips,
    meta: {
      kind, pinned: !!c.pinned, human: !!c.human, dismissed: !!c.dismissed, human_ops: arr(c.human_ops), original_title: orig && orig !== c.title ? orig : null,
      fingerprint: c.event_fingerprint || null, shared_signals: arr(c.shared_signals), why_moving: str(c.why_moving),
      items: items.slice(0, 20).map(i => ({ index: i.index, text: clip(stripSourcePrefix(i.text), 220), raw: clip(i.text, 40) })),
      merged_titles: arr(c.merged_titles), split_from: c.split_from || null,
    },
  }
}
function stageCluster(stamp: string | null, feed: FeedItem[]): { stage: Stage; clusters: any[]; original: Map<string, string>; edges: Edge[] } {
  const file = stamp ? `clusters_${stamp}.json` : null
  const base: Stage = { key: 'cluster', name: 'CLUSTER', what: 'items that describe the same EVENT are grouped into a story, substory or topic; the producer can pin, rename, merge, split, dismiss', count: 0, subcounts: [], sample: [], rest: [], file, at: null, ms: null, ms_source: null }
  const original = new Map<string, string>()
  if (!file || !exists(path.join(RUNS, file))) return { stage: { ...base, file: null, empty: 'not clustered yet: run ① CLUSTER on DISCOVERY' }, clusters: [], original, edges: [] }
  let eff: ReturnType<typeof effectiveClusters> | null = null
  try { eff = effectiveClusters(file) } catch { eff = null }
  const envelope = eff?.envelope || readJson(path.join(RUNS, file))
  for (const c of arr(envelope?.clusters)) original.set(str(c?.id), str(c?.title))
  const clusters: any[] = eff?.clusters?.length ? eff.clusters : arr(envelope?.clusters)
  const live = clusters.filter(c => !c?.dismissed)
  const ops = arr(eff?.overrides?.ops).length
  const stale = eff?.overrides?.stale ? num(eff.overrides.stale_ops) : 0
  const subcounts: SubCount[] = [
    { label: 'stories', value: live.filter(c => c?.kind === 'story').length, tone: 'ok' },
    { label: 'substories', value: live.filter(c => c?.kind === 'substory').length, tone: 'info' },
    { label: 'topics', value: live.filter(c => c?.kind === 'topic').length },
    { label: 'feed items in', value: num(envelope?.feed_count) || feed.length },
    { label: 'pinned as today\'s story', value: live.filter(c => c?.pinned).length, tone: live.some(c => c?.pinned) ? 'err' : '' },
    { label: 'human ops applied', value: ops, tone: ops ? 'warn' : '' },
  ]
  if (stale) subcounts.push({ label: 'earlier edits retired (re-clustered)', value: stale, tone: 'info' })
  if (clusters.length - live.length) subcounts.push({ label: 'dismissed', value: clusters.length - live.length })
  const samples = clusters.map(c => clusterSample(c, original))
  const edges: Edge[] = []
  for (const c of clusters) for (const it of itemsOf(c)) if (it.index >= 0 && it.index < feed.length) edges.push({ from: 'feed:' + it.index, to: str(c.id), via: 'item' })
  const ms = num(envelope?.ms) || null
  return {
    stage: { ...base, count: live.length, subcounts, sample: samples.slice(0, 5), rest: samples.slice(5), at: envelope?.clustered_at || null, ms, ms_source: ms ? 'file' : null, detail: { counts: envelope?.counts || null, ops, stale }, ...(clusters.length ? {} : { empty: 'the clusters file is empty' }) },
    clusters, original, edges,
  }
}

// ---------- leads ----------
function leadTouchesCluster(l: any, c: any): boolean {
  const v = norm(l?.value)
  if (v.length < 4) return false
  const items = itemsOf(c).map(i => norm(stripSourcePrefix(i.text)))
  if (items.some(t => ` ${t} `.includes(` ${v} `))) return true
  if (similar(l?.value, c?.title) >= 0.6) return true
  const f = c?.event_fingerprint || {}
  const ents = [...arr(f.named_entities), ...arr(f.key_phrases), f.subject, f.object].filter(Boolean)
  return ents.some((e: any) => similar(l?.value, e) >= 0.85)
}
function leadSample(l: any): Sample {
  const band = str(l.band || 'ignore')
  const win = (l.since || l.until) ? `${l.since || '…'} → ${l.until || '…'}` : null
  const chips: Chip[] = [{ label: band.toUpperCase(), tone: BAND_TONE[band] ?? '' }, { label: str(l.destination || 'WEB'), tone: 'info' }]
  if (win) chips.push({ label: 'ARCHIVE', tone: 'warn' })
  return {
    id: str(l.id), text: str(l.value || l.query), sub: `${str(l.type || 'CLAIM')} → ${str(l.destination || 'WEB')}${win ? ' · archive ' + win : ''}`, n: num(l.score), nLabel: 'score', chips,
    meta: { type: str(l.type), why: str(l.why), query: str(l.query), destination: str(l.destination), band, score: num(l.score), since: l.since || null, until: l.until || null, window: win },
  }
}
function stageLeads(stamp: string | null, clusters: any[]): { stage: Stage; leads: any[]; edges: Edge[] } {
  const file = stamp ? `leads_${stamp}.json` : null
  const base: Stage = { key: 'leads', name: 'LEADS', what: 'what deserves ANOTHER search: people, claims, urls, events, each routed to a source and scored 0 to 100', count: 0, subcounts: [], sample: [], rest: [], file, at: null, ms: null, ms_source: null }
  if (!file || !exists(path.join(RUNS, file))) return { stage: { ...base, file: null, empty: 'no leads yet: run ② MINE LEADS on DISCOVERY' }, leads: [], edges: [] }
  const q = readJson(path.join(RUNS, file))
  const leads = arr(q?.leads).filter(l => l && typeof l === 'object').map((l: any, i: number) => ({ ...l, id: str(l.id || 'L' + String(i + 1).padStart(3, '0')) }))
  const byBand = (b: string) => leads.filter(l => l.band === b).length
  const byDest: Record<string, number> = {}
  for (const l of leads) { const d = str(l.destination || 'WEB'); byDest[d] = (byDest[d] || 0) + 1 }
  const archived = leads.filter(l => l.since || l.until).length
  const subcounts: SubCount[] = [
    { label: 'AUTO (80+)', value: byBand('auto'), tone: 'err' },
    { label: 'EXPAND (60 to 79)', value: byBand('expand'), tone: 'warn' },
    { label: 'STORE (40 to 59)', value: byBand('store'), tone: 'info' },
    { label: 'IGNORE', value: byBand('ignore') },
    ...Object.entries(byDest).sort((a, b) => b[1] - a[1]).map(([d, n]) => ({ label: `→ ${d}`, value: n })),
    { label: 'carry an X archive window', value: archived, tone: archived ? 'warn' : '' },
  ]
  const samples = [...leads].sort((a, b) => num(b.score) - num(a.score)).map(leadSample)
  const edges: Edge[] = []
  for (const c of clusters) for (const l of leads) if (leadTouchesCluster(l, c)) edges.push({ from: str(c.id), to: l.id, via: 'story' })
  const ms = num(q?.ms) || null
  return {
    stage: { ...base, count: leads.length, subcounts, sample: samples.slice(0, 5), rest: samples.slice(5), at: q?.mined_at || null, ms, ms_source: ms ? 'file' : null, detail: { counts: q?.counts || null, by_destination: byDest, archived }, ...(leads.length ? {} : { empty: 'the leads file holds no leads' }) },
    leads, edges,
  }
}

// ---------- rank ----------
function rankSample(r: any, i: number): Sample {
  const chips: Chip[] = []
  if (r.pinned) chips.push({ label: 'PINNED', tone: 'err' })
  if (r.debatable) chips.push({ label: 'DEBATABLE', tone: 'ok' })
  if (r.best_format) chips.push({ label: str(r.best_format).toUpperCase(), tone: 'info' })
  const sides = arr(r.contrasting_viewpoints).map(str)
  return {
    id: 'rank:' + i, text: str(r.title || '(untitled)'), sub: sides.length >= 2 ? `side A · ${clip(sides[0], 70)}  |  side B · ${clip(sides[1], 70)}` : clip(r.best_angle, 140), n: num(r.show_value), nLabel: 'show value', chips,
    meta: { rank: i + 1, show_value: num(r.show_value), rationale: str(r.rationale), best_angle: str(r.best_angle), best_format: str(r.best_format), sides, debatable: !!r.debatable, pinned: !!r.pinned },
  }
}
function stageRank(stamp: string | null, clusters: any[], original: Map<string, string>): { stage: Stage; ranked: any[]; edges: Edge[] } {
  const file = stamp ? `producer_${stamp}.json` : null
  const base: Stage = { key: 'rank', name: 'RANK', what: 'the producer scores each story for SHOW VALUE: contrasting viewpoints first, then the angle and the format', count: 0, subcounts: [], sample: [], rest: [], file, at: null, ms: null, ms_source: null }
  if (!file || !exists(path.join(RUNS, file))) return { stage: { ...base, file: null, empty: 'not ranked yet: run ③ RANK FOR SHOW on DISCOVERY' }, ranked: [], edges: [] }
  const p = readJson(path.join(RUNS, file))
  const ranked = arr(p?.ranked).filter(r => r && typeof r === 'object')
  const debatable = ranked.filter(r => r.debatable).length
  const subcounts: SubCount[] = [
    { label: 'debatable', value: debatable, tone: 'ok' },
    { label: 'format', value: str(p?.format || 'debate') },
    { label: 'top show value', value: ranked.length ? num(ranked[0]?.show_value) : 0 },
    { label: 'pinned by the producer', value: ranked.filter(r => r.pinned).length, tone: ranked.some(r => r.pinned) ? 'err' : '' },
  ]
  if (p?.usage?.cost != null) subcounts.push({ label: 'model cost', value: `$${num(p.usage.cost).toFixed(4)}` })
  if (p?.usage?.total_tokens) subcounts.push({ label: 'tokens', value: num(p.usage.total_tokens) })
  const samples = ranked.map(rankSample)
  const edges: Edge[] = []
  ranked.forEach((r, i) => {
    for (const c of clusters) {
      const titles = [c.title, original.get(str(c.id)), ...arr(c.merged_titles)].filter(Boolean)
      if (titles.some(t => similar(r.title, t) >= 0.6)) edges.push({ from: str(c.id), to: 'rank:' + i, via: 'title' })
    }
  })
  const ms = num(p?.ms) || null
  return {
    stage: { ...base, count: ranked.length, subcounts, sample: samples.slice(0, 5), rest: samples.slice(5), at: p?.ranked_at || null, ms, ms_source: ms ? 'file' : null, detail: { titles: ranked.map(r => str(r.title)), pulled_from: p?.pulled_from || null, format: p?.format || null }, ...(ranked.length ? {} : { empty: 'the ranking is empty' }) },
    ranked, edges,
  }
}

// ---------- dossiers ----------
type Link = { via: EdgeVia; from: string }
const VIA_RANK: Record<string, number> = { lead: 0, title: 1, 'lead-value': 2, entity: 3 }
function linkDossier(d: any, leads: any[], clusters: any[], original: Map<string, string>, ranked: any[]): Link[] {
  const links: Link[] = []
  const ex = d?.expanded_from
  const text = str(d?.assignment?.text)
  if (ex && (ex.lead_id || ex.lead_value)) {
    for (const l of leads) {
      if (ex.lead_id && l.id === str(ex.lead_id) && similar(ex.lead_value, l.value) >= 0.85) { links.push({ via: 'lead', from: l.id }); continue }
      if (similar(ex.lead_value, l.value) >= 0.6 || similar(ex.lead_value, l.query) >= 0.6) links.push({ via: 'lead-value', from: l.id })
    }
  }
  ranked.forEach((r, i) => { if (similar(text, r?.title) >= 0.6) links.push({ via: 'title', from: 'rank:' + i }) })
  for (const c of clusters) {
    const titles = [c.title, original.get(str(c.id)), ...arr(c.merged_titles)].filter(Boolean)
    if (titles.some(t => similar(text, t) >= 0.6)) { links.push({ via: 'title', from: str(c.id) }); continue }
    if (arr(c.event_fingerprint?.named_entities).some((e: any) => entityIn(text, e))) links.push({ via: 'entity', from: str(c.id) })
  }
  const seen = new Set<string>()
  return links.filter(l => { if (seen.has(l.from)) return false; seen.add(l.from); return true })
}
function dossierSample(d: any, links: Link[]): Sample {
  const sources = arr(d.sources), evidence = arr(d.evidence)
  const byMedium = { youtube: sources.filter(s => s?.medium === 'youtube').length, web: sources.filter(s => s?.medium === 'web').length, x: sources.filter(s => s?.medium === 'x').length }
  const byLabel: Record<string, number> = {}
  for (const e of evidence) { const k = str(e?.truth_label || '?'); byLabel[k] = (byLabel[k] || 0) + 1 }
  const audit = d.audit || {}
  const best = [...evidence].sort((a, b) => (Number(!!b?.valid_source) - Number(!!a?.valid_source)) || ((TRUTH_TONE[str(a?.truth_label)] === 'ok' ? 0 : 1) - (TRUTH_TONE[str(b?.truth_label)] === 'ok' ? 0 : 1)))
  const bestVia = [...links].sort((a, b) => (VIA_RANK[a.via] ?? 9) - (VIA_RANK[b.via] ?? 9))[0]
  const chips: Chip[] = [{ label: str(audit.status || 'no audit').toUpperCase().replace('_', ' '), tone: auditTone(audit.status) }]
  if (bestVia) chips.push({ label: `VIA ${bestVia.via.toUpperCase()}`, tone: bestVia.via === 'lead' || bestVia.via === 'title' ? 'ok' : 'warn' })
  if (audit.needs_web) chips.push({ label: 'NEEDS WEB', tone: 'warn' })
  const publishers = Array.from(new Set(sources.filter(s => s?.transcript_status === 'ok' || s?.medium === 'web' || s?.medium === 'x').map(s => str(s?.publisher)).filter(Boolean)))
  return {
    id: str(d.id), text: str(d.assignment?.text || d.id), sub: `${str(d.assignment?.kind || 'subject')} · ${str(d.assignment?.mode || 'context')}${d.assignment?.dual ? ' · dual' : ''} · ${byMedium.youtube} YT · ${byMedium.web} WEB · ${byMedium.x} X`, n: evidence.length, nLabel: 'evidence', chips,
    meta: {
      created_at: d.created_at || null, status: d.status || null, questions: arr(d.assignment?.questions).map(str), mode: str(d.assignment?.mode || 'context'), dual: !!d.assignment?.dual,
      sources_by_medium: byMedium, transcripts: num(d.usage?.transcripts), transcript_words: num(d.usage?.transcript_words), parse_ms: num(d.usage?.parse_ms),
      publishers: publishers.slice(0, 20), distinct_publishers: num(audit.distinct_publishers) || publishers.length, audit: { status: audit.status || null, needs_web: !!audit.needs_web, uncited: arr(audit.uncited_claims).length, warnings: arr(audit.warnings).map(str) },
      expanded_from: d.expanded_from || null, links, evidence_by_label: byLabel, valid_evidence: evidence.filter(e => e?.valid_source).length, answers: arr(d.answers).length,
      sources: sources.slice(0, 40).map(s => ({ id: str(s?.id), medium: (s?.medium === 'web' || s?.medium === 'x' ? s.medium : 'youtube') as Medium, publisher: str(s?.publisher), title: clip(s?.title || s?.text, 120), url: s?.url ? str(s.url) : null, transcript_status: str(s?.transcript_status), words: num(s?.words), trust: str(s?.trust), published_at: s?.published_at ? str(s.published_at) : null })),
      evidence: best.slice(0, 12).map(e => ({ id: str(e?.id), claim: clip(e?.claim, 260), truth_label: str(e?.truth_label), tone: e?.valid_source ? (TRUTH_TONE[str(e?.truth_label)] ?? '') : 'err', source_name: str(e?.source_name), source_id: str(e?.source_id), url: e?.url ? str(e.url) : null, valid_source: !!e?.valid_source, quote: e?.quote ? clip(e.quote, 200) : null })),
    },
  }
}
function stageDossiers(leads: any[], clusters: any[], original: Map<string, string>, ranked: any[]): { stage: Stage; dossiers: any[]; edges: Edge[] } {
  const base: Stage = { key: 'dossiers', name: 'DOSSIERS', what: 'a lead (or a ranked story) becomes cited evidence: YouTube transcripts, web reporting, X posts, every claim tied to a source', count: 0, subcounts: [], sample: [], rest: [], file: 'lab/research/stringer/str_*.json', at: null, ms: null, ms_source: null }
  const files = listJson(STRINGER, 'str_').slice(0, 200)
  if (!files.length) return { stage: { ...base, empty: 'no dossiers on disk yet' }, dossiers: [], edges: [] }
  const linked: { d: any; links: Link[] }[] = []
  for (const f of files) {
    const d = readJson(path.join(STRINGER, f))
    if (!d || typeof d !== 'object' || !d.id) continue
    const links = linkDossier(d, leads, clusters, original, ranked)
    if (links.length) linked.push({ d, links })
  }
  linked.sort((a, b) => {
    const ra = Math.min(...a.links.map(l => VIA_RANK[l.via] ?? 9)), rb = Math.min(...b.links.map(l => VIA_RANK[l.via] ?? 9))
    return (ra - rb) || str(b.d.created_at).localeCompare(str(a.d.created_at))
  })
  if (!linked.length) return { stage: { ...base, empty: `${files.length} dossiers on disk, none tied to this pull\'s leads or stories yet: EXPAND a lead or BUILD a show on DISCOVERY`, detail: { on_disk: files.length } }, dossiers: [], edges: [] }
  const samples = linked.map(x => dossierSample(x.d, x.links))
  const edges: Edge[] = []
  for (const x of linked) for (const l of x.links) edges.push({ from: l.from, to: str(x.d.id), via: l.via })
  const sum = (k: string) => samples.reduce((n, s) => n + num(s.meta?.sources_by_medium?.[k]), 0)
  const subcounts: SubCount[] = [
    { label: 'from a lead (EXPAND)', value: linked.filter(x => x.links.some(l => l.via === 'lead' || l.via === 'lead-value')).length, tone: 'ok' },
    { label: 'from a story title (BUILD)', value: linked.filter(x => x.links.some(l => l.via === 'title')).length, tone: 'ok' },
    { label: 'by a named entity only', value: linked.filter(x => x.links.every(l => l.via === 'entity')).length, tone: 'warn' },
    { label: 'sources · YT / WEB / X', value: `${sum('youtube')} / ${sum('web')} / ${sum('x')}` },
    { label: 'evidence total', value: samples.reduce((n, s) => n + num(s.n), 0) },
    { label: 'audit pass', value: samples.filter(s => s.meta?.audit?.status === 'pass').length, tone: 'ok' },
    { label: 'needs review', value: samples.filter(s => s.meta?.audit?.status && s.meta.audit.status !== 'pass').length, tone: 'warn' },
    { label: 'dossiers on disk', value: files.length },
  ]
  const ms = samples.reduce((n, s) => n + num(s.meta?.parse_ms), 0) || null
  const at = linked.map(x => str(x.d.created_at)).filter(Boolean).sort().reverse()[0] || null
  return { stage: { ...base, count: linked.length, subcounts, sample: samples.slice(0, 5), rest: samples.slice(5), at, ms, ms_source: ms ? 'file' : null, detail: { on_disk: files.length } }, dossiers: linked.map(x => x.d), edges }
}

// ---------- briefings ----------
function briefingSample(b: any): Sample {
  const moves = arr(b.moves)
  const audit = b.audit || {}
  const chips: Chip[] = [{ label: str(audit.status || 'no audit').toUpperCase().replace('_', ' '), tone: auditTone(audit.status) }, { label: str(b.question?.type || 'open').toUpperCase(), tone: 'info' }]
  if (arr(audit.uncited_moves).length) chips.push({ label: `${arr(audit.uncited_moves).length} UNCITED`, tone: 'err' })
  return {
    id: str(b.id), text: str(b.title || b.id), sub: str(b.question?.text), n: moves.length, nLabel: 'moves', chips,
    meta: {
      stringer_id: str(b.stringer_id), created_at: b.created_at || null, question: str(b.question?.text), question_type: str(b.question?.type), elapsed_ms: num(b.elapsed_ms),
      audit: { status: audit.status || null, all_factual_moves_cited: !!audit.all_factual_moves_cited, question_is_non_leading: !!audit.question_is_non_leading, loaded_language: arr(audit.loaded_language).map(str), uncited_moves: arr(audit.uncited_moves).map(str) },
      moves: moves.slice(0, 12).map((m: any) => ({ id: str(m?.id), order: num(m?.order), kind: str(m?.kind), headline: str(m?.headline), body: clip(m?.body, 420), truth_label: str(m?.truth_label), tone: TRUTH_TONE[str(m?.truth_label)] ?? '', evidence_ids: arr(m?.evidence_ids).map(str), importance: num(m?.importance), uncited: !!m?.uncited })),
      evidence_cited: Array.from(new Set(moves.flatMap((m: any) => arr(m?.evidence_ids).map(str)))).length,
    },
  }
}
function stageBriefings(dossiers: any[]): { stage: Stage; briefings: any[]; edges: Edge[] } {
  const base: Stage = { key: 'briefings', name: 'BRIEFINGS', what: 'the evidence is walked, one move at a time, toward the question the show will ask', count: 0, subcounts: [], sample: [], rest: [], file: 'lab/briefings/brf_*.json', at: null, ms: null, ms_source: null }
  if (!dossiers.length) return { stage: { ...base, empty: 'nothing to brief: no dossier is tied to this pull' }, briefings: [], edges: [] }
  const ids = new Set(dossiers.map(d => str(d.id)))
  const files = listJson(BRIEFINGS, 'brf_').filter(f => !f.endsWith('.agents.json'))
  const briefings: any[] = []
  for (const f of files) { const b = readJson(path.join(BRIEFINGS, f)); if (b && typeof b === 'object' && b.id && ids.has(str(b.stringer_id))) briefings.push(b) }
  briefings.sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)))
  if (!briefings.length) return { stage: { ...base, empty: `${dossiers.length} dossier${dossiers.length === 1 ? '' : 's'} tied to this pull, none briefed yet: BRIEF one in THE STRINGER or BUILD a show` }, briefings: [], edges: [] }
  const samples = briefings.map(briefingSample)
  const edges: Edge[] = briefings.map(b => ({ from: str(b.stringer_id), to: str(b.id), via: 'stringer' as EdgeVia }))
  const subcounts: SubCount[] = [
    { label: 'moves total', value: samples.reduce((n, s) => n + num(s.n), 0) },
    { label: 'audit pass', value: samples.filter(s => s.meta?.audit?.status === 'pass').length, tone: 'ok' },
    { label: 'needs review', value: samples.filter(s => s.meta?.audit?.status && s.meta.audit.status !== 'pass').length, tone: 'warn' },
    { label: 'binary / open questions', value: `${samples.filter(s => s.meta?.question_type === 'binary').length} / ${samples.filter(s => s.meta?.question_type !== 'binary').length}` },
    { label: 'evidence ids cited', value: samples.reduce((n, s) => n + num(s.meta?.evidence_cited), 0) },
  ]
  const ms = samples.reduce((n, s) => n + num(s.meta?.elapsed_ms), 0) || null
  return { stage: { ...base, count: briefings.length, subcounts, sample: samples.slice(0, 5), rest: samples.slice(5), at: briefings[0]?.created_at || null, ms, ms_source: ms ? 'file' : null }, briefings, edges }
}

// ---------- stances ----------
function stanceSample(brfId: string, d: any): Sample {
  const kind = str(d.kind || 'host')
  const chips: Chip[] = [{ label: kind.toUpperCase(), tone: kind === 'host' ? 'ok' : 'info' }, d.ok ? { label: 'OK', tone: 'ok' } : { label: 'FAILED', tone: 'err' }]
  if (d.human) chips.push({ label: 'HUMAN', tone: 'warn' })
  const st = d.stance || {}
  const reasons = arr(st.reasons)
  return {
    id: `stance:${brfId}:${str(d.cast_id || d.name)}`, text: str(d.name || d.cast_id || '?'), sub: `${str(d.dna_attribute || '')}${d.dna_id ? ' · ' + str(d.dna_id) : ''}${d.budget ? ' · budget ' + num(d.budget) : ''}`, n: reasons.length, nLabel: 'reasons', chips,
    meta: {
      briefing_id: brfId, cast_id: str(d.cast_id), kind, human: !!d.human, verbatim: !!d.verbatim, ok: !!d.ok, error: d.error ? str(d.error) : null, dna_id: str(d.dna_id), dna_attribute: str(d.dna_attribute), budget: d.budget == null ? null : num(d.budget), ms: num(d.ms), provider: str(d.provider),
      answer: str(st.answer), thesis: str(st.thesis), reasons: reasons.slice(0, 8).map((r: any) => ({ text: clip(r?.text, 360), evidence_ids: arr(r?.evidence_ids).map(str), asked: r?.asked ? str(r.asked) : null })), concession: str(st.concession), uncertainty: str(st.uncertainty),
      moves_included: arr(d.moves_included).map(str), allowed_evidence: arr(d.allowed_evidence_ids).length, interview: arr(d.interview).slice(0, 6).map((q: any) => ({ q: str(q?.q), a: clip(q?.a, 300) })),
    },
  }
}
function stageStances(briefings: any[]): { stage: Stage; edges: Edge[] } {
  const base: Stage = { key: 'stances', name: 'STANCES', what: 'each host reads the briefing with their own model DNA and takes a side; a human delegate can answer verbatim', count: 0, subcounts: [], sample: [], rest: [], file: 'lab/briefings/brf_*.agents.json', at: null, ms: null, ms_source: null }
  if (!briefings.length) return { stage: { ...base, empty: 'no briefing to brief the cast on' }, edges: [] }
  const samples: Sample[] = []
  const edges: Edge[] = []
  let at: string | null = null
  for (const b of briefings) {
    const a = readJson(path.join(BRIEFINGS, `${str(b.id)}.agents.json`))
    if (!a) continue
    if (a.saved_at && (!at || str(a.saved_at) > at)) at = str(a.saved_at)
    for (const d of arr(a.deliveries)) { const s = stanceSample(str(b.id), d); samples.push(s); edges.push({ from: str(b.id), to: s.id, via: 'briefing' }) }
  }
  if (!samples.length) return { stage: { ...base, empty: `${briefings.length} briefing${briefings.length === 1 ? '' : 's'}, no cast briefed yet: cast it on DISCOVERY (BUILD) or in THE STRINGER` }, edges: [] }
  const ok = samples.filter(s => s.meta?.ok)
  const subcounts: SubCount[] = [
    { label: 'hosts briefed ok', value: ok.filter(s => s.meta?.kind === 'host').length, tone: 'ok' },
    { label: 'delegates', value: samples.filter(s => s.meta?.kind === 'delegate').length, tone: 'info' },
    { label: 'human (verbatim)', value: samples.filter(s => s.meta?.human).length, tone: samples.some(s => s.meta?.human) ? 'warn' : '' },
    { label: 'failed', value: samples.length - ok.length, tone: samples.length - ok.length ? 'err' : '' },
    { label: 'model DNA used', value: Array.from(new Set(ok.map(s => s.meta?.dna_id).filter(Boolean))).length },
  ]
  const ms = samples.reduce((n, s) => n + num(s.meta?.ms), 0) || null
  return { stage: { ...base, count: ok.length, subcounts, sample: samples.slice(0, 5), rest: samples.slice(5), at, ms, ms_source: ms ? 'file' : null }, edges }
}

// ---------- shows ----------
function stageShows(dossiers: any[], briefings: any[]): { stage: Stage; edges: Edge[] } {
  const base: Stage = { key: 'shows', name: 'SHOWS', what: 'the floor is run and voiced: compile, floor, audio. The mp3 is the deliverable', count: 0, subcounts: [], sample: [], rest: [], file: 'lab/shows/<slug>/status.json', at: null, ms: null, ms_source: null }
  const dIds = new Set(dossiers.map(d => str(d.id))), bIds = new Set(briefings.map(b => str(b.id)))
  if (!dIds.size && !bIds.size) return { stage: { ...base, empty: 'no dossier or briefing to build from' }, edges: [] }
  let dirs: string[] = []
  try { dirs = fs.readdirSync(SHOWS) } catch { dirs = [] }
  const samples: Sample[] = []
  const edges: Edge[] = []
  for (const slug of dirs) {
    const s = readJson(path.join(SHOWS, slug, 'status.json'))
    if (!s || typeof s !== 'object') continue
    const viaB = s.briefing && bIds.has(str(s.briefing)), viaD = s.stringer && dIds.has(str(s.stringer))
    if (!viaB && !viaD) continue
    const audioOk = s.audio && exists(str(s.audio))
    const audio_url = audioOk ? `/api/command/audio/shows/${slug}/${path.basename(str(s.audio))}` : null
    const segment_url = exists(path.join(SHOWS, slug, 'floor', 'segment_final.md')) ? `/api/command/audio/shows/${slug}/floor/segment_final.md` : null
    const stage = str(s.stage || 'unknown')
    const chips: Chip[] = [{ label: stage.toUpperCase(), tone: showTone(stage) }]
    if (s.voice_engine) chips.push({ label: str(s.voice_engine).toUpperCase(), tone: s.voice_engine === 'kokoro' ? 'warn' : 'info' })
    if (s.duration_s) chips.push({ label: mmss(num(s.duration_s)) })
    samples.push({
      id: 'show:' + slug, text: slug, sub: str(s.question || s.message), n: num(s.duration_s) || null, nLabel: 'seconds', chips, url: audio_url,
      meta: { slug, stage, pct: num(s.pct), message: str(s.message), error: s.error ? str(s.error) : null, failed_stage: s.failed_stage || null, question: str(s.question), briefing: s.briefing || null, stringer: s.stringer || null, started: s.started || null, updated: s.updated || null, duration_s: num(s.duration_s), lines: num(s.lines), voice_engine: str(s.voice_engine), elapsed_s: num(s.elapsed_s), audio_url, segment_url, download_url: audio_url ? audio_url + '?download=1' : null },
    })
    if (viaB) edges.push({ from: str(s.briefing), to: 'show:' + slug, via: 'briefing' })
    else edges.push({ from: str(s.stringer), to: 'show:' + slug, via: 'stringer' })
  }
  samples.sort((a, b) => str(b.meta?.started).localeCompare(str(a.meta?.started)))
  if (!samples.length) return { stage: { ...base, empty: 'no show built from these briefings yet: ▶ BUILD THIS SHOW on DISCOVERY' }, edges: [] }
  const done = samples.filter(s => s.meta?.stage === 'done')
  const subcounts: SubCount[] = [
    { label: 'ready (mp3 on disk)', value: done.filter(s => s.meta?.audio_url).length, tone: 'ok' },
    { label: 'building', value: samples.filter(s => !['done', 'error', 'cancelled'].includes(s.meta?.stage)).length, tone: 'warn' },
    { label: 'failed / cancelled', value: samples.filter(s => ['error', 'cancelled'].includes(s.meta?.stage)).length, tone: 'err' },
    { label: 'runtime total', value: mmss(done.reduce((n, s) => n + num(s.meta?.duration_s), 0)) },
    { label: 'lines voiced', value: done.reduce((n, s) => n + num(s.meta?.lines), 0) },
    { label: 'breeze / kokoro', value: `${done.filter(s => s.meta?.voice_engine === 'breeze').length} / ${done.filter(s => s.meta?.voice_engine === 'kokoro').length}` },
  ]
  const ms = (samples[0]?.meta?.elapsed_s ? num(samples[0].meta.elapsed_s) * 1000 : 0) || null
  return { stage: { ...base, count: samples.length, subcounts, sample: samples.slice(0, 5), rest: samples.slice(5), at: samples[0]?.meta?.updated || null, ms, ms_source: ms ? 'file' : null }, edges }
}

// ---------- timings from the activity log ----------
const toTiming = (e: LogEvent): Timing => ({ ts: e.ts, kind: e.kind, stage: e.stage || null, ok: !!e.ok, beat: e.beat || null, ref: e.ref || null, ms: e.ms == null ? null : num(e.ms), summary: e.summary })
const STAGE_LOG: Record<StageKey, string[]> = { pull: ['pull'], cluster: ['cluster'], leads: ['leads'], rank: ['rank'], dossiers: ['expand', 'research', 'web'], briefings: ['briefing'], stances: ['cast'], shows: ['build'] }
function attachTimings(stages: Stage[], refsByStage: Record<StageKey, string[]>, beat: string | null): Timing[] {
  let events: LogEvent[] = []
  try { events = queryLog({ limit: 1000 }).events } catch { events = [] }
  const kindsWanted = new Set(Object.values(STAGE_LOG).flat())
  for (const s of stages) {
    const kinds = STAGE_LOG[s.key], refs = new Set(refsByStage[s.key] || [])
    // only an event whose ref names THIS run's artifact counts; a hop must never wear another run's clock
    const hit = events.find(e => kinds.includes(e.kind) && e.ref && refs.has(e.ref))
    if (!hit) continue
    s.timing = toTiming(hit)
    if (hit.ms != null && !s.ms) { s.ms = num(hit.ms); s.ms_source = 'log' }
  }
  return events.filter(e => kindsWanted.has(e.kind) && (!beat || !e.beat || e.beat === beat)).slice(0, 40).map(toTiming)
}

// ---------- the journey ----------
export function buildJourney(opts: { beat?: string; pull?: string } = {}): Journey {
  const built_at = new Date().toISOString()
  try {
    const picked = pickPull(opts)
    const stamp = picked.file ? stampOf(picked.file) : null
    const feed = picked.report ? feedFromPull(picked.report) : []
    const pull = stagePull(picked.file, picked.report, feed)
    const cl = stageCluster(stamp, feed)
    const ld = stageLeads(stamp, cl.clusters)
    const rk = stageRank(stamp, cl.clusters, cl.original)
    const ds = stageDossiers(ld.leads, cl.clusters, cl.original, rk.ranked)
    const br = stageBriefings(ds.dossiers)
    const st = stageStances(br.briefings)
    const sh = stageShows(ds.dossiers, br.briefings)
    const stages = [pull, cl.stage, ld.stage, rk.stage, ds.stage, br.stage, st.stage, sh.stage]
    const edges = [...cl.edges, ...ld.edges, ...rk.edges, ...ds.edges, ...br.edges, ...st.edges, ...sh.edges]
    const refs: Record<StageKey, string[]> = {
      pull: picked.file ? [picked.file] : [], cluster: picked.file ? [picked.file] : [], leads: picked.file ? [picked.file] : [], rank: stamp ? [`clusters_${stamp}.json`] : [],
      dossiers: ds.dossiers.map(d => str(d.id)), briefings: br.briefings.map(b => str(b.id)), stances: br.briefings.map(b => str(b.id)), shows: [...sh.stage.sample, ...sh.stage.rest].map(s => str(s.meta?.slug)),
    }
    const timings = attachTimings(stages, refs, picked.beat)
    return { built_at, beat: picked.beat, pull: picked.file, stamp, pulls: picked.pulls, beats: picked.beats, story: null, stages, edges, timings }
  } catch (e: any) {
    return { built_at, beat: opts.beat || null, pull: opts.pull || null, stamp: null, pulls: [], beats: [], story: null, stages: [], edges: [], timings: [], error: 'journey failed: ' + str(e?.message || e).slice(0, 160) }
  }
}

/** every node reachable from `start` following `next` (the start nodes included) */
function closure(start: Iterable<string>, next: Map<string, string[]>): Set<string> {
  const seen = new Set<string>(start)
  const q = Array.from(seen)
  while (q.length) { const id = q.pop() as string; for (const n of next.get(id) || []) if (!seen.has(n)) { seen.add(n); q.push(n) } }
  return seen
}
function countBy(samples: Sample[], key: (s: Sample) => string | undefined): SubCount[] {
  const m: Record<string, number> = {}
  for (const s of samples) { const k = key(s); if (k) m[k] = (m[k] || 0) + 1 }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
}

/** The same journey, narrowed to ONE story's lineage: the ranked story (or cluster) whose title matches,
 *  its clusters, their feed items (upstream), and everything downstream: leads, dossiers, briefings,
 *  stances, shows. Unrelated siblings are dropped. */
export function traceStory(title: string, opts: { beat?: string; pull?: string } = {}): Journey {
  const j = buildJourney(opts)
  const want = str(title).trim()
  if (j.error || !want) return { ...j, story: want || null }
  const all = (key: StageKey) => { const s = j.stages.find(x => x.key === key); return s ? [...s.sample, ...s.rest] : [] }
  const pickBest = (list: Sample[]) => list.map(s => ({ s, score: similar(want, s.text) })).filter(x => x.score >= 0.6).sort((a, b) => b.score - a.score)[0]?.s || null
  const hit = pickBest(all('rank')) || pickBest(all('cluster'))
  if (!hit) return { ...j, story: want, story_error: `no ranked story or cluster matches "${clip(want, 60)}" in this pull` }
  const fwd = new Map<string, string[]>(), back = new Map<string, string[]>()
  for (const e of j.edges) { fwd.set(e.from, [...(fwd.get(e.from) || []), e.to]); back.set(e.to, [...(back.get(e.to) || []), e.from]) }
  const start = new Set<string>([hit.id])
  if (hit.id.startsWith('rank:')) for (const c of back.get(hit.id) || []) start.add(c)        // the clusters behind the ranked story
  else for (const r of fwd.get(hit.id) || []) if (r.startsWith('rank:')) start.add(r)       // a cluster's ranked entry
  const keep = new Set<string>(Array.from(closure(start, fwd)).concat(Array.from(closure(start, back))))
  const stages = j.stages.map(s => {
    const mine = [...s.sample, ...s.rest].filter(x => keep.has(x.id))
    const extra: SubCount[] = [{ label: 'in this story', value: mine.length, tone: 'info' }]
    const byMedium = countBy(mine, x => x.medium ? x.medium.toUpperCase() : undefined)
    const byChip = s.key === 'pull' ? [] : countBy(mine, x => x.chips?.[0]?.label)
    const subcounts = [...extra, ...byMedium, ...byChip]
    const empty = mine.length ? undefined : (s.empty || 'nothing from this story reached this hop yet')
    // a hop this story never reached shows no clock and no freshness: those belonged to other stories
    const clock = mine.length ? {} : { ms: null, ms_source: null, timing: null, at: null }
    return { ...s, count: mine.length, subcounts, sample: mine.slice(0, 5), rest: mine.slice(5), ...clock, ...(empty ? { empty } : {}) }
  })
  return { ...j, story: hit.text, stages, edges: j.edges.filter(e => keep.has(e.from) && keep.has(e.to)) }
}
