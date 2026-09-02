import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { saveStringer, loadConfig } from '@/lib/command/stringer'
import { supplementDossierWithWeb } from '@/lib/command/web-supplement'
import { appendLog, logTimer } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
const ROOT = process.cwd()

/** POST {id, queries?} — WEB SUPPLEMENT for a Stringer dossier. Runs impartial web research
 *  (OpenRouter web plugin -> Perplexity fallback) for the assignment + its questions, registers
 *  the returned citations as web sources, re-parses the answers into cited evidence, merges the
 *  new answers into the dossier, and re-audits. Every citation URL is derived from the provider's
 *  annotations by the server — the model never invents one. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}
  const id = String(body.id || '')
  if (!/^str_[a-z0-9]+$/.test(id)) {
    return NextResponse.json({ ok: false, error: 'valid id (str_...) required', stage: 'validate', retryable: false }, { status: 400 })
  }
  const file = path.join(ROOT, 'lab', 'research', 'stringer', id + '.json')
  if (!fs.existsSync(file)) {
    appendLog({ kind: 'web', stage: 'load', ok: false, ref: id, summary: `web supplement · dossier ${id} not found`, error: 'stringer dossier not found' })
    return NextResponse.json({ ok: false, error: 'stringer dossier not found', stage: 'load', retryable: false }, { status: 404 })
  }

  const queries = Array.isArray(body.queries) ? body.queries.length : 0
  const t = logTimer()
  try {
    const dossier = JSON.parse(fs.readFileSync(file, 'utf8'))
    const { added, publishers } = await supplementDossierWithWeb(dossier, body.queries, loadConfig())
    if (!added) {
      t.done(() => ({ kind: 'web', stage: 'web', ok: false, ref: id, summary: `web supplement · 0 citable sources · ${dossier.assignment?.text || id}`, error: 'web search returned no citable sources', meta: { queries } }))
      return NextResponse.json({ ok: false, error: 'web search returned no citable sources', stage: 'web', retryable: true }, { status: 422 })
    }
    saveStringer(dossier)
    t.done(() => ({
      kind: 'web', stage: 'web', ok: true, ref: id,
      summary: `${added} web sources · ${publishers} publishers · now ${(dossier.evidence || []).length} evidence · audit ${dossier.audit?.status || '?'} · ${dossier.assignment?.text || ''}`,
      meta: { queries, distinct_publishers: dossier.audit?.distinct_publishers ?? null, needs_web: dossier.audit?.needs_web ?? null },
    }))
    return NextResponse.json({ ok: true, ...dossier })
  } catch (err: any) {
    t.done(() => ({ kind: 'web', stage: 'web', ok: false, ref: id, summary: `web supplement failed · ${id}`, error: String(err?.message || err), meta: { queries } }))
    return NextResponse.json({ ok: false, error: String(err?.message || err).slice(0, 200), stage: 'web', retryable: true }, { status: 502 })
  }
}
