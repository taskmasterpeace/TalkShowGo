import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { countClusters, effectiveClusters, normalizeOp, saveOverrides, type ClusterOverrides } from '@/lib/command/cluster-overrides'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const ROOT = process.cwd()
const RUNS = path.join(ROOT, 'lab', 'runs')
const FILE_RE = /^clusters_[\w:.-]+\.json$/

const listFiles = () => fs.existsSync(RUNS) ? fs.readdirSync(RUNS).filter(f => f.startsWith('clusters_') && f.endsWith('.json')).sort().reverse() : []
const fail = (error: string, status: number, extra: Record<string, any> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status })

/** the clusters file to edit: explicit (validated by name + existence) or the newest one */
function pickFile(requested: unknown): { file: string | null; error?: string } {
  const files = listFiles()
  if (requested == null || requested === '') return { file: files[0] || null }
  const name = String(requested)
  if (!FILE_RE.test(name)) return { file: null, error: 'bad file name (expected clusters_<stamp>.json)' }
  if (!files.includes(name)) return { file: null, error: 'clusters file not found: ' + name }
  return { file: name }
}

/** the one response shape for GET and every POST: the EFFECTIVE clusters after the human layer */
function respond(file: string, extra: Record<string, any> = {}) {
  const eff = effectiveClusters(file)
  if (!eff.envelope) return fail('clusters unreadable', 500, { stage: 'load' })
  return NextResponse.json({
    ok: true, file, pulled_from: eff.envelope.pulled_from || null, clustered_at: eff.envelope.clustered_at || null,
    clusters: eff.clusters, overrides: eff.overrides, counts: countClusters(eff.clusters), ...extra,
  })
}

/** GET ?file=<clusters_*.json> (default newest) -> {ok, file, clusters (effective), overrides, counts} */
export function GET(req: Request) {
  const pick = pickFile(new URL(req.url).searchParams.get('file'))
  if (pick.error) return fail(pick.error, 400, { stage: 'load' })
  if (!pick.file) return NextResponse.json({ ok: true, file: null, clusters: [], overrides: { version: 1, ops: [] }, counts: countClusters([]) })
  return respond(pick.file)
}

/** POST {file?, op} appends one human op (merge | split | rename | pin | dismiss) to the overrides layer;
 *  POST {file?, undo:true} pops the last op. Both return the same shape as GET. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) || {}
  const pick = pickFile(body.file)
  if (pick.error) return fail(pick.error, 400, { stage: 'load' })
  if (!pick.file) return fail('no clusters yet - run CLUSTER first', 400, { stage: 'load' })
  const file = pick.file
  const eff = effectiveClusters(file)
  if (!eff.envelope) return fail('clusters unreadable', 500, { stage: 'load' })
  const now = new Date().toISOString()
  const clusteredAt = typeof eff.envelope.clustered_at === 'string' ? eff.envelope.clustered_at : ''

  if (body.undo === true) {
    if (eff.overrides.stale || !eff.stored.ops.length) return fail('nothing to undo', 400, { stage: 'edit' })
    const undone = eff.stored.ops[eff.stored.ops.length - 1]
    const next: ClusterOverrides = { ...eff.stored, ops: eff.stored.ops.slice(0, -1) }
    if (!saveOverrides(file, next)) return fail('overrides not saved', 500, { stage: 'save', retryable: true })
    return respond(file, { undone })
  }

  const op = normalizeOp(body.op)
  if (!op) return fail('bad op: expected {op: merge|split|rename|pin|dismiss, ...} with string ids (split: integer item_index)', 400, { stage: 'validate' })
  // the op must point at clusters that exist in the EFFECTIVE view (after the earlier ops)
  const byId = new Map<string, any>(eff.clusters.map((c: any) => [c.id, c]))
  const refs = op.op === 'merge' ? [op.into, op.from] : op.op === 'split' ? [op.from] : [op.id]
  const missing = refs.filter(id => !byId.has(id))
  if (missing.length) return fail('unknown cluster id: ' + missing.join(', '), 400, { stage: 'validate' })
  if (op.op === 'split') {
    const from = byId.get(op.from)
    const idx: number[] = Array.isArray(from?.item_indices) ? from.item_indices : []
    if (!idx.includes(op.item_index)) return fail(`item ${op.item_index} is not in ${op.from}`, 400, { stage: 'validate' })
    if (idx.length < 2) return fail(`${op.from} has one item; it is already its own cluster`, 400, { stage: 'validate' })
  }

  // a stale layer (the AI re-clustered this pull since those ops were made) is retired, not applied to strangers
  const next: ClusterOverrides = eff.overrides.stale
    ? { version: 1, base: clusteredAt || undefined, ops: [], retired: [...(eff.stored.retired || []), { base: eff.stored.base, ops: eff.stored.ops, retired_at: now }] }
    : { ...eff.stored, ops: [...eff.stored.ops] }
  if (!next.base && clusteredAt) next.base = clusteredAt
  next.ops.push({ ts: now, ...op })
  if (!saveOverrides(file, next)) return fail('overrides not saved', 500, { stage: 'save', retryable: true })
  return respond(file, { applied: op })
}
