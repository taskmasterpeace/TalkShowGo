// THE SCOUT — topic-first source discovery. When a story gets hot you look up the TOPIC, then you
// end up looking up somebody's NAME (Robert, 2026-09-01). Given a beat + a topic ("Lil Durk case"),
// find WHO is covering it right now on YouTube and X, rank them by real signal (video count then
// recency; likes + 2x reposts then post count), flag who is already in the beat, and hand the desk a
// one-click ADD for the rest. Also resolves a bare name ("Ceddy Nash") to a YouTube channel.
// DETERMINISTIC aggregation, no LLM. The two halves are isolated: a dead X key can never fail the
// YouTube half — the half that worked comes back plus a warnings[] saying what didn't.
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig } from './stringer'
import { excludedTerms, isExcluded } from './openrouter-web'

const ROOT = process.cwd()
function xKey(): string | null { try { return (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^TWITTERAPI_IO_KEY=(.+)$/m) || [])[1]?.trim() || null } catch { return null } }

export type ScoutVideo = { video_id: string; title: string; url: string; published: string | null; age_h: number | null; views: string | null }
// id_from: 'author' = YouTube stamped the id on the video itself; 'search' = we recovered it from a channel
// search on the author label (a collab label like "X and Rare Breed Ent" can land on the wrong half), so
// the UI flags those for an eyeball before ADD; null = no id at all.
export type YtCandidate = { channel_id: string | null; channel_name: string; handle: string | null; url: string | null; id_from: 'author' | 'search' | null; video_count: number; in_window: number; latest: ScoutVideo | null; videos: ScoutVideo[]; already_in_beat: boolean }
export type XCandidate = { handle: string; name: string; url: string; followers: number | null; posts: number; likes: number; rts: number; score: number; sample_text: string; sample_url: string | null; latest: string | null; already_in_beat: boolean }
export type ScoutResult = { topic: string; hours: number; youtube: YtCandidate[]; x: XCandidate[]; warnings: string[]; counts: { youtube_videos: number; x_posts: number }; generated_at: string }
export type ChannelHit = { channel_id: string; title: string; handle: string | null; subscribers: string | null; subs: number | null; url: string }
export type ResolvedChannel = ChannelHit & { suspect: boolean; alternates: ChannelHit[] }
export type ScoutOpts = { hours?: number; beat?: any; cfg?: any }

