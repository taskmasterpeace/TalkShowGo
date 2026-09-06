// THE JANITOR — the ecosystem's maintenance crew. Robert, 2026-09-02: "We wanna make it have its own janitor
// system almost, because every position should be making multiple decisions. We're trying to design a type of
// ecosystem. I'm giving you permission to just make decisions, but I need you to describe to me how things work."
//
// Five POSITIONS, each a decision-maker over the beat's evidence (its last pulls, its source rows, its run files).
// A position returns FINDINGS (what it saw, in plain words) and PROPOSALS (what it wants to do). A proposal is
// either auto (safe and reversible: the janitor does it on the spot) or pending (a human APPLIES or DISMISSES it
// on /command/janitor). Nothing is ever deleted: retired sources move to sources.retired, pruned run files move
// to lab/runs/_pruned/, a rotated log keeps its old file. Every decision is one line in the activity log.
//
//   source_auditor  per source, from the last pulls: healthy | quiet_7d | dead_30d | broken_id.
//                   broken_id (a YouTube id Innertube cannot open) -> repair_id, AUTO (re-resolve by name).
//                   dead_30d, or an X handle marked NOT FOUND -> retire_source, PENDING (a human confirms).
//   squatter_watch  an X row whose follower count or display name says "this is not who the label says" ->
//                   flag_suspect, AUTO: status becomes "SUSPECT <date>: <reason>" and the pull skips it.
//   scout_explore   runs the scout's EXPLORE mode over the beat's own topics -> add_channel, PENDING per hit.
//   window_tuner    three thin pulls in a row (avg < 5 items) -> widen_window to the next step, PENDING.
//   housekeeper     prune_runs (run files > 14d old that no show references -> lab/runs/_pruned/) and
//                   rotate_log (activity.jsonl > 20MB -> activity_<date>.jsonl), both AUTO.
//
// A run writes lab/janitor/<beat>/<ts>.json. Pending add_channel proposals carry forward run to run (explore
// never repeats a channel), a dismissed (action, target) stays dismissed on later runs (a human's no sticks), and
// a re-proposed (action, target) keeps its id, so the DESK count never inflates from re-running.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { appendLog, LOG_FILE } from './log'
import type { LogKind } from './log'
import { resolveChannel } from './scout'
import {
  loadBeatFile, saveBeatFile, pushYoutubeRow, exploreBeat, dismissChannel, EXPLORE_DEFAULT_HOURS,
} from './scout-review'

const ROOT = process.cwd()
const RUNS = path.join(ROOT, 'lab', 'runs')
const PRUNED = path.join(RUNS, '_pruned')
const SHOWS = path.join(ROOT, 'lab', 'shows')
const JANITOR_DIR = path.join(ROOT, 'lab', 'janitor')
const BEAT_ID_RE = /^[a-z0-9-]+$/
const H = 3600e3, D = 24 * H
export const QUIET_AFTER_MS = 7 * D
export const DEAD_AFTER_MS = 30 * D
export const SQUATTER_MAX_FOLLOWERS = 100      // fewer than this on a league/media row = not the outlet
export const SQUATTER_TRUST_FOLLOWERS = 10000  // a name mismatch on an account this big is a rename, not a squat
export const WINDOW_STEPS = [24, 48, 72, 168]
export const THIN_PULL_ITEMS = 5
export const TUNER_PULLS = 3
export const PRUNE_AFTER_DAYS = 14
export const LOG_ROTATE_BYTES = 20 * 1024 * 1024
const PULLS_FOR_HEALTH = 5     // the spec's window for health calls
const PULLS_MEMORY = 30        // older pulls only lend a last-item date and a longer provable silence
const KIND: LogKind = 'janitor'

export type JanitorAction = 'flag_suspect' | 'retire_source' | 'repair_id' | 'add_channel' | 'widen_window' | 'prune_runs' | 'rotate_log'
export type ProposalStatus = 'pending' | 'applied' | 'dismissed' | 'failed'
export type Proposal = { id: string; action: JanitorAction; target: string; reason: string; auto: boolean; status: ProposalStatus; meta?: Record<string, any>; decided_at?: string; result?: string; carried?: boolean }
export type PositionName = 'source_auditor' | 'squatter_watch' | 'scout_explore' | 'window_tuner' | 'housekeeper'
export const POSITION_NAMES: PositionName[] = ['source_auditor', 'squatter_watch', 'scout_explore', 'window_tuner', 'housekeeper']
export type PositionReport = { position: PositionName; findings: string[]; proposals: Proposal[]; ms: number; error?: string }
export type Summary = { findings: number; proposals: number; applied: number; pending: number; dismissed: number; failed: number }
export type JanitorReport = { beat: string; ran_at: string; ms: number; positions: PositionReport[]; summary: Summary; pulls_read: string[]; file?: string }
export type Ctx = { beatId: string; file: string; now: number; today: string; pulls: any[]; pullFiles: string[] }
type PositionResult = { findings: string[]; proposals: Proposal[] }
type Position = (beat: any, ctx: Ctx) => PositionResult | Promise<PositionResult>
export type SourceHealth = 'healthy' | 'quiet_7d' | 'dead_30d' | 'broken_id'
export type SourceEvidence = { last_item_ms: number | null; evidence_from_ms: number | null; latest_error: string | null; empties_in_row: number; pulls: number; rung?: string | null }

