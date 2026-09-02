// THE JANITOR + THE SCOUT'S REVIEW LEDGER — checks for the pure decision logic (no network, no files).
// Named *.check.ts on purpose: Playwright's default testMatch would pick up *.test.ts / *.spec.ts.
// Run from the repo root:
//   TS_NODE_PROJECT=D:/git/talkshowgo/tsconfig.json TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
//   node -r ts-node/register/transpile-only -r tsconfig-paths/register tests/janitor.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifySource, isGoneError, sharesWord, squatterVerdict, nextWindow, windowVerdict, pruneCandidates, sourceEvidence,
} from '@/lib/command/janitor'
import { exploreTopics, suggestReason, suggestionsFrom } from '@/lib/command/scout-review'

const H = 3600e3, D = 24 * H
const NOW = Date.parse('2026-09-02T18:00:00Z')

// ---------------------------------------------------------------- source auditor: classification
test('auditor: a channel Innertube cannot open is broken_id even when older items exist', () => {
  assert.equal(classifySource({ last_item_ms: NOW - 2 * D, evidence_from_ms: NOW - 5 * D, latest_error: 'rss: Status code 404 · innertube: channel gone (InnertubeError: This channel does not exist.)', empties_in_row: 1, pulls: 3 }, NOW), 'broken_id')
})
test('auditor: an item inside 7 days is healthy', () => {
  assert.equal(classifySource({ last_item_ms: NOW - 2 * D, evidence_from_ms: NOW - 20 * D, latest_error: null, empties_in_row: 0, pulls: 5 }, NOW), 'healthy')
})
test('auditor: last item 10 days ago is quiet_7d', () => {
  assert.equal(classifySource({ last_item_ms: NOW - 10 * D, evidence_from_ms: NOW - 20 * D, latest_error: null, empties_in_row: 4, pulls: 5 }, NOW), 'quiet_7d')
})
test('auditor: last item 40 days ago is dead_30d', () => {
  assert.equal(classifySource({ last_item_ms: NOW - 40 * D, evidence_from_ms: NOW - 60 * D, latest_error: null, empties_in_row: 5, pulls: 5 }, NOW), 'dead_30d')
})
test('auditor: no items but only 3 days of evidence stays healthy (silence not provable)', () => {
  assert.equal(classifySource({ last_item_ms: null, evidence_from_ms: NOW - 3 * D, latest_error: null, empties_in_row: 3, pulls: 3 }, NOW), 'healthy')
})
test('auditor: no items across 9 days of evidence is quiet_7d', () => {
  assert.equal(classifySource({ last_item_ms: null, evidence_from_ms: NOW - 9 * D, latest_error: null, empties_in_row: 5, pulls: 5 }, NOW), 'quiet_7d')
})
test('auditor: no items across 45 days of evidence is dead_30d', () => {
  assert.equal(classifySource({ last_item_ms: null, evidence_from_ms: NOW - 45 * D, latest_error: null, empties_in_row: 5, pulls: 5 }, NOW), 'dead_30d')
})
test('auditor: no pull evidence at all is healthy (nothing to judge)', () => {
  assert.equal(classifySource({ last_item_ms: null, evidence_from_ms: null, latest_error: null, empties_in_row: 0, pulls: 0 }, NOW), 'healthy')
})
test('auditor: a transport error (twitterapi 429) is not a broken id', () => {
  assert.equal(classifySource({ last_item_ms: NOW - 1 * D, evidence_from_ms: NOW - 5 * D, latest_error: 'twitterapi 429', empties_in_row: 1, pulls: 3 }, NOW), 'healthy')
})
test('auditor: isGoneError reads the pull error text', () => {
  assert.equal(isGoneError('rss: Status code 404 · innertube: channel gone (InnertubeError: not found)'), true)
  assert.equal(isGoneError('innertube: This channel does not exist'), true)
  assert.equal(isGoneError('twitterapi 429'), false)
  assert.equal(isGoneError(null), false)
})

