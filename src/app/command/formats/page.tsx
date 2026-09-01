'use client'
import { useCmdState } from '../lib'

// role code (literal hex — CSS vars don't resolve inside SVG presentation attributes)
const RHEX: Record<string, string> = { H: '#efe9df', M: '#39cdd6', A: '#ff5a4d', B: '#ff9d2e', E: '#5cd08a', W: '#3ec9b0', S: '#e0a15c', C: '#ff7ea3', P: '#5b9dff' }
const RNAME: Record<string, string> = { H: 'host', M: 'moderator', A: 'advocate', B: 'challenger', E: 'expert', W: 'witness', S: 'subject', C: 'correspondent', P: 'panelist' }

// visual layout per format (seats on a 320x180 / 16:9 stage) + grouping + suggested skin
type Seat = { r: string; x: number; y: number; opt?: boolean; phone?: boolean }
const VIZ: Record<string, { group: string; skin: string; seats: Seat[]; heat?: boolean }> = {
  'moderated-collision': { group: 'DEBATE ROOMS', skin: 'desk-multi', seats: [{ r: 'A', x: 96, y: 98 }, { r: 'M', x: 160, y: 84 }, { r: 'B', x: 224, y: 98 }] },
  'open-panel': { group: 'DEBATE ROOMS', skin: 'desk-multi', seats: [{ r: 'H', x: 104, y: 92 }, { r: 'P', x: 164, y: 86 }, { r: 'P', x: 226, y: 96, opt: true }] },
  'evidence-mystery': { group: 'THE INVESTIGATION', skin: 'single-seat', seats: [{ r: 'H', x: 138, y: 90 }, { r: 'E', x: 214, y: 96, opt: true }] },
  'news-desk': { group: 'THE INVESTIGATION', skin: 'single-seat', seats: [{ r: 'H', x: 134, y: 90 }, { r: 'E', x: 212, y: 96, opt: true }] },
  'system-expose': { group: 'THE INVESTIGATION', skin: 'single-seat', seats: [{ r: 'H', x: 160, y: 86 }, { r: 'E', x: 236, y: 98, opt: true }] },
  'pressure-interview': { group: 'THE INTERVIEW', skin: 'desk-multi', heat: true, seats: [{ r: 'H', x: 120, y: 92 }, { r: 'S', x: 200, y: 92 }] },
  'hybrid-forum': { group: 'THE INTERVIEW', skin: 'desk-multi', seats: [{ r: 'H', x: 60, y: 90 }, { r: 'S', x: 114, y: 94 }, { r: 'P', x: 170, y: 96 }, { r: 'P', x: 220, y: 96 }, { r: 'P', x: 264, y: 98, opt: true }] },
  'satirical-news-desk': { group: 'FAST & FUNNY', skin: 'desk-multi', seats: [{ r: 'H', x: 100, y: 92 }, { r: 'C', x: 172, y: 96, opt: true }, { r: 'S', x: 244, y: 98, opt: true }] },
  'rapid-wire': { group: 'FAST & FUNNY', skin: 'animated', seats: [{ r: 'H', x: 114, y: 92 }, { r: 'H', x: 186, y: 96, opt: true }, { r: 'C', x: 258, y: 96, opt: true, phone: true }] },
  'opinion-single': { group: 'THE SINGLE', skin: 'single-seat', seats: [{ r: 'H', x: 160, y: 86 }] },
}
const GROUPS = ['DEBATE ROOMS', 'THE INVESTIGATION', 'THE INTERVIEW', 'FAST & FUNNY', 'THE SINGLE']

