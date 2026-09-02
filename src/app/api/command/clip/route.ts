import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { logTimer } from '@/lib/command/log'

export const runtime = 'nodejs'
export const maxDuration = 120

const ROOT = process.cwd()
const YTDLP = process.env.YTDLP_PATH || 'C:/Users/taskm/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe'
const CLIPS_DIR = path.join(ROOT, 'lab', 'clips')
const ID_RE = /^[A-Za-z0-9_-]{6,20}$/
const MAX_LEN_S = 30

/** POST {video_id, start_s, end_s} — a bounded, PRODUCER-TRIGGERED audio clip, never a background
 *  download: yt-dlp pulls ONLY the requested seconds via --download-sections, re-encodes to mp3, and
 *  caches it under lab/clips/. This is the render step behind Robert's "certain shows might even be
 *  playing snippets" (2026-09-02) - pick a moment in the transcript, hear exactly that moment.
 *  Hard limits: 0 <= start_s < end_s, (end_s - start_s) <= 30s, a real-looking video_id. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any))
  const video_id = String(body?.video_id || '').trim()
  const start_s = Math.round(Number(body?.start_s))
  const end_s = Math.round(Number(body?.end_s))

  if (!ID_RE.test(video_id)) return NextResponse.json({ ok: false, error: 'bad video_id' }, { status: 400 })
  if (!Number.isFinite(start_s) || start_s < 0) return NextResponse.json({ ok: false, error: 'start_s must be a number >= 0' }, { status: 400 })
  if (!Number.isFinite(end_s) || end_s <= start_s) return NextResponse.json({ ok: false, error: 'end_s must be a number greater than start_s' }, { status: 400 })
  if (end_s - start_s > MAX_LEN_S) return NextResponse.json({ ok: false, error: `clip too long: max ${MAX_LEN_S}s` }, { status: 400 })

  const t = logTimer()
  const fileName = `${video_id}_${start_s}-${end_s}.mp3`
  const outPath = path.join(CLIPS_DIR, fileName)
  const url = `/api/command/audio/clips/${fileName}`

  // cached: a producer scrubbing the same moment twice shouldn't re-download it
  if (fs.existsSync(outPath)) {
    t.done(() => ({ kind: 'youtube', stage: 'clip', ok: true, ref: video_id, summary: `clip cached · ${end_s - start_s}s`, meta: { start_s, end_s, cached: true } }))
    return NextResponse.json({ ok: true, path: outPath, url, cached: true })
  }

  try {
    fs.mkdirSync(CLIPS_DIR, { recursive: true })
    // write under a private temp name first: yt-dlp/ffmpeg failing partway must never leave a corrupt
    // file sitting at the canonical cache path (a later cache-hit would serve it forever)
    const tmpBase = path.join(CLIPS_DIR, `.tmp_${video_id}_${start_s}-${end_s}_${Date.now()}`)
    execFileSync(YTDLP, [
      '-f', 'bestaudio', '--download-sections', `*${start_s}-${end_s}`,
      '-x', '--audio-format', 'mp3',
      '-o', `${tmpBase}.%(ext)s`,
      `https://www.youtube.com/watch?v=${video_id}`,
    ], { timeout: 90000, stdio: 'pipe' })
    const produced = `${tmpBase}.mp3`
    if (!fs.existsSync(produced)) throw new Error('yt-dlp did not produce an mp3')
    fs.renameSync(produced, outPath)
    t.done(() => ({ kind: 'youtube', stage: 'clip', ok: true, ref: video_id, summary: `clip rendered · ${end_s - start_s}s`, meta: { start_s, end_s } }))
    return NextResponse.json({ ok: true, path: outPath, url })
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 200)
    t.done(() => ({ kind: 'youtube', stage: 'clip', ok: false, ref: video_id, summary: 'clip failed', error: msg, meta: { start_s, end_s } }))
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
