'use client'
import { useState } from 'react'
import { useCmdState, Flash } from '../lib'

export default function ProducerPage() {
  const { state, reload } = useCmdState()
  const [flash, setFlash] = useState<string | null>(null)
  if (!state) return <div className="p-8 cmd-kbd">LOADING PRODUCER...</div>
  const cast = state.cast
  const p = cast?.producer
  if (!p) return <div className="p-8 cmd-kbd">NO PRODUCER IN CAST FILE</div>

  const save = async (patch: any) => {
    const next = structuredClone(cast); Object.assign(next.producer, patch)
    await fetch('/api/command/cast', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cast: next }) })
    setFlash('SAVED'); setTimeout(() => setFlash(null), 1200); reload()
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-4">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>PRODUCER — {p.name.toUpperCase()}</span>
        <span className="chip">NEVER ON AIR</span>
        <Flash msg={flash} />
      </div>

      <section className="cmd-panel">
        <div className="cmd-h"><div className="vu"><i /><i /><i /><i /></div><h2>THE ROOM RUNNER</h2></div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="cmd-label">WRITER MODEL</div>
              <div className="text-sm" style={{ color: 'var(--cmd-amber)' }}>{p.model.provider}/{p.model.id.split('/').pop()}</div>
            </div>
            <div>
              <div className="cmd-label">TEMPERATURE — {p.model.temperature} (ORDER OVER CHAOS)</div>
              <input type="range" min={0} max={1} step={0.05} defaultValue={p.model.temperature} className="w-full" onMouseUp={(e: any) => save({ model: { ...p.model, temperature: Number(e.target.value) } })} />
            </div>
            <div>
              <div className="cmd-label">PERSONA VERSION</div>
              <div className="cmd-num">{p.persona_version}</div>
            </div>
          </div>
          <div>
            <div className="cmd-label">SYSTEM PROMPT — WHAT THE SHOWRUNNER IS</div>
            <textarea className="cmd-textarea text-xs" rows={12} defaultValue={p.system_prompt} onBlur={e => e.target.value !== p.system_prompt && save({ system_prompt: e.target.value, persona_version: (p.persona_version || 1) + 1 })} />
          </div>
        </div>
      </section>

      <section className="cmd-panel">
        <div className="cmd-h"><div className="vu"><i /><i /><i /><i /></div><h2>HOUSE LAWS (READ-ONLY — EDIT IN cast.json DELIBERATELY)</h2></div>
        <div className="p-4 grid grid-cols-2 gap-4 text-xs" style={{ color: 'var(--cmd-dim)' }}>
          <div>
            <div className="cmd-label mb-2">BRIGHT LINES</div>
            {(cast.shared_rules?.bright_lines || []).map((b: string, i: number) => <div key={i} className="mb-1">▸ {b}</div>)}
          </div>
          <div>
            <div className="cmd-label mb-2">CONVERSATION LAWS</div>
            {(cast.shared_rules?.conversation_laws || []).map((b: string, i: number) => <div key={i} className="mb-1">▸ {b}</div>)}
          </div>
        </div>
      </section>
    </div>
  )
}
