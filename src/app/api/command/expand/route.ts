import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { expandLead } from '@/lib/command/expand'
import { logTimer } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const ROOT = process.cwd()

/** POST {lead} OR {lead_id|index, file?} — SOURCE EXPANSION: run a Research Lead through the
 *  Stringer with its routed search mode, producing a cited dossier (Evidence Packet). The dossier
 *  is saved like any Stringer run, so it shows in Recent Dossiers and can be briefed into a show. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({} as any))) || {}
  let lead: any = b.lead
  let beat: string | null = null

  // resolve from the latest (or named) leads_*.json by id or index
  if (!lead && (b.lead_id || Number.isInteger(b.index))) {
    const dir = path.join(ROOT, 'lab', 'runs')
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('leads_') && f.endsWith('.json')).sort().reverse() : []
    const lf = (b.file && files.includes(b.file)) ? b.file : files[0]
    if (lf) { try { const q = JSON.parse(fs.readFileSync(path.join(dir, lf), 'utf8')); beat = q.beat || null; lead = b.lead_id ? (q.leads || []).find((l: any) => l.id === b.lead_id) : (q.leads || [])[b.index] } catch { /* unreadable */ } }
  }
  if (!lead || !(lead.query || lead.value)) {
    return NextResponse.json({ ok: false, error: 'a lead {value/query, destination, type} — or lead_id/index into the latest leads file — is required', stage: 'validate', retryable: false }, { status: 400 })
  }

  const t = logTimer()
  try {
    const dossier = await expandLead(lead)
    t.done(() => ({
      kind: 'expand', stage: 'expand', ok: true, beat, ref: dossier.id,
      summary: `${lead.value || lead.query} · ${(dossier.evidence || []).length} evidence · ${dossier.expanded_from?.mode || '?'} · ${lead.destination || 'no destination'}`,
      meta: { lead_id: lead.id || null, lead_type: lead.type || null, destination: lead.destination || null, score: lead.score ?? null, sources: (dossier.sources || []).length, publishers: dossier.audit?.distinct_publishers ?? null, audit: dossier.audit?.status || null, needs_web: dossier.audit?.needs_web ?? null },
    }))
    return NextResponse.json({ ok: true, expanded: { lead: lead.value || lead.query, destination: lead.destination || null, mode: dossier.expanded_from?.mode, dossier_id: dossier.id }, dossier })
  } catch (e: any) {
    t.done(() => ({ kind: 'expand', stage: 'expand', ok: false, beat, ref: lead.id || null, summary: `expand failed · ${lead.value || lead.query}`, error: String(e?.message || e), meta: { lead_type: lead.type || null, destination: lead.destination || null } }))
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), stage: 'expand', retryable: true }, { status: 502 })
  }
}
