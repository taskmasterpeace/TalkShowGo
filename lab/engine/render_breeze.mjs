#!/usr/bin/env node
/**
 * Breeze TTS 2 renderer (cupcake mk-gateway) - the REAL voice engine w/ per-line emotional instruction + nonverbals.
 * Modes:
 *   design <host>                   - (re)design ONE locked cast reference voice -> lab/cast/voices/<host>.wav + .ref.txt
 *                                     (one host at a time, never the whole cast; a ref marked FROZEN in cast.json is refused)
 *   candidates [host]               - render the voice CANDIDATES declared in cast.json (voice.candidates A/B/C) via the
 *                                     DESIGN path (cfg 4.0) -> lab/cast/voices/candidates/<host>-<L>.wav + .ref.txt, then LINEUP.mp3
 *                                     (existing candidate wavs are kept, so an interrupted run resumes; delete a wav to re-roll)
 *   lineup                          - rebuild candidates/LINEUP.mp3 from the candidate wavs on disk (no GPU needed)
 *   reel <out.mp3>                  - nonverbal test reel (inline tags vs instruction-driven takes, self-labeled)
 *   segment <segment.md> <out.mp3>  - render a segment: breeze-clone per line, instruction = persona base + delivery parenthetical
 *
 * EVEN AUDIO (Robert 2026-09-02, "mix it so the audio is even"): before the concat, every SPEAKER's integrated loudness
 * (EBU R128, all of their parts measured together) gets ONE gain that brings that speaker to -16 LUFS. The gain is per
 * speaker, never per line, so a whisper stays a whisper and a shout stays a shout inside each voice. The full mix then
 * gets a measured two-pass loudnorm (I=-16, TP=-1.5, LRA=11). Per-speaker before/after LUFS lines go to stderr, which
 * make_show captures in the show's audio.log.
 * Every mp3 rendered here must get an AUDIO_MANIFEST.md row.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync, spawnSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
// key precedence: process env > .env > lab/settings/keys.json (a key pasted in the SETTINGS page); no .env is fine
const readKey = name => { const e = process.env[name]; if (e && e.trim()) return e.trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch { /* no .env */ } try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v && String(v).trim()) return String(v).trim() } catch { /* no settings file */ } return undefined }
const KEY = readKey('CUPCAKE_GATEWAY_KEY')
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'
const VDIR = path.join(ROOT, 'lab', 'cast', 'voices')
const CDIR = path.join(VDIR, 'candidates')
const SHORT = { 'marcus-blaze': 'blaze', 'king-knowledge': 'knowledge', 'tasha-raw': 'tasha', 'champagne-dwayne': 'dwayne' }
const sleep = ms => new Promise(r => setTimeout(r, ms))

/* Cast voice config lives in cast.json (voice.aesthetic / voice.seed / voice.ref_text / voice.candidates) so the UI can edit it.
 * CFG LAW (breeze-tts-2 skill): design + real direction = 4.0; pure clone / base read = 1.0. Never 1.3. */