const arr = (v: any): any[] => Array.isArray(v) ? v : []
const lc = (s: any) => String(s ?? '').trim().toLowerCase()
const msg = (e: any) => String(e?.message || e).slice(0, 160)
const newId = () => 'jp_' + crypto.randomBytes(4).readUInt32BE(0).toString(36).padStart(6, '0').slice(-6)
const mk = (action: JanitorAction, target: string, reason: string, auto: boolean, meta?: Record<string, any>): Proposal => ({ id: newId(), action, target, reason, auto, status: 'pending', ...(meta ? { meta } : {}) })
const fmtAge = (ms: number) => ms < H ? `${Math.max(1, Math.round(ms / 60e3))}m` : ms < 2 * D ? `${Math.round(ms / H)}h` : `${(ms / D).toFixed(ms < 10 * D ? 1 : 0)}d`
const fmtBytes = (n: number) => n > 1e6 ? (n / 1e6).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB'
const statusDate = (s: any) => (String(s || '').match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null

// ===============================================================================================================
// PURE DECISIONS (checked by tests/janitor.check.ts)
// ===============================================================================================================

/** The pull writes "channel gone (...)" when Innertube cannot open a channel id; that is the broken-id marker. */
export function isGoneError(text: unknown): boolean {
  const s = String(text ?? '')
  return !!s && /channel gone|does not exist|not found/i.test(s)
}

/** healthy | quiet_7d | dead_30d | broken_id. Silence is measured from the newest item we ever saw; with no item
 *  at all it is measured from the oldest instant our pulls covered (the honest floor: we can only prove silence we
 *  looked at), and with no pulls at all there is nothing to judge, so: healthy. */
export function classifySource(ev: SourceEvidence, now: number): SourceHealth {
  if (isGoneError(ev.latest_error)) return 'broken_id'
  const silence = ev.last_item_ms != null ? now - ev.last_item_ms : ev.evidence_from_ms != null ? now - ev.evidence_from_ms : 0
  if (silence >= DEAD_AFTER_MS) return 'dead_30d'
  if (silence >= QUIET_AFTER_MS) return 'quiet_7d'
  return 'healthy'
}

/** Evidence for one source across pull reports (newest first): newest item date, the earliest instant the pulls
 *  covered, the latest pull's error, consecutive empty pulls from the newest back, and the rung that answered. */
export function sourceEvidence(pulls: any[], kind: 'twitter' | 'youtube', key: string): SourceEvidence {
  const k = lc(key)
  let last: number | null = null, from: number | null = null, latest_error: string | null = null, rung: string | null = null
  let empties = 0, counting = true, n = 0
  for (const p of arr(pulls)) {
    const e = arr(p?.[kind]).find((x: any) => kind === 'twitter' ? lc(x?.handle) === k : String(x?.channel_id || '') === key)
    if (!e) continue   // the pull skipped this source: no evidence either way
    n++
    const pulledAt = Date.parse(String(p?.pulled_at || ''))
    if (Number.isFinite(pulledAt)) { const f = pulledAt - (Number(p?.timespan_hours) || 24) * H; if (from == null || f < from) from = f }
    if (n === 1) latest_error = e.error ? String(e.error) : null
    if (rung == null && e.via) rung = String(e.via).split(' ')[0]
    const stamps: number[] = (kind === 'twitter' ? arr(e.top).map((t: any) => Date.parse(String(t?.created || ''))) : arr(e.videos).map((v: any) => Date.parse(String(v?.published || '')))).filter(Number.isFinite)
    for (const s of stamps) if (last == null || s > last) last = s
    const empty = !!e.error || !(Number(e.in_window) > 0)
    if (counting) { if (empty) empties++; else counting = false }
  }
  return { last_item_ms: last, evidence_from_ms: from, latest_error, empties_in_row: empties, pulls: n, rung }
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'at', 'for', 'by', 'with', 'ent', 'entertainment', 'official', 'tv', 'llc', 'inc', 'com'])
const words = (s: any) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !STOP.has(w))
const compact = (s: any) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
/** Two names share a word (case, punctuation and stopwords aside), or one compacted name contains the other. */
export function sharesWord(a: string, b: string): boolean {
  const wa = new Set(words(a))
  if (words(b).some(w => wa.has(w))) return true
  const ca = compact(a), cb = compact(b)
  return ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))
}
/** A label word living inside a handle counts too: Aye Verb posts as VEEZY at @islandgodverb. */
const nameLinks = (name: string, label: string) => sharesWord(name, label) || words(label).some(w => w.length >= 3 && compact(name).includes(w)) || words(name).some(w => w.length >= 3 && compact(label).includes(w))

/** Is this verified X row a squatter? flag = act (status SUSPECT); note = worth a human eyeball, no action. */
export function squatterVerdict(src: any): { flag: boolean; reason: string | null; note: string | null } {
  const none = { flag: false, reason: null, note: null }
  if (!String(src?.status || '').startsWith('VERIFIED')) return none
  const followers = src?.followers != null && Number.isFinite(+src.followers) ? +src.followers : null
  const type = lc(src?.type), label = String(src?.label || '').trim(), display = String(src?.display_name || '').trim(), handle = String(src?.handle || '').trim()
  const reasons: string[] = []
  if (followers != null && followers < SQUATTER_MAX_FOLLOWERS && (type === 'league' || type === 'media')) reasons.push(`${followers} followers (label says ${type}${label ? `: ${label}` : ''})`)
  if (display && label && !nameLinks(display, label) && !nameLinks(handle, label)) {
    const mismatch = `display name "${display}" shares no word with the label "${label}"`
    if (followers != null && followers >= SQUATTER_TRUST_FOLLOWERS) return { flag: false, reason: null, note: `${mismatch} but ${followers.toLocaleString()} followers - a rename, not a squat; eyeball it` }
    reasons.push(mismatch)
  }
  return reasons.length ? { flag: true, reason: reasons.join('; '), note: null } : none
}

