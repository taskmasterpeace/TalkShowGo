// MODEL LINEUP — which model each utility ROLE runs on, editable in the SETTINGS page and stored at
// lab/settings/models.json (gitignored: an install's choice, not the repo's). The defaults ARE the lineup
// decided 2026-09-02 (every id verified live on OpenRouter). Hosts and the showrunner are NOT here: they
// are locked bundles in lab/cast/cast.json (the MODELS card shows them read-only via castModels()).
// Call sites: stt.ts -> modelFor('stt') · stringer.ts parser -> 'parser' · leads.ts -> 'leads' ·
// producer.ts -> 'rank' · followups.ts -> 'followups'. lab/research/config.json (parser.model etc.)
// still wins at those call sites when set; modelsReport() names that override so the page can say so.
import fs from 'node:fs'
import path from 'node:path'

export type Role = 'stt' | 'followups' | 'parser' | 'leads' | 'rank'
export type ModelRef = { provider: string; id: string }
export type ResolvedModel = ModelRef & { source: 'file' | 'default' }
export const ROLES: Role[] = ['stt', 'followups', 'parser', 'leads', 'rank']
export const ROLE_INFO: Record<Role, { label: string; what: string; used_by: string }> = {
  stt: { label: 'STT', what: 'verbatim transcript of a delegate\'s recorded take (audio in)', used_by: 'src/lib/command/stt.ts' },
  followups: { label: 'FOLLOW-UPS', what: 'the next question to ask a delegate after an answer', used_by: 'src/lib/command/followups.ts' },
  parser: { label: 'PARSER', what: 'stringer: transcripts -> cited evidence + answers', used_by: 'src/lib/command/stringer.ts' },
  leads: { label: 'LEADS', what: 'research lead miner (feed items -> scored leads)', used_by: 'src/lib/command/leads.ts' },
  rank: { label: 'RANK', what: 'producer: score stories for show value', used_by: 'src/lib/command/producer.ts' },
}
const LITE: ModelRef = { provider: 'openrouter', id: 'google/gemini-2.5-flash-lite' }
export const DEFAULTS: Record<Role, ModelRef> = {
  stt: { provider: 'openrouter', id: 'google/gemini-2.5-flash' },   // audio input; flash-lite has no audio in
  followups: LITE, parser: LITE, leads: LITE, rank: LITE,
}
export const FLOOR_PROVIDERS = ['openrouter', 'ollama'] as const
export type FloorProvider = typeof FLOOR_PROVIDERS[number]
export const DEFAULT_FLOOR_PROVIDER: FloorProvider = 'openrouter'
export const PROVIDERS = ['openrouter', 'cupcake', 'perplexity'] as const

const ROOT = () => process.cwd()
export function modelsFile(): string { return path.join(process.env.TSG_SETTINGS_DIR || path.join(ROOT(), 'lab', 'settings'), 'models.json') }
const readJson = (file: string): any => { try { const o = JSON.parse(fs.readFileSync(file, 'utf8')); return o && typeof o === 'object' ? o : {} } catch { return {} } }
function writeJson(file: string, obj: any) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file + '.tmp', JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(file + '.tmp', file)
}
const isRef = (x: any): x is ModelRef => !!x && typeof x === 'object' && typeof x.provider === 'string' && !!x.provider.trim() && typeof x.id === 'string' && !!x.id.trim()

export function loadModels(): { roles: Partial<Record<Role, ModelRef>>; floor_provider?: FloorProvider } {
  const raw = readJson(modelsFile())
  const roles: Partial<Record<Role, ModelRef>> = {}
  for (const r of ROLES) { const v = raw.roles?.[r]; if (isRef(v)) roles[r] = { provider: v.provider.trim(), id: v.id.trim() } }
  const fp = raw.roles?.floor_provider ?? raw.floor_provider
  return { roles, ...(FLOOR_PROVIDERS.includes(fp) ? { floor_provider: fp } : {}) }
}
/** The model for a role: the file's choice, else the lineup default. Read live (no module cache) so a save is immediate. */
export function modelFor(role: Role): ResolvedModel {
  const f = loadModels().roles[role]
  return f ? { ...f, source: 'file' } : { ...DEFAULTS[role], source: 'default' }
}
export function setModel(role: Role, provider: string, id: string): ResolvedModel {
  if (!ROLES.includes(role)) throw new Error('unknown role')
  const p = String(provider || '').trim().toLowerCase(), m = String(id || '').trim()
  if (!p || !/^[a-z0-9_-]{2,32}$/.test(p)) throw new Error('provider should be a short slug (openrouter, cupcake, perplexity)')
  if (!m || m.length > 120 || /\s/.test(m)) throw new Error('model id is one token like vendor/model')
  const raw = readJson(modelsFile()); raw.roles = raw.roles && typeof raw.roles === 'object' ? raw.roles : {}
  raw.roles[role] = { provider: p, id: m }
  writeJson(modelsFile(), raw)
  return modelFor(role)
}
/** Reset a role to the lineup default (drops it from the file). */
export function resetModel(role: Role): ResolvedModel {
  const raw = readJson(modelsFile()); if (raw.roles && typeof raw.roles === 'object') delete raw.roles[role]
  writeJson(modelsFile(), raw)
  return modelFor(role)
}
export function floorProvider(): { value: FloorProvider; source: 'file' | 'default' } {
  const f = loadModels().floor_provider
  return f ? { value: f, source: 'file' } : { value: DEFAULT_FLOOR_PROVIDER, source: 'default' }
}
export function setFloorProvider(p: string): { value: FloorProvider; source: 'file' | 'default' } {
  if (!FLOOR_PROVIDERS.includes(p as FloorProvider)) throw new Error('floor_provider must be one of ' + FLOOR_PROVIDERS.join(' | '))
  const raw = readJson(modelsFile()); raw.roles = raw.roles && typeof raw.roles === 'object' ? raw.roles : {}
  raw.roles.floor_provider = p
  writeJson(modelsFile(), raw)
  return floorProvider()
}

