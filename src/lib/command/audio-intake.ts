// AUDIO INTAKE — what every "record yourself" surface shares: the STRINGER delegate interview and the
// public take link (/take/<token>) both take a base64 recording from MediaRecorder (or a phone/email
// adapter), keep the raw file, convert it to the 24kHz mono wav the Breeze clone wants, and number the
// takes inside ONE person's folder. Pure helpers here (no route, no logging) so both routes behave the
// same and a change lands in both.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { toWav } from './stt'

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024
// container by mime (codec params stripped): what MediaRecorder hands us across Chrome / Firefox / Safari, plus a raw wav
export const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'video/mp4': 'mp4', 'audio/x-m4a': 'mp4', 'audio/m4a': 'mp4',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/vnd.wave': 'wav',
}

export type DecodedAudio = { ok: true; buf: Buffer; ext: string; mime: string } | { ok: false; error: string; status: number }

/** base64 (optionally a data: URL) + mime -> bytes, or the exact refusal the route should answer with. */
export function decodeAudio(audio_b64: unknown, mime: unknown): DecodedAudio {
  const m = String(mime || 'audio/webm').split(';')[0].trim().toLowerCase()
  const ext = EXT_BY_MIME[m]
  if (!ext) return { ok: false, error: `unsupported audio type: ${m || '(none)'} (webm, ogg, mp4 or wav)`, status: 400 }
  const b64 = String(audio_b64 || '').replace(/^data:[^,]*,/, '').trim()
  if (b64.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 4) return { ok: false, error: 'recording too large (max 25MB)', status: 413 }
  const buf = Buffer.from(b64, 'base64')
  if (buf.length > MAX_AUDIO_BYTES) return { ok: false, error: 'recording too large (max 25MB)', status: 413 }
  if (buf.length < 512) return { ok: false, error: 'that recording is empty: hold RECORD and talk for a few seconds', status: 400 }
  return { ok: true, buf, ext, mime: m }
}

/** Next take number in a person's folder: 1 + the highest take-<n>.* on disk (a sub-clip take-3.2.wav counts as 3). */
export const nextTake = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []).map(f => Number((f.match(/^take-(\d+)\./) || [])[1])).filter(Number.isFinite).reduce((m, n) => Math.max(m, n), 0) + 1

/** Where the next clip of take <n> lands: take-<n>.wav, then take-<n>.2.wav, take-<n>.3.wav (a re-record within the same visit). */
export function clipPath(dir: string, n: number): string {
  const first = path.join(dir, `take-${n}.wav`)
  if (!fs.existsSync(first)) return first
  for (let k = 2; ; k++) { const p = path.join(dir, `take-${n}.${k}.wav`); if (!fs.existsSync(p)) return p }
}

/** Save a decoded recording as the next clip of take <n>: raw container kept next to the 24kHz mono wav. Throws ffmpeg's reason. */
export function saveClip(dir: string, buf: Buffer, ext: string, n: number): { raw: string; wav: string } {
  fs.mkdirSync(dir, { recursive: true })
  const wav = clipPath(dir, n)
  const raw = wav.replace(/\.wav$/i, ext === 'wav' ? '.orig.wav' : '.' + ext)
  fs.writeFileSync(raw, buf)
  toWav(raw, wav)
  return { raw, wav }
}

/** First <seconds> of a wav -> a new wav (ffmpeg -t). For capping a ramble before STT and cutting a Breeze-length voice ref. */
export function trimWav(src: string, out: string, seconds: number): string {
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-t', String(Math.max(1, seconds)), '-ar', '24000', '-ac', '1', out], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000, windowsHide: true })
  } catch (e: any) {
    const err = String(e?.stderr || e?.message || e).trim().split('\n').pop() || 'ffmpeg failed'
    throw new Error('ffmpeg: ' + err.slice(0, 200))
  }
  if (!fs.existsSync(out) || fs.statSync(out).size < 64) throw new Error('ffmpeg: wrote no audio')
  return out
}

/** A wav path the client hands back is only honored if it is one of THIS person's takes on disk (no path games). */
export function ownedWav(p: unknown, dir: string): string | null {
  if (typeof p !== 'string' || !p.trim()) return null
  const abs = path.resolve(p.trim())
  const base = path.resolve(dir)
  const inside = abs.toLowerCase().startsWith((base + path.sep).toLowerCase())
  return inside && /\.wav$/i.test(abs) && fs.existsSync(abs) ? abs : null
}

/** A spoken transcript, kept word for word but made floor-safe: an STT em-dash becomes a comma (house law:
 *  no em-dashes in spoken lines) and line breaks collapse, because a verbatim turn is ONE line in the segment
 *  (a newline would cut the person's turn in half at render time). Words are never changed. */
export function cleanSpeech(s: unknown): string {
  return String(s || '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').replace(/\s*,\s*$/, '').trim()
}
