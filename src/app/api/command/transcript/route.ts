import { NextResponse } from 'next/server'
import { logTimer } from '@/lib/command/log'
import { fetchTranscriptSegments } from '@/lib/command/transcript'

export const runtime = 'nodejs'
export const maxDuration = 120

const ID_RE = /^[A-Za-z0-9_-]{6,20}$/

/** Shared by GET and POST: the full timestamped-transcript contract via yt-dlp (the deep-dive leg).
 *  { video_id, duration_s, words, text, segments:[{start_s,end_s,text}] } — Robert's ask, 2026-09-02:
 *  "Can you get the transcript? The timestamp?" No captions -> 404 (an expected, common case for a
 *  channel that never turns captions on, not a server error). */
async function handle(video_id: string) {
  if (!ID_RE.test(video_id || '')) return NextResponse.json({ ok: false, error: 'bad video_id' }, { status: 400 })
  const t = logTimer()
  try {
    const tr = await fetchTranscriptSegments(video_id)
    t.done(() => ({
      kind: 'youtube', stage: 'transcript', ok: true, ref: video_id,
      summary: `${tr.segments.length} segments · ${tr.words} words · ${Math.round(tr.duration_s)}s`,
      meta: { segments: tr.segments.length, words: tr.words, duration_s: tr.duration_s },
    }))
    return NextResponse.json({ ok: true, ...tr })
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 200)
    const noCaptions = /no captions available/i.test(msg)
    t.done(() => ({ kind: 'youtube', stage: 'transcript', ok: false, ref: video_id, summary: noCaptions ? 'no captions available' : 'transcript failed', error: msg }))
    return NextResponse.json({ ok: false, error: noCaptions ? 'no captions available' : msg }, { status: noCaptions ? 404 : 500 })
  }
}

/** GET ?video_id= — same contract as POST, so the YOUTUBE page's transcript drawer can just fetch() it. */
export async function GET(req: Request) {
  const u = new URL(req.url)
  return handle((u.searchParams.get('video_id') || '').trim())
}

/** POST {video_id} — unchanged entry point for existing callers. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any))
  return handle(String(body?.video_id || '').trim())
}
