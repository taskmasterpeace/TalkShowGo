// YouTube channel recency WITHOUT the RSS feed. Robert, 2026-09-01: "YouTube is one of our most important
// things. We need to solve that." The channel ids were never stale (Innertube resolves every one); YouTube's
// RSS endpoint just throttles bursts with 404/500s. So the pull now has a keyless in-process path that reads
// the channel's Videos tab the way the website does, and a second path that searches the channel by name and
// keeps only videos YouTube itself stamps with that channel id.
//
// Innertube only gives relative dates ("3 weeks ago"), so every item here carries `age_hours` (YouTube rounds
// DOWN: "2 days ago" means at least 48h) and `approx: true`. Filter with `age_hours < hours`, strictly.
import { parseAgoHours } from './scout'

export type YtRecent = {
  video_id: string
  title: string
  url: string
  published: string | null   // ISO estimate from the relative stamp (null when YouTube gave none)
  age_hours: number | null
  ago: string | null         // the stamp as YouTube showed it
  views: string | null
  approx: true
}
export type YtRecentResult = { items: YtRecent[]; via: 'innertube' | 'innertube-search'; title: string | null }

let _client: Promise<any> | null = null
async function client() {
  if (!_client) _client = (async () => { const { Innertube } = await import('youtubei.js'); return Innertube.create({ retrieve_player: false }) })()
  return _client
}
const textOf = (t: any): string => typeof t === 'string' ? t : typeof t?.text === 'string' ? t.text : typeof t?.toString === 'function' && t.toString !== Object.prototype.toString ? String(t.toString()) : ''

/** One video from a Videos-tab node (2025+ LockupView, or the older Video node) or from a search hit. */
function toRecent(node: any, now: number): YtRecent | null {
  const id = node?.content_id || node?.id || node?.video_id
  if (typeof id !== 'string' || !/^[\w-]{11}$/.test(id)) return null
  const title = textOf(node?.metadata?.title ?? node?.title).trim() || '(untitled)'
  const parts: string[] = []
  for (const row of node?.metadata?.metadata?.metadata_rows || []) for (const p of row?.metadata_parts || []) parts.push(textOf(p?.text))
  for (const k of ['published', 'view_count', 'short_view_count']) if (node?.[k]) parts.push(textOf(node[k]))
  const ago = parts.find(p => /\bago\b/i.test(p)) || null
  const views = parts.find(p => /\bviews?\b|\bwatching\b/i.test(p)) || null
  const age_hours = parseAgoHours(ago)
  return { video_id: id, title, url: `https://www.youtube.com/watch?v=${id}`, published: age_hours === null ? null : new Date(now - age_hours * 3600e3).toISOString(), age_hours, ago, views, approx: true }
}

export class YtChannelGone extends Error { constructor(m: string) { super(m); this.name = 'YtChannelGone' } }

/** Newest uploads of a channel, keyless. Throws YtChannelGone when Innertube can't open the channel at all
 *  (a dead/renamed id: the caller may re-resolve by name); throws a plain Error on transport failure. */
export async function ytChannelRecent(channelId: string, opts: { max?: number; name?: string | null } = {}): Promise<YtRecentResult> {
  const yt = await client(), now = Date.now(), max = opts.max ?? 12
  let title: string | null = null, ch: any = null
  try { ch = await yt.getChannel(channelId); title = ch?.metadata?.title || null }
  catch (e: any) {
    const msg = String(e?.message || e)
    if (/not found|unavailable|does not exist|404|InnertubeError/i.test(msg)) throw new YtChannelGone(msg.slice(0, 120))
    throw new Error('innertube: ' + msg.slice(0, 120))
  }
  try {
    const tab = await ch.getVideos()
    const nodes: any[] = tab?.current_tab?.content?.contents || tab?.contents || []
    const items = nodes.map(n => (n?.type === 'RichItem' ? n.content : n)).map(n => toRecent(n, now)).filter(Boolean) as YtRecent[]
    if (items.length) return { items: items.slice(0, max), via: 'innertube', title }
  } catch { /* fall through: some channels hide the Videos tab from the web client */ }
  // search by the channel's name and keep only what YouTube stamps with this exact channel id
  const q = opts.name || title
  if (!q) throw new Error('innertube: no videos tab and no name to search by')
  const res = await yt.search(q, { type: 'video', sort_by: 'upload_date' })
  const hits: any[] = res?.videos || res?.results || []
  const items = hits.filter(v => v?.author?.id === channelId).map(v => toRecent({ content_id: v.id, metadata: { title: v.title }, published: v.published, view_count: v.view_count }, now)).filter(Boolean) as YtRecent[]
  return { items: items.slice(0, max), via: 'innertube-search', title }
}

/** Items inside the window. YouTube rounds relative stamps down, so `<` is the honest comparison. */
export const inWindow = (items: YtRecent[], hours: number) => items.filter(i => i.age_hours !== null && i.age_hours < hours)
