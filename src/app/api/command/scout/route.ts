import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { scoutTopic, resolveChannel } from '@/lib/command/scout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
const ROOT = process.cwd()

const FILE_RE = /^[a-z0-9-]+\.json$/
const beatPath = (file: string) => path.join(ROOT, 'lab', 'beats', file)
const bad = (error: string, stage: string, status = 400, retryable = false) => NextResponse.json({ ok: false, error, stage, retryable }, { status })

/** THE SCOUT (topic-first source discovery). Three shapes on one POST:
 *  {topic, beat_file?, hours?}  -> who's covering it on YouTube + X, ranked, flagged against the beat
 *  {resolve: "<name>"}           -> a named person/channel resolved to a YouTube channel (null if none)
 *  {add: {beat_file, youtube?: {channel_id, channel_name, subscribers?}, twitter?: {handle, label?}}}
 *                                -> append to the beat's sources if not already there, save like beat/route.ts.
 *     Twitter adds land UNVERIFIED: resolving the userId is the existing verify flow's job (handles rot, ids don't). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}

  // --- ADD TO BEAT ---
  if (body.add && typeof body.add === 'object') {
    const add = body.add
    const file = String(add.beat_file || '')
    if (!FILE_RE.test(file)) return bad('bad beat_file', 'validate')
    if (!fs.existsSync(beatPath(file))) return bad('unknown beat', 'validate', 404)
    const wantYt = add.youtube && typeof add.youtube === 'object', wantTw = add.twitter && typeof add.twitter === 'object'
    if (!wantYt && !wantTw) return bad('add needs youtube or twitter', 'validate')
    let beat: any
    try { beat = JSON.parse(fs.readFileSync(beatPath(file), 'utf8')) } catch { return bad('beat unreadable', 'load', 500) }
    if (!beat || typeof beat !== 'object') return bad('beat unreadable', 'load', 500)
    if (!beat.sources || typeof beat.sources !== 'object') beat.sources = {}
    const today = new Date().toISOString().slice(0, 10)
    const added: string[] = []

    if (wantYt) {
      const channel_id = String(add.youtube.channel_id || '').trim()
      const channel_name = String(add.youtube.channel_name || '').trim().slice(0, 120)
      if (!/^UC[\w-]{22}$/.test(channel_id) || !channel_name) return bad('youtube add needs a real channel_id (UC + 22 chars) + channel_name', 'validate')
      if (!Array.isArray(beat.sources.youtube)) beat.sources.youtube = []
      const list: any[] = beat.sources.youtube
      if (!list.some(c => c?.channel_id === channel_id)) {
        const entry: any = { channel_name, type: 'blogger', priority: 2, status: `RESOLVED ${today} (scout)`, channel_id, resolved_title: channel_name }
        const handle = String(add.youtube.subscribers || '').trim()   // the @handle when the scout saw one (same column the resolver fills)
        if (/^@[\w.-]{1,60}$/.test(handle)) entry.subscribers = handle
        list.push(entry); added.push('youtube:' + channel_id)
      }
    }
    if (wantTw) {
      const handle = String(add.twitter.handle || '').trim().replace(/^@/, '')
      if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return bad('twitter add needs a valid handle', 'validate')
      const label = String(add.twitter.label || '').trim().slice(0, 120) || handle
      if (!Array.isArray(beat.sources.twitter)) beat.sources.twitter = []
      const list: any[] = beat.sources.twitter
      if (!list.some(s => String(s?.handle || '').toLowerCase() === handle.toLowerCase())) {
        list.push({ handle, label, type: 'blogger', priority: 2, status: 'UNVERIFIED (scout)' }); added.push('twitter:' + handle)
      }
    }
    if (added.length) {
      delete beat.file
      try { fs.writeFileSync(beatPath(file), JSON.stringify(beat, null, 2) + '\n') }
      catch (e: any) { return bad('save failed: ' + String(e?.message || e).slice(0, 120), 'save', 500, true) }
    }
    return NextResponse.json({ ok: true, added, beat: { file, ...beat } })
  }

  // --- RESOLVE A NAME ---
  if (body.resolve !== undefined) {
    const name = String(body.resolve || '').trim()
    if (name.length < 2 || name.length > 120) return bad('resolve needs a name (2..120 chars)', 'validate')
    try { return NextResponse.json({ ok: true, name, channel: await resolveChannel(name) }) }
    catch (e: any) { return bad('resolve failed: ' + String(e?.message || e).slice(0, 160), 'resolve', 502, true) }
  }

  // --- SCOUT A TOPIC ---
  const topic = String(body.topic || '').trim()
  if (topic.length < 2 || topic.length > 200) return bad('topic must be 2..200 chars', 'validate')
  let hours = 48
  if (body.hours !== undefined && body.hours !== null && body.hours !== '') {
    const h = Number(body.hours)
    if (!Number.isFinite(h) || h < 1 || h > 720) return bad('hours must be 1..720', 'validate')
    hours = Math.round(h)
  }
  let beat: any = null
  const beat_file = body.beat_file ? String(body.beat_file) : null
  if (beat_file) {
    if (!FILE_RE.test(beat_file)) return bad('bad beat_file', 'validate')
    if (!fs.existsSync(beatPath(beat_file))) return bad('unknown beat', 'validate', 404)
    try { beat = JSON.parse(fs.readFileSync(beatPath(beat_file), 'utf8')) } catch { return bad('beat unreadable', 'load', 500) }
  }
  try {
    const result = await scoutTopic(topic, { hours, beat })
    return NextResponse.json({ ok: true, beat_file, ...result })
  } catch (e: any) {
    return bad('scout failed: ' + String(e?.message || e).slice(0, 160), 'scout', 502, true)
  }
}
