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
                <div className="cmd-label flex justify-between"><span>REFERENCE VOICE (BREEZE · SEED-LOCKED)</span>{vw ? <span className="chip ok">LOCKED</span> : <span className="chip err">MISSING</span>}</div>
                {vw && <audio controls preload="none" src={`/api/command/audio/voices/${vw}`} />}
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

              {/* PERSONA CORE */}
              <div className="p-3 flex-1">
                <div className="cmd-label">BEHAVIORAL CORE (EDIT = NEW PERSONA VERSION)</div>
                <textarea className="cmd-textarea text-xs" rows={7} defaultValue={h.behavioral_core} onBlur={e => e.target.value !== h.behavioral_core && patchHost(h.id, { behavioral_core: e.target.value })} />
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
