#!/usr/bin/env node
/**
 * MAKE SHOW — one command from research→opinion lineage to a rendered AUDIO talk show.
 * Chains: compile_beat (dossier+briefing+stances -> beat card) -> run_floor (the argument) ->
 * render_breeze (voices -> mp3, Kokoro fallback). Writes status.json ATOMICALLY at each stage (with
 * pid + heartbeat) so a UI can poll progress, cancel, and detect a dead job. Every stage always leaves
 * a <stage>.log, and a failure reports the LAST stderr lines (the real reason), never the command.
 * Requires the cast to already be briefed: lab/briefings/<briefing>.agents.json must exist.
 *
 * Usage: node lab/engine/make_show.mjs --stringer=<id> --briefing=<brf_id> [--runtime=8]
 *        [--provider=openrouter] [--seed=7] [--voice] [--show=<slug>] [--jobdir=<dir>]
 *        [--attribution=A-F] [--from=compile|floor|audio]   (resume a job dir from a stage)
 *        [--beat=<beat id>] [--app=http://localhost:PORT]    (the take inbox: before compile, every pending take on the
 *        beat is seated on the briefing through <app>/api/command/takes/attach; app = --app, else APP_URL, else PORT,
 *        else :3000; beat = --beat, else inferred from the briefing. Unreachable = a warning, never a failed show.)
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { inferBeat, attachTakes, stampTakes } from './lib/takes_mark.mjs'

const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ENGINE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const ROOT = path.resolve(ENGINE, '..', '..')
const STAGES = ['compile', 'floor', 'audio']

function slugify(s) { return String(s || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'show' }
const lastLines = (s, n = 3) => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(-n).join(' | ')
const mmss = d => d == null ? '?' : Math.floor(d / 60) + ':' + String(d % 60).padStart(2, '0')
const writeAtomic = (p, obj) => { fs.writeFileSync(p + '.tmp', JSON.stringify(obj, null, 2)); fs.renameSync(p + '.tmp', p) }

// append one line to the desk's activity log (same JSONL the control room reads)
function logActivity(e) {
  try {
    const dir = path.join(ROOT, 'lab', 'logs'); fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'activity.jsonl'), JSON.stringify({ ts: new Date().toISOString(), kind: 'build', ...e }) + '\n')
  } catch { /* logging never breaks a build */ }
}

