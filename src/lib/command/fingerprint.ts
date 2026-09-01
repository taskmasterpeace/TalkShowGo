// EVENT FINGERPRINT + STORY CLUSTERING — replaces the topic miner's "what topics" guess with
// rigorous clustering by EVENT FINGERPRINT (lab/STORY_RESOLUTION_LOOP.md "The core mistake to avoid").
// The core rule: do NOT cluster by topic ("50 people said Trump" is garbage). Cluster only when
// sources DESCRIBE / REACT-TO / ADD-EVIDENCE-TO the SAME event or claim — compared by fingerprint,
// not keywords. Emits Story / Substory / (weak) Topic clusters, each with the signals that justify it.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OR_KEY = process.env.OPENROUTER_API_KEY
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const KINDS = ['story', 'substory', 'topic'] as const
// shared signals that justify grouping, strongest first (Story Similarity Score weights in the doc)
export const SIGNALS = ['shared_url', 'same_media', 'same_conversation', 'same_claim', 'same_entities', 'temporal', 'location'] as const

const SYS = `You are the STORY CLUSTERING ENGINE for a talk show's discovery loop. You get today's feed items (tweets + YouTube titles). Group them into STORY CLUSTERS.
THE CORE RULE — do NOT cluster by TOPIC. "50 people mentioned Trump" is NOT a story; a shared broad SUBJECT is garbage clustering. Only group items when the sources DESCRIBE, REACT TO, or ADD EVIDENCE TO the SAME underlying EVENT or CLAIM. Two items can share almost no words and still be the same event — compare EVENT FINGERPRINTS, not keywords.
For every cluster build an EVENT FINGERPRINT: subject, action/event, object, claim, time, location, named_entities, key_phrases. Then list the SHARED SIGNALS that justify grouping, from strongest to weakest: shared_url, same_media, same_conversation, same_claim, same_entities, temporal, location. A cluster held together only by a shared subject/keyword is NOT a story.
Classify each cluster's kind:
- "story": the sources are about ONE event/claim (the good outcome). parent = null.
- "substory": a distinct ANGLE branching off a story (story="Rockstar delayed GTA VI"; substory="devs slam Rockstar over crunch after the delay"). Set parent to the parent story's title.
- "topic": items share only a broad SUBJECT, not one event. These are WEAK — flag them as topic, never dress them up as a story.
Prefer real stories; only emit a topic cluster when the items genuinely do not resolve to one event. A single strong source can be its own story cluster.
Output STRICT JSON only: {"clusters":[{"title":"committed, specific headline","kind":"story|substory|topic","event_fingerprint":{"subject":"","action":"","object":"","claim":"","time":"","location":"","named_entities":[],"key_phrases":[]},"item_indices":[0],"shared_signals":["same_claim","same_entities"],"why_moving":"why this is live TODAY","parent":"parent story title if substory, else null"}]}`

export type EventFingerprint = { subject: string; action: string; object: string; claim: string; time: string; location: string; named_entities: string[]; key_phrases: string[] }
export type Cluster = { id: string; title: string; kind: typeof KINDS[number]; event_fingerprint: EventFingerprint; item_indices: number[]; shared_signals: string[]; why_moving: string; parent: string | null; evidence: string[] }

const arr = (x: any): any[] => Array.isArray(x) ? x : []

// robust parse: whole object, else first/last brace, else element-wise recover the clusters array so
// one malformed element (or gemini's trailing junk) can't fail the whole run. Brace-depth walking
// keeps each cluster's nested event_fingerprint object intact. Mirrors parseLeads.
function parseClusters(content: string): any[] {
  const t = String(content || '').trim()
  const tryP = (x: string) => { try { return JSON.parse(x) } catch { return null } }
  let o = tryP(t)
  if (!o) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) o = tryP(t.slice(a, b + 1)) }
  if (o && Array.isArray(o.clusters)) return o.clusters
  const m = /"clusters"\s*:\s*\[/.exec(t); if (!m) return []
  let i = m.index + m[0].length; const out: any[] = []
  while (i < t.length) {
    while (i < t.length && /[\s,]/.test(t[i])) i++
    if (i >= t.length || t[i] === ']' || t[i] !== '{') break
    let d = 0, inS = false, esc = false; const st = i
    for (; i < t.length; i++) { const c = t[i]; if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue } if (c === '"') inS = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { i++; break } } }
    const e = tryP(t.slice(st, i)); if (e) out.push(e)
  }
  return out
}

