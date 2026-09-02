// THE SCOUT'S REVIEW LEDGER + EXPLORE MODE. Robert, 2026-09-02: "Scout auto-adds channels with three videos -
// I think you should verify. It should suggest channels but allow you to verify it. And then it should even look
// at channels that it hasn't used." So the scout SUGGESTS (every channel that clears the bar comes back with a
// reason), a human verifies (ADD) or DISMISSES (persisted here, never re-suggested), and EXPLORE walks the beat's
// own topics (its cases, its show name, the top story clusters) for channels the beat has never used. Auto-add is
// opt-in ({auto:true}) and the janitor's scout_explore position turns explore hits into pending proposals.
// Ledger files: lab/scout/dismissed_<beat>.json and lab/scout/seen_<beat>.json (plain arrays of channel ids).
import fs from 'node:fs'
import path from 'node:path'
import { scoutTopic } from './scout'
import type { ScoutResult, YtCandidate } from './scout'
import { loadConfig } from './stringer'
import { excludedTerms, isExcluded } from './openrouter-web'
import { effectiveClusters } from './cluster-overrides'

const ROOT = process.cwd()
const SCOUT_DIR = path.join(ROOT, 'lab', 'scout')
const RUNS = path.join(ROOT, 'lab', 'runs')
const CHANNEL_ID_RE = /^UC[\w-]{22}$/
const BEAT_ID_RE = /^[a-z0-9-]+$/
// Robert, 2026-09-01: three-plus videos on the topic INSIDE THE WINDOW is the bar (lifetime counts don't count)
export const SUGGEST_MIN_IN_WINDOW = 3
export const EXPLORE_DEFAULT_HOURS = 168
const EXPLORE_MAX_TOPICS = 6
const EXPLORE_TOP_CLUSTERS = 3
const EXPLORE_CONCURRENCY = 2

export type Suggestion = {
  channel_name: string; channel_id: string; handle: string | null; url: string | null
  in_window: number; video_count: number; latest_title: string | null; latest_url: string | null
  topic: string; reason: string
}
export type ExploreTopic = { topic: string; from: string }
export type ExploredTopic = ExploreTopic & { hours: number; suggested: Suggestion[]; candidates: number; warnings: string[] }
export type ExploreResult = { hours: number; topics: ExploreTopic[]; explored: ExploredTopic[]; suggested_total: number; seen_added: number }

const arr = (v: any): any[] => Array.isArray(v) ? v : []
const clean = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
const lc = (s: any) => String(s ?? '').trim().toLowerCase()

// ---------------------------------------------------------------------------------------------------------------
// BEAT FILE: the ONE write path shared by the manual ADD, the auto-add and the janitor, so every row lands in the
// exact shape the resolver writes (status / channel_id / resolved_title, the @handle in the subscribers column).
// Writers re-read the file right before patching; a beat is edited from several places within seconds.
// ---------------------------------------------------------------------------------------------------------------
export const beatPath = (file: string) => path.join(ROOT, 'lab', 'beats', file)
export function loadBeatFile(file: string): any | null {
  try { const b = JSON.parse(fs.readFileSync(beatPath(file), 'utf8')); return b && typeof b === 'object' ? b : null } catch { return null }
}
/** Save like beat/route.ts (drop the UI's `file` field, pretty JSON, trailing newline). Returns the error text, or null when saved. */
export function saveBeatFile(file: string, beat: any): string | null {
  delete beat.file
  try { fs.writeFileSync(beatPath(file), JSON.stringify(beat, null, 2) + '\n'); return null }
  catch (e: any) { return String(e?.message || e).slice(0, 120) }
}
export const ensureSources = (beat: any) => { if (!beat.sources || typeof beat.sources !== 'object') beat.sources = {} }
export type YtAdd = { channel_id: string; channel_name: string; subscribers?: string | null }
/** Append one YouTube channel unless that channel_id is already in the beat (idempotent). true = a row was pushed. */
export function pushYoutubeRow(beat: any, yt: YtAdd, status: string): boolean {
  ensureSources(beat)
  if (!Array.isArray(beat.sources.youtube)) beat.sources.youtube = []
  const list: any[] = beat.sources.youtube
  if (list.some(c => c?.channel_id === yt.channel_id)) return false
  const entry: any = { channel_name: yt.channel_name, type: 'blogger', priority: 2, status, channel_id: yt.channel_id, resolved_title: yt.channel_name }
  const handle = String(yt.subscribers || '').trim()   // the @handle when the scout saw one (same column the resolver fills)
  if (/^@[\w.-]{1,60}$/.test(handle)) entry.subscribers = handle
  list.push(entry)
  return true
}
/** Append one X handle unless it is already in the beat (case-insensitive). Lands UNVERIFIED: the verify flow owns the userId. */
export function pushTwitterRow(beat: any, handle: string, label: string): boolean {
  ensureSources(beat)
  if (!Array.isArray(beat.sources.twitter)) beat.sources.twitter = []
  const list: any[] = beat.sources.twitter
  if (list.some(s => lc(s?.handle) === lc(handle))) return false
  list.push({ handle, label, type: 'blogger', priority: 2, status: 'UNVERIFIED (scout)' })
  return true
}
export const beatYoutubeIds = (beat: any): Set<string> => new Set<string>(arr(beat?.sources?.youtube).map((c: any) => String(c?.channel_id || '')).filter(Boolean))

