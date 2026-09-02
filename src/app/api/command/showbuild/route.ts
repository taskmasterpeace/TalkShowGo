import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { okHouseCount } from '@/lib/command/agent-brief'
import { appendLog } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
const ROOT = process.cwd()
const SHOWS = path.join(ROOT, 'lab', 'shows')
const slugify = (s: any) => String(s || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'show'
const TERMINAL = new Set(['done', 'error', 'cancelled'])
// a live stage older than this with no heartbeat is a dead job, not a slow one. Liveness is judged
// by the heartbeat, NOT by pid (Windows reuses pids; a stale job with a recycled pid must still read dead)
const STALE_S: Record<string, number> = { queued: 180, compile: 300, floor: 900, scripted: 300, audio: 900 }

const pidAlive = (pid: any) => { if (!pid) return false; try { process.kill(Number(pid), 0); return true } catch { return false } }
const ageOf = (s: any) => s?.updated ? Math.round((Date.now() - new Date(s.updated).getTime()) / 1000) : null
const isFresh = (s: any) => !!s && !TERMINAL.has(s.stage) && (ageOf(s) ?? Infinity) <= (STALE_S[s.stage] || 600)
const statusPath = (slug: string) => path.join(SHOWS, slug, 'status.json')
// null = no file; 'unreadable' = file exists but mid-write / torn (transient) — callers must tell them apart
const readStatus = (slug: string): any | 'unreadable' | null => {
  const p = statusPath(slug)
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return 'unreadable' }
}
const writeStatus = (slug: string, s: any) => { try { const p = statusPath(slug); fs.writeFileSync(p + '.tmp', JSON.stringify(s, null, 2)); fs.renameSync(p + '.tmp', p) } catch {} } // atomic

/** Enrich + self-heal: audio_url when present; a non-terminal job whose heartbeat is stale gets flipped
 *  to error (persisted) so every poller stops — regardless of what pid says. */
function decorate(slug: string, status: any) {
  const age_s = ageOf(status)
  if (!TERMINAL.has(status.stage) && age_s != null && age_s > (STALE_S[status.stage] || 600)) {
    status = { ...status, stage: 'error', error: `build stopped reporting during ${status.stage} (${Math.round(age_s / 60)} min without a heartbeat)`, message: `died during ${status.stage} — see lab/shows/${slug}/${status.stage}.log`, failed_stage: status.stage }
    writeStatus(slug, status)
  }
  const out: any = { ...status, age_s, alive: pidAlive(status.pid) && isFresh(status) }
  if (status.audio) out.audio_url = `/api/command/audio/shows/${slug}/${path.basename(status.audio)}`
  return out
}

/** GET ?show=<slug> — poll one build (404 if none). GET with no slug — list every build, newest first. */
export async function GET(req: Request) {
  const show = new URL(req.url).searchParams.get('show') || ''
  if (!show) {
    const list = fs.existsSync(SHOWS) ? fs.readdirSync(SHOWS).map(d => { const s = readStatus(d); return s && s !== 'unreadable' ? { slug: d, ...decorate(d, s) } : null }).filter(Boolean) : []
    list.sort((a: any, b: any) => String(b.started || '').localeCompare(String(a.started || '')))
    return NextResponse.json({ ok: true, shows: list })
  }
  if (!/^[a-z0-9-]+$/.test(show)) return NextResponse.json({ ok: false, error: 'valid show slug required', stage: 'validate' }, { status: 400 })
  const raw = readStatus(show)
  if (raw === null) return NextResponse.json({ ok: false, error: 'no build found for this show', stage: 'load', retryable: false }, { status: 404 })
  if (raw === 'unreadable') return NextResponse.json({ ok: true, status: { stage: 'reading', pct: null, message: 'status is being written — try again in a moment', transient: true } })
  const status = decorate(show, raw)
  if (status.segment && fs.existsSync(status.segment)) { try { status.script = fs.readFileSync(status.segment, 'utf8') } catch {} }
  return NextResponse.json({ ok: true, status })
}

