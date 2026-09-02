// TAKES <-> SHOWS glue for the engine (plain Node, no TS): the take inbox lives at lab/takes/<beat>/<slug>/take-<n>.json
// and the command center's /api/command/takes/attach seats it on a briefing. make_show.mjs calls these:
//   inferBeat(root, briefing)                 -> a beat id when --beat was not given (matched from the briefing's title/question)
//   attachTakes(app, beatId, briefingId)      -> POST the attach route; { ok, seated, skipped } or { ok:false, error } (never throws)
//   stampTakes(root, beatId, briefingId, slug) -> used_in: briefing id -> show slug on every take the briefing seated
import fs from 'node:fs'
import path from 'node:path'

const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean)
const STOP = new Set(['south', 'north', 'east', 'west', 'county', 'city', 'state', 'united', 'daily', 'weekly', 'report', 'radio', 'show', 'hour', 'club', 'house', 'story', 'history', 'their', 'there', 'about', 'every', 'building', 'template', 'sports', 'local', 'street', 'news', 'first'])

/** Which beat does a briefing belong to? Exactly one beat whose name / show name / id token appears in the title or question. */
export function inferBeat(root, briefing) {
  const dir = path.join(root, 'lab', 'beats')
  if (!fs.existsSync(dir)) return null
  const text = ' ' + words(`${briefing?.title || ''} ${briefing?.question?.text || ''}`).join(' ') + ' '
  const hits = []
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const beat = readJson(path.join(dir, f))
    if (!beat?.id || beat.status === 'template') continue
    const tokens = new Set()
    for (const src of [beat.id, beat.name, beat.show?.name]) for (const w of words(src)) if (w.length >= 5 && !STOP.has(w)) tokens.add(w)
    if ([...tokens].some(w => text.includes(' ' + w + ' '))) hits.push(beat.id)
  }
  return hits.length === 1 ? hits[0] : null
}

/** Seat the beat's pending takes on the briefing through the app. Unreachable app = { ok:false, error } (a show never fails for this). */
export async function attachTakes(app, beatId, briefingId, timeoutMs = 60000) {
  try {
    const r = await fetch(String(app).replace(/\/$/, '') + '/api/command/takes/attach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ beat: beatId, briefing_id: briefingId }), signal: AbortSignal.timeout(timeoutMs),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.ok) return { ok: false, error: j.error || ('attach http ' + r.status), status: r.status }
    return { ok: true, seated: j.seated || [], skipped: j.skipped || [], detail: j.detail || [] }
  } catch (e) { return { ok: false, error: String(e?.message || e).slice(0, 160) } }
}

/** After a show is built: every take this briefing seated now points at the show. Returns the take paths stamped. */
export function stampTakes(root, beatId, briefingId, showSlug) {
  const base = path.join(root, 'lab', 'takes', beatId)
  if (!beatId || !fs.existsSync(base)) return []
  const stamped = []
  for (const slug of fs.readdirSync(base)) {
    const dir = path.join(base, slug)
    let files = []; try { files = fs.readdirSync(dir).filter(f => /^take-\d+\.json$/.test(f)) } catch { continue }
    for (const f of files) {
      const p = path.join(dir, f), j = readJson(p)
      if (!j || j.used_in !== briefingId) continue
      j.used_in = showSlug; j.used_at = new Date().toISOString(); j.seated_in_briefing = briefingId
      try { fs.writeFileSync(p + '.tmp', JSON.stringify(j, null, 2) + '\n'); fs.renameSync(p + '.tmp', p); stamped.push(p) } catch { /* reported by omission */ }
    }
  }
  return stamped
}
