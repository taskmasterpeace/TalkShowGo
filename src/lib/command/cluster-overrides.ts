// HUMAN-IN-THE-LOOP CLUSTERING: an overrides layer the producer lays on top of the AI's story clusters.
// The AI's file (lab/runs/clusters_<stamp>.json) is never edited. Every human decision is an op appended to
// lab/runs/cluster_overrides_<stamp>.json and REPLAYED, in order, every time clusters are read
// (effectiveClusters). Ops: MERGE two clusters, SPLIT an item out into its own cluster, RENAME, PIN one as
// today's story, DISMISS one as not-a-story. Undo = pop the last op. Every touched cluster carries human:true.
// Guard: a re-run of CLUSTER on the same pull overwrites clusters_<stamp>.json with different clusters under
// the same ids, so an op layer remembers the clustered_at it was made against; if that changes the layer is
// STALE (not applied, reported) and the next edit retires it into `retired` rather than deleting it.
import fs from 'node:fs'
import path from 'node:path'
import { materialFromPull } from '@/lib/command/leads'

const ROOT = process.cwd()
const RUNS = path.join(ROOT, 'lab', 'runs')

export const OPS = ['merge', 'split', 'rename', 'pin', 'dismiss'] as const
export type ClusterOp =
  | { op: 'merge'; into: string; from: string }
  | { op: 'split'; from: string; item_index: number; title?: string }
  | { op: 'rename'; id: string; title: string }
  | { op: 'pin'; id: string; pinned: boolean }
  | { op: 'dismiss'; id: string; dismissed: boolean }
export type ClusterOverrideEntry = { ts: string } & ClusterOp
export type ClusterOverrides = {
  version: 1
  ops: ClusterOverrideEntry[]
  /** clustered_at of the AI output these ops were made against; a re-cluster of the same pull makes them stale */
  base?: string
  /** earlier op layers retired because the AI re-clustered the same pull (kept for the record, never applied) */
  retired?: { base?: string; ops: ClusterOverrideEntry[]; retired_at: string }[]
}
export type EffectiveClusters = {
  file: string
  envelope: any | null
  clusters: any[]
  /** the layer that was APPLIED: when the stored ops predate a re-cluster this is ops:[] + stale:true */
  overrides: ClusterOverrides & { stale?: boolean; stale_ops?: number }
  /** the overrides file exactly as stored on disk */
  stored: ClusterOverrides
  material: string[] | null
}

const KIND_RANK: Record<string, number> = { story: 0, substory: 1, topic: 2 }
const emptyOverrides = (): ClusterOverrides => ({ version: 1, ops: [] })
const emptyFingerprint = () => ({ subject: '', action: '', object: '', claim: '', time: '', location: '', named_entities: [] as string[], key_phrases: [] as string[] })
const arr = (x: any): any[] => (Array.isArray(x) ? x : [])
const str = (x: any, n: number) => String(x ?? '').trim().slice(0, n)
const isId = (x: any): x is string => typeof x === 'string' && /^[\w:.-]{1,64}$/.test(x)

/** stamp of a clusters file: clusters_2026-09-02T02-16-51.json -> 2026-09-02T02-16-51 */
export function clustersStamp(clustersFile: string): string {
  return path.basename(String(clustersFile || '')).replace(/^clusters_/, '').replace(/\.json$/i, '')
}

/** absolute path of the overrides file shadowing a clusters file: lab/runs/cluster_overrides_<same stamp>.json */
export function overridesPath(clustersFile: string): string {
  return path.join(RUNS, 'cluster_overrides_' + clustersStamp(clustersFile) + '.json')
}

/** Validate + normalize one raw op (from the wire or from disk). null when it is not a well-formed op. */
export function normalizeOp(raw: any): ClusterOp | null {
  if (!raw || typeof raw !== 'object') return null
  switch (raw.op) {
    case 'merge':
      return isId(raw.into) && isId(raw.from) && raw.into !== raw.from ? { op: 'merge', into: raw.into, from: raw.from } : null
    case 'split': {
      const v = raw.item_index
      const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN)
      if (!isId(raw.from) || !Number.isInteger(n) || n < 0) return null
      const title = str(raw.title, 200)
      return title ? { op: 'split', from: raw.from, item_index: n, title } : { op: 'split', from: raw.from, item_index: n }
    }
    case 'rename': {
      const title = str(raw.title, 200)
      return isId(raw.id) && title ? { op: 'rename', id: raw.id, title } : null
    }
    case 'pin':
      return isId(raw.id) ? { op: 'pin', id: raw.id, pinned: !!raw.pinned } : null
    case 'dismiss':
      return isId(raw.id) ? { op: 'dismiss', id: raw.id, dismissed: !!raw.dismissed } : null
    default:
      return null
  }
}