/** The next window step above the current one (24 -> 48 -> 72 -> 168); null at the top. */
export function nextWindow(hours: number): number | null {
  const n = Number(hours)
  if (!Number.isFinite(n)) return WINDOW_STEPS[0]
  return WINDOW_STEPS.find(s => s > n) ?? null
}
/** Last 3 pulls (newest first) averaging under 5 items = thin -> widen to the next step (null when at the max). */
export function windowVerdict(pulls: any[], currentHours: number): { avg: number | null; widen_to: number | null; pulls: number; thin: boolean; at_max: boolean } {
  const last = arr(pulls).slice(0, TUNER_PULLS)
  const sums = last.map(p => (Number(p?.totals?.tweets) || 0) + (Number(p?.totals?.videos) || 0))
  const avg = sums.length ? Math.round((sums.reduce((a, b) => a + b, 0) / sums.length) * 10) / 10 : null
  const thin = last.length >= TUNER_PULLS && avg != null && avg < THIN_PULL_ITEMS
  const next = nextWindow(currentHours)
  return { avg, widen_to: thin && next != null ? next : null, pulls: last.length, thin, at_max: thin && next == null }
}

/** Run files to prune: this beat's, older than maxAgeDays, not referenced by any show, never the newest of its
 *  kind (pull_/clusters_/leads_/...) because the DESK and DATAFLOW read that one. */
export function pruneCandidates(files: { name: string; mtimeMs: number; beat: string | null }[], opts: { beatId: string; referenced: Set<string>; now: number; maxAgeDays?: number }): string[] {
  const maxAge = (opts.maxAgeDays ?? PRUNE_AFTER_DAYS) * D
  const kindOf = (name: string) => name.split('_')[0]
  const mine = files.filter(f => f.beat === opts.beatId && /\.json$/i.test(f.name))
  const newest = new Map<string, string>()
  for (const f of mine) { const k = kindOf(f.name); const cur = newest.get(k); if (!cur || f.name > cur) newest.set(k, f.name) }
  return mine
    .filter(f => opts.now - f.mtimeMs >= maxAge && !opts.referenced.has(f.name) && newest.get(kindOf(f.name)) !== f.name)
    .map(f => f.name).sort()
}

// ===============================================================================================================
// EVIDENCE: the beat's pull reports (newest first). A pull file carries its beat as a name suffix (new) or as a
// `beat` field (older unsuffixed files).
// ===============================================================================================================
function pullsFor(beatId: string, max = PULLS_MEMORY): { pulls: any[]; files: string[] } {
  const pulls: any[] = [], files: string[] = []
  let names: string[] = []
  try { names = fs.readdirSync(RUNS).filter(f => f.startsWith('pull_') && f.endsWith('.json')).sort().reverse() } catch { return { pulls, files } }
  for (const f of names) {
    if (pulls.length >= max) break
    const suffixed = /^pull_\d{4}-\d{2}-\d{2}T[\d-]+_/.test(f)
    if (suffixed && !f.endsWith(`_${beatId}.json`)) continue
    let j: any
    try { j = JSON.parse(fs.readFileSync(path.join(RUNS, f), 'utf8')) } catch { continue }
    if (!suffixed && j?.beat !== beatId) continue
    pulls.push(j); files.push(f)
  }
  return { pulls, files }
}

function describe(ev: SourceEvidence, now: number): string {
  const parts: string[] = []
  if (ev.last_item_ms != null) parts.push(`last item ${fmtAge(now - ev.last_item_ms)} ago`)
  else if (ev.evidence_from_ms != null) parts.push(`no items in ${ev.pulls} pull${ev.pulls === 1 ? '' : 's'} (silent for at least ${fmtAge(now - ev.evidence_from_ms)}, the span we looked at)`)
  if (ev.last_item_ms != null && ev.empties_in_row >= 2) parts.push(`${ev.empties_in_row} empty pulls in a row`)
  return parts.join(', ')
}
/** Health from the last 5 pulls; older pulls (up to 30) only lend a last-item date and a longer provable silence. */
function evidenceFor(ctx: Ctx, kind: 'twitter' | 'youtube', key: string): SourceEvidence {
  const ev = sourceEvidence(ctx.pulls.slice(0, PULLS_FOR_HEALTH), kind, key)
  const older = ctx.pulls.slice(PULLS_FOR_HEALTH)
  if (older.length) {
    const old = sourceEvidence(older, kind, key)
    if (ev.last_item_ms == null && old.last_item_ms != null) ev.last_item_ms = old.last_item_ms
    if (old.evidence_from_ms != null && (ev.evidence_from_ms == null || old.evidence_from_ms < ev.evidence_from_ms)) ev.evidence_from_ms = old.evidence_from_ms
    if (ev.pulls === 0) ev.pulls = old.pulls
  }
  return ev
}

