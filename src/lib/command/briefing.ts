// THE BRIEFING — turns a Stringer dossier's cited evidence into an ordered "one move at a
// time" walk that ends on a real question. Impartial; every factual move cites evidence from
// the dossier (no new research, no invented facts). Two morphs read the SAME moves later:
// user (progressive reveal) and agent (packed to the host's context budget).
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig } from './stringer'

const ROOT = process.cwd()
const OR_KEY = () => process.env.OPENROUTER_API_KEY // per-call: a key saved in SETTINGS works without a restart

const SYS = `You build an IMPARTIAL BRIEFING that walks a person to an INFORMED opinion, then asks them a question. You are given an evidence ledger (each entry: id, claim, truth_label, source) and THE QUESTION the show will ask.
Produce an ordered sequence of MOVES that build the context needed to answer the question well. HARD RULES:
- Use ONLY the evidence provided. Cite every factual move by evidence id(s). NEVER invent a fact.
- Present, do NOT argue. No lean, no hint at the "right" answer. Include tradeoffs and what's uncertain.
- One idea per move, in a sensible order (set the scene -> the key facts/stats -> the tradeoff -> the larger context -> what's still unknown).
- headline = one tight sentence (for small screens / tiny-context hosts). body = 2-3 sentences of fuller context.
Output STRICT JSON only:
{"moves":[{"kind":"event|stat|tradeoff|larger_context|uncertainty","headline":"...","body":"...","truth_label":"FACT|ATTRIBUTED_CLAIM|ANALYSIS","evidence_ids":["E001"],"importance":1}]}
importance 1(low)-5(high). The QUESTION is provided separately and is NOT a move.`

export async function buildBriefing(stringer: any, finalQuestion: string, moveCount = 5) {
  if (!OR_KEY()) throw new Error('OPENROUTER_API_KEY missing')
  const cfg = loadConfig()
  const ledger = (stringer.evidence || []).filter((e: any) => e.valid_source)
  const ledgerText = ledger.map((e: any) => `${e.id} [${e.truth_label} | ${e.source_name || '?'}] ${e.claim}`).join('\n')
  const user = `THE QUESTION (do not answer it, build toward it): ${finalQuestion}\n\nAim for ${moveCount} moves.\n\nEVIDENCE LEDGER:\n${ledgerText}`
  const t0 = Date.now()
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + OR_KEY(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.parser?.model || 'google/gemini-2.5-flash-lite', temperature: 0.2, max_tokens: 3500, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(90000),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error?.message || ('briefing http ' + r.status))
  const mined = JSON.parse((j.choices?.[0]?.message?.content || '{}').match(/\{[\s\S]*\}/)?.[0] || '{}')

  const validIds = new Set(ledger.map((e: any) => e.id))
  const moves = (mined.moves || []).map((m: any, i: number) => {
    const ev = (m.evidence_ids || []).filter((id: string) => validIds.has(id))
    return { id: 'M' + (i + 1), order: i + 1, kind: m.kind || 'larger_context', headline: m.headline, body: m.body, truth_label: m.truth_label, evidence_ids: ev, importance: m.importance || 3, uncited: (m.truth_label === 'FACT' || m.truth_label === 'ATTRIBUTED_CLAIM') && ev.length === 0 }
  })
  // deterministic neutrality audit
  const LOADED = /\b(obviously|clearly|everyone knows|disgrace|betrayal|scam|ripoff|insane|ridiculous|should have)\b/i
  const uncited = moves.filter((m: any) => m.uncited).map((m: any) => m.headline)
  const leadingQ = LOADED.test(finalQuestion)
  const loaded = moves.filter((m: any) => LOADED.test(m.headline + ' ' + m.body)).map((m: any) => m.id)
  const audit = {
    status: (uncited.length === 0 && !leadingQ && loaded.length === 0) ? 'pass' : 'needs_review',
    all_factual_moves_cited: uncited.length === 0, question_is_non_leading: !leadingQ, loaded_language: loaded, uncited_moves: uncited,
  }
  const id = 'brf_' + Math.random().toString(36).slice(2, 10)
  return {
    schema_version: 1, id, stringer_id: stringer.id, created_at: new Date().toISOString(),
    title: stringer.assignment?.text || 'Briefing',
    question: { id: 'Q1', text: finalQuestion, type: /^(should|would|is|are|do|did|was|were|can)\b/i.test(finalQuestion.trim()) ? 'binary' : 'open' },
    moves, audit, elapsed_ms: Date.now() - t0,
  }
}

export function saveBriefing(b: any) {
  const dir = path.join(ROOT, 'lab', 'briefings')
  fs.mkdirSync(dir, { recursive: true })
  const bp = path.join(dir, b.id + '.json')
  fs.writeFileSync(bp + '.tmp', JSON.stringify(b, null, 2) + '\n'); fs.renameSync(bp + '.tmp', bp) // atomic: a torn artifact 500s every later read
}

export function listBriefings(limit = 12): any[] {
  const dir = path.join(ROOT, 'lab', 'briefings')
  if (!fs.existsSync(dir)) return []
  // exact-shape filter: brf_x.agents.json siblings are cast deliveries, not briefings; and ids are
  // RANDOM strings, so "recent" must come from mtime, never from sorting the names
  return fs.readdirSync(dir).filter(f => /^brf_[a-z0-9]+\.json$/.test(f))
    .map(f => ({ f, m: (() => { try { return fs.statSync(path.join(dir, f)).mtimeMs } catch { return 0 } })() }))
    .sort((a, b) => b.m - a.m).slice(0, limit)
    .map(({ f }) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { return null } }).filter(Boolean)
}
