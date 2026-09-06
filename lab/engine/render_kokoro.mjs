#!/usr/bin/env node
/**
 * Render a talk-show segment md into multi-voice audio via cupcake mk-gateway Kokoro TTS.
 * Usage: node lab/engine/render_kokoro.mjs <segment.md> <out.mp3>
 * Free, local-network, synchronous WAV per line -> per-speaker loudness leveling -> ffmpeg concat -> loudnorm -> mp3.
 * v1 is a flat "radio play" concat (no overlaps) - RETIRED for shows (take-to-take wobble); the Breeze renderer is the
 * production path, this is the draft fallback make_show uses when Breeze cannot render.
 * EVEN AUDIO (Robert 2026-09-02): one gain per SPEAKER to -16 LUFS (a whisper stays a whisper), then a measured
 * two-pass loudnorm (I=-16, TP=-1.5, LRA=11) on the full mix; per-speaker before/after LUFS lines go to stderr.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execSync, spawnSync } from 'node:child_process'

const [seg, out] = process.argv.slice(2)
if (!seg || !out) { console.error('usage: render_kokoro.mjs <segment.md> <out.mp3>'); process.exit(1) }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
// key precedence: process env > .env > lab/settings/keys.json (a key pasted in the SETTINGS page); no .env is fine
const readKey = name => { const e = process.env[name]; if (e && e.trim()) return e.trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch { /* no .env */ } try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v && String(v).trim()) return String(v).trim() } catch { /* no settings file */ } return undefined }
const KEY = readKey('CUPCAKE_GATEWAY_KEY')
if (!KEY) { console.error('no CUPCAKE_GATEWAY_KEY in .env'); process.exit(1) }
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'

// v2 casting: maximally distinct registers + per-host pitch locks so Kokoro's take-to-take wobble can't blur speakers
const CAST = {
  tasha: { voice: 'af_bella', speed: 1.08, pitch: 1.03 },
  blaze: { voice: 'am_fenrir', speed: 1.12, pitch: 1.0 },
  knowledge: { voice: 'bm_george', speed: 0.92, pitch: 0.94 }, // British house-narrator elder - unmistakable vs Fenrir
  dwayne: { voice: 'am_onyx', speed: 0.97, pitch: 0.98 },       // Champagne Dwayne: the low smooth one, slowed a touch (draft stand-in only)
}
const BACKCHANNEL = /^(mm+h?m?|mm-hm|whew|hm+|huh|right(,? right)*|nah|cap|wow|okay(,? okay)*|okay now|look at you)[.!?]*$/i
// DELEGATES (draft path — Kokoro can't clone a voice): each delegate on the beat card gets its own
// unused Kokoro voice so they never blur into a house host
const GUEST_POOL = [{ voice: 'am_adam', speed: 1.0, pitch: 1 }, { voice: 'af_sarah', speed: 1.02, pitch: 1 }, { voice: 'am_michael', speed: 0.98, pitch: 1 }, { voice: 'af_nicole', speed: 1.0, pitch: 1 }]
const DELEGATES = {}   // lowercased name -> id
try {
  const beat = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(path.resolve(seg))), 'beatcard.json'), 'utf8'))
  const all = [...(beat.delegates?.human || []), ...(beat.delegates?.ai || [])]
  all.forEach((d, i) => { CAST[d.id] = GUEST_POOL[i % GUEST_POOL.length]; DELEGATES[String(d.name).toLowerCase()] = d.id })
} catch { /* no beat card next to this segment: house hosts only */ }
const whoOf = name => {
  const n = name.toLowerCase()
  if (n.includes('tasha')) return 'tasha'; if (n.includes('blaze') || n.includes('marcus')) return 'blaze'; if (n.includes('knowledge') || n.includes('king')) return 'knowledge'
  if (n.includes('dwayne') || n.includes('champagne')) return 'dwayne'
  for (const [nm, id] of Object.entries(DELEGATES)) if (nm && n.includes(nm)) return id
  return null
}

