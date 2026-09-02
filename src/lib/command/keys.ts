// SETTINGS KEYS — the in-app key store that makes TalkShowGo distributable: the owner pastes a key in the
// SETTINGS page instead of editing .env. LAWS: (1) an environment variable ALWAYS overrides the file;
// (2) the file is lab/settings/keys.json (gitignored), written 0600 where the OS allows; (3) nothing in
// here ever returns, logs, or echoes a key — responses carry a masked tail (`sk-or-…85f`) only;
// (4) src/instrumentation.ts hydrates process.env from the file at boot, so every existing
// `process.env.X` read in the app picks up in-app keys with zero edits elsewhere.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

export type KeyName =
  | 'OPENROUTER_API_KEY' | 'TWITTERAPI_IO_KEY' | 'PERPLEXITY_API_KEY' | 'CUPCAKE_GATEWAY_KEY' | 'BREEZE_API_KEY'
  | 'TWILIO_ACCOUNT_SID' | 'TWILIO_AUTH_TOKEN' | 'TWILIO_FROM' | 'ELEVENLABS_API_KEY' | 'RESEND_API_KEY' | 'ASSEMBLYAI_API_KEY'
  | 'YTDLP_PATH' | 'FFMPEG_PATH'
export type VerifyKind = 'openrouter' | 'twitterapi' | 'perplexity' | 'cupcake' | 'twilio' | 'twilio_from' | 'elevenlabs' | 'resend' | 'assemblyai' | 'exe' | 'none'
export type FeatureId = 'pull' | 'shows' | 'briefing' | 'stringer' | 'phone' | 'email'
export type KeySource = 'env' | 'settings' | null
export type KeyDef = {
  name: KeyName
  label: string          // the service, as a human says it
  service: string        // what it unlocks in TalkShowGo
  url?: string           // where to get one
  required_for: FeatureId[]
  optional: boolean      // optional = the app runs without it (an alternate engine, a nice-to-have)
  secret: boolean        // false = a path / a phone number: shown in full, plain input
  verify: VerifyKind
  hint?: string
  placeholder?: string
}
export type VerifyResult = { ok: boolean; detail: string; at: string }
export type KeyRow = {
  name: KeyName; label: string; service: string; url?: string; hint?: string; placeholder?: string
  optional: boolean; secret: boolean; required_for: FeatureId[]
  set: boolean; source: KeySource; display: string; env_overrides: boolean; last_verify: VerifyResult | null
}
export type Feature = { id: FeatureId; label: string; needs: string; ready: boolean; missing: KeyName[]; note?: string }

