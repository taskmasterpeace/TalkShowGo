import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execFileP = promisify(execFile)

export const runtime = 'nodejs'
export const maxDuration = 600
const ROOT = process.cwd()
const CAST = path.join(ROOT, 'lab', 'cast')
const IMG = path.join(CAST, 'images')
const VOX = path.join(CAST, 'voices')
const readJSON = (p: string, d: any) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const exists = (...p: string[]) => fs.existsSync(path.join(VOX, ...p))

// A library/host id -> its playable reference voice, as an /api/command/audio/voices/<...> path (or null).
function voiceFor(id: string): string | null {
  if (exists('library', `${id}.wav`)) return `library/${id}.wav`
  const special: Record<string, string[]> = {
    'tasha-raw': ['tasha.wav'],
    'champagne-dwayne': ['dwayne.wav', 'candidates/dwayne-B.wav', 'candidates/dwayne-A.wav'],
    'andrew-hammond': ['candidates/blaze-A.wav'],
    'marcus-blaze': ['blaze.wav', 'candidates/blaze-B.wav'],
    'king-knowledge': ['knowledge.wav', 'candidates/knowledge-A.wav'],
  }
  for (const rel of special[id] || []) if (exists(...rel.split('/'))) return rel
  return null
}

/** GET — the ROSTER for the picker: every character that has portraits, with its 3 variations,
 *  the locked pick, tags/essence, and a playable reference voice. Files come from portraits.json +
 *  cast.json (hosts) + library.json (library voices) + library/<id>.json (full library characters). */
export async function GET() {
  const spec = readJSON(path.join(IMG, 'portraits.json'), { subjects: {}, _picks: {} })
  const cast = readJSON(path.join(CAST, 'cast.json'), { hosts: [] })
  const lib = readJSON(path.join(CAST, 'voices', 'library', 'library.json'), { voices: [] })
  const picks: Record<string, number> = spec._picks || {}
  const byId: Record<string, any> = {}
  for (const h of cast.hosts || []) byId[h.id] = { role: h.role, lane: h.lane, tags: h.tags || [], essence: h.print?.essence, personality: !!h.print }
  for (const v of lib.voices || []) byId[v.id] = { ...(byId[v.id] || {}), tags: v.tags || (byId[v.id]?.tags), note: v.note }
  // full library character bundles (e.g. sonny-cash.json) win for role/lane/essence + carry the PERSONALITY
  for (const f of (fs.existsSync(path.join(CAST, 'library')) ? fs.readdirSync(path.join(CAST, 'library')) : [])) {
    if (!f.endsWith('.json') || f === 'library.json') continue
    const b = readJSON(path.join(CAST, 'library', f), {})
    if (b.id) byId[b.id] = { ...(byId[b.id] || {}), role: b.role, lane: b.lane, tags: b.tags || byId[b.id]?.tags, essence: b.print?.essence, personality: !!b.print }
  }
  const roster = Object.entries(spec.subjects || {}).map(([id, s]: any) => {
    const variants = [1, 2, 3].filter(v => fs.existsSync(path.join(IMG, `${id}_${v}.png`)))
      .map(v => ({ v, url: `/api/command/audio/images/${id}_${v}.png` }))
    const vf = voiceFor(id)
    const meta = byId[id] || {}
    return {
      id, name: s.name, role: meta.role || null, lane: meta.lane || null,
      tags: meta.tags || [], essence: meta.essence || null, note: meta.note || null,
      hasPersonality: !!meta.personality,
      subject: (s as any).subject || null,
      variants, locked: picks[id] || (variants[0]?.v ?? 1),
      voice: vf ? `/api/command/audio/voices/${vf}` : null,
    }
  }).filter(r => r.variants.length)
  return NextResponse.json({ roster })
}

/** POST {action:'lockPortrait', id, variant} — set a character's locked face to one of its variations
 *  (copies images/<id>_<v>.png -> images/<id>.png and records it in portraits.json _picks). */
export async function POST(req: Request) {
  const body = await req.json()
  const { action, id } = body
  if (!/^[a-z0-9-]+$/.test(String(id))) return NextResponse.json({ error: 'bad id' }, { status: 400 })

  if (action === 'lockPortrait') {
    const variant = Number(body.variant)
    if (![1, 2, 3].includes(variant)) return NextResponse.json({ error: 'bad variant' }, { status: 400 })
    const src = path.join(IMG, `${id}_${variant}.png`)
    if (!fs.existsSync(src)) return NextResponse.json({ error: 'no such variant' }, { status: 404 })
    fs.copyFileSync(src, path.join(IMG, `${id}.png`))
    const specPath = path.join(IMG, 'portraits.json')
    const spec = readJSON(specPath, {})
    spec._picks = { ...(spec._picks || {}), [id]: variant }
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n')
    return NextResponse.json({ ok: true, id, variant })
  }

  // genPortrait: (optionally) edit the character's image PROMPT, then regenerate its 3 shots via cupcake Krea
  // (gen_portraits_krea.mjs, cinematic LoRA). Self-serve so producers - and users on deploy - can make faces.
  if (action === 'genPortrait') {
    const specPath = path.join(IMG, 'portraits.json')
    const spec = readJSON(specPath, {})
    spec.subjects = spec.subjects || {}
    if (typeof body.subject === 'string' && body.subject.trim()) {
      const nm = (typeof body.name === 'string' && body.name.trim()) ? body.name.trim() : (spec.subjects[id]?.name || id)
      spec.subjects[id] = { ...(spec.subjects[id] || {}), name: nm, subject: body.subject.trim() }
      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n')
    }
    if (!spec.subjects[id]?.subject) return NextResponse.json({ error: 'no image prompt for ' + id }, { status: 404 })
    for (const v of [1, 2, 3]) { const f = path.join(IMG, `${id}_${v}.png`); if (fs.existsSync(f)) { try { fs.unlinkSync(f) } catch {} } }
    const script = path.join(ROOT, 'lab', 'engine', 'gen_portraits_krea.mjs')
    try {
      await execFileP('node', [script, id], { cwd: ROOT, timeout: 9 * 60 * 1000, maxBuffer: 4 << 20 })
    } catch (e: any) {
      return NextResponse.json({ error: 'generation failed (box busy? cupcake down?): ' + String(e?.message || e).slice(0, 200) }, { status: 500 })
    }
    const variants = [1, 2, 3].filter(v => fs.existsSync(path.join(IMG, `${id}_${v}.png`)))
      .map(v => ({ v, url: `/api/command/audio/images/${id}_${v}.png?t=${Date.now()}` }))
    if (!variants.length) return NextResponse.json({ error: 'generator produced no images' }, { status: 500 })
    return NextResponse.json({ ok: true, id, variants })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

/** PUT {cast} — write cast.json (host bundles + producer are UI-editable; voices/images ride separate files). */
export async function PUT(req: Request) {
  const { cast } = await req.json()
  if (!cast || !Array.isArray(cast.hosts) || !cast.producer) return NextResponse.json({ error: 'bad cast' }, { status: 400 })
  fs.writeFileSync(path.join(CAST, 'cast.json'), JSON.stringify(cast, null, 2) + '\n')
  return NextResponse.json({ ok: true })
}
