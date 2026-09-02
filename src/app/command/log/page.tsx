'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ago } from '../lib'

// THE LOG: every pipeline action as one line (lab/logs/activity.jsonl), newest first, with facet
// filters. Kind and beat counts come from the API so each chip shows how many lines sit behind it.
const KINDS = ['pull', 'topics', 'cluster', 'leads', 'expand', 'rank', 'research', 'web', 'briefing', 'cast', 'build', 'scout', 'system']
// row chip colour: any failure is red; green = pull; cyan = research-ish and build; amber = show-making
const KIND_CHIP: Record<string, string> = { pull: 'ok', research: 'info', expand: 'info', web: 'info', build: 'info', briefing: 'warn', cast: 'warn' }
const WINDOWS: [string, string][] = [['1h', 'LAST HOUR'], ['24h', 'LAST 24H'], ['48h', 'LAST 48H'], ['7d', 'LAST 7 DAYS'], ['all', 'ALL TIME']]
const LIMITS = [200, 500, 1000]
const REFRESH_MS = 5000
const STORE = 'tsg_log_filters'

type Ev = { ts: string; kind: string; stage?: string; ok: boolean; beat?: string | null; ref?: string | null; ms?: number | null; summary: string; error?: string | null; meta?: Record<string, any> }
type Counts = { total: number; errors: number; byKind: Record<string, number>; byBeat: Record<string, number>; file_total: number }
const EMPTY: Counts = { total: 0, errors: 0, byKind: {}, byBeat: {}, file_total: 0 }

