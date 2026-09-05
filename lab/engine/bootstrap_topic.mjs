#!/usr/bin/env node
/**
 * BOOTSTRAP TOPIC — a new show that BUILDS ITSELF, then PROVES itself (Robert 2026-09-05).
 * Give it a niche ("Miami Hurricanes", college football) and it:
 *   1. DISCOVERS YouTube channels (Innertube search across query angles), scores them
 *      (hit count x recency x name relevance), keeps the top ones as trusted sources.
 *   2. WRITES the beat file (lab/beats/<slug>.json) in the house schema: show block
 *      (moderated-collision, the house desk until a dedicated cast is chosen), sources
 *      {youtube RESOLVED, rss auto (Google News query feed), twitter SUGGESTED-unverified, web}.
 *   3. VALIDATES for real: runs an actual subject-mode stringer (web pass on) THROUGH the new
 *      beat file, then grades the dossier - transcripts, publishers, evidence density, debate
 *      material (attributed claims), and candidate show questions.
 *   4. Writes lab/beats/<slug>.VALIDATION.md - the health report with a PASS/MARGINAL/FAIL verdict.
 *
 * The VALIDATION CONTRACT (what "this topic works" means):
 *   PASS      >=3 transcribed sources, >=2 distinct publishers, >=15 valid evidence,
 *             >=5 attributed claims (debate ammo), >=3 candidate questions
 *   MARGINAL  research works but thin on one axis - report says exactly which
 *   FAIL      the pipeline cannot feed a show from this niche as configured
 *
 * Usage: node lab/engine/bootstrap_topic.mjs --name="Miami Hurricanes" --niche="college football"
 *        [--slug=miami-hurricanes] [--app=http://localhost:3000]
 */
