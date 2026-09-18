import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const ROOT = process.cwd()

// SHOWTIME - game events in, a talk show job out (docs/SHOWTIME-API-PLAN.md v1.1).
// Thin wrapper over lab/engine/showtime.mjs: POST validates + spawns detached; GET reads status.json.
// v0 concurrency: ONE active pipeline - a concurrent POST gets 409 {active_job} (defined behavior;
// FIFO queueing is v1). client_key makes retried POSTs idempotent (house take-flow pattern).
// This route is gated from tunnel origins by src/middleware.ts, same as /api/command/*.

const bad = (error: string, status = 400, extra: any = {}) => NextResponse.json({ ok: false, error, ...extra }, { status })
const SLUR = /\b(nigg(a|er)s?|fagg?ots?|k[iy]kes?|spics?|chinks?|trann(y|ies))\b/i
const jobsDir = () => path.join(ROOT, 'lab', 'shows')
const readStatus = (job: string) => { try { return JSON.parse(fs.readFileSync(path.join(jobsDir(), job, 'status.json'), 'utf8')) } catch { return null } }
const listJobs = () => { try { return fs.readdirSync(jobsDir()).filter(d => /^st_[a-z0-9]+$/.test(d)) } catch { return [] } }

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  const events = Array.isArray(b.events) ? b.events.map((e: any) => (typeof e === 'string' ? { text: e } : e)) : []
  if (!events.length) return bad('events required (1-50 of {text})')
  if (events.length > 50) return bad('too many events (max 50)')
  const badIdx = events.map((e: any, i: number) => (!e?.text || typeof e.text !== 'string' || e.text.length > 300 || SLUR.test(e.text) ? i : -1)).filter((i: number) => i >= 0)
  if (badIdx.length) return bad('unsafe or invalid events', 422, { bad_events: badIdx })
  // desk validation (>=3 known cast ids)
  const desk: string[] = Array.isArray(b.desk) && b.desk.length ? b.desk.map(String) : ['renee-vaughn', 'cassius-wynn', 'andrew-hammond']
  try {
    const cast = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), 'utf8'))
    const unknown = desk.filter(id => !cast.hosts.some((h: any) => h.id === id))
    if (unknown.length) return bad('unknown desk ids: ' + unknown.join(','))
  } catch { return bad('cast unreadable', 500) }
  if (desk.length < 3) return bad('desk needs >= 3 hosts')

  // idempotency: same client_key -> same job
  const ckey = typeof b.client_key === 'string' && b.client_key.trim() ? b.client_key.trim().slice(0, 64) : null
  if (ckey) for (const j of listJobs()) { const s = readStatus(j); if (s?.client_key === ckey) return NextResponse.json({ ok: true, job: j, poll: `/api/showtime?job=${j}`, deduped: true }, { status: 202 }) }

  // v0: one active pipeline (the voice gateway is single-concurrency anyway)
  for (const j of listJobs()) { const s = readStatus(j); if (s && (s.state === 'running' || s.state === 'queued')) return bad('a SHOWTIME job is already running - v0 runs one at a time', 409, { active_job: j }) }

  // retention: keep last 20 jobs
  const all = listJobs().map(j => ({ j, m: (() => { try { return fs.statSync(path.join(jobsDir(), j)).mtimeMs } catch { return 0 } })() })).sort((a, b2) => b2.m - a.m)
  for (const { j } of all.slice(19)) { try { fs.rmSync(path.join(jobsDir(), j), { recursive: true, force: true }); for (const s of ['-s1', '-s2']) fs.rmSync(path.join(jobsDir(), j + s), { recursive: true, force: true }) } catch { /* best effort */ } }

  const job = 'st_' + Math.random().toString(36).slice(2, 8)
  const dir = path.join(jobsDir(), job); fs.mkdirSync(dir, { recursive: true })
  const evFile = path.join(dir, 'events.json')
  fs.writeFileSync(evFile, JSON.stringify(events, null, 2))
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ job, state: 'queued', stage: 'queued', pct: 0, stages: {}, artifacts: {}, ...(ckey ? { client_key: ckey } : {}), started: new Date().toISOString() }, null, 2))
  const args = ['lab/engine/showtime.mjs', `--events=${evFile}`, `--job=${job}`,
    ...(b.show?.name ? [`--show=${String(b.show.name).slice(0, 48)}`] : []),
    ...(b.show?.tagline ? [`--tagline=${String(b.show.tagline).slice(0, 80)}`] : []),
    `--desk=${desk.join(',')}`, `--length=${b.length === 'standard' ? 'standard' : 'short'}`,
    ...(b.outputs?.video ? ['--video', `--aspects=${(b.outputs.video.aspects || ['16x9', '9x16']).filter((a: string) => ['16x9', '9x16'].includes(a)).join(',') || '16x9,9x16'}`] : []),
    ...(b.style?.bg && /^#[0-9a-f]{6}$/i.test(b.style.bg) ? [`--bg=${b.style.bg}`] : []),
    ...(b.style?.accent && /^#[0-9a-f]{6}$/i.test(b.style.accent) ? [`--accent=${b.style.accent}`] : []),
  ]
  const logOut = fs.openSync(path.join(dir, 'run.log'), 'w')
  const child = spawn(process.execPath, args, { cwd: ROOT, detached: true, stdio: ['ignore', logOut, logOut] })
  child.unref()
  return NextResponse.json({ ok: true, job, poll: `/api/showtime?job=${job}` }, { status: 202 })
}

export async function GET(req: Request) {
  const job = new URL(req.url).searchParams.get('job') || ''
  if (!/^st_[a-z0-9]+$/.test(job)) return bad('job required (st_...)', 400)
  const s = readStatus(job)
  if (!s) return bad('not found', 404)
  // job timeout: a run silent past 30min is failed (plan §6)
  const age = Date.now() - new Date(s.started).getTime()
  const state = s.state === 'running' && age > 30 * 60000 ? 'failed' : s.state
  const art = (p: string) => (p ? `/api/command/audio/shows/${path.relative(path.join('lab', 'shows'), p).replace(/\\/g, '/')}` : undefined)
  return NextResponse.json({
    ok: true, job, state, stage: s.stage, pct: s.pct,
    ...(state === 'failed' ? { error: s.error || 'timed out' } : {}),
    ...(s.actual_duration_s ? { actual_duration_s: s.actual_duration_s } : {}),
    ...(s.fact_warnings?.length ? { fact_warnings: s.fact_warnings } : {}),
    artifacts: { mp3: art(s.artifacts?.mp3), mp4_16x9: art(s.artifacts?.['mp4_16x9']), mp4_9x16: art(s.artifacts?.['mp4_9x16']), transcript: art(s.artifacts?.transcript), timeline: art(s.artifacts?.timeline), ...(s.artifacts?.video_error ? { video_error: s.artifacts.video_error } : {}) },
  })
}
