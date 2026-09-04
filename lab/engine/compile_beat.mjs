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
// key precedence: process env > .env > lab/settings/keys.json (a key pasted in the SETTINGS page); no .env is fine
const readEnvKey = name => {
  const e = process.env[name]; if (e && String(e).trim()) return String(e).trim()
  try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch { /* no .env */ }
  try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v && String(v).trim()) return String(v).trim() } catch { /* no settings file */ }
  return null
}

async function director(question, participants, evidence, showType, modId) {
  const OR = readEnvKey('OPENROUTER_API_KEY')
  if (!OR) return null
  const ids = participants.map(p => p.id)
  const roster = participants.map(p => `- ${p.id} (${p.name}${p.lane ? ', lane: ' + p.lane : ''}) leans: ${p.stance}`).join('\n')
  const ledger = evidence.map(e => `${e.id} [${e.tier}] ${e.claim}`).join('\n')
  // MODERATED COLLISION (First Take): ROLES ARE FIXED by the caller (modId = the pre-chosen neutral anchor) so the
  // model can't collapse into 2-on-1 or drop the referee. Name the moderator + assign the OTHER TWO explicit
  // opposing verdicts (YES vs NO) BY ID - the model only writes the words, never picks who takes which side.
  const debaterIds = modId ? participants.filter(p => p.id !== modId).slice(0, 2).map(p => p.id) : []
  const roleRule = modId && debaterIds.length === 2
    ? ` FORMAT = MODERATED COLLISION (First Take). ROLES ARE FIXED - honor them EXACTLY:\n- ${modId} is the MODERATOR: give them the position "MODERATOR: take NO side; referee and press both debaters." NO verdict, ever.\n- ${debaterIds[0]} MUST argue the YES/affirmative verdict (the strongest case the answer to the question is YES).\n- ${debaterIds[1]} MUST argue the NO/negative verdict (the strongest case the answer is NO).\nEVEN IF a debater's honest lean is nuanced or both privately think "it's unsettled", they COMMIT to their assigned verdict; hedging to "it's complicated / open competition / too soon / time will tell" is a FAILURE (nuance is the moderator's job). Split the receipts so each debater HOLDS the evidence backing THEIR verdict (the moderator may cite any).`
    : ''
  const SYS = `You are THE SHOWRUNNER. You never write dialogue. Your #1 job: ENGINEER DISAGREEMENT so the segment is a real argument, not three people agreeing. The hosts' honest leanings often converge; your job is to ASSIGN each host a DISTINCT, defensible position on the question and split the receipts so no two hosts hold the same hand. When the question is a yes/no or for-vs-against proposition, the positions MUST land on OPPOSING sides: at least one host argues clearly FOR/YES and at least one clearly AGAINST/NO. A segment where every host lands on the same side is a FAILURE. Use ONLY the given participant ids and evidence ids.${roleRule}
Output STRICT JSON only:
{"assignments":[{"host":"<id>","position":"a punchy 1-2 sentence stance that COMMITS to one clear verdict (on a yes/no: an unambiguous YES or NO - never 'it is unsettled / complicated / too soon'; the moderator, if any, is the sole exception) and that this host can defend from the evidence","evidence_ids":["<3-8 ids this host holds; give each host at least one EXCLUSIVE id no other host holds>"]}],
 "opener":{"host":"<id>","instruction":"open flat, set bait, name one concrete fact, then stop. short."},
 "waypoints":[{"after_words":25,"host":"<id>","note":"a NEW angle / a direct challenge to another host's pick"} ... 4 to 6, ascending after_words 25..300, alternating hosts],
 "withheld":[{"host":"<id>","evidence":"<an Eid EXCLUSIVE to that host>","turn":7,"instruction":"NOW detonate this receipt, flat, let it sit"}],
 "detonation_react":{"host":"<a DIFFERENT id who does NOT hold that receipt>","instruction":"you didn't see it coming; react, then defend without dismissing it"},
 "exit":{"host":"<id>","alt_host":"<id>","instruction":"button the segment; concede nothing; tease something heavier"},
 "protected_facts":[{"note":"a fact about a real person that must be phrased precisely","banned_phrasings":["...","..."]}],
 "anaphora_exempt":["<core fact tokens that must be allowed to repeat>"]}
Rules: assignments MUST cover every host exactly once and give them GENUINELY OPPOSING positions wherever the question allows a side (a real for-vs-against split on a yes/no; different picks or a "greatness isn't one moment" reframe on a "which" question) - never all on the same side. Every host/id MUST be one of: ${ids.join(', ')}. Every evidence id MUST be one of the ledger ids. protected_facts only for real-person precision (else []). One sentence per instruction.`
  const user = `THE QUESTION: ${question}\n\nHOSTS (their honest leanings — now assign them to COLLIDE):\n${roster}\n\nEVIDENCE LEDGER (the receipts to split):\n${ledger}`
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + OR, 'Content-Type': 'application/json' },
      // gpt-4.1-mini (still cheap) follows the fixed-role / opposing-verdict instructions far more reliably than
      // flash-lite, which kept collapsing the two debaters onto the same side (iter 9). Override via ARG.director_model.
      body: JSON.stringify({ model: (typeof ARG.director_model === 'string' && ARG.director_model) || 'openai/gpt-4.1-mini', temperature: 0.4, max_tokens: 1600, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] }),
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
  // the show's format + each host's lane drive role-aware collision (moderator vs debaters)
  let showType = null; try { if (briefing.beat) showType = (J(path.join(ROOT, 'lab', 'beats', briefing.beat + '.json')).show || {}).show_type || null } catch {}
  const laneOf = id => { const h = (cast.hosts || []).find(x => x.id === id); return h ? String(h.lane || h.role || (h.print && h.print.essence) || '').slice(0, 100) : '' }

  // 1) evidence.json — the cited ledger the floor joins by id
  const evEntries = (dossier.evidence || []).filter(e => e.valid_source).map(e => ({
    id: e.id, claim: e.claim, source_name: e.source_name || null, source_type: 'research', url: e.url || null, tier: e.truth_label || 'ANALYSIS',
  }))
  const evIds = new Set(evEntries.map(e => e.id))
  const evidence = { topic: dossier.assignment?.text || briefing.title || 'show', compiled: dossier.updated_at || dossier.created_at || null, question: briefing.question?.text, entries: evEntries }

  // 2) participants — HOUSE HOSTS anchor the floor (>=2 required); DELEGATES take the floor too:
  //    an AI delegate argues from its own briefed stance on its own engine; a HUMAN delegate's words are
  //    seated VERBATIM (never rewritten) and voiced by cloning the person's own recording.
  const okDeliveries = (agents.deliveries || []).filter(d => d.ok && d.stance)
  const floorParts = okDeliveries.filter(d => castIds.has(d.cast_id)).slice(0, 3)
  const delegateParts = okDeliveries.filter(d => !castIds.has(d.cast_id))
  if (floorParts.length < 2) { console.error('need >=2 briefed HOUSE HOSTS to run a floor (got ' + floorParts.length + ')'); process.exit(1) }

  const stanceOf = d => [d.stance.answer, d.stance.thesis].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 400)
  const participants = floorParts.map(d => ({ id: d.cast_id, name: d.name, kind: 'host', lane: laneOf(d.cast_id), stance: stanceOf(d), allowed: (d.allowed_evidence_ids || []).filter(id => evIds.has(id)) }))
  // AI delegates join the director's collision (a position + receipts, like a host); max 2 seats
  const aiDelegates = delegateParts.filter(d => !d.human).slice(0, 2).map(d => ({ id: d.cast_id, name: d.name, kind: 'delegate', stance: stanceOf(d), allowed: (d.allowed_evidence_ids || []).filter(id => evIds.has(id)), dna_id: d.dna_id || 'google/gemini-2.5-flash-lite', persona_note: d.persona_note || null }))
  participants.push(...aiDelegates)
  // human delegates: their interview answers become scripted verbatim turns (first two reasons + the verdict)
  const humanDelegates = delegateParts.filter(d => d.human).slice(0, 2).map(d => {
    const reasons = (d.stance.reasons || []).filter(r => r && r.text).slice(0, 2).map(r => ({ text: String(r.text).trim(), asked: r.asked || null }))
    const verdict = d.stance.answer ? [{ text: String(d.stance.answer).trim(), asked: 'verdict' }] : []
    return { id: d.cast_id, name: d.name, kind: 'human', verbatim_turns: [...reasons, ...verdict].filter(t => t.text), voice: d.voice || null, persona_note: d.persona_note || null }
  })

  // 3) SHOWRUNNER: engineer collision (distinct positions + split receipts) + director track
  const pIds = participants.map(p => p.id)
  const isP = id => pIds.includes(id)
  const other = id => pIds.find(x => x !== id) || pIds[0]
  // the receipts to split: the on-topic ids the hosts were briefed on, padded from the ledger
  const poolIds = [...new Set(participants.flatMap(p => p.allowed))]
  for (const e of evEntries) { if (poolIds.length >= 18) break; if (!poolIds.includes(e.id)) poolIds.push(e.id) }
  const poolEntries = poolIds.map(id => evEntries.find(e => e.id === id)).filter(Boolean)
  // pre-choose the neutral moderator by lane (anchor/framing) so roles are fixed BEFORE the model writes stances
  const modId = /moderat/i.test(showType || '') && participants.length >= 3
    ? ((participants.find(p => /anchor|moderat|framing|referee/i.test(laneOf(p.id))) || {}).id || null) : null
  const dir = await director(evidence.question, participants, poolEntries, showType, modId) || {}
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

  // DETERMINISTIC MODERATOR (belt-and-suspenders): the roles were fixed for the director via modId, but the model
  // can still slip and hand the anchor a verdict (iter 8/9: 2-on-1 tilt, no referee). Force the pre-chosen anchor
  // to MODERATE (no verdict) so run_floor sees "MODERATOR:" and referees; the two debaters keep opposing verdicts.
  if (modId) {
    const modP = participants.find(p => p.id === modId)
    if (modP && !/^MODERATOR\b/i.test(modP.stance)) {
      modP.stance = 'MODERATOR: take NO side and never argue a verdict yourself; referee - press BOTH debaters with pointed, specific questions and make them answer.'
      console.error(`moderator locked: ${modP.id} (anchor lane) referees; debaters keep opposing verdicts`)
    }
  }

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
  const targetWords = Math.round(runtimeMin * 46)
  // seat each human's verbatim turns at word marks across the floor (a fan's verdict lands late)
  const human_slots = []
  for (const h of humanDelegates) {
    const marks = h.verbatim_turns.length >= 3 ? [0.22, 0.5, 0.8] : h.verbatim_turns.length === 2 ? [0.3, 0.75] : [0.6]
    h.verbatim_turns.forEach((t, i) => human_slots.push({ key: `${h.id}#${i}`, host: h.id, name: h.name, after_words: Math.round(targetWords * (marks[i] ?? 0.6)), text: t.text, asked: t.asked }))
  }
  human_slots.sort((a, b) => a.after_words - b.after_words)
  const beat = {
    id: (ARG.id || (dossier.assignment?.text || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)),
    show: ARG.show || 'compiled',
    question: evidence.question,
    target_spoken_words: Math.round(runtimeMin * 46),   // one strong segment; ~46 spoken words/min budget in the floor's economy
    max_turns: Math.max(18, Math.round(runtimeMin * 3.4)),
    stances: Object.fromEntries(participants.map(p => [p.id, p.stance])),
    allowed_evidence: Object.fromEntries(participants.map(p => [p.id, p.allowed])),
    participants: [...participants.map(p => ({ id: p.id, name: p.name, kind: p.kind })), ...humanDelegates.map(h => ({ id: h.id, name: h.name, kind: 'human', voice: h.voice }))],
    delegates: { ai: aiDelegates.map(d => ({ id: d.id, name: d.name, dna_id: d.dna_id, persona_note: d.persona_note })), human: humanDelegates },
    human_slots,
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
  if (aiDelegates.length) console.log('  AI delegates on the floor:', aiDelegates.map(d => d.name).join(', '))
  if (humanDelegates.length) console.log('  human delegates seated verbatim:', humanDelegates.map(h => `${h.name} (${h.verbatim_turns.length} turns${h.voice?.sample_wav ? ', own voice' : ''})`).join(', '))
  console.log('  evidence:', evEntries.length, '| waypoints:', waypoints.length, '| withheld:', withheld.length, '| kk_drop:', dropHost)
  console.log('\n  next: node lab/engine/run_floor.mjs --beat=' + path.join(outDir, 'beatcard.json').replace(/\\/g, '/') + ' --provider=openrouter')
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
