#!/usr/bin/env node
/**
 * TalkShowGo CONVO ENGINE — FLOOR + MIX (lab rig v1)
 * Runs a beat card through per-host actor calls on local Ollama (cupcake), then a messiness pass.
 * Usage: node lab/engine/run_floor.mjs --beat=<beatcard.json> --out=<dir> [--provider=ollama|requesty] [--seed=42]
 * Every host turn = ONE call carrying ONLY that host's locked bundle + its evidence subset. No host sees withheld receipts.
 */
import fs from 'node:fs'
import path from 'node:path'

const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const OLLAMA = process.env.ENGINE_OLLAMA_URL || 'http://192.168.1.249:11434'
const MODELS = {
  'tasha-raw': process.env.ENGINE_MODEL_TASHA || 'hf.co/bartowski/NousResearch_Hermes-4-70B-GGUF:Q4_K_M',
  'marcus-blaze': process.env.ENGINE_MODEL_BLAZE || 'qwen3:30b',
  'king-knowledge': process.env.ENGINE_MODEL_KK || 'qwen3:30b',
  '_mix': process.env.ENGINE_MODEL_MIX || 'qwen3:30b',
}
const PROVIDER = ARG.provider || 'ollama'

// ---------- utils ----------
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'))
function rng(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296 } }
const words = s => (s.trim().match(/\S+/g) || []).length
const stripThink = s => s.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
function readEnvKey(name) { try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); return m ? m[1].trim() : null } catch { return null } }

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
const call = (hostId, system, user, temperature, n, jsonFormat = true) => PROVIDER === 'requesty' ? callRequesty(system, user, temperature, n) : callOllama(MODELS[hostId] || MODELS['_mix'], system, user, temperature, n, jsonFormat)