// ===============================================================================================================
// THE POSITIONS
// ===============================================================================================================
const source_auditor: Position = (beat, ctx) => {
  const findings: string[] = [], proposals: Proposal[] = []
  const latest = ctx.pulls[0]
  const nPulls = Math.min(ctx.pulls.length, PULLS_FOR_HEALTH)
  if (!ctx.pulls.length) { findings.push('no pull reports for this beat yet - run PULL on the DESK, then the auditor has evidence'); }
  if (latest?.twitter_error) findings.push(`X sweep skipped on the latest pull: ${latest.twitter_error}`)
  const twEntries = arr(latest?.twitter)
  const twAllErr = twEntries.length > 0 && twEntries.every((e: any) => e?.error)
  if (twAllErr) findings.push(`every X source errored on the latest pull (${twEntries[0].error}) - a key or plan problem, not a source problem`)
  if (latest?.youtube_error) findings.push(`YouTube sweep failed on the latest pull: ${latest.youtube_error}`)

  const tw = { healthy: 0, quiet_7d: 0, dead_30d: 0, broken_id: 0, not_found: 0, suspect: 0, unverified: 0, unseen: 0 }
  for (const s of arr(beat?.sources?.twitter)) {
    const handle = String(s?.handle || '').trim(); if (!handle) continue
    const st = String(s?.status || '')
    if (st.startsWith('NOT FOUND')) {
      tw.not_found++
      findings.push(`@${handle} on X: NOT FOUND since ${statusDate(st) || '?'} - a dead handle cannot be pulled`)
      proposals.push(mk('retire_source', `twitter:${handle}`, `NOT FOUND since ${statusDate(st) || '?'}: needs a human to find the current handle; retire the row until then`, false, { platform: 'twitter', handle, label: s.label || null }))
      continue
    }
    if (st.startsWith('SUSPECT')) { tw.suspect++; findings.push(`@${handle} on X: ${st.slice(0, 90)} - skipped by the pull until a human clears it`); continue }
    if (!s.userId) { tw.unverified++; continue }
    const ev = evidenceFor(ctx, 'twitter', handle)
    if (ev.pulls === 0) { tw.unseen++; if (ctx.pulls.length && !latest?.twitter_error) findings.push(`@${handle} on X: in none of the last ${nPulls} pulls`); continue }
    const health = classifySource(ev, ctx.now)
    tw[health]++
    const desc = describe(ev, ctx.now)
    if (health === 'dead_30d') {
      findings.push(`@${handle} on X: ${desc} - DEAD`)
      proposals.push(mk('retire_source', `twitter:${handle}`, `dead: ${desc}`, false, { platform: 'twitter', handle, label: s.label || null }))
    } else if (health === 'quiet_7d') findings.push(`@${handle} on X: ${desc} - quiet`)
    else if (ev.latest_error && !twAllErr) findings.push(`@${handle} on X: errored on the latest pull (${ev.latest_error}); ${desc || 'no items on record'}`)
    else if (ev.empties_in_row >= 3) findings.push(`@${handle} on X: ${desc} - healthy on paper, watch it`)
  }

  const yt = { healthy: 0, quiet_7d: 0, dead_30d: 0, broken_id: 0, unresolved: 0, unseen: 0 }
  const rungs: Record<string, number> = {}
  for (const c of arr(beat?.sources?.youtube)) {
    const id = String(c?.channel_id || '').trim()
    const name = String(c?.resolved_title || c?.channel_name || id)
    if (!id) { yt.unresolved++; continue }
    const ev = evidenceFor(ctx, 'youtube', id)
    if (ev.pulls === 0) { yt.unseen++; if (ctx.pulls.length && !latest?.youtube_error) findings.push(`${name} on YouTube: in none of the last ${nPulls} pulls`); continue }
    if (ev.rung) rungs[ev.rung] = (rungs[ev.rung] || 0) + 1
    const health = classifySource(ev, ctx.now)
    yt[health]++
    const desc = describe(ev, ctx.now)
    if (health === 'broken_id') {
      findings.push(`${name} on YouTube: Innertube cannot open ${id} (${String(ev.latest_error).slice(0, 100)}) - BROKEN ID`)
      proposals.push(mk('repair_id', `youtube:${id}`, `Innertube cannot open ${id}: re-resolve "${c.channel_name || name}" by name and fix the beat`, true, { channel_id: id, channel_name: c.channel_name || null, resolved_title: c.resolved_title || null }))
    } else if (health === 'dead_30d') {
      findings.push(`${name} on YouTube: ${desc} - DEAD`)
      proposals.push(mk('retire_source', `youtube:${id}`, `dead: ${desc}`, false, { platform: 'youtube', channel_id: id, channel_name: c.channel_name || name }))
    } else if (health === 'quiet_7d') findings.push(`${name} on YouTube: ${desc} - quiet`)
    else if (ev.latest_error) findings.push(`${name} on YouTube: errored on the latest pull (${ev.latest_error.slice(0, 100)}); ${desc || 'no items on record'}`)
    else if (ev.rung === 'yt-dlp' || ev.rung === 'innertube-search') findings.push(`${name} on YouTube: answered by the last rung (${ev.rung}) - RSS and the Videos tab both failed; ${desc}`)
    else if (ev.empties_in_row >= 3) findings.push(`${name} on YouTube: ${desc} - healthy on paper, watch it`)
  }
  const rungLine = Object.entries(rungs).map(([k, n]) => `${n} via ${k}`).join(', ')
  findings.unshift(
    `X: ${tw.healthy} healthy, ${tw.quiet_7d} quiet, ${tw.dead_30d} dead, ${tw.not_found} NOT FOUND, ${tw.suspect} SUSPECT${tw.unverified ? `, ${tw.unverified} unverified` : ''}${tw.unseen ? `, ${tw.unseen} never pulled` : ''} · YouTube: ${yt.healthy} healthy, ${yt.quiet_7d} quiet, ${yt.dead_30d} dead, ${yt.broken_id} broken${yt.unresolved ? `, ${yt.unresolved} unresolved` : ''}${yt.unseen ? `, ${yt.unseen} never pulled` : ''}${rungLine ? ` (${rungLine})` : ''} · evidence: ${nPulls} pull${nPulls === 1 ? '' : 's'}`,
  )
  return { findings, proposals }
}