function cleanEntries(list: any): ClusterOverrideEntry[] {
  const out: ClusterOverrideEntry[] = []
  for (const e of arr(list)) {
    const op = normalizeOp(e)
    if (op) out.push({ ts: typeof e?.ts === 'string' && e.ts ? e.ts : new Date().toISOString(), ...op })
  }
  return out
}

function cleanOverrides(o: any): ClusterOverrides {
  const out: ClusterOverrides = { version: 1, ops: cleanEntries(o?.ops) }
  if (typeof o?.base === 'string' && o.base) out.base = o.base
  const retired = arr(o?.retired)
    .filter(r => r && typeof r === 'object')
    .map(r => ({ base: typeof r.base === 'string' && r.base ? r.base : undefined, ops: cleanEntries(r.ops), retired_at: typeof r.retired_at === 'string' ? r.retired_at : '' }))
    .filter(r => r.ops.length)
  if (retired.length) out.retired = retired
  return out
}

/** Read the overrides layer for a clusters file. Never throws; missing or corrupt -> {version:1, ops:[]}. */
export function loadOverrides(clustersFile: string): ClusterOverrides {
  try {
    const p = overridesPath(clustersFile)
    if (!fs.existsSync(p)) return emptyOverrides()
    return cleanOverrides(JSON.parse(fs.readFileSync(p, 'utf8')))
  } catch { return emptyOverrides() }
}

/** Write the overrides layer (normalized). Never throws; returns false when the write failed. */
export function saveOverrides(clustersFile: string, o: ClusterOverrides): boolean {
  try {
    fs.mkdirSync(RUNS, { recursive: true })
    fs.writeFileSync(overridesPath(clustersFile), JSON.stringify(cleanOverrides(o), null, 2) + '\n')
    return true
  } catch { return false }
}

/**
 * PURE, deterministic replay of the human ops over the AI's clusters (inputs are not mutated).
 *  merge   = union item_indices + evidence (+ shared_signals) into `into`, drop `from`, keep `into`'s
 *            fingerprint, record merged_from[] (ids) + merged_titles[]; a pinned `from` keeps `into` pinned
 *  split   = remove item_index from `from`, create {id:'H'+n, kind:'story', human:true, split_from} for it;
 *            ignored when the item is not in `from` or `from` has a single item (already its own cluster)
 *  rename  = set title    pin = set pinned    dismiss = set dismissed (kept in the list, flagged)
 * Every touched cluster gets human:true + human_ops[]. When `material` is given, evidence is rebuilt from it
 * (same rule the AI used) and every cluster gets items:[{index,text}] so a UI can address single items.
 * Order: dismissed last; then pinned first; then story -> substory -> topic; then evidence count desc.
 * Unknown ids and malformed ops are ignored, never thrown.
 */
