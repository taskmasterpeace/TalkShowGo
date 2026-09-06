import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const maxDuration = 120
const ROOT = process.cwd()
const BEATS_DIR = path.join(ROOT, 'lab', 'beats')
const RUNS_DIR = path.join(ROOT, 'lab', 'runs')
const readJson = (p: string): any => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const thumbUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`

/** rss / innertube / ytdlp / repaired / error - the four rungs the YOUTUBE page badges, collapsed from
 *  the pull report's raw `via` string (and `reresolved`, which always wins: a channel whose dead id got
 *  fixed THIS pull is the most important thing to surface, regardless of which rung answered after). */
function rungOf(entry: any): 'rss' | 'innertube' | 'ytdlp' | 'repaired' | 'error' | null {
  if (!entry) return null
  if (entry.reresolved) return 'repaired'
  if (entry.error) return 'error'
  const via = String(entry.via || '')
  if (via.startsWith('rss')) return 'rss'
  if (via.startsWith('innertube')) return 'innertube'
  if (via.startsWith('yt-dlp')) return 'ytdlp'
  return null
}

/** GET ?beat=<beat id> — the YOUTUBE page's data, from the beat's config + its newest pull report
 *  (lab/runs/pull_*.json). Kept a thin read so the page stays a thin client: every channel the beat is
 *  configured to watch, merged with what the last pull actually saw for it (rung, videos in window,
 *  thumbnails), plus a health rollup (channels answered/total, rung mix, last pull time). No beat / no
 *  pull yet are both valid, non-error states - the page renders its own empty state for them. */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const wantBeat = (u.searchParams.get('beat') || '').trim()

  const beatFiles = fs.existsSync(BEATS_DIR) ? fs.readdirSync(BEATS_DIR).filter(f => f.endsWith('.json')) : []
  const beats = beatFiles.map(f => ({ file: f, ...(readJson(path.join(BEATS_DIR, f)) || {}) })).filter(b => b.id)
  const beat = (wantBeat && beats.find(b => b.id === wantBeat || b.file === wantBeat)) || beats[0] || null

  if (!beat) return NextResponse.json({ ok: true, view: { beat: null, beat_name: null, beats: beats.map(b => b.id), pull_file: null, pulled_at: null, timespan_hours: null, channels: [], health: { channels_total: 0, channels_answered: 0, rung_mix: {}, last_pull_at: null } } })

  // newest pull report FOR THIS BEAT: filenames are ISO-timestamp-prefixed, so a plain reverse sort is
  // chronological (same convention state/route.ts and dataflow.ts already rely on)
  const pullFiles = fs.existsSync(RUNS_DIR) ? fs.readdirSync(RUNS_DIR).filter(f => f.startsWith('pull_')).sort().reverse() : []
  let report: any = null, pullFile: string | null = null
  for (const f of pullFiles) {
    const j = readJson(path.join(RUNS_DIR, f))
    if (j?.beat === beat.id) { report = j; pullFile = f; break }
  }
  const byChannelId = new Map<string, any>((report?.youtube || []).filter((c: any) => c.channel_id).map((c: any) => [c.channel_id, c]))

  const rungMix: Record<string, number> = {}
  let answered = 0
  const channels = (beat.sources?.youtube || []).map((ch: any) => {
    const entry = ch.channel_id ? byChannelId.get(ch.channel_id) : null
    const rung = rungOf(entry)
    if (entry) { if (!entry.error) answered++; const key = rung || 'unknown'; rungMix[key] = (rungMix[key] || 0) + 1 }
    return {
      channel_name: ch.channel_name || null,
      channel_id: ch.channel_id || null,
      type: ch.type || null,
      priority: ch.priority ?? null,
      resolved_title: ch.resolved_title || entry?.channel || null,
      subscribers: ch.subscribers || null,
      status: ch.status || null,
      pulled: !!entry,
      rung,
      repaired_from: entry?.reresolved?.from || null,
      in_window: entry ? (entry.in_window ?? entry.videos?.length ?? 0) : null,
      error: entry?.error || null,
      videos: (entry?.videos || []).map((v: any) => ({
        video_id: v.video_id, title: v.title || '(untitled)', url: v.url || (v.video_id ? `https://www.youtube.com/watch?v=${v.video_id}` : null),
        published: v.published || null, age_hours: v.age_hours ?? null, ago: v.ago || null, views: v.views || null,
        approx: !!v.approx, thumbnail: v.video_id ? thumbUrl(v.video_id) : null,
      })),
    }
  })

  return NextResponse.json({
    ok: true,
    view: {
      beat: beat.id, beat_name: beat.show?.name || beat.name || beat.id, beats: beats.map(b => b.id),
      pull_file: pullFile, pulled_at: report?.pulled_at || null, timespan_hours: report?.timespan_hours ?? beat.show?.timespan_hours ?? null,
      channels,
      health: { channels_total: (beat.sources?.youtube || []).length, channels_answered: answered, rung_mix: rungMix, last_pull_at: report?.pulled_at || null },
    },
  })
}

