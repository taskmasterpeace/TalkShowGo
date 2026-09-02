// CHECK: src/lib/command/transcript.ts — parseSrv1 + parseVtt (pure) + fetchTranscriptSegments
// (yt-dlp integration, srv1 primary / vtt fallback).
// Run: node lab/engine/check_transcript.mjs
// (Node 25's built-in TS type-stripping runs this straight; `npx tsx` was tried first but silently
// dropped the second named export from the transpiled module - reproducible, so plain node it is.)
//
// (a) parseSrv1 against an inline srv1 XML fixture with the real DOUBLE-encoded entities yt-dlp emits
//     (the file is XML, so YouTube's own "&#39;" comes out as "&amp;#39;"), a multi-line cue, and a
//     whitespace-only cue that must still move duration_s without becoming a segment.
// (b) parseVtt against an inline VTT fixture with YouTube's ROLLING auto-sub duplicates + <c> word
//     tags + entities, so the dedupe/strip logic is proven without any network I/O (the fallback path,
//     exercised when a video serves no srv1).
// (c) fetchTranscriptSegments against a REAL video id from the newest battle-rap pull
//     (lab/runs/pull_2026-09-02T16-35-39-130_battle-rap.json -> hiphopisreal.com channel), proving the
//     yt-dlp leg + parser integrate end to end on real captions, srv1-primary.
import { parseSrv1, parseVtt, fetchTranscriptSegments } from '../../src/lib/command/transcript.ts'

let pass = 0, fail = 0
function assert(cond, label) {
  if (cond) { pass++; console.log(`  PASS  ${label}`) }
  else { fail++; console.log(`  FAIL  ${label}`) }
}

// ---------- (a) parseSrv1: inline fixture, double-encoded entities + multi-line + blank cue ----------
console.log('parseSrv1 · inline fixture (double-encoded entities)')
const SRV1_FIXTURE = '<?xml version="1.0" encoding="utf-8" ?><transcript>'
  + '<text start="0" dur="2.5">Hello there friend</text>'
  + '<text start="2.5" dur="3.88">&amp;gt;&amp;gt; we we&amp;#39;re good</text>'
  + '<text start="6.38" dur="2.2">line one\nline two</text>'
  + '<text start="8.58" dur="1.5">   </text>'
  + '</transcript>'
const s1 = parseSrv1(SRV1_FIXTURE)
assert(s1.segments.length === 3, `whitespace-only cue is dropped, 3 real segments kept (got ${s1.segments.length})`)
assert(s1.segments[0]?.text === 'Hello there friend', `first segment text, no entities to decode (got ${JSON.stringify(s1.segments[0]?.text)})`)
assert(s1.segments[0]?.start_s === 0 && s1.segments[0]?.end_s === 2.5, `first segment start/end = start + dur (got ${s1.segments[0]?.start_s}-${s1.segments[0]?.end_s})`)
assert(s1.segments[1]?.text === "&gt;&gt; we we're good".replace(/&gt;/g, '>'), `double-encoded entities decoded in one text (got ${JSON.stringify(s1.segments[1]?.text)})`)
assert(s1.segments[2]?.text === 'line one line two', `embedded newline collapses to a space (got ${JSON.stringify(s1.segments[2]?.text)})`)
assert(s1.segments.every((s, i) => i === 0 || s.start_s >= s1.segments[i - 1].start_s), 'start_s is monotonic non-decreasing')
assert(!s1.segments.some(s => s.text.includes('-->')), 'no cue-timing syntax in segment text (n/a for XML, asserted for parity)')
assert(s1.duration_s === 10.08, `duration_s reaches the LAST cue's end even though that cue had no visible text (got ${s1.duration_s})`)
assert(s1.words === 11, `word count across all 3 segments (got ${s1.words})`)

const emptySrv1 = parseSrv1('')
assert(Array.isArray(emptySrv1.segments) && emptySrv1.segments.length === 0 && emptySrv1.duration_s === 0, 'empty input returns an empty, non-throwing result')