const squatter_watch: Position = (beat) => {
  const findings: string[] = [], proposals: Proposal[] = []
  let checked = 0
  for (const s of arr(beat?.sources?.twitter)) {
    const handle = String(s?.handle || '').trim(); if (!handle) continue
    if (String(s?.status || '').startsWith('VERIFIED')) checked++
    const v = squatterVerdict(s)
    if (v.note) findings.push(`@${handle} on X: ${v.note}`)
    if (v.flag) {
      findings.push(`@${handle} on X: ${v.reason} - SUSPECT squatter`)
      proposals.push(mk('flag_suspect', `twitter:${handle}`, v.reason as string, true, { handle, label: s.label || null, type: s.type || null, followers: s.followers ?? null, display_name: s.display_name || null }))
    }
  }
  if (!proposals.length) findings.push(`${checked} verified X row${checked === 1 ? '' : 's'} checked: names match their labels, follower counts fit their types`)
  return { findings, proposals }
}

const scout_explore: Position = async (beat, ctx) => {
  const findings: string[] = [], proposals: Proposal[] = []
  const r = await exploreBeat(beat, ctx.beatId, { hours: EXPLORE_DEFAULT_HOURS })
  if (!r.topics.length) { findings.push('nothing to explore yet: the beat has no cases, no show name and no story clusters'); return { findings, proposals } }
  findings.push(`explored ${r.topics.length} topic${r.topics.length === 1 ? '' : 's'} over ${r.hours}h: ${r.topics.map(t => `"${t.topic}"`).join(', ')} - ${r.suggested_total} new channel${r.suggested_total === 1 ? '' : 's'} cleared the bar (3+ videos, not in the beat, never surfaced before)`)
  for (const e of r.explored) {
    if (e.warnings.length) findings.push(`"${e.topic}": ${e.warnings.join('; ').slice(0, 160)}`)
    for (const s of e.suggested) proposals.push(mk('add_channel', `youtube:${s.channel_id}`, s.reason, false, { channel_id: s.channel_id, channel_name: s.channel_name, handle: s.handle, url: s.url, topic: s.topic, from: e.from, latest_title: s.latest_title, latest_url: s.latest_url, in_window: s.in_window }))
  }
  return { findings, proposals }
}

const window_tuner: Position = (beat, ctx) => {
  const findings: string[] = [], proposals: Proposal[] = []
  const current = Number(beat?.show?.timespan_hours) || 24
  const v = windowVerdict(ctx.pulls, current)
  const wins = ctx.pulls.slice(0, TUNER_PULLS).map(p => Number(p?.timespan_hours) || '?')
  const mixed = wins.some(w => w !== current) ? ` (pull windows: ${wins.join('/')}h)` : ''
  if (v.pulls < TUNER_PULLS) findings.push(`only ${v.pulls} pull${v.pulls === 1 ? '' : 's'} on record - it takes ${TUNER_PULLS} to judge the ${current}h window`)
  else if (v.widen_to) {
    findings.push(`last ${TUNER_PULLS} pulls averaged ${v.avg} items in a ${current}h window - thin${mixed}`)
    proposals.push(mk('widen_window', 'show.timespan_hours', `last ${TUNER_PULLS} pulls averaged ${v.avg} items (under ${THIN_PULL_ITEMS}): widen ${current}h -> ${v.widen_to}h`, false, { from: current, to: v.widen_to, avg: v.avg }))
  } else if (v.at_max) findings.push(`last ${TUNER_PULLS} pulls averaged ${v.avg} items even at the ${current}h maximum - the sources are the problem, not the window${mixed}`)
  else findings.push(`last ${TUNER_PULLS} pulls averaged ${v.avg} items in a ${current}h window - fine${mixed}`)
  return { findings, proposals }
}

const housekeeper: Position = (_beat, ctx) => {
  const findings: string[] = [], proposals: Proposal[] = []
  // run files: ownership by name suffix, else (only for files old enough to matter) by the `beat` field inside
  const files: { name: string; mtimeMs: number; beat: string | null }[] = []
  let unowned = 0
  try {
    for (const name of fs.readdirSync(RUNS)) {
      const p = path.join(RUNS, name)
      let st: fs.Stats; try { st = fs.statSync(p) } catch { continue }
      if (!st.isFile() || !name.endsWith('.json')) continue
      const m = /^[a-z_]+_\d{4}-\d{2}-\d{2}T[\d-]+_([a-z0-9-]+)\.json$/.exec(name)
      let beat: string | null = m ? m[1] : null
      if (!beat && ctx.now - st.mtimeMs >= PRUNE_AFTER_DAYS * D) { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); beat = typeof j?.beat === 'string' ? j.beat : null } catch { beat = null } }
      if (!beat && ctx.now - st.mtimeMs >= PRUNE_AFTER_DAYS * D) unowned++
      files.push({ name, mtimeMs: st.mtimeMs, beat })
    }
  } catch { findings.push('lab/runs is not readable'); }
  // a run file a show's status.json mentions is part of that show's record
  const statusTexts: string[] = []
  try { for (const d of fs.readdirSync(SHOWS)) { try { statusTexts.push(fs.readFileSync(path.join(SHOWS, d, 'status.json'), 'utf8')) } catch { /* not a show dir */ } } } catch { /* no shows yet */ }
  const referenced = new Set(files.filter(f => statusTexts.some(t => t.includes(f.name))).map(f => f.name))
  const mine = files.filter(f => f.beat === ctx.beatId)
  const old = mine.filter(f => ctx.now - f.mtimeMs >= PRUNE_AFTER_DAYS * D)
  const names = pruneCandidates(files, { beatId: ctx.beatId, referenced, now: ctx.now })
  findings.push(`${mine.length} run file${mine.length === 1 ? '' : 's'} for ${ctx.beatId}: ${old.length} older than ${PRUNE_AFTER_DAYS}d, ${referenced.size} referenced by shows, ${names.length} to prune${unowned ? ` · ${unowned} old unowned file${unowned === 1 ? '' : 's'} left alone` : ''}`)
  if (names.length) proposals.push(mk('prune_runs', 'lab/runs', `${names.length} run file${names.length === 1 ? '' : 's'} older than ${PRUNE_AFTER_DAYS} days that no show references -> lab/runs/_pruned/ (moved, not deleted)`, true, { files: names.slice(0, 60), count: names.length }))
  // the activity log
  let size = 0
  try { size = fs.statSync(LOG_FILE).size } catch { size = 0 }
  if (size > LOG_ROTATE_BYTES) proposals.push(mk('rotate_log', 'lab/logs/activity.jsonl', `${fmtBytes(size)} is over ${fmtBytes(LOG_ROTATE_BYTES)}: rename it with today's date and start a fresh log`, true, { bytes: size }))
  else findings.push(`activity log ${fmtBytes(size)} (rotates at ${fmtBytes(LOG_ROTATE_BYTES)})`)
  return { findings, proposals }
}