/** POST {file, action:'resolve'} — resolve each youtube channel_name to a real channel + latest upload,
 *  via the repo's codified free client (youtubei.js). Writes results into the beat. */
export async function POST(req: Request) {
  const { file, action } = await req.json().catch(() => ({} as any))
  if (action !== 'resolve') return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  if (!/^[a-z0-9-]+\.json$/.test(file || '')) return NextResponse.json({ error: 'bad file' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'beats', file)
  let beat: any
  try { beat = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return NextResponse.json({ error: 'beat unreadable' }, { status: 404 }) }
  const today = new Date().toISOString().slice(0, 10)

  const { Innertube } = await import('youtubei.js')
  const yt = await Innertube.create({ retrieve_player: false })
  const log: string[] = []

  for (const ch of beat.sources?.youtube || []) {
    if (!ch.channel_name) continue
    try {
      const res: any = await yt.search(ch.channel_name, { type: 'channel' })
      const first = (res?.results || []).find((r: any) => r?.type === 'Channel' || r?.author?.id || r?.id)
      if (!first) { ch.status = `NOT FOUND ${today}`; log.push(`MISS ${ch.channel_name}`); continue }
      const id = first.author?.id || first.id
      const title = first.author?.name || first.title?.text || ch.channel_name
      const subs = first.subscriber_count?.text || first.subscribers?.text || null
      ch.channel_id = id
      ch.resolved_title = title
      // B3: if the user pasted a URL/handle as the name, replace it with the real channel title.
      // Only overwrite URL-looking values so a name the user actually typed is left alone.
      const nm = String(ch.channel_name).trim()
      if (title && (nm.includes('youtube.com') || nm.includes('/') || nm.startsWith('@') || nm.startsWith('http'))) ch.channel_name = title
      if (subs) ch.subscribers = subs
      // latest upload
      try {
        const chan: any = await yt.getChannel(id)
        const vids: any = await chan.getVideos()
        const v = (vids?.videos || [])[0]
        if (v) ch.latest = { title: v.title?.text || v.title, video_id: v.id, published: v.published?.text || null }
      } catch { /* latest optional */ }
      ch.status = `RESOLVED ${today}`
      log.push(`OK ${ch.channel_name} -> ${id} (${title}${subs ? ', ' + subs : ''})`)
    } catch (e: any) {
      ch.status = `ERROR ${today}: ${String(e?.message || e).slice(0, 80)}`
      log.push(`ERR ${ch.channel_name}`)
    }
  }
  // the loop above holds the beat across many network calls: re-read NOW and carry over ONLY the
  // youtube rows we resolved, so anything else written meanwhile (a minted token, a scout add) survives
  let fresh: any
  try { fresh = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return NextResponse.json({ error: 'beat unreadable on re-read - nothing written', log }, { status: 500 }) }
  fresh.sources = fresh.sources || {}
  fresh.sources.youtube = beat.sources?.youtube || []
  fs.writeFileSync(p + '.tmp', JSON.stringify(fresh, null, 2) + '\n'); fs.renameSync(p + '.tmp', p)
  return NextResponse.json({ ok: true, log, beat: fresh })
}
