#!/usr/bin/env node
/**
 * THE POSTGAME DESK — first implementation of docs/THE-POSTGAME-DESK.md (Robert green-lit 2026-09-07).
 * Run when a game is FINAL:
 *
 *   node lab/engine/postgame.mjs --beat=sc-state --opponent="Florida A&M" [--prep=<slug>] [--app=...]
 *
 * A. RESULT INTAKE - current-mode stringer (web on) for the final score + deciding facts.
 *    THE PHANTOM-SCORE GUARD: the score is accepted only when >=2 DISTINCT publishers carry the
 *    same final score. No agreement = stop and say so (built the same week a build hallucinated
 *    a 48-3 loss that never happened).
 * B. THE RECKONING - parse the prep episode's on-record closing predictions, grade each against
 *    the result dossier: HIT / MISS / PUSH / UNGRADED (ungradable is honest, never guessed).
 * C. THE LEDGER - append graded rows to lab/ledger/<beat>.predictions.jsonl. The file IS the record.
 * D. THE SHOW - segment 1 = the reckoning ritual (Renee reads each host their own words + the
 *    verdict; the host answers for it in character), segment 2 = "what actually decided it"
 *    (a real floor debate, question anchored to the VERIFIED score), stitched by make_episode
 *    (new closing predictions land on the ledger's next page automatically).
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execSync } from 'node:child_process'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] === '' ? true : m[2]] : [a, true] }))
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const APP = typeof ARG.app === 'string' ? ARG.app : 'http://localhost:3000'
const readKey = n => { if (process.env[n]) return process.env[n].trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + n + '=(.+)$', 'm')); if (m) return m[1].trim() } catch {} try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[n]; if (v) return String(v).trim() } catch {} return '' }

const beatId = String(ARG.beat || '')
const OPP = String(ARG.opponent || '')
if (!beatId || !OPP) { console.error('usage: postgame --beat=<id> --opponent="<other team>" [--prep=<prep show slug>]'); process.exit(1) }
const beat = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'beats', beatId + '.json'), 'utf8'))
const TEAM = beat.name || beatId
const cast = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), 'utf8'))

// prep show: named, or the newest build on this beat that has a stamped episode
function findPrep() {
  if (typeof ARG.prep === 'string') return ARG.prep
  const dirs = fs.readdirSync(path.join(ROOT, 'lab', 'shows')).filter(d => fs.existsSync(path.join(ROOT, 'lab', 'shows', d, 'episode.json')))
    .map(d => ({ d, j: JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'shows', d, 'episode.json'), 'utf8')) }))
    .filter(x => x.j.beat === beatId).sort((a, b) => String(b.j.built_at).localeCompare(String(a.j.built_at)))
  if (!dirs.length) { console.error('no stamped prep show found for this beat - pass --prep=<slug>'); process.exit(1) }
  return dirs[0].d
}
const PREP = findPrep()
const prepMd = fs.readFileSync(path.join(ROOT, 'lab', 'shows', PREP, 'episode.md'), 'utf8')

const post = async (p, b, tries = 2) => {
  let lastErr
  for (let a = 1; a <= tries; a++) {
    const res = await fetch(APP + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(600000) })
    const text = await res.text()
    let j; try { j = JSON.parse(text) } catch { throw new Error(`${p} non-JSON (HTTP ${res.status}): ${text.slice(0, 100)}`) }
    if (j.ok) return j
    lastErr = j.error || 'failed'
    // model-output flakes (malformed JSON from the briefing writer etc.) clear on a retry
    if (a < tries) { console.log(`  retry ${p}: ${String(lastErr).slice(0, 80)}`); await new Promise(r => setTimeout(r, 3000)) }
  }
  throw new Error(`${p}: ${lastErr}`)
}
const llm = async (sys, user, maxTok = 700) => {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + readKey('OPENROUTER_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-4.1-mini', temperature: 0.4, max_tokens: maxTok, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(90000),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('llm HTTP ' + r.status)
  return JSON.parse(j.choices[0].message.content)
}

async function main() {
  // ---------- A. RESULT INTAKE ----------
  console.log(`RESULT INTAKE: ${TEAM} vs ${OPP} (beat ${beatId}, prep ${PREP})`)
  const q = `What was the final score and the deciding story of the ${TEAM} at ${OPP} football game this weekend?`
  const s = await post('/api/command/stringer', { input: { kind: 'question', text: q, mode: 'current' }, beat_file: beatId + '.json', web: true })
  const ev = (s.evidence || []).filter(e => e.valid_source)
  const srcById = Object.fromEntries((s.sources || []).map(x => [x.id, x]))
  console.log(`  ${ev.length} evidence from ${new Set((s.sources || []).map(x => x.publisher)).size} publishers`)

  // THE PHANTOM-SCORE GUARD: a final score counts only when >=2 distinct publishers carry it.
  // Scores arrive in TWO shapes: "31-13" (dashes, common in titles) and "Team A 31, Team B 13"
  // (spelled out in claims) - read both, from claims AND from source titles.
  const scoreVotes = new Map() // "hi-lo" -> Set(publishers)
  const vote = (a, b, pub) => {
    if (a > 99 || b > 99 || (a < 2 && b < 2) || a + b < 3) return
    const key = [Math.max(a, b), Math.min(a, b)].join('-')
    if (!scoreVotes.has(key)) scoreVotes.set(key, new Set())
    scoreVotes.get(key).add(pub)
  }
  const scan = (text, pub) => {
    const t = String(text || '')
    for (const m of t.matchAll(/\b(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\b/g)) {
      if (/yard|yd/i.test(t.slice(Math.max(0, m.index - 4), m.index + m[0].length + 6))) continue // "58-yard" is not a score
      vote(+m[1], +m[2], pub)
    }
    // "final score ... Team 31, Team 13" - a score-shaped sentence with exactly two standalone numbers
    if (/final score|beat|defeat|knock(s|ed)? off|win over|won|past|stumbles? to/i.test(t)) {
      const nums = [...t.matchAll(/(?<![\d-])\b(\d{1,2})\b(?!\s*(?:-|–|yard|yd|carries|attempts|catches))/g)].map(m => +m[1])
      if (nums.length === 2) vote(nums[0], nums[1], pub)
    }
  }
  for (const e of ev) scan(e.claim, srcById[e.source_id]?.publisher || 'unknown')
  for (const src of (s.sources || [])) scan(src.title || src.resolved_title, src.publisher || 'unknown')
  const agreed = [...scoreVotes.entries()].filter(([, pubs]) => pubs.size >= 2).sort((x, y) => y[1].size - x[1].size)
  if (!agreed.length) {
    console.error('\nPHANTOM-SCORE GUARD: no final score is carried by two distinct publishers.')
    for (const [k, pubs] of scoreVotes) console.error(`  ${k}: only ${[...pubs].join(', ')}`)
    console.error('Not grading anything against an unconfirmed result. Re-run when coverage lands.')
    process.exit(2)
  }
  const [scoreKey, scorePubs] = agreed[0]
  console.log(`  score locked: ${scoreKey} (agreed by ${[...scorePubs].join(' + ')})`)

  // winner + story, forced to be consistent with the guarded score
  const evText = ev.slice(0, 40).map(e => `[${e.id}] (${srcById[e.source_id]?.publisher || '?'}) ${e.claim}`).join('\n')
  const result = await llm(
    `Sports desk statistician. From the evidence, report the CONFIRMED result of the ${TEAM} vs ${OPP} game. The final score is verified as ${scoreKey} - your job is who won, and the 3-5 deciding facts. STRICT JSON: {"winner":"team name","loser":"team name","score":"W-L from the winner's side","one_line":"the game in one spoken line","facts":[{"fact":"...","evidence":"E##"}]}. Only facts the evidence supports; cite the evidence id for each.`,
    `EVIDENCE:\n${evText}`, 900)
  console.log(`  ${result.winner} beat ${result.loser} ${result.score} - ${result.one_line}`)

  // ---------- B. THE RECKONING ----------
  const preds = []
  for (const m of prepMd.matchAll(/^([A-Z][A-Z .'-]+?)\s*\(closing prediction\):\s*(.+)$/gm)) {
    const name = m[1].trim()
    const host = (cast.hosts || []).find(h => h.name.toUpperCase() === name)
    preds.push({ name, id: host?.id || null, text: m[2].trim() })
  }
  if (!preds.length) { console.error('no closing predictions found in the prep episode - nothing to grade'); process.exit(1) }
  console.log(`\nTHE RECKONING: ${preds.length} on-record predictions from ${PREP}`)
  for (const p of preds) {
    const g = await llm(
      `You grade sports predictions against game evidence. Verdicts: HIT (the call came true), MISS (it did not), PUSH (landed exactly on the line / genuinely ambiguous), UNGRADED (the evidence does not contain the fact needed - THIS IS THE HONEST ANSWER when stats like sack counts are not in evidence; never infer or guess). STRICT JSON: {"verdict":"HIT|MISS|PUSH|UNGRADED","why":"one plain spoken line citing the deciding fact","evidence":"E## or null"}.`,
      `THE GAME: ${result.winner} beat ${result.loser} ${result.score}.\nEVIDENCE:\n${evText}\n\nTHE PREDICTION (made before the game by ${p.name}): "${p.text}"`, 300)
    p.verdict = g.verdict; p.why = g.why; p.evidence = g.evidence || null
    console.log(`  ${p.name}: ${p.verdict} - ${p.why}`)
  }

  // ---------- C. THE LEDGER ----------
  const ldir = path.join(ROOT, 'lab', 'ledger'); fs.mkdirSync(ldir, { recursive: true })
  const lfile = path.join(ldir, beatId + '.predictions.jsonl')
  const existing = fs.existsSync(lfile) ? fs.readFileSync(lfile, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) : []
  for (const p of preds) {
    if (existing.some(r => r.prep === PREP && r.host === p.name && r.prediction === p.text)) { console.log(`  ledger: ${p.name} already graded for ${PREP} - not double-writing`); continue }
    fs.appendFileSync(lfile, JSON.stringify({ ts: new Date().toISOString(), beat: beatId, prep: PREP, game: { team: TEAM, opponent: OPP, winner: result.winner, score: result.score }, host: p.name, host_id: p.id, prediction: p.text, verdict: p.verdict, why: p.why, evidence: p.evidence, dossier: s.id }) + '\n')
  }
  const ledger = fs.readFileSync(lfile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const record = n => { const rows = ledger.filter(r => r.host === n && ['HIT', 'MISS'].includes(r.verdict)); return `${rows.filter(r => r.verdict === 'HIT').length}-${rows.filter(r => r.verdict === 'MISS').length}` }
  console.log(`  ledger: ${lfile} (${ledger.length} rows)`)

  // ---------- D1. THE RECKONING SEGMENT (scripted ritual, in-character answers) ----------
  const segDir = path.join(ROOT, 'lab', 'shows', `${PREP}-reckoning`)
  fs.rmSync(segDir, { recursive: true, force: true }); fs.mkdirSync(path.join(segDir, 'floor'), { recursive: true })
  const L = []
  // one_line often restates the score - keep only its story half so Renee doesn't say 31-13 twice in one breath
  const story = /\d{1,2}\s*[-–]\s*\d{1,2}/.test(result.one_line) ? String(result.one_line).replace(/^.*?\d{1,2}\s*[-–]\s*\d{1,2}[,.]?\s*/i, '').trim() : result.one_line
  L.push(`RENEE VAUGHN [host] (level, opening the reckoning): The game is final: ${result.winner} ${result.score} over ${result.loser}${story ? ', ' + story.replace(/^with\s+/i, '') : ''}. And before we break down one snap of it, this desk answers for its own words. Everything we predicted is on the record, so let's read the record.`)
  for (const p of preds) {
    const first = p.name.split(' ')[0]
    const call = p.verdict === 'HIT' ? 'That is a HIT.' : p.verdict === 'MISS' ? 'That is a MISS.' : p.verdict === 'PUSH' ? 'Dead on the line. That is a PUSH.' : 'The books never printed that number, so the record shows UNGRADED.'
    L.push(`RENEE VAUGHN [host] (dry, reading the record): ${first}, before the game you said, quote: "${p.text}" ${p.why} ${call}`)
    const host = (cast.hosts || []).find(h => h.id === p.id)
    const pr = host?.print || {}
    let resp = null
    try {
      resp = await llm(
        `You write ONE on-air response (2-3 spoken sentences) for a talk-show host being read their own pre-game prediction and its verdict, live on air. WHO THEY ARE: ${(pr.essence || '').slice(0, 260)} VOICE: ${pr.speech?.tone || ''}; ${pr.speech?.sentence_shape || ''}. HOW THEY CONCEDE: ${pr.argument?.concession || 'own it plainly'}. ${p.verdict === 'HIT' ? 'They were RIGHT: one clean flex in character, no gloating past one beat, and give the other side of the desk one jab.' : p.verdict === 'MISS' ? 'They were WRONG: own it IN CHARACTER - directly, no weasel words (unless their print makes excuses, then make a character-true excuse that the room can see through).' : 'The call could not be graded: react in character to being told the number is not on the books.'} Rules: NO greeting, NO restating the full prediction, no em-dashes, no calendar years, 2-3 sentences MAX. Also give a delivery direction (3-6 words). STRICT JSON: {"delivery":"...","line":"..."}`,
        `THE VERDICT read to them on air: "${p.why}" (${p.verdict}). The score: ${result.winner} ${result.score}.`, 260)
    } catch { /* fall back below */ }
    const delivery = resp?.delivery || (p.verdict === 'HIT' ? 'satisfied, measured' : 'owning it, level')
    const line = resp?.line || (p.verdict === 'HIT' ? 'That is exactly how I saw it, and the tape backed me up. Credit where it is due: the desk that watches closest calls it cleanest.' : 'That one is on me. I read it wrong, the game said so, and I will be here next week saying what I see again.')
    L.push(`${p.name} [host] (${delivery}): ${line}`)
  }
  const recs = preds.filter(p => p.id).map(p => `${p.name.split(' ')[0]} is ${record(p.name)} on the season`).join(', ')
  L.push(`RENEE VAUGHN [host] (level, closing the ledger): The book is updated: ${recs}. Every call this desk makes stays on the record, and the comments hold the keys. Now let's get into what actually happened out there.`)
  fs.writeFileSync(path.join(segDir, 'floor', 'segment_final.md'), `# FLOOR - ${PREP}-reckoning\n\n` + L.join('\n') + '\n')
  fs.writeFileSync(path.join(segDir, 'status.json'), JSON.stringify({ question: `The desk answers for its ${OPP} predictions`, stage: 'floor' }, null, 2))
  console.log(`\nreckoning segment written: ${L.length} lines`)

  // ---------- D2. THE ANALYSIS SEGMENT (real floor, question anchored to the VERIFIED result) ----------
  const q2 = `${result.winner} beat ${result.loser} ${result.score}: what actually decided the game - the trenches, the quarterbacks, or the coaching?`
  const aDir = path.join(ROOT, 'lab', 'shows', `${PREP}-postgame`)
  fs.rmSync(aDir, { recursive: true, force: true }); fs.mkdirSync(path.join(aDir, 'floor'), { recursive: true })
  const desk = beat.show?.hosts || ['renee-vaughn', 'cassius-wynn', 'andrew-hammond']
  const s2 = await post('/api/command/stringer', { input: { kind: 'question', text: q2, mode: 'current' }, beat_file: beatId + '.json', web: true })
  const ev2 = (s2.evidence || []).filter(e => e.valid_source).length
  console.log(`[analysis] research: ${ev2} evidence${ev2 < 8 ? '  ⚠ THIN - QA the floor for wrong teams/eras before voicing' : ''}`)
  const b2 = await post('/api/command/briefing', { stringer_id: s2.id, final_question: q2, move_count: 6 })
  const bc = await post('/api/command/briefing/agent', { briefing_id: b2.id, cast_ids: desk })
  const okN = (bc.deliveries || []).filter(x => x.ok).length
  console.log(`[analysis] briefed ${okN}/${desk.length}`)
  if (okN < desk.length) throw new Error('briefs incomplete - re-run')
  execSync(`node lab/engine/compile_beat.mjs --stringer=${s2.id} --briefing=${b2.id} --out=${aDir} --show=${PREP}-postgame --attribution=A`, { cwd: ROOT, stdio: 'inherit' })
  fs.writeFileSync(path.join(aDir, 'status.json'), JSON.stringify({ question: q2, stage: 'floor' }, null, 2))
  execSync(`node lab/engine/run_floor.mjs --beat=${path.join(aDir, 'beatcard.json')} --out=${path.join(aDir, 'floor')} --seed=42 --provider=openrouter 2>${path.join(aDir, 'floor.log')}`, { cwd: ROOT, stdio: 'inherit' })

  // ---------- STITCH ----------
  const outMd = path.join(segDir, 'episode.md')
  execSync(`node lab/engine/make_episode.mjs --beat=${beatId} --segments=${PREP}-reckoning,${PREP}-postgame --topics="The desk answers for its ${OPP.replace(/"/g, '')} predictions|${q2.replace(/"/g, '')}" --out=${outMd}`, { cwd: ROOT, stdio: 'inherit' })
  fs.writeFileSync(path.join(segDir, 'episode.json'), JSON.stringify({ beat: beatId, show: beat.show?.name || beatId, kind: 'postgame', answers: PREP, desk, game: { winner: result.winner, loser: result.loser, score: result.score }, questions: [`reckoning:${OPP}`, q2], segments: [`${PREP}-reckoning`, `${PREP}-postgame`], built_at: new Date().toISOString() }, null, 2))
  console.log(`\nPOSTGAME EPISODE READY: ${outMd}`)
  console.log(`voice it:  node lab/engine/render_breeze.mjs segment ${path.relative(ROOT, outMd)} ${path.relative(ROOT, path.join(segDir, 'SC-STATE-DAILY-postgame.mp3'))}`)
}
main().catch(e => { console.error('POSTGAME FAILED:', e.message); process.exit(1) })
