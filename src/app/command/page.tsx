'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCmdState, saveBeat, Flash, useBeat, BeatPicker, ago } from './lib'

// old show_types ids -> new format ids (so beats saved before the migration still resolve)
const FORMAT_MIGRATE: Record<string, string> = { 'the-panel': 'open-panel', 'head-to-head': 'moderated-collision', 'the-desk': 'news-desk', 'the-take': 'opinion-single', 'hot-wire': 'rapid-wire' }

function TopicsPanel({ topics, onMine, busy }: { topics: any; onMine: () => void; busy: boolean }) {
  const mined = topics?.mined_at ? ago(topics.mined_at) : null
  return (
    <div className="cmd-panel">
      <div className="cmd-h justify-between">
        <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>THE TOPIC MINER — WHAT&apos;S THE STORY TODAY</h2>{mined && <span className={`chip ${mined.cls}`}>MINED {mined.text.toUpperCase()}</span>}</div>
        <button className="cmd-btn" disabled={busy} onClick={onMine}>{busy ? 'MINING…' : '⛏ MINE TOPICS'}</button>
      </div>
      {topics?.error && <div className="p-4"><span className="chip err">{topics.error}</span></div>}
      {topics?.the_lead && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--cmd-line)' }}>
          <div className="cmd-label" style={{ color: 'var(--cmd-red)' }}>THE LEAD</div>
          <div className="cmd-display text-lg" style={{ letterSpacing: '0.04em' }}>{topics.the_lead}</div>
        </div>
      )}
      {(topics?.topics || []).length > 0 && (
        <div className="p-4 space-y-3">
          {topics.topics.map((t: any, i: number) => (
            <div key={i} className="border p-3" style={{ borderColor: 'var(--cmd-line)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="cmd-display" style={{ letterSpacing: '0.04em' }}>{t.title}</span>
                <span className={`chip ${t.overlap_sources >= 2 ? 'ok' : 'info'}`}>{t.overlap_sources >= 2 ? `OVERLAP ×${t.overlap_sources}` : 'SOLO'}</span>
                <span className={`chip ${t.kind === 'story' ? 'err' : t.kind === 'follow-up' ? 'warn' : ''}`}>{(t.kind || '').toUpperCase()}</span>
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--cmd-dim)' }}>{t.why_today}</div>
              {t.angle && <div className="text-xs mt-1" style={{ color: 'var(--cmd-amber)' }}>ANGLE: {t.angle}</div>}
              {(t.evidence || []).slice(0, 3).map((e: string, k: number) => <div key={k} className="cmd-kbd mt-1 truncate">{e}</div>)}
            </div>
          ))}
        </div>
      )}
      {!topics && <div className="p-4 cmd-kbd">RUN PULL, THEN MINE — overlap across sources = the day&apos;s story; solo items become follow-ups.</div>}
    </div>
  )
}

