#!/usr/bin/env node
/**
 * MAKE SHOW — one command from research→opinion lineage to a rendered AUDIO talk show.
 * Chains: compile_beat (dossier+briefing+stances -> beat card) -> run_floor (the argument) ->
 * render_breeze (voices -> mp3). Writes status.json at each stage so a UI can poll progress.
 * Requires the cast to already be briefed: lab/briefings/<briefing>.agents.json must exist.
 *
 * Usage: node lab/engine/make_show.mjs --stringer=<id> --briefing=<brf_id> [--runtime=8]
 *        [--provider=openrouter] [--seed=7] [--voice] [--show=<slug>] [--jobdir=<dir>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ENGINE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const ROOT = path.resolve(ENGINE, '..', '..')

function slugify(s) { return String(s || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'show' }

async function main() {
  if (!ARG.stringer || !ARG.briefing) { console.error('need --stringer=<id> --briefing=<brf_id>'); process.exit(1) }
  const provider = ARG.provider || 'openrouter'
  const seed = ARG.seed || '7'
  const runtime = ARG.runtime || '8'
  const brf = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'briefings', ARG.briefing + '.json'), 'utf8'))
  const slug = slugify(ARG.show || brf.title || brf.question?.text)
  const showDir = ARG.jobdir ? path.resolve(ARG.jobdir) : path.join(ROOT, 'lab', 'shows', slug)
  fs.mkdirSync(showDir, { recursive: true })
  const statusPath = path.join(showDir, 'status.json')
  const started = new Date().toISOString()
  const setStatus = (stage, pct, message, extra = {}) => {
    fs.writeFileSync(statusPath, JSON.stringify({ stage, pct, message, show: slug, showDir, started, updated: new Date().toISOString(), ...extra }, null, 2))
    console.error(`[${pct}%] ${stage}: ${message}`)
  }
  const node = process.execPath
  const run = (script, args, logName) => {
    const out = execFileSync(node, [path.join(ENGINE, script), ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
    if (logName) fs.writeFileSync(path.join(showDir, logName), out)
    return out
  }

  try {
    // 1) compile the beat card from the cited lineage
    setStatus('compile', 5, 'showrunner compiling beat card from the briefing + cast stances')
    run('compile_beat.mjs', [`--stringer=${ARG.stringer}`, `--briefing=${ARG.briefing}`, `--runtime=${runtime}`, `--out=${showDir}`, `--show=${slug}`], 'compile.log')
    const beatPath = path.join(showDir, 'beatcard.json')
    if (!fs.existsSync(beatPath)) throw new Error('compile produced no beatcard.json')
    const beat = JSON.parse(fs.readFileSync(beatPath, 'utf8'))
    setStatus('floor', 25, `running the floor on ${provider} — ${Object.keys(beat.stances).length} voices arguing`, { question: beat.question, voices: Object.keys(beat.stances) })

    // 2) run the floor (the actual argument)
    const floorDir = path.join(showDir, 'floor')
    run('run_floor.mjs', [`--beat=${beatPath}`, `--provider=${provider}`, `--seed=${seed}`, `--out=${floorDir}`], 'floor.log')
    const segment = path.join(floorDir, 'segment_final.md')
    if (!fs.existsSync(segment)) throw new Error('floor produced no segment_final.md')
    const scriptText = fs.readFileSync(segment, 'utf8')
    const lineCount = (scriptText.match(/^[A-Z][A-Z .']*\s*(?:\[[a-z ]+\])?\s*\([^)]*\)\s*:/gm) || []).length
    setStatus('scripted', 60, `argument written (${lineCount} lines)`, { question: beat.question, segment, lines: lineCount })

    // 3) render audio (optional but the whole point)
    if (ARG.voice) {
      setStatus('audio', 65, 'rendering voices on Breeze (cupcake) — this is the slow part')
      const mp3 = path.join(showDir, slug + '.mp3')
      // Breeze is the approved final voice, but it 409s when the box's video engines hold the GPU.
      // Fall back to Kokoro (separate service) so a show ALWAYS produces audio.
      let engine = 'breeze'
      try { run('render_breeze.mjs', ['segment', segment, mp3], 'audio.log') } catch { engine = '' }
      if (!fs.existsSync(mp3)) { engine = 'kokoro'; setStatus('audio', 75, 'Breeze unavailable (VRAM) — rendering Kokoro draft'); try { run('render_kokoro.mjs', [segment, mp3], 'audio_kokoro.log') } catch { engine = '' } }
      if (!fs.existsSync(mp3)) throw new Error('both voice engines failed (Breeze VRAM + Kokoro)')
      let dur = null; try { dur = Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], { encoding: 'utf8' }).trim())) } catch {}
      setStatus('done', 100, `show ready${dur ? ' — ' + Math.floor(dur / 60) + ':' + String(dur % 60).padStart(2, '0') : ''}${engine === 'kokoro' ? ' (Kokoro draft — Breeze VRAM-blocked)' : ''}`, { question: beat.question, segment, audio: mp3, duration_s: dur, lines: lineCount, voice_engine: engine })
      console.log(mp3)
    } else {
      setStatus('done', 100, 'script ready (no audio requested)', { question: beat.question, segment, lines: lineCount })
      console.log(segment)
    }
  } catch (e) {
    setStatus('error', 0, String(e?.message || e).slice(0, 300), { error: String(e?.message || e).slice(0, 300) })
    process.exit(1)
  }
}
main()