const POSITIONS: [PositionName, Position][] = [
  ['source_auditor', source_auditor], ['squatter_watch', squatter_watch], ['scout_explore', scout_explore], ['window_tuner', window_tuner], ['housekeeper', housekeeper],
]

// ===============================================================================================================
// EXECUTION: every write re-reads the beat first and patches only its own row (the pull, the scout and a human on
// the SOURCES page all write the same file within seconds of each other).
// ===============================================================================================================
function patchBeat(file: string, fn: (beat: any) => string): string {
  const beat = loadBeatFile(file)
  if (!beat) throw new Error('beat unreadable')
  const result = fn(beat)
  const err = saveBeatFile(file, beat)
  if (err) throw new Error('save failed: ' + err)
  return result
}
const splitTarget = (target: string) => { const i = target.indexOf(':'); return i < 0 ? { platform: target, key: '' } : { platform: target.slice(0, i), key: target.slice(i + 1) } }
const findTwitter = (beat: any, handle: string) => arr(beat?.sources?.twitter).find((s: any) => lc(s?.handle) === lc(handle))
const findYoutube = (beat: any, id: string) => arr(beat?.sources?.youtube).find((c: any) => String(c?.channel_id || '') === id)

async function execute(beatId: string, file: string, p: Proposal, today: string): Promise<string> {
  const { platform, key } = splitTarget(p.target)
  switch (p.action) {
    case 'flag_suspect':
      return patchBeat(file, beat => {
        const row = findTwitter(beat, key)
        if (!row) throw new Error(`@${key} is no longer in the beat`)
        if (String(row.status || '').startsWith('SUSPECT')) return 'already SUSPECT'
        row.status = `SUSPECT ${today}: ${p.reason}`
        return `status -> "SUSPECT ${today}: ${p.reason}" (the pull skips it until a human clears it)`
      })
    case 'retire_source':
      return patchBeat(file, beat => {
        const list: any[] = platform === 'twitter' ? arr(beat?.sources?.twitter) : arr(beat?.sources?.youtube)
        const i = list.findIndex((s: any) => platform === 'twitter' ? lc(s?.handle) === lc(key) : String(s?.channel_id || '') === key)
        if (i < 0) throw new Error(`${p.target} is no longer in the beat`)
        const [row] = list.splice(i, 1)
        if (!Array.isArray(beat.sources.retired)) beat.sources.retired = []
        beat.sources.retired.push({ ...row, platform, retired_at: new Date().toISOString(), retired_by: 'janitor', retired_reason: p.reason })
        return `moved to sources.retired (${beat.sources.retired.length} retired rows on file; nothing deleted)`
      })
    case 'repair_id': {
      const name = String(p.meta?.channel_name || p.meta?.resolved_title || '').trim()
      if (!name) throw new Error('no channel name to re-resolve by')
      const r = await resolveChannel(name)
      if (!r) throw new Error(`no YouTube channel matches "${name}" - a human has to find it`)
      if (r.suspect) throw new Error(`resolver is unsure: "${r.title}" has ${r.subscribers || 'few'} subscribers - eyeball it`)
      if (r.channel_id === key) throw new Error('resolver returns the same id - YouTube may be throttling; leave it')
      return patchBeat(file, beat => {
        const row = findYoutube(beat, key)
        if (!row) throw new Error(`${key} is no longer in the beat`)
        row.channel_id = r.channel_id; row.resolved_title = r.title; row.status = `RE-RESOLVED ${today} (janitor, was ${key})`
        return `${key} -> ${r.channel_id} ("${r.title}"${r.handle ? ` ${r.handle}` : ''})`
      })
    }
    case 'add_channel':
      return patchBeat(file, beat => {
        const id = String(p.meta?.channel_id || key)
        const channel_name = String(p.meta?.channel_name || '').trim() || id
        return pushYoutubeRow(beat, { channel_id: id, channel_name, subscribers: p.meta?.handle || null }, `RESOLVED ${today} (janitor explore: ${p.reason})`)
          ? `added ${channel_name} (${id}) to the beat's YouTube sources`
          : 'already in the beat'
      })
    case 'widen_window':
      return patchBeat(file, beat => {
        const to = Number(p.meta?.to)
        if (!WINDOW_STEPS.includes(to)) throw new Error('bad window step')
        beat.show = { ...(beat.show || {}), timespan_hours: to }
        return `show.timespan_hours ${p.meta?.from ?? '?'}h -> ${to}h`
      })
    case 'prune_runs': {
      fs.mkdirSync(PRUNED, { recursive: true })
      let moved = 0, missing = 0
      for (const name of arr(p.meta?.files)) {
        const from = path.join(RUNS, path.basename(String(name)))
        if (!fs.existsSync(from)) { missing++; continue }
        fs.renameSync(from, path.join(PRUNED, path.basename(String(name))))
        moved++
      }
      return `${moved} file${moved === 1 ? '' : 's'} moved to lab/runs/_pruned/${missing ? ` (${missing} already gone)` : ''}`
    }
    case 'rotate_log': {
      if (!fs.existsSync(LOG_FILE)) return 'no log file to rotate'
      const dir = path.dirname(LOG_FILE)
      let target = path.join(dir, `activity_${today}.jsonl`)
      for (let n = 2; fs.existsSync(target); n++) target = path.join(dir, `activity_${today}-${n}.jsonl`)
      fs.renameSync(LOG_FILE, target)
      return `rotated to ${path.basename(target)}; a fresh activity.jsonl starts with this line`
    }
    default:
      throw new Error('unknown action ' + String(p.action))
  }
}

