#!/usr/bin/env node
/**
 * TalkShowGo CONVO ENGINE — FLOOR + MIX (lab rig v1)
 * Runs a beat card through per-host actor calls (default: each host's Model-DNA engine on OpenRouter), then a messiness pass.
 * Usage: node lab/engine/run_floor.mjs --beat=<beatcard.json> --out=<dir> [--provider=openrouter|ollama|requesty] [--seed=42]
 * Every host turn = ONE call carrying ONLY that host's locked bundle + its evidence subset. No host sees withheld receipts.
 * Guards: fact guards (spoken ids, protected facts, invented numbers) run for EVERY host; STYLE guards (anaphora,
 * end-name tic, catchphrase cap, exemplar/self repeat) are a per-host dial - cast.json `guards.style:false` turns them off.
 */
import fs from 'node:fs'
import path from 'node:path'

const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
// optional heartbeat into a make_show status.json (--status=<path>) so the desk sees real turn
// progress during the 2-3 minute floor instead of a frozen percentage
const STATUS_PATH = ARG.status ? path.resolve(String(ARG.status)) : null
const TERMINAL_STAGES = new Set(['done', 'error', 'cancelled'])
function heartbeat(turnNo, maxTurns, spoken, target) {
  if (!STATUS_PATH) return
  try {
    const s = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'))
    // the producer cancelled (or the parent died and was marked) — an orphaned floor must STOP, never
    // resurrect the status back to "floor"
    if (TERMINAL_STAGES.has(s.stage)) { console.error(`status is ${s.stage} — floor stopping`); process.exit(130) }
    const frac = Math.min(1, Math.max(turnNo / Math.max(1, maxTurns || 1), spoken / Math.max(1, target || 1)))
    const next = JSON.stringify({ ...s, stage: 'floor', pct: Math.round(25 + 35 * frac), message: `floor: turn ${turnNo}/${maxTurns} · ${spoken} words`, updated: new Date().toISOString() }, null, 2)
    fs.writeFileSync(STATUS_PATH + '.tmp', next); fs.renameSync(STATUS_PATH + '.tmp', STATUS_PATH)   // atomic: a reader never sees a torn file
  } catch { /* heartbeat is best-effort */ }
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const OLLAMA = process.env.ENGINE_OLLAMA_URL || 'http://192.168.1.249:11434'
const MODELS = {
  'tasha-raw': process.env.ENGINE_MODEL_TASHA || 'hf.co/bartowski/NousResearch_Hermes-4-70B-GGUF:Q4_K_M',
  'marcus-blaze': process.env.ENGINE_MODEL_BLAZE || 'qwen3:30b',
  'king-knowledge': process.env.ENGINE_MODEL_KK || 'qwen3:30b',
  '_mix': process.env.ENGINE_MODEL_MIX || 'qwen3:30b',
}
const PROVIDER = ARG.provider || 'openrouter'   // the 2026-09-02 lineup lives on OpenRouter (cast.json model.dna_id); ollama = the free local fallback

// ---------- utils ----------
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'))
function rng(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296 } }
const words = s => (s.trim().match(/\S+/g) || []).length
const stripThink = s => s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*?<\/think>\s*/, '').trim() // also handles a missing opening tag
// key precedence: process env (the app hydrates it from lab/settings/keys.json at boot) > .env > lab/settings/keys.json
// (a key pasted in the SETTINGS page). A missing .env is fine — a distributed install may never have one.
function readEnvKey(name) {
  const e = process.env[name]; if (e && String(e).trim()) return String(e).trim()
  try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch { /* no .env */ }
  try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v && String(v).trim()) return String(v).trim() } catch { /* no settings file */ }
  return null
}

// --provider=openrouter routes each host's turn to its Model-DNA engine (the proven cheap models).
// This is the fix DELIVERY.md named for the writer ceiling: a stronger conversationalist per seat.
const OR_KEY = readEnvKey('OPENROUTER_API_KEY')
// reasoning models emit long chain-of-thought and stall on fast improv JSON turns (R1 gave only
// "Mm." and 14s "..."). For the FLOOR, swap a reasoner to its fast sibling — the PRINT still drives
// the persona (King stays the Deliberate Mind by his prompt, just on an engine that can keep up).
const FLOOR_SUB = { 'deepseek/deepseek-r1': 'deepseek/deepseek-v3.2-exp' }
const DNA = (() => {
  let cast = { hosts: [] }; try { cast = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), 'utf8')) } catch {}
  const m = {}
  for (const h of cast.hosts || []) { const ov = process.env['ENGINE_DNA_' + h.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')]; let id = ov || h.model?.dna_id; if (id) m[h.id] = FLOOR_SUB[id] || id }
  m._mix = process.env.ENGINE_DNA_MIX || 'google/gemini-2.5-flash-lite'
  return m
})()