/** POST {briefing_id, stringer_id?, runtime?, voice?, attribution?, show?, from_stage?} — start a
 *  detached make_show job in its OWN dir (slug-briefingId; a rebuild gets a fresh dir), or resume an
 *  existing job dir that BELONGS TO THIS BRIEFING from compile|floor|audio. 409 while one is live. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  if (!b.briefing_id || !/^brf_[a-z0-9]+$/.test(b.briefing_id)) {
    return NextResponse.json({ ok: false, error: 'valid briefing_id required', stage: 'validate' }, { status: 400 })
  }
  const bp = path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.json')
  if (!fs.existsSync(bp)) return NextResponse.json({ ok: false, error: 'briefing not found', stage: 'load' }, { status: 404 })
  let agents: any = null
  try { agents = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'briefings', b.briefing_id + '.agents.json'), 'utf8')) } catch { /* missing or unreadable */ }
  const briefed = okHouseCount(agents)
  if (briefed < 2) return NextResponse.json({ ok: false, error: `brief the cast first — a floor needs at least 2 distinct briefed house hosts (found ${briefed})`, stage: 'validate', retryable: false }, { status: 422 })

  let brf: any = {}
  try { brf = JSON.parse(fs.readFileSync(bp, 'utf8')) } catch { return NextResponse.json({ ok: false, error: 'briefing unreadable', stage: 'load' }, { status: 500 }) }
  const sid = String(b.stringer_id || brf.stringer_id || '')
  if (!/^str_[a-z0-9]+$/.test(sid)) return NextResponse.json({ ok: false, error: 'could not resolve the source dossier', stage: 'validate' }, { status: 422 })

  // one LIVE build per briefing — judged by heartbeat freshness, never two writers on one dir
  if (fs.existsSync(SHOWS)) for (const d of fs.readdirSync(SHOWS)) {
    const s = readStatus(d)
    if (s && s !== 'unreadable' && s.briefing === b.briefing_id && isFresh(s)) {
      return NextResponse.json({ ok: false, error: `a build for this briefing is already running (${s.stage} ${s.pct}%)`, stage: 'conflict', retryable: true, show: d, status_url: `/api/command/showbuild?show=${d}` }, { status: 409 })
    }
  }

  // resume an existing job dir from a stage (must belong to this briefing), or start a fresh unique one
  const from = ['compile', 'floor', 'audio'].includes(String(b.from_stage)) ? String(b.from_stage) : null
  let slug: string
  let prevStatus: any = {}
  if (from) {
    if (!b.show || !/^[a-z0-9-]+$/.test(b.show)) return NextResponse.json({ ok: false, error: 'from_stage needs the show slug to resume', stage: 'validate' }, { status: 400 })
    const prev = readStatus(b.show)
    if (!prev || prev === 'unreadable') return NextResponse.json({ ok: false, error: 'that show has no readable status to resume', stage: 'load' }, { status: 404 })
    if (prev.briefing && prev.briefing !== b.briefing_id) return NextResponse.json({ ok: false, error: `show ${b.show} belongs to briefing ${prev.briefing}, not ${b.briefing_id}`, stage: 'validate', retryable: false }, { status: 409 })
    const need = from === 'floor' ? ['beatcard.json'] : from === 'audio' ? ['beatcard.json', path.join('floor', 'segment_final.md')] : []
    const missing = need.filter(f => !fs.existsSync(path.join(SHOWS, b.show, f)))
    if (missing.length) return NextResponse.json({ ok: false, error: `cannot resume from ${from}: ${missing.join(', ')} missing — rebuild from compile`, stage: 'validate' }, { status: 422 })
    slug = b.show; prevStatus = prev
  } else {
    slug = `${slugify(brf.title || brf.question?.text)}-${b.briefing_id.slice(4, 10)}`
    if (fs.existsSync(statusPath(slug))) slug += '-' + new Date().toISOString().replace(/[^0-9]/g, '').slice(8, 14) // a rebuild gets its own dir
  }
  const jobdir = path.join(SHOWS, slug)
  fs.mkdirSync(jobdir, { recursive: true })
  writeStatus(slug, { ...(from ? prevStatus : {}), stage: 'queued', pct: 1, message: from ? `resuming from ${from}…` : 'starting the build…', show: slug, briefing: b.briefing_id, stringer: sid, started: from && prevStatus.started ? prevStatus.started : new Date().toISOString(), updated: new Date().toISOString(), pid: null, error: null, failed_stage: null })

  const amode = ['A', 'B', 'C', 'D', 'E', 'F'].includes(String(b.attribution || '').toUpperCase()) ? String(b.attribution).toUpperCase() : 'A'
  const args = [path.join(ROOT, 'lab', 'engine', 'make_show.mjs'), `--stringer=${sid}`, `--briefing=${b.briefing_id}`, `--runtime=${Math.min(20, Math.max(3, +b.runtime || 8))}`, `--jobdir=${jobdir}`, `--show=${slug}`, '--provider=openrouter', `--attribution=${amode}`]
  if (from) args.push(`--from=${from}`)
  if (b.voice !== false) args.push('--voice')
  try {
    // the child writes its own pid on its first setStatus — no post-spawn back-fill, no launcher/child race
    const child = spawn(process.execPath, args, { cwd: ROOT, detached: true, stdio: 'ignore' })
    child.unref()
    appendLog({ kind: 'build', stage: from ? `resume:${from}` : 'queued', ok: true, ref: slug, summary: `${from ? 'resumed from ' + from : 'build started'} · ${brf.title || ''} · attribution ${amode}`, meta: { briefing: b.briefing_id, stringer: sid, pid: child.pid, voice: b.voice !== false } })
  } catch (e: any) {
    const cur = readStatus(slug)
    writeStatus(slug, { ...(cur && cur !== 'unreadable' ? cur : {}), stage: 'error', error: 'could not start build: ' + String(e?.message || e).slice(0, 120), updated: new Date().toISOString() })
    return NextResponse.json({ ok: false, error: 'could not start build: ' + String(e?.message || e).slice(0, 120), stage: 'spawn', retryable: true }, { status: 502 })
  }
  return NextResponse.json({ ok: true, show: slug, resumed_from: from, status_url: `/api/command/showbuild?show=${slug}` })
}

