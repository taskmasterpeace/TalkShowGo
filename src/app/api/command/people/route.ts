import { NextResponse } from 'next/server'
import path from 'node:path'
import { findBeat, repairPeople, addPerson, removePerson } from '@/lib/command/people'
import { listTakes } from '@/lib/command/takes'
import { appendLog } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error, stage: 'validate', retryable: false }, { status })
const beatIdOk = (s: unknown) => typeof s === 'string' && /^[a-z0-9-]+$/.test(s)

/** GET ?beat=<id>[&takes=1] — the people on a beat (with their links); takes=1 adds every take they dropped, with used_in. */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const beatId = u.searchParams.get('beat') || ''
  if (!beatIdOk(beatId)) return bad('beat required')
  const hit = findBeat(beatId)
  if (!hit) return NextResponse.json({ ok: false, error: 'beat not found', stage: 'load' }, { status: 404 })
  const withTakes = u.searchParams.get('takes') === '1'
  const takes = withTakes ? listTakes(hit.beat.id) : []
  const people = repairPeople(hit.beat.id).map(p => {
    const mine = takes.filter(t => t.person.slug === p.slug).map(t => ({
      ...t, path: undefined,
      audio_url: t.wav ? `/api/command/audio/takes/${hit.beat.id}/${p.slug}/${path.basename(t.wav)}` : null,
      voice: t.voice ? { seconds: t.voice.seconds, trimmed: !!(t.voice as any).trimmed, audio_url: `/api/command/audio/takes/${hit.beat.id}/${p.slug}/${path.basename(t.voice.sample_wav)}` } : null,
    }))
    return { ...p, link_path: `/take/${p.token}`, takes: withTakes ? mine : undefined, take_count: mine.length, pending: mine.filter(t => !t.used_in).length }
  })
  return NextResponse.json({ ok: true, beat: { id: hit.beat.id, name: hit.beat.name, file: hit.file, show: hit.beat.show || null }, people })
}

/** POST {beat, name, relation?, channel?, address?, prompts_mode?, custom_prompts?} — attach a person; mints their private link. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  if (!beatIdOk(b.beat)) return bad('beat required')
  try {
    const person = addPerson(b.beat, { name: b.name, relation: b.relation, channel: b.channel, address: b.address, prompts_mode: b.prompts_mode, custom_prompts: b.custom_prompts })
    appendLog({ kind: 'take', stage: 'person', ok: true, beat: b.beat, ref: person.slug, summary: `${person.name} added to the beat (${person.relation || 'no relation given'} · ${person.channel}) · link minted`, meta: { channel: person.channel, has_address: !!person.address } })
    return NextResponse.json({ ok: true, person: { ...person, link_path: `/take/${person.token}` } })
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 200)
    return bad(error, /not found/.test(error) ? 404 : 400)
  }
}

/** DELETE {beat, slug} — detach a person (their takes on disk are kept; only the link dies). */
export async function DELETE(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  if (!beatIdOk(b.beat) || !beatIdOk(b.slug)) return bad('beat + slug required')
  const removed = removePerson(b.beat, b.slug)
  if (removed) appendLog({ kind: 'take', stage: 'person', ok: true, beat: b.beat, ref: b.slug, summary: `${b.slug} removed from the beat · link dead · takes kept on disk` })
  return NextResponse.json({ ok: true, removed })
}
