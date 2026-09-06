import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { humanDelivery, mergeDelivery, type HumanAnswer } from '@/lib/command/agent-brief'
import { findBeat, loadPeople } from '@/lib/command/people'
import { pendingTakes, listTakes, markUsed, type Take } from '@/lib/command/takes'
import { appendLog } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const ROOT = process.cwd()

// compile_beat.mjs seats at most two real people per floor (delegateParts.filter(human).slice(0, 2)); anyone past
// that would be marked used and then silently never spoken, so the inbox hands over two at a time and keeps the rest.
const MAX_HUMANS_ON_FLOOR = 2
const bad = (error: string, status = 400, stage = 'validate') => NextResponse.json({ ok: false, error, stage, retryable: false }, { status })
const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// the floor's line format is NAME (delivery): text, and the renderer only voices names made of letters, spaces, . ' -
const floorName = (s: string) => s.replace(/[^A-Za-z .'\-]/g, '').replace(/\s+/g, ' ').trim()

/** POST {beat, briefing_id, max_age_days?} — every pending take on the beat becomes a verbatim human delegate
 *  delivery on the briefing (humanDelivery + mergeDelivery), voice = the person's longest recorded clip, and the
 *  takes are stamped used_in = briefing_id. Called by make_show before compile; safe to call again (same person
 *  = same cast_id = replaced, never duplicated). Returns who was seated and who was skipped, and why. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  if (typeof b.beat !== 'string' || !/^[a-z0-9-]+$/.test(b.beat)) return bad('beat required')
  if (typeof b.briefing_id !== 'string' || !/^brf_[a-z0-9]+$/.test(b.briefing_id)) return bad('valid briefing_id required')
  const hit = findBeat(b.beat)
  if (!hit) return bad('beat not found', 404, 'load')
  const bp = path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.json')
  if (!fs.existsSync(bp)) return bad('briefing not found', 404, 'load')
  let briefing: any
  try { briefing = JSON.parse(fs.readFileSync(bp, 'utf8')) } catch { return bad('briefing unreadable', 500, 'load') }
  let agents: any = null
  try { agents = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.agents.json'), 'utf8')) } catch { /* no deliveries yet */ }
  const existingHumans = new Set<string>(((agents?.deliveries || []) as any[]).filter(d => d && d.human && d.ok).map(d => String(d.cast_id)))
  const takenNames = new Set<string>(((agents?.deliveries || []) as any[]).filter(d => d && d.human && d.ok).map(d => norm(d.name)))

  const t0 = Date.now()
  const maxAgeDays = Number.isFinite(Number(b.max_age_days)) ? Math.max(1, Number(b.max_age_days)) : 7
  const pending = pendingTakes(hit.beat.id, { maxAgeDays })
  const people = loadPeople(hit.beat.id)
  // group by person, in the order their first pending take arrived
  const groups: { slug: string; takes: Take[] }[] = []
  for (const t of pending) { const g = groups.find(x => x.slug === t.person.slug); if (g) g.takes.push(t); else groups.push({ slug: t.person.slug, takes: [t] }) }

  const seated: any[] = [], skipped: any[] = []
  let seatsLeft = MAX_HUMANS_ON_FLOOR - existingHumans.size
  for (const g of groups) {
    const castId = 'delegate:' + g.slug
    const person = people.find(p => p.slug === g.slug)
    const name = person?.name || g.takes[0].person.name
    const replacing = existingHumans.has(castId)
    if (!replacing && seatsLeft <= 0) { skipped.push({ name, slug: g.slug, takes: g.takes.length, reason: `the floor seats ${MAX_HUMANS_ON_FLOOR} real people per show; queued for the next one` }); continue }
    // main answers first (each take's own words, in order), then typed follow-ups, then tapped choices: the floor
    // seats the first two reasons + the verdict, so two takes from one person both land, in order
    const mains: HumanAnswer[] = [], typed: HumanAnswer[] = [], choices: HumanAnswer[] = []
    for (const t of g.takes) {
      const list = t.answers.length ? t.answers : (t.transcript ? [{ q: t.prompt, a: t.transcript, source: 'typed' as const }] : [])
      list.forEach((x, i) => {
        const ans: HumanAnswer = { q: x.q, a: x.a, source: x.source, ...(x.wav ? { wav: x.wav } : {}) }
        if (i === 0 || (x.source !== 'choice' && norm(x.a) === norm(t.transcript))) mains.push(ans)
        else if (x.source === 'choice') choices.push(ans)
        else typed.push(ans)
      })
    }
    const answers = [...mains, ...typed, ...choices]
    // voice: the longest recorded clip across ALL the person's takes on this beat - used ones included.
    // Only pending takes get SEATED, but the voice print is an identity: a 2-second "yep" today must
    // never replace the clean 19-second ref they gave last week.
    const allTheirs = listTakes(hit.beat.id, g.slug)
    const withVoice = (allTheirs.length ? allTheirs : g.takes).filter(t => t.voice && t.voice.sample_wav && fs.existsSync(t.voice.sample_wav) && t.voice.ref_text).sort((p, q) => (q.voice!.seconds || 0) - (p.voice!.seconds || 0))[0]
    const voice = withVoice ? { sample_wav: withVoice.voice!.sample_wav, ref_text: withVoice.voice!.ref_text, seconds: withVoice.voice!.seconds } : null
    // two people with the same name on one floor must read differently in the transcript
    let display = floorName(name) || g.slug.replace(/-/g, ' ')
    if (takenNames.has(norm(display)) && !replacing) display = person?.relation ? `${display} the ${floorName(person.relation)}` : `${display} II`
    takenNames.add(norm(display))
    const relation = person?.relation || ''
    const personaNote = [relation, person?.channel && person.channel !== 'link' ? `reached by ${person.channel}` : ''].filter(Boolean).join(', ') || null
    const delivery: any = humanDelivery(briefing, { name: display, persona_note: personaNote }, answers, voice)
    if (!delivery) { skipped.push({ name, slug: g.slug, takes: g.takes.length, reason: 'no words in their takes' }); continue }
    delivery.cast_id = castId   // the person's slug, not a re-slug of the name: two Marcuses stay two seats
    delivery.person = { slug: g.slug, name, relation, channel: person?.channel || 'link' }
    delivery.takes = g.takes.map(t => t.take)
    delivery.seated_via = 'take-inbox'
    if (g.takes.length > 1) delivery.notes = `gave ${g.takes.length} takes; seated in order, take ${g.takes[0].take} first. If a later take contradicts an earlier one, the host should notice the change.`
    mergeDelivery(b.briefing_id, delivery)
    markUsed(g.takes.map(t => t.path), b.briefing_id)
    if (!replacing) { existingHumans.add(castId); seatsLeft-- }
    seated.push({ name: display, slug: g.slug, takes: g.takes.length, answers: answers.length, voice: !!voice, voice_seconds: voice?.seconds ?? null, replaced: replacing })
  }
  appendLog({ kind: 'take', stage: 'attach', ok: true, beat: hit.beat.id, ref: b.briefing_id, ms: Date.now() - t0, summary: `inbox -> briefing: ${seated.length ? seated.map(s => s.name + (s.voice ? ' (own voice)' : '')).join(', ') + ' seated' : 'nobody to seat'}${skipped.length ? ` · ${skipped.length} skipped` : ''}`, meta: { seated: seated.map(s => s.slug), skipped: skipped.map(s => s.slug + ': ' + s.reason), pending_takes: pending.length } })
  return NextResponse.json({ ok: true, seated: seated.map(s => s.name), skipped: skipped.map(s => ({ name: s.name, reason: s.reason })), detail: seated, pending_left: skipped.reduce((n, s) => n + (s.takes || 0), 0) })
}
