'use client'
import { useState } from 'react'
import { useCmdState, Flash } from '../lib'

async function saveCast(cast: any) {
  const r = await fetch('/api/command/cast', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cast }) })
  if (!r.ok) throw new Error('save failed')
}

const KNOBS = ['verbosity', 'filler_rate', 'interruption_rate', 'backchannel_rate'] as const

export default function CastPage() {
  const { state, reload } = useCmdState()
  const [flash, setFlash] = useState<string | null>(null)
  const [vbusy, setVbusy] = useState<string | null>(null)
  const [vmsg, setVmsg] = useState<Record<string, string>>({})
  const [gName, setGName] = useState(''); const [gDesc, setGDesc] = useState('')
  const [gBusy, setGBusy] = useState(false); const [gMsg, setGMsg] = useState('')
  const genGuest = async () => {
    setGBusy(true); setGMsg('')
    try {
      const r = await fetch('/api/command/personality', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: gName, description: gDesc }) })
      const j = await r.json()
      setGMsg(j.ok ? `OK — ${j.guest.name} printed (distinct-by-construction)` : 'ERR: ' + j.error)
      if (j.ok) { setGName(''); setGDesc('') }
    } finally { setGBusy(false); reload() }
  }
  const delGuest = async (id: string) => { await fetch('/api/command/personality', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); reload() }
  const designVoice = async (hostId: string) => {
    setVbusy(hostId); setVmsg(m => ({ ...m, [hostId]: '' }))
    try {
      const r = await fetch('/api/command/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: hostId, action: 'design' }) })
      const j = await r.json()
      setVmsg(m => ({ ...m, [hostId]: j.ok ? `OK — new locked ref designed (seed ${j.seed})` : (j.busy ? 'BOX BUSY (video render running) — try again shortly' : 'ERR: ' + j.error) }))
    } finally { setVbusy(null); reload() }
  }
  const uploadVoice = async (hostId: string, file: File) => {
    const refText = window.prompt('Exact transcript of the clip (required — Breeze clones from ref audio + its exact words):')
    if (!refText) return
    setVbusy(hostId)
    try {
      const fd = new FormData(); fd.set('host', hostId); fd.set('ref_text', refText); fd.set('file', file)
      const r = await fetch('/api/command/voice', { method: 'POST', body: fd })
      const j = await r.json()
      setVmsg(m => ({ ...m, [hostId]: j.ok ? 'OK — your reference is now the locked voice' : 'ERR: ' + j.error }))
    } finally { setVbusy(null); reload() }
  }
  if (!state) return <div className="p-8 cmd-kbd">LOADING CAST...</div>
  const cast = state.cast
  if (!cast) return <div className="p-8 cmd-kbd">NO CAST FILE</div>

  const save = async (next: any) => { await saveCast(next); setFlash('SAVED'); setTimeout(() => setFlash(null), 1200); reload() }
  const patchHost = (id: string, patch: any) => {
    const next = structuredClone(cast)
    const h = next.hosts.find((x: any) => x.id === id); Object.assign(h, patch)
    h.persona_version = (h.persona_version || 1) + (patch.behavioral_core ? 1 : 0)
    save(next)
  }
  const voiceOf = (id: string) => {
    const short = id.split('-')[0] === 'marcus' ? 'blaze' : id.split('-')[0] === 'king' ? 'knowledge' : 'tasha'
    return state.voices.find(v => v === `${short}.wav`) || null
  }
  const imageOf = (id: string) => state.images.find(im => im.startsWith(id) || im.startsWith(id.split('-')[0])) || null

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>CAST — LOCKED BUNDLES</span>
        <Flash msg={flash} />
        <span className="cmd-kbd">MODEL + TEMP + PERSONA + REF VOICE + PORTRAIT = ONE HOST</span>
      </div>

      {/* GUESTS — generated personalities for show types that seat them */}
      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>GUESTS — GENERATE A PERSONALITY</h2></div>
        </div>
        <div className="p-4">
          <div className="flex gap-2 items-end flex-wrap">
            <div style={{ minWidth: 180 }}><label className="cmd-label">NAME</label><input className="cmd-input" value={gName} onChange={e => setGName(e.target.value)} placeholder="e.g. Pastor Cee" /></div>
            <div className="flex-1" style={{ minWidth: 320 }}><label className="cmd-label">WHO ARE THEY (one or two sentences)</label><input className="cmd-input" value={gDesc} onChange={e => setGDesc(e.target.value)} placeholder="e.g. a retired battle rap league security chief who saw everything backstage for 15 years and trusts nobody's public story" /></div>
            <button className="cmd-btn" disabled={gBusy || !gName || !gDesc} onClick={genGuest}>{gBusy ? 'GENERATING…' : '✦ GENERATE PRINT'}</button>
          </div>
          {gMsg && <div className="cmd-kbd mt-2" style={{ color: gMsg.startsWith('OK') ? 'var(--cmd-green)' : 'var(--cmd-amber)' }}>{gMsg}</div>}
          {(state.guests || []).length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {(state.guests || []).map((g: any) => (
                <div key={g.id} className="border p-3" style={{ borderColor: 'var(--cmd-line)' }}>
                  <div className="flex items-center justify-between">
                    <span className="cmd-display">{g.name?.toUpperCase()}</span>
                    <button className="chip err" style={{ cursor: 'pointer' }} onClick={() => delGuest(g.id)}>✕</button>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--cmd-dim)' }}>{g.print?.essence}</div>
                  {g.print?.processing?.blind_spot && <div className="cmd-kbd mt-1"><span style={{ color: 'var(--cmd-red)' }}>BLIND SPOT:</span> {g.print.processing.blind_spot}</div>}
                  {g.voice?.aesthetic && <div className="cmd-kbd mt-1 truncate" title={g.voice.aesthetic}>🎙 {g.voice.aesthetic.slice(0, 60)}…</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-4">
        {(cast.hosts || []).map((h: any) => {
          const vw = voiceOf(h.id); const im = imageOf(h.id)
          return (
            <section key={h.id} className="cmd-panel flex flex-col">
              <div className="cmd-h justify-between">
                <h2>{h.name.toUpperCase()}</h2>
                <span className="chip">{`v${h.persona_version}`}</span>
              </div>

              {/* PORTRAIT */}
              <div className="relative" style={{ aspectRatio: '4/3', background: 'var(--cmd-bg)', borderBottom: '1px solid var(--cmd-line)' }}>
                {im ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/command/audio/images/${im}`} alt={h.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="cmd-display text-5xl" style={{ color: 'var(--cmd-line-hot)' }}>{h.name.split(' ').map((w: string) => w[0]).join('')}</div>
                    <span className="chip warn">AWAITING PORTRAIT · DP WIRE-UP NEXT</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 chip info">{h.lane}</div>
              </div>

              {/* REF VOICE */}
              <div className="p-3 border-b" style={{ borderColor: 'var(--cmd-line)' }}>
                <div className="cmd-label flex justify-between"><span>REFERENCE VOICE (BREEZE · SEED {h.voice?.seed})</span>{vw ? <span className="chip ok">LOCKED{h.voice?.source ? ' · ' + h.voice.source.split(' ')[0].toUpperCase() : ''}</span> : <span className="chip err">MISSING</span>}</div>
                {vw && <audio controls preload="none" src={`/api/command/audio/voices/${vw}?t=${Date.now()}`} />}
                {h.voice?._note && <div className="cmd-kbd mt-1" style={{ color: 'var(--cmd-green)' }}>{h.voice._note}</div>}
                <div className="mt-2">
                  <div className="cmd-label">VOICE AESTHETIC (separate from persona — &quot;phone-quality caller&quot; is a valid aesthetic)</div>
                  <textarea className="cmd-textarea text-xs" rows={3} defaultValue={h.voice?.aesthetic || ''} onBlur={e => e.target.value !== h.voice?.aesthetic && patchHost(h.id, { voice: { ...h.voice, aesthetic: e.target.value } })} />
                </div>
                <div className="flex gap-2 mt-2 items-center flex-wrap">
                  <button className="cmd-btn ghost" disabled={vbusy === h.id} onClick={() => designVoice(h.id)}>{vbusy === h.id ? 'DESIGNING…' : '🎙 DESIGN FROM DESCRIPTION'}</button>
                  <label className="cmd-btn ghost" style={{ cursor: 'pointer' }}>
                    ⬆ UPLOAD MY OWN (.wav)
                    <input type="file" accept=".wav" className="hidden" onChange={e => e.target.files?.[0] && uploadVoice(h.id, e.target.files[0])} />
                  </label>
                </div>
                {vmsg[h.id] && <div className="cmd-kbd mt-1" style={{ color: vmsg[h.id].startsWith('OK') ? 'var(--cmd-green)' : 'var(--cmd-amber)' }}>{vmsg[h.id]}</div>}
                <div className="cmd-kbd mt-1">delivery: {h.voice?.default_instruction}</div>
              </div>

              {/* MODEL BINDING */}
              <div className="p-3 border-b grid grid-cols-2 gap-2" style={{ borderColor: 'var(--cmd-line)' }}>
                <div><div className="cmd-label">WRITER MODEL</div><div className="text-xs" style={{ color: 'var(--cmd-amber)' }}>{h.model.provider}/{h.model.id.split('/').pop()}</div></div>
                <div>
                  <div className="cmd-label">TEMP {h.model.temperature}</div>
                  <input type="range" min={0} max={1.2} step={0.05} defaultValue={h.model.temperature} className="w-full" onMouseUp={(e: any) => patchHost(h.id, { model: { ...h.model, temperature: Number(e.target.value) } })} />
                </div>
              </div>

              {/* KNOBS */}
              <div className="p-3 border-b space-y-2" style={{ borderColor: 'var(--cmd-line)' }}>
                {KNOBS.map(k => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="cmd-kbd" style={{ width: 110 }}>{k.replace('_', ' ').toUpperCase()}</span>
                    <div className="meter flex-1"><i style={{ transform: `scaleX(${h.behavior[k]})` }} /></div>
                    <span className="text-xs" style={{ color: 'var(--cmd-dim)', width: 28 }}>{h.behavior[k]}</span>
                  </div>
                ))}
              </div>

              {/* PERSONALITY PRINT */}
              <div className="p-3 flex-1">
                <div className="cmd-label">PRINT v{h.persona_version} — ESSENCE (full print in cast.json; edit = new version)</div>
                <textarea className="cmd-textarea text-xs" rows={3} defaultValue={h.print?.essence || ''} onBlur={e => e.target.value !== h.print?.essence && patchHost(h.id, { print: { ...h.print, essence: e.target.value } })} />
                {h.print?.processing && (
                  <div className="mt-2 text-xs space-y-1" style={{ color: 'var(--cmd-dim)' }}>
                    <div><span style={{ color: 'var(--cmd-amber)' }}>NOTICES FIRST:</span> {h.print.processing.notices_first}</div>
                    <div><span style={{ color: 'var(--cmd-amber)' }}>REASONS BY:</span> {h.print.processing.reasons_by}</div>
                    <div><span style={{ color: 'var(--cmd-red)' }}>BLIND SPOT:</span> {h.print.processing.blind_spot}</div>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
