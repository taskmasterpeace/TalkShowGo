#!/usr/bin/env node
/**
 * SYNTHESIZE EVENTS — pure, deterministic, no network (docs/SHOWTIME-API-PLAN.md §3, judge-split).
 * Game events in -> a synthetic stringer dossier on disk, each event ONE evidence row VERBATIM.
 * The dossier is provenance-marked "showtime-events" so nothing mistakes it for researched fact.
 *
 *   node lab/engine/synthesize_events.mjs --events=<file.json> [--premise="..."]
 *   (as a module: synthesizeEvents(events, premise?, root?) -> { id, path, dossier })
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const KIND_LABEL = { quote: 'ATTRIBUTED_CLAIM' } // everything else is a FACT the game asserts; kind is otherwise RESERVED

export function synthesizeEvents(events, premise = null, root = process.cwd()) {
  if (!Array.isArray(events)) throw new Error('events must be an array')
  const rows = events
    .map(e => (typeof e === 'string' ? { text: e } : e))
    .filter(e => e && typeof e.text === 'string' && e.text.trim())
    .map(e => ({ text: e.text.trim().slice(0, 300), kind: typeof e.kind === 'string' ? e.kind.slice(0, 24) : null }))
  if (!rows.length) throw new Error('no usable events (need {text} entries)')
  if (rows.length > 50) throw new Error('too many events (max 50)')
  const id = 'str_st' + Math.random().toString(36).slice(2, 8)
  const dossier = {
    schema_version: 1,
    id,
    provenance: 'showtime-events', // the LAW: this is a game's asserted world, not researched fact
    assignment: { text: premise || `The moment the game reported: ${rows[0].text}`, mode: 'showtime', kind: 'question' },
    created_at: new Date().toISOString(),
    sources: [{ id: 'src_game', publisher: 'game-events (showtime)', medium: 'game', transcript_status: 'ok' }],
    evidence: rows.map((r, i) => ({
      id: 'E' + String(i + 1).padStart(3, '0'),
      claim: r.text, // VERBATIM - synthesize never rewrites the game's facts
      truth_label: KIND_LABEL[r.kind] || 'FACT',
      source_id: 'src_game',
      source_name: 'game-events (showtime)',
      valid_source: true,
      ...(r.kind ? { kind: r.kind } : {}),
    })),
  }
  const dir = path.join(root, 'lab', 'research', 'stringer')
  fs.mkdirSync(dir, { recursive: true })
  const p = path.join(dir, id + '.json')
  fs.writeFileSync(p + '.tmp', JSON.stringify(dossier, null, 2) + '\n'); fs.renameSync(p + '.tmp', p)
  return { id, path: p, dossier }
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] === '' ? true : m[2]] : [a, true] }))
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  const events = JSON.parse(fs.readFileSync(String(ARG.events), 'utf8'))
  const out = synthesizeEvents(Array.isArray(events) ? events : events.events, typeof ARG.premise === 'string' ? ARG.premise : null, ROOT)
  console.log(`DOSSIER=${out.id} (${out.dossier.evidence.length} evidence) -> ${out.path}`)
}
