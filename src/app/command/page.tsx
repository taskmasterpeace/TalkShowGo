'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useCmdState, saveBeat, Flash } from './lib'

export default function Desk() {
  const { state, reload } = useCmdState()
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [report, setReport] = useState<any>(null)

  if (!state) return <div className="p-8 cmd-kbd">BOOTING DESK...</div>
  const beat = state.beats[0] || null
  const show = beat?.show || {}
  const tw = beat?.sources?.twitter || []
  const yt = beat?.sources?.youtube || []
  const twOk = tw.filter((s: any) => String(s.status || '').startsWith('VERIFIED')).length
  const ytOk = yt.filter((c: any) => String(c.status || '').startsWith('RESOLVED')).length
  const hosts = state.cast?.hosts || []
  const latestPull = report || state.pulls[0] || null

  const setShow = async (patch: any) => {
    const next = { ...beat, show: { ...show, ...patch } }
    await saveBeat(beat.file, next)
    setFlash('SAVED'); setTimeout(() => setFlash(null), 1200)
    reload()
  }
  const runPull = async () => {
    setBusy(true); setReport(null)
    try {
      const r = await fetch('/api/command/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: beat.file }) })
      const j = await r.json()
      setReport(j.report)
    } finally { setBusy(false); reload() }
  }

  const lamp = (v: boolean | null) => v === null ? 'warn' : v ? 'on' : 'err'

  return (
    <div>
      {/* top strip */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--cmd-line)' }}>
        <div className="flex items-center gap-6">
          <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>MASTER DESK</span>
          <span className="lamp on"><i />TWITTER KEY</span>
          <span className={`lamp ${lamp(state.health.gateway)}`}><i />CUPCAKE GATEWAY</span>
          <span className={`lamp ${state.health.breeze_refs ? 'on' : 'warn'}`}><i />BREEZE CAST</span>
        </div>
        <div className="onair"><i />BATTLE RAP · MANUAL</div>
      </div>

      <div className="p-6 grid grid-cols-12 gap-4">
        {/* SHOW IDENTITY */}
        <section className="cmd-panel col-span-5">
          <div className="cmd-h"><div className="vu"><i /><i /><i /><i /></div><h2>SHOW IDENTITY</h2><Flash msg={flash} /></div>
          <div className="p-4 space-y-4">
            <div>
              <label className="cmd-label">SHOW NAME</label>
              <input className="cmd-input cmd-display text-2xl" style={{ letterSpacing: '0.06em' }} defaultValue={show.name || ''} onBlur={e => e.target.value !== show.name && setShow({ name: e.target.value })} />
            </div>
            <div>
              <label className="cmd-label">TAGLINE</label>
              <input className="cmd-input" defaultValue={show.tagline || ''} onBlur={e => e.target.value !== show.tagline && setShow({ tagline: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="cmd-label">TIME SPAN (HOURS)</label>
                <select className="cmd-select" value={show.timespan_hours || 24} onChange={e => setShow({ timespan_hours: Number(e.target.value) })}>
                  {[6, 12, 24, 48, 72, 168].map(h => <option key={h} value={h}>{h === 24 ? '24 — ONE DAY' : h === 168 ? '168 — ONE WEEK' : h}</option>)}
                </select>
              </div>
              <div>
                <label className="cmd-label">FORMAT BIAS</label>
                <select className="cmd-select" value={show.format_bias || 'auto'} onChange={e => setShow({ format_bias: e.target.value })}>
                  <option value="auto">AUTO (Showrunner picks)</option>
                  <option value="reaction">REACTION</option>
                  <option value="clash">CLASH</option>
                  <option value="roundup">ROUNDUP</option>
                </select>
              </div>
            </div>
            {(['intro', 'outro'] as const).map(k => (
              <div key={k}>
                <label className="cmd-label flex items-center justify-between">
                  <span>{k.toUpperCase()} MODULE</span>
                  <button className="chip" style={{ cursor: 'pointer' }} onClick={() => setShow({ [k]: { ...show[k], enabled: !show[k]?.enabled } })}>
                    {show[k]?.enabled ? 'ON' : 'OFF'}
                  </button>
                </label>
                <textarea className="cmd-textarea" rows={2} defaultValue={show[k]?.template || ''} onBlur={e => setShow({ [k]: { ...show[k], template: e.target.value } })} />
              </div>
            ))}
          </div>
        </section>

        {/* CONFIG METERS + PROCESS */}
        <section className="col-span-7 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Link href="/command/sources" className="cmd-panel p-4 block hover:opacity-90">
              <div className="cmd-label">TWITTER SOURCES</div>
              <div className="cmd-num">{twOk}<span style={{ color: 'var(--cmd-faint)' }}>/{tw.length}</span></div>
              <div className="meter mt-2"><i style={{ transform: `scaleX(${tw.length ? twOk / tw.length : 0})` }} /></div>
              <div className="cmd-kbd mt-2">VERIFIED · IDs LOCKED</div>
            </Link>
            <Link href="/command/sources" className="cmd-panel p-4 block hover:opacity-90">
              <div className="cmd-label">YOUTUBE CHANNELS</div>
              <div className="cmd-num">{ytOk}<span style={{ color: 'var(--cmd-faint)' }}>/{yt.length}</span></div>
              <div className="meter mt-2"><i style={{ transform: `scaleX(${yt.length ? ytOk / yt.length : 0})` }} /></div>
              <div className="cmd-kbd mt-2">RESOLVED CHANNELS</div>
            </Link>
            <Link href="/command/cast" className="cmd-panel p-4 block hover:opacity-90">
              <div className="cmd-label">CAST</div>
              <div className="cmd-num">{hosts.length}<span style={{ color: 'var(--cmd-faint)' }}>+1</span></div>
              <div className="cmd-kbd mt-2">{state.voices.length} LOCKED VOICES</div>
              <div className="cmd-kbd">{state.images.length} PORTRAITS</div>
            </Link>
            <Link href="/command/tape" className="cmd-panel p-4 block hover:opacity-90">
              <div className="cmd-label">TAPE</div>
              <div className="cmd-num">{state.audio.length}</div>
              <div className="cmd-kbd mt-2">RENDERED CUTS</div>
            </Link>
          </div>

          <div className="cmd-panel-hot p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="cmd-display text-xl" style={{ letterSpacing: '0.1em' }}>PROCESS — {show.name || beat?.name}</div>
                <div className="cmd-kbd mt-1">STAGE 1: PULL THE LAST {show.timespan_hours || 24}H FROM EVERY VERIFIED SOURCE</div>
              </div>
              <button className="cmd-btn primary" disabled={busy} onClick={runPull}>{busy ? 'SWEEPING…' : '▶ RUN PULL'}</button>
            </div>
            {latestPull && (
              <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--cmd-line)' }}>
                <div className="flex gap-8">
                  <div><span className="cmd-num" style={{ color: 'var(--cmd-amber)' }}>{latestPull.totals?.tweets ?? 0}</span> <span className="cmd-kbd">TWEETS IN WINDOW</span></div>
                  <div><span className="cmd-num" style={{ color: 'var(--cmd-cyan)' }}>{latestPull.totals?.videos ?? 0}</span> <span className="cmd-kbd">VIDEOS IN WINDOW</span></div>
                  <div className="cmd-kbd self-end">{latestPull.pulled_at}</div>
                </div>
                <div className="mt-3 max-h-56 overflow-auto space-y-1">
                  {(latestPull.twitter || []).map((s: any, i: number) => (
                    <div key={i} className="flex gap-3 text-xs">
                      <span style={{ color: 'var(--cmd-amber)', minWidth: 130 }}>@{s.handle}</span>
                      {s.error ? <span className="chip err">{s.error}</span> : <><span className="cmd-kbd">{s.in_window} in window</span><span className="truncate" style={{ color: 'var(--cmd-dim)' }}>{s.top?.[0]?.text || ''}</span></>}
                    </div>
                  ))}
                  {(latestPull.youtube || []).map((c: any, i: number) => (
                    <div key={'y' + i} className="flex gap-3 text-xs">
                      <span style={{ color: 'var(--cmd-cyan)', minWidth: 130 }}>{c.channel}</span>
                      {c.error ? <span className="chip err">{c.error}</span> : <><span className="cmd-kbd">{c.in_window} vids</span><span className="truncate" style={{ color: 'var(--cmd-dim)' }}>{c.videos?.[0]?.title || ''}</span></>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <span className="chip ok">PULL · LIVE</span>
              <span className="chip warn">EVIDENCE → SHOWPLAN · WIRE-UP NEXT</span>
              <span className="chip warn">FLOOR → BREEZE · ENGINE READY</span>
              <span className="chip info">AVATAR STAGE · SEE ROADMAP</span>
            </div>
          </div>

          {/* ROADMAP */}
          <div className="cmd-panel">
            <div className="cmd-h"><div className="vu"><i /><i /><i /><i /></div><h2>NEXT UNLOCKS</h2></div>
            <div className="p-4 grid grid-cols-3 gap-3 text-xs" style={{ color: 'var(--cmd-dim)' }}>
              <div>
                <div className="chip info mb-2">AVATAR DESK</div>
                DP portrait × 3 angles + Breeze audio → H3 ref2va lip-sync on cupcake. Camera cuts follow whoever holds the floor — real news-channel coverage. The gateway already supports every piece.
              </div>
              <div>
                <div className="chip warn mb-2">BREEZE LICENSE</div>
                Self-hosted outputs are research/non-commercial. Prototype freely; before monetized shows, unlock BreezeBlue&apos;s commercial path (research in flight).
              </div>
              <div>
                <div className="chip mb-2">BIGGER WRITER</div>
                Floor engine proven; qwen3:30b capped at judge 3.3/10. Unlock: Requesty top-up, or Hermes-70B in a night window.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
