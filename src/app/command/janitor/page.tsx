'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useCmdState, useBeat, BeatPicker, Flash, ago } from '../lib'

// THE JANITOR — the beat's maintenance crew. Five positions each make their own decisions over the beat's
// evidence; the safe ones are applied on the spot (green), the rest wait here for a human (APPLY / DISMISS).
// Robert, 2026-09-02: "every position should be making multiple decisions ... I need you to describe to me how
// things work" — so HOW IT WORKS stays on the page, in plain words, next to what each position just did.
const POSITIONS: { key: string; name: string; does: string; auto: string }[] = [
  { key: 'source_auditor', name: 'SOURCE AUDITOR', does: 'Reads the last 5 pulls per source and calls it: healthy, quiet (no item in 7 days), dead (30 days), or broken id (a YouTube id Innertube cannot open).', auto: 'repairs a broken YouTube id by re-resolving the name · proposes retiring a dead or NOT FOUND source' },
  { key: 'squatter_watch', name: 'SQUATTER WATCH', does: 'An X row with under 100 followers on a league/media label, or a display name that shares no word with its label (the handle counts), is not who the label says.', auto: 'sets the row to SUSPECT (the pull skips it; nothing is deleted) · a big account with a mismatched name is a note to eyeball' },
  { key: 'scout_explore', name: 'SCOUT EXPLORE', does: 'Scouts the beat\'s own topics (its cases, the top 3 story clusters, the show name) for channels the beat has never used: 3+ videos in a week, a real id, never surfaced before.', auto: 'proposes each channel; you ADD or DISMISS (a dismissed channel is never suggested again)' },
  { key: 'window_tuner', name: 'WINDOW TUNER', does: 'Three thin pulls in a row (under 5 items on average) means the window is too short for how often these sources post.', auto: 'proposes the next step: 24 → 48 → 72 → 168h; at 168 it says the sources are the problem' },
  { key: 'housekeeper', name: 'HOUSEKEEPER', does: 'Run files older than 14 days that no show references, and an activity log past 20MB, are clutter.', auto: 'moves stale run files to lab/runs/_pruned/ (never the newest of a kind) · rotates the log with a date suffix' },
]
const ACTION_LABEL: Record<string, string> = { flag_suspect: 'FLAG SUSPECT', retire_source: 'RETIRE SOURCE', repair_id: 'REPAIR ID', add_channel: 'ADD CHANNEL', widen_window: 'WIDEN WINDOW', prune_runs: 'PRUNE RUNS', rotate_log: 'ROTATE LOG' }
// anything that takes a row or a file out of play asks first (it moves, never deletes, but it changes what the pull sees)
const CONFIRM: Record<string, string> = {
  retire_source: 'Retire this source? It leaves the active list and moves to sources.retired in the beat file (nothing is deleted; a human can move it back by editing the beat).',
  prune_runs: 'Move these run files to lab/runs/_pruned/? Nothing is deleted.',
  rotate_log: 'Rotate the activity log? The current file is renamed with today\'s date and a fresh log starts.',
}
const STATUS_CHIP: Record<string, string> = { applied: 'ok', pending: 'warn', failed: 'err', dismissed: '' }
const fmtMs = (ms?: number | null) => ms == null ? '' : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`

export default function Janitor() {
  const { state } = useCmdState()
  const [report, setReport] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [showHow, setShowHow] = useState(true)
  useEffect(() => { try { if (localStorage.getItem('tsg_janitor_how') === '0') setShowHow(false) } catch {} }, [])
  const toggleHow = () => { const n = !showHow; setShowHow(n); try { localStorage.setItem('tsg_janitor_how', n ? '1' : '0') } catch {} }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { beat, beats, pick } = useBeat(state)
  const beatId: string | null = beat ? (beat.id || String(beat.file || '').replace(/\.json$/, '')) : null

  const load = useCallback(async (file?: string | null) => {
    if (!beatId) return
    try {
      const r = await fetch(`/api/command/janitor?beat=${encodeURIComponent(beatId)}${file ? `&file=${encodeURIComponent(file)}` : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'load failed')
      setReport(j.latest || null); setHistory(j.history || []); setErr(null)
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setLoaded(true) }
  }, [beatId])
  useEffect(() => { setLoaded(false); setReport(null); setHistory([]); load() }, [load])

  const post = async (body: any) => {
    const r = await fetch('/api/command/janitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ beat: beatId, ...body }) })
    const j = await r.json().catch(() => ({} as any))
    if (!r.ok || !j?.ok) throw new Error((j?.error || `http ${r.status}`) + (j?.stage ? ` [${j.stage}]` : ''))
    return j
  }
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 1800) }
  const run = async () => {
    if (busy || !beatId) return
    setBusy('run'); setErr(null)
    try { const j = await post({}); setReport(j.report); await load(j.report?.file); const s = j.report?.summary || {}; say(`SWEPT · ${s.applied || 0} APPLIED · ${s.pending || 0} PENDING`) }
    catch (e: any) { setErr(String(e?.message || e)) }
    finally { setBusy(null) }
  }
  const decide = async (p: any, verb: 'apply' | 'dismiss') => {
    if (busy) return
    if (verb === 'apply' && CONFIRM[p.action] && !window.confirm(CONFIRM[p.action])) return
    setBusy(`${verb}:${p.id}`); setErr(null)
    try {
      const j = await post({ [verb]: p.id })
      // the proposal may live in an older report than the one on screen: reload whichever is showing
      if (j.report?.file && report?.file === j.report.file) setReport(j.report); else await load(report?.file)
      setHistory(h => h.map(x => x.file === j.report?.file ? { ...x, summary: j.report.summary } : x))
      say(verb === 'apply' ? (j.proposal?.status === 'applied' ? 'APPLIED' : 'FAILED: ' + String(j.proposal?.result || '').slice(0, 60)) : 'DISMISSED')
    } catch (e: any) { setErr(String(e?.message || e)) }
    finally { setBusy(null) }
  }

  if (!state) return <div className="p-8 cmd-kbd">LOADING THE JANITOR...</div>
  if (!beat) return <div className="p-8 cmd-kbd">NO BEAT LOADED</div>
  const s = report?.summary || {}
  const ranAgo = ago(report?.ran_at)
  const isLatest = !!report && history[0]?.file === report.file

  const proposalRow = (p: any) => {
    const m = p.meta || {}
    const pending = p.status === 'pending' || p.status === 'failed'
    return (
      <tr key={p.id} style={p.status === 'dismissed' ? { opacity: 0.55 } : undefined}>
        <td style={{ whiteSpace: 'nowrap' }}><span className={`chip ${p.auto ? 'info' : 'warn'}`} title={p.auto ? 'the janitor does this on its own' : 'waits for a human'}>{ACTION_LABEL[p.action] || String(p.action).toUpperCase()}</span></td>
        <td style={{ minWidth: 170 }}>
          {p.action === 'add_channel' ? (
            <div className="flex items-center gap-2">
              <div><div style={{ color: 'var(--cmd-ink)' }}>{m.channel_name || p.target}</div>{m.handle && <div className="cmd-kbd" style={{ color: 'var(--cmd-cyan)' }}>{m.handle}</div>}</div>
              {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }} title="open the channel - eyeball it's the right one">↗</a>}
            </div>
          ) : <span style={{ color: 'var(--cmd-ink)' }}>{p.target}</span>}
          {p.carried && <div className="cmd-kbd">carried from an earlier sweep</div>}
        </td>
        <td style={{ color: 'var(--cmd-dim)' }}>
          {p.reason}
          {p.action === 'add_channel' && m.latest_title && <div className="cmd-kbd truncate" style={{ maxWidth: 360 }} title={m.latest_title}>{m.latest_url ? <a href={m.latest_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{m.latest_title}</a> : m.latest_title}</div>}
          {p.action === 'prune_runs' && Array.isArray(m.files) && <div className="cmd-kbd truncate" style={{ maxWidth: 360 }} title={m.files.join('\n')}>{m.files.slice(0, 3).join(' · ')}{m.files.length > 3 ? ` · +${m.files.length - 3}` : ''}</div>}
        </td>
        <td className="cmd-kbd" style={{ maxWidth: 300 }} title={p.result || ''}>{p.result ? <div className="truncate" style={{ maxWidth: 300 }}>{p.result}</div> : '·'}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <div className="flex items-center gap-2">
            <span className={`chip ${STATUS_CHIP[p.status] || ''}`} title={p.decided_at ? `decided ${new Date(p.decided_at).toLocaleString()}` : 'waiting for a human'}>{String(p.status).toUpperCase()}</span>
            {pending && <button className="cmd-btn ghost" style={{ padding: '4px 10px' }} disabled={busy !== null} onClick={() => decide(p, 'apply')}>{busy === `apply:${p.id}` ? '…' : p.status === 'failed' ? '↻ RETRY' : '✓ APPLY'}</button>}
            {pending && <button className="cmd-btn ghost" style={{ padding: '4px 10px' }} disabled={busy !== null} onClick={() => decide(p, 'dismiss')} title={p.action === 'add_channel' ? 'never suggest this channel again for this beat' : 'a no sticks: the same proposal stays dismissed on later sweeps'}>{busy === `dismiss:${p.id}` ? '…' : '✕ DISMISS'}</button>}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>THE JANITOR — {String(beat.show?.name || beat.name || beat.id).toUpperCase()}</span>
        <BeatPicker beats={beats} beat={beat} pick={pick} />
        {loaded && <span className={`chip ${report ? ranAgo.cls : 'err'}`}>{report ? `LAST SWEEP: ${ranAgo.text.toUpperCase()}` : 'NEVER SWEPT'}</span>}
        <Flash msg={flash} />
        <span className="ml-auto flex items-center gap-3">
          {err && <span className="chip err" title={err}>{err.slice(0, 120)}</span>}
          <button className="cmd-btn primary" disabled={busy !== null} onClick={run} title="every position decides; safe proposals are applied on the spot, the rest wait here">{busy === 'run' ? 'SWEEPING…' : '▶ RUN THE JANITOR'}</button>
        </span>
      </div>

      <div className="cmd-kbd">The maintenance crew audits your sources (dead handles, squatter accounts, silent ones) and proposes fixes. Apply or Dismiss each.</div>

      {/* HOW IT WORKS: the owner asked for the crew to be described, so it lives on the page */}
      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>HOW THE CREW WORKS</h2></div>
          <button className="chip" style={{ cursor: 'pointer' }} onClick={toggleHow}>{showHow ? 'HIDE' : 'SHOW'}</button>
        </div>
        {showHow && (
          <div className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5 text-xs" style={{ color: 'var(--cmd-dim)' }}>
            {POSITIONS.map(p => (
              <div key={p.key} className="cmd-grid-line p-3">
                <div className="cmd-display mb-1" style={{ letterSpacing: '0.08em', color: 'var(--cmd-ink)' }}>{p.name}</div>
                <div>{p.does}</div>
                <div className="mt-2" style={{ color: 'var(--cmd-amber)' }}>{p.auto}</div>
              </div>
            ))}
            <div className="md:col-span-2 xl:col-span-5 cmd-kbd">
              <span className="chip info">AUTO</span> = the janitor did it on its own (safe, reversible, logged) · <span className="chip warn">PENDING</span> = waits for you: APPLY or DISMISS · a dismissed proposal stays dismissed on later sweeps · every decision is one line in <Link href="/command/log" style={{ color: 'var(--cmd-amber)' }}>THE LOG</Link> under kind JANITOR · nothing is ever deleted (retired rows go to sources.retired, pruned files to lab/runs/_pruned/)
            </div>
          </div>
        )}
      </section>

      {!loaded ? (
        <section className="cmd-panel p-4"><div className="cmd-kbd">reading the last sweep…</div></section>
      ) : !report ? (
        <section className="cmd-panel p-8 text-center">
          <div className="cmd-display text-xl" style={{ letterSpacing: '0.1em' }}>NO SWEEP YET FOR {String(beat.name || beat.id).toUpperCase()}</div>
          <div className="cmd-kbd mt-2">run the janitor and the five positions read this beat&apos;s pulls, sources and run files, apply the safe fixes, and line up the rest for you</div>
          <button className="cmd-btn primary mt-4" disabled={busy !== null} onClick={run}>{busy === 'run' ? 'SWEEPING…' : '▶ RUN THE FIRST SWEEP'}</button>
        </section>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="cmd-kbd">SWEEP {new Date(report.ran_at).toLocaleString()} · took {fmtMs(report.ms)} · read {(report.pulls_read || []).length} pull{(report.pulls_read || []).length === 1 ? '' : 's'}</span>
            {!isLatest && <span className="chip warn">VIEWING AN OLDER SWEEP</span>}
            <span className="chip">{s.findings || 0} FINDINGS</span>
            <span className={`chip ${s.applied ? 'ok' : ''}`}>{s.applied || 0} APPLIED</span>
            <span className={`chip ${s.pending ? 'warn' : ''}`}>{s.pending || 0} PENDING</span>
            {s.failed > 0 && <span className="chip err">{s.failed} FAILED</span>}
            {s.dismissed > 0 && <span className="chip">{s.dismissed} DISMISSED</span>}
          </div>

          {(report.positions || []).map((pos: any) => {
            const meta = POSITIONS.find(p => p.key === pos.position)
            const applied = pos.proposals.filter((p: any) => p.status === 'applied').length
            const pending = pos.proposals.filter((p: any) => p.status === 'pending').length
            const failed = pos.proposals.filter((p: any) => p.status === 'failed').length
            return (
              <section key={pos.position} className="cmd-panel">
                <div className="cmd-h justify-between">
                  <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>{meta?.name || String(pos.position).toUpperCase()}</h2>
                    {applied > 0 && <span className="chip ok">{applied} APPLIED</span>}
                    {pending > 0 && <span className="chip warn">{pending} PENDING</span>}
                    {failed > 0 && <span className="chip err">{failed} FAILED</span>}
                    {pos.error && <span className="chip err" title={pos.error}>POSITION FAILED</span>}
                  </div>
                  <span className="cmd-kbd">{pos.findings.length} finding{pos.findings.length === 1 ? '' : 's'} · {pos.proposals.length} proposal{pos.proposals.length === 1 ? '' : 's'} · {fmtMs(pos.ms)}</span>
                </div>
                <div className="p-4 space-y-1">
                  {pos.findings.length === 0 && <div className="cmd-kbd">nothing to report</div>}
                  {pos.findings.map((f: string, i: number) => (
                    <div key={i} className="flex gap-2 text-xs" style={{ color: /SUSPECT|DEAD|BROKEN|failed|errored/.test(f) ? 'var(--cmd-amber)' : 'var(--cmd-dim)' }}><span style={{ color: 'var(--cmd-faint)' }}>·</span><span>{f}</span></div>
                  ))}
                </div>
                {pos.proposals.length > 0 && (
                  <div className="overflow-x-auto" style={{ borderTop: '1px solid var(--cmd-line)' }}>
                    <table className="cmd-table">
                      <thead><tr><th>ACTION</th><th>TARGET</th><th>WHY</th><th>RESULT</th><th>STATUS</th></tr></thead>
                      <tbody>{pos.proposals.map(proposalRow)}</tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}

          {/* HISTORY */}
          <section className="cmd-panel">
            <div className="cmd-h"><div className="vu"><i /><i /><i /><i /></div><h2>PAST SWEEPS</h2><span className="cmd-kbd">{history.length} on file · lab/janitor/{beatId}/</span></div>
            <div className="overflow-x-auto">
              <table className="cmd-table">
                <thead><tr><th>WHEN</th><th>FINDINGS</th><th>PROPOSALS</th><th>APPLIED</th><th>PENDING</th><th>FAILED</th><th>TOOK</th><th /></tr></thead>
                <tbody>
                  {history.map(h => {
                    const a = ago(h.ran_at)
                    const current = report?.file === h.file
                    return (
                      <tr key={h.file} style={current ? { background: 'oklch(1 0 0 / 0.035)' } : undefined}>
                        <td style={{ whiteSpace: 'nowrap' }} title={h.ran_at}><span className={`chip ${a.cls}`}>{a.text.toUpperCase()}</span> <span className="cmd-kbd">{new Date(h.ran_at).toLocaleString()}</span></td>
                        <td>{h.summary?.findings ?? 0}</td>
                        <td>{h.summary?.proposals ?? 0}</td>
                        <td style={{ color: h.summary?.applied ? 'var(--cmd-green)' : undefined }}>{h.summary?.applied ?? 0}</td>
                        <td style={{ color: h.summary?.pending ? 'var(--cmd-amber)' : undefined }}>{h.summary?.pending ?? 0}</td>
                        <td style={{ color: h.summary?.failed ? 'var(--cmd-red)' : undefined }}>{h.summary?.failed ?? 0}</td>
                        <td className="cmd-kbd">{fmtMs(h.ms)}</td>
                        <td>{current ? <span className="chip ok">SHOWING</span> : <button className="cmd-btn ghost" style={{ padding: '4px 10px' }} disabled={busy !== null} onClick={() => load(h.file)}>VIEW</button>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