const TOP = 15
const chUrl = (id: string) => `https://www.youtube.com/channel/${id}`
const vidUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`
const lc = (s: any) => String(s ?? '').trim().toLowerCase()
const normTitle = (s: any) => lc(s).replace(/[^a-z0-9]/g, '')
const clampHours = (h: any) => { const n = Number(h); return Number.isFinite(n) && n > 0 ? Math.min(720, Math.max(1, Math.round(n))) : 48 }

// Innertube only gives relative dates ("3 days ago", "Streamed 5 hours ago"); turn one into an
// approximate age in hours so candidates can be ranked by freshness. null = unparseable.
const UNIT_H: Record<string, number> = { second: 1 / 3600, minute: 1 / 60, hour: 1, day: 24, week: 168, month: 720, year: 8760 }
export function parseAgoHours(text: any): number | null {
  const m = /(\d+)\s*(second|minute|hour|day|week|month|year)/i.exec(String(text || ''))
  return m ? Number(m[1]) * UNIT_H[m[2].toLowerCase()] : null
}
// "304K subscribers" / "1.2M subscribers" / "93 subscribers" -> a number (null if unknown)
export function parseSubs(text: any): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*([KMB])?/i.exec(String(text || ''))
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const mult = m[2] ? (({ K: 1e3, M: 1e6, B: 1e9 } as Record<string, number>)[m[2].toUpperCase()] || 1) : 1
  return Math.round(n * mult)
}
// Real channel ids are 24 chars starting "UC". youtubei.js stamps author.id = 'N/A' when an author has
// no browse endpoint (seen live: "Sorry Its True and Rare Breed Ent"), so anything else is "no id".
const isChannelId = (id: any): id is string => typeof id === 'string' && /^UC[\w-]{22}$/.test(id)

function beatYtIds(beat: any): Set<string> { return new Set<string>(((beat?.sources?.youtube) || []).map((c: any) => String(c?.channel_id || '')).filter(Boolean)) }
function beatTwHandles(beat: any): Set<string> { return new Set<string>(((beat?.sources?.twitter) || []).map((s: any) => lc(s?.handle).replace(/^@/, '')).filter(Boolean)) }

async function innertube(): Promise<any> {
  const { Innertube } = await import('youtubei.js')
  return Innertube.create({ retrieve_player: false })
}

type Picked = { video_id: string; title: string; channel_id: string | null; channel_name: string; handle: string | null; published: string | null; views: string | null }

// Flatten a search hit (a Video node, or a newer LockupView) into one record. null = not a video.
function pickVideo(v: any): Picked | null {
  if (!v) return null
  if (v.type === 'LockupView' && v.content_type && v.content_type !== 'VIDEO') return null
  const video_id = v.video_id || v.id || v.content_id
  if (!video_id || typeof video_id !== 'string') return null
  const title = v.title?.text || (typeof v.title === 'string' ? v.title : null) || v.metadata?.title?.text || '(untitled)'
  const channel_id = isChannelId(v.author?.id) ? v.author.id : null
  const channel_name = v.author?.name || v.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.text || ''
  const handle = (/\/@([\w.-]+)/.exec(String(v.author?.url || '')) || [])[1] || null
  return { video_id, title, channel_id, channel_name, handle: handle ? '@' + handle : null, published: v.published?.text || null, views: v.short_view_count?.text || v.view_count?.text || null }
}

// YOUTUBE HALF — two passes inside the same recency window: a freshness pass (who posted LAST) and a
// relevance pass (who YouTube ranks for the topic) so a big channel's best video is caught even when
// it isn't the newest upload. One continuation each when the first page runs thin.
async function scoutYouTube(topic: string, hours: number, terms: string[], warnings: string[]): Promise<{ channels: YtCandidate[]; videos: number }> {
  let yt: any
  try { yt = await innertube() } catch (e: any) { warnings.push('YouTube: client failed: ' + String(e?.message || e).slice(0, 100)); return { channels: [], videos: 0 } }
  const upload_date = hours <= 48 ? 'week' : 'month'
  const passes: any[] = [{ type: 'video', sort_by: 'upload_date', upload_date }, { type: 'video', sort_by: 'relevance', upload_date }]
  const seen = new Map<string, Picked>()
  for (const filt of passes) {
    try {
      let res: any = await yt.search(topic, filt)
      for (let page = 0; page < 2 && res; page++) {
        for (const raw of (res?.videos || res?.results || [])) {
          const v = pickVideo(raw)
          if (!v || seen.has(v.video_id)) continue
          // Robert's standing rule: a flagged outlet (e.g. LTBR) is never surfaced, let alone suggested
          if (isExcluded(`${v.title} ${v.channel_name} ${v.handle || ''}`, terms)) continue
          seen.set(v.video_id, v)
        }
        if (page === 0 && seen.size < 60 && typeof res?.getContinuation === 'function') { try { res = await res.getContinuation() } catch { res = null } }
        else res = null
      }
    } catch (e: any) { warnings.push(`YouTube: ${filt.sort_by} pass failed: ` + String(e?.message || e).slice(0, 80)) }
  }

  // aggregate by channel; a hit with a name but no id gets resolved via channel search (a few at most
  // so latency stays sane), cached by name
  const byName = new Map<string, string | null>()
  let resolves = 0
  const chans = new Map<string, YtCandidate>()
  for (const v of Array.from(seen.values())) {
    let cid = v.channel_id
    let id_from: YtCandidate['id_from'] = cid ? 'author' : null
    if (!cid && v.channel_name && resolves < 6) {
      const nk = lc(v.channel_name)
      if (!byName.has(nk)) {
        resolves++
        try {
          const r: any = await yt.search(v.channel_name, { type: 'channel' })
          const hit = (r?.channels || r?.results || []).find((c: any) => isChannelId(c?.author?.id) || isChannelId(c?.id))
          const hid = hit ? (isChannelId(hit.author?.id) ? hit.author.id : hit.id) : null
          byName.set(nk, isChannelId(hid) ? hid : null)
        } catch { byName.set(nk, null) }
      }
      cid = byName.get(nk) || null
      if (cid) id_from = 'search'
    }
    const key = cid || ('name:' + lc(v.channel_name || 'unknown'))
    const age_h = parseAgoHours(v.published)
    const rec: ScoutVideo = { video_id: v.video_id, title: v.title, url: vidUrl(v.video_id), published: v.published, age_h, views: v.views }
    const c: YtCandidate = chans.get(key) || { channel_id: cid, channel_name: v.channel_name || '(unknown channel)', handle: v.handle, url: cid ? chUrl(cid) : null, id_from, video_count: 0, in_window: 0, latest: null, videos: [], already_in_beat: false }
    if (c.id_from !== 'author' && id_from === 'author') c.id_from = 'author'   // a video that carries the id outranks a name guess
    if (!c.handle && v.handle) c.handle = v.handle
    c.video_count++
    if (age_h != null && age_h <= hours) c.in_window++
    c.videos.push(rec)
    chans.set(key, c)
  }
  const ageOf = (v: ScoutVideo | null) => (v && v.age_h != null) ? v.age_h : Number.POSITIVE_INFINITY
  // rank: most videos on the topic first, then freshest latest upload (stable sort keeps the freshness
  // pass's own order as the final tiebreak, since it was inserted first)
  const channels = Array.from(chans.values())
    .map(c => { c.videos.sort((a, b) => ageOf(a) - ageOf(b)); c.latest = c.videos[0] || null; return c })
    .sort((a, b) => b.video_count - a.video_count || ageOf(a.latest) - ageOf(b.latest))
  return { channels: channels.slice(0, TOP), videos: seen.size }
}

// X HALF — twitterapi.io advanced_search over the window (since_time UNIX operator, the docs' supported
// form), Latest, up to 3 pages, aggregated by author. Key read from .env like xsearch.ts / verify.
async function scoutX(topic: string, hours: number, terms: string[], warnings: string[]): Promise<{ authors: XCandidate[]; posts: number }> {
  const K = xKey()
  if (!K) { warnings.push('X: TWITTERAPI_IO_KEY missing (YouTube half only)'); return { authors: [], posts: 0 } }
  const since = Math.floor(Date.now() / 1000) - hours * 3600
  const q = `${topic} since_time:${since}`
  const by = new Map<string, XCandidate & { best: number }>()
  let posts = 0, cursor = ''
  for (let p = 0; p < 3; p++) {
    let j: any
    try {
      const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(q)}&queryType=Latest${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const r = await fetch(url, { headers: { 'X-API-Key': K }, signal: AbortSignal.timeout(20000) })
      j = await r.json().catch(() => ({}))
      if (!r.ok) { warnings.push(`X: twitterapi ${r.status}${p ? ` (page ${p + 1})` : ''}`); break }
    } catch (e: any) { warnings.push('X: ' + String(e?.message || e).slice(0, 80)); break }
    for (const t of (j?.tweets || j?.data?.tweets || [])) {
      const text = String(t?.text || '')
      if (!text || /^RT @/.test(text)) continue
      const handle = String(t.author?.userName || t.author?.screen_name || '').replace(/^@/, '')
      if (!handle) continue
      const name = t.author?.name || handle
      if (isExcluded(`${handle} ${name} ${text}`, terms)) continue
      posts++
      const likes = Number(t.likeCount || 0), rts = Number(t.retweetCount || 0)
      const eng = likes + 2 * rts
      const url = t.url || (t.id ? `https://x.com/${handle}/status/${t.id}` : null)
      const a = by.get(lc(handle)) || { handle, name, url: `https://x.com/${handle}`, followers: Number.isFinite(+t.author?.followers) ? +t.author.followers : null, posts: 0, likes: 0, rts: 0, score: 0, sample_text: '', sample_url: null, latest: null, already_in_beat: false, best: -1 }
      a.posts++; a.likes += likes; a.rts += rts; a.score = a.likes + 2 * a.rts
      if (eng > a.best) { a.best = eng; a.sample_text = text.slice(0, 240); a.sample_url = url }
      const ts = t.createdAt ? Date.parse(String(t.createdAt)) : NaN
      if (!isNaN(ts) && (!a.latest || ts > Date.parse(a.latest))) a.latest = new Date(ts).toISOString()
      by.set(lc(handle), a)
    }
    if (!j?.has_next_page || !j?.next_cursor) break
    cursor = j.next_cursor
  }
  const authors = Array.from(by.values()).sort((x, y) => y.score - x.score || y.posts - x.posts).slice(0, TOP).map(({ best: _best, ...a }) => a)
  return { authors, posts }
}

