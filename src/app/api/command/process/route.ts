import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const maxDuration = 180
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
  const { file } = await req.json()
  if (!/^[a-z0-9-]+\.json$/.test(file || '')) return NextResponse.json({ error: 'bad file' }, { status: 400 })
  const beat = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'beats', file), 'utf8'))
  const hours = beat.show?.timespan_hours || 24
  const since = Date.now() - hours * 3600 * 1000
  const K = key()
  const report: any = { beat: beat.id, timespan_hours: hours, pulled_at: new Date().toISOString(), twitter: [], youtube: [], totals: { tweets: 0, videos: 0 } }

  // — Twitter sweep (by userId, engagement-ranked) —
  for (const src of beat.sources.twitter || []) {
    if (!src.userId || String(src.status || '').startsWith('SUSPECT')) continue
    try {
      const r = await fetch(`https://api.twitterapi.io/twitter/user/last_tweets?userId=${src.userId}`, { headers: { 'X-API-Key': K }, signal: AbortSignal.timeout(15000) })
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
    for (const ch of beat.sources.youtube || []) {
      if (!ch.channel_id) continue
      try {
        const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channel_id}`)
        const recent = (feed.items || [])
          .map((it: any) => ({ title: it.title, video_id: String(it.id || '').split(':').pop(), published: it.pubDate, url: it.link }))
          .filter((v: any) => new Date(v.published).getTime() >= since)
        report.youtube.push({ channel: ch.resolved_title || ch.channel_name, channel_id: ch.channel_id, in_window: recent.length, videos: recent.slice(0, 8) })
        report.totals.videos += recent.length
      } catch (e: any) {
        report.youtube.push({ channel: ch.channel_name, error: String(e?.message || e).slice(0, 80) })
      }
    }
  } catch (e: any) {
    report.youtube_error = String(e?.message || e).slice(0, 120)
  }

  const outDir = path.join(ROOT, 'lab', 'runs')
  fs.mkdirSync(outDir, { recursive: true })
  const out = path.join(outDir, `pull_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`)
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
  return NextResponse.json({ ok: true, report })
}