// ---------------------------------------------------------------------------------------------------------------
// THE LEDGER: dismissed = a human said no (never re-suggested, by scout or explore); seen = explore surfaced it
// once (explore never repeats itself; a pending janitor proposal is the durable copy).
// ---------------------------------------------------------------------------------------------------------------
type Ledger = 'dismissed' | 'seen'
const ledgerPath = (kind: Ledger, beatId: string) => path.join(SCOUT_DIR, `${kind}_${beatId}.json`)
export function readLedger(kind: Ledger, beatId: string): string[] {
  if (!BEAT_ID_RE.test(beatId)) return []
  try { const v = JSON.parse(fs.readFileSync(ledgerPath(kind, beatId), 'utf8')); return arr(v).map(String).filter(id => CHANNEL_ID_RE.test(id)) } catch { return [] }
}
/** Add ids (idempotent). Returns the list as it now is on disk. Throws when the beat id is bad or the write fails. */
export function addToLedger(kind: Ledger, beatId: string, ids: string[]): string[] {
  if (!BEAT_ID_RE.test(beatId)) throw new Error('bad beat id')
  const cur = readLedger(kind, beatId)
  const have = new Set(cur)
  const add = ids.filter(id => CHANNEL_ID_RE.test(id) && !have.has(id))
  if (!add.length) return cur
  const next = [...cur, ...add]
  fs.mkdirSync(SCOUT_DIR, { recursive: true })
  fs.writeFileSync(ledgerPath(kind, beatId), JSON.stringify(next, null, 2) + '\n')
  return next
}
export const readDismissed = (beatId: string) => readLedger('dismissed', beatId)
export const dismissChannel = (beatId: string, channelId: string) => addToLedger('dismissed', beatId, [channelId])
export const readSeen = (beatId: string) => readLedger('seen', beatId)
export const addSeen = (beatId: string, ids: string[]) => addToLedger('seen', beatId, ids)

