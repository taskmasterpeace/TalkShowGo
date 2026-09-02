#!/usr/bin/env node
/**
 * Breeze TTS 2 renderer (cupcake mk-gateway) - the REAL voice engine w/ per-line emotional instruction + nonverbals.
 * Modes:
 *   design                          - create the 3 locked cast reference voices -> lab/cast/voices/
 *   reel <out.mp3>                  - nonverbal test reel (inline tags vs instruction-driven takes, self-labeled)
 *   segment <segment.md> <out.mp3>  - render a segment: breeze-clone per line, instruction = persona base + delivery parenthetical
 * Every mp3 rendered here must get a MANIFEST.md row.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const KEY = (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^CUPCAKE_GATEWAY_KEY=(.+)$/m) || [])[1]
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'
const VDIR = path.join(ROOT, 'lab', 'cast', 'voices')

/* Cast voice config lives in cast.json (voice.aesthetic / voice.seed / voice.ref_text) so the UI can edit it.
 * CFG LAW (breeze-tts-2 skill): design + real direction = 4.0; pure clone / base read = 1.0. Never 1.3. */
const FALLBACK = {
  tasha: { design: 'Young Black American woman, late twenties, sharp quick delivery, low warm tone with a permanent smirk in it, street-smart podcast host, crisp diction, dry and effortlessly cool', ref_text: "I read every comment so you don't have to, and baby, the comments were NOT kind. Somebody has to say the thing everybody's thinking. That's me. That's the job.", base: 'sharp, amused, zero patience, fast', seed: 101 },
  blaze: { design: 'Big booming American male sports-debate host, thirties, deep chest-resonant baritone, slightly gravelly, explosive projection like arguing on live television, speeds up when excited, huge dynamic range, clear full-bodied close-mic studio quality', ref_text: "Now HOLD ON, hold on, because everybody in this room is missing the point! I watched the whole thing twice, TWICE, and I am telling you nobody is built like this man. Nobody!", base: 'explosive, incredulous, big dynamic swings', seed: 202 },
  knowledge: { design: 'Older American man, late fifties, deep low resonant voice, slow deliberate cadence, calm gravitas, wise barbershop elder who has seen everything twice, unhurried, clear texture, close-mic studio quality', ref_text: "See, y'all are arguing about the wave, and nobody is watching the tide. I've seen this exact story before. Different names, same ending. Sit down, I'll tell it.", base: 'low, slow, measured, total certainty', seed: 303 },
}
const CAST = (() => {
  const out = structuredClone(FALLBACK)
  try {
    const cj = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), 'utf8'))
    for (const h of cj.hosts || []) {
      const short = h.id === 'marcus-blaze' ? 'blaze' : h.id === 'king-knowledge' ? 'knowledge' : h.id === 'tasha-raw' ? 'tasha' : h.id
      out[short] = out[short] || {}
      if (h.voice?.aesthetic) out[short].design = h.voice.aesthetic
      if (h.voice?.seed) out[short].seed = h.voice.seed
      if (h.voice?.ref_text) out[short].ref_text = h.voice.ref_text
      if (h.voice?.default_instruction) out[short].base = h.voice.default_instruction
    }
  } catch {}
  return out
})()
const whoOf = n => { const s = n.toLowerCase(); if (s.includes('tasha')) return 'tasha'; if (s.includes('blaze') || s.includes('marcus')) return 'blaze'; if (s.includes('knowledge') || s.includes('king')) return 'knowledge'; return null }
const ff = a => execSync(`ffmpeg -hide_banner -loglevel error -y ${a}`, { stdio: ['ignore', 'inherit', 'inherit'] })

async function post(ep, body, tries = 3) {
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(GW + ep, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body: JSON.stringify(body) })
      if (res.status === 409) throw new Error('box busy (409)')
      if (!res.ok) throw new Error(ep + ' ' + res.status + ' ' + (await res.text()).slice(0, 160))
      return Buffer.from(await res.arrayBuffer())
    } catch (e) { if (a === tries) throw e; console.error(`  retry ${a}: ${e.message}`); await new Promise(r => setTimeout(r, a * 10000)) }
  }
}
const refOf = who => ({ b64: fs.readFileSync(path.join(VDIR, who + '.wav')).toString('base64'), text: fs.readFileSync(path.join(VDIR, who + '.ref.txt'), 'utf8').trim() })
async function line(who, text, instruction, file) {
  const r = refOf(who)
  // CFG LAW: real direction = 4.0; base/plain read = 1.0 (fast-path graphs exist only for these two)
  const cfg = instruction && instruction.trim() && instruction !== CAST[who].base ? 4.0 : 1.0
  const wav = await post('/v1/audio/breeze-clone', { text, ref_audio_b64: r.b64, ref_text: r.text, instruction, cfg_scale: cfg, seed: CAST[who].seed })
  fs.writeFileSync(file, wav)
}
function concatToMp3(parts, out, tmp) {
  const sil = path.join(tmp, 'sil.wav'); ff(`-f lavfi -i anullsrc=r=24000:cl=mono -t 0.3 "${sil}"`)
  const norm = []
  for (let i = 0; i < parts.length; i++) { const n = path.join(tmp, `c${i}.wav`); ff(`-i "${parts[i]}" -ar 24000 -ac 1 "${n}"`); norm.push(n, sil) }
  const list = path.join(tmp, 'list.txt')
  fs.writeFileSync(list, norm.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'))
  ff(`-f concat -safe 0 -i "${list}" -c copy "${path.join(tmp, 'full.wav')}"`)
  ff(`-i "${path.join(tmp, 'full.wav')}" -acodec libmp3lame -q:a 2 "${path.resolve(out)}"`)
  const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.resolve(out)}"`).toString().trim()
  console.log(`${path.resolve(out)}  ${Math.round(dur)}s`)
}

