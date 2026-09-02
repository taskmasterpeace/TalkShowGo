'use client'
// SETTINGS — API keys + the model lineup, in the app (distributable: paste a key here, never edit .env).
// Reads/writes /api/command/settings. Keys: lab/settings/keys.json (gitignored) — env vars ALWAYS win, and
// a value shown here is a masked tail only. Models: lab/settings/models.json; hosts + showrunner are
// locked in cast.json and shown read-only.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, ShieldCheck, ShieldAlert, Cpu, RefreshCw, Trash2, Pencil, X, Eye, EyeOff, ExternalLink, Check } from 'lucide-react'
import { Flash, ago } from '../lib'

type KeyRow = {
  name: string; label: string; service: string; url?: string; hint?: string; placeholder?: string
  optional: boolean; secret: boolean; required_for: string[]
  set: boolean; source: 'env' | 'settings' | null; display: string; env_overrides: boolean
  last_verify: { ok: boolean; detail: string; at: string } | null
}
type Feature = { id: string; label: string; needs: string; ready: boolean; missing: string[]; note?: string }
type KeysPayload = { keys: KeyRow[]; features: Feature[]; settings_file: string; settings_file_exists: boolean; env_file_exists: boolean }
type RoleRow = { role: string; label: string; what: string; used_by: string; provider: string; id: string; source: 'file' | 'default'; default: { provider: string; id: string }; overridden_by: string | null }
type Roster = { id: string; provider: string; attribute?: string; cost_per_turn?: string; speed_s?: number | null; context_tokens?: number }
type ModelsPayload = { roles: RoleRow[]; floor_provider: { value: string; source: string }; floor_providers: string[]; providers: string[]; roster: Roster[]; cast: { showrunner: { provider: string; id: string; temperature?: number } | null; hosts: { id: string; name: string; provider: string; model: string; temperature?: number }[] }; file: string }

const CSS = `
.tsg-settings .key-card { border: 1px solid var(--cmd-line); background: var(--cmd-panel); padding: 14px; display: flex; flex-direction: column; gap: 8px; transition: border-color .15s, box-shadow .15s, transform .15s; }
.tsg-settings .key-card:hover { border-color: var(--cmd-line-hot); box-shadow: 0 8px 28px oklch(0 0 0 / 0.4); transform: translateY(-1px); }
.tsg-settings .key-card.is-set { border-left: 2px solid var(--cmd-green); }
.tsg-settings .key-card.is-missing { border-left: 2px solid var(--cmd-red); }
.tsg-settings .key-card.is-optional { border-left: 2px solid var(--cmd-line-hot); }
.tsg-settings .chip.app { border-color: var(--cmd-amber); color: var(--cmd-amber); }
.tsg-settings .chip.btn { cursor: pointer; background: transparent; font-family: inherit; transition: all .15s; }
.tsg-settings .chip.btn:hover { color: var(--cmd-ink); border-color: var(--cmd-ink); }
.tsg-settings .chip.btn.err:hover { color: var(--cmd-bg); background: var(--cmd-red); }
.tsg-settings .feature { border: 1px solid var(--cmd-line); background: var(--cmd-bg); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; min-width: 0; transition: border-color .15s, box-shadow .15s; }
.tsg-settings .feature:hover { border-color: var(--cmd-line-hot); box-shadow: 0 6px 20px oklch(0 0 0 / 0.35); }
.tsg-settings .feature.ready { border-color: oklch(0.72 0.19 148 / 0.45); }
.tsg-settings .mono-val { font-size: 12.5px; letter-spacing: 0.05em; color: var(--cmd-ink); word-break: break-all; }
.tsg-settings .vline { display: flex; align-items: center; gap: 6px; font-size: 11.5px; line-height: 1.4; }
.tsg-settings .modal-bg { position: fixed; inset: 0; z-index: 100; background: oklch(0 0 0 / 0.74); display: flex; align-items: center; justify-content: center; padding: 24px; backdrop-filter: blur(2px); }
.tsg-settings .modal { width: 100%; max-width: 580px; background: var(--cmd-panel2); border: 1px solid var(--cmd-line-hot); box-shadow: 0 30px 80px oklch(0 0 0 / 0.65); }
.tsg-settings .eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: 0; color: var(--cmd-dim); cursor: pointer; padding: 4px; display: flex; }
.tsg-settings .eye:hover { color: var(--cmd-amber); }
.tsg-settings .empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 34px 16px; text-align: center; border-bottom: 1px solid var(--cmd-line); }
.tsg-settings .empty .ring { width: 58px; height: 58px; border-radius: 999px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--cmd-amber); color: var(--cmd-amber); background: oklch(0.78 0.15 78 / 0.08); }
.tsg-settings .cast-row td { color: var(--cmd-dim); }
.tsg-settings a.doc { color: var(--cmd-cyan); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.tsg-settings a.doc:hover { color: var(--cmd-ink); }
.tsg-settings .iconbtn { display: inline-flex; align-items: center; gap: 6px; }
`

