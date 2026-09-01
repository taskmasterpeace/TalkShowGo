// SHOWPLAN compiler — turns (format + available cast + input) into a role-assigned run of show.
// Pure/deterministic. Consumes lab/formats.json + blocks.json + production_skins.json + cast.json.
// Contract: lab/FORMAT_SYSTEM.md "The SHOWPLAN compiler contract".
//   loadData(root) -> {formats, blocks, skins, cast, guests}
//   compileShowplan(data, request) -> {format, casting, runOfShow, manifest, warnings, ...}
// CLI: node lab/engine/showplan.mjs <formatId> [runtimeMin] | --all
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

export function loadData(root = process.cwd()) {
  const lab = path.join(root, 'lab')
  const rd = (...p) => JSON.parse(fs.readFileSync(path.join(lab, ...p), 'utf8'))
  const cast = rd('cast', 'cast.json')
  const gdir = path.join(lab, 'cast', 'guests')
  let guests = []
  try { guests = fs.readdirSync(gdir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(gdir, f), 'utf8'))) } catch {}
  return { formats: rd('formats.json'), blocks: rd('blocks.json'), skins: rd('production_skins.json'), cast, guests }
}

const VOICE_ROLES = new Set(['H', 'M', 'A', 'B', 'P'])
const GUEST_WORD = { subject: 'S', expert: 'E', witness: 'W', correspondent: 'C' }

// which format role letters can a pool member fill?
function memberRoles(m) {
  if (m.__kind === 'host') return new Set([...VOICE_ROLES, 'C']) // a host can be any voice role or a comic foil
  const declared = String(m.format_role || m.type || m.guest_role || '').toLowerCase()
  const letter = GUEST_WORD[declared] || (declared.length === 1 ? declared.toUpperCase() : null)
  return new Set(letter ? [letter] : ['S', 'E', 'W', 'C']) // unknown guest -> any guest role
}

function castSlots(format, pool, overrides = {}) {
  const used = new Set()
  return format.cast_logic.slots.map(slot => {
    const roles = slot.one_of || [slot.role]
    let filledBy = null, resolvedRole = null, source = null
    const ov = overrides[slot.id]
    if (ov) {
      const m = pool.find(p => p.id === ov && !used.has(p.id))
      if (m) { filledBy = m; source = 'override'; resolvedRole = roles.find(r => memberRoles(m).has(r)) || roles[0] }
    }
    if (!filledBy) {
      for (const role of roles) {
        const m = pool.find(p => !used.has(p.id) && memberRoles(p).has(role))
        if (m) { filledBy = m; resolvedRole = role; source = 'auto'; break }
      }
    }
    if (filledBy) used.add(filledBy.id)
    return {
      slotId: slot.id, roles, required: !!slot.required, resolvedRole,
      filledBy: filledBy ? { id: filledBy.id, name: filledBy.name, kind: filledBy.__kind } : null,
      source, substitution: (!filledBy && slot.required) ? slot.substitution : (!filledBy ? '(optional seat left empty)' : null)
    }
  })
}

function evalWhen(when, ctx) {
  const w = String(when).trim()
  let m
  if ((m = w.match(/^slot (\w+) filled as ([A-Z])$/))) { const s = ctx.filled.get(m[1]); return !!s && s.role === m[2] }
  if ((m = w.match(/^slot (\w+) filled$/))) return ctx.filled.has(m[1])
  if ((m = w.match(/^slot (\w+) unfilled$/))) return !ctx.filled.has(m[1])
  if ((m = w.match(/^runtime<(\d+)m$/))) return ctx.runtime != null && ctx.runtime < Number(m[1])
  if (w === 'runtime long') return ctx.runtime != null && ctx.runtime >= 20
  if ((m = w.match(/^fewer than (\d+) panel/))) return [...ctx.filled.values()].filter(v => v.role === 'P').length < Number(m[1])
  return false // editorial/runtime triggers (breaking-news, comedy beat wanted) are off unless externally flagged
}

function buildSequence(format, ctx) {
  const base = format.episode_grammar.base_sequence
  const total = {}
  for (const e of base) { const b = typeof e === 'string' ? e : e.block; total[b] = (total[b] || 0) + 1 }
  const seen = {}
  let seq = base.map(e => {
    const b = typeof e === 'string' ? e : e.block
    const bind = typeof e === 'object' ? e.bind : null
    seen[b] = (seen[b] || 0) + 1
    const occ = bind ? `${b}@${bind}` : (total[b] > 1 ? `${b}#${seen[b]}` : b)
    return { occ, block: b, bind }
  })
  const applied = []
  const findIdx = (ref) => seq.findIndex(s => s.occ === ref || s.block === ref)
  for (const br of format.episode_grammar.branches || []) {
    if (!evalWhen(br.when, ctx)) continue
    applied.push(`${br.when} => ${br.op}${br.block ? ' ' + br.block : ''}`)
    if (br.op === 'abort') return { seq, applied, aborted: br.note || br.when }
    if (br.op === 'note') continue
    if (br.op === 'remove') { seq = seq.filter(s => s.block !== br.block && s.occ !== br.block); continue }
    if (br.op === 'replace') { const i = findIdx(br.target); if (i >= 0) seq[i] = { occ: br.block, block: br.block, bind: null, from: br.target }; continue }
    if (br.op === 'insert') {
      const items = (br.blocks || [br.block]).map(b => ({ occ: b, block: b, bind: null }))
      if (br.after) { const i = findIdx(br.after); seq.splice(i >= 0 ? i + 1 : seq.length, 0, ...items) }
      else if (br.before) { const i = findIdx(br.before); seq.splice(i >= 0 ? i : seq.length, 0, ...items) }
      else seq.push(...items)
      continue
    }
    if (br.op === 'merge') {
      const set = new Set(br.blocks || []); const into = br.into; let kept = false
      seq = seq.filter(s => { if (!set.has(s.block)) return true; if (s.block === into && !kept) { s.merged = [...set]; kept = true; return true } return false })
      if (!kept) seq.push({ occ: into, block: into, bind: null, merged: [...set] })
    }
  }
  return { seq, applied, aborted: null }
}

