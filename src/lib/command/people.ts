// PEOPLE ON A BEAT — a real person attached to a coverage area (Dad on the Falcons, a councilman's
// neighbor on Orangeburg). Each carries a private token: /take/<token> is their link, and whatever they
// drop there lands in the beat's take inbox (lab/takes/<beat>/<slug>/), to be seated verbatim on the next
// show. Lives in beat.people[] inside lab/beats/<id>.json. Beats are written by the scout, the pull and the
// producer too, so every write here RE-READS the file and patches ONLY people[] (atomic temp + rename).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export type Channel = 'link' | 'email' | 'phone'
export type Person = {
  slug: string; name: string; relation: string; channel: Channel; address: string | null
  token: string; prompts_mode: 'auto' | 'custom'; custom_prompts: string[]; added: string
  depth?: 'casual' | 'regular' | 'diehard' // how they follow the beat (from their last take) - returning fans skip the quiz
}
export type PersonInput = { name: string; relation?: string; channel?: string; address?: string | null; prompts_mode?: string; custom_prompts?: unknown }
export type BeatHit = { file: string; beat: any; person: Person }

const CHANNELS = new Set<string>(['link', 'email', 'phone'])
const TOKEN_RE = /^[a-z0-9]{16}$/
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const beatsDir = (root: string) => path.join(root, 'lab', 'beats')

/** 16 chars of [a-z0-9] from crypto.randomBytes (rejection sampling: every char equally likely). ~83 bits. */
export function newToken(): string {
  let out = ''
  while (out.length < 16) {
    const bytes = crypto.randomBytes(32)
    for (let i = 0; i < bytes.length && out.length < 16; i++) if (bytes[i] < 252) out += ALPHABET[bytes[i] % 36]
  }
  return out
}
export const isToken = (t: unknown): t is string => typeof t === 'string' && TOKEN_RE.test(t)
/** folder name + cast_id tail for a person: 'delegate:' + this */
export const personSlug = (name: unknown) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest'
export function uniqueSlug(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) { const s = `${base}-${n}`; if (!taken.includes(s)) return s }
}

const readJson = (p: string) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const writeAtomic = (p: string, obj: any) => { fs.writeFileSync(p + '.tmp', JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(p + '.tmp', p) }

/** Find a beat by id: lab/beats/<id>.json first, else the file whose beat.id matches. */
export function findBeat(beatId: string, root = process.cwd()): { file: string; beat: any } | null {
  const id = String(beatId || '').trim()
  if (!/^[a-z0-9-]+$/.test(id)) return null
  const dir = beatsDir(root)
  const direct = path.join(dir, id + '.json')
  if (fs.existsSync(direct)) { const beat = readJson(direct); if (beat) return { file: id + '.json', beat } }
  if (!fs.existsSync(dir)) return null
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const beat = readJson(path.join(dir, f)); if (beat && beat.id === id) return { file: f, beat } }
  return null
}

// a row as stored may be hand-edited: keep anyone with a name, derive a missing slug, blank a bad token
function normPerson(raw: any): Person | null {
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.name.trim()) return null
  const name = raw.name.trim().slice(0, 80)
  const channel: Channel = CHANNELS.has(String(raw.channel)) ? raw.channel : 'link'
  return {
    slug: typeof raw.slug === 'string' && /^[a-z0-9-]+$/.test(raw.slug) ? raw.slug : personSlug(name),
    name, relation: typeof raw.relation === 'string' ? raw.relation.trim().slice(0, 80) : '',
    channel, address: typeof raw.address === 'string' && raw.address.trim() ? raw.address.trim() : null,
    token: isToken(raw.token) ? raw.token : '',
    prompts_mode: raw.prompts_mode === 'custom' ? 'custom' : 'auto',
    custom_prompts: Array.isArray(raw.custom_prompts) ? raw.custom_prompts.filter((q: any) => typeof q === 'string' && q.trim()).map((q: string) => q.trim().slice(0, 240)).slice(0, 6) : [],
    added: typeof raw.added === 'string' ? raw.added : '',
    ...(['casual', 'regular', 'diehard'].includes(raw.depth) ? { depth: raw.depth } : {}),
  }
}
const peopleOf = (beat: any): Person[] => (Array.isArray(beat?.people) ? beat.people : []).map(normPerson).filter((p: Person | null): p is Person => !!p)

export function loadPeople(beatId: string, root = process.cwd()): Person[] {
  const hit = findBeat(beatId, root)
  return hit ? peopleOf(hit.beat) : []
}

