import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

export const runtime = 'nodejs'
export const maxDuration = 120

const YTDLP = process.env.YTDLP_PATH || 'C:/Users/taskm/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe'

/** POST {video_id} — pull the full transcript (auto-subs) via yt-dlp. The deep-dive leg. */
export async function POST(req: Request) {
  const { video_id } = await req.json()
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(video_id || '')) return NextResponse.json({ error: 'bad video_id' }, { status: 400 })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsg_tr_'))
  try {
    execFileSync(YTDLP, ['--skip-download', '--write-auto-sub', '--write-sub', '--sub-lang', 'en', '--sub-format', 'vtt', '-o', path.join(tmp, 'v'), `https://www.youtube.com/watch?v=${video_id}`], { timeout: 90000, stdio: 'pipe' })
    const vtt = fs.readdirSync(tmp).find(f => f.endsWith('.vtt'))
    if (!vtt) return NextResponse.json({ error: 'no captions available' }, { status: 404 })
    const raw = fs.readFileSync(path.join(tmp, vtt), 'utf8')
    const seen = new Set<string>()
    const lines: string[] = []
    for (let l of raw.split('\n')) {
      l = l.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
      if (!l || /^(WEBVTT|Kind:|Language:)/.test(l) || /-->/.test(l) || seen.has(l)) continue
      seen.add(l); lines.push(l)
    }
    const text = lines.join(' ')
    return NextResponse.json({ ok: true, video_id, words: (text.match(/\S+/g) || []).length, transcript: text.slice(0, 20000) })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 })
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}