const [mode, a1, a2] = process.argv.slice(2)
const main = async () => {
  if (mode === 'design') {
    // optional: design ONE host only (node render_breeze.mjs design blaze) - NEVER clobber approved frozen refs
    const only = a1 && CAST[a1] ? a1 : null
    fs.mkdirSync(VDIR, { recursive: true })
    for (const [who, c] of Object.entries(CAST)) {
      if (only && who !== only) continue
      console.error(`designing ${who}...`)
      const wav = await post('/v1/audio/breeze-design', { text: c.ref_text, design: c.design, cfg_scale: 4.0, seed: c.seed })
      fs.writeFileSync(path.join(VDIR, who + '.wav'), wav)
      fs.writeFileSync(path.join(VDIR, who + '.ref.txt'), c.ref_text)
      console.error(`  ${who}.wav ${(wav.length / 1024).toFixed(0)}KB`)
    }
    console.log(VDIR); return
  }
  if (mode === 'reel') {
    const out = a1 || path.join(ROOT, 'lab', 'engine', 'audio', 'nonverbal_test_reel.mp3')
    const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), 'brz_'))
    const takes = [
      ['Take one. Inline tags in the text.', 'blaze', "Wait wait wait... (laughs) he said WHAT? (exhales) Okay. Okay okay okay. Run it back.", 'incredulous, energetic'],
      ['Take two. Same line, direction only, no tags.', 'blaze', "Wait wait wait... he said WHAT? Okay. Okay okay okay. Run it back.", 'incredulous, bursts out laughing after the word what, sharp exhale, catches his breath, resets fast'],
      ['Take three. Sighs and breathing.', 'knowledge', "You know what... (sighs) I wasn't even going to say anything. (inhales) But since you brought it up.", 'weary, audible sigh mid-line, slow deep breath before the last sentence, unhurried'],
      ['Take four. Whisper to shout.', 'tasha', "And I said... come outside. COME OUTSIDE.", 'drops to a whisper on come outside, then explodes to a full shout on the repeat'],
      ['Take five. Laughing through the line.', 'tasha', "I can't... (laughing) I cannot take this man seriously, look at his face.", 'genuinely cracking up, fighting laughter the whole line, barely keeps composure'],
    ]
    const parts = []
    for (let i = 0; i < takes.length; i++) {
      const [label, who, text, instr] = takes[i]
      console.error(`reel ${i + 1}/${takes.length}: ${label}`)
      const lf = path.join(tmp, `l${i}.wav`); await line('knowledge', label, 'flat neutral announcer read, quick', lf)
      const tf = path.join(tmp, `t${i}.wav`); await line(who, text, instr, tf)
      parts.push(lf, tf)
    }
    concatToMp3(parts, out, tmp); fs.rmSync(tmp, { recursive: true, force: true }); return
  }
  if (mode === 'segment') {
    const seg = a1, out = a2
    if (!seg || !out) { console.error('usage: segment <segment.md> <out.mp3>'); process.exit(1) }
    const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), 'brz_'))
    try { // never leave a brz_* orphan behind when the gateway 409s mid-render
      const lines = []
      // line shape: NAME [any tags]* (delivery): text — tags may be many, mixed-case, with commas
      // (the MIX pass writes "[Booming, confident] [interrupting]"); only a real overlap tag is a cue
      for (const raw of fs.readFileSync(seg, 'utf8').split('\n')) {
        const m = raw.trim().match(/^([A-Z][A-Z .'\-]*?)\s*((?:\[[^\]]*\]\s*)*)\(([^)]*)\)\s*:\s*(.+)$/)
        if (!m) continue
        const who = whoOf(m[1]); if (!who) continue
        const text = m[4].replace(/\[E\d+\]/g, '').replace(/[*_]/g, '').replace(/\s{2,}/g, ' ').trim()
        if (!text || text === '(unusable turn)') continue
        const deliv = (m[3] || '').replace(/\|/g, ', ')
        const tags = (m[2] || '').toLowerCase()
        const tag = /interrupt|cutting in/.test(tags) ? 'cutting in fast, ' : /overlap|talking over|under them/.test(tags) ? 'talking over the last words, ' : ''
        lines.push({ who, text, instruction: `${tag}${deliv || CAST[who].base}` })
      }
      console.error(`${lines.length} lines`)
      const parts = []
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i], f = path.join(tmp, `s${i}.wav`)
        await line(l.who, l.text, l.instruction, f)
        parts.push(f)
        console.error(`${i + 1}/${lines.length} ${l.who} [${l.instruction.slice(0, 40)}] ${l.text.slice(0, 50)}`)
      }
      concatToMp3(parts, out, tmp); return
    } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
  }
  console.error('modes: design | reel [out] | segment <md> <out>'); process.exit(1)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
