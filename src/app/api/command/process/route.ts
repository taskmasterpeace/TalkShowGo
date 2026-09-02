import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { logTimer } from '@/lib/command/log'

const YTDLP = process.env.YTDLP_PATH || 'C:/Users/taskm/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe'
// When YouTube's RSS throttles us (intermittent 404/500 bursts), fall back to yt-dlp's flat listing of
// the channel's videos tab: newest-first, undated in flat mode, so we take the top few and flag them.
function ytdlpRecent(channelId: string, max = 6): { title: string; video_id: string; published: string | null; url: string; approx: true }[] | null {
  try {
    if (!fs.existsSync(YTDLP)) return null
    const out = execFileSync(YTDLP, ['--flat-playlist', '--dump-single-json', '--playlist-end', String(max), '--no-warnings', `https://www.youtube.com/channel/${channelId}/videos`], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 })
    const j = JSON.parse(out)
    return (j.entries || []).filter((e: any) => e && e.id).map((e: any) => ({ title: e.title || '(untitled)', video_id: String(e.id), published: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : null, url: e.url && /^https?:/.test(e.url) ? e.url : `https://www.youtube.com/watch?v=${e.id}`, approx: true as const }))
  } catch { return null }
}

export const runtime = 'nodejs'
export const maxDuration = 300
const ROOT = process.cwd()

function key() {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
  return (env.match(/^TWITTERAPI_IO_KEY=(.+)$/m) || [])[1]
}