// ---------- providers ----------
async function callOllama(model, system, user, temperature, num_predict = 160, jsonFormat = false) {
  // qwen3 on this Ollama build leaks reasoning into content despite think:false; /no_think is the reliable switch
  const sys = /^qwen3/.test(model) ? system + '\n/no_think' : system
  const body = { model, stream: false, think: false, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], options: { temperature, num_predict } }
  if (jsonFormat) body.format = 'json'
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(OLLAMA + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error('ollama ' + res.status + ' ' + (await res.text()).slice(0, 200))
      return stripThink((await res.json()).message.content)
    } catch (e) { lastErr = e; console.error(`  retry ${attempt}/3 after: ${e.message}`); await new Promise(r => setTimeout(r, attempt * 4000)) }
  }
  throw lastErr
}
async function callRequesty(system, user, temperature, max_tokens = 200) {
  const key = readEnvKey('REQUESTY_API_KEY'); if (!key) throw new Error('no REQUESTY_API_KEY in .env')
  const model = process.env.ENGINE_REQUESTY_MODEL || 'anthropic/claude-sonnet-4-20250514'
  const res = await fetch('https://router.requesty.ai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model, temperature, max_tokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error('requesty ' + res.status + ' ' + (await res.text()).slice(0, 200))
  return (await res.json()).choices[0].message.content.trim()
}
async function callOpenRouter(model, system, user, temperature, max_tokens = 200, jsonFormat = false) {
  if (!OR_KEY) throw new Error('no OPENROUTER_API_KEY in .env')
  const body = { model, temperature, max_tokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }
  if (jsonFormat) body.response_format = { type: 'json_object' }
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OR_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) })
      if (!res.ok) {
        const txt = (await res.text()).slice(0, 160)
        // an open-weight route that refuses JSON mode (400 on response_format): drop it, the prompt already demands strict JSON
        if (res.status === 400 && body.response_format && /response_format|json/i.test(txt)) { delete body.response_format; console.error(`  ${model}: no json mode on this route, retrying plain`); continue }
        throw new Error('openrouter ' + res.status + ' ' + txt)
      }
      return stripThink((await res.json()).choices?.[0]?.message?.content || '')
    } catch (e) { lastErr = e; console.error(`  retry ${attempt}/3 after: ${e.message}`); await new Promise(r => setTimeout(r, attempt * 3000)) }
  }
  throw lastErr
}
const call = (hostId, system, user, temperature, n, jsonFormat = true) =>
  PROVIDER === 'requesty' ? callRequesty(system, user, temperature, n)
    : PROVIDER === 'openrouter' ? callOpenRouter(DNA[hostId] || DNA._mix, system, user, temperature, n, jsonFormat)
      : callOllama(MODELS[hostId] || MODELS['_mix'], system, user, temperature, n, jsonFormat)

