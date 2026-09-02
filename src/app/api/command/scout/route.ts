import { NextResponse } from 'next/server'
import fs from 'node:fs'
import { scoutTopic, resolveChannel } from '@/lib/command/scout'
import { appendLog, logTimer } from '@/lib/command/log'
import { loadConfig } from '@/lib/command/stringer'
import { excludedTerms } from '@/lib/command/openrouter-web'
import {
  beatPath, loadBeatFile, saveBeatFile, ensureSources, pushYoutubeRow, pushTwitterRow,
  suggestionsFrom, clearsBar, readDismissed, dismissChannel, exploreBeat, SUGGEST_MIN_IN_WINDOW, EXPLORE_DEFAULT_HOURS,
} from '@/lib/command/scout-review'
import type { Suggestion } from '@/lib/command/scout-review'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const FILE_RE = /^[a-z0-9-]+\.json$/
const CHANNEL_ID_RE = /^UC[\w-]{22}$/
const bad = (error: string, stage: string, status = 400, retryable = false) => NextResponse.json({ ok: false, error, stage, retryable }, { status })
const beatIdOf = (file: string) => file.replace(/\.json$/, '')

/** POST {hours} -> a window in 1..720h, or an error response. */
function parseHours(v: any, fallback: number): { hours: number } | { error: string } {
  if (v === undefined || v === null || v === '') return { hours: fallback }
  const h = Number(v)
  if (!Number.isFinite(h) || h < 1 || h > 720) return { error: 'hours must be 1..720' }
  return { hours: Math.round(h) }
}
/** {beat_file} -> the loaded beat, or an error response. */
function loadBeatOr(file: string): { beat: any; file: string } | { res: NextResponse } {
  if (!FILE_RE.test(file)) return { res: bad('bad beat_file', 'validate') }
  if (!fs.existsSync(beatPath(file))) return { res: bad('unknown beat', 'validate', 404) }
  const beat = loadBeatFile(file)
  if (!beat) return { res: bad('beat unreadable', 'load', 500) }
  return { beat, file }
}

