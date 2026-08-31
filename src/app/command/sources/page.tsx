'use client'
import { useState } from 'react'
import { useCmdState, saveBeat, Flash } from '../lib'

export default function Sources() {
  const { state, reload } = useCmdState()
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  if (!state) return <div className="p-8 cmd-kbd">LOADING SOURCES...</div>
  const beat = state.beats[0]
  if (!beat) return <div className="p-8 cmd-kbd">NO BEAT LOADED</div>
  const tw = beat.sources.twitter || []
  const yt = beat.sources.youtube || []

  const save = async (next: any, msg = 'SAVED') => {
    await saveBeat(beat.file, next)
    setFlash(msg); setTimeout(() => setFlash(null), 1200)
    reload()
  }
  const patchTw = (i: number, patch: any) => {
    const next = structuredClone(beat); Object.assign(next.sources.twitter[i], patch)
    if (patch.handle !== undefined) { next.sources.twitter[i].status = 'unverified (edited)'; delete next.sources.twitter[i].userId }
    save(next)
  }
  const removeTw = (i: number) => { const next = structuredClone(beat); next.sources.twitter.splice(i, 1); save(next, 'REMOVED') }
  const addTw = () => { const next = structuredClone(beat); next.sources.twitter.push({ handle: '', label: '', type: 'blogger', priority: 2, status: 'unverified (new)' }); save(next, 'ADDED') }
  const patchYt = (i: number, patch: any) => {
    const next = structuredClone(beat); Object.assign(next.sources.youtube[i], patch)
    if (patch.channel_name !== undefined) { next.sources.youtube[i].status = 'unverified (edited)'; delete next.sources.youtube[i].channel_id }
    save(next)
  }
  const removeYt = (i: number) => { const next = structuredClone(beat); next.sources.youtube.splice(i, 1); save(next, 'REMOVED') }
  const addYt = () => { const next = structuredClone(beat); next.sources.youtube.push({ channel_name: '', type: 'blogger', priority: 2, status: 'unverified (new)' }); save(next, 'ADDED') }

  const runVerify = async () => {
    setBusy('tw'); setLog([])
    try { const r = await fetch('/api/command/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: beat.file }) }); const j = await r.json(); setLog(j.log || []) }
    finally { setBusy(null); reload() }
  }
  const runResolve = async () => {
    setBusy('yt'); setLog([])
    try { const r = await fetch('/api/command/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: beat.file, action: 'resolve' }) }); const j = await r.json(); setLog(j.log || []) }
    finally { setBusy(null); reload() }
  }

  const chip = (status: string) => {
    const s = String(status || '')
    if (s.startsWith('VERIFIED') || s.startsWith('RESOLVED')) return <span className="chip ok">{s.split(' ')[0]}</span>
    if (s.startsWith('SUSPECT')) return <span className="chip warn" title={s}>SUSPECT</span>
    if (s.startsWith('NOT FOUND') || s.startsWith('ERROR')) return <span className="chip err" title={s}>{s.split(' ')[0]}</span>
    return <span className="chip" title={s}>UNVERIFIED</span>
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>SOURCES — {beat.name?.toUpperCase()}</span>
        <Flash msg={flash} />
      </div>

      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>TWITTER / X — THE PULSE</h2></div>
          <div className="flex gap-2">
            <button className="cmd-btn ghost" onClick={addTw}>+ ADD</button>
            <button className="cmd-btn" disabled={busy === 'tw'} onClick={runVerify}>{busy === 'tw' ? 'VERIFYING…' : '⟳ VERIFY ALL'}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cmd-table">
            <thead><tr><th>HANDLE</th><th>LABEL</th><th>TYPE</th><th>PRI</th><th>FOLLOWERS</th><th>USER ID</th><th>STATUS</th><th /></tr></thead>
            <tbody>
              {tw.map((s: any, i: number) => (
                <tr key={i}>
                  <td style={{ minWidth: 160 }}><div className="flex items-center gap-1"><span style={{ color: 'var(--cmd-faint)' }}>@</span>
                    <input className="cmd-input" style={{ border: 'none', padding: '2px 4px', background: 'transparent' }} defaultValue={s.handle} onBlur={e => e.target.value !== s.handle && patchTw(i, { handle: e.target.value })} /></div></td>
                  <td style={{ minWidth: 150 }}><input className="cmd-input" style={{ border: 'none', padding: '2px 4px', background: 'transparent' }} defaultValue={s.label || ''} onBlur={e => e.target.value !== s.label && patchTw(i, { label: e.target.value })} /></td>
                  <td>
                    <select className="cmd-select" style={{ border: 'none', padding: '2px', background: 'transparent', width: 'auto' }} value={s.type} onChange={e => patchTw(i, { type: e.target.value })}>
                      {['league', 'battler', 'blogger', 'media', 'fan'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="cmd-select" style={{ border: 'none', padding: '2px', background: 'transparent', width: 'auto' }} value={s.priority} onChange={e => patchTw(i, { priority: Number(e.target.value) })}>
                      {[1, 2, 3].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={{ color: 'var(--cmd-amber)' }}>{s.followers?.toLocaleString?.() || '—'}</td>
                  <td className="cmd-kbd">{s.userId || '—'}</td>
                  <td>{chip(s.status)}</td>
                  <td><button className="chip err" style={{ cursor: 'pointer' }} onClick={() => removeTw(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>YOUTUBE — THE DEEP DIVE</h2></div>
          <div className="flex gap-2">
            <button className="cmd-btn ghost" onClick={addYt}>+ ADD</button>
            <button className="cmd-btn" disabled={busy === 'yt'} onClick={runResolve}>{busy === 'yt' ? 'RESOLVING…' : '⟳ RESOLVE ALL'}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cmd-table">
            <thead><tr><th>CHANNEL</th><th>TYPE</th><th>PRI</th><th>RESOLVED</th><th>SUBS</th><th>LATEST UPLOAD</th><th>STATUS</th><th /></tr></thead>
            <tbody>
              {yt.map((c: any, i: number) => (
                <tr key={i}>
                  <td style={{ minWidth: 190 }}><input className="cmd-input" style={{ border: 'none', padding: '2px 4px', background: 'transparent' }} defaultValue={c.channel_name} onBlur={e => e.target.value !== c.channel_name && patchYt(i, { channel_name: e.target.value })} /></td>
                  <td>
                    <select className="cmd-select" style={{ border: 'none', padding: '2px', background: 'transparent', width: 'auto' }} value={c.type} onChange={e => patchYt(i, { type: e.target.value })}>
                      {['league', 'blogger', 'interviews', 'media'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>{c.priority}</td>
                  <td className="cmd-kbd">{c.resolved_title || '—'}</td>
                  <td style={{ color: 'var(--cmd-cyan)' }}>{c.subscribers || '—'}</td>
                  <td className="cmd-kbd truncate" style={{ maxWidth: 260 }} title={c.latest?.title}>{c.latest ? `${c.latest.title} · ${c.latest.published || ''}` : '—'}</td>
                  <td>{chip(c.status)}</td>
                  <td><button className="chip err" style={{ cursor: 'pointer' }} onClick={() => removeYt(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {log.length > 0 && (
        <section className="cmd-panel p-4">
          <div className="cmd-label mb-2">LAST OPERATION LOG</div>
          <div className="text-xs space-y-1" style={{ color: 'var(--cmd-dim)' }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>
        </section>
      )}
    </div>
  )
}