export const KEYS: KeyDef[] = [
  { name: 'OPENROUTER_API_KEY', label: 'OpenRouter', service: 'every LLM role (showrunner, hosts, parser, leads, rank) + the delegate STT', url: 'https://openrouter.ai/keys', required_for: ['shows', 'stringer'], optional: false, secret: true, verify: 'openrouter', placeholder: 'sk-or-v1-…' },
  { name: 'TWITTERAPI_IO_KEY', label: 'twitterapi.io', service: 'X pulls, handle verify, scout (not the official X API)', url: 'https://twitterapi.io', required_for: ['pull'], optional: false, secret: true, verify: 'twitterapi' },
  { name: 'PERPLEXITY_API_KEY', label: 'Perplexity', service: 'THE BRIEFING (Sonar, native web)', url: 'https://www.perplexity.ai/settings/api', required_for: ['briefing'], optional: false, secret: true, verify: 'perplexity', placeholder: 'pplx-…' },
  { name: 'CUPCAKE_GATEWAY_KEY', label: 'cupcake gateway', service: 'Breeze voices on the house box (self-hosted = prototype only, not for monetized shows)', required_for: ['shows'], optional: false, secret: true, verify: 'cupcake', hint: 'tenant Bearer for mk-gateway :8700 (CUPCAKE_GATEWAY_URL overrides the box address)' },
  { name: 'BREEZE_API_KEY', label: 'Breeze hosted', service: 'the commercial voice path: any PAID BreezeBlue plan clears monetized output (renderer wire-up queued)', url: 'https://docs.breezeblue.ai', required_for: [], optional: true, secret: true, verify: 'none', hint: 'no live check yet — saved as pasted' },
  { name: 'TWILIO_ACCOUNT_SID', label: 'Twilio · Account SID', service: 'phone takes (call a delegate, record the answer)', url: 'https://console.twilio.com', required_for: ['phone'], optional: true, secret: true, verify: 'twilio', placeholder: 'AC…' },
  { name: 'TWILIO_AUTH_TOKEN', label: 'Twilio · Auth token', service: 'phone takes — pairs with the Account SID', url: 'https://console.twilio.com', required_for: ['phone'], optional: true, secret: true, verify: 'twilio' },
  { name: 'TWILIO_FROM', label: 'Twilio · From number', service: 'the number the show calls from (E.164)', required_for: ['phone'], optional: true, secret: false, verify: 'twilio_from', placeholder: '+15551234567' },
  { name: 'ELEVENLABS_API_KEY', label: 'ElevenLabs', service: 'optional alternate voice engine', url: 'https://elevenlabs.io/app/settings/api-keys', required_for: [], optional: true, secret: true, verify: 'elevenlabs' },
  { name: 'RESEND_API_KEY', label: 'Resend', service: 'email takes (send a delegate the question, get the answer back)', url: 'https://resend.com/api-keys', required_for: ['email'], optional: true, secret: true, verify: 'resend', placeholder: 're_…' },
  { name: 'ASSEMBLYAI_API_KEY', label: 'AssemblyAI', service: 'optional alternate STT for takes', url: 'https://www.assemblyai.com/app', required_for: [], optional: true, secret: true, verify: 'assemblyai' },
  { name: 'YTDLP_PATH', label: 'yt-dlp', service: 'YouTube transcripts for the stringer (path to the executable)', url: 'https://github.com/yt-dlp/yt-dlp', required_for: ['stringer'], optional: true, secret: false, verify: 'exe', hint: 'leave empty to use the bundled default path or yt-dlp on PATH', placeholder: 'C:/…/yt-dlp.exe' },
  { name: 'FFMPEG_PATH', label: 'ffmpeg', service: 'take audio -> 24kHz wav for STT and voice refs (path to the executable)', url: 'https://ffmpeg.org/download.html', required_for: ['stringer'], optional: true, secret: false, verify: 'exe', hint: 'leave empty to use ffmpeg on PATH', placeholder: 'C:/…/ffmpeg.exe' },
]
export const KEY_NAMES: KeyName[] = KEYS.map(k => k.name)
export const keyDef = (name: string): KeyDef | undefined => KEYS.find(k => k.name === name)

// ---------- storage ----------
const HYDRATED_VAR = 'TSG_KEYS_FROM_SETTINGS'   // names (comma list) that process.env holds FROM the file, so source stays honest
export function settingsDir(): string { return process.env.TSG_SETTINGS_DIR || path.join(process.cwd(), 'lab', 'settings') }
export function settingsFile(): string { return path.join(settingsDir(), 'keys.json') }
const verifyFile = () => path.join(settingsDir(), 'verify.json')

function readJson(file: string): Record<string, any> {
  try { const o = JSON.parse(fs.readFileSync(file, 'utf8')); return o && typeof o === 'object' && !Array.isArray(o) ? o : {} } catch { return {} }
}
/** Atomic + private: tmp -> rename, 0600 where the OS honors it (Windows ignores mode bits; the dir is the owner's). */
function writeJson(file: string, obj: Record<string, any>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', { mode: 0o600 })
  fs.renameSync(tmp, file)
  try { fs.chmodSync(file, 0o600) } catch { /* not every FS can */ }
}
export function loadSettings(): Partial<Record<KeyName, string>> {
  const raw = readJson(settingsFile())
  const out: Partial<Record<KeyName, string>> = {}
  for (const n of KEY_NAMES) if (typeof raw[n] === 'string' && raw[n].trim()) out[n] = raw[n].trim()
  return out
}
const hydratedSet = () => new Set((process.env[HYDRATED_VAR] || '').split(',').filter(Boolean))
function markHydrated(name: KeyName, on: boolean) {
  const s = hydratedSet(); if (on) s.add(name); else s.delete(name)
  process.env[HYDRATED_VAR] = Array.from(s).join(',')
}
const envValue = (name: string) => { const v = process.env[name]; return v && v.trim() ? v.trim() : null }