async function main() {
  if (!ARG.stringer || !ARG.briefing) { console.error('need --stringer=<id> --briefing=<brf_id>'); process.exit(1) }
  const provider = ARG.provider || 'openrouter'
  const seed = ARG.seed || '7'
  const runtime = ARG.runtime || '8'
  const from = STAGES.includes(String(ARG.from)) ? String(ARG.from) : 'compile'
  const brf = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'briefings', ARG.briefing + '.json'), 'utf8'))
  // unique per briefing so two shows from the same subject can never overwrite each other
  const slug = ARG.show ? slugify(ARG.show) : `${slugify(brf.title || brf.question?.text)}-${String(ARG.briefing).slice(4, 10)}`
  const showDir = ARG.jobdir ? path.resolve(ARG.jobdir) : path.join(ROOT, 'lab', 'shows', slug)
  fs.mkdirSync(showDir, { recursive: true })
  const statusPath = path.join(showDir, 'status.json')
  const t0 = Date.now()
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(statusPath, 'utf8')) } catch {}
  const started = (from !== 'compile' && prev.started) || new Date().toISOString()
  let curStage = from
  const setStatus = (stage, pct, message, extra = {}) => {
    curStage = STAGES.includes(stage) ? stage : curStage
    writeAtomic(statusPath, { stage, pct, message, show: slug, showDir, briefing: ARG.briefing, stringer: ARG.stringer, pid: process.pid, started, updated: new Date().toISOString(), ...extra })
    console.error(`[${pct}%] ${stage}: ${message}`)
  }
  const fail = (e, stage) => {
    const msg = String(e?.message || e).slice(0, 400)
    setStatus('error', 0, msg, { error: msg, failed_stage: stage || curStage, elapsed_s: Math.round((Date.now() - t0) / 1000) })
    logActivity({ stage: stage || curStage, ok: false, ref: slug, ms: Date.now() - t0, summary: `build failed at ${stage || curStage}`, error: msg })
  }
  // a killed / crashed job must never sit at "floor 40%" forever
  process.on('uncaughtException', e => { fail(e); process.exit(1) })
  process.on('unhandledRejection', e => { fail(e); process.exit(1) })
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { setStatus('cancelled', 0, `cancelled during ${curStage}`, { failed_stage: curStage }); process.exit(130) })

  const node = process.execPath
  // ALWAYS writes <stage>.log (stdout + stderr); on failure throws the last stderr lines
  const run = (script, args, logName) => {
    const r = spawnSync(node, [path.join(ENGINE, script), ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
    if (logName) { try { fs.writeFileSync(path.join(showDir, logName), (r.stdout || '') + '\n--- stderr ---\n' + (r.stderr || '')) } catch {} }
    if (r.error) throw new Error(`${script}: ${r.error.message}`)
    if (r.status !== 0) throw new Error(`${script}: ${lastLines(r.stderr) || lastLines(r.stdout) || 'exit ' + r.status} (see ${logName || 'log'})`)
    return r.stdout || ''
  }
  // both renderers stage wavs in temp dirs under the show dir; a failed render must not leave orphans
  const cleanupTemp = () => { try { for (const d of fs.readdirSync(showDir)) if (/^(brz|kok)_/.test(d)) fs.rmSync(path.join(showDir, d), { recursive: true, force: true }) } catch {} }

  try {
    const beatPath = path.join(showDir, 'beatcard.json')
    const floorDir = path.join(showDir, 'floor')
    const segment = path.join(floorDir, 'segment_final.md')

    // 0) the take inbox: every pending take on the beat becomes a verbatim human delegate on this briefing (compile
    //    reads the agents file, so this has to land first). A person who dropped a take AFTER this moment stays
    //    pending for the next show: never half-seated. Unreachable app = warn and continue.
    const beatId = ARG.beat ? String(ARG.beat) : inferBeat(ROOT, brf)
    const app = ARG.app ? String(ARG.app) : (process.env.APP_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3000'))
    let inbox = { ok: false, error: 'skipped (not a compile run)', seated: [], skipped: [] }
    if (from === 'compile' || !fs.existsSync(beatPath)) {
      if (!beatId) { inbox = { ok: false, error: 'no --beat given and the beat could not be inferred from the briefing; the take inbox was not consulted', seated: [], skipped: [] }; console.error('WARNING: ' + inbox.error) }
      else {
        setStatus('compile', 3, `seating the take inbox for ${beatId} on the briefing…`)
        inbox = await attachTakes(app, beatId, ARG.briefing)
        if (inbox.ok) console.error(`take inbox: ${inbox.seated.length ? inbox.seated.join(', ') + ' seated' : 'nobody waiting'}${inbox.skipped.length ? ' · skipped: ' + inbox.skipped.map(s => `${s.name} (${s.reason})`).join('; ') : ''}`)
        else console.error(`WARNING: take inbox unreachable at ${app} (${inbox.error}) — building without it`)
        logActivity({ stage: 'inbox', ok: inbox.ok, beat: beatId, ref: slug, summary: inbox.ok ? `take inbox seated ${inbox.seated.length} · skipped ${inbox.skipped.length}` : `take inbox unreachable at ${app}, building without it`, error: inbox.ok ? null : inbox.error, meta: { briefing: ARG.briefing, seated: inbox.seated, app } })
      }
    }

    // 1) compile the beat card from the cited lineage
    if (from === 'compile' || !fs.existsSync(beatPath)) {
      setStatus('compile', 5, 'showrunner compiling beat card from the briefing + cast stances', { inbox: inbox.ok ? { seated: inbox.seated, skipped: inbox.skipped } : { error: inbox.error } })
      run('compile_beat.mjs', [`--stringer=${ARG.stringer}`, `--briefing=${ARG.briefing}`, `--runtime=${runtime}`, `--out=${showDir}`, `--show=${slug}`, `--attribution=${ARG.attribution || 'A'}`], 'compile.log')
      if (!fs.existsSync(beatPath)) throw new Error('compile produced no beatcard.json (see compile.log)')
    }
    const beat = JSON.parse(fs.readFileSync(beatPath, 'utf8'))

    // 2) run the floor (the actual argument) — heartbeats turn progress into status.json
    if (from !== 'audio' || !fs.existsSync(segment)) {
      setStatus('floor', 25, `running the floor on ${provider} — ${Object.keys(beat.stances).length} voices arguing`, { question: beat.question, voices: Object.keys(beat.stances) })
      run('run_floor.mjs', [`--beat=${beatPath}`, `--provider=${provider}`, `--seed=${seed}`, `--out=${floorDir}`, `--status=${statusPath}`], 'floor.log')
      if (!fs.existsSync(segment)) throw new Error('floor produced no segment_final.md (see floor.log)')
    }
    const scriptText = fs.readFileSync(segment, 'utf8')
    const lineCount = (scriptText.match(/^[A-Z][A-Z .'\-]*?\s*(?:\[[^\]]*\]\s*)*\([^)]*\)\s*:/gm) || []).length
    setStatus('scripted', 60, `argument written (${lineCount} lines)`, { question: beat.question, segment, lines: lineCount })

    // 3) render audio (optional but the whole point)
    if (ARG.voice) {
      setStatus('audio', 65, 'rendering voices on Breeze (cupcake) — this is the slow part', { question: beat.question, segment, lines: lineCount })
      const mp3 = path.join(showDir, slug + '.mp3')
      try { fs.rmSync(mp3, { force: true }) } catch {}   // a stale mp3 from a prior run must never pass as this run's output
      cleanupTemp()
      // Breeze is the approved final voice; it 409s when the box's video engines hold the GPU.
      // Fall back to Kokoro so a show ALWAYS produces audio — and say WHY in the status.
      let engine = 'breeze', breezeWhy = ''
      try { run('render_breeze.mjs', ['segment', segment, mp3], 'audio.log') } catch (e) { engine = ''; breezeWhy = String(e?.message || e).slice(0, 160); cleanupTemp() }
      if (!fs.existsSync(mp3)) {
        engine = 'kokoro'
        setStatus('audio', 75, `Breeze failed (${breezeWhy || 'no mp3'}) — rendering Kokoro draft`, { question: beat.question, segment, lines: lineCount, breeze_error: breezeWhy })
        try { run('render_kokoro.mjs', [segment, mp3], 'audio_kokoro.log') } catch (e) { engine = ''; breezeWhy += ' | kokoro: ' + String(e?.message || e).slice(0, 160); cleanupTemp() }
      }
      if (!fs.existsSync(mp3) || !engine) throw new Error('both voice engines failed — ' + breezeWhy)
      let dur = null; try { dur = Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], { encoding: 'utf8' }).trim())) } catch {}
      const label = `show ready${dur ? ' — ' + mmss(dur) : ''}${engine === 'kokoro' ? ' (Kokoro draft — Breeze: ' + (breezeWhy || 'unavailable') + ')' : ''}`
      setStatus('done', 100, label, { question: beat.question, segment, audio: mp3, duration_s: dur, lines: lineCount, voice_engine: engine, breeze_error: breezeWhy || null, elapsed_s: Math.round((Date.now() - t0) / 1000) })
      // provenance law: every rendered file gets a manifest row the moment it exists
      // columns: | file | length | words written by | voiced by | cast/voice | notes |
      try {
        const q = String(beat.question || '').replace(/\|/g, '/').slice(0, 90)
        fs.appendFileSync(path.join(ENGINE, 'AUDIO_MANIFEST.md'), `\n| ${slug}.mp3 | ${mmss(dur)} | make_show floor on ${provider} (seed ${seed}, ${lineCount} lines) · ${q} | ${engine === 'breeze' ? 'Breeze clone on cupcake (mk-gateway)' : 'Kokoro TTS on cupcake (draft)'} | ${Object.keys(beat.stances).join(', ')} | briefing ${ARG.briefing} · attribution ${ARG.attribution || 'A'} · ${new Date().toISOString().slice(0, 10)} |`)
      } catch {}
      logActivity({ stage: 'done', ok: true, ref: slug, ms: Date.now() - t0, summary: `${lineCount} lines · ${mmss(dur)} · ${engine}`, meta: { briefing: ARG.briefing, question: beat.question } })
      console.log(mp3)
    } else {
      setStatus('done', 100, 'script ready (no audio requested)', { question: beat.question, segment, lines: lineCount, elapsed_s: Math.round((Date.now() - t0) / 1000) })
      logActivity({ stage: 'done', ok: true, ref: slug, ms: Date.now() - t0, summary: `${lineCount} lines · script only` })
      console.log(segment)
    }
    // the takes this briefing seated now point at the show that used them (used_in: briefing id -> show slug)
    if (beatId) { try { const st = stampTakes(ROOT, beatId, ARG.briefing, slug); if (st.length) console.error(`take inbox: ${st.length} take${st.length === 1 ? '' : 's'} stamped used_in=${slug}`) } catch (e) { console.error('WARNING: could not stamp takes: ' + e.message) } }
  } catch (e) {
    fail(e)
    process.exit(1)
  }
}
main().catch(e => {
  // a failure before setStatus exists (e.g. unreadable briefing): only write into a real job dir, never the cwd
  if (ARG.jobdir) { try { writeAtomic(path.join(path.resolve(ARG.jobdir), 'status.json'), { stage: 'error', pct: 0, message: String(e?.message || e).slice(0, 400), error: String(e?.message || e).slice(0, 400), failed_stage: 'compile', updated: new Date().toISOString() }) } catch {} }
  console.error(e); process.exit(1)
})
