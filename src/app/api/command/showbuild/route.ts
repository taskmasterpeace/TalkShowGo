import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
const ROOT = process.cwd()
const slugify = (s: any) => String(s || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'show'

/** GET ?show=<slug> — poll a build's status.json (adds a playable audio_url when done). */
export async function GET(req: Request) {
  const show = new URL(req.url).searchParams.get('show') || ''
  if (!/^[a-z0-9-]+$/.test(show)) return NextResponse.json({ ok: false, error: 'valid show slug required' }, { status: 400 })
  const sp = path.join(ROOT, 'lab', 'shows', show, 'status.json')
  if (!fs.existsSync(sp)) return NextResponse.json({ ok: true, status: { stage: 'unknown', pct: 0, message: 'no build found for this show yet' } })
  let status: any = {}
  try { status = JSON.parse(fs.readFileSync(sp, 'utf8')) } catch { return NextResponse.json({ ok: true, status: { stage: 'unknown', pct: 0, message: 'status unreadable' } }) }
  if (status.audio) status.audio_url = `/api/command/audio/shows/${show}/${path.basename(status.audio)}`
  if (status.segment && fs.existsSync(status.segment)) { try { status.script = fs.readFileSync(status.segment, 'utf8') } catch {} }
  return NextResponse.json({ ok: true, status })
}

/** POST {briefing_id, stringer_id?, runtime?, voice?} — kick off a background make_show job
 *  (compile beat -> run floor -> render audio). Requires the cast to already be briefed. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  if (!b.briefing_id || !/^brf_[a-z0-9]+$/.test(b.briefing_id)) {
    return NextResponse.json({ ok: false, error: 'valid briefing_id required', stage: 'validate' }, { status: 400 })
  }
  const bp = path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.json')
  if (!fs.existsSync(bp)) return NextResponse.json({ ok: false, error: 'briefing not found', stage: 'load' }, { status: 404 })
  const agentsP = path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.agents.json')
  if (!fs.existsSync(agentsP)) return NextResponse.json({ ok: false, error: 'brief the cast first — no stances found for this briefing', stage: 'validate', retryable: false }, { status: 422 })

  let brf: any = {}
  try { brf = JSON.parse(fs.readFileSync(bp, 'utf8')) } catch { return NextResponse.json({ ok: false, error: 'briefing unreadable' }, { status: 500 }) }
  const sid = String(b.stringer_id || brf.stringer_id || '')
  if (!/^str_[a-z0-9]+$/.test(sid)) return NextResponse.json({ ok: false, error: 'could not resolve the source dossier', stage: 'validate' }, { status: 422 })

  const slug = slugify(brf.title || brf.question?.text)
  const jobdir = path.join(ROOT, 'lab', 'shows', slug)
  fs.mkdirSync(jobdir, { recursive: true })
  fs.writeFileSync(path.join(jobdir, 'status.json'), JSON.stringify({ stage: 'queued', pct: 1, message: 'starting the build…', show: slug, started: new Date().toISOString() }, null, 2))

  const args = [path.join(ROOT, 'lab', 'engine', 'make_show.mjs'), `--stringer=${sid}`, `--briefing=${b.briefing_id}`, `--runtime=${Math.min(20, Math.max(3, +b.runtime || 8))}`, `--jobdir=${jobdir}`, `--show=${slug}`, '--provider=openrouter']
  if (b.voice !== false) args.push('--voice')
  try {
    const child = spawn(process.execPath, args, { cwd: ROOT, detached: true, stdio: 'ignore' })
    child.unref()
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'could not start build: ' + String(e?.message || e).slice(0, 120) }, { status: 502 })
  }
  return NextResponse.json({ ok: true, show: slug, status_url: `/api/command/showbuild?show=${slug}` })
}