// ---------- the API ----------
/** env (a real variable, or one hydrated from the file at boot) > lab/settings/keys.json > null */
export function getKey(name: KeyName): string | null {
  return envValue(name) ?? loadSettings()[name] ?? null
}
/** Where the live value comes from. A value hydrated from the file reports 'settings', never 'env'. */
export function keySource(name: KeyName): KeySource {
  const e = envValue(name), hydrated = hydratedSet().has(name)
  if (e && !hydrated) return 'env'
  if (loadSettings()[name]) return 'settings'
  return e ? 'settings' : null
}
/** Save to the file. Hydrates process.env when no REAL env var exists (so the running app uses it now). */
export function saveKey(name: KeyName, value: string): { name: KeyName; source: KeySource; env_overrides: boolean } {
  const def = keyDef(name); if (!def) throw new Error('unknown key: ' + String(name).slice(0, 40))
  const v = String(value ?? '').trim()
  if (!v) throw new Error('empty value')
  if (/[\r\n]/.test(v)) throw new Error('a key is one line')
  if (v.length > 4096) throw new Error('value too long')
  const all = readJson(settingsFile()); all[name] = v; writeJson(settingsFile(), all)
  const real = !!envValue(name) && !hydratedSet().has(name)
  if (!real) { process.env[name] = v; markHydrated(name, true) }
  clearVerify(name)
  return { name, source: keySource(name), env_overrides: real }
}
/** Remove the app copy. A real env var is untouched (and keeps winning). */
export function deleteKey(name: KeyName): { name: KeyName; source: KeySource } {
  if (!keyDef(name)) throw new Error('unknown key')
  const all = readJson(settingsFile()); delete all[name]; writeJson(settingsFile(), all)
  if (hydratedSet().has(name)) { delete process.env[name]; markHydrated(name, false) }
  clearVerify(name)
  return { name, source: keySource(name) }
}
/** Boot: every file key that env does not already hold -> process.env (bookkept). Returns the names. */
export function hydrateEnv(): KeyName[] {
  const file = loadSettings(); const out: KeyName[] = []
  for (const n of KEY_NAMES) {
    if (envValue(n)) continue
    const v = file[n]; if (!v) continue
    process.env[n] = v; markHydrated(n, true); out.push(n)
  }
  return out
}
/** first 6 + … + last 3 for a real key; shorter values degrade so a short secret is never mostly shown. */
export function mask(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return ''
  if (s.length >= 16) return s.slice(0, 6) + '…' + s.slice(-3)
  if (s.length >= 10) return s.slice(0, 3) + '…' + s.slice(-2)
  return s.slice(0, 1) + '…'
}
const fingerprint = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 12)

// ---------- last verify (sidecar; keyed by a value fingerprint so a swapped key drops its stale result) ----------
export function lastVerify(name: KeyName): VerifyResult | null {
  const v = getKey(name); if (!v) return null
  const r = readJson(verifyFile())[name]
  if (!r || r.fp !== fingerprint(v)) return null
  return { ok: !!r.ok, detail: String(r.detail || ''), at: String(r.at || '') }
}
function rememberVerify(name: KeyName, value: string, r: VerifyResult) {
  const all = readJson(verifyFile()); all[name] = { ...r, fp: fingerprint(value) }; writeJson(verifyFile(), all)
}
/** Attach a verify result to the value that is configured NOW (the route calls this right after a save). */
export function recordVerify(name: KeyName, r: VerifyResult): void {
  const v = getKey(name); if (!v) return
  try { rememberVerify(name, v, r) } catch { /* sidecar is best-effort */ }
}
function clearVerify(name: KeyName) { const all = readJson(verifyFile()); if (name in all) { delete all[name]; writeJson(verifyFile(), all) } }

// ---------- rows + features (what the SETTINGS page shows) ----------
export function describeKeys(): KeyRow[] {
  return KEYS.map(d => {
    const v = getKey(d.name), source = keySource(d.name)
    return {
      name: d.name, label: d.label, service: d.service, url: d.url, hint: d.hint, placeholder: d.placeholder,
      optional: d.optional, secret: d.secret, required_for: d.required_for,
      set: !!v, source, display: v ? (d.secret ? mask(v) : v) : '',
      env_overrides: source === 'env' && !!loadSettings()[d.name],
      last_verify: v ? lastVerify(d.name) : null,
    }
  })
}

