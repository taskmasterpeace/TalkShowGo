#!/usr/bin/env node
/**
 * GRADE SHOW — the standalone SHOWTIME grader (docs/SHOWTIME-API-PLAN.md §4). NOT a per-job stage:
 * run it on acceptance/benchmark runs. Judge model = gemini-2.5-flash (different family than the
 * gpt-4.1-mini writers); prompt is VERSIONED at lab/engine/judge_prompts/showtime-rubric-v1.md;
 * raw axes stored next to the artifacts as grade.json.
 *
 *   node lab/engine/grade_show.mjs --transcript=<episode.md> --events=<events.json> [--total-min=9.5]
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] === '' ? true : m[2]] : [a, true] }))
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readKey = n => { if (process.env[n]) return process.env[n].trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + n + '=(.+)$', 'm')); if (m) return m[1].trim() } catch {} return '' }

const md = fs.readFileSync(String(ARG.transcript), 'utf8')
const eventsRaw = JSON.parse(fs.readFileSync(String(ARG.events), 'utf8'))
const events = (Array.isArray(eventsRaw) ? eventsRaw : eventsRaw.events).map(e => (typeof e === 'string' ? e : e.text))

// ANONYMIZE speakers (blind judging is the house law): NAME (delivery): -> SPEAKER_N (delivery):
const names = [...new Set([...md.matchAll(/^([A-Z][A-Z .'\-]+?)\s*(?:\[[^\]]*\]\s*)*\(/gm)].map(m => m[1].trim()))]
let blind = md
names.forEach((n, i) => { blind = blind.split(n).join('SPEAKER_' + (i + 1)) })

const prompt = fs.readFileSync(path.join(ROOT, 'lab', 'engine', 'judge_prompts', 'showtime-rubric-v1.md'), 'utf8')
const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST', headers: { Authorization: 'Bearer ' + readKey('OPENROUTER_API_KEY'), 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'google/gemini-2.5-flash', temperature: 0.2, max_tokens: 1800, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt }, { role: 'user', content: `INPUT EVENTS:\n${events.map((e, i) => `E${i + 1}: "${e}"`).join('\n')}\n\nANONYMIZED TRANSCRIPT:\n${blind.slice(0, 24000)}` }] }),
  signal: AbortSignal.timeout(120000),
})
const j = await r.json()
if (!r.ok) { console.error('judge HTTP ' + r.status); process.exit(1) }
const g = JSON.parse(j.choices[0].message.content)
const axes = g.axes || {}
if ((g.fact_violations || []).length) axes.fact_fidelity = Math.min(axes.fact_fidelity ?? 0, 9) // violations cap it below 10 no matter what the judge scored
const vals = Object.values(axes).map(Number).filter(Number.isFinite)
const avg = vals.reduce((a, b) => a + b, 0) / vals.length
const totalMin = Number(ARG['total-min']) || null
const tier = totalMin == null ? null : totalMin <= 5 ? 'S' : totalMin <= 10 ? 'A' : totalMin <= 20 ? 'B' : 'C'
const homeRun = avg >= 7.5 && axes.fact_fidelity === 10 && (tier === null || tier === 'S' || tier === 'A')
const band = (axes.fact_fidelity ?? 0) < 10 && (g.fact_violations || []).length ? 'MEDIOCRE (fact gate)' : avg < 5 ? 'MEDIOCRE' : avg < 7.5 ? 'OK' : homeRun ? 'HOME RUN' : 'OK+ (latency holds it back)'
const out = { judged_at: new Date().toISOString(), judge: 'google/gemini-2.5-flash', prompt_version: 'showtime-rubric-v1', axes, avg: +avg.toFixed(2), latency_min: totalMin, latency_tier: tier, band, fact_violations: g.fact_violations || [], notes: g.notes_per_axis || {}, best_moment: g.best_moment, worst_moment: g.worst_moment }
const gp = String(ARG.transcript).replace(/[^\\/]+$/, 'grade.json')
fs.writeFileSync(gp, JSON.stringify(out, null, 2) + '\n')
console.log(`BAND: ${band} · avg ${out.avg} · fact ${axes.fact_fidelity}/10 (${out.fact_violations.length} violations) · tier ${tier || 'n/a'}`)
for (const [k, v] of Object.entries(axes)) console.log(`  ${k.padEnd(24)} ${v}/10  ${out.notes[k] || ''}`)
if (out.fact_violations.length) for (const v of out.fact_violations) console.log('  VIOLATION: ' + v)
console.log('grade -> ' + gp)