const post = async (body: any) => {
  const r = await fetch('/api/command/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({} as any))
  return { status: r.status, j }
}

export default function SettingsPage() {
  const [data, setData] = useState<KeysPayload | null>(null)
  const [models, setModels] = useState<ModelsPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<KeyRow | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<KeyRow | null>(null)
  const [custom, setCustom] = useState<Record<string, string>>({})   // role -> custom id being typed

  const reload = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([fetch('/api/command/settings', { cache: 'no-store' }), fetch('/api/command/settings?models=1', { cache: 'no-store' })])
      setData(await a.json()); setModels(await b.json()); setErr(null)
    } catch (e: any) { setErr(String(e?.message || e)) }
  }, [])
  useEffect(() => { reload() }, [reload])
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 1600) }

  const verify = async (k: KeyRow) => {
    setBusy('verify:' + k.name)
    try { const { j } = await post({ name: k.name, verify: true }); say(j.ok ? `${k.label.toUpperCase()} OK` : `${k.label.toUpperCase()} FAILED`) }
    finally { setBusy(null); reload() }
  }
  const remove = async (k: KeyRow) => {
    setBusy('remove:' + k.name); setConfirmRemove(null)
    try { await fetch('/api/command/settings', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: k.name }) }); say('REMOVED') }
    finally { setBusy(null); reload() }
  }
  const setRole = async (role: string, provider: string, id: string) => {
    setBusy('model:' + role)
    try { const { status, j } = await post({ role, provider, id }); if (status === 200) { setModels(j); say(`${role.toUpperCase()} SET`); setCustom(c => ({ ...c, [role]: '' })) } else say('ERR: ' + (j.error || status)) }
    finally { setBusy(null) }
  }
  const resetRole = async (role: string) => {
    setBusy('model:' + role)
    try { const { j } = await post({ role, reset: true }); setModels(j); say(`${role.toUpperCase()} RESET`) }
    finally { setBusy(null) }
  }
  const setFloor = async (v: string) => {
    setBusy('floor')
    try { const { j } = await post({ floor_provider: v }); setModels(j); say('FLOOR PROVIDER SET') }
    finally { setBusy(null) }
  }

  const byName = useMemo(() => Object.fromEntries((data?.keys || []).map(k => [k.name, k])), [data])
  const rosterById = useMemo(() => Object.fromEntries((models?.roster || []).map(r => [r.id, r])), [models])

  if (err) return <div className="p-8 cmd-kbd tsg-settings"><style>{CSS}</style><span className="chip err">SETTINGS UNREACHABLE: {err}</span></div>
  if (!data || !models) return <div className="p-8 cmd-kbd tsg-settings"><style>{CSS}</style>LOADING SETTINGS...</div>

  const keys = data.keys
  const anySet = keys.some(k => k.set)
  const ready = data.features.filter(f => f.ready).length
  const statusChip = (k: KeyRow) => k.set
    ? <span className="chip ok">SET</span>
    : k.optional ? <span className="chip">OPTIONAL</span> : <span className="chip err">MISSING</span>

  return (
    <div className="p-6 space-y-5 tsg-settings">
      <style>{CSS}</style>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>SETTINGS — KEYS &amp; MODELS</span>
        <Flash msg={flash} />
        <span className="cmd-kbd">PASTE A KEY HERE, NEVER EDIT .env · ENV VARS ALWAYS WIN · VALUES SHOW AS A MASKED TAIL ONLY</span>
      </div>

      {/* DISTRIBUTABLE CHECKLIST — which feature is ready given the keys present */}
      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>DISTRIBUTABLE CHECKLIST</h2></div>
          <span className={`chip ${ready === data.features.length ? 'ok' : ready ? 'warn' : 'err'}`}>{ready} / {data.features.length} READY</span>
        </div>
        <div className="p-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {data.features.map(f => (
            <div key={f.id} className={`feature ${f.ready ? 'ready' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`lamp ${f.ready ? 'on' : 'err'}`}><i />{f.label}</span>
                {f.ready ? <span className="chip ok"><Check size={10} strokeWidth={3} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />READY</span> : <span className="chip err">{f.missing.length} MISSING</span>}
              </div>
              <div className="cmd-kbd">needs {f.needs}</div>
              {!f.ready && (
                <div className="flex flex-wrap gap-1">
                  {f.missing.map(m => <button key={m} className="chip err btn" title={`add ${byName[m]?.label || m}`} onClick={() => byName[m] && setEditing(byName[m])}>+ {(byName[m]?.label || m).toUpperCase()}</button>)}
                </div>
              )}
              {f.note && <div className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>{f.note}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* KEYS */}
      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>API KEYS</h2></div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`chip ${data.env_file_exists ? 'info' : ''}`} title=".env at the project root — read by the app at boot; a key here beats the app copy">.env {data.env_file_exists ? 'PRESENT' : 'ABSENT'}</span>
            <span className={`chip ${data.settings_file_exists ? 'app' : ''}`} title="the app's own key file: gitignored, written 0600 where the OS allows">{data.settings_file} {data.settings_file_exists ? 'PRESENT' : 'NOT YET'}</span>
          </div>
        </div>
        {!anySet && (
          <div className="empty">
            <div className="ring"><KeyRound size={26} strokeWidth={2} /></div>
            <div className="cmd-display" style={{ fontSize: 18, letterSpacing: '0.08em' }}>NO KEYS YET</div>
            <div className="cmd-kbd" style={{ maxWidth: 460 }}>Paste your first key and it is verified against the service before it is saved. Start with OpenRouter — it runs every model role.</div>
            <button className="cmd-btn primary" onClick={() => byName.OPENROUTER_API_KEY && setEditing(byName.OPENROUTER_API_KEY)}>+ ADD OPENROUTER</button>
          </div>
        )}
        <div className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {keys.map(k => {
            const lv = k.last_verify
            const at = lv ? ago(lv.at) : null
            return (
              <div key={k.name} className={`key-card ${k.set ? 'is-set' : k.optional ? 'is-optional' : 'is-missing'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="cmd-display" style={{ fontSize: 15, letterSpacing: '0.08em' }}>{k.label.toUpperCase()}</div>
                    <div className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>{k.name}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {statusChip(k)}
                    {k.source === 'env' && <span className="chip info" title="from the environment (or .env) — overrides any app copy">ENV</span>}
                    {k.source === 'settings' && <span className="chip app" title="saved in the app (lab/settings/keys.json)">APP</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--cmd-dim)', lineHeight: 1.45 }}>{k.service}</div>
                <div className="flex items-center justify-between gap-2">
                  {k.set ? <span className="mono-val" title={k.secret ? 'masked: first 6 + last 3' : undefined}>{k.display}</span> : <span className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>— not set —</span>}
                  {k.url && <a className="doc cmd-kbd" href={k.url} target="_blank" rel="noreferrer" title="where to get one">get one <ExternalLink size={11} /></a>}
                </div>
                {k.env_overrides && <div className="vline" style={{ color: 'var(--cmd-amber)' }}><ShieldAlert size={13} /> an env var overrides the app copy</div>}
                {k.set && (lv
                  ? <div className="vline" style={{ color: lv.ok ? 'var(--cmd-green)' : 'var(--cmd-red)' }} title={lv.detail}>{lv.ok ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}<span className="truncate">{lv.detail}</span>{at && <span className="cmd-kbd shrink-0">· {at.text}</span>}</div>
                  : <div className="vline cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>not verified yet</div>)}
                {!k.set && k.hint && <div className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>{k.hint}</div>}
                <div className="flex items-center gap-2 mt-auto pt-1 flex-wrap">
                  {k.set && <button className="cmd-btn ghost iconbtn" disabled={busy !== null} onClick={() => verify(k)} title="check this key against the service now"><RefreshCw size={12} className={busy === 'verify:' + k.name ? 'animate-spin' : ''} />{busy === 'verify:' + k.name ? 'VERIFYING…' : 'VERIFY'}</button>}
                  <button className="cmd-btn ghost iconbtn" disabled={busy !== null} onClick={() => setEditing(k)}><Pencil size={12} />{k.set ? 'EDIT' : 'ADD'}</button>
                  {k.source === 'settings' && <button className="chip err btn ml-auto" disabled={busy !== null} onClick={() => setConfirmRemove(k)} title="remove the app copy"><Trash2 size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />REMOVE</button>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* MODELS */}
      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>MODELS — THE LINEUP</h2></div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="chip app" title="per-install choice, gitignored">{models.file}</span>
            <span className="cmd-kbd">HOSTS + SHOWRUNNER ARE LOCKED BUNDLES IN cast.json</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cmd-table">
            <thead><tr><th>ROLE</th><th>WHAT IT DOES</th><th>PROVIDER</th><th>MODEL</th><th>COST / TURN</th><th>SOURCE</th><th /></tr></thead>
            <tbody>
              {models.roles.map(r => {
                const ros = rosterById[r.id]
                const inRoster = !!ros
                const editingCustom = custom[r.role] !== undefined && custom[r.role] !== ''
                const k = 'model:' + r.role
                return (
                  <tr key={r.role}>
                    <td style={{ minWidth: 120 }}><div className="cmd-display" style={{ fontSize: 14, letterSpacing: '0.08em' }}><Cpu size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: -1, color: 'var(--cmd-amber)' }} />{r.label}</div><div className="cmd-kbd">{r.used_by.split('/').pop()}</div></td>
                    <td style={{ minWidth: 200, color: 'var(--cmd-dim)', fontSize: 12 }}>{r.what}{r.overridden_by && <div className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>overridden at this call site by {r.overridden_by}</div>}</td>
                    <td>
                      <select className="cmd-select" style={{ width: 'auto' }} value={r.provider} disabled={busy !== null} onChange={e => setRole(r.role, e.target.value, r.id)}>
                        {Array.from(new Set([...(models.providers || []), r.provider])).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 300 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select className="cmd-select" style={{ width: 'auto', maxWidth: 360 }} value={editingCustom ? '__custom__' : (inRoster ? r.id : '__custom__')} disabled={busy !== null}
                          onChange={e => { const v = e.target.value; if (v === '__custom__') setCustom(c => ({ ...c, [r.role]: r.id })); else { const m = rosterById[v]; setRole(r.role, m?.provider || r.provider, v) } }}>
                          {models.roster.map(m => <option key={m.id} value={m.id}>{m.id}{m.attribute ? ` — ${m.attribute}` : ''}</option>)}
                          {!inRoster && !editingCustom && <option value="__custom__">{r.id} (custom)</option>}
                          {(inRoster || editingCustom) && <option value="__custom__">custom id…</option>}
                        </select>
                        {editingCustom && (
                          <>
                            <input className="cmd-input" style={{ maxWidth: 260 }} spellCheck={false} placeholder="vendor/model" value={custom[r.role]} onChange={e => setCustom(c => ({ ...c, [r.role]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && custom[r.role].trim()) setRole(r.role, r.provider, custom[r.role].trim()); if (e.key === 'Escape') setCustom(c => ({ ...c, [r.role]: '' })) }} autoFocus />
                            <button className="cmd-btn" disabled={busy !== null || !custom[r.role].trim()} onClick={() => setRole(r.role, r.provider, custom[r.role].trim())}>{busy === k ? 'SETTING…' : 'SET'}</button>
                            <button className="chip btn" onClick={() => setCustom(c => ({ ...c, [r.role]: '' }))}>CANCEL</button>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--cmd-amber)', whiteSpace: 'nowrap' }}>{ros?.cost_per_turn || '—'}{ros?.speed_s != null && <div className="cmd-kbd">{ros.speed_s}s</div>}</td>
                    <td>{r.source === 'file' ? <span className="chip app">SET HERE</span> : <span className="chip" title={`lineup default: ${r.default.provider}/${r.default.id}`}>DEFAULT</span>}</td>
                    <td>{r.source === 'file' && <button className="chip btn" disabled={busy !== null} onClick={() => resetRole(r.role)} title={`back to ${r.default.id}`}>RESET</button>}</td>
                  </tr>
                )
              })}
              <tr>
                <td><div className="cmd-display" style={{ fontSize: 14, letterSpacing: '0.08em' }}>FLOOR PROVIDER</div><div className="cmd-kbd">run_floor.mjs</div></td>
                <td style={{ color: 'var(--cmd-dim)', fontSize: 12 }}>where the hosts&apos; turns run: OpenRouter (each host on its Model-DNA engine) or the house Ollama box</td>
                <td>
                  <select className="cmd-select" style={{ width: 'auto' }} value={models.floor_provider.value} disabled={busy !== null} onChange={e => setFloor(e.target.value)}>
                    {models.floor_providers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="cmd-kbd">{models.floor_provider.value === 'openrouter' ? 'per-host dna_id from cast.json' : 'qwen3:30b / hermes4 on cupcake (free, shared with the video engines)'}</td>
                <td style={{ color: 'var(--cmd-amber)' }}>{models.floor_provider.value === 'openrouter' ? 'pennies' : '$0'}</td>
                <td>{models.floor_provider.source === 'file' ? <span className="chip app">SET HERE</span> : <span className="chip">DEFAULT</span>}</td>
                <td />
              </tr>
              {/* cast.json — read-only */}
              {models.cast.showrunner && (
                <tr className="cast-row">
                  <td><div className="cmd-display" style={{ fontSize: 14, letterSpacing: '0.08em' }}>SHOWRUNNER</div><div className="cmd-kbd">cast.json producer</div></td>
                  <td style={{ fontSize: 12 }}>engineers the disagreement, splits the receipts, never writes dialogue</td>
                  <td>{models.cast.showrunner.provider}</td>
                  <td><span className="mono-val" style={{ color: 'var(--cmd-dim)' }}>{models.cast.showrunner.id}</span></td>
                  <td style={{ color: 'var(--cmd-amber)' }}>{rosterById[models.cast.showrunner.id]?.cost_per_turn || '—'}</td>
                  <td><span className="chip" title="locked bundle — edit on the CAST page / cast.json">SET IN CAST.JSON</span></td>
                  <td><a className="doc cmd-kbd" href="/command/cast">CAST →</a></td>
                </tr>
              )}
              {models.cast.hosts.map(h => (
                <tr key={h.id} className="cast-row">
                  <td><div className="cmd-display" style={{ fontSize: 14, letterSpacing: '0.08em' }}>HOST · {h.name.toUpperCase()}</div><div className="cmd-kbd">cast.json {h.id}</div></td>
                  <td style={{ fontSize: 12 }}>{rosterById[h.model]?.attribute || 'a locked host bundle (print + engine + voice)'}{typeof h.temperature === 'number' && <span className="cmd-kbd"> · temp {h.temperature}</span>}</td>
                  <td>{h.provider}</td>
                  <td><span className="mono-val" style={{ color: 'var(--cmd-dim)' }}>{h.model}</span></td>
                  <td style={{ color: 'var(--cmd-amber)' }}>{rosterById[h.model]?.cost_per_turn || '—'}</td>
                  <td><span className="chip" title="locked bundle — edit on the CAST page / cast.json">SET IN CAST.JSON</span></td>
                  <td><a className="doc cmd-kbd" href="/command/cast">CAST →</a></td>
                </tr>
              ))}
              {models.cast.hosts.length === 0 && !models.cast.showrunner && (
                <tr><td colSpan={7} className="cmd-kbd" style={{ textAlign: 'center', padding: 18 }}>NO HOSTS IN cast.json YET — build the cast first</td></tr>
              )}
            </tbody>
          </table>
          {models.roster.length === 0 && <div className="p-4 cmd-kbd">NO ROSTER — lab/models.json is missing; type a custom model id per role</div>}
        </div>
      </section>

      {editing && <EditModal k={editing} onClose={() => setEditing(null)} onSaved={(m) => { setEditing(null); say(m); reload() }} />}
      {confirmRemove && (
        <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmRemove(null) }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="cmd-h justify-between"><h2>REMOVE {confirmRemove.label.toUpperCase()}?</h2><button className="eye" style={{ position: 'static', transform: 'none' }} onClick={() => setConfirmRemove(null)}><X size={16} /></button></div>
            <div className="p-4 space-y-3">
              <div className="cmd-kbd">This deletes the app copy of <span style={{ color: 'var(--cmd-ink)' }}>{confirmRemove.name}</span> from {data.settings_file}. {confirmRemove.env_overrides ? 'An environment variable is also set and keeps working.' : `Features that need it go to MISSING until a new key is added.`}</div>
              <div className="flex gap-2 justify-end">
                <button className="cmd-btn ghost" onClick={() => setConfirmRemove(null)}>CANCEL</button>
                <button className="cmd-btn primary" onClick={() => remove(confirmRemove)}>REMOVE</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** EDIT / ADD a key: a password field, verified against the service before it is saved. A failing key is refused;
 *  FORCE SAVE is the explicit override (for a service that is down, or a key the check can't reach). */
function EditModal({ k, onClose, onSaved }: { k: KeyRow; onClose: () => void; onSaved: (msg: string) => void }) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(!k.secret)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<{ detail: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const save = async (force = false) => {
    const v = value.trim(); if (!v || busy) return
    setBusy(true); setError(null)
    try {
      const { status, j } = await post({ name: k.name, value: v, ...(force ? { force: true } : {}) })
      if (status === 200 && j.ok) onSaved(`${k.label.toUpperCase()} ${j.forced ? 'SAVED (UNVERIFIED)' : 'VERIFIED + SAVED'}`)
      else if (status === 422 && j.refused) setRefused({ detail: j.verify?.detail || 'verify failed' })
      else setError(j.error || `http ${status}`)
    } catch (e: any) { setError(String(e?.message || e)) }
    finally { setBusy(false) }
  }
  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`edit ${k.label}`}>
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><KeyRound size={16} style={{ color: 'var(--cmd-amber)' }} /><h2>{k.set ? 'REPLACE' : 'ADD'} {k.label.toUpperCase()}</h2></div>
          <button className="eye" style={{ position: 'static', transform: 'none' }} onClick={onClose} title="close (Esc)"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="cmd-kbd">{k.service}</div>
          <div>
            <label className="cmd-label">{k.name}{k.url && <a className="doc" href={k.url} target="_blank" rel="noreferrer" style={{ marginLeft: 10 }}>get one <ExternalLink size={10} /></a>}</label>
            <div style={{ position: 'relative' }}>
              <input className="cmd-input" style={{ paddingRight: 38 }} type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} autoFocus placeholder={k.placeholder || (k.secret ? 'paste the key' : 'value')} value={value}
                onChange={e => { setValue(e.target.value); setRefused(null); setError(null) }} onKeyDown={e => { if (e.key === 'Enter') save(false) }} />
              {k.secret && <button type="button" className="eye" onClick={() => setShow(s => !s)} title={show ? 'hide' : 'show while typing'}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
            </div>
            {k.hint && <div className="cmd-kbd mt-1" style={{ color: 'var(--cmd-faint)' }}>{k.hint}</div>}
          </div>
          {k.set && <div className="cmd-kbd">currently <span className="mono-val">{k.display}</span> from <span style={{ color: k.source === 'env' ? 'var(--cmd-cyan)' : 'var(--cmd-amber)' }}>{k.source === 'env' ? 'ENV' : 'APP'}</span>{k.source === 'env' && ' — the env var keeps winning until it is removed from .env / the environment'}</div>}
          <div className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>Checked against {k.label} before it is saved. Stored in lab/settings/keys.json (gitignored, 0600). Never shown again in full.</div>
          {refused && (
            <div className="p-3" style={{ border: '1px solid var(--cmd-red)', background: 'oklch(0.6 0.24 27 / 0.08)' }}>
              <div className="vline" style={{ color: 'var(--cmd-red)' }}><ShieldAlert size={14} /> REFUSED — {refused.detail}</div>
              <div className="cmd-kbd mt-1">Not saved. Fix the key and try again, or force-save if the service is down right now.</div>
            </div>
          )}
          {error && <div className="vline" style={{ color: 'var(--cmd-red)' }}><ShieldAlert size={14} /> {error}</div>}
          <div className="flex gap-2 justify-end items-center flex-wrap">
            {refused && <button className="cmd-btn" disabled={busy} onClick={() => save(true)} title="save even though the check failed">{busy ? 'SAVING…' : 'FORCE SAVE ANYWAY'}</button>}
            <button className="cmd-btn ghost" disabled={busy} onClick={onClose}>CANCEL</button>
            <button className="cmd-btn primary" disabled={busy || !value.trim()} onClick={() => save(false)}>{busy ? 'VERIFYING…' : 'VERIFY + SAVE'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