/** Topic -> who's covering it (YouTube channels + X authors), ranked, flagged against the beat. */
export async function scoutTopic(topic: string, opts: ScoutOpts = {}): Promise<ScoutResult> {
  const t = String(topic || '').trim()
  const hours = clampHours(opts.hours)
  const cfg = opts.cfg || loadConfig()
  const terms = excludedTerms(cfg)
  const warnings: string[] = []
  const [ytHalf, xHalf] = await Promise.all([scoutYouTube(t, hours, terms, warnings), scoutX(t, hours, terms, warnings)])
  const ytIn = beatYtIds(opts.beat), twIn = beatTwHandles(opts.beat)
  for (const c of ytHalf.channels) c.already_in_beat = !!c.channel_id && ytIn.has(c.channel_id)
  for (const a of xHalf.authors) a.already_in_beat = twIn.has(lc(a.handle))
  return { topic: t, hours, youtube: ytHalf.channels, x: xHalf.authors, warnings, counts: { youtube_videos: ytHalf.videos, x_posts: xHalf.posts }, generated_at: new Date().toISOString() }
}

type ScoredHit = ChannelHit & { tier: number; i: number }
const stripHit = (h: ScoredHit): ChannelHit => ({ channel_id: h.channel_id, title: h.title, handle: h.handle, subscribers: h.subscribers, subs: h.subs, url: h.url })