/** POST {file} — THE PULL: sweep every verified source within the beat's timespan.
 *  Twitter: last tweets per userId (polling law). YouTube: latest uploads per resolved channel.
 *  Writes a pull report to lab/runs/pull_<ts>.json. This is stage 1 of PROCESS; the
 *  evidence->showplan->floor->voice chain consumes this report next. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}
  const file = body.file
  if (!/^[a-z0-9-]+\.json$/.test(file || '')) return NextResponse.json({ error: 'bad file' }, { status: 400 })
  const t = logTimer()
  let beat: any
  try { beat = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'beats', file), 'utf8')) }
  catch (e: any) {
    t.done(() => ({ kind: 'pull', stage: 'load', ok: false, summary: `pull · beat ${file} unreadable`, error: String(e?.message || e), meta: { file } }))
    return NextResponse.json({ ok: false, error: 'beat unreadable: ' + file, stage: 'load', retryable: false }, { status: 400 })
  }
  if (!beat || typeof beat !== 'object') return NextResponse.json({ ok: false, error: 'beat file is empty: ' + file, stage: 'load', retryable: false }, { status: 400 })
  // ad-hoc window: POST {hours} overrides the beat's default for this pull only (doesn't touch config)
  const hours = Math.min(720, Math.max(1, Math.round(+body.hours) || beat.show?.timespan_hours || 24))
  const since = Date.now() - hours * 3600 * 1000
  // no X key is not fatal — the keyless YouTube leg still runs (a YouTube-only beat must work)
  let K = ''
  try { K = key() || process.env.TWITTERAPI_IO_KEY || '' } catch { K = process.env.TWITTERAPI_IO_KEY || '' }
  const report: any = { beat: beat.id, timespan_hours: hours, pulled_at: new Date().toISOString(), twitter: [], youtube: [], totals: { tweets: 0, videos: 0 } }
  if (!K) report.twitter_error = 'no TWITTERAPI_IO_KEY — X sweep skipped'

  // — Twitter sweep (by userId, engagement-ranked) —
  for (const src of (K ? (Array.isArray(beat.sources?.twitter) ? beat.sources.twitter : []) : [])) {
    if (!src.userId || String(src.status || '').startsWith('SUSPECT')) continue
    try {
      const r = await fetch(`https://api.twitterapi.io/twitter/user/last_tweets?userId=${src.userId}`, { headers: { 'X-API-Key': K }, signal: AbortSignal.timeout(15000) })
      if (!r.ok) throw new Error(`twitterapi ${r.status}`)   // a 401/429 JSON body is a FAILED source, not zero tweets
      const j: any = await r.json()
      const tweets = (j?.data?.tweets || j?.tweets || []).filter((t: any) => new Date(t.createdAt).getTime() >= since)
      const top = tweets
        .map((t: any) => ({ id: t.id, text: (t.text || '').slice(0, 240), url: t.url, created: t.createdAt, likes: t.likeCount || 0, rts: t.retweetCount || 0, replies: t.replyCount || 0, views: Number(t.viewCount || 0) }))
        .sort((a: any, b: any) => (b.likes + b.rts * 2) - (a.likes + a.rts * 2))
      report.twitter.push({ handle: src.handle, label: src.label, in_window: tweets.length, top: top.slice(0, 5) })
      report.totals.tweets += tweets.length
    } catch (e: any) {
      report.twitter.push({ handle: src.handle, error: String(e?.message || e).slice(0, 80) })
    }
    await new Promise(r => setTimeout(r, 300))
  }

  // — YouTube sweep via official channel RSS feeds: exact ISO timestamps, keyless, reliable —
  try {
    const Parser = (await import('rss-parser')).default
    const parser = new Parser()
    // YouTube RSS rate-limits bursts with intermittent 404/500s, so space the feeds out and retry
    // once with backoff (the channel_ids are fine — the failures were the burst, not bad ids).
    for (const ch of beat.sources.youtube || []) {
      if (!ch.channel_id) continue
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channel_id}`
      let feed: any = null, lastErr: any = null
      for (let attempt = 0; attempt < 3 && !feed; attempt++) {
        if (attempt) await new Promise(r => setTimeout(r, 900 * attempt))
        try { feed = await parser.parseURL(url) } catch (e) { lastErr = e }
      }
      if (feed) {
        const recent = (feed.items || [])
          .map((it: any) => ({ title: it.title, video_id: String(it.id || '').split(':').pop(), published: it.pubDate, url: it.link }))
          .filter((v: any) => new Date(v.published).getTime() >= since)
        report.youtube.push({ channel: ch.resolved_title || ch.channel_name, channel_id: ch.channel_id, in_window: recent.length, videos: recent.slice(0, 8), via: 'rss' })
        report.totals.videos += recent.length
      } else {
        // RSS failed 3x -> yt-dlp flat listing (newest-first; dated only when yt-dlp gives a timestamp)
        const fb = ytdlpRecent(ch.channel_id)
        if (fb && fb.length) {
          // dated entries are filtered to the window; undated ones (yt-dlp flat mode) are kept newest-first,
          // capped, and flagged approx — never dropped just because a sibling happened to carry a date
          const dated = fb.filter(v => v.published), undated = fb.filter(v => !v.published)
          const recent = [...dated.filter(v => new Date(v.published as string).getTime() >= since), ...undated.slice(0, dated.length ? 2 : 3)]
          report.youtube.push({ channel: ch.resolved_title || ch.channel_name, channel_id: ch.channel_id, in_window: recent.length, videos: recent.slice(0, 8), via: 'yt-dlp' + (dated.length ? '' : ' (undated, newest-first)'), rss_error: String(lastErr?.message || lastErr).slice(0, 80) })
          report.totals.videos += recent.length
        } else {
          report.youtube.push({ channel: ch.resolved_title || ch.channel_name, channel_id: ch.channel_id, error: String(lastErr?.message || lastErr).slice(0, 80) + (fb === null ? ' · yt-dlp fallback unavailable' : ' · yt-dlp found nothing') })
        }
      }
      await new Promise(r => setTimeout(r, 450)) // space feeds to dodge RSS rate-limiting
    }
  } catch (e: any) {
    report.youtube_error = String(e?.message || e).slice(0, 120)
  }

  const outDir = path.join(ROOT, 'lab', 'runs')
  // millisecond stamp + beat id: two pulls in the same second (or two beats) can never share a file
  const outName = `pull_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23)}_${String(beat.id || 'beat').replace(/[^a-z0-9-]/gi, '-')}.json`
  const srcErr = report.twitter.filter((s: any) => s.error).length + report.youtube.filter((c: any) => c.error).length
  try {
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, outName), JSON.stringify(report, null, 2) + '\n')
  } catch (e: any) {
    t.done(() => ({ kind: 'pull', stage: 'write', ok: false, beat: beat.id, ref: outName, summary: `pull · ${report.totals.tweets} tweets · ${report.totals.videos} videos · ${hours}h · report not written`, error: String(e?.message || e) }))
    return NextResponse.json({ ok: false, error: 'pull report not written: ' + String(e?.message || e).slice(0, 120), stage: 'write', retryable: true }, { status: 500 })
  }
  t.done(() => ({
    kind: 'pull', stage: 'sweep', ok: true, beat: beat.id, ref: outName,
    summary: `${report.totals.tweets} tweets · ${report.totals.videos} videos · ${hours}h${srcErr ? ` · ${srcErr} source errors` : ''}${report.youtube_error ? ' · youtube sweep failed' : ''}`,
    meta: { hours, sources_ok: report.twitter.length + report.youtube.length - srcErr, sources_err: srcErr, twitter_sources: report.twitter.length, youtube_sources: report.youtube.length, youtube_error: report.youtube_error || null },
  }))
  return NextResponse.json({ ok: true, report })
}
