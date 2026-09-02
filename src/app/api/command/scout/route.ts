import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { scoutTopic, resolveChannel } from '@/lib/command/scout'
import type { YtCandidate } from '@/lib/command/scout'
import { appendLog, logTimer } from '@/lib/command/log'
import { loadConfig } from '@/lib/command/stringer'
import { excludedTerms, isExcluded } from '@/lib/command/openrouter-web'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
const ROOT = process.cwd()

const FILE_RE = /^[a-z0-9-]+\.json$/
const CHANNEL_ID_RE = /^UC[\w-]{22}$/
// Robert, 2026-09-01: "Scout: auto-add any channel with three-plus videos on the topic in the window. Yes."
const AUTO_MIN_IN_WINDOW = 3
const beatPath = (file: string) => path.join(ROOT, 'lab', 'beats', file)
const bad = (error: string, stage: string, status = 400, retryable = false) => NextResponse.json({ ok: false, error, stage, retryable }, { status })

// --- beat file helpers: ONE write path, shared by the manual ADD and the scout auto-add, so both land the
//     exact row the resolver writes (status / channel_id / resolved_title, the @handle in the subscribers column) ---
function loadBeat(file: string): any | null {
  try { const b = JSON.parse(fs.readFileSync(beatPath(file), 'utf8')); return b && typeof b === 'object' ? b : null } catch { return null }
}
/** Save like beat/route.ts (drop the UI's `file` field, pretty JSON, trailing newline). Returns the error text, or null when saved. */
function saveBeat(file: string, beat: any): string | null {
  delete beat.file
  try { fs.writeFileSync(beatPath(file), JSON.stringify(beat, null, 2) + '\n'); return null }
  catch (e: any) { return String(e?.message || e).slice(0, 120) }
}
const ensureSources = (beat: any) => { if (!beat.sources || typeof beat.sources !== 'object') beat.sources = {} }
type YtAdd = { channel_id: string; channel_name: string; subscribers?: string | null }
/** Append one YouTube channel unless that channel_id is already in the beat (idempotent). true = a row was pushed. */
function pushYoutube(beat: any, yt: YtAdd, status: string): boolean {
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
function pushTwitter(beat: any, handle: string, label: string): boolean {
  ensureSources(beat)
  if (!Array.isArray(beat.sources.twitter)) beat.sources.twitter = []
  const list: any[] = beat.sources.twitter
  if (list.some(s => String(s?.handle || '').toLowerCase() === handle.toLowerCase())) return false
  list.push({ handle, label, type: 'blogger', priority: 2, status: 'UNVERIFIED (scout)' })
  return true
}

/** The auto-add bar (Robert's rule): 3+ videos on the topic INSIDE THE WINDOW (not the lifetime count), an id YouTube
 *  itself stamped on the video (never a by-name guess, which can land on the wrong half of a collab label), a real
 *  UC id, not already in the beat, not a flagged outlet. X never auto-adds: a handle needs the verify flow's userId. */
function autoPick(c: YtCandidate, terms: string[]): c is YtCandidate & { channel_id: string } {
  return c.in_window >= AUTO_MIN_IN_WINDOW
    && c.id_from === 'author'
    && typeof c.channel_id === 'string' && CHANNEL_ID_RE.test(c.channel_id)
    && !c.already_in_beat
    && !isExcluded(`${c.channel_name} ${c.handle || ''}`, terms)
}

/** THE SCOUT (topic-first source discovery). Three shapes on one POST:
 *  {topic, beat_file?, hours?, auto?}  -> who's covering it on YouTube + X, ranked, flagged against the beat.
 *     `auto` defaults to TRUE when a beat_file is given: every YouTube channel that clears autoPick() is written into
 *     the beat right away (status `RESOLVED <date> (scout auto: N vids on "<topic>")`) and comes back in auto_added[].
 *     Re-scouting the same topic is idempotent: rows already in the beat are skipped, never duplicated.
 *  {resolve: "<name>"}                  -> a named person/channel resolved to a YouTube channel (null if none)
 *  {add: {beat_file, youtube?: {channel_id, channel_name, subscribers?}, twitter?: {handle, label?}}}
 *                                       -> append to the beat's sources if not already there, save like beat/route.ts.
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
    const beat = loadBeat(file)
    if (!beat) return bad('beat unreadable', 'load', 500)
    ensureSources(beat)
    const today = new Date().toISOString().slice(0, 10)
    const added: string[] = []

    if (wantYt) {
      const channel_id = String(add.youtube.channel_id || '').trim()
      const channel_name = String(add.youtube.channel_name || '').trim().slice(0, 120)
      if (!CHANNEL_ID_RE.test(channel_id) || !channel_name) return bad('youtube add needs a real channel_id (UC + 22 chars) + channel_name', 'validate')
      if (pushYoutube(beat, { channel_id, channel_name, subscribers: add.youtube.subscribers }, `RESOLVED ${today} (scout)`)) added.push('youtube:' + channel_id)
    }
    if (wantTw) {
      const handle = String(add.twitter.handle || '').trim().replace(/^@/, '')
      if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return bad('twitter add needs a valid handle', 'validate')
      const label = String(add.twitter.label || '').trim().slice(0, 120) || handle
      if (pushTwitter(beat, handle, label)) added.push('twitter:' + handle)
    }
    if (added.length) {
      const err = saveBeat(file, beat)
      if (err) {
        appendLog({ kind: 'scout', stage: 'add', ok: false, beat: beat.id || null, ref: added.join(' '), summary: `add to beat failed · ${added.join(' ')}`, error: err })
        return bad('save failed: ' + err, 'save', 500, true)
      }
      appendLog({ kind: 'scout', stage: 'add', ok: true, beat: beat.id || null, ref: added.join(' '), summary: `added ${added.join(' ')} to ${beat.id || file} (manual)` })
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
    beat = loadBeat(beat_file)
    if (!beat) {
      appendLog({ kind: 'scout', stage: 'load', ok: false, beat: beat_file.replace(/\.json$/, ''), ref: topic, summary: `scout · beat ${beat_file} unreadable`, error: 'beat unreadable' })
      return bad('beat unreadable', 'load', 500)
    }
  }
  // auto-add is ON whenever there is a beat to write into; {auto:false} makes it a look-only scout
  const auto = !!beat && !(body.auto === false || body.auto === 'false' || body.auto === 0)
  const beatId: string | null = beat?.id || (beat_file ? beat_file.replace(/\.json$/, '') : null)
  const t = logTimer()
  let result: Awaited<ReturnType<typeof scoutTopic>>
  try { result = await scoutTopic(topic, { hours, beat }) }
  catch (e: any) {
    const error = String(e?.message || e).slice(0, 160)
    t.done({ kind: 'scout', stage: 'scout', ok: false, beat: beatId, ref: topic, summary: `scout failed · "${topic}" · ${hours}h`, error, meta: { hours, auto } })
    return bad('scout failed: ' + error, 'scout', 502, true)
  }
  const candidates = `${result.youtube.length} yt / ${result.x.length} x candidates`

  // --- AUTO-ADD (YouTube only) ---
  let auto_added: { channel_name: string; channel_id: string; in_window: number }[] = []
  if (auto) {
    const today = new Date().toISOString().slice(0, 10)
    const terms = excludedTerms(loadConfig())
    const label = topic.slice(0, 80)
    for (const c of result.youtube) {
      if (!autoPick(c, terms)) continue
      const status = `RESOLVED ${today} (scout auto: ${c.in_window} vids on "${label}")`
      if (pushYoutube(beat, { channel_id: c.channel_id, channel_name: c.channel_name, subscribers: c.handle }, status)) {
        auto_added.push({ channel_name: c.channel_name, channel_id: c.channel_id, in_window: c.in_window })
      }
    }
    if (auto_added.length) {
      const err = saveBeat(beat_file as string, beat)
      if (err) {
        // the scout itself worked: hand it back with the miss in warnings[] (this file's contract), not a 500
        result.warnings.push(`auto-add: save failed, nothing added (${err})`)
        t.done({ kind: 'scout', stage: 'save', ok: false, beat: beatId, ref: topic, summary: `${candidates} · auto-add save failed (${auto_added.length} picked)`, error: err, meta: { hours, auto, auto_added: auto_added.map(a => a.channel_name) } })
        auto_added = []
        return NextResponse.json({ ok: true, beat_file, ...result, auto, auto_added })
      }
      // the response describes the beat as it now is: an auto-added channel IS in the beat
      const ids = new Set(auto_added.map(a => a.channel_id))
      for (const c of result.youtube) if (c.channel_id && ids.has(c.channel_id)) c.already_in_beat = true
    }
  }
  t.done({ kind: 'scout', stage: 'scout', ok: true, beat: beatId, ref: topic, summary: `${candidates} · auto-added ${auto_added.length}`, meta: { hours, auto, auto_added: auto_added.map(a => a.channel_name) } })
  return NextResponse.json({ ok: true, beat_file, ...result, auto, auto_added })
}