// ---------- prompt assembly ----------
function hostSystem(host, beat, evTexts, sharedLaws) {
  const allowed = (beat.allowed_evidence[host.id] || []).map(id => `[${id}] ${evTexts[id] || ''}`).join('\n')
  return [
    `You are ${host.name}, a host on an AI talk show. You are IN a live argument. Output ONLY your next turn.`,
    `WHO YOU ARE:\n${host.behavioral_core}`,
    `LINES THAT SOUND LIKE YOU — rhythm and attitude reference ONLY. NEVER repeat or lightly reword ANY of them; invent NEW lines in this voice:\n- ` + host.exemplars.signature_lines.join('\n- '),
    `YOUR STANCE THIS BEAT: ${beat.stances[host.id]}`,
    `RECEIPTS YOU ARE ALLOWED TO USE (cite id in brackets when you use one):\n${allowed || '(none - argue from what others say)'}`,
    `HARD RULES:\n- 1 to 3 sentences, at most ~${Math.round(28 * host.behavior.verbosity + 12)} words. Shorter is stronger.\n- Spoken register: contractions, informal grammar fine. This is talk, not writing.\n- NEVER use facts outside your receipts. Opinion is free but must SOUND like opinion because of who you are, never hedged.\n- No em-dashes. Max ONE catchphrase per episode: ${JSON.stringify(host.catchphrase_rare)} (you have probably already used it, so avoid).\n- Respond to what was ACTUALLY just said. Push back. Do not summarize. Do not validate by default.`,
    `OUTPUT STRICT JSON, nothing else: {"line":"what you say","delivery":"3-6 word emotional direction","addressed_to":"marcus-blaze|tasha-raw|king-knowledge|null","evidence":["E6"]}`,
  ].join('\n\n')
}
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
  const hosts = Object.fromEntries(cast.hosts.map(h => [h.id, h]))
  const outDir = path.resolve(ARG.out || path.join(ROOT, 'lab', 'engine', 'runs', 'run_' + Date.now()))
  fs.mkdirSync(outDir, { recursive: true })
  const rand = rng(Number(ARG.seed || 42))
  const laws = cast.shared_rules.conversation_laws.join(' | ')
  const BC = { 'king-knowledge': ['Mm.', 'Whew.', 'Hm.'], 'marcus-blaze': ['Okay okay.', 'Nah.', 'Come ON.'], 'tasha-raw': ['Right.', 'Cap.', 'Mmhm.'] }

  const turns = []
  let spoken = 0, turnNo = 0, kkDropped = false, detonated = new Set()
  const transcript = () => turns.map(t => `${t.name}${t.tag ? ' [' + t.tag + ']' : ''} (${t.delivery}): ${t.line}`).join('\n')

  async function speak(hostId, instruction, tag) {
    const host = hosts[hostId]
    const sys = hostSystem(host, beat, evTexts, laws)
    const mine = turns.filter(t => t.id === hostId).map(t => '"' + t.line + '"')
    const antiRepeat = `ANTI-REPEAT (absolute): do not repeat any phrase already in the transcript, yours or theirs. ADVANCE the argument with something NEW: a new angle, a new consequence, a concession-then-counter.` + (mine.length ? `\nLines you already said (never reuse their phrasing): ${mine.slice(-4).join(' ')}` : '')
    const user = `TRANSCRIPT SO FAR:\n${transcript() || '(you open the beat)'}\n\n${antiRepeat}\n\n${instruction ? 'DIRECTOR NOTE (obey it): ' + instruction + '\n\n' : ''}Your next turn ONLY. JSON only.`
    const t0 = Date.now()
    const raw = await call(hostId, sys, user, host.model.temperature)
    const t = parseTurn(raw)
    turns.push({ id: hostId, name: host.name.toUpperCase(), ...t, tag: tag || null, ms: Date.now() - t0 })
    spoken += words(t.line); turnNo++
    console.error(`turn ${turnNo} ${hostId}${tag ? ' [' + tag + ']' : ''} ${words(t.line)}w ${Date.now() - t0}ms :: ${t.line.slice(0, 70)}`)
  }
  function backchannel(hostId) {
    const host = hosts[hostId]; const pool = BC[hostId] || ['Mm.']
    turns.push({ id: hostId, name: host.name.toUpperCase(), line: pool[Math.floor(rand() * pool.length)], delivery: 'under them', addressed_to: null, evidence: [], tag: null, ms: 0 })
    console.error(`      ${hostId} backchannel`)
  }
  let pendingReact = null
  function pickNext() {
    const last = turns[turns.length - 1]
    if (pendingReact) { const p = pendingReact; pendingReact = null; return p }
    const forced = beat.withheld.find(w => !detonated.has(w.evidence) && turnNo >= w.turn)
    if (forced) {
      detonated.add(forced.evidence)
      if (beat.detonation_react) pendingReact = { id: beat.detonation_react.host, instruction: beat.detonation_react.instruction, tag: null }
      return { id: forced.host, instruction: forced.instruction + ' The receipt, verbatim from the ledger: "' + (evTexts[forced.evidence] || '') + '"', tag: 'interrupting' }
    }
    if (!kkDropped && (turnNo >= beat.kk_drop.after_turn || spoken >= beat.target_spoken_words * 0.85)) { kkDropped = true; return { id: beat.kk_drop.host, instruction: beat.kk_drop.instruction, tag: null } }
    if (last && last.addressed_to && hosts[last.addressed_to] && last.addressed_to !== last.id && rand() < 0.75) return { id: last.addressed_to }
    const cands = cast.hosts.filter(h => h.id !== (last && last.id) && !(h.id === beat.kk_drop.host && !kkDropped))
    const weights = cands.map(h => 0.25 + h.behavior.interruption_rate)
    let r = rand() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return { id: cands[i].id, tag: rand() < cands[i].behavior.interruption_rate * 0.5 ? 'interrupting' : null } }
    return { id: cands[0].id }
  }

  // opener
  await speak(beat.opener.host, beat.opener.instruction)
  // floor
  while (spoken < beat.target_spoken_words && turnNo < beat.max_turns) {
    const pick = pickNext()
    // quiet host emits backchannel instead of a turn while holding
    if (pick.id === beat.kk_drop.host && !kkDropped && rand() < hosts[pick.id].behavior.backchannel_rate) { backchannel(pick.id); continue }
    await speak(pick.id, pick.instruction, pick.tag)
    // losing bidder backchannels occasionally
    if (rand() < 0.3) { const others = cast.hosts.filter(h => h.id !== turns[turns.length - 1].id); const b = others[Math.floor(rand() * others.length)]; if (rand() < b.behavior.backchannel_rate) backchannel(b.id) }
  }
  if (!kkDropped) await speak(beat.kk_drop.host, beat.kk_drop.instruction)
  await speak(beat.exit.host, beat.exit.instruction)

  const rawMd = `# FLOOR RAW — ${beat.id}\n\n` + transcript() + '\n'
  fs.writeFileSync(path.join(outDir, 'segment_raw.md'), rawMd)

  // MIX — messiness pass
  const mixSys = `You are a dialogue editor making an AI talk-show transcript sound like REAL recorded conversation. Rules:\n- Keep every speaker name line format: NAME [tag] (delivery): line\n- Inject sparingly (not every line): fillers, false starts, self-corrections, repeated words when heated\n- Truncate 2-3 lines mid-clause where the next speaker cuts in; tag that next line [interrupting] or [overlapping]\n- Vary turn lengths harder: make short lines SHORTER\n- Keep ALL [E##] evidence tags exactly where they are. Do NOT add facts, receipts, or new claims. Do NOT add or remove speakers.\n- KEEP EVERY TURN. Total length must stay within 10% of the input. You may split a line with an interruption but never delete content.\n- No em-dashes anywhere (replace any you see with a period or '...').\nOutput ONLY the transcript.`
  let finalMd = rawMd
  try {
    const mixed = PROVIDER === 'requesty' ? await callRequesty(mixSys, rawMd, 0.7, 1600) : await callOllama(MODELS['_mix'], mixSys, rawMd, 0.7, 1600, false)
    const evCountRaw = (rawMd.match(/\[E\d+\]/g) || []).length, evCountMix = (mixed.match(/\[E\d+\]/g) || []).length
    if (evCountMix >= Math.floor(evCountRaw * 0.7) && mixed.split('\n').filter(l => /^[A-Z]{2,}/.test(l)).length >= turns.length * 0.7) {
      finalMd = `# FLOOR MIXED — ${beat.id}\n\n` + mixed.trim() + '\n'
    } else console.error('MIX rejected (dropped evidence/speakers), keeping raw')
  } catch (e) { console.error('MIX failed: ' + e.message + ' — keeping raw') }
  fs.writeFileSync(path.join(outDir, 'segment_final.md'), finalMd)
  fs.writeFileSync(path.join(outDir, 'turns.json'), JSON.stringify(turns, null, 2))
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ beat: beat.id, provider: PROVIDER, models: MODELS, seed: Number(ARG.seed || 42), turns: turns.length, spoken_words: spoken, finished: new Date().toISOString() }, null, 2))
  console.log(outDir)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