function resolveBlock(item, byId, casting) {
  const b = byId[item.block]
  if (!b) return { occ: item.occ, block: item.block, error: 'unknown block' }
  const filled = casting.filter(c => c.filledBy)
  let performer = item.bind ? filled.find(c => c.slotId === item.bind) : null
  if (!performer) performer = filled.find(c => b.eligible_roles.includes(c.resolvedRole))
  const bound = (b.requires || []).map(rr => { const c = filled.find(x => x.resolvedRole === rr); return { role: rr, filledBy: c ? c.filledBy : null } })
  return {
    occ: item.occ, block: b.id, name: b.name, purpose: b.purpose,
    performer: performer ? performer.filledBy : null,
    requires: bound, claim_mode: b.claim_mode, evidence_required: b.evidence_required,
    duration_s: b.duration_s, escalation: b.escalation, merged: item.merged || null,
    unmet: (b.requires || []).filter(rr => !filled.some(x => x.resolvedRole === rr))
  }
}

const fmeta = f => ({ id: f.id, name: f.name, reference: f.reference, spine: f.series_dna.spine, host_job: f.series_dna.host_job, human_dependency: f.cast_logic.human_dependency, editorial_mode: f.series_dna.editorial_mode, truth_contract: f.series_dna.truth_contract })

export function compileShowplan(data, req = {}) {
  const format = data.formats.formats.find(f => f.id === req.formatId)
  if (!format) throw new Error('unknown format: ' + req.formatId)
  const hosts = (data.cast.hosts || []).map(h => ({ ...h, __kind: 'host' }))
  const guests = (req.guests || data.guests || []).map(g => ({ ...g, __kind: 'guest' }))
  const casting = castSlots(format, [...hosts, ...guests], req.seatOverrides || {})
  const filled = new Map(casting.filter(c => c.filledBy).map(c => [c.slotId, { role: c.resolvedRole, filledBy: c.filledBy }]))
  const ctx = { filled, runtime: req.runtime ?? null }
  const { seq, applied, aborted } = buildSequence(format, ctx)
  const warnings = []
  if (aborted) return { format: fmeta(format), casting, aborted, warnings: ['ABORT: ' + aborted], input: req.input || null }
  const byId = Object.fromEntries(data.blocks.blocks.map(b => [b.id, b]))
  const runOfShow = seq.map(s => resolveBlock(s, byId, casting))
  for (const r of runOfShow) {
    if (r.unmet?.length) warnings.push(`block ${r.occ} unmet requires: ${r.unmet.join(', ')}`)
    else if (!r.performer) warnings.push(`block ${r.occ} has no bound performer`)
  }
  for (const c of casting) if (!c.filledBy && c.required) warnings.push(`required slot ${c.slotId} empty -> ${c.substitution}`)
  const totalRuntimeS = runOfShow.reduce((a, r) => a + (r.duration_s || 0), 0)
  const tracks = [...new Map(casting.filter(c => c.filledBy).map(c => [c.filledBy.id, c.filledBy])).values()]
  const skin = req.skinId ? data.skins.skins.find(s => s.id === req.skinId) : null
  const manifest = { tracks, skin: skin ? skin.id : null, capacity: skin ? skin.capacity : null, capacityOk: skin ? skin.capacity >= tracks.length : null }
  return { format: fmeta(format), casting, runOfShow, applied_branches: applied, totalRuntimeS, manifest, warnings, input: req.input || null }
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const root = process.cwd()
  const data = loadData(root)
  const arg = process.argv[2]
  const runtime = process.argv[3] ? Number(process.argv[3]) : null
  const run = (id) => {
    const p = compileShowplan(data, { formatId: id, runtime })
    console.log(`\n=== ${p.format.name} (${p.format.id}) ${runtime ? '@ ' + runtime + 'm' : ''} ===`)
    console.log('  dependency:', p.format.human_dependency)
    console.log('  casting:', p.casting.map(c => `${c.slotId}[${c.resolvedRole || (c.roles || []).join('/')}]=${c.filledBy ? c.filledBy.name : (c.required ? 'EMPTY(sub)' : '-')}`).join('  '))
    if (p.aborted) { console.log('  ABORTED:', p.aborted); return }
    console.log('  branches applied:', p.applied_branches.length ? p.applied_branches.join(' | ') : '(none)')
    console.log('  run of show (' + Math.round(p.totalRuntimeS / 60 * 10) / 10 + 'm):')
    for (const r of p.runOfShow) console.log(`    - ${r.occ.padEnd(26)} ${(r.performer ? r.performer.name : '(no performer)').padEnd(16)} esc${r.escalation} ${r.duration_s}s [${r.claim_mode.join('/')}]`)
    if (p.warnings.length) console.log('  warnings:', p.warnings.length, '\n    ' + p.warnings.join('\n    '))
  }
  if (!arg || arg === '--all') for (const f of data.formats.formats) run(f.id)
  else run(arg)
}
