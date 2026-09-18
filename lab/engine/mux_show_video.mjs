#!/usr/bin/env node
/**
 * MUX SHOW VIDEO — the speaker-face video podcast (docs/SHOWTIME-API-PLAN.md §3 video v0).
 * timeline.json + mp3 + the cast's portraits -> hard-cut current-speaker video, both aspects.
 * NOT lip-sync (that's the parked H3/LTX lane); the timeline is the seam lip-sync upgrades into.
 *
 *   node lab/engine/mux_show_video.mjs --timeline=<t.json> --audio=<a.mp3> --out=<dir> \
 *     [--aspects=16x9,9x16] [--show="THE SPLATTER ZONE"] [--bg=#12151a] [--accent=#eab332]
 *
 * Face lookup per speaker id: lab/cast/images/<id>.png -> lab/cast/portraits/<id>-gray.jpg ->
 * lab/cast/portraits/<id>.jpg -> generated initials card (never a crash).
 * QC gate: ffprobe asserts resolution + |video - audio| duration <= 0.5s, or exits nonzero.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] === '' ? true : m[2]] : [a, true] }))
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
const probe = (f, entry) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', entry, '-of', 'default=nw=1:nk=1', f], { encoding: 'utf8' }).trim()

const SIZES = { '16x9': [1920, 1080], '9x16': [1080, 1920] }
const timelinePath = String(ARG.timeline || ''); const audioPath = String(ARG.audio || '')
if (!fs.existsSync(timelinePath) || !fs.existsSync(audioPath)) { console.error('usage: mux_show_video --timeline=<json> --audio=<mp3> --out=<dir> [--aspects=16x9,9x16]'); process.exit(1) }
const OUT = String(ARG.out || path.dirname(audioPath)); fs.mkdirSync(OUT, { recursive: true })
const aspects = String(ARG.aspects || '16x9,9x16').split(',').map(s => s.trim()).filter(a => SIZES[a])
const SHOW = String(ARG.show || 'TALKSHOWGO').slice(0, 40)
const BG = String(ARG.bg || '#12151a'); const ACCENT = String(ARG.accent || '#eab332')
const tl = JSON.parse(fs.readFileSync(timelinePath, 'utf8'))
const cast = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), 'utf8'))
const nameOf = id => (cast.hosts.find(h => h.id === id)?.name || id.replace(/-/g, ' ')).toUpperCase()

function faceOf(id) {
  for (const c of [path.join(ROOT, 'lab', 'cast', 'images', id + '.png'), path.join(ROOT, 'lab', 'cast', 'portraits', id + '-gray.jpg'), path.join(ROOT, 'lab', 'cast', 'portraits', id + '.jpg')]) if (fs.existsSync(c)) return c
  return null
}
// drawtext needs a font on Windows; escape the path for the filter (C\:/...). Text: keep to [A-Z0-9 .'-]
const FONT = 'C\\:/Windows/Fonts/arialbd.ttf'
const safeTxt = s => s.replace(/[^A-Za-z0-9 .'\-&]/g, '').slice(0, 38)

function frameFor(id, aspect, tmp) {
  const [W, H] = SIZES[aspect]
  const out = path.join(tmp, `f_${id}_${aspect}.png`)
  if (fs.existsSync(out)) return out
  const face = faceOf(id)
  const name = safeTxt(nameOf(id)); const show = safeTxt(SHOW)
  const barH = Math.round(H * 0.11); const nameSize = Math.round(barH * 0.34); const showSize = Math.round(barH * 0.22)
  const lower = `drawbox=y=${H - barH}:w=${W}:h=${barH}:color=${BG}@0.92:t=fill,drawbox=y=${H - barH}:w=${W}:h=6:color=${ACCENT}:t=fill,` +
    `drawtext=fontfile='${FONT}':text='${name}':x=${Math.round(W * 0.045)}:y=${H - barH + Math.round(barH * 0.16)}:fontsize=${nameSize}:fontcolor=white,` +
    `drawtext=fontfile='${FONT}':text='${show}':x=${Math.round(W * 0.045)}:y=${H - barH + Math.round(barH * 0.58)}:fontsize=${showSize}:fontcolor=${ACCENT}`
  try {
    if (face) {
      // face fills the frame height (cover-crop) on the bg color, lower third over it
      ff(['-i', face, '-frames:v', '1', '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${lower}`, out])
    } else {
      const initials = nameOf(id).split(' ').map(w => w[0]).join('').slice(0, 3)
      ff(['-f', 'lavfi', '-i', `color=c=${BG}:s=${W}x${H}`, '-frames:v', '1', '-vf', `drawtext=fontfile='${FONT}':text='${initials}':x=(w-tw)/2:y=(h-th)/2:fontsize=${Math.round(H * 0.28)}:fontcolor=${ACCENT},${lower}`, out])
    }
  } catch (e) {
    // drawtext/font trouble: ship the plain face rather than no video at all
    if (face) ff(['-i', face, '-frames:v', '1', '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, out])
    else ff(['-f', 'lavfi', '-i', `color=c=${BG}:s=${W}x${H}`, '-frames:v', '1', out])
  }
  return out
}

const audioDur = parseFloat(probe(audioPath, 'format=duration'))
const results = []
for (const aspect of aspects) {
  const tmp = fs.mkdtempSync(path.join(OUT, 'mux_'))
  try {
    // concat demuxer: each speaking line shows its speaker; gaps stay on the CURRENT speaker (no flicker)
    const lines = []
    let cursor = 0
    for (let i = 0; i < tl.lines.length; i++) {
      const l = tl.lines[i]
      const next = tl.lines[i + 1]
      const end = next ? next.start_s : Math.max(audioDur, l.start_s + l.dur_s)
      const dur = Math.max(0.1, end - cursor)
      lines.push({ frame: frameFor(l.who, aspect, tmp), dur })
      cursor = end
    }
    // pin the reel to the AUDIO's measured length: leveling/mastering shifts a few hundred ms
    // vs the raw-part timeline, so the last frame absorbs the delta (QC gate demands <=0.5s)
    const listTotal = lines.reduce((a, l) => a + l.dur, 0)
    lines[lines.length - 1].dur = Math.max(0.1, lines[lines.length - 1].dur + (audioDur - listTotal))
    const listFile = path.join(tmp, 'list.txt')
    const abs = f => path.resolve(f).replace(/\\/g, '/').replace(/'/g, "'\\''") // ABSOLUTE: concat resolves relative entries against the list's own dir
    fs.writeFileSync(listFile, lines.map(l => `file '${abs(l.frame)}'\nduration ${l.dur.toFixed(3)}`).join('\n') + `\nfile '${abs(lines[lines.length - 1].frame)}'\n`)
    const outMp4 = path.join(OUT, `show-${aspect}.mp4`)
    // -t pins the output to the audio's exact length: per-still durations round up to the 24fps
    // grid and 18 stills of drift-up summed to +0.68s before this (the QC gate caught it)
    ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-i', audioPath, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '24', '-c:a', 'aac', '-b:a', '160k', '-t', audioDur.toFixed(3), outMp4])
    // QC GATE (plan §3): resolution + duration drift
    const [W, H] = SIZES[aspect]
    const res = probe(outMp4, 'stream=width,height').split('\n').map(Number)
    const vdur = parseFloat(probe(outMp4, 'format=duration'))
    const drift = Math.abs(vdur - audioDur)
    if (res[0] !== W || res[1] !== H) { console.error(`QC FAIL ${aspect}: resolution ${res[0]}x${res[1]} != ${W}x${H}`); process.exit(1) }
    if (drift > 0.5) { console.error(`QC FAIL ${aspect}: |video-audio| = ${drift.toFixed(2)}s > 0.5s`); process.exit(1) }
    console.log(`OK ${aspect}: ${outMp4} (${vdur.toFixed(1)}s, drift ${drift.toFixed(2)}s)`)
    results.push({ aspect, file: outMp4 })
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}
console.log('MUX_DONE ' + results.map(r => r.file).join(' '))