function normFingerprint(fp: any): EventFingerprint {
  fp = fp || {}
  return {
    subject: String(fp.subject || '').slice(0, 160),
    action: String(fp.action || '').slice(0, 160),
    object: String(fp.object || '').slice(0, 160),
    claim: String(fp.claim || '').slice(0, 320),
    time: String(fp.time || '').slice(0, 80),
    location: String(fp.location || '').slice(0, 120),
    named_entities: arr(fp.named_entities).map((x: any) => String(x).slice(0, 80)).filter(Boolean).slice(0, 24),
    key_phrases: arr(fp.key_phrases).map((x: any) => String(x).slice(0, 120)).filter(Boolean).slice(0, 24),
  }
}

export async function clusterStories(material: string[], cfg: any = {}) {
  if (!OR_KEY) throw new Error('OPENROUTER_API_KEY missing')
  const t0 = Date.now()
  const user = `FEED ITEMS (index from 0):\n${material.map((m, i) => i + '. ' + m).join('\n')}`
  const r = await fetch(OR_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.clusters?.model || 'google/gemini-2.5-flash-lite', temperature: cfg.clusters?.temperature ?? 0.2, max_tokens: cfg.clusters?.max_output_tokens || 4000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(120000),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error?.message || ('cluster http ' + r.status))
  const content = j.choices?.[0]?.message?.content || '{}'
  const clusters: Cluster[] = parseClusters(content)
    .filter((c: any) => c && (c.title || (c.item_indices && c.item_indices.length)))
    .map((c: any): Cluster => {
      // valid, in-range, de-duped feed indices only
      const seen = new Set<number>()
      const item_indices = arr(c.item_indices)
        .map((n: any) => Math.trunc(+n))
        .filter((n: number) => Number.isFinite(n) && n >= 0 && n < material.length && !seen.has(n) && (seen.add(n), true))
      const kind = (KINDS as readonly string[]).includes(String(c.kind)) ? c.kind : 'story'
      const parent = (kind === 'substory' && c.parent) ? String(c.parent).slice(0, 200) : null
      return {
        id: '',
        title: String(c.title || '(untitled)').slice(0, 200),
        kind: kind as typeof KINDS[number],
        event_fingerprint: normFingerprint(c.event_fingerprint),
        item_indices,
        shared_signals: arr(c.shared_signals).map((s: any) => String(s).slice(0, 60)).filter(Boolean).slice(0, 12),
        why_moving: String(c.why_moving || '').slice(0, 300),
        parent,
        evidence: item_indices.map((i: number) => material[i]).filter(Boolean),
      }
    })
    // a titled cluster whose only item indices were out-of-range has no evidence — drop it, don't ship an empty "story"
    .filter((c: Cluster) => c.evidence.length > 0)
    // strongest first: stories, then substories, then weak topics; within each, more evidence first
    .sort((a: Cluster, b: Cluster) => {
      const rank = (k: string) => (k === 'story' ? 0 : k === 'substory' ? 1 : 2)
      return rank(a.kind) - rank(b.kind) || b.evidence.length - a.evidence.length
    })
    .map((c: Cluster, i: number) => ({ ...c, id: 'C' + String(i + 1).padStart(3, '0') }))
  return { clusters, ms: Date.now() - t0, usage: j.usage, raw: content }
}

export function saveClusters(pullFile: string, out: any) {
  const dir = path.join(ROOT, 'lab', 'runs')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, pullFile.replace(/^pull_/, 'clusters_')), JSON.stringify(out, null, 2) + '\n')
}