const DEFAULT_YTDLP = 'C:/Users/taskm/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe'
let whichCache: { at: number; map: Record<string, boolean> } = { at: 0, map: {} }
/** Is `exe` reachable: an explicit path that exists, or a bare name found on PATH (stat-scan, cached 60s). */
export function toolAvailable(configured: string | null, bare: string): boolean {
  if (configured) return fs.existsSync(configured)
  if (Date.now() - whichCache.at > 60_000) whichCache = { at: Date.now(), map: {} }
  if (bare in whichCache.map) return whichCache.map[bare]
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  const found = (process.env.PATH || '').split(path.delimiter).filter(Boolean).some(dir => exts.some(x => { try { return fs.existsSync(path.join(dir, bare + x)) } catch { return false } }))
  whichCache.map[bare] = found
  return found
}
export function features(): Feature[] {
  const has = (n: KeyName) => !!getKey(n)
  const miss = (...ns: KeyName[]) => ns.filter(n => !has(n))
  const ytdlp = toolAvailable(getKey('YTDLP_PATH') || (fs.existsSync(DEFAULT_YTDLP) ? DEFAULT_YTDLP : null), 'yt-dlp')
  const ffmpeg = toolAvailable(getKey('FFMPEG_PATH'), 'ffmpeg')
  const voice = has('CUPCAKE_GATEWAY_KEY') || has('BREEZE_API_KEY')
  return [
    { id: 'pull', label: 'PULL', needs: 'twitterapi.io', ready: has('TWITTERAPI_IO_KEY'), missing: miss('TWITTERAPI_IO_KEY'), note: 'YouTube rides the channel RSS — no key' },
    { id: 'shows', label: 'SHOWS', needs: 'OpenRouter + cupcake gateway (or a hosted Breeze plan)', ready: has('OPENROUTER_API_KEY') && voice, missing: [...miss('OPENROUTER_API_KEY'), ...(voice ? [] : ['CUPCAKE_GATEWAY_KEY' as KeyName])], note: 'self-hosted Breeze = prototype; a paid hosted plan clears monetized shows' },
    { id: 'briefing', label: 'BRIEFING', needs: 'Perplexity', ready: has('PERPLEXITY_API_KEY'), missing: miss('PERPLEXITY_API_KEY') },
    { id: 'stringer', label: 'STRINGER + TAKES', needs: 'OpenRouter + yt-dlp + ffmpeg', ready: has('OPENROUTER_API_KEY') && ytdlp && ffmpeg, missing: [...miss('OPENROUTER_API_KEY'), ...(ytdlp ? [] : ['YTDLP_PATH' as KeyName]), ...(ffmpeg ? [] : ['FFMPEG_PATH' as KeyName])], note: ytdlp && ffmpeg ? 'yt-dlp + ffmpeg found' : 'a tool path is missing — set it below or put it on PATH' },
    { id: 'phone', label: 'PHONE TAKES', needs: 'Twilio (SID + token + from number)', ready: has('TWILIO_ACCOUNT_SID') && has('TWILIO_AUTH_TOKEN') && has('TWILIO_FROM'), missing: miss('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM') },
    { id: 'email', label: 'EMAIL TAKES', needs: 'Resend', ready: has('RESEND_API_KEY'), missing: miss('RESEND_API_KEY') },
  ]
}

// ---------- verify (per service; returns { ok, detail } and NEVER the key) ----------
const clip = (s: unknown, n = 140) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
/** Belt and braces: if a provider ever echoes the credential (or a longer masked form of it, as OpenRouter's
 *  auto-label does: `sk-or-v1-abc...85f`) back, it leaves here as OUR mask only. */
const KEYISH = /\b(?:sk|pplx|re|cpk|xi|AC)[-_][A-Za-z0-9._-]*(?:\.\.\.|…)[A-Za-z0-9]*|\b(?:sk-or|sk-ant|sk-proj|pplx|cpk)[-_][A-Za-z0-9._-]{8,}/g
const scrub = (text: string, value: string) => (value.length >= 8 ? text.split(value).join(mask(value)) : text).replace(KEYISH, mask(value) || '…')
const money = (n: unknown) => (typeof n === 'number' && Number.isFinite(n)) ? '$' + (n < 1 ? n.toFixed(3) : n.toFixed(2)) : null