const FALLBACK = {
  tasha: { design: 'Young Black American woman, late twenties, sharp quick delivery, low warm tone with a permanent smirk in it, street-smart podcast host, crisp diction, dry and effortlessly cool', ref_text: "I read every comment so you don't have to, and baby, the comments were NOT kind. Somebody has to say the thing everybody's thinking. That's me. That's the job.", base: 'sharp, amused, zero patience, fast', seed: 101 },
  blaze: { design: 'Big booming American male sports-debate host, thirties, deep chest-resonant baritone, slightly gravelly, explosive projection like arguing on live television, speeds up when excited, huge dynamic range, clear full-bodied close-mic studio quality', ref_text: "Now HOLD ON, hold on, because everybody in this room is missing the point! I watched the whole thing twice, TWICE, and I am telling you nobody is built like this man. Nobody!", base: 'explosive, incredulous, big dynamic swings', seed: 202 },
  knowledge: { design: 'Older American man, late fifties, deep low resonant voice, slow deliberate cadence, calm gravitas, wise barbershop elder who has seen everything twice, unhurried, clear texture, close-mic studio quality', ref_text: "See, y'all are arguing about the wave, and nobody is watching the tide. I've seen this exact story before. Different names, same ending. Sit down, I'll tell it.", base: 'low, slow, measured, total certainty', seed: 303 },
  dwayne: { design: 'smooth, silky mid-thirties Black American man, laid-back champagne-lounge baritone, playful and sing-song when he is amused, a little flashy, unbothered, close-mic late-night radio warmth, clear full-bodied studio quality', ref_text: "Now that was a beautiful argument, gorgeous, I mean that, and it's still wrong, because you argued it with your hands and not your chest. Relax, nobody at this table is mad at you, we're just not gonna pretend with you either.", base: 'laid back, silky, amused, unhurried, a smile in every line', seed: 404, candidate_default: 'A' },
}
const CAST = (() => {
  const out = structuredClone(FALLBACK)
  try {
    const cj = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), 'utf8'))
    for (const h of cj.hosts || []) {
      const short = SHORT[h.id] || h.id
      out[short] = out[short] || {}
      out[short].name = h.name
      if (h.voice?.aesthetic) out[short].design = h.voice.aesthetic
      if (h.voice?.seed) out[short].seed = h.voice.seed
      if (h.voice?.ref_text) out[short].ref_text = h.voice.ref_text
      if (h.voice?.default_instruction) out[short].base = h.voice.default_instruction
      if (h.voice?.candidates) out[short].candidates = h.voice.candidates
      if (h.voice?.candidate_default) out[short].candidate_default = h.voice.candidate_default
      if (/FROZEN/.test(h.voice?._note || '')) out[short].frozen = true   // Robert-approved ref: never redesign
    }
  } catch {}
  return out
})()
// DELEGATE voices, loaded per show from the beat card next to the segment (set in segment mode):
//   human   -> breeze-clone on the person's OWN recording (voice.sample_wav + ref_text)
//   AI      -> a voice designed once from who they are, cached in lab/cast/voices/delegate-<slug>.wav
const EXTRA = {}   // id -> { name, b64, text, seed, base }
async function loadDelegates(showDir) {
  let beat = null; try { beat = JSON.parse(fs.readFileSync(path.join(showDir, 'beatcard.json'), 'utf8')) } catch { return }
  for (const h of (beat.delegates?.human || [])) {
    const wav = h.voice?.sample_wav
    if (wav && fs.existsSync(wav)) EXTRA[h.id] = { name: h.name, b64: fs.readFileSync(wav).toString('base64'), text: String(h.voice.ref_text || '').trim(), seed: 7, base: 'natural, in their own voice, unhurried' }
    else console.error(`  ${h.name}: no voice sample on file, falling back to a designed guest voice`)
    if (!EXTRA[h.id]) EXTRA[h.id] = await designedGuest(h.id, h.name, h.persona_note)
  }
  for (const d of (beat.delegates?.ai || [])) EXTRA[d.id] = await designedGuest(d.id, d.name, d.persona_note)
}
async function designedGuest(id, name, note) {
  const slug = id.replace(/^delegate:/, '').replace(/[^a-z0-9-]/gi, '-')
  const wavP = path.join(VDIR, `delegate-${slug}.wav`), txtP = path.join(VDIR, `delegate-${slug}.ref.txt`)
  const refText = `Look, I'm not on TV, I'm just a fan who actually watches. And I'm telling you, this one's different. I've been saying that for a long time.`
  if (!fs.existsSync(wavP)) {
    const design = `Everyday American caller-in guest, ${note ? note + ', ' : ''}natural conversational voice, warm, unpolished, sounds like a real fan on the phone with the show, clear close-mic`
    console.error(`  designing guest voice for ${name}...`)
    const wav = await post('/v1/audio/breeze-design', { text: refText, design, cfg_scale: 4.0, seed: 400 + (slug.length % 50) })
    fs.mkdirSync(VDIR, { recursive: true }); fs.writeFileSync(wavP, wav); fs.writeFileSync(txtP, refText)
  }
  return { name, b64: fs.readFileSync(wavP).toString('base64'), text: fs.existsSync(txtP) ? fs.readFileSync(txtP, 'utf8').trim() : refText, seed: 400, base: 'natural, conversational, like a fan on the line' }
}
const whoOf = n => {
  const s = n.toLowerCase()
  if (s.includes('tasha')) return 'tasha'; if (s.includes('blaze') || s.includes('marcus')) return 'blaze'; if (s.includes('knowledge') || s.includes('king')) return 'knowledge'
  if (s.includes('dwayne') || s.includes('champagne')) return 'dwayne'
  for (const [id, x] of Object.entries(EXTRA)) if (x.name && s.includes(String(x.name).toLowerCase())) return id   // a delegate, by name
  return null
}
const ff = a => execSync(`ffmpeg -hide_banner -loglevel error -y ${a}`, { stdio: ['ignore', 'inherit', 'inherit'] })