// ---------------------------------------------------------------- source auditor: evidence from pull reports
const pullAt = (iso: string, twitter: any[] = [], youtube: any[] = [], hours = 48) => ({ beat: 'battle-rap', timespan_hours: hours, pulled_at: iso, twitter, youtube, totals: { tweets: 0, videos: 0 } })
test('auditor: evidence for an X source = newest item date, consecutive empties, evidence floor', () => {
  const pulls = [
    pullAt('2026-09-02T16:00:00Z', [{ handle: 'a', in_window: 0, top: [] }]),
    pullAt('2026-09-01T16:00:00Z', [{ handle: 'A', in_window: 2, top: [{ created: 'Tue Sep 01 10:00:00 +0000 2026' }, { created: 'Mon Aug 31 09:00:00 +0000 2026' }] }]),
    pullAt('2026-08-31T16:00:00Z', [{ handle: 'a', in_window: 1, top: [{ created: 'Sun Aug 30 09:00:00 +0000 2026' }] }]),
  ]
  const ev = sourceEvidence(pulls, 'twitter', 'a')
  assert.equal(ev.pulls, 3)
  assert.equal(ev.empties_in_row, 1)
  assert.equal(ev.last_item_ms, Date.parse('Tue Sep 01 10:00:00 +0000 2026'))
  assert.equal(ev.evidence_from_ms, Date.parse('2026-08-31T16:00:00Z') - 48 * H)
  assert.equal(ev.latest_error, null)
})
test('auditor: evidence for a YouTube channel carries the rung and the latest error', () => {
  const pulls = [
    pullAt('2026-09-02T16:00:00Z', [], [{ channel_id: 'UC1', error: 'rss: 404 · innertube: channel gone (x)' }]),
    pullAt('2026-09-01T16:00:00Z', [], [{ channel_id: 'UC1', in_window: 1, videos: [{ published: '2026-09-01T10:00:00Z' }], via: 'yt-dlp (undated, newest-first)' }]),
  ]
  const ev = sourceEvidence(pulls, 'youtube', 'UC1')
  assert.equal(ev.pulls, 2)
  assert.equal(ev.empties_in_row, 1)
  assert.equal(ev.latest_error, 'rss: 404 · innertube: channel gone (x)')
  assert.equal(ev.last_item_ms, Date.parse('2026-09-01T10:00:00Z'))
  assert.equal(ev.rung, 'yt-dlp')
})
test('auditor: a source the pull never carried has no evidence', () => {
  const ev = sourceEvidence([pullAt('2026-09-02T16:00:00Z', [{ handle: 'b', in_window: 3, top: [] }])], 'twitter', 'a')
  assert.equal(ev.pulls, 0)
  assert.equal(ev.evidence_from_ms, null)
  assert.equal(ev.last_item_ms, null)
})

