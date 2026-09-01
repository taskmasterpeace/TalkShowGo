'use client'
import { useEffect, useState } from 'react'

// The Story Resolution Loop, driven: pull (on DESK) -> CLUSTER -> MINE LEADS -> EXPAND a lead into a
// dossier -> RANK stories for show value. Every stage reads its last saved run on mount.
const BANDCHIP: Record<string, string> = { auto: 'err', expand: 'warn', store: 'info', ignore: '' }
const KINDCHIP: Record<string, string> = { story: 'ok', substory: 'info', topic: '' }

export default function Discovery() {
  const [clusters, setClusters] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [ranked, setRanked] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, any>>({})
  const [build, setBuild] = useState<Record<number, any>>({})
  const [autoBusy, setAutoBusy] = useState(false)

  useEffect(() => {
    fetch('/api/command/cluster').then(r => r.json()).then(j => setClusters(j?.clusters?.clusters || [])).catch(() => {})
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
    for (const l of leads.filter((x: any) => x.band === 'auto' && !expanded[x.id]?.dossier_id)) { await expand(l) }
    setAutoBusy(false)
  }

  // one-click STORY -> SHOW: research -> briefing -> cast -> build+voice (the whole pipeline)
  const buildShow = async (story: any, i: number) => {
    const setB = (v: any) => setBuild(x => ({ ...x, [i]: { ...(x[i] || {}), ...v } }))
    const q = (story.contrasting_viewpoints?.length >= 2) ? `${story.title}: ${story.contrasting_viewpoints[0]} or ${story.contrasting_viewpoints[1]}?` : (story.best_angle || story.title)
    const post = (u: string, b: any) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
    setB({ stage: 'research', pct: 10, error: null, audio_url: null })
    try {
      let j = await post('/api/command/stringer', { input: { kind: 'subject', text: story.title, questions: [q], dual: true } })
      if (!j.ok) throw new Error('research: ' + (j.error || ''))
      const sid = j.id
      setB({ stage: 'briefing', pct: 35 })
      j = await post('/api/command/briefing', { stringer_id: sid, final_question: q })
      if (!j.ok) throw new Error('briefing: ' + (j.error || ''))
      const bid = j.id
      setB({ stage: 'casting', pct: 55 })
      j = await post('/api/command/briefing/agent', { briefing_id: bid, cast_ids: ['marcus-blaze', 'tasha-raw', 'king-knowledge'] })
      if (!j.ok) throw new Error('casting: ' + (j.error || ''))
      setB({ stage: 'building', pct: 70 })
      j = await post('/api/command/showbuild', { briefing_id: bid, voice: true })
      if (!j.ok) throw new Error('build: ' + (j.error || ''))
      const slug = j.show
      const poll = async () => {
        try {
          const st = (await fetch('/api/command/showbuild?show=' + slug).then(r => r.json())).status || {}
          if (st.stage === 'done') setB({ stage: 'done', pct: 100, audio_url: st.audio_url, question: st.question, duration_s: st.duration_s })
          else if (st.stage === 'error') setB({ stage: 'error', error: st.message })
          else { setB({ stage: st.stage || 'building', pct: Math.max(70, st.pct || 70), message: st.message }); setTimeout(poll, 3000) }
        } catch { setTimeout(poll, 4000) }
      }
      poll()
    } catch (e: any) { setB({ stage: 'error', error: String(e?.message || e) }) }
  }

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
          <Btn k="cluster" url="/api/command/cluster" label="① CLUSTER STORIES" busyLabel="FINGERPRINTING…" apply={(j: any) => setClusters(j.clusters || [])} />
          <Btn k="leads" url="/api/command/leads" label="② MINE LEADS" busyLabel="MINING…" apply={(j: any) => { setLeads(j.leads || []); setExpanded({}) }} />
          <Btn k="rank" url="/api/command/producer-rank" label="③ RANK FOR SHOW" busyLabel="RANKING…" apply={(j: any) => setRanked(j.ranked || [])} />
          {err && <span className="chip err">{err}</span>}
        </div>
      </section>

      {/* PRODUCER RANKING — what's worth a show */}
      {ranked.length > 0 && (
        <section className="space-y-2">
          <div className="cmd-label" style={{ color: 'var(--cmd-red)' }}>WORTH A SHOW? — producer story value (contrasting viewpoints weighted first)</div>
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
                  const b = build[i]
                  if (b?.audio_url) return <><span className="chip ok">SHOW READY{b.duration_s ? ` · ${Math.floor(b.duration_s / 60)}:${String(b.duration_s % 60).padStart(2, '0')}` : ''}</span>{/* eslint-disable-next-line jsx-a11y/media-has-caption */}<audio controls src={b.audio_url} style={{ height: 32, flex: 1, minWidth: 240 }} /></>
                  if (b && b.stage !== 'error') return <span className="cmd-kbd">building show… [{b.pct}%] {b.stage}{b.message ? ' — ' + b.message : ''}</span>
                  return <>{b?.stage === 'error' && <span className="chip err" title={b.error}>{String(b.error).slice(0, 44)}</span>}<button className="cmd-btn" onClick={() => buildShow(s, i)}>▶ BUILD THIS SHOW</button><span className="cmd-kbd">research → brief → cast → floor → audio</span></>
                })()}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* STORY CLUSTERS */}
      {clusters.length > 0 && (
        <section className="space-y-2">
          <div className="cmd-label" style={{ color: 'var(--cmd-cyan)' }}>STORY CLUSTERS — grouped by EVENT, not topic</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(460px,1fr))' }}>
            {clusters.map((c: any, i: number) => (
              <div key={i} className="cmd-panel p-3" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`chip ${KINDCHIP[c.kind] || ''}`}>{String(c.kind || 'topic').toUpperCase()}</span>
                  <span className="cmd-display" style={{ fontSize: 13.5, color: 'var(--cmd-ink)' }}>{c.title}</span>
                </div>
                {c.event_fingerprint && <div style={{ color: 'var(--cmd-dim)', fontSize: 12.5, lineHeight: 1.5 }}><b style={{ color: 'var(--cmd-cyan)' }}>{c.event_fingerprint.subject} </b>{c.event_fingerprint.action} {c.event_fingerprint.object}{c.event_fingerprint.claim ? ` — ${c.event_fingerprint.claim}` : ''}</div>}
                {c.why_moving && <div style={{ color: 'var(--cmd-dim)', fontSize: 12.5 }}>{c.why_moving}</div>}
                <div className="flex gap-1 flex-wrap items-center">
                  {(c.shared_signals || []).slice(0, 5).map((sig: string, k: number) => <span key={k} className="cmd-kbd" style={{ fontSize: 10 }}>{sig}</span>)}
                  <span className="cmd-kbd ml-auto">{(c.evidence || c.item_indices || []).length} items</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
                      <span style={{ color: 'var(--cmd-ink)', fontSize: 13 }}>{l.value}</span>
                      {ex?.dossier_id
                        ? <span className="chip ok ml-auto" title={`${ex.evidence} evidence · mode ${ex.mode}`}>→ {ex.dossier_id} ({ex.evidence})</span>
                        : <span className="ml-auto flex items-center gap-2">
                            {ex?.error && <span className="chip err" title={String(ex.error)}>{String(ex.error).slice(0, 28)}</span>}
                            <button className="cmd-btn ghost" disabled={ex?.busy} onClick={() => expand(l)} style={{ whiteSpace: 'nowrap' }} title={`search: ${l.query}`}>{ex?.busy ? 'EXPANDING…' : ex?.error ? 'RETRY →' : 'EXPAND →'}</button>
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