async function decide(beatId: string, file: string, p: Proposal, position: string, today: string): Promise<void> {
  try {
    p.result = await execute(beatId, file, p, today)
    p.status = 'applied'
  } catch (e: any) {
    p.result = msg(e)
    p.status = 'failed'
  }
  p.decided_at = new Date().toISOString()
  appendLog({ kind: KIND, stage: position, ok: p.status === 'applied', beat: beatId, ref: p.id, summary: `${p.action} ${p.target} · ${p.status} · ${p.result}`, error: p.status === 'failed' ? p.result : null, meta: { action: p.action, target: p.target, auto: p.auto, reason: p.reason } })
}

function summarize(positions: PositionReport[]): Summary {
  const s: Summary = { findings: 0, proposals: 0, applied: 0, pending: 0, dismissed: 0, failed: 0 }
  for (const pos of positions) { s.findings += pos.findings.length; for (const p of pos.proposals) { s.proposals++; s[p.status]++ } }
  return s
}

// ===============================================================================================================
// REPORTS on disk: lab/janitor/<beat>/<ts>.json
// ===============================================================================================================
const reportDir = (beatId: string) => path.join(JANITOR_DIR, beatId)
function readReport(beatId: string, file: string): JanitorReport | null {
  try { const r = JSON.parse(fs.readFileSync(path.join(reportDir(beatId), file), 'utf8')); return r && Array.isArray(r.positions) ? { ...r, file } : null } catch { return null }
}
function writeReport(report: JanitorReport): void {
  const file = report.file || `${report.ran_at.replace(/[:.]/g, '-')}.json`
  fs.mkdirSync(reportDir(report.beat), { recursive: true })
  const { file: _f, ...body } = report
  fs.writeFileSync(path.join(reportDir(report.beat), file), JSON.stringify(body, null, 2) + '\n')
  report.file = file
}
export function listReports(beatId: string): { file: string; ran_at: string; ms: number; summary: Summary }[] {
  if (!BEAT_ID_RE.test(beatId)) return []
  let files: string[] = []
  try { files = fs.readdirSync(reportDir(beatId)).filter(f => f.endsWith('.json')).sort().reverse() } catch { return [] }
  return files.map(f => readReport(beatId, f)).filter((r): r is JanitorReport => !!r).map(r => ({ file: r.file as string, ran_at: r.ran_at, ms: r.ms, summary: r.summary || summarize(r.positions) }))
}
export function latestReport(beatId: string): JanitorReport | null {
  const first = listReports(beatId)[0]
  return first ? readReport(beatId, first.file) : null
}
export function getReport(beatId: string, file: string): JanitorReport | null {
  if (!BEAT_ID_RE.test(beatId) || !/^[\w-]+\.json$/.test(file)) return null
  return readReport(beatId, file)
}
/** The DESK card: per beat, what is waiting for a human (from the latest report) and when the janitor last ran. */
export function pendingAcrossBeats(): { beat: string; pending: number; failed: number; ran_at: string | null; file: string | null }[] {
  const beats = new Set<string>()
  try { for (const f of fs.readdirSync(path.join(ROOT, 'lab', 'beats'))) if (f.endsWith('.json')) beats.add(f.replace(/\.json$/, '')) } catch { /* no beats */ }
  try { for (const d of fs.readdirSync(JANITOR_DIR)) if (BEAT_ID_RE.test(d)) beats.add(d) } catch { /* never run */ }
  return Array.from(beats).sort().map(beat => {
    const r = latestReport(beat)
    return { beat, pending: r?.summary?.pending ?? 0, failed: r?.summary?.failed ?? 0, ran_at: r?.ran_at ?? null, file: r?.file ?? null }
  })
}

/** Carry the previous run's decisions forward: a re-proposed (action, target) keeps its id; a dismissed one stays
 *  dismissed; pending add_channel proposals (explore never repeats a channel) ride along until decided. */
function carryForward(prev: JanitorReport | null, positions: PositionReport[]): void {
  if (!prev) return
  const byKey = new Map<string, { p: Proposal; position: string }>()
  for (const pos of prev.positions) for (const p of pos.proposals) byKey.set(`${p.action}|${p.target}`, { p, position: pos.position })
  const reproposed = new Set<string>()
  for (const pos of positions) for (const p of pos.proposals) {
    const key = `${p.action}|${p.target}`
    const old = byKey.get(key)
    if (!old) continue
    reproposed.add(key)
    p.id = old.p.id
    if (old.p.status === 'dismissed') { p.status = 'dismissed'; p.decided_at = old.p.decided_at; p.result = `dismissed ${String(old.p.decided_at || '').slice(0, 10)} (a human's no sticks; carried forward)`; p.carried = true }
  }
  for (const [key, old] of Array.from(byKey.entries())) {
    if (reproposed.has(key) || old.p.status !== 'pending' || old.p.action !== 'add_channel') continue
    const pos = positions.find(x => x.position === old.position) || positions.find(x => x.position === 'scout_explore')
    if (pos) pos.proposals.push({ ...old.p, carried: true })
  }
}

