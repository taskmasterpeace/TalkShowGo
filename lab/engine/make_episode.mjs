#!/usr/bin/env node
/**
 * MAKE EPISODE (P2 segments) — stitch several finished segment floors into ONE multi-story episode:
 *   moderator COLD OPEN naming tonight's slate -> segment 1 -> moderator TRANSITION -> segment 2 -> ... -> SIGN-OFF.
 * Each segment is an already-built show (its lab/shows/<slug>/floor/segment_final.md). The show's MODERATOR
 * (the anchor-lane host) writes the intro/transitions/outro via a cheap model. Output: one episode.md that the
 * voice stage can render as a single leveled mp3 later. This is the seam that turns single-story cuts into a SHOW.
 *
 * Usage: node lab/engine/make_episode.mjs --beat=<id> --segments=<slug1,slug2,...> [--topics="a|b|c"] [--out=<path>] [--model=<id>]
 */
import fs from 'node:fs'
import path from 'node:path'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const readEnvKey = name => { const e = process.env[name]; if (e && e.trim()) return e.trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch { /* no .env */ } return null }
const OR = readEnvKey('OPENROUTER_API_KEY')

async function line(model, sys, user) {
  if (!OR) return ''
  // reasoning models would burn the budget; transitions are cheap one-liners on a fast model, so no reasoning + a real token ceiling
  const body = { model, temperature: 0.7, max_tokens: 220, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }
  if (/gpt-5|o1|o3|sonnet-5|deepseek-r1|thinking/i.test(model)) body.reasoning = { effort: 'low' }
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + OR, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
  const j = await r.json()
  return clean(String(j.choices?.[0]?.message?.content || '')).replace(/\*+|_{2,}|`+/g, '').replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim()
}

// tidy text artifacts so the episode reads clean: common UTF-8 mojibake (â€™ from mixed encodings) + smart
// quotes/dashes that read as "visibly generated" on the page (the judge's knock).
function clean(s) {
  return String(s || '')
    .replace(/â€™/g, "'").replace(/â€˜/g, "'").replace(/â€œ/g, '"').replace(/â€/g, '"').replace(/â€"/g, '...').replace(/â€"/g, '...').replace(/Â/g, '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, '...')
}
// the last substantive spoken line of a segment (its resolution), so a transition/sign-off can reference where it LANDED
function lastLineOf(md) {
  const ls = md.split(/\n/).map(l => l.replace(/^[A-Z][A-Z .'\-]*(\[[^\]]*\])?\s*(\([^)]*\))?\s*:/, '').replace(/\[E\d+\]/g, '').trim()).filter(Boolean)
  return (ls[ls.length - 1] || '').slice(0, 220)
}

// trim a segment's OWN greeting + sign-off so the stitched episode has one cold open and one close (no resets between segments)
function trimSeg(md) {
  let lines = md.split(/\n/).filter(l => l.trim())
  if (lines[0]) lines[0] = lines[0].replace(/(:\s*)(good evening|good afternoon|good morning|welcome back|welcome|hey|hi|what's up[^.!?]*)(,?\s*(everyone|folks|y'?all|guys|fans|and welcome[^.!?]*))?[,.!]?\s*/i, '$1')
  const li = lines.length - 1
  if (li > 0 && /thanks for (joining|watching|tuning|being)|see you (next|tomorrow|then|soon)|that's (all|our show|the show|it for)|good ?night|signing off|until next|catch you/i.test(lines[li])) lines = lines.slice(0, -1)
  return lines.join('\n')
}

async function main() {
  if (!ARG.beat || !ARG.segments) { console.error('need --beat=<id> --segments=<slug1,slug2,...>'); process.exit(1) }
  const beat = J(path.join(ROOT, 'lab', 'beats', ARG.beat + '.json'))
  const cast = J(path.join(ROOT, 'lab', 'cast', 'cast.json'))
  const show = beat.show || {}
  const slugs = String(ARG.segments).split(',').map(s => s.trim()).filter(Boolean)
  if (slugs.length < 2) { console.error('need >= 2 segments'); process.exit(1) }
  // MODERATOR = an anchor/moderator/framing host, else a desk host, else the first host
  const laneOf = id => { const h = (cast.hosts || []).find(x => x.id === id); return h ? String(h.lane || h.role || '').toLowerCase() : '' }
  const modId = (show.hosts || []).find(id => /anchor|moderat|framing|referee/.test(laneOf(id))) || (show.hosts || []).find(id => /desk/.test(laneOf(id))) || (show.hosts || [])[0]
  const modName = String((cast.hosts || []).find(h => h.id === modId)?.name || 'HOST').toUpperCase()
  const MODEL = (typeof ARG.model === 'string' && ARG.model) || 'google/gemini-2.5-flash-lite'
  const topicOverride = typeof ARG.topics === 'string' ? ARG.topics.split('|').map(s => s.trim()) : null

  const segs = slugs.map((slug, i) => {
    const dir = path.join(ROOT, 'lab', 'shows', slug)
    const md = clean(trimSeg(fs.readFileSync(path.join(dir, 'floor', 'segment_final.md'), 'utf8').replace(/^#[^\n]*\n\n?/, '').trim()))
    let topic = slug; try { topic = J(path.join(dir, 'status.json')).question || slug } catch { /* no status */ }
    if (topicOverride && topicOverride[i]) topic = topicOverride[i]
    return { slug, md, topic }
  })
  const topics = segs.map(s => s.topic)
  const showName = show.name || beat.id

  const intro = await line(MODEL, `You are ${modName}, host/moderator of "${showName}". Write the COLD OPEN: greet the audience and name tonight's lineup of ${segs.length} stories in order. One or two spoken sentences, energetic but clean, no stage directions, no em-dashes.`, `Tonight, in order:\n${topics.map((t, i) => (i + 1) + '. ' + t).join('\n')}`)
  const trans = []
  for (let i = 0; i < segs.length - 1; i++) trans.push(await line(MODEL, `You are ${modName} moderating "${showName}". Write ONE spoken transition (1-2 sentences): first nod to the SPECIFIC takeaway the segment just finished landed on (use a real detail from it), THEN pivot to the next story with a hook. A natural broadcast handoff. Stay ACCURATE to the teams and names in the stories - never swap in a different team. Do NOT open with a generic "that's a big question"; no stage directions, no em-dashes.`, `Segment just finished: ${segs[i].topic}\nWhere it landed: "${lastLineOf(segs[i].md)}"\nUp next: ${segs[i + 1].topic}`))
  // THE CLOSING RITUAL (Robert 2026-09-05: "we got the opening - we need a closing"). Per the beat's own outro
  // template: the moderator opens the round, each DEBATER lands one bold on-the-record PREDICTION "the comments
  // can hold us to", then the moderator signs off with the forward button. Guests (comedians etc.) don't predict.
  const speakerNames = [...new Set(segs.flatMap(s => [...s.md.matchAll(/^([A-Z][A-Z .'-]+?)\s*(?:\[[^\]]+\])?\s*(?:\([^)]*\))?:/gm)].map(m => m[1].trim())))]
  const hostByName = Object.fromEntries((cast.hosts || []).map(h => [String(h.name).toUpperCase(), h]))
  const debaters = speakerNames.filter(n => n !== modName && hostByName[n] && hostByName[n].role === 'host')
  const closeIntro = debaters.length ? await line(MODEL, `You are ${modName}, host of "${showName}". Write ONE spoken line opening the CLOSING ROUND: tell the desk it's time for bold predictions the comments can hold them to, and toss to ${hostByName[debaters[0]].name} by first name. Energetic, short, no em-dashes.`, `Tonight's stories:\n${topics.map((t, i) => (i + 1) + '. ' + t).join('\n')}`) : ''
  const preds = []
  for (const n of debaters) {
    const h = hostByName[n]; const p = h.print || {}
    preds.push([n, await line(MODEL, `You are ${h.name}, a host on "${showName}". WHO YOU ARE: ${(p.essence || '').slice(0, 300)} YOUR VOICE: ${(p.speech && p.speech.tone) || ''}. This is the CLOSING ROUND - the show is ENDING: NO greeting, NO "welcome back", NO introducing yourself or the show; the moderator just tossed to you, so go STRAIGHT into the call. Write ONE bold, SPECIFIC, ownable PREDICTION about tonight's stories - a real call the comments can hold you to (a name, a number, or an outcome). It MUST differ from any prediction already on the record (listed below). Use the season/year exactly as the stories state it. 1-2 spoken sentences, committed, no hedging, no em-dashes.`, `Tonight's stories:\n${topics.join('\n')}${preds.length ? '\nAlready on the record (yours must DIFFER): ' + preds.map(x => x[1]).join(' | ') : ''}`)])
  }
  const outroTpl = (show.outro && show.outro.template) ? ` Honor this house outro STYLE by performing it, never by quoting or restating the style text itself: "${show.outro.template}".` : ''
  const outro = await line(MODEL, `You are ${modName} closing "${showName}". The show is OVER - every segment already happened, so never tease tonight's own segments as upcoming. The desk just put their closing predictions on the record. Write the SIGN-OFF (1-2 spoken sentences): tell the audience the predictions are on the record and the comments can hold the desk to them, then button the episode with ONE forward hook to next time. The hook is simple and safe: the next game is coming and the desk will be back on these stories - NEVER invent a new topic for next week and NEVER name any year or season in the sign-off.${outroTpl} No generic "thanks for watching" on its own, no em-dashes.`, `Tonight covered (all already aired):\n` + segs.map((s, i) => `Story ${i + 1}: ${s.topic}`).join('\n'))

  const parts = [`# EPISODE - ${showName} - ${segs.length} segments`, '', `${modName} (cold open): ${intro}`, '']
  segs.forEach((s, i) => {
    parts.push(`<!-- SEGMENT ${i + 1}: ${s.topic} -->`, '', s.md, '')
    if (i < segs.length - 1) parts.push(`${modName} (transition): ${trans[i]}`, '')
  })
  if (closeIntro) {
    parts.push(`<!-- CLOSING ROUND -->`, '', `${modName} (closing round): ${closeIntro}`, '')
    for (const [n, p] of preds) parts.push(`${n} (closing prediction): ${p}`, '')
  }
  parts.push(`${modName} (sign-off): ${outro}`, '')
  const out = (typeof ARG.out === 'string' && ARG.out) || path.join(ROOT, 'lab', 'shows', slugs[0], 'episode.md')
  fs.writeFileSync(out, parts.join('\n'))
  console.log('EPISODE ->', out)
  console.log(segs.length, 'segments ·', modName, 'moderating (' + modId + ')')
  console.log('COLD OPEN:', intro)
  trans.forEach((t, i) => console.log(`TRANSITION ${i + 1}->${i + 2}:`, t))
  preds.forEach(([n, p]) => console.log(`PREDICTION ${n}:`, p))
  console.log('SIGN-OFF:', outro)
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
