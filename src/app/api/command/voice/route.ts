import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const maxDuration = 300
const ROOT = process.cwd()
const VDIR = path.join(ROOT, 'lab', 'cast', 'voices')
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'

const shortOf = (id: string) => id === 'marcus-blaze' ? 'blaze' : id === 'king-knowledge' ? 'knowledge' : id === 'tasha-raw' ? 'tasha' : id
// keys law: hydrated process.env is the truth (SETTINGS saves land there); .env regex is the cold-boot fallback
const gwKey = () => process.env.CUPCAKE_GATEWAY_KEY || (() => { try { return (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^CUPCAKE_GATEWAY_KEY=(.+)$/m) || [])[1] } catch { return undefined } })()
const castPath = path.join(ROOT, 'lab', 'cast', 'cast.json')
const loadCast = () => { try { return JSON.parse(fs.readFileSync(castPath, 'utf8')) } catch { return null } }

/** Voice management for a host:
 *  POST json {host, action:'design', aesthetic, ref_text?, seed?} — breeze-design a new locked ref (CFG LAW: 4.0)
 *  POST multipart form {host, ref_text, file(.wav)} — upload YOUR OWN reference voice
 */
export async function POST(req: Request) {
  const ctype = req.headers.get('content-type') || ''

  // ---- upload your own reference ----
  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData()
    const host = String(form.get('host') || '')
    const refText = String(form.get('ref_text') || '').trim()
    const file = form.get('file') as File | null
    if (!host || !refText || !file) return NextResponse.json({ error: 'need host, ref_text, file' }, { status: 400 })
    if (!/\.wav$/i.test(file.name)) return NextResponse.json({ error: 'wav only (mono 16-bit preferred, 10-20s, clean speech)' }, { status: 400 })
    // host must be a real cast id: this write names a file, so an unvalidated id is a path traversal
    const cast = loadCast()
    if (!cast) return NextResponse.json({ error: 'cast.json unreadable' }, { status: 500 })
    const h = (cast.hosts || []).find((x: any) => x.id === host)
    if (!h) return NextResponse.json({ error: 'unknown host' }, { status: 404 })
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length > 12e6) return NextResponse.json({ error: 'file too large (max ~12MB / ~60s)' }, { status: 400 })
    fs.mkdirSync(VDIR, { recursive: true })
    const short = shortOf(host)
    const wavOut = path.join(VDIR, short + '.wav')
    if (fs.existsSync(wavOut)) fs.copyFileSync(wavOut, wavOut.replace(/\.wav$/, '.prev.wav')) // a locked voice is never overwritten without a way back
    fs.writeFileSync(wavOut, buf)
    fs.writeFileSync(path.join(VDIR, short + '.ref.txt'), refText)
    // record on the cast bundle
    h.voice.ref_text = refText; h.voice.source = 'uploaded ' + new Date().toISOString().slice(0, 10)
    fs.writeFileSync(castPath, JSON.stringify(cast, null, 2) + '\n')
    return NextResponse.json({ ok: true, host, bytes: buf.length })
  }

  const body = await req.json().catch(() => ({} as any))
  const { host, action, aesthetic, ref_text, seed } = body

  // ---- AUDITION: render a CANDIDATE voice from an aesthetic - never touches locked refs or cast.json.
  //      The Casting Office generates a few of these per personality so Robert can HEAR before hiring. ----
  if (action === 'audition') {
    const design = String(aesthetic || '').slice(0, 500)
    const rt = String(ref_text || '').slice(0, 600)
    const sd = Number(seed) || 42
    if (!design || !rt) return NextResponse.json({ error: 'need aesthetic + ref_text' }, { status: 400 })
    try {
      const hRes = await fetch(GW + '/v1/health', { signal: AbortSignal.timeout(5000) })
      const hj: any = await hRes.json()
      if (hj.running || hj.queue_depth > 0) return NextResponse.json({ busy: true, error: 'render box busy (video job running) - try again when it frees' }, { status: 409 })
    } catch { return NextResponse.json({ error: 'gateway unreachable' }, { status: 502 }) }
    const res = await fetch(GW + '/v1/audio/breeze-design', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + gwKey() },
      body: JSON.stringify({ text: rt, design, cfg_scale: 4.0, seed: sd }), // CFG LAW: design = 4.0, always
      signal: AbortSignal.timeout(280000),
    })
    if (!res.ok) return NextResponse.json({ error: 'breeze ' + res.status + ' ' + (await res.text()).slice(0, 120) }, { status: 502 })
    const wav = Buffer.from(await res.arrayBuffer())
    const cdir = path.join(VDIR, 'candidates')
    fs.mkdirSync(cdir, { recursive: true })
    const file = `audition-${sd}-${Date.now().toString(36)}.wav`
    fs.writeFileSync(path.join(cdir, file), wav)
    fs.writeFileSync(path.join(cdir, file.replace(/\.wav$/, '.txt')), `seed ${sd} · ${design}\n---\n${rt}`)
    return NextResponse.json({ ok: true, file, url: `/api/command/audio/voices/candidates/${file}`, seed: sd, bytes: wav.length })
  }

  // ---- HIRE: promote a generated guest print + a chosen audition candidate into the CAST. ----
  if (action === 'hire') {
    const gid = String(body.guest_id || '').trim()
    if (!/^[a-z0-9-]+$/.test(gid)) return NextResponse.json({ error: 'bad guest_id' }, { status: 400 })
    const candidate = String(body.candidate || '').trim()
    if (!/^audition-[a-z0-9-]+\.wav$/.test(candidate)) return NextResponse.json({ error: 'candidate must be an audition wav' }, { status: 400 })
    const cwav = path.join(VDIR, 'candidates', candidate)
    if (!fs.existsSync(cwav)) return NextResponse.json({ error: 'candidate not found - audition again' }, { status: 404 })
    let guest: any
    try { guest = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'guests', gid + '.json'), 'utf8')) } catch { return NextResponse.json({ error: 'guest print not found - generate the personality first' }, { status: 404 }) }
    const cast = loadCast()
    if (!cast) return NextResponse.json({ error: 'cast.json unreadable' }, { status: 500 })
    if ((cast.hosts || []).some((x: any) => x.id === gid)) return NextResponse.json({ error: `"${gid}" is already on the cast` }, { status: 409 })
    const design = String(aesthetic || guest.voice?.aesthetic || '').slice(0, 500)
    const rt = String(ref_text || '').slice(0, 600)
    const sd = Number(seed) || guest.voice?.seed || 42
    if (!rt) return NextResponse.json({ error: 'ref_text required (the exact words on the chosen candidate)' }, { status: 400 })
    // the chosen audition BECOMES the locked ref (bootstrap-to-clone law); back up anything in the slot
    const wavOut = path.join(VDIR, gid + '.wav')
    if (fs.existsSync(wavOut)) fs.copyFileSync(wavOut, wavOut.replace(/\.wav$/, '.prev.wav'))
    fs.copyFileSync(cwav, wavOut)
    fs.writeFileSync(path.join(VDIR, gid + '.ref.txt'), rt)
    const hostRow = {
      id: gid, name: guest.name, role: 'host', lane: String(body.lane || 'analysis desk').slice(0, 60),
      persona_version: 1, note: `hired via the Casting Office ${new Date().toISOString().slice(0, 10)} - from: "${String(guest.source_description || '').slice(0, 140)}"`,
      model: { provider: 'openrouter', id: 'openai/gpt-4.1-mini', temperature: 0.9, dna_id: 'openai/gpt-4.1-mini' }, // Cassius's proven fast seat - the DNA registry knows this id
      behavior: guest.behavior || { verbosity: 0.5, filler_rate: 0.3, interruption_rate: 0.4, backchannel_rate: 0.3 },
      guards: {}, tags: ['casting-office'],
      print: guest.print,
      catchphrase_rare: Array.isArray(guest.catchphrase_rare) ? guest.catchphrase_rare : [],
      voice: { seed: sd, aesthetic: design, ref_text: rt, source: 'casting office ' + new Date().toISOString().slice(0, 10), ...(guest.voice?.emotion_map ? { emotion_map: guest.voice.emotion_map } : {}), ...(guest.voice?.default_instruction ? { default_instruction: guest.voice.default_instruction } : {}) },
    }
    cast.hosts.push(hostRow)
    fs.writeFileSync(castPath + '.tmp', JSON.stringify(cast, null, 2) + '\n'); fs.renameSync(castPath + '.tmp', castPath)
    return NextResponse.json({ ok: true, hired: { id: gid, name: guest.name }, voice_file: gid + '.wav' })
  }

  // ---- design from an aesthetic description ----
  if (action !== 'design') return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  const cast = loadCast()
  if (!cast) return NextResponse.json({ error: 'cast.json unreadable' }, { status: 500 })
  const h = (cast.hosts || []).find((x: any) => x.id === host)
  if (!h) return NextResponse.json({ error: 'unknown host' }, { status: 404 })

  const design = String(aesthetic || h.voice.aesthetic || '').slice(0, 500)
  const rt = String(ref_text || h.voice.ref_text || '').slice(0, 600)
  const sd = Number(seed || h.voice.seed || 42)
  if (!design || !rt) return NextResponse.json({ error: 'need aesthetic + ref_text' }, { status: 400 })

  // gateway health gate: audio yields to video renders
  try {
    const hRes = await fetch(GW + '/v1/health', { signal: AbortSignal.timeout(5000) })
    const hj: any = await hRes.json()
    if (hj.running || hj.queue_depth > 0) return NextResponse.json({ busy: true, error: 'render box busy (video job running) - try again when it frees' }, { status: 409 })
  } catch { return NextResponse.json({ error: 'gateway unreachable' }, { status: 502 }) }

  const res = await fetch(GW + '/v1/audio/breeze-design', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + gwKey() },
    body: JSON.stringify({ text: rt, design, cfg_scale: 4.0, seed: sd }),
    signal: AbortSignal.timeout(280000),
  })
  if (!res.ok) return NextResponse.json({ error: 'breeze ' + res.status + ' ' + (await res.text()).slice(0, 120) }, { status: 502 })
  const wav = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(VDIR, { recursive: true })
  const short = shortOf(host)
  fs.writeFileSync(path.join(VDIR, short + '.wav'), wav)
  fs.writeFileSync(path.join(VDIR, short + '.ref.txt'), rt)
  h.voice.aesthetic = design; h.voice.ref_text = rt; h.voice.seed = sd; h.voice.source = 'designed ' + new Date().toISOString().slice(0, 10)
  fs.writeFileSync(castPath, JSON.stringify(cast, null, 2) + '\n')
  return NextResponse.json({ ok: true, host, bytes: wav.length, seed: sd })
}
