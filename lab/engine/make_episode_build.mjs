#!/usr/bin/env node
/**
 * MAKE EPISODE BUILD — the one-command episode builder (Robert's repeatability mandate).
 * Beat + questions in, stitched episode script out; voice it with the printed render command.
 *
 *   node lab/engine/make_episode_build.mjs --beat=sc-state \
 *     --questions="Are they the class of HBCU football?|Should Berry have called off the dogs?"
 *
 * Options:
 *   --slug=scstate      segment dir prefix (default: beat id), segments land in lab/shows/<slug>-s1, -s2...
 *   --desk=id,id,id     override the desk (default: the beat's show.hosts)
 *   --seed=42           floor seed
 *   --resume            keep segments whose floor already finished (crash recovery); default rebuilds all
 *   --app=http://localhost:3000   where the dev server lives
 *
 * Each segment: stringer (current mode, web on) -> briefing -> cast briefs -> compile -> floor.
 * Then: make_episode stitch (cold open / transitions / closing predictions / sign-off) + episode.json
 * build stamp (beat, desk, questions, timings) so any episode can be traced and rebuilt.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execSync } from 'node:child_process'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] === '' ? true : m[2]] : [a, true] }))
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const APP = typeof ARG.app === 'string' ? ARG.app : 'http://localhost:3000'

const beatId = String(ARG.beat || '')
const qRaw = String(ARG.questions || '')
if (!beatId || !qRaw) { console.error('usage: make_episode_build --beat=<id> --questions="Q1|Q2[|Q3]" [--slug=x] [--desk=a,b,c] [--seed=N] [--resume]'); process.exit(1) }
const questions = qRaw.split('|').map(s => s.trim()).filter(Boolean)
if (!questions.length) { console.error('no questions parsed from --questions'); process.exit(1) }

const beatFile = path.join(ROOT, 'lab', 'beats', beatId + '.json')
let beat = null
try { beat = JSON.parse(fs.readFileSync(beatFile, 'utf8')) } catch { console.error(`beat not found: ${beatFile} - bootstrap it first (bootstrap_topic.mjs)`); process.exit(1) }
const desk = typeof ARG.desk === 'string' ? ARG.desk.split(',').map(s => s.trim()).filter(Boolean) : (beat.show?.hosts || [])
if (desk.length < 3) { console.error(`desk needs 3 hosts, got [${desk.join(', ')}] - set show.hosts in the beat or pass --desk=a,b,c`); process.exit(1) }
const slugBase = String(typeof ARG.slug === 'string' ? ARG.slug : beatId)
const seed = parseInt(ARG.seed, 10) || 42

const post = async (p, body) => {
  const res = await fetch(APP + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(600000) })
  const text = await res.text()
  let j = null; try { j = JSON.parse(text) } catch { throw new Error(`${p} returned non-JSON (HTTP ${res.status}): ${text.slice(0, 120)}`) }
  if (!j.ok) throw new Error(`${p}: ${j.error || 'failed'}`)
  return j
}

// the dev server is the research brain - fail with the fix, not a stack trace
try { await fetch(APP + '/api/command', { signal: AbortSignal.timeout(5000) }) } catch { console.error(`dev server not reachable at ${APP} - start it (npm run dev) and re-run`); process.exit(1) }

const t0 = Date.now()
const segs = []
for (let i = 0; i < questions.length; i++) {
  const q = questions[i]
  const slug = `${slugBase}-s${i + 1}`
  const DIR = path.join(ROOT, 'lab', 'shows', slug)
  const finalMd = path.join(DIR, 'floor', 'segment_final.md')
  segs.push({ slug, question: q })
  if (ARG.resume && fs.existsSync(finalMd)) { console.log(`[${slug}] floor already done - resume keeps it`); continue }
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(path.join(DIR, 'floor'), { recursive: true })
  const ts = Date.now()
  const s = await post('/api/command/stringer', { input: { kind: 'question', text: q, mode: 'current' }, beat_file: beatId + '.json', web: true })
  console.log(`[${slug}] research: ${(s.evidence || []).filter(e => e.valid_source).length} evidence${s.web_supplement ? ` (+${s.web_supplement.added} web)` : ''}`)
  const b = await post('/api/command/briefing', { stringer_id: s.id, final_question: q, move_count: 6 })
  const bc = await post('/api/command/briefing/agent', { briefing_id: b.id, cast_ids: desk })
  const okN = (bc.deliveries || []).filter(x => x.ok).length
  console.log(`[${slug}] briefed ${okN}/${desk.length}`)
  if (okN < desk.length) throw new Error(`[${slug}] only ${okN}/${desk.length} briefed - re-run (briefs retry internally, a second pass usually clears it)`)
  execSync(`node lab/engine/compile_beat.mjs --stringer=${s.id} --briefing=${b.id} --out=${DIR} --show=${slug} --attribution=A`, { cwd: ROOT, stdio: 'inherit' })
  fs.writeFileSync(path.join(DIR, 'status.json'), JSON.stringify({ question: q, stage: 'floor' }, null, 2))
  execSync(`node lab/engine/run_floor.mjs --beat=${path.join(DIR, 'beatcard.json')} --out=${path.join(DIR, 'floor')} --seed=${seed} --provider=openrouter 2>${path.join(DIR, 'floor.log')}`, { cwd: ROOT, stdio: 'inherit' })
  console.log(`[${slug}] floor done in ${Math.round((Date.now() - ts) / 1000)}s`)
}

const outDir = path.join(ROOT, 'lab', 'shows', segs[0].slug)
const outMd = path.join(outDir, 'episode.md')
execSync(`node lab/engine/make_episode.mjs --beat=${beatId} --segments=${segs.map(s => s.slug).join(',')} --topics="${questions.join('|').replace(/"/g, '')}" --out=${outMd}`, { cwd: ROOT, stdio: 'inherit' })

// build stamp: enough to trace, rerun, or thumbnail this episode later
const stamp = { beat: beatId, show: beat.show?.name || beatId, desk, seed, questions, segments: segs.map(s => s.slug), built_at: new Date().toISOString(), build_seconds: Math.round((Date.now() - t0) / 1000) }
fs.writeFileSync(path.join(outDir, 'episode.json'), JSON.stringify(stamp, null, 2))

console.log(`\nEPISODE READY: ${outMd}  (${stamp.build_seconds}s)`)
console.log(`voice it:  node lab/engine/render_breeze.mjs segment ${path.relative(ROOT, outMd)} ${path.relative(ROOT, path.join(outDir, (beat.show?.name || beatId).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase() + '-ep.mp3'))}`)