// ---------- prompt assembly ----------
function hostSystem(host, beat, evTexts, evMeta, sharedLaws) {
  // receipts carry their tier + source so a host can attribute correctly per the beat's attribution mode
  const allowed = (beat.allowed_evidence[host.id] || []).map(id => {
    const e = evMeta?.[id]; const claim = (e && e.claim) || evTexts[id] || ''
    const prov = e && e.tier && e.tier !== 'FACT' ? ` (${e.tier}${e.source_name ? ' · ' + e.source_name : ''})` : ''
    return `[${id}]${prov} ${claim}`
  }).join('\n')
  return [
    `You are ${host.name}, a host on an AI talk show. You are IN a live argument. Output ONLY your next turn.`,
    ...(function renderPrint() {
      const p = host.print || {}
      const t = p.things_they_say || host.exemplars || {}
      const banned = p.lexicon ? (p.lexicon.banned_for_him || p.lexicon.banned_for_her || p.lexicon.banned || []) : []
      return [
        `WHO YOU ARE:\n${p.essence || host.behavioral_core || ''}`,
        p.speech ? `HOW YOU SOUND: tone - ${p.speech.tone}. Pace - ${p.speech.pace}. Register - ${p.speech.register}. Sentence shape - ${p.speech.sentence_shape}. Habits - ${p.speech.delivery_habits}.` : '',
        p.processing ? `HOW YOU PROCESS INFORMATION (this drives every turn):\n- You notice FIRST: ${p.processing.notices_first}\n- You reason by: ${p.processing.reasons_by}\n- You are convinced by: ${p.processing.convinced_by}\n- You dismiss: ${p.processing.dismisses}\n- Your blind spot (you don't know you have it; it shapes your takes): ${p.processing.blind_spot}\n- Your mind changes: ${p.processing.mind_change}` : '',
        p.argument ? `HOW YOU ARGUE: attack - ${p.argument.attack}. Questions - ${p.argument.questions}. Concessions - ${p.argument.concession}. Verdicts - ${p.argument.verdict}.` : '',
        p.emotion ? `YOUR EMOTIONAL SHAPE: default - ${p.emotion.default}. Heat - ${p.emotion.heat_curve}. Humor - ${p.emotion.humor}. Signature move - ${p.emotion.signature_flip}.` : '',
        p.lexicon ? `YOUR LANGUAGE: registers - ${(p.lexicon.registers || []).join(', ')}. Metaphors only from - ${(p.lexicon.metaphor_pools || []).join('; ')}. NEVER use: ${banned.join(', ') || 'n/a'}.` : '',
        `LINES THAT SOUND LIKE YOU — rhythm and attitude reference ONLY. NEVER repeat or lightly reword ANY of them; invent NEW lines in this voice:\n- ` + ((t.signature_lines) || []).join('\n- '),
        p.contrast ? `YOU ARE NOT THE OTHER HOSTS: ${Object.values(p.contrast).join(' | ')}` : '',
      ].filter(Boolean)
    })(),
    `YOUR STANCE THIS BEAT: ${beat.stances[host.id]}`,
    `RECEIPTS YOU ARE ALLOWED TO USE. Put their ids ONLY in the JSON "evidence" array. NEVER speak an id (like E6) out loud in your line - a human would say the FACT, not the label:\n${allowed || '(none - argue from what others say)'}`,
    (beat.attribution?.law ? `HOW TO ATTRIBUTE (house style this beat): ${beat.attribution.law}` : ''),
    (beat.protected_facts && beat.protected_facts.length ? `FACT PRECISION (absolute):\n- ` + beat.protected_facts.map(p => p.note).join('\n- ') : ''),
    `HARD RULES:\n- 1 to 3 sentences, at most ~${Math.round(28 * host.behavior.verbosity + 12)} words. Shorter is stronger.\n- Spoken register: contractions, informal grammar fine. This is talk, not writing.\n- NEVER use facts outside your receipts. Opinion is free but must SOUND like opinion because of who you are, never hedged.\n- No em-dashes. Max ONE catchphrase per episode: ${JSON.stringify(host.catchphrase_rare)} (you have probably already used it, so avoid).\n- Respond to what was ACTUALLY just said. Push back. Do not summarize. Do not validate by default.\n- STAY ON THE ARGUMENT. Never argue about clips, VODs, footage formats, or who watched what. Never react to another host's small sounds. Attack their ARGUMENT, not the furniture.`,
    `OUTPUT STRICT JSON, nothing else: {"line":"what you say - pure human speech, no ids, no brackets","delivery":"3-6 word emotional direction","addressed_to":"${ADDRESS_ENUM}","evidence":["E6"]}`,
  ].join('\n\n')
}
let ADDRESS_ENUM = 'marcus-blaze|tasha-raw|king-knowledge|champagne-dwayne|null'   // rebuilt from the beat's participants in main()
function parseTurn(raw) {
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      let j = JSON.parse(m[0])
      // models sometimes double-wrap: {"line":"{\"line\":\"...\"}"}
      for (let i = 0; i < 3 && typeof j.line === 'string' && j.line.trim().startsWith('{') && j.line.includes('"line"'); i++) { try { j = JSON.parse(j.line) } catch { break } }
      if (j.line && !String(j.line).trim().startsWith('{')) return { line: String(j.line), delivery: String(j.delivery || 'level'), addressed_to: j.addressed_to || null, evidence: Array.isArray(j.evidence) ? j.evidence : [] }
    }
  } catch {}
  const line = raw.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0].slice(0, 300)
  return { line: line.startsWith('{') ? '(unusable turn)' : line, delivery: 'level', addressed_to: null, evidence: [] }
}

