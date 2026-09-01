// SOURCE EXPANSION (Story Resolution Loop) — a Research Lead becomes a Stringer run with the right
// search mode, producing a cited dossier (Evidence Packet) that the Briefing/Cast/Floor already
// consume. Closes the loop: lead -> evidence -> show. The lead's destination picks the YouTube mode
// so a LEGACY lead actually digs the historical layer (the dead-2yr-old-channel case).
import { runStringer, saveStringer, type Assignment, type YtMode } from './stringer'

const DEST_MODE: Record<string, YtMode> = {
  YOUTUBE_CURRENT: 'current', YOUTUBE_CONTEXT: 'context', YOUTUBE_LEGACY: 'legacy',
  YOUTUBE_ORIGINAL: 'original', YOUTUBE_REACTION: 'reaction',
  WEB: 'context', X: 'context', // X has no native adapter yet -> a general search of the query (+web supplement)
}
const CLAIMY = new Set(['CLAIM', 'QUOTE', 'STATISTIC', 'REPORT', 'LAW', 'COURT_CASE'])

export function leadToAssignment(lead: any): { assignment: Assignment; mode: YtMode } {
  const mode = DEST_MODE[String(lead.destination)] || 'context'
  const kind: 'subject' | 'question' = CLAIMY.has(String(lead.type).toUpperCase()) ? 'question' : 'subject'
  const text = String(lead.query || lead.value || '').slice(0, 400)
  const questions = kind === 'question' ? [String(lead.value || lead.query || '').slice(0, 300)] : []
  return { assignment: { kind, text, questions }, mode }
}

export async function expandLead(lead: any, trusted: any[] = []) {
  const { assignment, mode } = leadToAssignment(lead)
  // important/current leads get the dual freshness+relevance sweep; legacy/original stay single-pass
  const dual = String(lead.destination) === 'YOUTUBE_CURRENT' || lead.dual === true
  const dossier: any = await runStringer(assignment, trusted, { mode, dual })
  dossier.expanded_from = { lead_id: lead.id || null, lead_type: lead.type || null, lead_value: lead.value || null, destination: lead.destination || null, mode }
  saveStringer(dossier)
  return dossier
}