export default function Desk() {
  const { state, reload } = useCmdState()
  const [busy, setBusy] = useState(false)
  const [busy2, setBusy2] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [report, setReport] = useState<any>(null)
  const [topics2, setTopics2] = useState<any>(null)
  const runMine = async (beatFile: string) => {
    setBusy2(true)
    try {
      const r = await fetch('/api/command/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: beatFile }) })
      const j = await r.json()
      if (j.error) setTopics2({ error: j.error }); else setTopics2(j)
    } finally { setBusy2(false) }
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { beat, beats, pick } = useBeat(state)
  // NO BLEED: local pull/topics results are per-show; clear them when the show switches
  useEffect(() => { setReport(null); setTopics2(null) }, [beat?.id])
  if (!state) return <div className="p-8 cmd-kbd">BOOTING DESK...</div>
  const show = beat?.show || {}
  const tw = beat?.sources?.twitter || []
  const yt = beat?.sources?.youtube || []
  const twOk = tw.filter((s: any) => String(s.status || '').startsWith('VERIFIED')).length
  // YouTube health = what the LAST PULL actually got back, not the static "RESOLVED" stamp
  const lastPullForMeter = (state.pulls || []).find((p: any) => p?.beat === beat?.id)
  const ytOk = lastPullForMeter?.youtube?.length ? lastPullForMeter.youtube.filter((c: any) => !c.error).length
    : lastPullForMeter?.youtube_error ? 0   // the whole YouTube sweep failed on the last pull: nothing is healthy
      : yt.filter((c: any) => String(c.status || '').startsWith('RESOLVED')).length
  const hosts = state.cast?.hosts || []
  // per-SHOW data only - a pull/topics file carries its beat id; never show another show's data
  const latestPull = report || (state.pulls || []).find((p: any) => p?.beat === beat?.id) || null
  const showTopics = topics2 || (state.topicsAll || [state.topics]).find((t: any) => t?.beat === beat?.id) || null
  const pullAge = ago(latestPull?.pulled_at)

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
        <div className="flex items-center gap-3">
          <BeatPicker beats={beats} beat={beat} pick={pick} />
          <div className="onair"><i />{(beat?.name || '').toUpperCase()} · MANUAL</div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-12 gap-4">
        {/* SHOW IDENTITY */}
        <section className="cmd-panel col-span-5">
          <div className="cmd-h"><div className="vu"><i /><i /><i /><i /></div><h2>SHOW IDENTITY</h2><Flash msg={flash} /></div>
          <div className="p-4 space-y-4">
            <div>
              <label className="cmd-label">SHOW NAME</label>
              <input className="cmd-input cmd-display text-2xl" spellCheck={false} style={{ letterSpacing: '0.06em' }} defaultValue={show.name || ''} onBlur={e => e.target.value !== show.name && setShow({ name: e.target.value })} />
            </div>
            <div>
              <label className="cmd-label">TAGLINE</label>
              <input className="cmd-input" spellCheck={false} defaultValue={show.tagline || ''} onBlur={e => e.target.value !== show.tagline && setShow({ tagline: e.target.value })} />
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
            <div>
              <label className="cmd-label">FORMAT — THE ROOM&apos;S SHAPE &amp; RUN OF SHOW</label>
              <select className="cmd-select" value={FORMAT_MIGRATE[show.show_type] || show.show_type || 'open-panel'} onChange={e => setShow({ show_type: e.target.value })}>
                {(state.formats?.formats || []).map((f: any) => <option key={f.id} value={f.id}>{f.name} — {String(f.reference || '').split(' (')[0]}</option>)}
              </select>
              {(() => {
                const fid = FORMAT_MIGRATE[show.show_type] || show.show_type || 'open-panel'
                const f = (state.formats?.formats || []).find((x: any) => x.id === fid)
                if (!f) return null
                return (
                  <div className="mt-2 text-xs" style={{ color: 'var(--cmd-dim)' }}>
                    <div className="flex flex-wrap gap-1 mb-1">{(f.episode_grammar?.base_sequence || []).map((b: any, i: number) => <span key={i} className="chip">{typeof b === 'string' ? b : b.block}</span>)}</div>
                    <div className="cmd-kbd">{f.cast_logic?.topology} · {f.cast_logic?.human_dependency} · {f.series_dna?.spine}</div>
                  </div>
                )
              })()}
            </div>
            {(['intro', 'outro'] as const).map(k => (
              <div key={k}>
                <label className="cmd-label flex items-center justify-between">
                  <span>{k.toUpperCase()} MODULE</span>
                  <button className="chip" style={{ cursor: 'pointer' }} onClick={() => setShow({ [k]: { ...show[k], enabled: !show[k]?.enabled } })}>
                    {show[k]?.enabled ? 'ON' : 'OFF'}
                  </button>
                </label>
                <textarea className="cmd-textarea" spellCheck={false} rows={2} defaultValue={show[k]?.template || ''} onBlur={e => setShow({ [k]: { ...show[k], template: e.target.value } })} />
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
              <div className="cmd-kbd mt-2">{lastPullForMeter?.youtube?.length ? `RETURNED ON LAST PULL · ${(() => {
                // which rung answered: RSS (exact stamps) / INNERTUBE (keyless, in-process) / YT-DLP (last resort)
                const via: Record<string, number> = {}
                for (const c of lastPullForMeter.youtube) { const k = c.error ? 'FAILED' : String(c.via || '?').split(' ')[0].toUpperCase(); via[k] = (via[k] || 0) + 1 }
                return Object.entries(via).map(([k, n]) => `${n} ${k}`).join(' · ')
              })()}` : 'RESOLVED CHANNELS'}</div>
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
                <div className="mt-1"><span className={`chip ${pullAge.cls}`}>LAST PULL FOR THIS SHOW: {pullAge.text.toUpperCase()}</span></div>
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
              <span className="chip ok">TOPIC MINER · LIVE</span>
              <span className="chip ok">SHOWPLAN · LIVE</span>
              <span className="chip warn">FLOOR → BREEZE · ENGINE READY</span>
              <span className="chip info">AVATAR STAGE · SEE ROADMAP</span>
            </div>
          </div>

          {/* TOPIC MINER — stage 2 */}
          <TopicsPanel topics={showTopics} onMine={() => runMine(beat.file)} busy={busy2} />

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
