import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { parseMaterial, saveStringer, loadConfig } from '@/lib/command/stringer'
import { webResearch, excludedTerms, isExcluded } from '@/lib/command/openrouter-web'

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
    return NextResponse.json({ ok: false, error: 'stringer dossier not found', stage: 'load', retryable: false }, { status: 404 })
  }

  try {
    const dossier = JSON.parse(fs.readFileSync(file, 'utf8'))
    const cfg = loadConfig()
    const terms = excludedTerms(cfg)

    // retroactive hygiene: purge any pre-existing excluded-outlet source (and its evidence) from a
    // dossier built before the rule existed, so it can never feed the audit or an agent brief.
    if (terms.length) {
      const badSrc = new Set((dossier.sources || []).filter((s: any) => isExcluded(`${s.url} ${s.publisher} ${s.title}`, terms)).map((s: any) => s.id))
      if (badSrc.size) {
        dossier.sources = (dossier.sources || []).filter((s: any) => !badSrc.has(s.id))
        dossier.evidence = (dossier.evidence || []).filter((e: any) => !badSrc.has(e.source_id) && !isExcluded(String(e.claim || ''), terms))
      }
    }

    const queries: string[] = (body.queries?.length ? body.queries : [dossier.assignment.text, ...(dossier.assignment.questions || [])])
      .map((q: any) => String(q)).filter(Boolean).slice(0, 4)

    // continue S/E ids from the MAX existing numeric id (not array length) so a gap can never alias
    let n = (dossier.sources || []).reduce((m: number, s: any) => Math.max(m, parseInt(String(s.id).replace(/^S/, ''), 10) || 0), 0) + 1
    let e = (dossier.evidence || []).reduce((m: number, ev: any) => Math.max(m, parseInt(String(ev.id).replace(/^E/, ''), 10) || 0), 0)
    const webSources: any[] = []
    const blocks: string[] = []
    for (const query of queries) {
      const w = await webResearch(query, cfg)
      if (!w.citations?.length || !String(w.answer).trim()) continue
      // register EVERY citation as its own labeled source, and list them all in the block header so
      // the parser can cite the specific real publisher a claim came from — never a stand-in id.
      const labels: string[] = []
      for (const c of w.citations) {
        const sid = 'S' + String(n++).padStart(3, '0')
        webSources.push({ id: sid, medium: 'web', source_class: 'reporting', trust: 'web_secondary', title: c.title || query, publisher: c.publisher || 'web', url: c.url, video_id: '', published_at: null, transcript_status: 'web', words: 0 })
        labels.push(`[${sid} | ${c.publisher || 'web'} | ${c.title || query}]`)
      }
      blocks.push(`${labels.join('\n')}\nWEB SYNTHESIS for "${query}" (cite the specific source above that supports each claim):\n${w.answer}`)
    }

    if (!webSources.length) {
      return NextResponse.json({ ok: false, error: 'web search returned no citable sources', stage: 'web', retryable: true }, { status: 422 })
    }

    // re-parse the web material (impartial) into cited evidence + answers
    const { mined } = await parseMaterial(dossier.assignment, webSources, blocks.join('\n\n'), cfg)

    // server derives every citation URL from the web source map (anti-hallucination)
    const srcById = Object.fromEntries(webSources.map(s => [s.id, s]))
    const webEvidence = (mined.evidence || []).map((ev: any) => {
      const src = srcById[ev.source_id]
      return { id: 'E' + String(++e).padStart(3, '0'), claim: ev.claim, truth_label: ev.truth_label, source_id: ev.source_id || null, source_name: src?.publisher || null, url: src?.url || null, quote: ev.quote || null, valid_source: !!src }
    })
    dossier.evidence = [...(dossier.evidence || []), ...webEvidence]
    dossier.sources = [...(dossier.sources || []), ...webSources]

    // merge web answers into a matching question (case-insensitive trim), else append
    const nrm = (s: any) => String(s || '').trim().toLowerCase()
    dossier.answers = dossier.answers || []
    for (const a of (mined.answers || [])) {
      const match = dossier.answers.find((d: any) => nrm(d.question) === nrm(a.question))
      if (match) {
        match.direct_answer = (match.direct_answer || '') + ' [web] ' + (a.direct_answer || '')
        match.evidence_ids = Array.from(new Set([...(match.evidence_ids || []), ...(a.evidence_ids || [])]))
      } else {
        dossier.answers.push(a)
      }
    }

    // re-audit across ALL sources (transcribed YouTube + web)
    const publishers = new Set((dossier.sources || []).filter((s: any) => s.transcript_status === 'ok' || s.medium === 'web').map((s: any) => s.publisher))
    const uncited = (dossier.evidence || []).filter((ev: any) => (ev.truth_label === 'FACT' || ev.truth_label === 'ATTRIBUTED_CLAIM') && !ev.valid_source).map((ev: any) => ev.claim)
    dossier.audit = {
      status: (uncited.length === 0 && publishers.size >= 2) ? 'pass' : 'needs_review',
      distinct_publishers: publishers.size,
      uncited_claims: uncited,
      warnings: dossier.audit?.warnings || [],
      needs_web: false,
    }
    dossier.updated_at = new Date().toISOString()
    dossier.status = 'complete'

    saveStringer(dossier)
    return NextResponse.json({ ok: true, ...dossier })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err).slice(0, 200), stage: 'web', retryable: true }, { status: 502 })
  }
}
