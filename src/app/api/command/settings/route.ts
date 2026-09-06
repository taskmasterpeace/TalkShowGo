// SETTINGS API — in-app API keys + the model lineup. Keys live in lab/settings/keys.json (gitignored;
// env vars always win); models in lab/settings/models.json. LAW: no response and no log line ever
// carries a key — rows carry a masked tail only, and the activity log carries names + outcomes.
//   GET                      -> { keys[], features[], settings_file, ... }
//   GET ?models=1            -> { roles[], floor_provider, roster[], cast{showrunner,hosts} }
//   POST { name, value, force? } -> verify first; a failing key is REFUSED (422) unless force
//   POST { name, verify: true }  -> verify what is configured now
//   POST { role, provider, id } | { role, reset: true } | { floor_provider }
//   DELETE { name }          -> remove the app copy (an env var, if any, keeps winning)
import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { keyDef, describeKeys, features, saveKey, deleteKey, verifyKey, recordVerify, settingsFile, type KeyName } from '@/lib/command/keys'
import { modelsReport, setModel, resetModel, setFloorProvider, ROLES, type Role } from '@/lib/command/models-config'
import { appendLog, type LogKind } from '@/lib/command/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// the LOG page lists every kind it meets in the file, so a new kind needs no edit to log.ts (another workstream's file)
const KIND: LogKind = 'settings'
const row = (name: KeyName) => describeKeys().find(k => k.name === name) || null
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

function keysPayload() {
  return {
    ok: true,
    keys: describeKeys(),
    features: features(),
    settings_file: 'lab/settings/keys.json',
    settings_file_exists: fs.existsSync(settingsFile()),
    env_file_exists: fs.existsSync(path.join(process.cwd(), '.env')),
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('models')) return NextResponse.json({ ok: true, ...modelsReport() })
  return NextResponse.json(keysPayload())
}

export async function POST(req: Request) {
  const body: any = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return bad('json body required')

  // ---- models ----
  if (body.role !== undefined) {
    const role = String(body.role) as Role
    if (!ROLES.includes(role)) return bad('unknown role (' + ROLES.join(' | ') + ')')
    try {
      const m = body.reset ? resetModel(role) : setModel(role, String(body.provider || ''), String(body.id || ''))
      appendLog({ kind: KIND, stage: 'model', ok: true, ref: role, summary: `${role} -> ${m.provider}/${m.id}${body.reset ? ' (reset to lineup default)' : ''}` })
      return NextResponse.json({ ok: true, role, model: m, ...modelsReport() })
    } catch (e: any) { return bad(String(e?.message || e)) }
  }
  if (body.floor_provider !== undefined) {
    try {
      const fp = setFloorProvider(String(body.floor_provider))
      appendLog({ kind: KIND, stage: 'model', ok: true, ref: 'floor_provider', summary: `floor_provider -> ${fp.value}` })
      return NextResponse.json({ ok: true, ...modelsReport() })
    } catch (e: any) { return bad(String(e?.message || e)) }
  }

  // ---- keys ----
  const name = String(body.name || '') as KeyName
  const def = keyDef(name)
  if (!def) return bad('unknown key')

  if (body.verify === true) {
    const t0 = Date.now()
    const v = await verifyKey(name)
    appendLog({ kind: KIND, stage: 'verify', ok: v.ok, ref: name, ms: Date.now() - t0, summary: `${def.label}: ${v.ok ? 'verified' : 'FAILED'} · ${v.detail}`, error: v.ok ? null : v.detail })
    return NextResponse.json({ ok: v.ok, verify: v, key: row(name) })
  }

  if (typeof body.value === 'string') {
    const value = body.value.trim()
    if (!value) return bad('empty value')
    if (/[\r\n]/.test(value)) return bad('a key is one line')
    const t0 = Date.now()
    const v = await verifyKey(name, value)
    if (!v.ok && !body.force) {
      appendLog({ kind: KIND, stage: 'refused', ok: false, ref: name, ms: Date.now() - t0, summary: `${def.label}: new value refused (verify failed)`, error: v.detail })
      return NextResponse.json({ ok: false, refused: true, verify: v, error: 'verify failed: ' + v.detail }, { status: 422 })
    }
    let saved
    try { saved = saveKey(name, value) } catch (e: any) { return bad(String(e?.message || e)) }
    // the verify above ran on the candidate; now that it IS the configured value (unless env overrides), keep it on the row
    if (!saved.env_overrides) recordVerify(name, v)
    appendLog({ kind: KIND, stage: 'save', ok: true, ref: name, ms: Date.now() - t0, summary: `${def.label}: saved to app settings${v.ok ? ' (verified)' : ' (FORCED, verify failed)'}${saved.env_overrides ? ' — an env var still overrides it' : ''}`, meta: { source: saved.source, forced: !v.ok, env_overrides: saved.env_overrides } })
    return NextResponse.json({ ok: true, key: row(name), verify: v, forced: !v.ok, env_overrides: saved.env_overrides, features: features() })
  }

  return bad('send { name, value } to save, { name, verify: true } to verify, { role, provider, id } for a model')
}

export async function DELETE(req: Request) {
  const body: any = await req.json().catch(() => null)
  const name = String(body?.name || '') as KeyName
  const def = keyDef(name)
  if (!def) return bad('unknown key')
  try {
    const r = deleteKey(name)
    appendLog({ kind: KIND, stage: 'delete', ok: true, ref: name, summary: `${def.label}: app copy removed${r.source === 'env' ? ' (env var still set)' : ''}` })
    return NextResponse.json({ ok: true, key: row(name), features: features() })
  } catch (e: any) { return bad(String(e?.message || e)) }
}
