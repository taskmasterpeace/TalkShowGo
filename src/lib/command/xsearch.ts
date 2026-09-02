// X (Twitter) SEARCH adapter (Story Resolution Loop) — twitterapi.io advanced search for a lead's
// query, folded into a dossier as ATTRIBUTED_CLAIM evidence with full post provenance (author,
// permalink, timestamp, post_id). So an X-routed lead reaches real recent statements/reactions,
// not just YouTube. Mirrors web-supplement.ts. Degrades gracefully if the key is dead/absent.
import fs from 'node:fs'
import path from 'node:path'
import { parseMaterial } from './stringer'
import { excludedTerms, isExcluded } from './openrouter-web'

const ROOT = process.cwd()
function xKey(): string | null { try { return (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^TWITTERAPI_IO_KEY=(.+)$/m) || [])[1]?.trim() || null } catch { return null } }

export type XPost = { id: string; text: string; url: string | null; author: string; created: string | null; likes: number; rts: number }

export async function searchX(query: string, _cfg: any = {}, max = 12): Promise<XPost[]> {
  const K = xKey(); if (!K) throw new Error('TWITTERAPI_IO_KEY missing')
  const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}&queryType=Top`
  const r = await fetch(url, { headers: { 'X-API-Key': K }, signal: AbortSignal.timeout(20000) })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error('twitterapi ' + r.status)
  return (j?.tweets || j?.data?.tweets || [])
    .map((t: any) => {
      const author = t.author?.userName || t.author?.screen_name || t.author?.name || 'x'
      return { id: String(t.id || ''), text: String(t.text || '').slice(0, 280), url: t.url || (t.id ? `https://x.com/${author}/status/${t.id}` : null), author, created: t.createdAt || null, likes: t.likeCount || 0, rts: t.retweetCount || 0 }
    })
    .filter((t: XPost) => t.text)
    .sort((a: XPost, b: XPost) => (b.likes + b.rts * 2) - (a.likes + a.rts * 2))
    .slice(0, max)
}

export async function supplementDossierWithX(dossier: any, query: string, cfg: any): Promise<{ added: number; publishers?: number }> {
  const terms = excludedTerms(cfg)
  let tweets: XPost[]
  try { tweets = await searchX(query, cfg) } catch { return { added: 0 } } // key dead/absent -> degrade
  tweets = tweets.filter(t => !isExcluded(`${t.author} ${t.text} ${t.url || ''}`, terms))
  if (!tweets.length) return { added: 0 }

  let n = (dossier.sources || []).reduce((m: number, s: any) => Math.max(m, parseInt(String(s.id).replace(/^S/, ''), 10) || 0), 0) + 1
  let e = (dossier.evidence || []).reduce((m: number, ev: any) => Math.max(m, parseInt(String(ev.id).replace(/^E/, ''), 10) || 0), 0)
  const sources: any[] = []
  const blocks: string[] = []
  for (const t of tweets) {
    const sid = 'S' + String(n++).padStart(3, '0')
    sources.push({ id: sid, medium: 'x', source_class: 'reaction', trust: 'x_post', title: `@${t.author}`, publisher: `@${t.author}`, url: t.url, video_id: '', published_at: t.created, transcript_status: 'x', words: 0, post_id: t.id, text: t.text, likes: t.likes, rts: t.rts })
    blocks.push(`[${sid} | @${t.author} | X post ${t.created || ''}] ${t.text}`)
  }
  const { mined } = await parseMaterial(dossier.assignment, sources, blocks.join('\n\n'), cfg)
  const srcById = Object.fromEntries(sources.map(s => [s.id, s]))
  const xEvidence = (mined.evidence || []).map((m: any) => {
    const src = srcById[m.source_id]
    return { id: 'E' + String(++e).padStart(3, '0'), claim: m.claim, truth_label: m.truth_label || 'ATTRIBUTED_CLAIM', source_id: m.source_id || null, source_name: src?.publisher || null, url: src?.url || null, quote: m.quote || null, valid_source: !!src }
  })
  dossier.evidence = [...(dossier.evidence || []), ...xEvidence]
  dossier.sources = [...(dossier.sources || []), ...sources]

  const publishers = new Set((dossier.sources || []).filter((s: any) => s.transcript_status === 'ok' || s.medium === 'web' || s.medium === 'x').map((s: any) => s.publisher))
  const uncited = (dossier.evidence || []).filter((x: any) => (x.truth_label === 'FACT' || x.truth_label === 'ATTRIBUTED_CLAIM') && !x.valid_source).map((x: any) => x.claim)
  dossier.audit = { status: (uncited.length === 0 && publishers.size >= 2) ? 'pass' : 'needs_review', distinct_publishers: publishers.size, uncited_claims: uncited, warnings: dossier.audit?.warnings || [], needs_web: false }
  dossier.updated_at = new Date().toISOString()
  dossier.status = 'complete'
  return { added: sources.length, publishers: publishers.size }
}