function SetStill({ id, solo }: { id: string; solo: boolean }) {
  const v = VIZ[id]; if (!v) return null
  const seats = v.seats
  return (
    <svg viewBox="0 0 320 180" style={{ display: 'block', width: '100%', height: '100%' }} role="img" aria-label={`${id} set`}>
      <rect x="0" y="0" width="320" height="180" fill="#0c0b0a" />
      <rect x="30" y="16" width="260" height="58" fill="#100e0c" stroke="#241f1b" />
      <line x1="14" y1="150" x2="306" y2="150" stroke="#332d26" />
      <rect x={solo ? 128 : 34} y="132" width={solo ? 64 : 252} height="26" fill="#0d0c0b" stroke="#332d26" />
      <rect x={solo ? 128 : 34} y="132" width={solo ? 64 : 252} height="4" fill="#ff3b34" opacity="0.5" />
      {v.heat && [0, 1, 2, 3, 4].map(i => <circle key={i} cx={150 + i * 4} cy={78 - i * 4} r={1.4 + i * 0.5} fill="#ff3b34" opacity={0.25 + i * 0.14} />)}
      {seats.map((s, i) => {
        const c = RHEX[s.r] || RHEX.H, op = s.opt ? 0.42 : 1
        const dash = s.opt ? '3 3' : undefined
        if (s.phone) return (
          <g key={i} opacity={op}>
            <rect x={s.x - 12} y={s.y - 16} width="24" height="34" rx="3" fill="#0c0b0a" stroke={c} strokeDasharray={dash} />
            <text x={s.x} y={s.y + 4} textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="13" fill={c}>{s.r}</text>
          </g>)
        return (
          <g key={i} opacity={op}>
            <path d={`M ${s.x - 17} 132 Q ${s.x} 112 ${s.x + 17} 132`} fill="none" stroke={c} strokeDasharray={dash} opacity={0.7} />
            <circle cx={s.x} cy={s.y - 6} r="15" fill="#151210" stroke={c} strokeWidth="1.6" strokeDasharray={dash} />
            <text x={s.x} y={s.y - 1} textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="15" fill={c}>{s.r}</text>
            {s.opt && <text x={s.x} y={s.y + 30} textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#6f665b">optional</text>}
          </g>)
      })}
    </svg>
  )
}

const depClass = (d: string) => d === 'SUBJECT_REQUIRED' || d.includes('REQUIRED') ? 'err' : d === 'NONE' ? 'ok' : ''
const blkLabel = (b: any) => typeof b === 'string' ? b : b.block

export default function Formats() {
  const { state } = useCmdState()
  if (!state) return <div className="p-8 cmd-kbd">LOADING FORMATS…</div>
  const formats: any[] = state.formats?.formats || []
  const models: any[] = state.models?.models || []
  const byId = Object.fromEntries(formats.map(f => [f.id, f]))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.12em' }}>THE FORMAT ROOM</span>
        <span className="cmd-kbd">{formats.length} FORMATS · each a SHAPE, not a script</span>
      </div>

      {/* role legend — the icons, kept */}
      <div className="cmd-panel p-3 flex flex-wrap gap-x-5 gap-y-2">
        {Object.entries(RNAME).map(([k, v]) => (
          <span key={k} className="flex items-center gap-2 cmd-kbd" style={{ fontSize: 11 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: RHEX[k], display: 'inline-block', border: '1px solid #0006' }} />
            {k} · {v}
          </span>
        ))}
      </div>

      {GROUPS.map(g => {
        const ids = Object.keys(VIZ).filter(id => VIZ[id].group === g && byId[id])
        if (!ids.length) return null
        return (
          <section key={g} className="space-y-3">
            <div className="cmd-label" style={{ color: 'var(--cmd-red)', letterSpacing: '0.2em' }}>{g}</div>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))' }}>
              {ids.map(id => {
                const f = byId[id], v = VIZ[id]
                const solo = v.seats.length === 1
                const req = v.seats.filter(s => !s.opt).length
                const ref = String(f.reference || '').split(' (')[0]
                return (
                  <div key={id} className="cmd-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* 16:9 set-still slot — generated establishing image will replace this diagram */}
                    <div style={{ aspectRatio: '16 / 9', borderBottom: '1px solid var(--cmd-line)', position: 'relative' }}>
                      <SetStill id={id} solo={solo} />
                      <span className="cmd-kbd" style={{ position: 'absolute', top: 6, left: 8, fontSize: 9, opacity: 0.7 }}>SET · 16:9</span>
                    </div>
                    <div className="p-3 space-y-2" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="cmd-display" style={{ fontSize: 20, letterSpacing: '0.02em' }}>{f.name}</div>
                          <div className="cmd-kbd" style={{ fontSize: 10 }}>{ref}</div>
                        </div>
                        <span className={`chip ${depClass(f.cast_logic?.human_dependency || '')}`} style={{ fontSize: 9 }}>{(f.cast_logic?.human_dependency || '').replace(/_/g, ' ')}</span>
                      </div>
                      <div style={{ color: 'var(--cmd-cyan)', fontFamily: 'var(--cmd-mono, monospace)', fontSize: 12 }}>{f.cast_logic?.topology}</div>
                      <div style={{ color: 'var(--cmd-dim)', fontSize: 13, lineHeight: 1.4 }}>{f.series_dna?.spine}</div>

                      {/* 1:1 image-ready cast strip — generated portraits replace the letters */}
                      <div className="cmd-kbd" style={{ fontSize: 9, letterSpacing: '0.15em', paddingTop: 2 }}>CAST · 1:1</div>
                      <div className="flex gap-2">
                        {v.seats.map((s, i) => (
                          <div key={i} title={`${RNAME[s.r]}${s.opt ? ' (optional)' : ''}`}
                            style={{ width: 40, height: 40, border: `1px solid ${RHEX[s.r]}`, opacity: s.opt ? 0.4 : 1, borderStyle: s.opt ? 'dashed' : 'solid', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#151210', fontFamily: 'monospace', fontWeight: 700, color: RHEX[s.r], fontSize: 15 }}>
                            {s.r}
                          </div>
                        ))}
                      </div>

                      <div className="cmd-kbd" style={{ fontSize: 9, letterSpacing: '0.15em', paddingTop: 2 }}>RUN OF SHOW</div>
                      <div className="flex gap-1 flex-wrap">
                        {(f.episode_grammar?.base_sequence || []).map((b: any, i: number) => (
                          <span key={i} className="chip" style={{ fontSize: 9 }}>{blkLabel(b)}</span>
                        ))}
                      </div>
                      <div className="flex justify-between items-center" style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--cmd-line)' }}>
                        <span className="cmd-kbd" style={{ fontSize: 10 }}>{req} required · {v.seats.length - req} optional</span>
                        <span style={{ color: 'var(--cmd-cyan)', fontFamily: 'monospace', fontSize: 10 }}>▣ {v.skin}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* MODEL DNA — quirks as attributes */}
      {models.length > 0 && (
        <section className="space-y-3">
          <div className="cmd-label" style={{ color: 'var(--cmd-red)', letterSpacing: '0.2em' }}>MODEL DNA — QUIRKS AS ATTRIBUTES</div>
          <div className="cmd-kbd" style={{ fontSize: 11 }}>a host is a PRINT (soul) on a MODEL (temperament) · context window is a trait · internet comes from the research node, not the model</div>
          <div className="overflow-x-auto">
            <table className="cmd-table">
              <thead><tr><th>ATTRIBUTE</th><th>ENGINE</th><th>THE QUIRK</th><th>CONTEXT</th><th>$/TURN</th><th>UNCENSORED</th><th>BEST FOR</th></tr></thead>
              <tbody>
                {models.map((m: any) => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--cmd-bone,#efe9df)', fontWeight: 600 }}>{m.attribute}</td>
                    <td className="cmd-kbd" style={{ fontSize: 10 }}>{m.id.split('/').pop()}</td>
                    <td style={{ color: 'var(--cmd-dim)', fontSize: 12 }}>{m.quirk}</td>
                    <td className="cmd-kbd" style={{ color: 'var(--cmd-cyan)' }}>{m.context_tokens >= 1e6 ? (m.context_tokens / 1e6) + 'M' : Math.round(m.context_tokens / 1000) + 'K'}</td>
                    <td className="cmd-kbd" style={{ fontSize: 10 }}>{m.cost_per_turn}</td>
                    <td>{m.uncensored ? <span className="chip err" style={{ fontSize: 9 }}>YES</span> : <span className="cmd-kbd" style={{ fontSize: 10 }}>—</span>}</td>
                    <td className="cmd-kbd" style={{ fontSize: 10 }}>{(m.best_for || []).slice(0, 3).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