// ---------------------------------------------------------------- squatter watch
test('squatter: word sharing ignores case, punctuation, stopwords; compacted names count', () => {
  assert.equal(sharesWord('HipHop IsReal', 'HHIR'), false)
  assert.equal(sharesWord('Ultimate Rap League', 'URL / Ultimate Rap League'), true)
  assert.equal(sharesWord('15 MinutesOfFame Ent', '15 Minutes of Fame'), true)
  assert.equal(sharesWord('KING DNA TOOTH 👑🦷', 'DNA (a must - Robert)'), true)
  assert.equal(sharesWord('VEEZY', 'Aye Verb'), false)
  assert.equal(sharesWord('The Source', 'The Breakfast Club'), false)
})
test('squatter: 4 followers on a media outlet is flagged', () => {
  const v = squatterVerdict({ handle: 'HipHopIsReal', label: 'HHIR', type: 'media', followers: 4, display_name: 'HipHop IsReal', status: 'VERIFIED 2026-08-31' })
  assert.equal(v.flag, true)
  assert.match(String(v.reason), /4 followers/)
  assert.match(String(v.reason), /media/)
})
test('squatter: a tiny blogger whose name matches the label is not flagged', () => {
  const v = squatterVerdict({ handle: 'x', label: 'Battle Rap Trap', type: 'blogger', followers: 40, display_name: 'BIG TRAP', status: 'VERIFIED 2026-08-31' })
  assert.equal(v.flag, false)
})
test('squatter: a league with 50 followers is flagged', () => {
  assert.equal(squatterVerdict({ handle: 'x', label: 'Some League', type: 'league', followers: 50, display_name: 'Some League', status: 'VERIFIED 2026-08-31' }).flag, true)
})
test('squatter: the handle counts as a name (Aye Verb posts as VEEZY at @islandgodverb)', () => {
  assert.equal(squatterVerdict({ handle: 'islandgodverb', label: 'Aye Verb', type: 'battler', followers: 31936, display_name: 'VEEZY', status: 'VERIFIED 2026-08-31' }).flag, false)
})
test('squatter: a name that shares nothing with the label is flagged', () => {
  const v = squatterVerdict({ handle: 'xyz', label: 'Angry Fan', type: 'blogger', followers: 12, display_name: 'Crypto Deals', status: 'VERIFIED 2026-08-31' })
  assert.equal(v.flag, true)
  assert.match(String(v.reason), /shares no word/)
})
test('squatter: a big account with a mismatched name is an eyeball note, not a flag', () => {
  const v = squatterVerdict({ handle: 'abc', label: 'Angry Fan', type: 'blogger', followers: 50000, display_name: 'Crypto Deals', status: 'VERIFIED 2026-08-31' })
  assert.equal(v.flag, false)
  assert.match(String(v.note), /eyeball/i)
})
test('squatter: already-SUSPECT, NOT FOUND and unverified rows are left alone', () => {
  assert.equal(squatterVerdict({ handle: 'a', label: 'HHIR', type: 'media', followers: 4, display_name: 'x', status: 'SUSPECT 2026-09-01: 4 followers' }).flag, false)
  assert.equal(squatterVerdict({ handle: 'a', label: 'HHIR', type: 'media', status: 'NOT FOUND 2026-08-31 - needs a human' }).flag, false)
  assert.equal(squatterVerdict({ handle: 'a', label: 'HHIR', type: 'media', status: 'UNVERIFIED (scout)' }).flag, false)
})

// ---------------------------------------------------------------- window tuner
test('tuner: the window widens one step at a time, never past a week', () => {
  assert.equal(nextWindow(24), 48)
  assert.equal(nextWindow(48), 72)
  assert.equal(nextWindow(72), 168)
  assert.equal(nextWindow(168), null)
  assert.equal(nextWindow(6), 24)
  assert.equal(nextWindow(36), 48)
  assert.equal(nextWindow(500), null)
})
const totals = (n: number) => ({ totals: { tweets: n, videos: 0 } })
test('tuner: three thin pulls (avg < 5) propose the next step', () => {
  const v = windowVerdict([totals(1), totals(2), totals(3)], 48)
  assert.equal(v.avg, 2)
  assert.equal(v.widen_to, 72)
})
test('tuner: healthy pulls propose nothing', () => {
  assert.equal(windowVerdict([totals(10), totals(4), totals(6)], 48).widen_to, null)
})
test('tuner: fewer than three pulls is not enough evidence', () => {
  const v = windowVerdict([totals(0), totals(0)], 48)
  assert.equal(v.widen_to, null)
  assert.equal(v.pulls, 2)
})
test('tuner: only the last three pulls count (newest first)', () => {
  assert.equal(windowVerdict([totals(0), totals(0), totals(0), totals(100)], 24).widen_to, 48)
})
test('tuner: at a week already, thin pulls are a finding, not a proposal', () => {
  const v = windowVerdict([totals(0), totals(1), totals(0)], 168)
  assert.equal(v.widen_to, null)
  assert.equal(v.at_max, true)
})