/** DELETE ?show=<slug> — cancel a running build: kill the whole process tree (make_show AND its floor /
 *  renderer children), mark cancelled. Only kills when the job is actually live (fresh heartbeat). */
export async function DELETE(req: Request) {
  const show = new URL(req.url).searchParams.get('show') || ''
  if (!/^[a-z0-9-]+$/.test(show)) return NextResponse.json({ ok: false, error: 'valid show slug required', stage: 'validate' }, { status: 400 })
  const s = readStatus(show)
  if (!s || s === 'unreadable') return NextResponse.json({ ok: false, error: 'no readable build for this show', stage: 'load' }, { status: 404 })
  if (TERMINAL.has(s.stage)) return NextResponse.json({ ok: true, show, status: s, note: 'already finished' })
  let killed = false
  if (isFresh(s) && pidAlive(s.pid)) {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10000 })
      else { try { process.kill(-Number(s.pid)) } catch { process.kill(Number(s.pid)) } }
      killed = true
    } catch {}
  }
  const next = { ...s, stage: 'cancelled', message: `cancelled by the producer during ${s.stage}`, failed_stage: s.stage, updated: new Date().toISOString() }
  writeStatus(show, next)   // the floor heartbeat sees 'cancelled' and exits if anything survived the kill
  appendLog({ kind: 'build', stage: 'cancelled', ok: false, ref: show, summary: `cancelled during ${s.stage}${killed ? ' (process tree killed)' : ''}`, error: 'cancelled by the producer' })
  return NextResponse.json({ ok: true, show, killed, status: next })
}
