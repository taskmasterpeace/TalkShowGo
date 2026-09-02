// STT for THE DELEGATE's voice path: a recorded take -> 24kHz mono wav (ffmpeg on PATH; the shape the
// Breeze clone renderer wants for a reference clip) -> VERBATIM transcript via OpenRouter, Gemini audio
// input (one chat completion carrying the wav as base64; a ~1MB wav comes back in about 1.5s).
// transcribeWav never throws on EMPTY content (silence -> text ''); it does throw on a missing key,
// a network failure, or an API error, so the route can answer 502 + retryable.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const STT_MODEL = 'google/gemini-2.5-flash'
const PROMPT = 'Transcribe this audio verbatim, word for word, in the language spoken. Keep every sentence the speaker said. Do not summarize, shorten, correct, or add anything. Output only the transcript text: no label, no quotes, no commentary. If there is no speech at all, output nothing.'

/** ffmpeg -> 24kHz mono 16-bit wav (the Breeze ref-clip format). Throws with ffmpeg's stderr on failure. */
export function toWav(inputPath: string, outWav: string): void {
  fs.mkdirSync(path.dirname(outWav), { recursive: true })
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-ar', '24000', '-ac', '1', outWav], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000, windowsHide: true })
  } catch (e: any) {
    const err = String(e?.stderr || e?.message || e).trim().split('\n').pop() || 'ffmpeg failed'
    throw new Error('ffmpeg: ' + err.slice(0, 200))
  }
  if (!fs.existsSync(outWav) || fs.statSync(outWav).size < 64) throw new Error('ffmpeg: wrote no audio')
}

/** Duration in seconds from the RIFF header (walks the chunks, so a LIST chunk before data is fine); 0 if unreadable. */
export function wavSeconds(wavPath: string): number {
  try {
    const size = fs.statSync(wavPath).size
    const fd = fs.openSync(wavPath, 'r')
    const head = Buffer.alloc(Math.min(size, 8192))
    try { fs.readSync(fd, head, 0, head.length, 0) } finally { fs.closeSync(fd) }
    if (head.length < 12 || head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') return 0
    let off = 12, rate = 0, ch = 0, bits = 0
    while (off + 8 <= head.length) {
      const id = head.toString('ascii', off, off + 4), len = head.readUInt32LE(off + 4)
      if (id === 'fmt ' && off + 24 <= head.length) { ch = head.readUInt16LE(off + 10); rate = head.readUInt32LE(off + 12); bits = head.readUInt16LE(off + 22) }
      if (id === 'data') {
        const bps = rate * ch * (bits / 8)
        return bps > 0 ? Math.round((Math.min(len, size - off - 8) / bps) * 100) / 100 : 0
      }
      off += 8 + len + (len % 2)
    }
  } catch { /* unreadable -> 0 */ }
  return 0
}

// the model sometimes labels, quotes, or fences the transcript; strip that, and map "no speech" to ''
function cleanTranscript(content: unknown): string {
  let t = typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((p: any) => (p && typeof p.text === 'string') ? p.text : '').join(' ')
    : ''
  t = t.replace(/\r/g, '').trim()
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim()
  t = t.replace(/^(transcript|transcription)\s*:\s*/i, '').trim()
  if (t.length > 2 && /^["“]/.test(t) && /["”]$/.test(t)) t = t.slice(1, -1).trim()
  if (/^[\[(]?\s*(no (audible |detectable )?(speech|audio|voice)|silence|silent|inaudible|nothing)[^a-z]*[\])]?\s*$/i.test(t)) return ''
  return t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/** Verbatim transcript of a wav. Returns text '' (never throws) when the take holds no speech. */
export async function transcribeWav(wavPath: string): Promise<{ text: string; ms: number; seconds: number }> {
  const t0 = Date.now()
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY missing')
  const data = fs.readFileSync(wavPath).toString('base64')
  const seconds = wavSeconds(wavPath)
  // speech runs ~3 tokens/s; 8/s leaves room for a fast talker, floor 1200 so a short take is never clipped
  const maxTokens = Math.min(4000, Math.max(1200, Math.round(seconds * 8)))
  const r = await fetch(OR_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: STT_MODEL, temperature: 0, max_tokens: maxTokens,
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'input_audio', input_audio: { data, format: 'wav' } }] }],
    }),
    signal: AbortSignal.timeout(90000),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error?.message || ('openrouter ' + r.status))
  return { text: cleanTranscript(j.choices?.[0]?.message?.content), ms: Date.now() - t0, seconds }
}
