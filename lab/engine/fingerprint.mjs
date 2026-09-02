#!/usr/bin/env node
/**
 * Texture fingerprint for a generated segment. Usage: node lab/engine/fingerprint.mjs <segment.md>
 * Measures the realism metrics from lab/CONVO_ENGINE.md SCORECARD and prints PASS/FAIL per target.
 */
import fs from 'node:fs'
const file = process.argv[2]
if (!file) { console.error('usage: fingerprint.mjs <segment.md>'); process.exit(1) }
const text = fs.readFileSync(file, 'utf8')
const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
// NAME [tags]* (delivery): text — the MIX pass may add several bracket tags (delivery adjectives,
// [interrupting], [under them]); group 2 keeps them all so the overlap check still finds "interrupting"
const turnRe = /^([A-Z][A-Z .'\-]+?)\s*((?:\[[^\]]*\]\s*)*)\(([^)]*)\)\s*:\s*(.+)$/
const turns = []
// groups: 1 speaker · 2 all bracket tags · 3 delivery · 4 line
for (const l of lines) { const m = l.match(turnRe); if (m) turns.push({ speaker: m[1].trim(), tag: /interrupt/i.test(m[2] || '') ? 'interrupting' : /overlap/i.test(m[2] || '') ? 'overlapping' : null, delivery: m[3], line: m[4] }) }
if (!turns.length) { console.error('no turns parsed'); process.exit(1) }
const w = s => (s.match(/\S+/g) || []).length
const perTurn = turns.map(t => w(t.line))
const total = perTurn.reduce((a, b) => a + b, 0)
const mean = total / perTurn.length
const stdev = Math.sqrt(perTurn.reduce((a, b) => a + (b - mean) ** 2, 0) / perTurn.length)
const cv = stdev / mean
const speakers = {}
for (const t of turns) { speakers[t.speaker] = speakers[t.speaker] || { turns: 0, words: 0 }; speakers[t.speaker].turns++; speakers[t.speaker].words += w(t.line) }
const maxShare = Math.max(...Object.values(speakers).map(s => s.words / total))
const interruptions = turns.filter(t => t.tag).length
const backchannels = perTurn.filter(n => n <= 4).length
const emdashes = (text.match(/—/g) || []).length
const quoteMarks = (turns.map(t => t.line).join(' ').match(/"/g) || []).length
const evTags = (text.match(/\[E\d+\]/g) || []).length

const targets = [
  ['turn-length cv >= 0.65 (uneven)', cv >= 0.65, cv.toFixed(2)],
  ['interruption tags >= 2', interruptions >= 2, interruptions],
  ['micro-turns (<=4w) >= 3', backchannels >= 3, backchannels],
  ['max word share <= 0.55', maxShare <= 0.55, maxShare.toFixed(2)],
  ['em-dashes == 0', emdashes === 0, emdashes],
  ['quote marks <= 6', quoteMarks <= 6, quoteMarks],
  ['evidence tags >= 4', evTags >= 4, evTags],
]
const result = {
  file, turns: turns.length, total_words: total, mean_words_per_turn: +mean.toFixed(1), cv: +cv.toFixed(2),
  speakers: Object.fromEntries(Object.entries(speakers).map(([k, v]) => [k, { ...v, share: +(v.words / total).toFixed(2) }])),
  interruptions, micro_turns: backchannels, emdashes, quote_marks: quoteMarks, evidence_tags: evTags,
  pass: targets.every(t => t[1]),
}
console.log(JSON.stringify(result, null, 2))
for (const [name, ok, val] of targets) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + val)
process.exit(result.pass ? 0 : 2)
