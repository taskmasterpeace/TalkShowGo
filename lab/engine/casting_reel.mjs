#!/usr/bin/env node
/**
 * Casting reel: clone a character's casting LINE in their own voice, then LTX-2.5 lip-sync their locked
 * portrait to it -> a talking-head mp4 for the picker.
 *   node lab/engine/casting_reel.mjs <id> "<line>"   -> lab/cast/reels/<id>.mp4
 * Needs: lab/cast/images/<id>.png (locked portrait) + lab/cast/voices/library/<id>.wav(+.ref.txt).
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const readKey = name => { const e = process.env[name]; if (e?.trim()) return e.trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch {} try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v) return String(v).trim() } catch {} return undefined }
const KEY = readKey('CUPCAKE_GATEWAY_KEY')
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'
const [id, line] = process.argv.slice(2)
if (!id || !line) { console.error('usage: casting_reel.mjs <id> "<line>"'); process.exit(1) }
const VOX = path.join(ROOT, 'lab', 'cast', 'voices')
const REELS = path.join(ROOT, 'lab', 'cast', 'reels'); fs.mkdirSync(REELS, { recursive: true })
const portrait = path.join(ROOT, 'lab', 'cast', 'images', `${id}.png`)
const refWav = path.join(VOX, 'library', `${id}.wav`), refTxtP = path.join(VOX, 'library', `${id}.ref.txt`)
if (!fs.existsSync(portrait)) { console.error(`no portrait ${portrait}`); process.exit(1) }
if (!fs.existsSync(refWav) || !fs.existsSync(refTxtP)) { console.error(`no library voice ref for ${id} (need ${refWav} + .ref.txt)`); process.exit(1) }

const main = async () => {
  console.error(`[${id}] cloning casting line in their voice...`)
  const body = { text: line, ref_audio_b64: fs.readFileSync(refWav).toString('base64'), ref_text: fs.readFileSync(refTxtP, 'utf8').trim(), instruction: 'natural and confident, introducing themselves to the camera', cfg_scale: 4.0, seed: 42 }
  let wav
  for (let busy = 0; ;) {
    const r = await fetch(GW + '/v1/audio/breeze-clone', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body: JSON.stringify(body) })
    if (r.status === 409) { if (++busy > 10) throw new Error('box busy (409)'); console.error('  busy, wait 60s'); await new Promise(s => setTimeout(s, 60000)); continue }
    if (!r.ok) throw new Error('clone ' + r.status + ' ' + (await r.text()).slice(0, 140))
    wav = Buffer.from(await r.arrayBuffer()); break
  }
  const raw = path.join(REELS, `${id}.line.raw.wav`); fs.writeFileSync(raw, wav)
  const clean = path.join(REELS, `${id}.line.wav`)
  // LOUDNESS-NORMALIZE to -16 LUFS: LTX drives the mouth from audio energy, so a calm/quiet voice (e.g. Andrew
  // the composed anchor) barely moves the lips. Normalizing makes every voice drive the mouth consistently.
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '24000', '-ac', '1', '-t', '5', clean])
  try { fs.unlinkSync(raw) } catch {}
  console.error(`[${id}] rendering talking-head (LTX-2.5)...`)
  const out = path.join(REELS, `${id}.mp4`)
  execFileSync('node', [path.join(ROOT, 'lab', 'engine', 'ltx_lipsync.mjs'), portrait, clean, line, out, `${id}_reel`], { stdio: ['ignore', 'inherit', 'inherit'] })
  console.log(out)
}
main().catch(e => { console.error('FATAL ' + e.message); process.exit(1) })