// ---------- main ----------
async function main() {
  if (!ARG.beat) { console.error('need --beat='); process.exit(1) }
  const beat = J(path.resolve(ARG.beat))
  const cast = J(path.join(ROOT, 'lab', 'cast', 'cast.json'))
  const showDir = path.dirname(path.resolve(ARG.beat))
  const evidence = J(path.join(showDir, 'evidence.json'))
  const evTexts = Object.fromEntries(evidence.entries.map(e => [e.id, e.claim]))
  const evMeta = Object.fromEntries(evidence.entries.map(e => [e.id, e]))   // id -> {claim, tier, source_name} for attribution
  const hosts = Object.fromEntries(cast.hosts.map(h => [h.id, h]))
  // DELEGATES on the floor: an AI delegate is a synthetic host on its own engine; a human delegate is
  // a name + verbatim turns (never generated). Older beat cards without participants = house hosts only.
  for (const d of (beat.delegates?.ai || [])) {
    if (hosts[d.id]) continue
    hosts[d.id] = { id: d.id, name: d.name, kind: 'delegate', print: { essence: `${d.name}, a DELEGATE on this show: a real voice brought in to represent a point of view, not a house host.${d.persona_note ? ' Who they are: ' + d.persona_note + '.' : ''} You talk plainly, in your own voice, like a sharp fan who actually cares. No broadcaster polish, no fence-sitting.` }, behavior: { verbosity: 0.9, interruption_rate: 0.25, backchannel_rate: 0.1 }, model: { temperature: 0.85, dna_id: d.dna_id }, catchphrase_rare: [] }
    if (d.dna_id) DNA[d.id] = FLOOR_SUB[d.dna_id] || d.dna_id
  }
  for (const h of (beat.delegates?.human || [])) if (!hosts[h.id]) hosts[h.id] = { id: h.id, name: h.name, kind: 'human', behavior: { verbosity: 1, interruption_rate: 0, backchannel_rate: 0 }, model: { temperature: 0 }, catchphrase_rare: [] }
  // older cards without a participants list: seat the house hosts the card actually briefed (a stance), never the
  // whole cast - a fourth host (Dwayne) must never appear on a floor that gave him no stance and no receipts
  const briefed = cast.hosts.filter(h => beat.stances && beat.stances[h.id] !== undefined)
  const speakers = (beat.participants || []).length ? (beat.participants || []).filter(p => p.kind !== 'human').map(p => hosts[p.id]).filter(Boolean) : (briefed.length >= 2 ? briefed : cast.hosts)
  ADDRESS_ENUM = [...speakers.map(s => s.id), ...(beat.delegates?.human || []).map(h => h.id), 'null'].join('|')
  // guards.style is the per-host DIAL (cast.json shared_rules.guards_law); fact guards are never dialed
  const styleGuards = id => hosts[id]?.guards?.style !== false
  console.error(`floor: ${PROVIDER} · ` + speakers.map(s => `${s.id}=${PROVIDER === 'openrouter' ? (DNA[s.id] || DNA._mix) : PROVIDER === 'requesty' ? 'requesty' : (MODELS[s.id] || MODELS._mix)}${styleGuards(s.id) ? '' : ' [no style guards]'}`).join(' · '))
  const outDir = path.resolve(ARG.out || path.join(ROOT, 'lab', 'engine', 'runs', 'run_' + Date.now()))
  fs.mkdirSync(outDir, { recursive: true })
  const rand = rng(Number(ARG.seed || 42))
  const laws = cast.shared_rules.conversation_laws.join(' | ')
  const BC = { 'king-knowledge': ['Mm.', 'Whew.', 'Hm.'], 'marcus-blaze': ['Okay okay.', 'Nah.', 'Come ON.'], 'tasha-raw': ['Right.', 'Cap.', 'Mmhm.'], 'champagne-dwayne': ['Mm-hm.', 'Okay now.', 'Look at you.'] }

  const turns = []
  let spoken = 0, turnNo = 0, kkDropped = false, detonated = new Set()
  // model-facing transcript: backchannels are texture, not content - hosts must never see or argue with them
  const transcript = () => turns.filter(t => !t.bc).map(t => `${t.name}${t.tag ? ' [' + t.tag + ']' : ''} (${t.delivery}): ${t.line}`).join('\n')

  const jaccard = (a, b) => { const A = new Set(a.toLowerCase().match(/[a-z']+/g) || []), B = new Set(b.toLowerCase().match(/[a-z']+/g) || []); if (!A.size || !B.size) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / (A.size + B.size - i) }
  const SPELLED = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' }
  const ngrams = (s, n) => { const w = s.toLowerCase().match(/[a-z']+/g) || []; const out = []; for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' ')); return out }
  function badTurn(hostId, line) {
    // ---- FACT guards: never a dial, every host, every turn ----
    if (/\bE\d+\b/.test(line)) return 'you said an evidence id out loud; humans say the FACT, never the label'
    // protected facts: phrasings the beat card explicitly bans (fact-precision on real people)
    for (const pf of (beat.protected_facts || [])) for (const b of pf.banned_phrasings) if (line.toLowerCase().includes(b.toLowerCase())) return 'FACT PRECISION: ' + pf.note
    // numeric hallucination guard: any number not in this host's receipts NOR already spoken on the floor is invented
    const allowedText = ((beat.allowed_evidence[hostId] || []).map(id => evTexts[id] || '').join(' ') + ' ' + beat.question + ' ' + turns.map(t => t.line).join(' '))
    const allowedNums = new Set(allowedText.toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, m => SPELLED[m]).match(/\d+/g) || [])
    const lineNums = (line.toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, m => SPELLED[m]).match(/\d+/g) || [])
    for (const n of lineNums) if (!allowedNums.has(n)) return `the number ${n} is not in your receipts; you invented it - drop the number or use a fact you actually hold`
    // ---- STYLE guards: the per-host dial (cast.json guards.style; false = an unfiltered host, no tic policing) ----
    if (styleGuards(hostId)) {
      // anaphora guard: a 3-word phrase said 2x is dead; a 2-word phrase said 3x is dead (kills short-volley tennis)
      // ...but FACTS are never tics: n-grams carrying the beat's core fact tokens are exempt (banning "she said 'you'" starved run_008)
      const exempt = beat.anaphora_exempt || []
      for (const [n, cap] of [[3, 2], [2, 3]]) {
        const counts = {}
        for (const t of turns) for (const g of new Set(ngrams(t.line, n))) counts[g] = (counts[g] || 0) + 1
        for (const g of new Set(ngrams(line, n))) {
          if (exempt.some(e => g.includes(e))) continue
          if (counts[g] >= cap) return `the phrase "${g}" has been beaten to death in this room - that phrasing is DEAD, find completely new words`
        }
      }
      // end-name tic: ending every line with your opponent's name reads fake fast
      const endsWithName = l => /,?\s+(marcus|blaze|tasha|king|knowledge|champagne|dwayne)[.!?"']*\s*$/i.test(l.trim())
      if (endsWithName(line) && turns.filter(t => t.id === hostId && endsWithName(t.line)).length >= 2) return 'you keep ending your lines with his name - it has become a tic; end this line on the POINT instead'
      // catchphrase law: yours max once per episode, another host's NEVER
      for (const h of cast.hosts) for (const c of (h.catchphrase_rare || [])) {
        const stem = c.toLowerCase().replace(/[^a-z]/g, '').slice(0, Math.max(4, c.length - 2)) // "Periodt" also catches the "Period." dodge
        const hasIt = l => l.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).some(w => w.startsWith(stem))
        if (hasIt(line)) {
          if (h.id !== hostId) return `"${c}" is ${h.name}'s signature, not yours - never use another host's words`
          if (turns.some(t => t.id === hostId && hasIt(t.line))) return `you already used your catchphrase "${c}" (or a variant of it) this episode - once is the cap`
        }
      }
      // exemplar / self repeat: a draft that is mostly the room's last lines or the host's own known lines
      const recent = turns.slice(-3).map(t => t.line)
      const exemplars = hosts[hostId].print?.things_they_say?.signature_lines || hosts[hostId].exemplars?.signature_lines || []
      const ownPast = turns.filter(t => t.id === hostId).map(t => t.line)
      for (const prev of [...recent, ...exemplars, ...ownPast]) if (jaccard(line, prev) > 0.55) return 'your draft repeated the room or your own known lines; say something NEW that advances the argument'
    }
    return null
  }
  async function speak(hostId, instruction, tag) {
    const host = hosts[hostId]
    const sys = hostSystem(host, beat, evTexts, evMeta, laws)
    const lastLine = turns.length ? turns[turns.length - 1] : null
    const mine = turns.filter(t => t.id === hostId).map(t => '"' + t.line + '"')
    const antiRepeat = `ANTI-REPEAT (absolute): never repeat or echo any phrase already in the transcript, yours or theirs, and never reuse your signature lines. ADVANCE the argument: a new angle, a new consequence, a concession-then-counter.` + (mine.length ? `\nLines you already said (dead to you now): ${mine.slice(-4).join(' ')}` : '')
    const respond = lastLine ? `THE LAST THING SAID (respond TO it, do not echo it): ${lastLine.name}: "${lastLine.line}"` : '(you open the beat)'
    const floorState = `THE QUESTION ON THE FLOOR (stay on it): ${beat.question}\nYOUR STANCE RIGHT NOW: ${beat.stances[hostId]}`
    const buildUser = extra => `TRANSCRIPT SO FAR:\n${transcript() || '(empty)'}\n\n${floorState}\n\n${respond}\n\n${antiRepeat}\n\n${instruction ? 'DIRECTOR NOTE (obey it, and for this turn IGNORE your signature lines entirely): ' + instruction + '\n\n' : ''}${extra ? 'YOUR PREVIOUS DRAFT WAS REJECTED: ' + extra + '\n\n' : ''}Your next turn ONLY. JSON only.`
    const t0 = Date.now()
    let t = null, problem = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      // attempt 3: physically remove the exemplars so recital is impossible
      const sysA = attempt < 3 ? sys : sys.replace(/LINES THAT SOUND LIKE YOU[\s\S]*?(?=YOUR STANCE THIS BEAT)/, '')
      const note = attempt === 3 && problem ? problem + ' | For this attempt: PLAIN SPEECH ONLY. No aphorisms, no metaphors, no punchlines. Just say the true thing simply, like a tired person who means it.' : problem
      const raw = await call(hostId, sysA, buildUser(note), Math.min(1.2, host.model.temperature + (attempt - 1) * 0.1), instruction ? 280 : 160)
      t = parseTurn(raw)
      problem = badTurn(hostId, t.line)
      if (!problem) break
      console.error(`  reject#${attempt}(${hostId}): ${problem}`)
    }
    t.line = t.line.replace(/\[?\bE\d+\b\]?(?:'s)?/g, '').replace(/\s{2,}/g, ' ').replace(/—/g, '...').trim()
    // a regular turn that survived nothing gets SKIPPED, never rendered as a placeholder; scripted beats keep best attempt
    if (!t.line || t.line === '(unusable turn)' || (problem && !instruction)) { if (!instruction) { console.error(`  skip(${hostId}): no usable turn`); return false } t.line = (t.line && t.line !== '(unusable turn)') ? t.line : '...' }
    // tag honesty: keep an evidence id only if the host holds it AND the line actually touches that receipt's content; opinion carries no tag
    const contentWords = s => new Set((s.toLowerCase().match(/[a-z']{4,}/g) || []))
    t.evidence = (t.evidence || []).filter(id => {
      if (!(beat.allowed_evidence[hostId] || []).includes(id)) return false
      const ev = contentWords(evTexts[id] || ''), ln = contentWords(t.line)
      let hits = 0; for (const w of ln) if (ev.has(w)) hits++
      return hits >= 1 // one real content-word link keeps the tag; paraphrase shouldn't orphan a legit cite
    })
    // enforce the word cap in code: truncate at a sentence boundary
    const cap = Math.round(28 * host.behavior.verbosity + 12)
    const wlist = t.line.match(/\S+/g) || []
    if (wlist.length > cap * 1.4) {
      const cut = wlist.slice(0, Math.round(cap * 1.2)).join(' ')
      const m = cut.match(/^[\s\S]*[.!?]/)
      t.line = (m ? m[0] : cut + '...').trim()
    }
    turns.push({ id: hostId, name: host.name.toUpperCase(), ...t, tag: tag || null, ms: Date.now() - t0, noMerge: !!instruction })
    spoken += words(t.line); turnNo++
    heartbeat(turnNo, beat.max_turns, spoken, beat.target_spoken_words)
    console.error(`turn ${turnNo} ${hostId}${tag ? ' [' + tag + ']' : ''} ${words(t.line)}w ${Date.now() - t0}ms :: ${t.line.slice(0, 70)}`)
    return true
  }
  function backchannel(hostId) {
    const host = hosts[hostId]; const pool = BC[hostId] || ['Mm.', 'Right.']
    turns.push({ id: hostId, name: host.name.toUpperCase(), line: pool[Math.floor(rand() * pool.length)], delivery: 'under them', addressed_to: null, evidence: [], tag: null, ms: 0, bc: true })
    console.error(`      ${hostId} backchannel`)
  }
  // a HUMAN delegate's turn: their own words, seated as-is, then a host is directed to answer THEM
  const usedSlots = new Set()
  function seatHuman(slot) {
    usedSlots.add(slot.key)
    const name = (hosts[slot.host]?.name || slot.name || slot.host).toUpperCase()
    turns.push({ id: slot.host, name, line: slot.text, delivery: 'in their own voice', addressed_to: null, evidence: [], tag: 'delegate', ms: 0, noMerge: true, verbatim: true })
    spoken += words(slot.text); turnNo++
    heartbeat(turnNo, beat.max_turns, spoken, beat.target_spoken_words)
    console.error(`turn ${turnNo} ${slot.host} [delegate, verbatim] ${words(slot.text)}w :: ${slot.text.slice(0, 70)}`)
    const shareOf = id => { const w = turns.filter(t => t.id === id).reduce((a, t) => a + (t.line.match(/\S+/g) || []).length, 0); return spoken ? w / spoken : 0 }
    const responder = [...speakers].sort((a, b) => shareOf(a.id) - shareOf(b.id))[0]
    if (responder) pendingReact = { id: responder.id, instruction: `A real fan, ${hosts[slot.host]?.name || slot.name}, just spoke on the floor. Answer THEM by name: take their point seriously in one clause, then push your own read. Do not repeat their words.`, tag: null }
  }
  let pendingReact = null, wpIdx = 0
  function pickNext() {
    const last = [...turns].reverse().find(t => !t.bc) || null // backchannels never own the floor
    if (pendingReact) { const p = pendingReact; pendingReact = null; return p }
    const forced = beat.withheld.find(w => !detonated.has(w.evidence) && turnNo >= w.turn)
    if (forced) {
      detonated.add(forced.evidence)
      if (beat.detonation_react) pendingReact = { id: beat.detonation_react.host, instruction: beat.detonation_react.instruction, tag: null }
      return { id: forced.host, instruction: forced.instruction + ' The receipt, verbatim from the ledger: "' + (evTexts[forced.evidence] || '') + '"', tag: 'interrupting' }
    }
    if (!kkDropped && (turnNo >= beat.kk_drop.after_turn || spoken >= beat.target_spoken_words * 0.85)) { kkDropped = true; return { id: beat.kk_drop.host, instruction: beat.kk_drop.instruction, tag: null } }
    const shareOf = id => { const w = turns.filter(t => t.id === id).reduce((a, t) => a + (t.line.match(/\S+/g) || []).length, 0); return spoken ? w / spoken : 0 }
    // waypoints: the director's progression notes - momentum comes from the beat sheet, not model willpower
    const wp = (beat.waypoints || [])[wpIdx]
    if (wp && spoken >= wp.after_words && wp.host !== (last && last.id)) { wpIdx++; return { id: wp.host, instruction: wp.note, tag: null } } // defer, never drop
    if (last && last.addressed_to && hosts[last.addressed_to] && hosts[last.addressed_to].kind !== 'human' && last.addressed_to !== last.id && shareOf(last.addressed_to) <= 0.45 && rand() < 0.75) return { id: last.addressed_to }
    const cands = speakers.filter(h => h.id !== (last && last.id) && !(h.id === beat.kk_drop.host && !kkDropped))
    const weights = cands.map(h => (0.25 + h.behavior.interruption_rate) * (shareOf(h.id) > 0.4 ? 0.2 : 1)) // damp floor-hogs
    let r = rand() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return { id: cands[i].id, tag: rand() < cands[i].behavior.interruption_rate * 0.5 ? 'interrupting' : null } }
    return { id: cands[0].id }
  }

  // opener
  await speak(beat.opener.host, beat.opener.instruction)
  // floor
  while (spoken < beat.target_spoken_words && turnNo < beat.max_turns) {
    // a human delegate's scheduled verbatim turn lands when the floor reaches its word mark
    const slot = (beat.human_slots || []).find(s => !usedSlots.has(s.key) && spoken >= s.after_words)
    if (slot) { seatHuman(slot); continue }
    const pick = pickNext()
    // quiet host emits backchannel instead of a turn while holding
    if (pick.id === beat.kk_drop.host && !kkDropped && rand() < hosts[pick.id].behavior.backchannel_rate) { backchannel(pick.id); continue }
    await speak(pick.id, pick.instruction, pick.tag)
    // losing bidder backchannels occasionally
    if (rand() < 0.3) { const others = speakers.filter(h => h.id !== turns[turns.length - 1].id); const b = others[Math.floor(rand() * others.length)]; if (b && rand() < b.behavior.backchannel_rate) backchannel(b.id) }
  }
  // any human turn the floor never reached still gets said before the close (their verdict matters)
  for (const s of (beat.human_slots || [])) if (!usedSlots.has(s.key)) { seatHuman(s); if (pendingReact) { const p = pendingReact; pendingReact = null; await speak(p.id, p.instruction, p.tag) } }
  if (!kkDropped) await speak(beat.kk_drop.host, beat.kk_drop.instruction)
  const lastRealEnd = [...turns].reverse().find(t => !t.bc)
  const exitHost = lastRealEnd && lastRealEnd.id === beat.exit.host ? (beat.exit.alt_host || 'tasha-raw') : beat.exit.host
  await speak(exitHost, beat.exit.instruction)

  // render for output: merge consecutive same-speaker turns, append evidence tags after the spoken line
  function renderMd() {
    const merged = []
    for (const t of turns) {
      const prev = merged[merged.length - 1]
      if (prev && prev.id === t.id && !prev.bc && !t.bc && !prev.noMerge && !t.noMerge) { prev.line += ' ' + t.line; prev.evidence = [...new Set([...prev.evidence, ...t.evidence])] }
      else merged.push({ ...t, evidence: [...t.evidence] })
    }
    return merged.filter(t => t.line && t.line !== '(unusable turn)').map(t => `${t.name}${t.tag ? ' [' + t.tag + ']' : ''} (${t.delivery}): ${t.line}${t.evidence.length ? ' ' + t.evidence.map(id => '[' + id + ']').join('') : ''}`).join('\n')
  }
  const rawMd = (`# FLOOR RAW - ${beat.id}\n\n` + renderMd() + '\n').replace(/—/g, '...')
  fs.writeFileSync(path.join(outDir, 'segment_raw.md'), rawMd)

  // MIX — messiness pass
  const mixSys = `You are a dialogue editor making an AI talk-show transcript sound like REAL recorded conversation. Rules:\n- Keep every speaker name line format: NAME [tag] (delivery): line\n- Inject sparingly (not every line): fillers, false starts, self-corrections, repeated words when heated\n- Truncate 2-3 lines mid-clause where the next speaker cuts in; tag that next line [interrupting] or [overlapping]\n- Vary turn lengths harder: make SHORT lines shorter, but NEVER shorten a turn longer than 20 words - long turns are load-bearing\n- Keep every backchannel line (the tiny 'Right.' / 'Mm.' lines) exactly as they are\n- Lines tagged [delegate] are a REAL PERSON'S OWN WORDS: copy them EXACTLY, character for character; never edit, cut, or add to them\n- Keep ALL [E##] evidence tags exactly where they are. Do NOT add facts, receipts, or new claims. Do NOT add or remove speakers.\n- KEEP EVERY TURN. Total length must stay within 10% of the input. You may split a line with an interruption but never delete content.\n- No em-dashes anywhere (replace any you see with a period or '...').\nOutput ONLY the transcript.`
  let finalMd = rawMd
  try {
    let mixed = PROVIDER === 'requesty' ? await callRequesty(mixSys, rawMd, 0.7, 1600)
      : PROVIDER === 'openrouter' ? await callOpenRouter(DNA._mix, mixSys, rawMd, 0.7, 1600, false)
        : await callOllama(MODELS['_mix'], mixSys, rawMd, 0.7, 1600, false)
    const evCountRaw = (rawMd.match(/\[E\d+\]/g) || []).length, evCountMix = (mixed.match(/\[E\d+\]/g) || []).length
    // the mixer sometimes echoes the delivery as a bracket tag too ("NAME [x] (x):"): collapse the echo
    mixed = mixed.replace(/^([A-Z][A-Z .'\-]*?)\s*\[([^\]]+)\]\s*\(\s*\2\s*\)\s*:/gm, '$1 ($2):')
    const mixWords = (mixed.match(/\S+/g) || []).length, rawWords = (rawMd.match(/\S+/g) || []).length
    // a human's verbatim lines must survive the mix untouched, or the mix is rejected
    const verbatimKept = turns.filter(t => t.verbatim).every(t => mixed.includes(t.line))
    if (!verbatimKept) console.error('MIX altered a verbatim delegate line — keeping raw')
    if (verbatimKept && evCountMix >= Math.floor(evCountRaw * 0.7) && mixWords >= rawWords * 0.75) {
      finalMd = (`# FLOOR MIXED - ${beat.id}\n\n` + mixed.trim() + '\n').replace(/—/g, '...')
    } else console.error(`MIX rejected (evidence ${evCountMix}/${evCountRaw}, words ${mixWords}/${rawWords}), keeping raw`)
  } catch (e) { console.error('MIX failed: ' + e.message + ' — keeping raw') }
  fs.writeFileSync(path.join(outDir, 'segment_final.md'), finalMd)
  fs.writeFileSync(path.join(outDir, 'turns.json'), JSON.stringify(turns, null, 2))
  // meta records the EFFECTIVE lineup this run spoke on (per seat + the mix), the declared Model DNA, and each seat's guard dial
  const effectiveModel = id => PROVIDER === 'openrouter' ? (DNA[id] || DNA._mix) : PROVIDER === 'requesty' ? (process.env.ENGINE_REQUESTY_MODEL || 'anthropic/claude-sonnet-4-20250514') : (MODELS[id] || MODELS._mix)
  const models = Object.fromEntries([...speakers.map(s => s.id), '_mix'].map(id => [id, effectiveModel(id)]))
  const dna = Object.fromEntries(speakers.map(s => [s.id, hosts[s.id]?.model?.dna_id || null]))
  const guards = Object.fromEntries(speakers.map(s => [s.id, { style: styleGuards(s.id) }]))
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ beat: beat.id, provider: PROVIDER, models, dna, guards, seed: Number(ARG.seed || 42), turns: turns.length, spoken_words: spoken, finished: new Date().toISOString() }, null, 2))
  console.log(outDir)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
