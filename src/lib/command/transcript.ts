// TRANSCRIPT — parses YouTube captions into timestamped segments. Robert, 2026-09-02: "Can you get
// the transcript? The timestamp? Because certain shows might even be playing snippets." The 3-rung pull
// already finds the videos; this turns each one's captions into a real timeline instead of throwing the
// timestamps away (the old stringer.ts fetchTranscript stripped every `-->` line - see git history).
//
// TWO caption formats, tried in order:
//
// 1) srv1 (PRIMARY) - yt-dlp's XML transcript format: one <text start="S" dur="D">...</text> cue per
//    spoken line, already deduped by YouTube itself. Confirmed against a real video (hiphopisreal.com,
//    j09cTforzl4): 12.9KB of clean cues vs 53KB of rolling VTT for the same captions. The only wrinkle is
//    DOUBLE-encoded entities - the file is XML (so a literal "&" is "&amp;"), and the original caption
//    text already had its own entities ("&#39;", "&gt;"), so a real cue reads
//    `&amp;gt;&amp;gt; we we&amp;#39;re good` for `>> we we're good`. Technique mirrored (not imported -
//    different repo) from the proven extractor at D:/git/aiobr/scripts/youtube-transcript.mjs.
// 2) vtt (FALLBACK, when a video serves no srv1) - YouTube's auto-subs are ROLLING: each cue repeats the
//    previous cue's now-settled text plus a new word-by-word tail, so the same line of text appears 2-3
//    times in a row across consecutive cues before it's superseded by a longer one. Example (real
//    capture, same channel):
//      00:00:00.000 --> 00:00:02.110   " " / "Where,<00:00:00.720><c> you</c>..."   (growing, <c>-tagged)
//      00:00:02.110 --> 00:00:02.120   "Where, you know, what's up with Smack,"     (settled repeat)
//      00:00:02.120 --> 00:00:03.630   "Where, you know, what's up with Smack," / "man?<00:00:02.440>..."
//    We dedupe on the stripped text and keep the FIRST cue's timing for each unique line - that first
//    appearance (the growing, <c>-tagged one) is the earliest moment those words are on screen, which is
//    what a "click a line, seek the video there" UI wants.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const YTDLP = process.env.YTDLP_PATH || 'C:/Users/taskm/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe'
const ytUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

export type TranscriptSegment = { start_s: number; end_s: number; text: string }
export type Transcript = { video_id: string; duration_s: number; words: number; text: string; segments: TranscriptSegment[]; format: 'srv1' | 'vtt' }
type ParsedTranscript = { segments: TranscriptSegment[]; text: string; words: number; duration_s: number }

// ============================== srv1 (primary) ==============================

const SRV1_CUE = /<text start="([^"]*)" dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g

/** The file is XML (so YouTube's own entities are double-escaped: "&amp;#39;" for an apostrophe) -
 *  decode the outer XML layer first, then the inner caption-text entities. Exactly aiobr's chain. */
function decodeSrv1Entities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
}

/** Pure parser: srv1 XML -> segments. No I/O - safe to unit test against a fixture string. One cue per
 *  spoken line already, so (unlike VTT) there is no rolling-duplicate dedupe to do. Never throws. */
export function parseSrv1(raw: string): ParsedTranscript {
  const segments: TranscriptSegment[] = []
  let duration_s = 0
  for (const m of String(raw || '').matchAll(SRV1_CUE)) {
    const start_s = parseFloat(m[1])
    const dur = parseFloat(m[2])
    if (!Number.isFinite(start_s)) continue
    const end_s = start_s + (Number.isFinite(dur) ? dur : 0)
    if (end_s > duration_s) duration_s = end_s
    const text = decodeSrv1Entities(m[3]).replace(/\s+/g, ' ').trim()
    if (!text) continue
    segments.push({ start_s, end_s, text })
  }
  const text = segments.map(s => s.text).join(' ')
  const words = (text.match(/\S+/g) || []).length
  return { segments, text, words, duration_s }
}

// ============================== vtt (fallback) ==============================