/** THE SCOUT (topic-first source discovery). Robert, 2026-09-02: "It should suggest channels but allow you to
 *  verify it." Five shapes on one POST:
 *  {topic, beat_file?, hours?, auto?}  -> who's covering it on YouTube + X, ranked, flagged against the beat.
 *     suggested[]: every YouTube channel that clears the bar (3+ videos on the topic INSIDE the window, an id YouTube
 *     stamped on the video, not in the beat, not a flagged outlet, not dismissed) with a plain-words `reason`.
 *     auto is OFF unless {auto:true} is sent explicitly; then the suggestions are written into the beat right away
 *     (status `RESOLVED <date> (scout auto: N vids on "<topic>")`) and come back in auto_added[] instead.
 *  {explore:true, beat_file, hours?}    -> EXPLORE: scout the beat's own topics (its cases, the top story clusters,
 *     the show name) for channels the beat has never used; each surfaces once (lab/scout/seen_<beat>.json).
 *  {dismiss:{beat_file, channel_id}}    -> a human said no: never suggested again (lab/scout/dismissed_<beat>.json).
 *  {resolve:"<name>"}                   -> a named person/channel resolved to a YouTube channel (null if none).
 *  {add:{beat_file, youtube?:{channel_id, channel_name, subscribers?}, twitter?:{handle, label?}}}
 *                                       -> append to the beat's sources if not already there, save like beat/route.ts.
 *     Twitter adds land UNVERIFIED: resolving the userId is the existing verify flow's job (handles rot, ids don't). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}

  // --- ADD TO BEAT ---
  if (body.add && typeof body.add === 'object') {
    const add = body.add
    const loaded = loadBeatOr(String(add.beat_file || ''))
    if ('res' in loaded) return loaded.res
    const { beat, file } = loaded
    const wantYt = add.youtube && typeof add.youtube === 'object', wantTw = add.twitter && typeof add.twitter === 'object'
    if (!wantYt && !wantTw) return bad('add needs youtube or twitter', 'validate')
    ensureSources(beat)
    const today = new Date().toISOString().slice(0, 10)
    const added: string[] = []

    if (wantYt) {
      const channel_id = String(add.youtube.channel_id || '').trim()
      const channel_name = String(add.youtube.channel_name || '').trim().slice(0, 120)
      if (!CHANNEL_ID_RE.test(channel_id) || !channel_name) return bad('youtube add needs a real channel_id (UC + 22 chars) + channel_name', 'validate')
      if (pushYoutubeRow(beat, { channel_id, channel_name, subscribers: add.youtube.subscribers }, `RESOLVED ${today} (scout)`)) added.push('youtube:' + channel_id)
    }
    if (wantTw) {
      const handle = String(add.twitter.handle || '').trim().replace(/^@/, '')
      if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return bad('twitter add needs a valid handle', 'validate')
      const label = String(add.twitter.label || '').trim().slice(0, 120) || handle
      if (pushTwitterRow(beat, handle, label)) added.push('twitter:' + handle)
    }
    if (added.length) {
      const err = saveBeatFile(file, beat)
      if (err) {
        appendLog({ kind: 'scout', stage: 'add', ok: false, beat: beat.id || null, ref: added.join(' '), summary: `add to beat failed · ${added.join(' ')}`, error: err })
        return bad('save failed: ' + err, 'save', 500, true)
      }
      appendLog({ kind: 'scout', stage: 'add', ok: true, beat: beat.id || null, ref: added.join(' '), summary: `added ${added.join(' ')} to ${beat.id || file} (human verified)` })
    }
    return NextResponse.json({ ok: true, added, beat: { file, ...beat } })
  }

  // --- DISMISS A SUGGESTION (never re-suggested) ---
  if (body.dismiss && typeof body.dismiss === 'object') {
    const file = String(body.dismiss.beat_file || '')
    if (!FILE_RE.test(file)) return bad('bad beat_file', 'validate')
    if (!fs.existsSync(beatPath(file))) return bad('unknown beat', 'validate', 404)
    const channel_id = String(body.dismiss.channel_id || '').trim()
    if (!CHANNEL_ID_RE.test(channel_id)) return bad('dismiss needs a real channel_id (UC + 22 chars)', 'validate')
    const beatId = beatIdOf(file)
    const name = String(body.dismiss.channel_name || '').trim().slice(0, 120) || channel_id
    try {
      const dismissed = dismissChannel(beatId, channel_id)
      appendLog({ kind: 'scout', stage: 'dismiss', ok: true, beat: beatId, ref: 'youtube:' + channel_id, summary: `dismissed ${name} (${dismissed.length} on the never-again list)`, meta: { channel_id, channel_name: name } })
      return NextResponse.json({ ok: true, beat_file: file, channel_id, dismissed })
    } catch (e: any) {
      const error = String(e?.message || e).slice(0, 160)
      appendLog({ kind: 'scout', stage: 'dismiss', ok: false, beat: beatId, ref: 'youtube:' + channel_id, summary: `dismiss failed · ${name}`, error })
      return bad('dismiss failed: ' + error, 'save', 500, true)
    }
  }

  // --- RESOLVE A NAME ---
  if (body.resolve !== undefined) {
    const name = String(body.resolve || '').trim()
    if (name.length < 2 || name.length > 120) return bad('resolve needs a name (2..120 chars)', 'validate')
    try { return NextResponse.json({ ok: true, name, channel: await resolveChannel(name) }) }
    catch (e: any) { return bad('resolve failed: ' + String(e?.message || e).slice(0, 160), 'resolve', 502, true) }
  }

  // --- EXPLORE: the beat's own topics, channels it has never used ---
  if (body.explore === true || body.explore === 'true') {
    const loaded = loadBeatOr(String(body.beat_file || ''))
    if ('res' in loaded) return loaded.res
    const { beat, file } = loaded
    const hp = parseHours(body.hours, EXPLORE_DEFAULT_HOURS)
    if ('error' in hp) return bad(hp.error, 'validate')
    const beatId: string = beat.id || beatIdOf(file)
    const t = logTimer()
    try {
      const r = await exploreBeat(beat, beatId, { hours: hp.hours })
      const names = r.explored.flatMap(e => e.suggested.map(s => s.channel_name))
      t.done({ kind: 'scout', stage: 'explore', ok: true, beat: beatId, ref: `${r.topics.length} topics`, summary: `explored ${r.topics.length} topics · ${r.hours}h · ${r.suggested_total} suggested (${r.seen_added} new on the seen list)`, meta: { hours: r.hours, topics: r.topics.map(x => x.topic), suggested: names, suggested_count: r.suggested_total } })
      return NextResponse.json({ ok: true, beat_file: file, explore: true, ...r, generated_at: new Date().toISOString() })
    } catch (e: any) {
      const error = String(e?.message || e).slice(0, 160)
      t.done({ kind: 'scout', stage: 'explore', ok: false, beat: beatId, summary: `explore failed · ${hp.hours}h`, error, meta: { hours: hp.hours } })
      return bad('explore failed: ' + error, 'explore', 502, true)
    }
  }

  // --- SCOUT A TOPIC ---
  const topic = String(body.topic || '').trim()
  if (topic.length < 2 || topic.length > 200) return bad('topic must be 2..200 chars', 'validate')
  const hp = parseHours(body.hours, 48)
  if ('error' in hp) return bad(hp.error, 'validate')
  const hours = hp.hours
  let beat: any = null
  const beat_file = body.beat_file ? String(body.beat_file) : null
  if (beat_file) {
    const loaded = loadBeatOr(beat_file)
    if ('res' in loaded) {
      if (loaded.res.status === 500) appendLog({ kind: 'scout', stage: 'load', ok: false, beat: beatIdOf(beat_file), ref: topic, summary: `scout · beat ${beat_file} unreadable`, error: 'beat unreadable' })
      return loaded.res
    }
    beat = loaded.beat
  }
  // Robert, 2026-09-02: the scout SUGGESTS and a human verifies. Auto-add only when asked for by name.
  const auto = !!beat && (body.auto === true || body.auto === 'true' || body.auto === 1)
  const beatId: string | null = beat?.id || (beat_file ? beatIdOf(beat_file) : null)
  const t = logTimer()
  let result: Awaited<ReturnType<typeof scoutTopic>>
  try { result = await scoutTopic(topic, { hours, beat }) }
  catch (e: any) {
    const error = String(e?.message || e).slice(0, 160)
    t.done({ kind: 'scout', stage: 'scout', ok: false, beat: beatId, ref: topic, summary: `scout failed · "${topic}" · ${hours}h`, error, meta: { hours, auto } })
    return bad('scout failed: ' + error, 'scout', 502, true)
  }
  const candidates = `${result.youtube.length} yt / ${result.x.length} x candidates`
  const terms = excludedTerms(loadConfig())
  const dismissed = new Set<string>(beatId ? readDismissed(beatId) : [])
  // every channel that clears the bar, minus the ones a human already said no to
  let suggested: Suggestion[] = suggestionsFrom(result, { terms, exclude: dismissed })

  // --- AUTO-ADD (YouTube only, opt-in): the suggestions go straight into the beat ---
  let auto_added: { channel_name: string; channel_id: string; in_window: number; reason: string }[] = []
  if (auto && suggested.length) {
    const today = new Date().toISOString().slice(0, 10)
    const label = topic.slice(0, 80)
    for (const c of result.youtube) {
      if (!clearsBar(c, terms) || dismissed.has(c.channel_id)) continue
      const status = `RESOLVED ${today} (scout auto: ${c.in_window} vids on "${label}")`
      if (pushYoutubeRow(beat, { channel_id: c.channel_id, channel_name: c.channel_name, subscribers: c.handle }, status)) {
        auto_added.push({ channel_name: c.channel_name, channel_id: c.channel_id, in_window: c.in_window, reason: `auto-added: ${c.in_window} videos on "${topic}" in ${hours}h` })
      }
    }
    if (auto_added.length) {
      const err = saveBeatFile(beat_file as string, beat)
      if (err) {
        // the scout itself worked: hand it back with the miss in warnings[] (this file's contract), not a 500;
        // the picks stay in suggested[] so a human can still ADD them one by one
        result.warnings.push(`auto-add: save failed, nothing added (${err})`)
        t.done({ kind: 'scout', stage: 'save', ok: false, beat: beatId, ref: topic, summary: `${candidates} · ${suggested.length} suggested · auto-add save failed (${auto_added.length} picked)`, error: err, meta: { hours, auto, suggested: suggested.map(s => s.channel_name), auto_added: auto_added.map(a => a.channel_name) } })
        auto_added = []
        return NextResponse.json({ ok: true, beat_file, ...result, auto, auto_added, suggested, min_in_window: SUGGEST_MIN_IN_WINDOW })
      }
      // the response describes the beat as it now is: an auto-added channel IS in the beat, not a suggestion
      const ids = new Set(auto_added.map(a => a.channel_id))
      for (const c of result.youtube) if (c.channel_id && ids.has(c.channel_id)) c.already_in_beat = true
      suggested = suggested.filter(s => !ids.has(s.channel_id))
    }
  }
  t.done({ kind: 'scout', stage: 'scout', ok: true, beat: beatId, ref: topic, summary: `${candidates} · ${suggested.length} suggested · auto-added ${auto_added.length}`, meta: { hours, auto, suggested: suggested.map(s => s.channel_name), auto_added: auto_added.map(a => a.channel_name), dismissed_skipped: result.youtube.filter(c => c.channel_id && dismissed.has(c.channel_id)).length } })
  return NextResponse.json({ ok: true, beat_file, ...result, auto, auto_added, suggested, min_in_window: SUGGEST_MIN_IN_WINDOW })
}
