'use client'
import { useEffect, useState } from 'react'
import Clusters from './Clusters'

// The Story Resolution Loop, driven: pull (on DESK) -> CLUSTER -> MINE LEADS -> EXPAND a lead into a
// dossier -> RANK stories for show value. Every stage reads its last saved run on mount.
const BANDCHIP: Record<string, string> = { auto: 'err', expand: 'warn', store: 'info', ignore: '' }
const KINDCHIP: Record<string, string> = { story: 'ok', substory: 'info', topic: '' }
// attribution mode = how hard the hosts attribute claims (cite-or-cut doctrine; A = sourced & committed)
const ATTR: Record<string, string> = { A: 'A · sourced & committed', B: 'B · named source', C: 'C · platform', D: 'D · reported', E: 'E · word on the street', F: 'F · bare facts' }
const activePolls = new Set<string>()   // one status poller per show slug, across re-renders

export default function Discovery() {
  const [clusters, setClusters] = useState<any[]>([])
  const [clustersFile, setClustersFile] = useState<string | null>(null)   // which clusters_*.json the human edits attach to
  const [leads, setLeads] = useState<any[]>([])
  const [ranked, setRanked] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, any>>({})
  const [build, setBuild] = useState<Record<string, any>>({})   // keyed by story title (stable across re-ranks), mirrored in localStorage
  const [autoBusy, setAutoBusy] = useState(false)
  const [attribution, setAttribution] = useState('A')

  useEffect(() => {
    fetch('/api/command/cluster').then(r => r.json()).then(j => { setClusters(j?.clusters?.clusters || []); setClustersFile(j?.clusters?.file || null) }).catch(() => {})
    fetch('/api/command/leads').then(r => r.json()).then(j => setLeads(j?.queue?.leads || [])).catch(() => {})
    fetch('/api/command/producer-rank').then(r => r.json()).then(j => setRanked(j?.ranking?.ranked || [])).catch(() => {})
  }, [])

  const run = async (key: string, url: string, apply: (j: any) => void) => {
    setBusy(key); setErr(null)
    try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const j = await r.json(); if (j.ok) apply(j); else setErr(j.error || key + ' failed') }
    catch (e: any) { setErr(String(e?.message || e)) } finally { setBusy(null) }
  }
  const expand = async (lead: any) => {
    setExpanded(x => ({ ...x, [lead.id]: { busy: true } }))
    try {
      const r = await fetch('/api/command/expand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead }) })
      const j = await r.json()
      setExpanded(x => ({ ...x, [lead.id]: j.ok ? { dossier_id: j.expanded.dossier_id, mode: j.expanded.mode, evidence: j.dossier?.evidence?.length } : { error: j.error || 'expand failed' } }))
    } catch (e: any) { setExpanded(x => ({ ...x, [lead.id]: { error: String(e?.message || e) } })) }
  }
  // self-drive: chase every AUTO (80+) lead into evidence, one at a time
  const expandAllAuto = async () => {
    setAutoBusy(true)
    for (const l of leads.filter((x: any) => x.band === 'auto' && !expanded[x.id]?.dossier_id && !expanded[x.id]?.busy)) { await expand(l) }
    setAutoBusy(false)
  }

  // ---- one-click STORY -> SHOW, persisted per story so a reload or a rail hop never loses it ----
  const BUILDS_KEY = 'tsg_builds'
  const TERMINAL = ['done', 'error', 'cancelled']
  const readBuilds = (): Record<string, any> => { try { const v = JSON.parse(localStorage.getItem(BUILDS_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {} } catch { return {} } }
  const updateBuild = (key: string, v: any) => {
    const all = readBuilds(); all[key] = { ...(all[key] || {}), ...v }
    try { localStorage.setItem(BUILDS_KEY, JSON.stringify(all)) } catch {}
    setBuild(x => ({ ...x, [key]: all[key] }))
  }
  const post = (u: string, b: any) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
  const tidy = (s: string) => String(s || '').trim().replace(/[?.!\s]+$/g, '')
  const composeQuestion = (story: any) => (story.contrasting_viewpoints?.length >= 2)
    ? `${tidy(story.title)}: ${tidy(story.contrasting_viewpoints[0])}, or ${tidy(story.contrasting_viewpoints[1])}?`
    : (/\?$/.test(String(story.best_angle || '')) ? story.best_angle : `${tidy(story.best_angle || story.title)}?`)

  // poll a server job: real pct from status.json (floor heartbeats), stop on terminal/404, 25-min ceiling.
  // One poller per slug (a re-mount or a RETRY must never stack timers), transient 'reading' is not an error.
  const pollShow = (slug: string, key: string) => {
    if (activePolls.has(slug)) return
    activePolls.add(slug)
    const stop = () => activePolls.delete(slug)
    const tick = async () => {
      try {
        const r = await fetch('/api/command/showbuild?show=' + slug)
        if (r.status === 404) { updateBuild(key, { stage: 'error', error: 'the build is gone from the server (dir removed?)', failed_stage: null }); stop(); return }
        const st = (await r.json()).status || {}
        if (st.stage === 'done') { updateBuild(key, { stage: 'done', pct: 100, audio_url: st.audio_url, question: st.question, duration_s: st.duration_s, voice_engine: st.voice_engine, message: st.message, error: null }); stop(); return }
        if (st.stage === 'error' || st.stage === 'cancelled') { updateBuild(key, { stage: st.stage, error: st.error || st.message, failed_stage: st.failed_stage || null, message: st.message }); stop(); return }
        const startedAt = readBuilds()[key]?.startedAt || Date.now()
        if (Date.now() - startedAt > 25 * 60 * 1000) { updateBuild(key, { stage: 'error', error: 'build timed out after 25 min — check lab/shows/' + slug + '/status.json', failed_stage: st.stage || null }); stop(); return }
        if (!st.transient) updateBuild(key, { stage: st.stage || 'building', pct: Math.max(5, st.pct || 5), message: st.message })
        setTimeout(tick, 3000)
      } catch {
        const startedAt = readBuilds()[key]?.startedAt || Date.now()
        if (Date.now() - startedAt > 25 * 60 * 1000) { updateBuild(key, { stage: 'error', error: 'lost contact with the build for too long', failed_stage: null }); stop(); return }
        setTimeout(tick, 4000)
      }
    }
    tick()
  }
  // resume any build that was in flight when the page was left; a chain interrupted BEFORE the server
  // job existed (research/briefing/casting were awaited in this tab) can't resume — mark it so RETRY shows
  useEffect(() => {
    const saved = readBuilds(); setBuild(saved)
    for (const [k, v] of Object.entries<any>(saved)) {
      if (!v || TERMINAL.includes(v.stage)) continue
      if (v.slug) pollShow(v.slug, k)
      else updateBuild(k, { stage: 'error', error: `interrupted during ${v.stage || 'the chain'} before the build started (the page was left) — retry`, failed_stage: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startJob = async (key: string, bid: string, extra: any = {}) => {
    const j = await post('/api/command/showbuild', { briefing_id: bid, voice: true, attribution, ...extra })
    if (!j.ok) {
      if (j.show) { updateBuild(key, { slug: j.show, stage: 'building', message: j.error }); pollShow(j.show, key); return } // 409: attach to the running one
      throw new Error('build: ' + (j.error || ''))
    }
    updateBuild(key, { slug: j.show, stage: 'queued', pct: 1, message: 'starting…', startedAt: Date.now(), error: null, failed_stage: null })
    pollShow(j.show, key)
  }
  const buildShow = async (story: any) => {
    const key = story.title
    const q = composeQuestion(story)
    updateBuild(key, { stage: 'research', pct: 10, error: null, audio_url: null, question: q, startedAt: Date.now(), slug: null })
    try {
      let j = await post('/api/command/stringer', { input: { kind: 'subject', text: story.title, questions: [q], dual: true } })
      if (!j.ok) throw new Error('research: ' + (j.error || ''))
      const sid = j.id
      updateBuild(key, { stage: 'briefing', pct: 35, sid })
      j = await post('/api/command/briefing', { stringer_id: sid, final_question: q })
      if (!j.ok) throw new Error('briefing: ' + (j.error || ''))
      const bid = j.id
      updateBuild(key, { stage: 'casting', pct: 55, bid })
      j = await post('/api/command/briefing/agent', { briefing_id: bid, cast_ids: ['marcus-blaze', 'tasha-raw', 'king-knowledge'] })
      if (!j.ok) throw new Error('casting: ' + (j.error || ''))
      await startJob(key, bid)
    } catch (e: any) { updateBuild(key, { stage: 'error', error: String(e?.message || e) }) }
  }
  // retry without repaying research/briefing/cast: resume the same job dir from the stage that failed
  const retryBuild = async (story: any) => {
    const key = story.title, b = readBuilds()[key] || {}
    if (!b.bid) return buildShow(story)
    try {
      const from = ['compile', 'floor', 'audio'].includes(b.failed_stage) ? b.failed_stage : null
      await startJob(key, b.bid, from && b.slug ? { show: b.slug, from_stage: from } : {})
    } catch (e: any) { updateBuild(key, { stage: 'error', error: String(e?.message || e) }) }
  }
  const STAGE_HINT: Record<string, string> = { research: '60–90s', briefing: '~5s', casting: '~30s', queued: 'starting', compile: '~10s', floor: '2–3 min', scripted: 'written', audio: '~2–3 min' }

  const Btn = ({ k, url, apply, label, busyLabel }: any) => (
    <button className="cmd-btn primary" disabled={!!busy} onClick={() => run(k, url, apply)}>{busy === k ? busyLabel : label}</button>
  )

  return (
    <div className="p-6 space-y-6" style={{ maxWidth: 1080 }}>
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.12em' }}>THE STORY DESK</span>
        <span className="cmd-kbd">DISCOVERY · pull → cluster → leads → expand → rank · the object is the STORY, not the tweet</span>
      </div>

      {/* RUN THE LOOP */}
      <section className="cmd-panel p-4 space-y-3">
        <div className="cmd-kbd">runs over the latest X pull (run PULL on the DESK first). free, cheap models.</div>
        <div className="flex gap-3 flex-wrap">
          <Btn k="cluster" url="/api/command/cluster" label="① CLUSTER STORIES" busyLabel="FINGERPRINTING…" apply={(j: any) => { setClusters(j.clusters || []); setClustersFile(j.pulled_from ? String(j.pulled_from).replace(/^pull_/, 'clusters_') : null) }} />
          <Btn k="leads" url="/api/command/leads" label="② MINE LEADS" busyLabel="MINING…" apply={(j: any) => { setLeads(j.leads || []); setExpanded({}) }} />
          <Btn k="rank" url="/api/command/producer-rank" label="③ RANK FOR SHOW" busyLabel="RANKING…" apply={(j: any) => setRanked(j.ranked || [])} />
          {err && <span className="chip err">{err}</span>}
        </div>
      </section>

      {/* PRODUCER RANKING — what's worth a show */}
      {ranked.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="cmd-label" style={{ color: 'var(--cmd-red)', margin: 0 }}>WORTH A SHOW? — producer story value (contrasting viewpoints weighted first)</span>
            <label className="cmd-kbd" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>ATTRIBUTION
              <select className="cmd-select" style={{ width: 'auto', padding: '3px 6px' }} value={attribution} onChange={e => setAttribution(e.target.value)} title="how the hosts attribute claims when they build the show">
                {Object.entries(ATTR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          {ranked.map((s: any, i: number) => (
            <div key={i} className="cmd-panel p-3" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="cmd-display" style={{ fontSize: 14, color: 'var(--cmd-ink)' }}>{s.title}</span>
                {s.debatable && <span className="chip ok">DEBATABLE</span>}
                {s.best_format && <span className="chip info">{String(s.best_format).toUpperCase()}</span>}
                <span className="cmd-kbd ml-auto">SHOW VALUE {s.show_value}</span>
              </div>
              {s.rationale && <div style={{ color: 'var(--cmd-dim)', fontSize: 13, lineHeight: 1.5 }}>{s.rationale}</div>}
              {(s.contrasting_viewpoints || []).length > 0 && <div className="flex gap-1 flex-wrap">{s.contrasting_viewpoints.map((v: string, k: number) => <span key={k} className="chip warn">{v}</span>)}</div>}
              {s.best_angle && <div className="cmd-kbd">angle: {s.best_angle}</div>}
              <div className="flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--cmd-line)', paddingTop: 7, marginTop: 1 }}>
                {(() => {
                  const b = build[s.title]
                  if (b?.stage === 'done' && b.audio_url) return <>
                    <span className="chip ok">SHOW READY{b.duration_s ? ` · ${Math.floor(b.duration_s / 60)}:${String(b.duration_s % 60).padStart(2, '0')}` : ''}</span>
                    {b.voice_engine === 'kokoro' && <span className="chip warn" title={b.message}>KOKORO DRAFT</span>}
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={b.audio_url} style={{ height: 32, flex: 1, minWidth: 240 }} />
                    <a className="cmd-btn ghost" href={b.audio_url + '?download=1'} style={{ textDecoration: 'none' }}>⬇ MP3</a>
                    <button className="cmd-btn ghost" onClick={() => buildShow(s)}>↻ BUILD AGAIN</button>
                  </>
                  if (b && !['error', 'cancelled'].includes(b.stage)) {
                    const mins = b.startedAt ? Math.floor((Date.now() - b.startedAt) / 60000) : 0
                    return <span role="status" aria-live="polite" className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>
                      building… <b>{b.stage}</b> {b.pct}%{STAGE_HINT[b.stage] ? ` (${STAGE_HINT[b.stage]})` : ''}{b.message ? ` — ${b.message}` : ''}{mins ? ` · ${mins} min elapsed` : ''}{b.slug ? ` · ${b.slug}` : ''}
                    </span>
                  }
                  return <>
                    {b?.stage && <details style={{ maxWidth: '100%' }}><summary className="chip err" style={{ cursor: 'pointer', display: 'inline-block' }} title={b.error}>{b.stage === 'cancelled' ? 'CANCELLED' : 'FAILED'}{b.failed_stage ? ` at ${b.failed_stage}` : ''} · details</summary><div className="cmd-kbd" style={{ whiteSpace: 'pre-wrap', color: 'var(--cmd-dim)', marginTop: 4 }}>{b.error}</div></details>}
                    {b?.bid
                      ? <><button className="cmd-btn" onClick={() => retryBuild(s)}>↻ RETRY{['compile', 'floor', 'audio'].includes(b.failed_stage) && b.slug ? ` FROM ${String(b.failed_stage).toUpperCase()}` : ''}</button><button className="cmd-btn ghost" onClick={() => buildShow(s)}>REBUILD FROM RESEARCH</button></>
                      : <button className="cmd-btn" onClick={() => buildShow(s)}>▶ BUILD THIS SHOW</button>}
                    <span className="cmd-kbd">research → brief → cast → floor → audio</span>
                  </>
                })()}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* STORY CLUSTERS — the AI groups by EVENT; the human can pin / rename / merge / split / dismiss (persisted) */}
      {clusters.length > 0 && <Clusters clusters={clusters} file={clustersFile} onChange={setClusters} />}

      {/* LEAD QUEUE */}
      {leads.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="cmd-label" style={{ color: 'var(--cmd-red)' }}>RESEARCH LEAD QUEUE — chase the 80+, expand any lead into evidence</span>
            {leads.filter((l: any) => l.band === 'auto').length > 0 && <button className="cmd-btn ghost" disabled={autoBusy} onClick={expandAllAuto}>{autoBusy ? 'CHASING AUTO…' : `⚡ EXPAND ALL AUTO (${leads.filter((l: any) => l.band === 'auto').length})`}</button>}
          </div>
          {['auto', 'expand', 'store'].map(bnd => {
            const group = leads.filter((l: any) => l.band === bnd)
            if (!group.length) return null
            return (
              <div key={bnd} className="space-y-1">
                <div className="cmd-kbd" style={{ color: bnd === 'auto' ? 'var(--cmd-red)' : 'var(--cmd-dim)' }}>{bnd === 'auto' ? 'AUTO-INVESTIGATE (80+)' : bnd === 'expand' ? 'EXPAND (60-79)' : 'STORED (40-59)'} · {group.length}</div>
                {group.map((l: any) => {
                  const ex = expanded[l.id]
                  return (
                    <div key={l.id} className="cmd-panel p-2" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`chip ${BANDCHIP[l.band] || ''}`}>{l.score}</span>
                      <span className="cmd-kbd">{l.type}</span>
                      <span className="cmd-kbd" style={{ color: 'var(--cmd-cyan)' }}>{l.destination}</span>
                      {(l.since || l.until) && <span className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }} title="X full-archive window">📅 {l.since || '…'}→{l.until || '…'}</span>}
                      <span style={{ color: 'var(--cmd-ink)', fontSize: 13 }}>{l.value}</span>
                      {ex?.dossier_id
                        ? <span className="chip ok ml-auto" title={`${ex.evidence} evidence · mode ${ex.mode}`}>→ {ex.dossier_id} ({ex.evidence})</span>
                        : <span className="ml-auto flex items-center gap-2">
                            {ex?.error && <span className="chip err" title={String(ex.error)}>{String(ex.error).slice(0, 28)}</span>}
                            <button className="cmd-btn ghost" disabled={ex?.busy} onClick={() => expand(l)} style={{ whiteSpace: 'nowrap' }} title={`Expand digs a research lead into evidence. The number is its relevance score; the str_… id is where the result is stored.\nsearch: ${l.query}`}>{ex?.busy ? 'EXPANDING…' : ex?.error ? 'RETRY →' : 'EXPAND →'}</button>
                          </span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </section>
      )}

      {!clusters.length && !leads.length && !ranked.length && (
        <section className="cmd-panel p-4"><div className="cmd-kbd">no runs yet. run PULL on the DESK, then ① CLUSTER · ② MINE LEADS · ③ RANK above. expanding a lead produces a cited dossier in THE STRINGER you can brief into a show.</div></section>
      )}
    </div>
  )
}
