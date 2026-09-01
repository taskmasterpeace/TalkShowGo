// Shared WEB SUPPLEMENT — pulls impartial web reporting (OpenRouter web plugin -> Perplexity),
// registers each citation as its own source (server-derived URLs, never invented), re-parses into
// cited evidence, merges into the dossier, and re-audits. Used by BOTH the /stringer/web route AND
// Source Expansion, so a WEB/X-routed lead (a court record, a local-affiliate site) actually hits
// the web instead of returning a YouTube-only partial.
import { parseMaterial, loadConfig } from './stringer'
import { webResearch, excludedTerms, isExcluded } from './openrouter-web'

export async function supplementDossierWithWeb(dossier: any, queries?: string[], cfg: any = loadConfig()): Promise<{ added: number; publishers: number }> {
  const terms = excludedTerms(cfg)
  // retroactive hygiene: purge any pre-existing excluded-outlet source (+ its evidence)
  if (terms.length) {
    const badSrc = new Set((dossier.sources || []).filter((s: any) => isExcluded(`${s.url} ${s.publisher} ${s.title}`, terms)).map((s: any) => s.id))
    if (badSrc.size) {
      dossier.sources = (dossier.sources || []).filter((s: any) => !badSrc.has(s.id))
      dossier.evidence = (dossier.evidence || []).filter((e: any) => !badSrc.has(e.source_id) && !isExcluded(String(e.claim || ''), terms))
    }
  }
  const qs = (queries?.length ? queries : [dossier.assignment?.text, ...(dossier.assignment?.questions || [])]).map((q: any) => String(q)).filter(Boolean).slice(0, 4)

  // continue S/E ids from the MAX existing numeric id (not array length) so a gap can never alias
  let n = (dossier.sources || []).reduce((m: number, s: any) => Math.max(m, parseInt(String(s.id).replace(/^S/, ''), 10) || 0), 0) + 1
  let e = (dossier.evidence || []).reduce((m: number, ev: any) => Math.max(m, parseInt(String(ev.id).replace(/^E/, ''), 10) || 0), 0)
  const webSources: any[] = []
  const blocks: string[] = []
  for (const query of qs) {
    const w = await webResearch(query, cfg)
    if (!w.citations?.length || !String(w.answer).trim()) continue
    const labels: string[] = []
    for (const c of w.citations) {
      const sid = 'S' + String(n++).padStart(3, '0')
      webSources.push({ id: sid, medium: 'web', source_class: 'reporting', trust: 'web_secondary', title: c.title || query, publisher: c.publisher || 'web', url: c.url, video_id: '', published_at: null, transcript_status: 'web', words: 0 })
      labels.push(`[${sid} | ${c.publisher || 'web'} | ${c.title || query}]`)
    }
    blocks.push(`${labels.join('\n')}\nWEB SYNTHESIS for "${query}" (cite the specific source above that supports each claim):\n${w.answer}`)
  }

  if (webSources.length) {
    const { mined } = await parseMaterial(dossier.assignment, webSources, blocks.join('\n\n'), cfg)
    const srcById = Object.fromEntries(webSources.map(s => [s.id, s]))
    const webEvidence = (mined.evidence || []).map((ev: any) => {
      const src = srcById[ev.source_id]
      return { id: 'E' + String(++e).padStart(3, '0'), claim: ev.claim, truth_label: ev.truth_label, source_id: ev.source_id || null, source_name: src?.publisher || null, url: src?.url || null, quote: ev.quote || null, valid_source: !!src }
    })
    dossier.evidence = [...(dossier.evidence || []), ...webEvidence]
    dossier.sources = [...(dossier.sources || []), ...webSources]
    const nrm = (s: any) => String(s || '').trim().toLowerCase()
    dossier.answers = dossier.answers || []
    for (const a of (mined.answers || [])) {
      const match = dossier.answers.find((d: any) => nrm(d.question) === nrm(a.question))
      if (match) { match.direct_answer = (match.direct_answer || '') + ' [web] ' + (a.direct_answer || ''); match.evidence_ids = Array.from(new Set([...(match.evidence_ids || []), ...(a.evidence_ids || [])])) }
      else dossier.answers.push(a)
    }
  }

  // re-audit across ALL sources (transcribed YouTube + web)
  const publishers = new Set((dossier.sources || []).filter((s: any) => s.transcript_status === 'ok' || s.medium === 'web').map((s: any) => s.publisher))
  const uncited = (dossier.evidence || []).filter((ev: any) => (ev.truth_label === 'FACT' || ev.truth_label === 'ATTRIBUTED_CLAIM') && !ev.valid_source).map((ev: any) => ev.claim)
  dossier.audit = { status: (uncited.length === 0 && publishers.size >= 2) ? 'pass' : 'needs_review', distinct_publishers: publishers.size, uncited_claims: uncited, warnings: dossier.audit?.warnings || [], needs_web: false }
  dossier.updated_at = new Date().toISOString()
  dossier.status = 'complete'
  return { added: webSources.length, publishers: publishers.size }
}
