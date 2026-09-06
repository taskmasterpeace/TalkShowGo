'use client'
import { useState, useEffect } from 'react'
import { useCmdState, Flash } from '../lib'

async function saveCast(cast: any) {
  const r = await fetch('/api/command/cast', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cast }) })
  if (!r.ok) throw new Error('save failed')
}

const KNOBS = ['verbosity', 'filler_rate', 'interruption_rate', 'backchannel_rate'] as const

const rotStyle = (side: 'left' | 'right') => ({ position: 'absolute' as const, top: '50%', [side]: 4, transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', border: '1px solid var(--cmd-line)', cursor: 'pointer', fontSize: 16, lineHeight: '22px', zIndex: 2 })

// THE ROSTER — every character with a portrait: rotate the 3 Krea shots, copy the face, hear the voice, lock a pick.
function RosterPicker() {
  const [roster, setRoster] = useState<any[] | null>(null)
  const [idx, setIdx] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = () => fetch('/api/command/cast', { cache: 'no-store' }).then(r => r.json()).then(j => {
    const rs = j.roster || []
    setRoster(rs)
    const start: Record<string, number> = {}
    for (const c of rs) start[c.id] = Math.max(0, c.variants.findIndex((v: any) => v.v === c.locked))
    setIdx(start)
  }).catch(() => setRoster([]))
  useEffect(() => { load() }, [])
  const cur = (c: any) => c.variants[idx[c.id] ?? 0] || c.variants[0]
  const rotate = (c: any, dir: number) => setIdx(m => ({ ...m, [c.id]: (((m[c.id] ?? 0) + dir) % c.variants.length + c.variants.length) % c.variants.length }))
  const copyFace = async (c: any) => {
    const url = cur(c).url
    try {
      const blob = await (await fetch(url)).blob()
      // @ts-ignore ClipboardItem is browser-global
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopied(c.id); setTimeout(() => setCopied(null), 1400)
    } catch {
      try { await navigator.clipboard.writeText(location.origin + url); setCopied(c.id); setTimeout(() => setCopied(null), 1400) } catch {}
    }
  }
  const lock = async (c: any) => {
    setBusy(c.id)
    try {
      await fetch('/api/command/cast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lockPortrait', id: c.id, variant: cur(c).v }) })
      await load()
    } finally { setBusy(null) }
  }
  // self-serve: edit the image prompt, regenerate 3 fresh shots through cupcake Krea (the template = shared style + cinematic LoRA baked in)
  const regen = async (c: any) => {
    const subj = window.prompt(`Image prompt for ${c.name} — edit to change the look, then OK to generate 3 fresh shots through cupcake (~2-3 min):`, c.subject || '')
    if (subj === null) return
    setBusy(c.id + ':gen')
    try {
      const r = await fetch('/api/command/cast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'genPortrait', id: c.id, subject: subj }) })
      const j = await r.json().catch(() => ({ error: 'bad response' }))
      if (j.error) alert('Generate failed: ' + j.error)
      await load()
    } finally { setBusy(null) }
  }
  const newFace = async () => {
    const name = window.prompt('New character name (e.g. "Marcus Vale"):')
    if (!name || !name.trim()) return
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!id) return
    const subj = window.prompt(`Image prompt for ${name} — describe the person (the cinematic style + white studio background are added automatically). OK to generate 3 shots via cupcake (~2-3 min):`, '')
    if (subj === null || !subj.trim()) return
    setBusy(id + ':gen')
    try {
      const r = await fetch('/api/command/cast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'genPortrait', id, name: name.trim(), subject: subj }) })
      const j = await r.json().catch(() => ({ error: 'bad response' }))
      if (j.error) alert('Generate failed: ' + j.error)
      await load()
    } finally { setBusy(null) }
  }
  if (!roster) return <div className="p-4 cmd-kbd">LOADING ROSTER…</div>
  return (
    <section className="cmd-panel">
      <div className="cmd-h justify-between">
        <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>THE ROSTER — {roster.length} FACES · ROTATE · COPY · HEAR · GEN</h2>{(() => { const p = roster.filter((c: any) => c.hasPersonality).length; return <span className={`chip ${p === roster.length ? 'ok' : 'warn'}`}>{p}/{roster.length} WITH A PERSONALITY</span> })()}</div>
        <div className="flex items-center gap-2">
          <button className="cmd-btn" disabled={!!busy} onClick={newFace} title="create a new character face from a prompt via cupcake">+ NEW FACE</button>
          <span className="cmd-kbd">CINEMATIC LORA · CUPCAKE KREA</span>
        </div>
      </div>
      <div className="p-4 grid grid-cols-4 gap-3">
        {roster.map((c: any) => {
          const v = cur(c); const isLocked = v.v === c.locked
          return (
            <div key={c.id} className="border flex flex-col" style={{ borderColor: 'var(--cmd-line)' }}>
              <div className="relative" style={{ aspectRatio: '1/1', background: 'var(--cmd-bg)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.url} alt={c.name} className="w-full h-full object-cover" />
                {c.variants.length > 1 && (
                  <>
                    <button style={rotStyle('left')} onClick={() => rotate(c, -1)} aria-label="previous shot">‹</button>
                    <button style={rotStyle('right')} onClick={() => rotate(c, 1)} aria-label="next shot">›</button>
                    <span className="chip" style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)' }}>{(idx[c.id] ?? 0) + 1}/{c.variants.length}</span>
                  </>
                )}
                <span className={`chip ${isLocked ? 'ok' : ''}`} style={{ position: 'absolute', top: 4, right: 4 }}>{isLocked ? '★ PICK' : `SHOT ${v.v}`}</span>
              </div>
              <div className="p-2 flex flex-col gap-2 flex-1">
                <div>
                  <div className="flex items-center gap-1 justify-between">
                    <div className="cmd-display" style={{ letterSpacing: '0.03em' }}>{c.name.toUpperCase()}</div>
                    <span className={`chip ${c.hasPersonality ? 'ok' : 'err'}`} title={c.hasPersonality ? 'has a Personality Print' : "no personality yet — can't ship until it has one"}>{c.hasPersonality ? '✓ PRINT' : '⚠ NO PERSONALITY'}</span>
                  </div>
                  {c.lane && <div className="cmd-kbd truncate" title={c.lane}>{c.lane}</div>}
                </div>
                {(c.tags || []).length > 0 && <div className="flex gap-1 flex-wrap">{c.tags.slice(0, 3).map((t: string) => <span key={t} className="chip info">{t}</span>)}</div>}
                {c.voice ? <audio controls preload="none" src={`${c.voice}?t=${c.id}`} style={{ width: '100%', height: 30 }} /> : <span className="chip warn">NO VOICE YET</span>}
                <div className="flex gap-1 mt-auto">
                  <button className="cmd-btn ghost flex-1" onClick={() => copyFace(c)}>{copied === c.id ? '✓ COPIED' : '⧉ COPY'}</button>
                  <button className="cmd-btn ghost" disabled={busy === c.id + ':gen'} onClick={() => regen(c)} title="edit the prompt and generate 3 new shots via cupcake">{busy === c.id + ':gen' ? 'GEN…' : '⟳ GEN'}</button>
                  {!isLocked && <button className="cmd-btn ghost" disabled={busy === c.id} onClick={() => lock(c)}>{busy === c.id ? '…' : '★ LOCK'}</button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

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
    // per-host wav first (the cast is 19 deep now); OG short names as legacy fallback. The old
    // 3-way mapping played Tasha's voice on 16 cards and lit LOCKED green for refs that were hers.
    if (state.voices.includes(`${id}.wav`)) return `${id}.wav`
    const short = id === 'marcus-blaze' ? 'blaze' : id === 'king-knowledge' ? 'knowledge' : id === 'tasha-raw' ? 'tasha' : null
    return short && state.voices.includes(`${short}.wav`) ? `${short}.wav` : null
  }
  const imageOf = (id: string) => state.images.find(im => im.startsWith(id) || im.startsWith(id.split('-')[0])) || null

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>CAST — LOCKED BUNDLES</span>
        <Flash msg={flash} />
        <span className="cmd-kbd">MODEL + TEMP + PERSONA + REF VOICE + PORTRAIT = ONE HOST</span>
      </div>

      <RosterPicker />

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
                    <input type="file" accept=".wav" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadVoice(h.id, f) }} />
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