async function post(ep, body, tries = 3) {
  let busyWaits = 0, lastErr
  for (let a = 1; a <= tries;) {
    let res
    try { res = await fetch(GW + ep, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body: JSON.stringify(body) }) }
    catch (e) { lastErr = e; console.error(`  retry ${a}: ${e.message}`); if (++a > tries) break; await sleep(a * 10000); continue }
    if (res.status === 409) {
      // the video engines own the GPU (single-concurrency box): wait it out, 60s x 5 (house law), then say exactly how to resume
      if (++busyWaits > 5) throw new Error('box busy (409): the video engines held the GPU through 5 x 60s waits; rerun this same command once /v1/health shows running:false and queue_depth:0')
      console.error(`  box busy (409): waiting 60s (${busyWaits}/5)`); await sleep(60000); continue
    }
    if (!res.ok) { lastErr = new Error(ep + ' ' + res.status + ' ' + (await res.text()).slice(0, 160)); console.error(`  retry ${a}: ${lastErr.message}`); if (++a > tries) break; await sleep(a * 10000); continue }
    return Buffer.from(await res.arrayBuffer())
  }
  throw lastErr
}
const refOf = who => {
  if (EXTRA[who]) return { b64: EXTRA[who].b64, text: EXTRA[who].text }
  let wav = path.join(VDIR, who + '.wav'), txt = path.join(VDIR, who + '.ref.txt')
  if (!fs.existsSync(wav) && CAST[who]?.candidate_default) {   // no locked ref yet (a new host): the default candidate stands in until Robert picks
    wav = path.join(CDIR, `${who}-${CAST[who].candidate_default}.wav`); txt = path.join(CDIR, `${who}-${CAST[who].candidate_default}.ref.txt`)
  }
  if (!fs.existsSync(wav) || !fs.existsSync(txt)) throw new Error(`no reference voice for ${who}: run "render_breeze.mjs candidates ${who}" (or "design ${who}") first`)
  return { b64: fs.readFileSync(wav).toString('base64'), text: fs.readFileSync(txt, 'utf8').trim() }
}
const voiceOf = who => CAST[who] || EXTRA[who] || { base: '', seed: 7 }
async function line(who, text, instruction, file) {
  const r = refOf(who), v = voiceOf(who)
  // CFG LAW: real direction = 4.0; base/plain read = 1.0 (fast-path graphs exist only for these two)
  const cfg = instruction && instruction.trim() && instruction !== v.base ? 4.0 : 1.0
  const wav = await post('/v1/audio/breeze-clone', { text, ref_audio_b64: r.b64, ref_text: r.text, instruction, cfg_scale: cfg, seed: v.seed })
  fs.writeFileSync(file, wav)
}