function fmtMs(ms?: number | null) {
  if (ms == null || !Number.isFinite(ms)) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s`
}
function when(ts: string) {
  const t = new Date(ts).getTime()
  if (isNaN(t)) return { text: ts, exact: ts }
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  return { text: s < 60 ? `${s}s ago` : ago(ts).text, exact: `${new Date(t).toLocaleString()}\n${ts}` }
}
function tip(e: Ev) {
  const meta = e.meta ? Object.entries(e.meta).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n') : ''
  return meta ? `${e.summary}\n\n${meta}` : e.summary
}
const chipStyle = (on: boolean, has: boolean) => ({ cursor: 'pointer', background: on ? 'oklch(1 0 0 / 0.06)' : 'transparent', opacity: on || has ? 1 : 0.45 })
const selStyle = { width: 'auto', padding: '4px 6px' }
const labelStyle = { display: 'flex', alignItems: 'center', gap: 6 } as const

export default function LogPage() {
  const [kinds, setKinds] = useState<string[]>([])
  const [beat, setBeat] = useState('')
  const [win, setWin] = useState('24h')
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [q, setQ] = useState('')
  const [qd, setQd] = useState('')
  const [limit, setLimit] = useState(200)
  const [auto, setAuto] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [events, setEvents] = useState<Ev[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  // restore the last filter set once, then keep it persisted (per browser)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null')
      if (s) {
        if (Array.isArray(s.kinds)) setKinds(s.kinds.filter((k: any) => typeof k === 'string'))
        if (typeof s.beat === 'string') setBeat(s.beat)
        if (WINDOWS.some(([v]) => v === s.win)) setWin(s.win)
        if (typeof s.errorsOnly === 'boolean') setErrorsOnly(s.errorsOnly)
        if (typeof s.auto === 'boolean') setAuto(s.auto)
        if (LIMITS.includes(s.limit)) setLimit(s.limit)
      }
    } catch {}
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORE, JSON.stringify({ kinds, beat, win, errorsOnly, auto, limit })) } catch {}
  }, [hydrated, kinds, beat, win, errorsOnly, auto, limit])

  // debounce the free-text filter so typing does not hammer the file
  useEffect(() => { const t = setTimeout(() => setQd(q.trim()), 250); return () => clearTimeout(t) }, [q])

  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (kinds.length) p.set('kind', kinds.join(','))
    if (beat) p.set('beat', beat)
    if (win !== 'all') p.set('since', win)
    if (qd) p.set('q', qd)
    if (errorsOnly) p.set('errors', '1')
    p.set('limit', String(limit))
    return '/api/command/log?' + p.toString()
  }, [kinds, beat, win, qd, errorsOnly, limit])

  const load = useCallback(async () => {
    try {
      const r = await fetch(url, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'log read failed')
      setEvents(Array.isArray(j.events) ? j.events : [])
      setCounts({ ...EMPTY, ...(j.counts || {}) })
      setErr(null)
      setFetchedAt(Date.now())
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setLoading(false) }
  }, [url])

  useEffect(() => { if (hydrated) load() }, [hydrated, load])
  // polls regardless of tab visibility on purpose: embedded webviews and OBS browser sources report
  // document.hidden=true, and a control-room log that silently goes stale is worse than a cheap local read
  useEffect(() => {
    if (!auto || !hydrated) return
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [auto, hydrated, load])

  const toggleKind = (k: string) => setKinds(cur => cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k])
  const clearFilters = () => { setKinds([]); setBeat(''); setErrorsOnly(false); setQ(''); setWin('24h') }
  const anyFilter = kinds.length > 0 || !!beat || errorsOnly || !!qd || win !== '24h'

  // known kinds first (pipeline order), then anything unexpected the file contains
  const kindList = useMemo(() => [...KINDS, ...Object.keys(counts.byKind).filter(k => !KINDS.includes(k)).sort()], [counts])
  const beatList = useMemo(() => { const s = new Set(Object.keys(counts.byBeat)); if (beat) s.add(beat); return Array.from(s).sort() }, [counts, beat])
  const allCount = useMemo(() => Object.values(counts.byKind).reduce((a, b) => a + b, 0), [counts])
  const windowLabel = (WINDOWS.find(([v]) => v === win) || WINDOWS[1])[1]

  return (
    <div className="p-6 space-y-4" style={{ maxWidth: 1320 }}>
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.12em' }}>THE LOG</span>
        <span className="cmd-kbd">ACTIVITY · every pipeline action, one line · newest first · pull → topics → cluster → leads → expand → rank → research → web → briefing → cast → build</span>
        <span className="cmd-kbd ml-auto" style={{ whiteSpace: 'nowrap' }}>
          {counts.total} events · <span style={{ color: counts.errors ? 'var(--cmd-red)' : 'inherit' }}>{counts.errors} errors</span>
          {fetchedAt ? ` · refreshed ${when(new Date(fetchedAt).toISOString()).text}` : ''}
        </span>
      </div>

      {/* FILTERS */}
      <section className="cmd-panel p-3 space-y-3">
        <div className="flex gap-1 flex-wrap items-center">
          <span className="cmd-kbd" style={{ marginRight: 4 }}>KIND</span>
          <button className={`chip ${kinds.length ? '' : 'warn'}`} style={chipStyle(!kinds.length, true)} onClick={() => setKinds([])} title="every kind">ALL <b>{allCount}</b></button>
          {kindList.map(k => {
            const on = kinds.includes(k)
            const n = counts.byKind[k] || 0
            return (
              <button key={k} className={`chip ${on ? (KIND_CHIP[k] || 'warn') : ''}`} style={chipStyle(on, n > 0)} onClick={() => toggleKind(k)} title={`${n} ${k} event${n === 1 ? '' : 's'} in ${windowLabel.toLowerCase()} · click to toggle`}>
                {k.toUpperCase()} <b>{n}</b>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <label className="cmd-kbd" style={labelStyle}>WINDOW
            <select className="cmd-select" style={selStyle} value={win} onChange={e => setWin(e.target.value)}>
              {WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="cmd-kbd" style={labelStyle}>BEAT
            <select className="cmd-select" style={selStyle} value={beat} onChange={e => setBeat(e.target.value)}>
              <option value="">ALL BEATS</option>
              {beatList.map(b => <option key={b} value={b}>{b.toUpperCase()} ({counts.byBeat[b] || 0})</option>)}
            </select>
          </label>
          <button className={`chip ${errorsOnly ? 'err' : ''}`} style={chipStyle(errorsOnly, true)} onClick={() => setErrorsOnly(v => !v)} title="only failed actions">ERRORS ONLY <b>{counts.errors}</b></button>
          <input className="cmd-input" style={{ width: 'auto', flex: 1, minWidth: 220, padding: '5px 8px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="filter: a str_ or brf_ id, a beat, a word in the summary or the error" spellCheck={false} />
          <label className="cmd-kbd" style={labelStyle}>ROWS
            <select className="cmd-select" style={selStyle} value={limit} onChange={e => setLimit(Number(e.target.value))}>
              {LIMITS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button onClick={() => setAuto(a => !a)} className={`lamp ${auto ? 'on' : ''}`} style={{ background: 'transparent', border: '1px solid var(--cmd-line-hot)', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }} title="re-read the log every 5 seconds"><i />{auto ? 'LIVE · 5s' : 'PAUSED'}</button>
          <button className="cmd-btn ghost" style={{ padding: '5px 12px' }} onClick={load}>REFRESH</button>
          {anyFilter && <button className="cmd-btn ghost" style={{ padding: '5px 12px' }} onClick={clearFilters}>CLEAR</button>}
          {err && <span className="chip err" title={err}>{err}</span>}
        </div>
      </section>

      {/* THE LINES */}
      {loading ? (
        <section className="cmd-panel p-4"><div className="cmd-kbd">reading the log…</div></section>
      ) : events.length === 0 ? (
        <section className="cmd-panel p-4">
          <div className="cmd-kbd">
            {counts.file_total === 0
              ? 'nothing logged yet · run PULL on the DESK or RESEARCH in THE STRINGER and every action lands here as one line'
              : 'nothing matches these filters · widen the WINDOW, clear the KIND or BEAT filter, or switch off ERRORS ONLY'}
          </div>
        </section>
      ) : (
        <section className="cmd-panel" style={{ overflowX: 'auto' }}>
          <table className="cmd-table" style={{ minWidth: 980 }}>
            <thead>
              <tr><th>WHEN</th><th>KIND</th><th>STAGE</th><th>BEAT</th><th>REF</th><th style={{ textAlign: 'right' }}>TOOK</th><th>SUMMARY</th><th>ERROR</th></tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                const w = when(e.ts)
                return (
                  <tr key={`${e.ts}:${i}`} style={e.ok ? undefined : { background: 'oklch(0.6 0.24 27 / 0.07)' }}>
                    <td className="cmd-kbd" style={{ whiteSpace: 'nowrap' }} title={w.exact}>{w.text}</td>
                    <td><span className={`chip ${e.ok ? (KIND_CHIP[e.kind] || '') : 'err'}`}>{String(e.kind || '?').toUpperCase()}</span></td>
                    <td className="cmd-kbd" style={{ whiteSpace: 'nowrap' }}>{e.stage || '·'}</td>
                    <td className="cmd-kbd" style={{ whiteSpace: 'nowrap' }}>{e.beat || '·'}</td>
                    <td style={{ color: 'var(--cmd-amber)', whiteSpace: 'nowrap' }} title={e.ref || ''}>{e.ref || '·'}</td>
                    <td className="cmd-kbd" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMs(e.ms)}</td>
                    <td style={{ width: '100%', maxWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: e.ok ? 'var(--cmd-ink)' : 'var(--cmd-dim)' }} title={tip(e)}>{e.summary}</div>
                    </td>
                    <td>{e.error ? <span className="chip err" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={e.error}>{e.error}</span> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      <div className="cmd-kbd">
        showing {events.length} of {counts.total} in {windowLabel.toLowerCase()}{counts.total > events.length ? ' · raise ROWS to see more' : ''} · {counts.file_total} lines in lab/logs/activity.jsonl · append-only
      </div>
    </div>
  )
}