const lines = []
for (const raw of fs.readFileSync(seg, 'utf8').split('\n')) {
  // NAME [any tags]* (delivery): text — tags may be many / mixed-case / with commas (MIX pass output)
  const m = raw.trim().match(/^([A-Z][A-Z .'\-]*?)\s*(?:\[[^\]]*\]\s*)*\(([^)]*)\)\s*:\s*(.+)$/)
  if (!m) continue
  const who = whoOf(m[1]); if (!who) continue
  let text = m[3].replace(/\[E\d+\]/g, '').replace(/\[[a-z -]+\]/gi, '').replace(/[*_]/g, '').replace(/\s{2,}/g, ' ').trim()
  if (!text || text === '(unusable turn)') continue
  if (BACKCHANNEL.test(text.trim()) && text.trim().split(/\s+/).length <= 3) continue // flat mix turns backchannels into phantom voices - cut until real overlap mixing
  lines.push({ who, text })
}
if (!lines.length) { console.error('no dialogue lines parsed'); process.exit(1) }
console.error(`${lines.length} lines to render`)

const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), 'kok_'))
async function tts(text, voice, speed, file) {
  for (let a = 1; a <= 3; a++) {
    try {
      const res = await fetch(GW + '/v1/audio/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body: JSON.stringify({ text, voice, speed }) })
      if (!res.ok) throw new Error('gateway ' + res.status + ' ' + (await res.text()).slice(0, 120))
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
      return
    } catch (e) { if (a === 3) throw e; console.error(`  retry ${a}: ${e.message}`); await new Promise(r => setTimeout(r, a * 3000)) }
  }
}
const ff = (args) => execSync(`ffmpeg -hide_banner -loglevel error -y ${args}`, { stdio: ['ignore', 'inherit', 'inherit'] })

// ---------- EVEN AUDIO: per-speaker loudness leveling + measured two-pass loudnorm (mirrors render_breeze.mjs) ----------
const TARGET = { I: -16, TP: -1.5, LRA: 11 }
const fmtLu = v => v === null ? 'n/a' : v.toFixed(1)
const ffCap = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }); return (r.stderr || '') + (r.stdout || '') }
function lufs(file) {   // integrated loudness (EBU R128) in LUFS, or null when unmeasurable
  const m = ffCap(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).match(/\n\s*I:\s+(-?[\d.]+|-inf|nan)\s+LUFS/)
  const v = m ? parseFloat(m[1]) : NaN
  return Number.isFinite(v) ? v : null
}
function concatWav(files, dest) {
  const list = dest + '.txt'
  fs.writeFileSync(list, files.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'))
  ff(`-f concat -safe 0 -i "${list}" -c copy "${dest}"`)
}
function levelBySpeaker(parts, who) {   // parts are already pcm_f32le 24k mono; one gain per SPEAKER, never per line
  const ids = [...new Set(who)], before = {}, gain = {}
  for (const id of ids) {
    const joined = path.join(tmp, `spk_${id.replace(/[^a-z0-9]/gi, '_')}_in.wav`); concatWav(parts.filter((_, i) => who[i] === id), joined)
    before[id] = lufs(joined); gain[id] = before[id] === null ? 0 : Math.max(-20, Math.min(20, TARGET.I - before[id]))
  }
  const leveled = parts.map((p, i) => { const o = path.join(tmp, `g${i}.wav`); ff(`-i "${p}" -af volume=${gain[who[i]].toFixed(2)}dB -c:a pcm_f32le "${o}"`); return o })
  for (const id of ids) {
    const joined = path.join(tmp, `spk_${id.replace(/[^a-z0-9]/gi, '_')}_out.wav`); concatWav(leveled.filter((_, i) => who[i] === id), joined)
    console.error(`  level ${id}: ${fmtLu(before[id])} -> ${fmtLu(lufs(joined))} LUFS (gain ${gain[id] >= 0 ? '+' : ''}${gain[id].toFixed(1)} dB, ${who.filter(w => w === id).length} parts)`)
  }
  return leveled
}
function masterToMp3(fullWav, dest) {
  const p1 = ffCap(['-i', fullWav, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-f', 'null', '-'])
  let m = null; try { m = JSON.parse((p1.match(/\{[\s\S]*?\}/) || ['{}'])[0]) } catch {}
  const ok = m && Number.isFinite(parseFloat(m.input_i)) && parseFloat(m.input_i) > -70
  const measured = ok ? `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` : ''
  if (!ok) console.error('  master: first-pass measurement unusable, applying single-pass loudnorm')
  ff(`-i "${fullWav}" -af "loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}${measured}" -ar 48000 -acodec libmp3lame -q:a 2 "${path.resolve(dest)}"`)
  console.error(`  master: mix ${ok ? m.input_i : '?'} -> ${fmtLu(lufs(path.resolve(dest)))} LUFS integrated (target ${TARGET.I}, TP ${TARGET.TP}, LRA ${TARGET.LRA})`)
}

const main = async () => {
  const t0 = Date.now()
  const parts = [], who = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], c = CAST[l.who]
    const rawF = path.join(tmp, `r${i}.wav`), normF = path.join(tmp, `n${i}.wav`)
    await tts(l.text, c.voice, c.speed, rawF)
    const p = c.pitch || 1
    const af = p === 1 ? '' : ` -af "asetrate=24000*${p},aresample=24000,atempo=${(1 / p).toFixed(4)}"`
    ff(`-i "${rawF}" -ar 24000 -ac 1${af} -c:a pcm_f32le "${normF}"`)
    parts.push(normF); who.push(l.who)
    console.error(`${i + 1}/${lines.length} ${l.who}: ${l.text.slice(0, 50)}`)
  }
  const leveled = levelBySpeaker(parts, who)
  // one 250ms silence pad at the common rate/format
  const sil = path.join(tmp, 'sil.wav')
  ff(`-f lavfi -i anullsrc=r=24000:cl=mono -t 0.25 -c:a pcm_f32le "${sil}"`)
  const seq = []; for (const p of leveled) seq.push(p, sil)
  const full = path.join(tmp, 'full.wav'); concatWav(seq, full)
  masterToMp3(full, out)
  fs.rmSync(tmp, { recursive: true, force: true })
  const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.resolve(out)}"`).toString().trim()
  console.log(`${path.resolve(out)}  ${Math.round(dur)}s  (rendered in ${Math.round((Date.now() - t0) / 1000)}s)`)
}
main().catch(e => { console.error('FATAL: ' + e.message); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1) })
