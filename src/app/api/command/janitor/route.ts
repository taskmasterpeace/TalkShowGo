import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { runJanitor, applyProposal, dismissProposal, latestReport, listReports, getReport, pendingAcrossBeats } from '@/lib/command/janitor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
const ROOT = process.cwd()
const BEAT_RE = /^[a-z0-9-]+$/
const bad = (error: string, stage: string, status = 400) => NextResponse.json({ ok: false, error, stage }, { status })
const beatExists = (beat: string) => BEAT_RE.test(beat) && fs.existsSync(path.join(ROOT, 'lab', 'beats', beat + '.json'))

/** GET ?beat=<id>[&file=<report>] -> the latest (or a named) janitor report + the history list for that beat.
 *  GET with no beat -> per-beat pending counts (the DESK card). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const beat = String(sp.get('beat') || '').trim()
  if (!beat) return NextResponse.json({ ok: true, beats: pendingAcrossBeats() })
  if (!BEAT_RE.test(beat)) return bad('bad beat', 'validate')
  const file = String(sp.get('file') || '').trim()
  const report = file ? getReport(beat, file) : latestReport(beat)
  if (file && !report) return bad('unknown report', 'load', 404)
  return NextResponse.json({ ok: true, beat, latest: report, history: listReports(beat) })
}

/** POST {beat}               -> RUN the janitor on that beat (auto proposals applied, report written).
 *  POST {beat, apply: id}    -> a human said yes to a pending proposal.
 *  POST {beat, dismiss: id}  -> a human said no (a channel suggestion also lands on the scout's dismissed ledger). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}
  const beat = String(body.beat || '').trim()
  if (!BEAT_RE.test(beat)) return bad('bad beat', 'validate')
  if (!beatExists(beat)) return bad('unknown beat', 'validate', 404)
  const id = (v: any) => String(v || '').trim()
  try {
    if (body.apply) {
      if (!/^jp_[a-z0-9]{3,12}$/.test(id(body.apply))) return bad('bad proposal id', 'validate')
      const { proposal, report } = await applyProposal(beat, id(body.apply))
      return NextResponse.json({ ok: true, beat, proposal, report })
    }
    if (body.dismiss) {
      if (!/^jp_[a-z0-9]{3,12}$/.test(id(body.dismiss))) return bad('bad proposal id', 'validate')
      const { proposal, report } = dismissProposal(beat, id(body.dismiss))
      return NextResponse.json({ ok: true, beat, proposal, report })
    }
    const report = await runJanitor(beat, { apply: body.apply_auto === false ? 'none' : 'auto' })
    return NextResponse.json({ ok: true, beat, report })
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 200)
    const status = /unknown proposal|unknown or unreadable beat/.test(error) ? 404 : /already/.test(error) ? 409 : 500
    return bad(error, body.apply ? 'apply' : body.dismiss ? 'dismiss' : 'run', status)
  }
}