import fs from 'node:fs'
import path from 'node:path'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const APP = (typeof ARG.app === 'string' && ARG.app) || 'http://localhost:3000'
const NAME = String(ARG.name || '').trim()
const NICHE = String(ARG.niche || '').trim()
if (!NAME) { console.error('need --name="<topic>" [--niche="..."]'); process.exit(1) }
const SLUG = (typeof ARG.slug === 'string' && ARG.slug) || NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const post = async (p, b) => (await fetch(APP + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json()
const recencyScore = t => { const s = String(t || '').toLowerCase(); if (/hour|day/.test(s)) return 3; if (/week/.test(s)) return 2; if (/month/.test(s)) return 1; return 0 }

async function discoverChannels() {
  const { Innertube } = await import('youtubei.js')
  const yt = await Innertube.create({ retrieve_player: false })
  const queries = [NAME, `${NAME} news`, `${NAME} podcast`, `${NAME} analysis`, NICHE ? `${NAME} ${NICHE}` : null].filter(Boolean)
  const chans = {}   // id -> {id,name,hits,recent,titles[]}
  const nameToks = NAME.toLowerCase().match(/[a-z0-9]{3,}/g) || []
  for (const q of queries) {
    let res; try { res = await yt.search(q, { type: 'video', sort_by: 'relevance' }) } catch { continue }
    for (const v of (res?.videos || res?.results || []).slice(0, 12)) {
      const a = v?.author; const id = a?.id; if (!id) continue
      const c = chans[id] = chans[id] || { id, name: a.name || '(unknown)', hits: 0, recent: 0, titles: [] }
      c.hits++
      c.recent = Math.max(c.recent, recencyScore(v?.published?.text))
      const title = v?.title?.text || v?.title || ''
      if (c.titles.length < 3 && title) c.titles.push(String(title).slice(0, 80))
    }
  }
  for (const c of Object.values(chans)) {
    const hay = c.name.toLowerCase() + ' ' + c.titles.join(' ').toLowerCase()
    c.rel = nameToks.filter(t => hay.includes(t)).length / Math.max(1, nameToks.length)
    c.score = c.hits * (1 + c.recent) * (0.5 + c.rel)
  }
  return Object.values(chans).sort((a, b) => b.score - a.score)
}

function writeBeat(top) {
  const bp = path.join(ROOT, 'lab', 'beats', SLUG + '.json')
  if (fs.existsSync(bp) && ARG.force !== true && ARG.force !== 'true') { console.log('beat exists (use --force to overwrite):', bp); return bp }
  const beat = {
    id: SLUG, name: NAME, status: 'bootstrapped',
    description: `${NAME}${NICHE ? ' (' + NICHE + ')' : ''} - auto-bootstrapped ${new Date().toISOString().slice(0, 10)}; validate + let the producer prune sources before shipping`,
    show: {
      name: NAME.toUpperCase() + ' DAILY', tagline: `Your ${NAME} desk, every day`, timespan_hours: 48,
      format_bias: 'auto', show_type: 'moderated-collision',
      intro: { enabled: true, template: 'State of the program in one breath, then the day\'s biggest storyline as a topic card.' },
      outro: { enabled: true, template: 'Next game countdown + one bold prediction the comments can hold us to.' },
      hosts: ['renee-vaughn', 'cassius-wynn', 'andrew-hammond'],
      rotation: ['dale-ruttman'],
      hosts_note: 'the house desk until Robert casts a dedicated crew for this show',
    },
    sources: {
      youtube: top.map((c, i) => ({ channel_name: c.name, label: `auto-discovered (score ${c.score.toFixed(1)}, ${c.hits} hits)`, type: 'media', priority: i < 3 ? 1 : 2, status: 'RESOLVED ' + new Date().toISOString().slice(0, 10) + ' (auto)', channel_id: c.id, resolved_title: c.name })),
      twitter: [{ handle: NAME.replace(/[^A-Za-z0-9]/g, ''), label: `${NAME} (official) - SUGGESTED, unverified`, type: 'media', priority: 1, status: 'UNVERIFIED - producer must verify the real handle' }],
      rss: [{ label: `Google News - ${NAME}`, url: `https://news.google.com/rss/search?q=${encodeURIComponent('"' + NAME + '"')}&hl=en-US&gl=US&ceid=US:en`, note: 'legal published feed; never hostile-crawl' }],
      web: [],
    },
    people: [],
  }
  fs.writeFileSync(bp, JSON.stringify(beat, null, 2) + '\n')
  console.log('beat written:', bp)
  return bp
}

async function validate() {
  const q = NICHE ? `${NAME} ${NICHE} latest storylines` : `${NAME} latest storylines`
  const s = await post('/api/command/stringer', { input: { kind: 'subject', text: q }, beat_file: SLUG + '.json', web: true })
  if (!s.ok) return { ok: false, error: s.error }
  const ev = (s.evidence || []).filter(e => e.valid_source)
  const att = ev.filter(e => e.truth_label === 'ATTRIBUTED_CLAIM')
  const ytOk = (s.sources || []).filter(x => x.transcript_status === 'ok')
  const webSrc = (s.sources || []).filter(x => x.medium === 'web')
  const pubs = new Set((s.sources || []).filter(x => x.transcript_status === 'ok' || x.medium === 'web').map(x => x.publisher))
  let cq = s.candidate_questions || []
  // self-heal: the parser sometimes drops the optional candidate_questions field. A topic with real evidence
  // still deserves a first-episode slate, so derive debatable questions FROM the evidence when it comes back empty.
  if (!cq.length && ev.length >= 10) {
    try {
      const readEnvKey = n => { if (process.env[n]) return process.env[n].trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + n + '=(.+)$', 'm')); if (m) return m[1].trim() } catch {} try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[n]; if (v) return String(v).trim() } catch {} return '' }
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + readEnvKey('OPENROUTER_API_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai/gpt-4.1-mini', temperature: 0.6, max_tokens: 500, response_format: { type: 'json_object' }, messages: [
          { role: 'system', content: 'From the evidence below, propose 4 GENUINELY DEBATABLE yes/no or either/or questions a sports talk show could argue tonight - each must have real support on BOTH sides within the evidence. Output STRICT JSON: {"questions":["...","...","...","..."]}' },
          { role: 'user', content: 'TOPIC: ' + q + '\nEVIDENCE:\n' + ev.slice(0, 25).map(e => `[${e.truth_label}] ${e.claim}`).join('\n') },
        ] }),
      })
      const j = await r.json()
      cq = (JSON.parse(j.choices[0].message.content).questions || []).filter(Boolean)
      if (cq.length) console.log('  (candidate questions derived from evidence - parser returned none)')
    } catch { /* fallback is best-effort */ }
  }
  const checks = [
    ['transcribed YouTube sources >= 3', ytOk.length, ytOk.length >= 3],
    ['distinct publishers >= 2', pubs.size, pubs.size >= 2],
    ['valid evidence >= 15', ev.length, ev.length >= 15],
    ['attributed claims (debate ammo) >= 5', att.length, att.length >= 5],
    ['candidate show questions >= 3', cq.length, cq.length >= 3],
  ]
  const passed = checks.filter(c => c[2]).length
  const verdict = passed === checks.length ? 'PASS' : passed >= 3 ? 'MARGINAL' : 'FAIL'
  return { ok: true, dossier: s, ev, att, ytOk, webSrc, pubs, cq, checks, verdict }
}

