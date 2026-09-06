#!/usr/bin/env node
/**
 * ACTIVITY — human-readable tail of lab/logs/activity.jsonl (the producer's "who did what").
 *
 *   node lab/engine/activity.mjs                 last 20 events
 *   node lab/engine/activity.mjs --tail=50       last 50
 *   node lab/engine/activity.mjs --kind=take     only take events (kind or stage match)
 *   node lab/engine/activity.mjs --person=robert only events whose ref/summary mentions robert
 *
 * Reads only. Timestamps shown in local time. Failures (ok:false) are flagged loudly.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] === '' ? true : m[2]] : [a, true] }))
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILE = path.join(ROOT, 'lab', 'logs', 'activity.jsonl')

let lines = []
try { lines = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean) } catch { console.log('(no activity log yet)'); process.exit(0) }

const events = []
for (const l of lines) { try { events.push(JSON.parse(l)) } catch { /* skip torn line */ } }

const kind = typeof ARG.kind === 'string' ? ARG.kind.toLowerCase() : null
const person = typeof ARG.person === 'string' ? ARG.person.toLowerCase() : null
let picked = events.filter(e => {
  if (kind && String(e.kind).toLowerCase() !== kind && String(e.stage).toLowerCase() !== kind) return false
  if (person && !(`${e.ref || ''} ${e.summary || ''}`.toLowerCase().includes(person))) return false
  return true
})
const n = Math.max(1, parseInt(ARG.tail, 10) || 20)
picked = picked.slice(-n)

if (!picked.length) { console.log('(no matching events)'); process.exit(0) }
const pad = (s, w) => String(s ?? '').padEnd(w).slice(0, w)
for (const e of picked) {
  const t = e.ts ? new Date(e.ts) : null
  const when = t && !isNaN(t) ? t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '??'
  const flag = e.ok === false ? ' !! FAILED' : ''
  const ms = e.ms ? ` (${e.ms}ms)` : ''
  console.log(`${pad(when, 13)} ${pad(e.kind, 8)} ${pad(e.stage, 9)} ${(e.summary || e.ref || '').slice(0, 100)}${ms}${flag}${e.error ? ' - ' + String(e.error).slice(0, 80) : ''}`)
}
const fails = picked.filter(e => e.ok === false).length
console.log(`\n${picked.length} events shown${fails ? ` · ${fails} FAILED` : ''} · full log: ${path.relative(process.cwd(), FILE)}`)
