#!/usr/bin/env node
/**
 * BEAT COMPILER — turns the research→opinion lineage into a beat card the FLOOR engine eats.
 * Inputs (all already produced by the command center):
 *   - a STRINGER dossier   (cited evidence)            lab/research/stringer/<id>.json
 *   - a BRIEFING           (the question)              lab/briefings/<id>.json
 *   - the CAST DELIVERIES  (each host's earned stance) lab/briefings/<id>.agents.json
 * Output (exactly what run_floor.mjs consumes):
 *   <outDir>/evidence.json  +  <outDir>/beatcard.json
 * A DIRECTOR pass (one cheap OpenRouter call) writes the craft layer (opener, waypoints, a withheld
 * receipt, exit) from the stances; everything is then VALIDATED against real ids with deterministic
 * fallbacks, so the beat is always runnable even if the director call is weak.
 *
 * Usage: node lab/engine/compile_beat.mjs --stringer=<id> --briefing=<brf_id> [--out=<dir>] [--runtime=8]
 */
import fs from 'node:fs'
import path from 'node:path'

const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const readEnvKey = name => { try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); return m ? m[1].trim() : null } catch { return null } }

async function director(question, participants, evidence) {
  const OR = readEnvKey('OPENROUTER_API_KEY')
  if (!OR) return null
  const ids = participants.map(p => p.id)
  const roster = participants.map(p => `- ${p.id} (${p.name}) leans: ${p.stance}`).join('\n')
  const ledger = evidence.map(e => `${e.id} [${e.tier}] ${e.claim}`).join('\n')
  const SYS = `You are THE SHOWRUNNER. You never write dialogue. Your #1 job: ENGINEER DISAGREEMENT so the segment is a real argument, not three people agreeing. The hosts' honest leanings often converge; your job is to ASSIGN each host a DISTINCT, defensible position on the question and split the receipts so no two hosts hold the same hand. Use ONLY the given participant ids and evidence ids.
Output STRICT JSON only:
{"assignments":[{"host":"<id>","position":"a punchy 1-2 sentence stance DISTINCT from the others (a different pick / a contrarian reframe / the skeptic) that this host can defend from the evidence","evidence_ids":["<3-8 ids this host holds; give each host at least one EXCLUSIVE id no other host holds>"]}],
 "opener":{"host":"<id>","instruction":"open flat, set bait, name one concrete fact, then stop. short."},
 "waypoints":[{"after_words":25,"host":"<id>","note":"a NEW angle / a direct challenge to another host's pick"} ... 4 to 6, ascending after_words 25..300, alternating hosts],
 "withheld":[{"host":"<id>","evidence":"<an Eid EXCLUSIVE to that host>","turn":7,"instruction":"NOW detonate this receipt, flat, let it sit"}],
 "detonation_react":{"host":"<a DIFFERENT id who does NOT hold that receipt>","instruction":"you didn't see it coming; react, then defend without dismissing it"},
 "exit":{"host":"<id>","alt_host":"<id>","instruction":"button the segment; concede nothing; tease something heavier"},
 "protected_facts":[{"note":"a fact about a real person that must be phrased precisely","banned_phrasings":["...","..."]}],
 "anaphora_exempt":["<core fact tokens that must be allowed to repeat>"]}
Rules: assignments MUST cover every host exactly once and give them GENUINELY different positions (if the question is "which is greatest", assign different picks or a "greatness isn't one moment" reframe). Every host/id MUST be one of: ${ids.join(', ')}. Every evidence id MUST be one of the ledger ids. protected_facts only for real-person precision (else []). One sentence per instruction.`
  const user = `THE QUESTION: ${question}\n\nHOSTS (their honest leanings — now assign them to COLLIDE):\n${roster}\n\nEVIDENCE LEDGER (the receipts to split):\n${ledger}`
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + OR, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', temperature: 0.4, max_tokens: 1600, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] }),
      signal: AbortSignal.timeout(60000),
    })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error?.message || ('director http ' + r.status))
    const t = (j.choices?.[0]?.message?.content || '').trim()
    const a = t.indexOf('{'), b = t.lastIndexOf('}')
    return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t)
  } catch (e) { console.error('director pass failed (' + e.message + '), using deterministic track'); return null }
}