/** Re-read the beat file NOW, let the mutator rewrite people[] on the fresh copy, write atomically. Nothing else in the file is touched. */
function patchPeople(root: string, file: string, mutate: (people: Person[]) => Person[]): Person[] {
  const p = path.join(beatsDir(root), file)
  const cur = readJson(p)
  if (!cur) throw new Error('beat unreadable: ' + file)
  const next = mutate(peopleOf(cur))
  // repair on write: anyone who lost their token (hand edit) gets one, so their link works again
  for (const person of next) if (!isToken(person.token)) person.token = freshToken(root)
  cur.people = next
  writeAtomic(p, cur)
  return next
}
function freshToken(root: string): string {
  for (let i = 0; i < 20; i++) { const t = newToken(); if (!personByToken(t, root)) return t }
  throw new Error('could not mint a unique token')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const E164_RE = /^\+[1-9]\d{6,14}$/

export function addPerson(beatId: string, input: PersonInput, root = process.cwd()): Person {
  const name = String(input?.name || '').trim().slice(0, 80)
  if (!name) throw new Error('name required')
  const channel = String(input?.channel || 'link').trim().toLowerCase()
  if (!CHANNELS.has(channel)) throw new Error('channel must be link, email or phone')
  let address: string | null = null
  if (channel === 'email') {
    address = String(input?.address || '').trim().toLowerCase()
    if (!address) throw new Error('email address required for the email channel')
    if (!EMAIL_RE.test(address)) throw new Error('that email address does not look right')
  } else if (channel === 'phone') {
    address = String(input?.address || '').replace(/[\s().-]/g, '')
    if (!address) throw new Error('phone number required, in E.164 form like +14045551234')
    if (!E164_RE.test(address)) throw new Error('phone number must be E.164, like +14045551234')
  }
  const hit = findBeat(beatId, root)
  if (!hit) throw new Error('beat not found: ' + beatId)
  const custom = Array.isArray(input?.custom_prompts) ? (input.custom_prompts as any[]).filter(q => typeof q === 'string' && q.trim()).map(q => String(q).trim().slice(0, 240)).slice(0, 6) : []
  const token = freshToken(root)
  let made: Person | null = null
  patchPeople(root, hit.file, people => {
    made = {
      slug: uniqueSlug(personSlug(name), people.map(p => p.slug)), name,
      relation: String(input?.relation || '').trim().slice(0, 80), channel: channel as Channel, address, token,
      prompts_mode: input?.prompts_mode === 'custom' && custom.length ? 'custom' : 'auto', custom_prompts: custom,
      added: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    }
    return [...people, made]
  })
  return made!
}

export function removePerson(beatId: string, slug: string, root = process.cwd()): boolean {
  const hit = findBeat(beatId, root)
  if (!hit) return false
  let removed = false
  patchPeople(root, hit.file, people => { const next = people.filter(p => p.slug !== slug); removed = next.length !== people.length; return next })
  return removed
}

/** Remember how a person follows the beat (set when a saved take carries a fan depth). Silent no-op on a missing beat/person. */
export function setPersonDepth(beatId: string, slug: string, depth: string, root = process.cwd()): void {
  if (!['casual', 'regular', 'diehard'].includes(depth)) return
  const hit = findBeat(beatId, root)
  if (!hit) return
  try { patchPeople(root, hit.file, people => people.map(p => (p.slug === slug ? { ...p, depth: depth as Person['depth'] } : p))) } catch { /* depth memory is a courtesy, never worth failing a save */ }
}

/** Anyone whose token went missing gets one (writes only when something was wrong). Returns the people. */
export function repairPeople(beatId: string, root = process.cwd()): Person[] {
  const hit = findBeat(beatId, root)
  if (!hit) return []
  const people = peopleOf(hit.beat)
  if (people.every(p => isToken(p.token)) && people.every((p, i) => hit.beat.people[i] && hit.beat.people[i].slug === p.slug)) return people
  return patchPeople(root, hit.file, ps => ps)
}

/** The whole reason tokens exist: a private link resolves to exactly one person on one beat, or nothing. */
export function personByToken(token: unknown, root = process.cwd()): BeatHit | null {
  if (!isToken(token)) return null
  const dir = beatsDir(root)
  if (!fs.existsSync(dir)) return null
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const beat = readJson(path.join(dir, f))
    if (!beat) continue
    const person = peopleOf(beat).find(p => p.token === token)
    if (person) return { file: f, beat, person }
  }
  return null
}