// ---------------------------------------------------------------- housekeeper
test('housekeeper: prunes this beat\'s run files older than 14 days unless a show references them or they are the newest of their kind', () => {
  const f = (name: string, days: number, beat: string | null) => ({ name, mtimeMs: NOW - days * D, beat })
  const files = [
    f('pull_2026-08-01T10-00-00_battle-rap.json', 30, 'battle-rap'),        // old, unreferenced -> prune
    f('pull_2026-08-02T10-00-00_battle-rap.json', 29, 'battle-rap'),        // old but referenced by a show -> keep
    f('pull_2026-08-30T10-00-00_battle-rap.json', 3, 'battle-rap'),         // fresh -> keep
    f('pull_2026-07-01T10-00-00_hood.json', 60, 'hood'),                    // another beat -> keep
    f('topics_2026-07-01T10-00-00.json', 60, null),                         // unowned -> keep
    f('clusters_2026-08-01T10-00-00_battle-rap.json', 30, 'battle-rap'),    // old, but the newest clusters file for the beat -> keep
  ]
  const referenced = new Set(['pull_2026-08-02T10-00-00_battle-rap.json'])
  assert.deepEqual(pruneCandidates(files, { beatId: 'battle-rap', referenced, now: NOW }), ['pull_2026-08-01T10-00-00_battle-rap.json'])
})

// ---------------------------------------------------------------- explore mode: topic list + suggestion bar
test('explore: topics = cases, then the top 3 clusters (subject beats a long title), then the show name; deduped, capped', () => {
  const beat = { show: { name: 'ALGORITHM INSTITUTE OF BATTLE RAP' }, cases: [{ title: 'Lil Durk case' }, { title: 'lil durk CASE' }] }
  const clusters = [
    { id: 'C001', title: 'URLTV Announces Summer Madness XVI with Multiple Battles and Event Details', event_fingerprint: { subject: 'URLTV Summer Madness XVI' } },
    { id: 'C002', title: 'Keefe D Found Guilty', event_fingerprint: { subject: '' } },
    { id: 'C003', title: 'Dismissed one', dismissed: true },
    { id: 'C004', title: 'Chess vs Ill Will' },
    { id: 'C005', title: 'Never reached' },
  ]
  assert.deepEqual(exploreTopics(beat, clusters).map(t => t.topic), ['Lil Durk case', 'URLTV Summer Madness XVI', 'Keefe D Found Guilty', 'Chess vs Ill Will', 'ALGORITHM INSTITUTE OF BATTLE RAP'])
  assert.deepEqual(exploreTopics(beat, clusters).map(t => t.from), ['case', 'cluster:C001', 'cluster:C002', 'cluster:C004', 'show'])
})
test('explore: a beat with no cases and no clusters still explores its show name; nothing at all is an empty list', () => {
  assert.deepEqual(exploreTopics({ show: { name: 'THE BLOCK REPORT' } }, null).map(t => t.topic), ['THE BLOCK REPORT'])
  assert.deepEqual(exploreTopics({}, []), [])
})
test('suggest: the reason reads like a sentence', () => {
  assert.equal(suggestReason(4, 'Summer Madness', 48), '4 videos on "Summer Madness" in 48h')
  assert.equal(suggestReason(3, 'x', 168), '3 videos on "x" in 7 days')
})
const cand = (over: any) => ({ channel_id: 'UC' + 'a'.repeat(22), channel_name: 'Chan', handle: '@chan', url: 'u', id_from: 'author', video_count: 5, in_window: 4, latest: { title: 'latest vid' }, videos: [], already_in_beat: false, ...over })
test('suggest: the bar = 3+ in window, an id YouTube stamped, a real UC id, not in the beat, not dismissed/seen, not a flagged outlet', () => {
  const result: any = { topic: 'Summer Madness', hours: 48, youtube: [
    cand({ channel_name: 'Clears' }),
    cand({ channel_name: 'Too few', in_window: 2 }),
    cand({ channel_name: 'By name', id_from: 'search' }),
    cand({ channel_name: 'In beat', already_in_beat: true }),
    cand({ channel_name: 'Dismissed', channel_id: 'UC' + 'b'.repeat(22) }),
    cand({ channel_name: 'LTBR TV', channel_id: 'UC' + 'c'.repeat(22) }),
    cand({ channel_name: 'No id', channel_id: null, id_from: null }),
  ] }
  const s = suggestionsFrom(result, { terms: ['ltbr'], exclude: new Set(['UC' + 'b'.repeat(22)]) })
  assert.deepEqual(s.map(x => x.channel_name), ['Clears'])
  assert.equal(s[0].reason, '4 videos on "Summer Madness" in 48h')
  assert.equal(s[0].in_window, 4)
  assert.equal(s[0].latest_title, 'latest vid')
})
