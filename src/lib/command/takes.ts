// THE TAKE INBOX — lab/takes/<beat>/<person_slug>/take-<n>.json, one file per thing a person dropped
// through their link (spoken and transcribed, or typed). The next show built for the beat seats every
// UNUSED take word for word (see /api/command/takes/attach), then stamps used_in with the briefing id and,
// once the show renders, the show slug. Files are the source of truth; the PEOPLE page is CRUD over them.
import fs from 'node:fs'
import path from 'node:path'
import { nextTake } from './audio-intake'

export type TakeSource = 'voice' | 'typed' | 'choice'
export type TakeAnswer = { q: string; a: string; source: TakeSource; wav?: string }
export type TakeVoice = { sample_wav: string; ref_text: string; seconds: number }
export type Take = {
  beat: string; person: { slug: string; name: string }; take: number
  prompt: string; prompts?: string[]; transcript: string; answers: TakeAnswer[]
  seconds: number | null; wav: string | null; mime: string | null; voice?: TakeVoice | null; capped?: boolean
  via?: string; created_at: string; used_in: string | null; used_at?: string; path: string
}
export type TakeInput = Partial<Omit<Take, 'beat' | 'person' | 'path' | 'used_in'>>

export const takeDir = (beatId: string, slug: string, root = process.cwd()) => path.join(root, 'lab', 'takes', beatId, slug)
const readJson = (p: string) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const writeAtomic = (p: string, obj: any) => { fs.writeFileSync(p + '.tmp', JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(p + '.tmp', p) }
const safeSlug = (s: string) => /^[a-z0-9-]+$/.test(s)

/** Write take-<n>.json (n = the recorded clip's number when there is one, else the next free number). */
export function saveTake(beatId: string, person: { slug: string; name: string }, data: TakeInput, root = process.cwd()): Take {
  if (!safeSlug(beatId) || !safeSlug(person.slug)) throw new Error('bad beat or person slug')
  const dir = takeDir(beatId, person.slug, root)
  fs.mkdirSync(dir, { recursive: true })
  const n = Number.isInteger(data.take) && (data.take as number) >= 1 ? (data.take as number) : nextTake(dir)
  const p = path.join(dir, `take-${n}.json`)
  const answers: TakeAnswer[] = (Array.isArray(data.answers) ? data.answers : []).filter(x => x && typeof x.a === 'string').map(x => ({ q: String(x.q || '').slice(0, 240), a: x.a, source: x.source === 'voice' || x.source === 'choice' ? x.source : 'typed', ...(x.wav ? { wav: x.wav } : {}) }))
  const obj = {
    beat: beatId, person: { slug: person.slug, name: person.name }, take: n,
    prompt: String(data.prompt || '').slice(0, 240), ...(Array.isArray(data.prompts) ? { prompts: data.prompts.map(String) } : {}),
    transcript: String(data.transcript || ''), answers,
    seconds: Number.isFinite(Number(data.seconds)) ? Number(data.seconds) : null, wav: data.wav || null, mime: data.mime || null,
    voice: data.voice || null, ...(data.capped ? { capped: true } : {}), ...(data.via ? { via: data.via } : {}),
    created_at: data.created_at && Number.isFinite(Date.parse(data.created_at)) ? data.created_at : new Date().toISOString(),
    used_in: null as string | null,
  }
  writeAtomic(p, obj)
  return { ...obj, path: p }
}

export function readTake(p: string): Take | null {
  const j = readJson(p)
  if (!j || typeof j !== 'object' || !j.person || !Number.isInteger(j.take)) return null
  return { ...j, answers: Array.isArray(j.answers) ? j.answers : [], transcript: String(j.transcript || ''), used_in: j.used_in || null, path: p }
}

/** Every take on a beat (or one person's), oldest first. */
export function listTakes(beatId: string, slug?: string, root = process.cwd()): Take[] {
  if (!safeSlug(beatId) || (slug && !safeSlug(slug))) return []
  const base = path.join(root, 'lab', 'takes', beatId)
  if (!fs.existsSync(base)) return []
  const slugs = slug ? [slug] : fs.readdirSync(base).filter(d => { try { return fs.statSync(path.join(base, d)).isDirectory() } catch { return false } })
  const out: Take[] = []
  for (const s of slugs) {
    const dir = path.join(base, s)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) if (/^take-\d+\.json$/.test(f)) { const t = readTake(path.join(dir, f)); if (t) out.push(t) }
  }
  return out.sort((a, b) => (Date.parse(a.created_at) - Date.parse(b.created_at)) || (a.take - b.take) || a.person.slug.localeCompare(b.person.slug))
}

/** What a take says, in order: the main answer, then anything else they added. */
export function takeText(t: { transcript?: string; answers?: { a?: string }[] }): string {
  const main = String(t.transcript || '').trim()
  const rest = (t.answers || []).map(x => String(x?.a || '').trim()).filter(a => a && a !== main)
  return [main, ...rest].filter(Boolean).join(' ')
}

/** Unused, recent (default 7 days), and actually saying something. This is what the next show seats. */
export function pendingTakes(beatId: string, opts: { maxAgeDays?: number } = {}, root = process.cwd()): Take[] {
  const maxAge = (opts.maxAgeDays ?? 7) * 86400e3
  const now = Date.now()
  return listTakes(beatId, undefined, root).filter(t => !t.used_in && now - Date.parse(t.created_at) <= maxAge && takeText(t).length > 0)
}

/** Stamp used_in (+ used_at) on the given take files. Returns how many were updated. */
export function markUsed(takePaths: string[], usedIn: string): number {
  let n = 0
  for (const p of takePaths || []) {
    const j = readJson(p)
    if (!j || typeof j !== 'object') continue
    j.used_in = String(usedIn); j.used_at = new Date().toISOString()
    try { writeAtomic(p, j); n++ } catch { /* a torn write is reported by the count */ }
  }
  return n
}
