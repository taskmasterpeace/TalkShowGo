import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execFileP = promisify(execFile)

export const runtime = 'nodejs'
export const maxDuration = 600
const ROOT = process.cwd()
const BEATS = path.join(ROOT, 'lab', 'beats')
const BRAND = path.join(ROOT, 'lab', 'branding')
const LOGODIR = path.join(BRAND, 'logos')
const SPEC = path.join(BRAND, 'logos.json')
const readJSON = (p: string, d: any) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const slugify = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const url = (f: string) => `/api/command/audio/logos/${f}?t=${Date.now()}`

// every beat with a show block is a "show" that can have a logo; slug = slugify(show name)
function shows() {
  const out: Record<string, { slug: string; beat: string; name: string; tagline: string; show_type: string }> = {}
  for (const f of (fs.existsSync(BEATS) ? fs.readdirSync(BEATS) : [])) {
    if (!f.endsWith('.json')) continue
    const b = readJSON(path.join(BEATS, f), {}); const s = b.show
    if (!s?.name) continue
    const slug = slugify(s.name)
    out[slug] = { slug, beat: f.replace(/\.json$/, ''), name: s.name, tagline: s.tagline || '', show_type: s.show_type || '' }
  }
  return out
}

/** GET — the shows for the logo picker: each with any generated variants, an uploaded one, and the pick. */
export async function GET() {
  const spec = readJSON(SPEC, { _picks: {} })
  const picks: Record<string, any> = spec._picks || {}
  const roster = Object.values(shows()).map(sh => {
    const variants = [1, 2, 3].filter(v => fs.existsSync(path.join(LOGODIR, `${sh.slug}_${v}.png`)))
      .map(v => ({ v, url: url(`${sh.slug}_${v}.png`) }))
    const uploaded = fs.existsSync(path.join(LOGODIR, `${sh.slug}_upload.png`))
    return { ...sh, variants, uploaded, locked: picks[sh.slug] ?? (variants[0]?.v ?? null) }
  })
  return NextResponse.json({ roster })
}

/** POST — generate (analyze the show + 3 candidates), lock a pick, or upload your own. */
export async function POST(req: Request) {
  const body = await req.json()
  const { action } = body
  const slug = String(body.slug || '')
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: 'bad slug' }, { status: 400 })
  const sh = shows()[slug]
  if (!sh && action !== 'lockLogo') return NextResponse.json({ error: 'no such show' }, { status: 404 })
  fs.mkdirSync(LOGODIR, { recursive: true })

  // lock one variant (or the upload) as this show's logo
  if (action === 'lockLogo') {
    const variant = body.variant // 1|2|3 or "upload"
    const src = path.join(LOGODIR, `${slug}_${variant}.png`)
    if (!fs.existsSync(src)) return NextResponse.json({ error: 'no such variant' }, { status: 404 })
    fs.copyFileSync(src, path.join(LOGODIR, `${slug}.png`))
    const spec = readJSON(SPEC, {}); spec._picks = { ...(spec._picks || {}), [slug]: variant }
    fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2) + '\n')
    return NextResponse.json({ ok: true, slug, variant })
  }

  // upload your own logo (data URL -> <slug>_upload.png), and lock it
  if (action === 'uploadLogo') {
    const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(String(body.dataUrl || ''))
    if (!m) return NextResponse.json({ error: 'expected a png/jpeg/webp data URL' }, { status: 400 })
    const buf = Buffer.from(m[2], 'base64')
    if (buf.length > 6 << 20) return NextResponse.json({ error: 'image too large (max 6MB)' }, { status: 413 })
    const up = path.join(LOGODIR, `${slug}_upload.png`)
    fs.writeFileSync(up, buf); fs.copyFileSync(up, path.join(LOGODIR, `${slug}.png`))
    const spec = readJSON(SPEC, {}); spec._picks = { ...(spec._picks || {}), [slug]: 'upload' }
    fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2) + '\n')
    return NextResponse.json({ ok: true, slug, variant: 'upload', url: url(`${slug}_upload.png`) })
  }

  // generate: register the show (beat-only -> the engine analyzes it), clear old shots, run gen_logo.mjs
  if (action === 'genLogo') {
    const spec = readJSON(SPEC, {}); spec.shows = spec.shows || {}
    if (!spec.shows[slug]) { spec.shows[slug] = { beat: sh!.beat } ; fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2) + '\n') }
    for (const v of [1, 2, 3]) for (const suf of ['', '_alpha']) { const f = path.join(LOGODIR, `${slug}_${v}${suf}.png`); if (fs.existsSync(f)) { try { fs.unlinkSync(f) } catch {} } }
    const script = path.join(ROOT, 'lab', 'engine', 'gen_logo.mjs')
    try {
      await execFileP('node', [script, slug], { cwd: ROOT, timeout: 9 * 60 * 1000, maxBuffer: 4 << 20 })
    } catch (e: any) {
      return NextResponse.json({ error: 'generation failed (box busy? cupcake down?): ' + String(e?.message || e).slice(0, 200) }, { status: 500 })
    }
    const variants = [1, 2, 3].filter(v => fs.existsSync(path.join(LOGODIR, `${slug}_${v}.png`))).map(v => ({ v, url: url(`${slug}_${v}.png`) }))
    if (!variants.length) return NextResponse.json({ error: 'generator produced no images' }, { status: 500 })
    return NextResponse.json({ ok: true, slug, variants })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