// Matches a WebVTT cue-timing line: "[HH:]MM:SS.mmm --> [HH:]MM:SS.mmm" (+ optional cue settings after).
// Captures both timestamps so one match both finds the line AND reads its values. No /g flag, so reusing
// this at module scope across calls is safe (only /g or /y regexes carry .lastIndex state).
const CUE_TIME = /((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/

/** "[HH:]MM:SS.mmm" -> seconds. Horner's-method reduce so it works with 2 or 3 colon-separated parts. */
function toSeconds(ts: string): number {
  return ts.trim().replace(',', '.').split(':').reduce((s, p) => s * 60 + Number(p), 0)
}

/** Strip <c>/<00:00:01.000> tags and decode entities - byte-for-byte the chain stringer.ts's old
 *  fetchTranscript always used, so transcript text reads the same as before this refactor. */
const cleanVttLine = (l: string) => l.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()

/** Pure parser: WebVTT text -> deduped, timestamped segments. No I/O - safe to unit test against a
 *  fixture string. Never throws: garbage or empty input just yields an empty result. */
export function parseVtt(raw: string): ParsedTranscript {
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n')
  // group into cue blocks: a truly EMPTY line separates blocks; a single-space placeholder line
  // (YouTube's "nothing settled yet" filler) is content and must stay inside its block
  const blocks: string[][] = []
  let cur: string[] = []
  for (const l of lines) {
    if (l === '') { if (cur.length) blocks.push(cur); cur = [] }
    else cur.push(l)
  }
  if (cur.length) blocks.push(cur)

  const seen = new Set<string>()
  const segments: TranscriptSegment[] = []
  let duration_s = 0

  for (const block of blocks) {
    const timeIdx = block.findIndex(l => CUE_TIME.test(l))
    if (timeIdx === -1) continue // WEBVTT/Kind/Language/NOTE/STYLE header, or a stray block
    const m = CUE_TIME.exec(block[timeIdx])
    if (!m) continue
    const start_s = toSeconds(m[1])
    const end_s = toSeconds(m[2])
    if (end_s > duration_s) duration_s = end_s
    for (const payload of block.slice(timeIdx + 1)) {
      const text = cleanVttLine(payload)
      if (!text || seen.has(text)) continue
      seen.add(text)
      segments.push({ start_s, end_s, text })
    }
  }
  const text = segments.map(s => s.text).join(' ')
  const words = (text.match(/\S+/g) || []).length
  return { segments, text, words, duration_s }
}

// ============================== fetch (yt-dlp) ==============================

/** yt-dlp caption download -> parse. Tries srv1 first (clean, no dedupe needed); falls back to vtt
 *  when a video serves no srv1 (a small share do). --write-auto-sub --write-sub together, same flags
 *  stringer.ts has always used, so a channel with real (non-auto) captions is picked up too. Throws on
 *  total failure (no captions in either format, or yt-dlp itself failed) - callers decide how to present
 *  that (a 404 vs a 500, a status field on a dossier source, whatever fits their contract). */
export async function fetchTranscriptSegments(videoId: string, opts: { capWords?: number } = {}): Promise<Transcript> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsg_tr_'))
  try {
    const outBase = path.join(tmp, 'v')
    const commonArgs = ['--skip-download', '--write-auto-sub', '--write-sub', '--sub-lang', 'en']

    let parsed: ParsedTranscript | null = null
    let format: 'srv1' | 'vtt' = 'srv1'
    try {
      execFileSync(YTDLP, [...commonArgs, '--sub-format', 'srv1', '-o', outBase, ytUrl(videoId)], { timeout: 90000, stdio: 'pipe' })
      const srv1 = fs.readdirSync(tmp).find(f => f.endsWith('.srv1'))
      if (srv1) {
        const p = parseSrv1(fs.readFileSync(path.join(tmp, srv1), 'utf8'))
        if (p.segments.length) parsed = p
      }
    } catch { /* fall through to vtt */ }

    if (!parsed) {
      format = 'vtt'
      try {
        execFileSync(YTDLP, [...commonArgs, '--sub-format', 'vtt', '-o', outBase, ytUrl(videoId)], { timeout: 90000, stdio: 'pipe' })
        const vtt = fs.readdirSync(tmp).find(f => f.endsWith('.vtt'))
        if (vtt) {
          const p = parseVtt(fs.readFileSync(path.join(tmp, vtt), 'utf8'))
          if (p.segments.length) parsed = p
        }
      } catch { /* neither format available */ }
    }

    if (!parsed) throw new Error('no captions available')
    const text = opts.capWords ? parsed.text.split(/\s+/).slice(0, opts.capWords).join(' ') : parsed.text
    return { video_id: videoId, duration_s: parsed.duration_s, words: parsed.words, text, segments: parsed.segments, format }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}