async function main() {
  if (!ARG.stringer || !ARG.briefing) { console.error('need --stringer=<id> --briefing=<brf_id>'); process.exit(1) }
  const dossier = J(path.join(ROOT, 'lab', 'research', 'stringer', ARG.stringer + '.json'))
  const briefing = J(path.join(ROOT, 'lab', 'briefings', ARG.briefing + '.json'))
  const agentsPath = ARG.agents ? path.resolve(ARG.agents) : path.join(ROOT, 'lab', 'briefings', ARG.briefing + '.agents.json')
  const agents = J(agentsPath)
  const cast = J(path.join(ROOT, 'lab', 'cast', 'cast.json'))
  const castIds = new Set((cast.hosts || []).map(h => h.id))

  // 1) evidence.json — the cited ledger the floor joins by id
  const evEntries = (dossier.evidence || []).filter(e => e.valid_source).map(e => ({
    id: e.id, claim: e.claim, source_name: e.source_name || null, source_type: 'research', url: e.url || null, tier: e.truth_label || 'ANALYSIS',
  }))
  const evIds = new Set(evEntries.map(e => e.id))
  const evidence = { topic: dossier.assignment?.text || briefing.title || 'show', compiled: dossier.updated_at || dossier.created_at || null, question: briefing.question?.text, entries: evEntries }

  // 2) participants — only HOUSE HOSTS can take the floor today (delegates surface a stance but the
  //    floor engine binds turns to cast.json hosts + their voices; delegate-in-floor is the next step)
  const okDeliveries = (agents.deliveries || []).filter(d => d.ok && d.stance)
  const floorParts = okDeliveries.filter(d => castIds.has(d.cast_id)).slice(0, 3)
  const delegateParts = okDeliveries.filter(d => !castIds.has(d.cast_id))
  if (floorParts.length < 2) { console.error('need >=2 briefed HOUSE HOSTS to run a floor (got ' + floorParts.length + ')'); process.exit(1) }

  const participants = floorParts.map(d => {
    const allowed = (d.allowed_evidence_ids || []).filter(id => evIds.has(id))
    const stance = [d.stance.answer, d.stance.thesis].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 400)
    return { id: d.cast_id, name: d.name, stance, allowed }
  })

  // 3) SHOWRUNNER: engineer collision (distinct positions + split receipts) + director track
  const pIds = participants.map(p => p.id)
  const isP = id => pIds.includes(id)
  const other = id => pIds.find(x => x !== id) || pIds[0]
  // the receipts to split: the on-topic ids the hosts were briefed on, padded from the ledger
  const poolIds = [...new Set(participants.flatMap(p => p.allowed))]
  for (const e of evEntries) { if (poolIds.length >= 18) break; if (!poolIds.includes(e.id)) poolIds.push(e.id) }
  const poolEntries = poolIds.map(id => evEntries.find(e => e.id === id)).filter(Boolean)
  const dir = await director(evidence.question, participants, poolEntries) || {}
  let collided = 0
  if (Array.isArray(dir.assignments)) {
    for (const a of dir.assignments) {
      if (!a || !isP(a.host)) continue
      const ev = (a.evidence_ids || []).filter(id => evIds.has(id))
      const p = participants.find(x => x.id === a.host)
      if (p && a.position && ev.length) { p.stance = String(a.position).replace(/\s+/g, ' ').trim().slice(0, 400); p.allowed = ev; collided++ }
    }
  }
  console.error(collided >= 2 ? `showrunner engineered ${collided} colliding positions` : 'WARNING: hosts may converge (collision assignment weak) — argument could be flat')

  const opener = (dir.opener && isP(dir.opener.host)) ? dir.opener
    : { host: participants[0].id, instruction: 'Open the beat flat: name the single most concrete fact on the table, set the bait, and stop talking. Short.' }
  let waypoints = Array.isArray(dir.waypoints) ? dir.waypoints.filter(w => w && isP(w.host) && Number.isFinite(+w.after_words)).map(w => ({ after_words: +w.after_words, host: w.host, note: String(w.note || '').slice(0, 220) })) : []
  waypoints.sort((a, b) => a.after_words - b.after_words)
  if (waypoints.length < 3) { // deterministic alternating progression
    const steps = [30, 75, 120, 175, 240]
    waypoints = steps.map((w, i) => ({ after_words: w, host: participants[i % participants.length].id, note: i % 2 ? 'Concede one brick, then flip it with a new angle and new words.' : 'Press your strongest read; make it concrete and human, no repeats.' }))
  }
  // withheld: a receipt the DETONATING host actually holds; reactor must NOT hold it
  let withheld = []
  const cand = participants.find(p => p.allowed.length)
  if (dir.withheld?.[0] && isP(dir.withheld[0].host) && evIds.has(dir.withheld[0].evidence)) {
    const w = dir.withheld[0]; withheld = [{ host: w.host, evidence: w.evidence, turn: Math.min(12, Math.max(5, +w.turn || 7)), instruction: String(w.instruction || 'Detonate the receipt you have been holding. Deliver it flat. Let it sit.').slice(0, 240) }]
  } else if (cand) {
    withheld = [{ host: cand.id, evidence: cand.allowed[cand.allowed.length - 1], turn: 7, instruction: 'Detonate the receipt you have been holding. Deliver it flat and even. Let it sit.' }]
  }
  const reactHost = (dir.detonation_react && isP(dir.detonation_react.host) && (!withheld[0] || dir.detonation_react.host !== withheld[0].host)) ? dir.detonation_react.host : (withheld[0] ? other(withheld[0].host) : participants[0].id)
  const detonation_react = withheld.length ? { host: reactHost, instruction: (dir.detonation_react?.instruction || 'You did not see that coming. React first, then defend your stance without dismissing what was revealed.').slice(0, 240) } : undefined

  const exitHost = (dir.exit && isP(dir.exit.host)) ? dir.exit.host : participants[0].id
  const exit = { host: exitHost, alt_host: other(exitHost), instruction: (dir.exit?.instruction || 'Exhale, concede nothing, and tease that where the show goes next is heavier than this argument.').slice(0, 240) }

  // kk_drop: the analyst hold-then-drop seat. Prefer king-knowledge; else the lowest-interruption host present.
  const behaviorOf = id => (cast.hosts.find(h => h.id === id)?.behavior?.interruption_rate ?? 1)
  const dropHost = pIds.includes('king-knowledge') ? 'king-knowledge' : [...pIds].sort((a, b) => behaviorOf(a) - behaviorOf(b))[0]
  const kk_drop = { host: dropHost, after_turn: Math.max(8, Math.round((ARG.runtime ? +ARG.runtime : 8) * 1.4)), instruction: 'Take the floor for your ONE weight-drop: name the thing the others have been circling without seeing. Two or three sentences, NEW words only, unhurried, air around it. End by reframing the question itself.' }

  const protected_facts = Array.isArray(dir.protected_facts) ? dir.protected_facts.filter(p => p && p.note && Array.isArray(p.banned_phrasings)).slice(0, 4) : []
  // exemptions are matched against lowercased n-grams in the floor guard, so lowercase them here
  const anaphora_exempt = Array.isArray(dir.anaphora_exempt) ? dir.anaphora_exempt.filter(x => typeof x === 'string').map(x => x.toLowerCase()).slice(0, 10) : []

  // ATTRIBUTION MODES (Robert's cite-or-cut / non-lawyery doctrine as a producer dial). Default A =
  // sourced-and-committed: name who said it, then COMMIT to the read - never hedge a claim into mush,
  // never state an unproven claim as settled fact. Higher letters loosen or tighten from there.
  const ATTRIBUTION_MODES = {
    A: { label: 'SOURCED & COMMITTED', law: 'When a receipt is an ATTRIBUTED_CLAIM, name who said it and where (person/outlet + platform), then COMMIT to your read of it - never hedge it into mush. A FACT you state plainly. Never present an unproven claim as settled fact; never bury a real fact under "allegedly".' },
    B: { label: 'NAMED SOURCE', law: 'When a receipt is an ATTRIBUTED_CLAIM, name the source once, then argue it hard. A FACT you state plainly.' },
    C: { label: 'PLATFORM', law: 'Frame an ATTRIBUTED_CLAIM by where it lives ("the word on X", "the tape shows") without over-naming, then commit. A FACT you state plainly.' },
    D: { label: 'REPORTED', law: 'Frame an ATTRIBUTED_CLAIM as reported ("it is being said", "reporting has it") and commit to your take. A FACT you state plainly.' },
    E: { label: 'WORD ON THE STREET', law: 'Treat ATTRIBUTED_CLAIM receipts as rumor - "word on the street", "supposedly" - never as fact. Only a FACT may be stated plainly.' },
    F: { label: 'BARE FACTS', law: 'Lean on FACT receipts, stated plainly. If you touch an ATTRIBUTED_CLAIM, make it unmistakably a claim/opinion, never a fact.' },
  }
  const amode = (ARG.attribution && ATTRIBUTION_MODES[String(ARG.attribution).toUpperCase()]) ? String(ARG.attribution).toUpperCase() : 'A'

  const runtimeMin = ARG.runtime ? +ARG.runtime : 8
  const beat = {
    id: (ARG.id || (dossier.assignment?.text || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)),
    show: ARG.show || 'compiled',
    question: evidence.question,
    target_spoken_words: Math.round(runtimeMin * 46),   // one strong segment; ~46 spoken words/min budget in the floor's economy
    max_turns: Math.max(18, Math.round(runtimeMin * 3.4)),
    stances: Object.fromEntries(participants.map(p => [p.id, p.stance])),
    allowed_evidence: Object.fromEntries(participants.map(p => [p.id, p.allowed])),
    withheld, anaphora_exempt, protected_facts, waypoints,
    attribution: { mode: amode, label: ATTRIBUTION_MODES[amode].label, law: ATTRIBUTION_MODES[amode].law },
    ...(detonation_react ? { detonation_react } : {}),
    kk_drop, opener, exit,
    _compiled_from: { stringer: ARG.stringer, briefing: ARG.briefing, delegates_surfaced: delegateParts.map(d => d.name) },
  }

  const outDir = path.resolve(ARG.out || path.join(ROOT, 'lab', 'shows', beat.id))
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'evidence.json'), JSON.stringify(evidence, null, 2))
  fs.writeFileSync(path.join(outDir, 'beatcard.json'), JSON.stringify(beat, null, 2))
  console.log('BEAT COMPILED')
  console.log('  show dir:', outDir)
  console.log('  question:', beat.question)
  console.log('  floor:', participants.map(p => p.name).join(' vs '))
  if (delegateParts.length) console.log('  delegates surfaced (not yet in floor):', delegateParts.map(d => d.name).join(', '))
  console.log('  evidence:', evEntries.length, '| waypoints:', waypoints.length, '| withheld:', withheld.length, '| kk_drop:', dropHost)
  console.log('\n  next: node lab/engine/run_floor.mjs --beat=' + path.join(outDir, 'beatcard.json').replace(/\\/g, '/') + ' --provider=openrouter')
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
