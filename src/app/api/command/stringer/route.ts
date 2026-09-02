import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { runStringer, saveStringer, listStringers, type Assignment } from '@/lib/command/stringer'
import { logTimer } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const ROOT = process.cwd()

/** GET — recent Stringer dossiers. */
export async function GET() {
  return NextResponse.json({ ok: true, stringers: listStringers() })
}

/** POST {input:{kind,text,questions?}, beat_file?} — THE STRINGER: research a subject/question
 *  via YouTube (the beat's trusted channels first), transcripts, then an impartial parse into
 *  cited evidence + answers. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}
  const inp = body.input || {}
  if (!inp.text || !['subject', 'question'].includes(inp.kind)) {
    return NextResponse.json({ ok: false, error: 'input.kind (subject|question) + input.text required', stage: 'validate', retryable: false }, { status: 400 })
  }
  const qs = Array.isArray(inp.questions) ? inp.questions : []
  const assignment: Assignment = { kind: inp.kind, text: String(inp.text).slice(0, 400), questions: qs.filter(Boolean).map((q: any) => String(q).slice(0, 300)).slice(0, 6) }

  // snapshot the beat's resolved YouTube channels (trusted, in priority order)
  let trusted: { channel_id: string; name: string }[] = []
  let beatId: string | null = null
  if (body.beat_file && /^[a-z0-9-]+\.json$/.test(body.beat_file)) {
    try {
      const beat = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'beats', body.beat_file), 'utf8'))
      beatId = beat.id || null
      trusted =(beat.sources?.youtube || []).filter((c: any) => c.channel_id).map((c: any) => ({ channel_id: c.channel_id, name: c.resolved_title || c.channel_name }))
    } catch { /* no beat / unresolved channels -> global search only */ }
  }

  const MODES = ['current', 'context', 'legacy', 'original', 'reaction']
  const opts = { mode: MODES.includes(inp.mode) ? inp.mode : undefined, dual: inp.dual === true || inp.dual === 'true' }

  const t = logTimer()
  try {
    const result = await runStringer(assignment, trusted, opts)
    saveStringer(result)
    t.done(() => ({
      kind: 'research', stage: 'stringer', ok: true, beat: beatId, ref: result.id,
      summary: `${result.evidence.length} evidence · ${result.audit.distinct_publishers} publishers · ${result.assignment.mode}${opts.dual ? ' · dual' : ''} · ${result.status} · ${assignment.text}`,
      meta: { kind: assignment.kind, questions: assignment.questions.length, sources: result.sources.length, transcripts: result.usage.transcripts, transcript_words: result.usage.transcript_words, audit: result.audit.status, needs_web: result.audit.needs_web, trusted_channels: trusted.length },
    }))
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    t.done(() => ({ kind: 'research', stage: 'stringer', ok: false, beat: beatId, summary: `research failed · ${assignment.kind}: ${assignment.text}`, error: String(e?.message || e), meta: { mode: opts.mode || 'context', dual: opts.dual, trusted_channels: trusted.length } }))
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), stage: 'stringer', retryable: true }, { status: 502 })
  }
}