async function http(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; ok: boolean; json: any; text: string; err?: string }> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 12000) })
    const text = await r.text().catch(() => '')
    let json: any = null; try { json = JSON.parse(text) } catch { /* not json */ }
    return { status: r.status, ok: r.ok, json, text }
  } catch (e: any) {
    const m = String(e?.name === 'TimeoutError' ? 'timed out' : (e?.cause?.message || e?.message || e))
    return { status: 0, ok: false, json: null, text: '', err: m }
  }
}
const apiMsg = (r: { status: number; json: any; text: string; err?: string }) => r.err ? 'unreachable: ' + clip(r.err, 80) : `http ${r.status}` + (r.json?.error?.message || r.json?.message || r.json?.error || r.json?.detail ? ' · ' + clip(r.json?.error?.message || r.json?.message || (typeof r.json?.error === 'string' ? r.json.error : '') || r.json?.detail, 100) : '')

export const CUPCAKE_GATEWAY_URL = () => process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'

async function verifyWith(kind: VerifyKind, name: KeyName, value: string): Promise<{ ok: boolean; detail: string }> {
  switch (kind) {
    case 'openrouter': {
      const r = await http('https://openrouter.ai/api/v1/auth/key', { headers: { Authorization: 'Bearer ' + value } })
      if (!r.ok) return { ok: false, detail: apiMsg(r) }
      const d = r.json?.data || {}
      // OpenRouter labels a key with a masked copy of itself unless the owner renamed it — never show that form
      const label = typeof d.label === 'string' && d.label.trim() && !/^sk[-_]/i.test(d.label.trim()) ? clip(d.label.trim(), 40) : null
      const parts = [label ? `"${label}"` : 'key accepted', d.limit == null ? 'no spend limit' : `${money(d.usage) || '$0'} used of ${money(d.limit)}`, d.is_free_tier ? 'free tier' : null].filter(Boolean)
      return { ok: true, detail: parts.join(' · ') }
    }
    case 'twitterapi': {
      const r = await http('https://api.twitterapi.io/twitter/user/info?userName=urltv', { headers: { 'X-API-Key': value } })
      if (!r.ok) return { ok: false, detail: apiMsg(r) }
      const u = r.json?.data || r.json?.user || {}
      const who = u.userName || u.screen_name || u.name
      return { ok: true, detail: who ? `resolved @${who}` + (u.followers != null ? ` · ${Number(u.followers).toLocaleString()} followers` : '') : 'http 200' }
    }
    case 'perplexity': {
      const r = await http('https://api.perplexity.ai/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + value, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'sonar', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }), timeoutMs: 20000 })
      // Perplexity answers 401 with a quota message when the key is fine but the account has no credit left
      if (!r.ok && /quota|billing|credit/i.test(r.json?.error?.message || r.text)) return { ok: false, detail: 'out of credits — the key authenticates, but Perplexity refuses calls until the account is topped up' }
      if (!r.ok) return { ok: false, detail: apiMsg(r) }
      return { ok: true, detail: `sonar answered · ${r.json?.usage?.total_tokens ?? '?'} tokens` }
    }
    case 'cupcake': {
      const base = CUPCAKE_GATEWAY_URL().replace(/\/$/, '')
      const r = await http(base + '/v1/jobs?limit=1', { headers: { Authorization: 'Bearer ' + value }, timeoutMs: 8000 })
      if (!r.ok) return { ok: false, detail: apiMsg(r) + (r.status === 401 ? ' (the gateway rejected this tenant key)' : '') }
      const h = await http(base + '/v1/health', { timeoutMs: 5000 })
      const box = h.ok ? `box ${h.json?.running ? 'RENDERING' : 'idle'} · queue ${h.json?.queue_depth ?? '?'} · disk ${h.json?.disk_pct ?? '?'}%` : 'health unreachable'
      return { ok: true, detail: `tenant accepted · ${box}` }
    }
    case 'twilio': {
      const sid = name === 'TWILIO_ACCOUNT_SID' ? value : getKey('TWILIO_ACCOUNT_SID')
      const tok = name === 'TWILIO_AUTH_TOKEN' ? value : getKey('TWILIO_AUTH_TOKEN')
      if (!sid || !tok) return { ok: false, detail: `needs both the Account SID and the Auth token (${!sid ? 'SID' : 'token'} not set yet)` }
      if (!/^AC[0-9a-f]{32}$/i.test(sid)) return { ok: false, detail: 'Account SID should look like AC + 32 hex chars' }
      const r = await http(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + tok).toString('base64') } })
      if (!r.ok) return { ok: false, detail: apiMsg(r) }
      return { ok: true, detail: `${clip(r.json?.friendly_name, 40) || 'account'} · ${r.json?.status || '?'} · ${r.json?.type || ''}`.trim() }
    }
    case 'twilio_from': {
      if (!/^\+[1-9]\d{6,14}$/.test(value)) return { ok: false, detail: 'use E.164: + country code + number, digits only (e.g. +15551234567)' }
      const sid = getKey('TWILIO_ACCOUNT_SID'), tok = getKey('TWILIO_AUTH_TOKEN')
      if (!sid || !tok) return { ok: true, detail: 'format ok · ownership check needs the SID + token' }
      const r = await http(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(value)}`, { headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + tok).toString('base64') } })
      if (!r.ok) return { ok: true, detail: 'format ok · ownership check failed: ' + apiMsg(r) }
      const n = (r.json?.incoming_phone_numbers || []).length
      return { ok: true, detail: n ? `format ok · owned by this account (${clip(r.json.incoming_phone_numbers[0]?.friendly_name, 30)})` : 'format ok · NOT among this account\'s numbers (a verified caller ID still works for outbound)' }
    }
    case 'elevenlabs': {
      const r = await http('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': value } })
      if (!r.ok) return { ok: false, detail: apiMsg(r) }
      const s = r.json?.subscription || {}
      return { ok: true, detail: [s.tier ? `tier ${s.tier}` : null, s.character_limit ? `${Number(s.character_count || 0).toLocaleString()} / ${Number(s.character_limit).toLocaleString()} chars` : null].filter(Boolean).join(' · ') || 'http 200' }
    }
    case 'resend': {
      const r = await http('https://api.resend.com/domains', { headers: { Authorization: 'Bearer ' + value } })
      if (!r.ok) return { ok: false, detail: apiMsg(r) }
      const doms = r.json?.data || []
      return { ok: true, detail: doms.length ? `${doms.length} domain${doms.length === 1 ? '' : 's'}: ${doms.slice(0, 3).map((d: any) => `${d.name} (${d.status})`).join(', ')}` : 'accepted · no sending domain yet (add one at resend.com)' }
    }
    case 'assemblyai': {
      const r = await http('https://api.assemblyai.com/v2/transcript?limit=1', { headers: { authorization: value } })
      if (!r.ok) return { ok: false, detail: apiMsg(r) }
      return { ok: true, detail: 'accepted' }
    }
    case 'exe': {
      try {
        const out = execFileSync(value, ['--version'], { timeout: 10000, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
        const line = String(out || '').split('\n').map(s => s.trim()).find(Boolean) || 'ran (no version text)'
        return { ok: true, detail: clip(line, 90) }
      } catch (e: any) {
        const m = e?.code === 'ENOENT' ? 'not found at that path (or not on PATH)' : e?.killed ? 'timed out after 10s' : clip(e?.stderr || e?.message || e, 100)
        return { ok: false, detail: m }
      }
    }
    case 'none':
      return { ok: true, detail: 'saved as pasted — no live check for this service yet' }
  }
}

/** Verify a candidate value (or what is currently configured). Persists the result for the row; never returns the key. */
export async function verifyKey(name: KeyName, value?: string | null): Promise<VerifyResult> {
  const def = keyDef(name); if (!def) throw new Error('unknown key')
  const v = (value == null ? getKey(name) : String(value).trim()) || ''
  const at = new Date().toISOString()
  if (!v) return { ok: false, detail: 'nothing configured', at }
  let res: { ok: boolean; detail: string }
  try { res = await verifyWith(def.verify, name, v) } catch (e: any) { res = { ok: false, detail: clip(e?.message || e, 120) } }
  const out: VerifyResult = { ok: res.ok, detail: scrub(res.detail, v), at }
  // remember only when this IS the configured value (a candidate that never got saved leaves no trace)
  if (value == null || getKey(name) === v) { try { rememberVerify(name, v, out) } catch { /* sidecar is best-effort */ } }
  return out
}