export type RosterEntry = { id: string; provider: string; attribute?: string; quirk?: string; cost_per_turn?: string; speed_s?: number | null; context_tokens?: number; best_for?: string[]; uncensored?: boolean }
/** lab/models.json — the tested Model-DNA roster (ids, attribute, cost/turn) for the dropdowns. */
export function roster(): RosterEntry[] {
  const raw = readJson(path.join(ROOT(), 'lab', 'models.json'))
  const models = Array.isArray(raw.models) ? raw.models : []
  const out: RosterEntry[] = models.filter((m: any) => m && typeof m.id === 'string').map((m: any) => ({
    id: m.id, provider: String(m.provider || 'openrouter').split(/\s*\+\s*/)[0], attribute: m.attribute, quirk: m.quirk,
    cost_per_turn: m.cost_per_turn, speed_s: m.speed_s ?? null, context_tokens: m.context_tokens, best_for: m.best_for, uncensored: m.uncensored,
  }))
  // the lineup's utility models belong on the list even when the DNA roster (hosts) never tested them
  const seen = new Set(out.map(m => m.id))
  for (const r of ROLES) { const d = DEFAULTS[r]; if (!seen.has(d.id)) { seen.add(d.id); out.push({ id: d.id, provider: d.provider, attribute: r === 'stt' ? 'The Ear (audio in)' : 'lineup default', cost_per_turn: r === 'stt' ? '~$0.0003/min' : undefined }) } }
  return out
}

export type CastModel = { id: string; name: string; provider: string; model: string; temperature?: number }
/** Read-only view of what cast.json locks: the showrunner (producer) + each host's engine. */
export function castModels(): { showrunner: (ModelRef & { temperature?: number }) | null; hosts: CastModel[] } {
  const cast = readJson(path.join(ROOT(), 'lab', 'cast', 'cast.json'))
  const p = cast.producer?.model, pt = cast.producer?.model?.temperature
  const showrunner = isRef(p) ? { provider: p.provider, id: p.id, ...(typeof pt === 'number' ? { temperature: pt } : {}) } : null
  const hosts: CastModel[] = (Array.isArray(cast.hosts) ? cast.hosts : []).filter((h: any) => h && h.id).map((h: any) => ({
    id: String(h.id), name: String(h.name || h.id), provider: String(h.model?.provider || '?'),
    model: String(h.model?.dna_id || h.model?.id || '?'), ...(typeof h.model?.temperature === 'number' ? { temperature: h.model.temperature } : {}),
  }))
  return { showrunner, hosts }
}

export type RoleReport = { role: Role; label: string; what: string; used_by: string; provider: string; id: string; source: 'file' | 'default'; default: ModelRef; overridden_by: string | null }
/** Everything the MODELS card needs in one read. */
export function modelsReport() {
  const cfg = readJson(path.join(ROOT(), 'lab', 'research', 'config.json'))
  const cfgModel: Partial<Record<Role, string | undefined>> = { parser: cfg.parser?.model, leads: cfg.leads?.model, rank: cfg.producer?.model }
  const cfgKey: Partial<Record<Role, string>> = { parser: 'parser.model', leads: 'leads.model', rank: 'producer.model' }
  const roles: RoleReport[] = ROLES.map(role => {
    const m = modelFor(role)
    const o = cfgModel[role]
    return { role, ...ROLE_INFO[role], provider: m.provider, id: m.id, source: m.source, default: DEFAULTS[role], overridden_by: o && o !== m.id ? `lab/research/config.json ${cfgKey[role]} = ${o}` : null }
  })
  return { roles, floor_provider: floorProvider(), floor_providers: FLOOR_PROVIDERS, providers: PROVIDERS, roster: roster(), cast: castModels(), file: path.relative(ROOT(), modelsFile()).replace(/\\/g, '/') }
}