/** A named person/channel ("Ceddy Nash") -> the best-matching YouTube channel. Title match sets the
 *  tier (exact > startsWith > includes), but a sub-1K channel never beats a credible one on title alone:
 *  live, "Akademiks" returned a 93-subscriber exact-name squatter above DJ Akademiks' real channels (the
 *  same trap as the @CityNash cash account noted in hood.json). The pick carries `suspect` when it is
 *  itself tiny, plus up to 3 `alternates` so the desk can eyeball "which of Ak's channels". null =
 *  nothing matched or the only match is a flagged outlet. Throws only when YouTube itself is unreachable,
 *  so the route can answer 502 instead of "no match". */
export async function resolveChannel(name: string): Promise<ResolvedChannel | null> {
  const n = String(name || '').trim()
  if (n.length < 2) return null
  let res: any
  try {
    const yt = await innertube()
    res = await yt.search(n, { type: 'channel' })
  } catch (e: any) { throw new Error('YouTube client failed: ' + String(e?.message || e).slice(0, 100)) }
  const terms = excludedTerms(loadConfig())
  const want = normTitle(n)
  const tierOf = (t: string) => !t ? 0 : t === want ? 3 : (t.startsWith(want) || want.startsWith(t)) ? 2 : t.includes(want) ? 1 : 0
  const list: any[] = res?.channels || res?.results || []
  const hits: ScoredHit[] = []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    const channel_id = isChannelId(r?.author?.id) ? r.author.id : (isChannelId(r?.id) ? r.id : null)
    if (!channel_id) continue
    const title = String(r.author?.name || r.title?.text || '')
    // v16 quirk (visible in lab/beats/*.json): subscriber_count.text carries the @handle and video_count.text
    // the subscriber string — pick each by shape, not by field name
    const texts = [r.subscriber_count?.text, r.video_count?.text].map((s: any) => String(s || '')).filter(Boolean)
    const handle = texts.find(s => s.startsWith('@')) || null
    const subscribers = texts.find(s => /subscriber/i.test(s)) || null
    if (isExcluded(`${title} ${handle || ''}`, terms)) continue
    hits.push({ channel_id, title: title || n, handle, subscribers, subs: parseSubs(subscribers), url: chUrl(channel_id), tier: tierOf(normTitle(title)), i })
  }
  if (!hits.length) return null
  const matched = hits.filter(h => h.tier > 0)
  const credible = matched.filter(h => h.subs == null || h.subs >= 1000)
  const pool = credible.length ? credible : (matched.length ? matched : hits)
  const rank = (a: ScoredHit, b: ScoredHit) => b.tier - a.tier || (b.subs ?? -1) - (a.subs ?? -1) || a.i - b.i
  const best = pool.slice().sort(rank)[0]
  const alternates = hits.filter(h => h !== best).sort(rank).slice(0, 3).map(stripHit)
  return { ...stripHit(best), suspect: best.subs != null && best.subs < 1000, alternates }
}