/** RUN THE JANITOR on a beat: every position decides, auto proposals are applied, the report is written and each
 *  decision is one activity-log line. A position that throws (YouTube down, say) becomes a finding, never a crash. */
export async function runJanitor(beatId: string, opts: { apply?: 'auto' | 'none' } = {}): Promise<JanitorReport> {
  if (!BEAT_ID_RE.test(beatId)) throw new Error('bad beat id')
  const file = beatId + '.json'
  const beat = loadBeatFile(file)
  if (!beat) throw new Error('unknown or unreadable beat: ' + beatId)
  const t0 = Date.now()
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10)
  const { pulls, files } = pullsFor(beatId)
  const ctx: Ctx = { beatId, file, now, today, pulls, pullFiles: files }
  const positions: PositionReport[] = []
  for (const [name, fn] of POSITIONS) {
    const p0 = Date.now()
    try { const r = await fn(beat, ctx); positions.push({ position: name, findings: r.findings, proposals: r.proposals, ms: Date.now() - p0 }) }
    catch (e: any) { positions.push({ position: name, findings: [`position failed: ${msg(e)}`], proposals: [], ms: Date.now() - p0, error: msg(e) }) }
  }
  carryForward(latestReport(beatId), positions)
  if ((opts.apply ?? 'auto') === 'auto') {
    for (const pos of positions) for (const p of pos.proposals) if (p.auto && p.status === 'pending') await decide(beatId, file, p, pos.position, today)
  }
  const report: JanitorReport = { beat: beatId, ran_at: new Date(now).toISOString(), ms: Date.now() - t0, positions, summary: summarize(positions), pulls_read: files.slice(0, PULLS_FOR_HEALTH) }
  writeReport(report)
  const s = report.summary
  appendLog({
    kind: KIND, stage: 'run', ok: !positions.some(p => p.error), beat: beatId, ref: report.file, ms: report.ms,
    summary: `${s.findings} findings · ${s.proposals} proposals · ${s.applied} applied · ${s.pending} pending${s.failed ? ` · ${s.failed} failed` : ''}${s.dismissed ? ` · ${s.dismissed} dismissed` : ''}`,
    error: positions.filter(p => p.error).map(p => `${p.position}: ${p.error}`).join(' · ') || null,
    meta: { pulls: files.length, applied: positions.flatMap(p => p.proposals.filter(x => x.status === 'applied').map(x => `${x.action} ${x.target}`)), pending: positions.flatMap(p => p.proposals.filter(x => x.status === 'pending').map(x => `${x.action} ${x.target}`)), failed_positions: positions.filter(p => p.error).map(p => p.position) },
  })
  return report
}

function findProposal(beatId: string, proposalId: string): { report: JanitorReport; position: PositionReport; proposal: Proposal } | null {
  for (const r of listReports(beatId).slice(0, 30)) {
    const report = readReport(beatId, r.file)
    if (!report) continue
    for (const position of report.positions) { const proposal = position.proposals.find(p => p.id === proposalId); if (proposal) return { report, position, proposal } }
  }
  return null
}
/** A human said yes: run the proposal (pending or failed), update the report it lives in. */
export async function applyProposal(beatId: string, proposalId: string): Promise<{ proposal: Proposal; report: JanitorReport }> {
  if (!BEAT_ID_RE.test(beatId)) throw new Error('bad beat id')
  const hit = findProposal(beatId, String(proposalId || ''))
  if (!hit) throw new Error('unknown proposal ' + proposalId)
  const { report, position, proposal } = hit
  if (proposal.status === 'applied' || proposal.status === 'dismissed') throw new Error(`proposal is already ${proposal.status}`)
  await decide(beatId, beatId + '.json', proposal, position.position, new Date().toISOString().slice(0, 10))
  report.summary = summarize(report.positions)
  writeReport(report)
  return { proposal, report }
}
/** A human said no: mark it, and for a channel suggestion remember the no in the scout's dismissed ledger. */
export function dismissProposal(beatId: string, proposalId: string): { proposal: Proposal; report: JanitorReport } {
  if (!BEAT_ID_RE.test(beatId)) throw new Error('bad beat id')
  const hit = findProposal(beatId, String(proposalId || ''))
  if (!hit) throw new Error('unknown proposal ' + proposalId)
  const { report, position, proposal } = hit
  if (proposal.status === 'applied') throw new Error('proposal is already applied')
  proposal.status = 'dismissed'; proposal.decided_at = new Date().toISOString(); proposal.result = 'dismissed by a human'
  if (proposal.action === 'add_channel') { const id = String(proposal.meta?.channel_id || splitTarget(proposal.target).key); try { dismissChannel(beatId, id); proposal.result += ' (channel added to the scout\'s dismissed ledger: never re-suggested)' } catch { /* the ledger is best-effort */ } }
  report.summary = summarize(report.positions)
  writeReport(report)
  appendLog({ kind: KIND, stage: position.position, ok: true, beat: beatId, ref: proposal.id, summary: `${proposal.action} ${proposal.target} · dismissed by a human`, meta: { action: proposal.action, target: proposal.target, auto: proposal.auto, reason: proposal.reason } })
  return { proposal, report }
}