// ---------- (b) parseVtt: inline fixture, rolling dupes + <c> tags + entities ----------
// Built from an explicit array (not a raw template literal) so the single-space "nothing settled yet"
// placeholder line YouTube emits inside a cue - as opposed to the truly EMPTY line that separates cues -
// is unambiguous. Real shape (captured from hiphopisreal.com, see transcript.ts's header comment):
//   TIME -->            "<c>-tagged growing line" (first appearance: keeps this cue's start_s)
//   TIME --> (1ms cue)  "settled plain repeat" + " " placeholder            (duplicate: deduped away)
//   TIME -->            "settled plain repeat" (dup) + "next <c>-tagged growing line" (new)
const SPACE = ' '
const FIXTURE = [
  'WEBVTT',
  'Kind: captions',
  'Language: en',
  '',
  '00:00:00.000 --> 00:00:02.000 align:start position:0%',
  SPACE,
  'Hello<00:00:00.500><c> there</c><00:00:01.000><c> friend</c>',
  '',
  '00:00:02.000 --> 00:00:02.010 align:start position:0%',
  'Hello there friend',
  SPACE,
  '',
  '00:00:02.010 --> 00:00:04.500 align:start position:0%',
  'Hello there friend',
  'this&nbsp;is&nbsp;a&nbsp;test<00:00:03.000><c> &gt;&gt;</c><00:00:03.500><c> &amp;</c><00:00:04.000><c> more</c>',
  '',
  '00:00:04.500 --> 00:00:04.510 align:start position:0%',
  'this is a test &gt;&gt; &amp; more',
  SPACE,
  '',
].join('\n')

const fx = parseVtt(FIXTURE)
assert(fx.segments.length === 2, `dedupes rolling repeats to 2 unique lines (got ${fx.segments.length})`)
assert(fx.segments[0]?.text === 'Hello there friend', `first segment text (got ${JSON.stringify(fx.segments[0]?.text)})`)
assert(fx.segments[0]?.start_s === 0, `first segment keeps the FIRST cue's start_s, the <c>-tagged growing one (got ${fx.segments[0]?.start_s})`)
assert(fx.segments[1]?.text === 'this is a test >> & more', `entities decoded, <c>/timestamp tags stripped (got ${JSON.stringify(fx.segments[1]?.text)})`)
assert(fx.segments[1]?.start_s === 2.01, `second segment's start_s is its first (growing) cue, not the later settled repeat (got ${fx.segments[1]?.start_s})`)
assert(fx.segments.every((s, i) => i === 0 || s.start_s >= fx.segments[i - 1].start_s), 'start_s is monotonic non-decreasing')
assert(!fx.segments.some(s => s.text.includes('-->')), 'no cue-timing syntax leaks into segment text')
assert(fx.text === 'Hello there friend this is a test >> & more', `flat text is the deduped segments joined (got ${JSON.stringify(fx.text)})`)
assert(fx.words === 10, `word count - ">>" and "&" each count as one token (got ${fx.words})`)
assert(fx.duration_s === 4.51, `duration_s is the LAST cue's end, even one that added no new segment (got ${fx.duration_s})`)

// empty/garbage input must never throw
const empty = parseVtt('')
assert(Array.isArray(empty.segments) && empty.segments.length === 0 && empty.duration_s === 0, 'empty input returns an empty, non-throwing result')

// ---------- (c) fetchTranscriptSegments: real yt-dlp pull against a real video, srv1-primary ----------
console.log('fetchTranscriptSegments · real video (yt-dlp, srv1 primary)')
const REAL_VIDEO_ID = 'j09cTforzl4' // hiphopisreal.com, from lab/runs/pull_2026-09-02T16-35-39-130_battle-rap.json
try {
  const tr = await fetchTranscriptSegments(REAL_VIDEO_ID)
  assert(tr.video_id === REAL_VIDEO_ID, 'echoes the requested video_id')
  assert(tr.format === 'srv1', `this video has srv1 captions, so the primary path is used (got ${tr.format})`)
  assert(tr.segments.length > 0, `segments.length > 0 (got ${tr.segments.length})`)
  assert(tr.segments.every((s, i) => i === 0 || s.start_s >= tr.segments[i - 1].start_s), 'start_s monotonic non-decreasing across the real transcript')
  assert(typeof tr.text === 'string' && tr.text.length > 0, 'text is non-empty')
  assert(!tr.segments.some(s => s.text.includes('-->')), 'no segment text contains raw cue-timing syntax')
  assert(tr.duration_s > 0, `duration_s > 0 (got ${tr.duration_s})`)
  assert(tr.words > 0, `words > 0 (got ${tr.words})`)
  console.log(`  info  ${tr.segments.length} segments · ${tr.words} words · ${tr.duration_s}s duration · via ${tr.format}`)
} catch (e) {
  fail++
  console.log(`  FAIL  fetchTranscriptSegments threw: ${e?.message || e}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
