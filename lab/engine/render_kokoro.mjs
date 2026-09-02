#!/usr/bin/env node
/**
 * Render a talk-show segment md into multi-voice audio via cupcake mk-gateway Kokoro TTS.
 * Usage: node lab/engine/render_kokoro.mjs <segment.md> <out.mp3>
 * Free, local-network, synchronous WAV per line -> ffmpeg concat -> mp3.
 * v1 is a flat "radio play" concat (no overlaps) - the dialogue-native renderer replaces this later.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const [seg, out] = process.argv.slice(2)
if (!seg || !out) { console.error('usage: render_kokoro.mjs <segment.md> <out.mp3>'); process.exit(1) }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const KEY = (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^CUPCAKE_GATEWAY_KEY=(.+)$/m) || [])[1]
if (!KEY) { console.error('no CUPCAKE_GATEWAY_KEY in .env'); process.exit(1) }
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'

// v2 casting: maximally distinct registers + per-host pitch locks so Kokoro's take-to-take wobble can't blur speakers
const CAST = {
  tasha: { voice: 'af_bella', speed: 1.08, pitch: 1.03 },
  blaze: { voice: 'am_fenrir', speed: 1.12, pitch: 1.0 },
  knowledge: { voice: 'bm_george', speed: 0.92, pitch: 0.94 }, // British house-narrator elder - unmistakable vs Fenrir
}
const BACKCHANNEL = /^(mm+h?m?|whew|hm+|huh|right(,? right)*|nah|cap|wow|okay(,? okay)*)[.!?]*$/i
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

const main = async () => {
  const t0 = Date.now()
  const parts = []
  // one 250ms silence pad at the common rate
  const sil = path.join(tmp, 'sil.wav')
  ff(`-f lavfi -i anullsrc=r=24000:cl=mono -t 0.25 "${sil}"`)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], c = CAST[l.who]
    const rawF = path.join(tmp, `r${i}.wav`), normF = path.join(tmp, `n${i}.wav`)
    await tts(l.text, c.voice, c.speed, rawF)
    const p = c.pitch || 1
    const af = p === 1 ? '' : ` -af "asetrate=24000*${p},aresample=24000,atempo=${(1 / p).toFixed(4)}"`
    ff(`-i "${rawF}" -ar 24000 -ac 1${af} "${normF}"`)
    parts.push(normF, sil)
    console.error(`${i + 1}/${lines.length} ${l.who}: ${l.text.slice(0, 50)}`)
  }
  const list = path.join(tmp, 'list.txt')
  fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'))
  ff(`-f concat -safe 0 -i "${list}" -c copy "${path.join(tmp, 'full.wav')}"`)
  ff(`-i "${path.join(tmp, 'full.wav')}" -acodec libmp3lame -q:a 2 "${path.resolve(out)}"`)
  fs.rmSync(tmp, { recursive: true, force: true })
  const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.resolve(out)}"`).toString().trim()
  console.log(`${path.resolve(out)}  ${Math.round(dur)}s  (rendered in ${Math.round((Date.now() - t0) / 1000)}s)`)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
