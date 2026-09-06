#!/usr/bin/env node
/**
 * LTX-2.5 audio-driven lip-sync on the cupcake box's ComfyUI (:8188). Makes a portrait TALK to a vocal.
 * The AudioTimestepOverride node (in the graph) is what actually moves the mouth (see ltx-video-lipsync skill).
 * HTTP only - uploads the image + wav to ComfyUI, patches lab/engine/ltx25-lipsync-graph.json, runs, downloads the mp4.
 *
 *   node lab/engine/ltx_lipsync.mjs <portrait.png> <vocal.wav> "<spoken line>" <out.mp4> [prefix]
 *
 * Vocal must be ISOLATED voice (no music), <=5s (121 frames @24fps). 832x480. ~2-3 min cold, ~96s warm.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const COMFY = process.env.COMFY_URL || 'http://192.168.1.249:8188'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GRAPH = path.join(ROOT, 'lab', 'engine', 'ltx25-lipsync-graph.json')
const [portrait, vocal, line, out, prefix] = process.argv.slice(2)
if (!portrait || !vocal || !line || !out) { console.error('usage: ltx_lipsync.mjs <portrait.png> <vocal.wav> "<line>" <out.mp4> [prefix]'); process.exit(1) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function upload(file) {
  const buf = fs.readFileSync(file)
  const fd = new FormData()
  fd.append('image', new Blob([buf]), path.basename(file))
  fd.append('overwrite', 'true')
  const r = await fetch(COMFY + '/upload/image', { method: 'POST', body: fd })
  if (!r.ok) throw new Error('upload ' + path.basename(file) + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 120))
  const j = await r.json()
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name
}

const main = async () => {
  console.error(`uploading ${path.basename(portrait)} + ${path.basename(vocal)} to ${COMFY} ...`)
  const imgName = await upload(portrait)
  const audName = await upload(vocal)

  const graph = JSON.parse(fs.readFileSync(GRAPH, 'utf8'))
  delete graph._readme
  graph['8i'].inputs.image = imgName
  graph['9a'].inputs.audio = audName
  graph['5'].inputs.text = `A person talking directly to camera, medium close-up, studio portrait, natural lip movement and lively expression. The person is talking and clearly says: "${line}"`
  graph['20'].inputs.filename_prefix = `video/${prefix || 'ltx25_reel'}`
  graph['13'].inputs.noise_seed = 42
  // sync-drive strength: 0.93 default; raise (toward 0.99) for calm/composed subjects whose mouth barely moves
  graph['ato'].inputs.audio_timestep_scale = Number(process.env.LTX_AUDIO_SCALE || graph['ato'].inputs.audio_timestep_scale || 0.93)

  const client_id = 'tsg_reel_' + Date.now()
  const q = await fetch(COMFY + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph, client_id }) })
  if (!q.ok) throw new Error('/prompt -> ' + q.status + ' ' + (await q.text()).slice(0, 300))
  const { prompt_id } = await q.json()
  console.error(`queued ${prompt_id}; rendering (~2-3 min cold)...`)

  let hist
  for (let i = 0; i < 300; i++) {
    await sleep(4000)
    const h = await fetch(COMFY + '/history/' + prompt_id).then(r => r.json()).catch(() => ({}))
    hist = h[prompt_id]
    if (hist?.status?.completed || hist?.outputs) break
    if (hist?.status?.status_str === 'error') throw new Error('render error: ' + JSON.stringify(hist.status).slice(0, 300))
    if (i % 5 === 0) process.stderr.write('.')
  }
  if (!hist?.outputs) throw new Error('render timeout / no outputs')

  // find the video output (SaveVideo, node 20)
  let vid = null
  for (const nodeOut of Object.values(hist.outputs)) {
    const arr = nodeOut.images || nodeOut.video || nodeOut.gifs || nodeOut.videos
    if (Array.isArray(arr) && arr[0]?.filename) { vid = arr[0]; break }
  }
  if (!vid) throw new Error('no video in outputs: ' + JSON.stringify(hist.outputs).slice(0, 300))
  const url = `${COMFY}/view?filename=${encodeURIComponent(vid.filename)}&subfolder=${encodeURIComponent(vid.subfolder || '')}&type=${vid.type || 'output'}`
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  const outAbs = path.resolve(out)
  fs.mkdirSync(path.dirname(outAbs), { recursive: true })
  fs.writeFileSync(outAbs, buf)
  // TRIM trailing idle: cut the clip as soon as the speech stops (Robert 2026-09-03 - no dead tail after the line)
  try {
    const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', outAbs, '-af', 'silencedetect=noise=-38dB:d=0.15', '-f', 'null', '-'], { encoding: 'utf8' })
    const log = (probe.stderr || '') + (probe.stdout || '')
    const dm = log.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
    const dur = dm ? (+dm[1] * 3600 + +dm[2] * 60 + +dm[3]) : 0
    const sils = [...log.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => +m[1])
    const last = sils.length ? sils[sils.length - 1] : null
    const end = (last != null && last > 1.0 && dur && (dur - last) < 1.6) ? Math.min(last + 0.12, dur) : dur
    if (dur && end < dur - 0.05) {
      const tmp = outAbs.replace(/\.mp4$/, '.trim.mp4')
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', outAbs, '-t', end.toFixed(2), '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', tmp])
      fs.renameSync(tmp, outAbs)
      console.error(`  trimmed to ${end.toFixed(2)}s (was ${dur.toFixed(2)}s)`)
    }
  } catch (e) { console.error('  trim skipped: ' + e.message) }
  console.error(`\nSAVED ${out}  ${(fs.statSync(outAbs).size / 1024).toFixed(0)}KB`)
  console.log(outAbs)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