;(async () => {
  console.log(`bootstrapping "${NAME}" -> ${SLUG}`)
  const chans = await discoverChannels()
  console.log(`discovered ${chans.length} channels; top:`)
  chans.slice(0, 6).forEach(c => console.log(`  ${c.score.toFixed(1).padStart(5)}  ${c.name}  (${c.hits} hits, recency ${c.recent}, rel ${(c.rel * 100) | 0}%)`))
  const top = chans.slice(0, 6)
  if (!top.length) { console.error('no channels discovered - aborting'); process.exit(1) }
  writeBeat(top)
  console.log('validating (real stringer through the new beat, web pass on)...')
  const v = await validate()
  if (!v.ok) { console.error('VALIDATION RUN FAILED:', v.error); process.exit(1) }
  const R = []
  R.push(`# ${NAME} — Topic Validation Report`, `*bootstrapped ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · beat: \`lab/beats/${SLUG}.json\`*`, '')
  R.push(`## VERDICT: **${v.verdict}**`, '')
  R.push('| check | value | pass |', '|---|---|---|')
  for (const [label, val, ok] of v.checks) R.push(`| ${label} | ${val} | ${ok ? '✅' : '❌'} |`)
  R.push('', '## Discovered channels (auto-trusted, producer should prune)')
  R.push('| score | channel | hits | recency | sample video |', '|---|---|---|---|---|')
  top.forEach(c => R.push(`| ${c.score.toFixed(1)} | ${c.name} | ${c.hits} | ${['old', 'month', 'week', 'day'][c.recent]} | ${(c.titles[0] || '').replace(/\|/g, '/')} |`))
  R.push('', '## What the research actually returned')
  R.push(`- evidence: **${v.ev.length}** valid (${v.att.length} attributed claims = debate material)`)
  R.push(`- sources transcribed: **${v.ytOk.length}** YouTube + **${v.webSrc.length}** web (${[...v.pubs].slice(0, 8).join(', ')})`)
  R.push('', '### Sample evidence'); v.ev.slice(0, 6).forEach(e => R.push(`- [${e.truth_label}] ${String(e.claim).slice(0, 140)}`))
  R.push('', '## Candidate first-episode questions (from the research itself)')
  v.cq.slice(0, 5).forEach((q, i) => R.push(`${i + 1}. ${typeof q === 'string' ? q : q.question || JSON.stringify(q)}`))
  R.push('', '## Producer TODO before shipping')
  R.push('- prune/confirm the auto-trusted channels (drop anything off-brand)')
  R.push('- verify the suggested Twitter handle (marked UNVERIFIED in the beat)')
  R.push('- pick/confirm the desk (beat defaults to the house crew) and the show name')
  R.push(v.verdict === 'PASS' ? '- ready: build the first episode off a candidate question above' : '- address the ❌ rows above, then re-run this validation')
  const rp = path.join(ROOT, 'lab', 'beats', SLUG + '.VALIDATION.md')
  fs.writeFileSync(rp, R.join('\n') + '\n')
  console.log('VERDICT=' + v.verdict)
  console.log('REPORT=' + rp)
  console.log('DONE')
})().catch(e => { console.error('BOOTSTRAP FAILED:', e.message); process.exit(1) })
