#!/usr/bin/env node
/**
 * DOSSIER REPORT — "reports on everything" (Robert 2026-09-05, after loving the topic-validation report).
 * Every research run becomes a browsable report: WHO is mentioned (people, with what's being said), the
 * orgs/teams, the INCIDENTS/EVENTS (for battle rap: which battlers + which battles), the storylines, the
 * channels/publishers it drew from (so the producer can choose), and FRESHNESS (how old the material is —
 * the staleness question). Written next to the dossier: lab/research/stringer/<id>.REPORT.md
 *
 * Usage: node lab/engine/dossier_report.mjs --dossier=<str_id>     one dossier
 *        node lab/engine/dossier_report.mjs --latest[=N]           the newest N dossiers (default 1)
 */
import fs from 'node:fs'
import path from 'node:path'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const SDIR = path.join(ROOT, 'lab', 'research', 'stringer')
const readKey = n => { if (process.env[n]) return process.env[n].trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + n + '=(.+)$', 'm')); if (m) return m[1].trim() } catch {} try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[n]; if (v) return String(v).trim() } catch {} return '' }

const freshBucket = t => { const s = String(t || '').toLowerCase(); if (/hour|minute/.test(s)) return 'today'; if (/^(\d+ )?day/.test(s) || /days? ago/.test(s)) return 'this week'; if (/week/.test(s)) return 'this month'; if (/month/.test(s)) return 'older (months)'; if (/year/.test(s)) return 'old (years)'; return 'undated (web/unknown)' }

async function extractEntities(dossier, ev) {
  const sys = `You are a research librarian. From the evidence lines below, extract the ENTITIES and STORYLINES for a producer's report. Output STRICT JSON only:
{"people":[{"name":"...","who":"3-6 word role (e.g. quarterback, head coach, battle rapper)","mentions":3,"gist":"one line: what the material says about them"}],
 "orgs":[{"name":"...","gist":"one line"}],
 "incidents":[{"name":"the event/battle/game/announcement as a short title","gist":"one line: what happened per the material"}],
 "storylines":[{"title":"3-8 words","gist":"one line","heat":"hot|warm|background"}]}
Only what the evidence actually supports - never invent. People = humans only. Incidents = concrete events (a game, a battle, an injury, a signing, an announcement).`
  const user = `TOPIC: ${dossier.assignment?.text}\nEVIDENCE (${ev.length} lines):\n` + ev.slice(0, 45).map(e => `[${e.truth_label}] ${e.claim}`).join('\n')
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + readKey('OPENROUTER_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-4.1-mini', temperature: 0.2, max_tokens: 1400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(60000),
  })
  const j = await r.json()
  try { return JSON.parse(j.choices[0].message.content) } catch { return { people: [], orgs: [], incidents: [], storylines: [] } }
}

async function report(id) {
  const dp = path.join(SDIR, id + '.json')
  const d = JSON.parse(fs.readFileSync(dp, 'utf8'))
  const ev = (d.evidence || []).filter(e => e.valid_source)
  const srcById = Object.fromEntries((d.sources || []).map(s => [s.id, s]))
  const ents = await extractEntities(d, ev)
  const att = ev.filter(e => e.truth_label === 'ATTRIBUTED_CLAIM')
  // freshness: join evidence -> source -> published text
  const buckets = {}
  for (const e of ev) { const s = srcById[e.source_id]; const b = s?.medium === 'web' ? 'undated (web/unknown)' : freshBucket(s?.published_at); buckets[b] = (buckets[b] || 0) + 1 }
  const R = []
  R.push(`# Research Report — ${d.assignment?.text || id}`)
  R.push(`*dossier \`${id}\` · ${String(d.created_at || '').slice(0, 16).replace('T', ' ')} · mode ${d.assignment?.mode || '?'}${d.beat ? ' · beat ' + d.beat : ''}*`, '')
  R.push(`**${ev.length} evidence** (${att.length} attributed claims = debate material) · **${(d.sources || []).filter(s => s.transcript_status === 'ok').length} transcribed** + **${(d.sources || []).filter(s => s.medium === 'web').length} web** sources`, '')
  if ((ents.people || []).length) {
    R.push('## People mentioned', '| who | role | says the material |', '|---|---|---|')
    for (const p of ents.people.slice(0, 12)) R.push(`| **${p.name}** | ${p.who || ''} | ${p.gist || ''} |`)
    R.push('')
  }
  if ((ents.incidents || []).length) {
    R.push('## Incidents / events', '')
    for (const i of ents.incidents.slice(0, 8)) R.push(`- **${i.name}** — ${i.gist}`)
    R.push('')
  }
  if ((ents.storylines || []).length) {
    R.push('## Storylines', '')
    for (const s of ents.storylines.slice(0, 6)) R.push(`- ${s.heat === 'hot' ? '🔥' : s.heat === 'warm' ? '🌤' : '📎'} **${s.title}** — ${s.gist}`)
    R.push('')
  }
  if ((ents.orgs || []).length) R.push('## Orgs / teams', '', ents.orgs.slice(0, 8).map(o => `- **${o.name}** — ${o.gist}`).join('\n'), '')
  R.push('## Channels & publishers this drew from (producer: keep or cut)', '| source | medium | status | published |', '|---|---|---|---|')
  for (const s of (d.sources || []).slice(0, 14)) R.push(`| ${s.publisher} | ${s.medium} | ${s.transcript_status} | ${s.published_at || (s.medium === 'web' ? 'article' : '?')} |`)
  R.push('', '## Freshness (how old is this material?)', '')
  for (const [b, n] of Object.entries(buckets).sort((a, b2) => b2[1] - a[1])) R.push(`- ${b}: ${n} evidence`)
  R.push('', '### Sample receipts')
  ev.slice(0, 6).forEach(e => R.push(`- [${e.truth_label}] ${String(e.claim).slice(0, 140)}`))
  const rp = path.join(SDIR, id + '.REPORT.md')
  fs.writeFileSync(rp, R.join('\n') + '\n')
  console.log('REPORT=' + rp)
  return rp
}

;(async () => {
  let ids = []
  if (typeof ARG.dossier === 'string' && ARG.dossier) ids = [ARG.dossier.replace(/\.json$/, '')]
  else {
    const n = ARG.latest === true ? 1 : parseInt(ARG.latest, 10) || 1
    ids = fs.readdirSync(SDIR).filter(f => /^str_[a-z0-9]+\.json$/.test(f))
      .map(f => ({ f, t: fs.statSync(path.join(SDIR, f)).mtimeMs })).sort((a, b) => b.t - a.t).slice(0, n).map(x => x.f.replace(/\.json$/, ''))
  }
  for (const id of ids) await report(id)
  console.log('DONE')
})().catch(e => { console.error('REPORT FAILED:', e.message); process.exit(1) })