// ---------------------------------------------------------------------------------------------------------------
// THE BAR (pure): 3+ videos on the topic inside the window, an id YouTube itself stamped on the video (never a
// by-name guess, which can land on the wrong half of a collab label), a real UC id, not already in the beat, not
// dismissed/seen, not a flagged outlet. X never qualifies: a handle needs the verify flow's userId.
// ---------------------------------------------------------------------------------------------------------------
export function suggestReason(inWindow: number, topic: string, hours: number): string {
  const win = hours >= 72 && hours % 24 === 0 ? `${hours / 24} days` : `${hours}h`
  return `${inWindow} video${inWindow === 1 ? '' : 's'} on "${topic}" in ${win}`
}
export function clearsBar(c: YtCandidate, terms: string[]): c is YtCandidate & { channel_id: string } {
  return c.in_window >= SUGGEST_MIN_IN_WINDOW
    && c.id_from === 'author'
    && typeof c.channel_id === 'string' && CHANNEL_ID_RE.test(c.channel_id)
    && !c.already_in_beat
    && !isExcluded(`${c.channel_name} ${c.handle || ''}`, terms)
}
export function suggestionsFrom(result: ScoutResult, opts: { terms: string[]; exclude: Set<string> }): Suggestion[] {
  const out: Suggestion[] = []
  for (const c of arr(result?.youtube) as YtCandidate[]) {
    if (!clearsBar(c, opts.terms) || opts.exclude.has(c.channel_id)) continue
    out.push({
      channel_name: c.channel_name, channel_id: c.channel_id, handle: c.handle || null, url: c.url || null,
      in_window: c.in_window, video_count: c.video_count, latest_title: c.latest?.title || null, latest_url: c.latest?.url || null,
      topic: result.topic, reason: suggestReason(c.in_window, result.topic, result.hours),
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// EXPLORE: the beat's own topics. Cases first (its standing stories), then the top 3 live story clusters from the
// newest clusters file (the cluster's event subject is a far better search than its sentence-long title), then
// the show name (the weakest query, so it goes last). Deduped, capped, human-dismissed clusters skipped.
// ---------------------------------------------------------------------------------------------------------------
export function exploreTopics(beat: any, clusters: any[] | null, max = EXPLORE_MAX_TOPICS): ExploreTopic[] {
  const out: ExploreTopic[] = []
  const seen = new Set<string>()
  const push = (raw: any, from: string): boolean => {
    const topic = clean(raw)
    if (!topic || topic.length < 2 || out.length >= max) return false
    const k = topic.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k); out.push({ topic, from })
    return true
  }
  for (const c of arr(beat?.cases)) push(c?.title, 'case')
  let n = 0
  for (const c of arr(clusters)) {
    if (n >= EXPLORE_TOP_CLUSTERS) break
    if (!c || c.dismissed) continue
    const subject = clean(c.event_fingerprint?.subject)
    const topic = subject.length >= 3 && subject.length <= 80 ? subject : clean(c.title)
    if (push(topic, 'cluster:' + String(c.id || n + 1))) n++
  }
  push(beat?.show?.name, 'show')
  return out
}

/** The newest clusters file for a beat (suffix `_<beat>.json`, or the beat id inside older unsuffixed files),
 *  with the human's pin/rename/merge/split/dismiss ops replayed. null = the beat was never clustered. */
export function newestClustersFor(beatId: string): { file: string; clusters: any[] } | null {
  if (!BEAT_ID_RE.test(beatId)) return null
  let files: string[] = []
  try { files = fs.readdirSync(RUNS).filter(f => f.startsWith('clusters_') && f.endsWith('.json')).sort().reverse().slice(0, 40) } catch { return null }
  for (const file of files) {
    let raw: any = null
    if (!file.endsWith(`_${beatId}.json`)) {
      if (/^clusters_\d{4}-\d{2}-\d{2}T[\d-]+_/.test(file)) continue   // another beat's suffix
      try { raw = JSON.parse(fs.readFileSync(path.join(RUNS, file), 'utf8')) } catch { continue }
      if (raw?.beat !== beatId) continue
    }
    try { const eff = effectiveClusters(file); if (eff.clusters?.length) return { file, clusters: eff.clusters } } catch { /* fall through to the raw file */ }
    try { raw = raw || JSON.parse(fs.readFileSync(path.join(RUNS, file), 'utf8')); return { file, clusters: arr(raw?.clusters) } } catch { return null }
  }
  return null
}

/** EXPLORE a beat: scout each of its own topics, keep every channel that clears the bar and that the beat has
 *  never used (not in the beat, not dismissed, not seen before), mark those seen, hand them back per topic. */
export async function exploreBeat(beat: any, beatId: string, opts: { hours?: number } = {}): Promise<ExploreResult> {
  if (!BEAT_ID_RE.test(beatId)) throw new Error('bad beat id')
  const h = Number(opts.hours)
  const hours = Number.isFinite(h) && h > 0 ? Math.min(720, Math.max(1, Math.round(h))) : EXPLORE_DEFAULT_HOURS
  const topics = exploreTopics(beat, newestClustersFor(beatId)?.clusters || null)
  const terms = excludedTerms(loadConfig())
  const exclude = new Set<string>([...Array.from(beatYoutubeIds(beat)), ...readDismissed(beatId), ...readSeen(beatId)])
  const explored: ExploredTopic[] = []
  // a couple of topics at a time: each topic is a YouTube pass + an X pass, and Innertube is friendlier to a trickle
  for (let i = 0; i < topics.length; i += EXPLORE_CONCURRENCY) {
    const batch = topics.slice(i, i + EXPLORE_CONCURRENCY)
    const results = await Promise.all(batch.map(async t => {
      try { return { t, r: await scoutTopic(t.topic, { hours, beat }), err: null as string | null } }
      catch (e: any) { return { t, r: null as ScoutResult | null, err: String(e?.message || e).slice(0, 160) } }
    }))
    for (const x of results) {
      if (!x.r) { explored.push({ ...x.t, hours, suggested: [], candidates: 0, warnings: ['scout failed: ' + x.err] }); continue }
      const suggested = suggestionsFrom(x.r, { terms, exclude })
      for (const s of suggested) exclude.add(s.channel_id)   // a channel surfaces once per explore, on its first topic
      explored.push({ ...x.t, hours, suggested, candidates: x.r.youtube.length, warnings: x.r.warnings })
    }
  }
  const ids = explored.flatMap(e => e.suggested.map(s => s.channel_id))
  const before = readSeen(beatId).length
  const after = ids.length ? addSeen(beatId, ids) : readSeen(beatId)
  return { hours, topics, explored, suggested_total: ids.length, seen_added: after.length - before }
}
