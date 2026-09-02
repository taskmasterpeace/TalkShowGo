import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { logTimer } from '@/lib/command/log'
import { ytChannelRecent, inWindow, YtChannelGone } from '@/lib/command/yt'
import { resolveChannel } from '@/lib/command/scout'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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

  // — YouTube sweep, three rungs per channel: RSS (exact timestamps) -> Innertube Videos tab (keyless,
  //   in-process, relative stamps) -> yt-dlp flat listing. YouTube's RSS throttles bursts with 404/500s;
  //   the ids are fine (Innertube resolves every one), so a throttled feed must never read as "no videos".
  //   A channel Innertube can't open at all is a dead/renamed id: re-resolve it by name and FIX THE BEAT.
  const today = new Date().toISOString().slice(0, 10)
  let beatDirty = false
  // POST {skip_rss:true}: go straight to the Innertube rung (an ops switch for when RSS is in a throttling mood)
  const skipRss = body.skip_rss === true || body.skip_rss === 'true'
  if (skipRss) report.skip_rss = true
  try {
    const Parser = (await import('rss-parser')).default
    const parser = new Parser()
    for (const ch of beat.sources?.youtube || []) {
      if (!ch.channel_id) continue
      const name = ch.resolved_title || ch.channel_name
      // 1) RSS: two tries, then move on (the in-process rung is faster than a third backoff)
      let feed: any = null, lastErr: any = skipRss ? new Error('skipped by request') : null
      for (let attempt = 0; attempt < (skipRss ? 0 : 2) && !feed; attempt++) {
        if (attempt) await sleep(700)
        try { feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channel_id}`) } catch (e) { lastErr = e }
      }
      if (feed) {
        const recent = (feed.items || [])
          .map((it: any) => ({ title: it.title, video_id: String(it.id || '').split(':').pop(), published: it.pubDate, url: it.link }))
          .filter((v: any) => new Date(v.published).getTime() >= since)
        report.youtube.push({ channel: name, channel_id: ch.channel_id, in_window: recent.length, videos: recent.slice(0, 8), via: 'rss' })
        report.totals.videos += recent.length
        await sleep(450) // space feeds to dodge RSS rate-limiting
        continue
      }
      const rss_error = String(lastErr?.message || lastErr).slice(0, 80)

      // 2) Innertube: the channel's Videos tab as the website reads it
      let inner: Awaited<ReturnType<typeof ytChannelRecent>> | null = null, innerErr: string | null = null, reresolved: any = null
      let id: string = ch.channel_id
      try { inner = await ytChannelRecent(id, { name }) }
      catch (e: any) {
        if (e instanceof YtChannelGone) {
          try {
            const r = await resolveChannel(ch.channel_name || name)
            if (r && !r.suspect && r.channel_id && r.channel_id !== id) {
              reresolved = { from: id, to: r.channel_id, title: r.title }
              id = r.channel_id
              inner = await ytChannelRecent(id, { name: r.title })
              ch.channel_id = r.channel_id; ch.resolved_title = r.title; ch.status = `RE-RESOLVED ${today} (was ${reresolved.from})`
              beatDirty = true
            } else innerErr = `channel gone (${e.message})` + (r ? ` · resolver ${r.suspect ? 'unsure' : 'returns the same id'}` : ' · no channel by that name')
          } catch (e2: any) { innerErr = 'channel gone; re-resolve failed: ' + String(e2?.message || e2).slice(0, 80) }
        } else innerErr = String(e?.message || e).slice(0, 80)
      }
      if (inner && inner.items.length) {
        const recent = inWindow(inner.items, hours).map(v => ({ title: v.title, video_id: v.video_id, published: v.published, url: v.url, approx: true, ago: v.ago, views: v.views }))
        report.youtube.push({ channel: inner.title || name, channel_id: id, in_window: recent.length, videos: recent.slice(0, 8), via: inner.via, rss_error, ...(reresolved ? { reresolved } : {}) })
        report.totals.videos += recent.length
        continue
      }
      if (inner && !innerErr) innerErr = 'innertube found no videos'

      // 3) yt-dlp flat listing (newest-first; dated only when yt-dlp gives a timestamp)
      const fb = ytdlpRecent(id)
      if (fb && fb.length) {
        // dated entries are filtered to the window; undated ones (yt-dlp flat mode) are kept newest-first,
        // capped, and flagged approx — never dropped just because a sibling happened to carry a date
        const dated = fb.filter(v => v.published), undated = fb.filter(v => !v.published)
        const recent = [...dated.filter(v => new Date(v.published as string).getTime() >= since), ...undated.slice(0, dated.length ? 2 : 3)]
        report.youtube.push({ channel: name, channel_id: id, in_window: recent.length, videos: recent.slice(0, 8), via: 'yt-dlp' + (dated.length ? '' : ' (undated, newest-first)'), rss_error, innertube_error: innerErr })
        report.totals.videos += recent.length
      } else {
        report.youtube.push({ channel: name, channel_id: id, error: `rss: ${rss_error} · innertube: ${innerErr}` + (fb === null ? ' · yt-dlp unavailable' : ' · yt-dlp found nothing') })
      }
    }
  } catch (e: any) {
    report.youtube_error = String(e?.message || e).slice(0, 120)
  }
  // a re-resolved id is a repair of the beat itself: persist it so the next pull starts from the fixed id.
  // The pull held `beat` in memory for ~20s; a scout auto-add could have written the file in that window, so
  // re-read the CURRENT beat and patch ONLY the channels we re-resolved (never clobber a concurrent add).
  if (beatDirty) {
    try {
      const repairs = report.youtube.filter((c: any) => c.reresolved).map((c: any) => c.reresolved)
      let cur: any
      try { cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'beats', file), 'utf8')) } catch { cur = beat }
      const list = Array.isArray(cur?.sources?.youtube) ? cur.sources.youtube : []
      for (const r of repairs) {
        const row = list.find((c: any) => c?.channel_id === r.from)
        if (row) { row.channel_id = r.to; row.resolved_title = r.title; row.status = `RE-RESOLVED ${today} (was ${r.from})` }
      }
      fs.writeFileSync(path.join(ROOT, 'lab', 'beats', file), JSON.stringify(cur, null, 2) + '\n')
      report.beat_repaired = repairs
    } catch (e: any) { report.beat_repair_error = String(e?.message || e).slice(0, 120) }
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
    meta: {
      hours, sources_ok: report.twitter.length + report.youtube.length - srcErr, sources_err: srcErr, twitter_sources: report.twitter.length, youtube_sources: report.youtube.length, youtube_error: report.youtube_error || null,
      youtube_via: report.youtube.reduce((m: Record<string, number>, c: any) => { const k = c.error ? 'error' : String(c.via || '?').split(' ')[0]; m[k] = (m[k] || 0) + 1; return m }, {}),
      beat_repaired: report.beat_repaired || null,
    },
  }))
  return NextResponse.json({ ok: true, report })
}
