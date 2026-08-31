import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const maxDuration = 120
const ROOT = process.cwd()

/** POST {file, action:'resolve'} — resolve each youtube channel_name to a real channel + latest upload,
 *  via the repo's codified free client (youtubei.js). Writes results into the beat. */
export async function POST(req: Request) {
  const { file, action } = await req.json()
  if (action !== 'resolve') return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  if (!/^[a-z0-9-]+\.json$/.test(file || '')) return NextResponse.json({ error: 'bad file' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'beats', file)
  const beat = JSON.parse(fs.readFileSync(p, 'utf8'))
  const today = new Date().toISOString().slice(0, 10)

  const { Innertube } = await import('youtubei.js')
  const yt = await Innertube.create({ retrieve_player: false })
  const log: string[] = []

  for (const ch of beat.sources.youtube || []) {
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
  fs.writeFileSync(p, JSON.stringify(beat, null, 2) + '\n')
  return NextResponse.json({ ok: true, log, beat })
}