// ---------- EVEN AUDIO: per-speaker loudness leveling + measured two-pass loudnorm ----------
const TARGET = { I: -16, TP: -1.5, LRA: 11 }
const fmtLu = v => v === null ? 'n/a' : v.toFixed(1)
const ffCap = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }); return (r.stderr || '') + (r.stdout || '') }
/** integrated loudness (EBU R128) of one file in LUFS, or null when unmeasurable (silence / too short) */
function lufs(file) {
  const m = ffCap(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).match(/\n\s*I:\s+(-?[\d.]+|-inf|nan)\s+LUFS/)
  const v = m ? parseFloat(m[1]) : NaN
  return Number.isFinite(v) ? v : null
}
function concatWav(files, out) {   // lossless join (every part is pcm_f32le 24k mono by then)
  const list = out + '.txt'
  fs.writeFileSync(list, files.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'))
  ff(`-f concat -safe 0 -i "${list}" -c copy "${out}"`)
}
/** parts: wav paths; who: the speaker id of each part (parallel array). Returns leveled f32 parts (float never clips on gain). */
function levelBySpeaker(parts, who, tmp) {
  const norm = parts.map((p, i) => { const n = path.join(tmp, `n${i}.wav`); ff(`-i "${p}" -ar 24000 -ac 1 -c:a pcm_f32le "${n}"`); return n })
  const ids = [...new Set(who)], before = {}, gain = {}
  for (const id of ids) {
    const joined = path.join(tmp, `spk_${String(id).replace(/[^a-z0-9]/gi, '_')}_in.wav`)
    concatWav(norm.filter((_, i) => who[i] === id), joined)
    before[id] = lufs(joined)
    gain[id] = before[id] === null ? 0 : Math.max(-20, Math.min(20, TARGET.I - before[id]))   // one gain per SPEAKER, never per line
  }
  const leveled = norm.map((n, i) => { const o = path.join(tmp, `g${i}.wav`); ff(`-i "${n}" -af volume=${gain[who[i]].toFixed(2)}dB -c:a pcm_f32le "${o}"`); return o })
  for (const id of ids) {   // measure the result honestly rather than assuming before + gain
    const joined = path.join(tmp, `spk_${String(id).replace(/[^a-z0-9]/gi, '_')}_out.wav`)
    concatWav(leveled.filter((_, i) => who[i] === id), joined)
    console.error(`  level ${id}: ${fmtLu(before[id])} -> ${fmtLu(lufs(joined))} LUFS (gain ${gain[id] >= 0 ? '+' : ''}${gain[id].toFixed(1)} dB, ${who.filter(w => w === id).length} parts)`)
  }
  return leveled
}
/** measured two-pass EBU R128 loudnorm on the whole mix (linear when the true peak allows), then mp3 @ 48k */
function masterToMp3(fullWav, out) {
  const p1 = ffCap(['-i', fullWav, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-f', 'null', '-'])
  let m = null; try { m = JSON.parse((p1.match(/\{[\s\S]*?\}/) || ['{}'])[0]) } catch {}
  const ok = m && Number.isFinite(parseFloat(m.input_i)) && parseFloat(m.input_i) > -70
  const measured = ok ? `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` : ''
  if (!ok) console.error('  master: first-pass measurement unusable, applying single-pass loudnorm')
  ff(`-i "${fullWav}" -af "loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}${measured}" -ar 48000 -acodec libmp3lame -q:a 2 "${path.resolve(out)}"`)
  console.error(`  master: mix ${ok ? m.input_i : '?'} -> ${fmtLu(lufs(path.resolve(out)))} LUFS integrated (target ${TARGET.I}, TP ${TARGET.TP}, LRA ${TARGET.LRA}; peak in ${ok ? m.input_tp : '?'} dBTP)`)
}
/** parts -> leveled per speaker -> concat with `gap` seconds of silence -> mastered mp3. who[i] = speaker of parts[i]. */
function concatToMp3(parts, out, tmp, who = null, gap = 0.3) {
  const ids = who && who.length === parts.length ? who : parts.map(() => 'mix')
  const leveled = levelBySpeaker(parts, ids, tmp)
  const sil = path.join(tmp, 'sil.wav'); ff(`-f lavfi -i anullsrc=r=24000:cl=mono -t ${gap} -c:a pcm_f32le "${sil}"`)
  const seq = []; for (const p of leveled) seq.push(p, sil)
  const full = path.join(tmp, 'full.wav'); concatWav(seq, full)
  masterToMp3(full, out)
  const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.resolve(out)}"`).toString().trim()
  console.log(`${path.resolve(out)}  ${Math.round(dur)}s`)
}

const [mode, a1, a2] = process.argv.slice(2)
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1)
const main = async () => {
  if (mode === 'design') {
    // ONE host per run (node render_breeze.mjs design blaze) - never the whole cast, never a FROZEN ref
    const who = a1 && CAST[a1] ? a1 : null
    if (!who) { console.error(`design needs ONE host: ${Object.keys(CAST).join(' | ')}`); process.exit(1) }
    if (CAST[who].frozen && a2 !== '--force') { console.error(`${who}'s ref is FROZEN (Robert approved) - not redesigning. Pass --force only if he asked.`); process.exit(1) }
    const c = CAST[who]
    fs.mkdirSync(VDIR, { recursive: true })
    console.error(`designing ${who} (seed ${c.seed})...`)
    const wav = await post('/v1/audio/breeze-design', { text: c.ref_text, design: c.design, cfg_scale: 4.0, seed: c.seed })
    fs.writeFileSync(path.join(VDIR, who + '.wav'), wav)
    fs.writeFileSync(path.join(VDIR, who + '.ref.txt'), c.ref_text)
    console.error(`  ${who}.wav ${(wav.length / 1024).toFixed(0)}KB  ${fmtLu(lufs(path.join(VDIR, who + '.wav')))} LUFS`)
    console.log(VDIR); return
  }
  if (mode === 'candidates' || mode === 'lineup') {
    // candidates: design every declared candidate (cast.json voice.candidates) that is not on disk yet; lineup: just rebuild the reel
    const only = a1 && CAST[a1] ? a1 : null
    fs.mkdirSync(CDIR, { recursive: true })
    const order = ['blaze', 'knowledge', 'dwayne', ...Object.keys(CAST).filter(k => !['blaze', 'knowledge', 'dwayne'].includes(k))]
    const files = [], who = []
    for (const short of order) {
      const c = CAST[short]; if (!c?.candidates) continue
      for (const [L, cand] of Object.entries(c.candidates)) {
        const wavP = path.join(CDIR, `${short}-${L}.wav`), txtP = path.join(CDIR, `${short}-${L}.ref.txt`)
        const text = `Candidate ${cap1(short)} ${L}. ${c.ref_text}`   // the slate, then the host's own character line (same words across A/B/C: apples to apples)
        if (mode === 'candidates' && (!only || only === short) && !fs.existsSync(wavP)) {
          console.error(`designing ${short}-${L} (${cand.label || ''}, seed ${cand.seed})...`)
          const wav = await post('/v1/audio/breeze-design', { text, design: cand.aesthetic, cfg_scale: 4.0, seed: cand.seed })
          fs.writeFileSync(wavP, wav); fs.writeFileSync(txtP, text)
          console.error(`  ${short}-${L}.wav ${(wav.length / 1024).toFixed(0)}KB  ${fmtLu(lufs(wavP))} LUFS raw`)
        }
        if (fs.existsSync(wavP)) { files.push(wavP); who.push(`${short}-${L}`) }
      }
    }
    if (!files.length) { console.error('no candidate wavs on disk'); process.exit(1) }
    const tmp = fs.mkdtempSync(path.join(CDIR, 'brz_'))
    try { concatToMp3(files, path.join(CDIR, 'LINEUP.mp3'), tmp, who, 0.6) } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
    return
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
    const parts = [], who = []
    for (let i = 0; i < takes.length; i++) {
      const [label, host, text, instr] = takes[i]
      console.error(`reel ${i + 1}/${takes.length}: ${label}`)
      const lf = path.join(tmp, `l${i}.wav`); await line('knowledge', label, 'flat neutral announcer read, quick', lf)
      const tf = path.join(tmp, `t${i}.wav`); await line(host, text, instr, tf)
      parts.push(lf, tf); who.push('knowledge', host)
    }
    concatToMp3(parts, out, tmp, who); fs.rmSync(tmp, { recursive: true, force: true }); return
  }
  if (mode === 'segment') {
    const seg = a1, out = a2
    if (!seg || !out) { console.error('usage: segment <segment.md> <out.mp3>'); process.exit(1) }
    await loadDelegates(path.dirname(path.dirname(path.resolve(seg))))   // showDir/floor/segment.md -> showDir/beatcard.json
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
        lines.push({ who, text, instruction: `${tag}${deliv || voiceOf(who).base}` })
      }
      console.error(`${lines.length} lines`)
      const parts = []
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i], f = path.join(tmp, `s${i}.wav`)
        await line(l.who, l.text, l.instruction, f)
        parts.push(f)
        console.error(`${i + 1}/${lines.length} ${l.who} [${l.instruction.slice(0, 40)}] ${l.text.slice(0, 50)}`)
      }
      concatToMp3(parts, out, tmp, lines.map(l => l.who)); return
    } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
  }
  console.error('modes: design <host> | candidates [host] | lineup | reel [out] | segment <md> <out>'); process.exit(1)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