export function applyOverrides(clusters: any[], material: string[] | null, o: ClusterOverrides): any[] {
  let out: any[] = arr(clusters).filter(c => c && typeof c === 'object').map(c => JSON.parse(JSON.stringify(c)))
  for (const c of out) {
    c.id = String(c.id ?? '')
    c.title = String(c.title ?? '(untitled)')
    c.item_indices = arr(c.item_indices).map((n: any) => Math.trunc(Number(n))).filter((n: number) => Number.isFinite(n) && n >= 0)
    c.evidence = arr(c.evidence).map((e: any) => String(e)).filter(Boolean)
    c.shared_signals = arr(c.shared_signals).map((s: any) => String(s)).filter(Boolean)
    c.pinned = !!c.pinned; c.dismissed = !!c.dismissed; c.human = !!c.human
  }
  const find = (id: string) => out.find(c => c.id === id)
  const touch = (c: any, op: string) => { c.human = true; c.human_ops = Array.from(new Set([...arr(c.human_ops), op])) }
  const ops = arr(o?.ops).map(normalizeOp).filter(Boolean) as ClusterOp[]
  let splits = 0

  for (const op of ops) {
    if (op.op === 'merge') {
      const into = find(op.into), from = find(op.from)
      if (!into || !from || into === from) continue
      const idx = new Set<number>(into.item_indices)
      for (const n of from.item_indices) if (!idx.has(n)) { idx.add(n); into.item_indices.push(n) }
      const ev = new Set<string>(into.evidence)
      for (const e of from.evidence) if (!ev.has(e)) { ev.add(e); into.evidence.push(e) }
      into.shared_signals = Array.from(new Set([...into.shared_signals, ...from.shared_signals])).slice(0, 12)
      into.merged_from = [...arr(into.merged_from), from.id, ...arr(from.merged_from)]
      into.merged_titles = [...arr(into.merged_titles), from.title, ...arr(from.merged_titles)].filter(Boolean)
      if (from.pinned) into.pinned = true
      touch(into, 'merge')
      out = out.filter(c => c !== from)
    } else if (op.op === 'split') {
      const from = find(op.from)
      if (!from) continue
      const pos = from.item_indices.indexOf(op.item_index)
      if (pos < 0 || from.item_indices.length < 2) continue
      const aligned = from.evidence.length === from.item_indices.length
      const text = String(material?.[op.item_index] ?? (aligned ? from.evidence[pos] : '') ?? '')
      from.item_indices.splice(pos, 1)
      if (!material && aligned) from.evidence.splice(pos, 1)
      touch(from, 'split')
      let id = 'H' + (++splits)
      while (find(id)) id = 'H' + (++splits)
      out.push({
        id, title: op.title || text.slice(0, 70) || ('item ' + op.item_index), kind: 'story', event_fingerprint: emptyFingerprint(),
        item_indices: [op.item_index], shared_signals: [], why_moving: '', parent: null, evidence: [text].filter(Boolean),
        pinned: false, dismissed: false, human: true, human_ops: ['split'], split_from: from.id, split_from_title: from.title,
      })
    } else if (op.op === 'rename') {
      const c = find(op.id); if (!c) continue
      c.title = op.title; touch(c, 'rename')
    } else if (op.op === 'pin') {
      const c = find(op.id); if (!c) continue
      c.pinned = op.pinned; touch(c, 'pin')
    } else if (op.op === 'dismiss') {
      const c = find(op.id); if (!c) continue
      c.dismissed = op.dismissed; touch(c, 'dismiss')
    }
  }

  for (const c of out) {
    if (material) c.evidence = c.item_indices.map((i: number) => material[i]).filter(Boolean)
    c.items = c.item_indices.map((i: number, k: number) => ({ index: i, text: String(material?.[i] ?? c.evidence[k] ?? '') }))
  }
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) =>
      (Number(a.c.dismissed) - Number(b.c.dismissed)) ||
      (Number(b.c.pinned) - Number(a.c.pinned)) ||
      ((KIND_RANK[a.c.kind] ?? 3) - (KIND_RANK[b.c.kind] ?? 3)) ||
      (b.c.evidence.length - a.c.evidence.length) ||
      (a.i - b.i))
    .map(x => x.c)
}

/** Counts over an effective list: kinds + pinned are counted on live (not dismissed) clusters. */
export function countClusters(clusters: any[]) {
  const all = arr(clusters).filter(c => c && typeof c === 'object')
  const live = all.filter(c => !c.dismissed)
  return {
    stories: live.filter(c => c.kind === 'story').length,
    substories: live.filter(c => c.kind === 'substory').length,
    topics: live.filter(c => c.kind === 'topic').length,
    pinned: live.filter(c => c.pinned).length,
    dismissed: all.length - live.length,
    human: all.filter(c => c.human).length,
  }
}

/** Load a clusters file + its pull's material + its overrides -> the EFFECTIVE clusters (human ops applied). */
export function effectiveClusters(clustersFile: string): EffectiveClusters {
  const file = path.basename(String(clustersFile || ''))
  const stored = loadOverrides(file)
  let envelope: any = null
  try { envelope = JSON.parse(fs.readFileSync(path.join(RUNS, file), 'utf8')) } catch { envelope = null }
  if (!envelope || typeof envelope !== 'object') return { file, envelope: null, clusters: [], overrides: stored, stored, material: null }

  let material: string[] | null = null
  try {
    if (envelope.pulled_from) {
      const report = JSON.parse(fs.readFileSync(path.join(RUNS, path.basename(String(envelope.pulled_from))), 'utf8'))
      const m = materialFromPull(report)
      material = m.length ? m : null
    }
  } catch { material = null }

  const clusteredAt = typeof envelope.clustered_at === 'string' ? envelope.clustered_at : ''
  const stale = !!(stored.base && clusteredAt && stored.base !== clusteredAt)
  const overrides: EffectiveClusters['overrides'] = stale
    ? { version: 1, base: stored.base, ops: [], retired: stored.retired, stale: true, stale_ops: stored.ops.length }
    : stored
  return { file, envelope, clusters: applyOverrides(arr(envelope.clusters), material, overrides), overrides, stored, material }
}
