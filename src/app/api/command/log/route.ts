import { NextResponse } from 'next/server'
import { queryLog } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const flag = (v: string | null) => v === '1' || v === 'true'

/** GET ?kind=a,b&beat=&since=<iso | 1h | 24h | 48h | 7d>&q=&errors=1&ok=1&limit= — THE LOG, newest
 *  first. counts.byKind / counts.byBeat are facet counts (each ignores only its own filter). */
export function GET(req: Request) {
  const u = new URL(req.url)
  const p = u.searchParams
  try {
    const { events, counts } = queryLog({
      kind: (p.get('kind') || '').split(',').map(s => s.trim()).filter(Boolean),
      beat: p.get('beat') || undefined,
      since: p.get('since') || undefined,
      q: p.get('q') || undefined,
      errorsOnly: flag(p.get('errors')),
      okOnly: flag(p.get('ok')),
      limit: Number(p.get('limit')) || undefined,
    })
    return NextResponse.json({ ok: true, events, counts })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'log unreadable: ' + String(e?.message || e).slice(0, 160), stage: 'read', retryable: true }, { status: 500 })
  }
}

/** DELETE — refused. The activity log is append-only; nothing in the control room can erase it. */
export function DELETE() {
  return NextResponse.json({ ok: false, error: 'the activity log is append-only', stage: 'policy', retryable: false }, { status: 405, headers: { Allow: 'GET' } })
}
