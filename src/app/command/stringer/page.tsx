'use client'
import { useState } from 'react'
import { useCmdState, useBeat, BeatPicker, ago } from '../lib'

const TL: Record<string, string> = { FACT: 'ok', ATTRIBUTED_CLAIM: 'info', ANALYSIS: 'warn' }
const KIND: Record<string, string> = { event: 'THE EVENT', stat: 'THE NUMBERS', tradeoff: 'THE TRADE-OFF', larger_context: 'THE BIGGER PICTURE', uncertainty: 'WHAT WE DON’T KNOW' }
const Lamp = ({ on, label }: { on: boolean | null | undefined; label: string }) => (
  <span className={`lamp ${on ? 'on' : on === false ? 'err' : ''}`}><i />{label}</span>
)

export default function Stringer() {
  const { state } = useCmdState()
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { beat, beats, pick } = useBeat(state)
  const [kind, setKind] = useState<'subject' | 'question'>('subject')
  const [text, setText] = useState('')
  const [qs, setQs] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  // briefing
  const [briefQ, setBriefQ] = useState('')
  const [bBusy, setBBusy] = useState(false)
  const [brief, setBrief] = useState<any>(null)
  const [step, setStep] = useState(0)
  // web supplement + cast briefs
  const [webBusy, setWebBusy] = useState(false)
  const [agents, setAgents] = useState<any>(null)
  const [aBusy, setABusy] = useState(false)
  const [deselected, setDeselected] = useState<Set<string>>(new Set())
  if (!state) return <div className="p-8 cmd-kbd">LOADING STRINGER…</div>

  const d = res
  const hosts: any[] = state.cast?.hosts || []
  const dnaById: Record<string, any> = Object.fromEntries(((state.models?.models) || []).map((m: any) => [m.id, m]))
  const recent: any[] = state.stringers || []

  const run = async () => {
    if (!text.trim()) return
    setBusy(true); setErr(null); setRes(null); setBrief(null); setAgents(null)
    try {
      const r = await fetch('/api/command/stringer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { kind, text, questions: qs.split('\n').map(s => s.trim()).filter(Boolean) }, beat_file: beat?.file }) })
      const j = await r.json(); if (!j.ok) setErr(j.error || 'stringer failed'); else setRes(j)
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setBusy(false) }
  }
  const buildBrief = async () => {
    if (!briefQ.trim() || !d) return
    setBBusy(true); setBrief(null); setStep(0); setAgents(null)
    try {
      const r = await fetch('/api/command/briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stringer_id: d.id, final_question: briefQ }) })
      const j = await r.json(); if (j.ok) setBrief(j); else setErr(j.error || 'briefing failed')
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setBBusy(false) }
  }
  const supplementWeb = async () => {
    if (!d?.id) return
    setWebBusy(true); setErr(null)
    try {
      const r = await fetch('/api/command/stringer/web', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
      const j = await r.json(); if (j.ok) { setRes(j); setBrief(null); setAgents(null) } else setErr(j.error || 'web supplement failed')
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setWebBusy(false) }
  }
  const briefCast = async () => {
    if (!brief?.id) return
    const cast_ids = hosts.filter((h: any) => !deselected.has(h.id)).map((h: any) => h.id)
    if (!cast_ids.length) return
    setABusy(true); setAgents(null); setErr(null)
    try {
      const r = await fetch('/api/command/briefing/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ briefing_id: brief.id, cast_ids }) })
      const j = await r.json(); if (j.ok) setAgents(j); else setErr(j.error || 'cast brief failed')
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setABusy(false) }
  }

  return (
    <div className="p-6 space-y-6" style={{ maxWidth: 1000 }}>
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.12em' }}>THE STRINGER</span>
        <span className="cmd-kbd">RESEARCH DESK · YouTube-first, impartial, cited</span>
        <div className="flex gap-4 ml-auto">
          <Lamp on={state.health?.ytdlp} label="YT-DLP" />
          <Lamp on={state.health?.openrouter_key} label="OPENROUTER" />
          <Lamp on={state.health?.perplexity_key} label="PERPLEXITY" />
        </div>
      </div>

      {/* NEW ASSIGNMENT */}
      <section className="cmd-panel p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {(['subject', 'question'] as const).map(k => <button key={k} className={`chip ${kind === k ? 'err' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setKind(k)}>{k.toUpperCase()}</button>)}
          <BeatPicker beats={beats} beat={beat} pick={pick} />
          <span className="cmd-kbd">{beat ? `trusted: ${(beat.show?.name || beat.name || beat.id)}` : 'global YouTube'}</span>
        </div>
        <input className="cmd-input" placeholder={kind === 'subject' ? 'a subject or person to dig on (e.g. Tay Roc, the Lil Durk case)' : 'a specific question to answer'} value={text} onChange={e => setText(e.target.value)} />
        <textarea className="cmd-textarea" rows={2} placeholder="questions to answer, one per line (optional for a subject)" value={qs} onChange={e => setQs(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="cmd-btn primary" disabled={busy || !text.trim()} onClick={run}>{busy ? 'DIGGING…' : 'RESEARCH'}</button>
          {busy && <span className="cmd-kbd">searching YouTube → transcripts → impartial parse (30-90s)…</span>}
          {err && <span className="chip err">{err}</span>}
        </div>
      </section>

      {d && <>
        {/* audit strip */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`chip ${d.audit?.status === 'pass' ? 'ok' : 'warn'}`}>IMPARTIALITY: {String(d.audit?.status || '').toUpperCase()}</span>
          <span className="cmd-kbd">{d.audit?.distinct_publishers} publishers · {d.usage?.transcripts} transcripts · {(d.usage?.transcript_words || 0).toLocaleString()} words</span>
          {d.audit?.needs_web && <span className="chip warn" title="thin coverage - a web supplement would strengthen this">NEEDS WEB</span>}
          <button className="cmd-btn ghost" disabled={webBusy} onClick={supplementWeb} style={{ marginLeft: 'auto', borderColor: d.audit?.needs_web ? 'var(--cmd-cyan)' : undefined }} title="pull impartial web reporting (OpenRouter web → Perplexity) and merge cited evidence">{webBusy ? 'SEARCHING WEB…' : '+ SUPPLEMENT WITH WEB'}</button>
        </div>

        {/* ANSWER BOARD */}
        {(d.answers || []).length > 0 && (
          <section className="space-y-2">
            <div className="cmd-label" style={{ color: 'var(--cmd-red)' }}>ANSWER BOARD</div>
            {d.answers.map((a: any, i: number) => (
              <div key={i} className="cmd-panel p-4">
                <div className="cmd-display" style={{ fontSize: 15, color: 'var(--cmd-ink)' }}>{a.question}</div>
                <div style={{ color: 'var(--cmd-ink)', fontSize: 14, margin: '8px 0', lineHeight: 1.6 }}>{a.direct_answer}</div>
                <div className="flex gap-1 flex-wrap items-center">
                  <span className="cmd-kbd">{a.confidence?.toUpperCase()}</span>
                  {(a.evidence_ids || []).map((e: string) => <span key={e} className="chip info">{e}</span>)}
                  {(a.unknowns || []).map((u: string, k: number) => <span key={k} className="chip warn" title="open question">? {u}</span>)}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* THE BRIEFING builder */}
        <section className="cmd-panel-hot p-4 space-y-3">
          <div className="cmd-label" style={{ color: 'var(--cmd-red)' }}>THE BRIEFING — EARN THE TAKE</div>
          <div className="cmd-kbd">pick the question the show will ask; the briefing walks the context one move at a time, then asks it.</div>
          {(d.candidate_questions || []).length > 0 && (
            <div className="flex flex-col gap-1">
              {d.candidate_questions.map((q: string, i: number) => (
                <button key={i} className="flex items-center gap-2 text-left" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }} onClick={() => setBriefQ(q)}>
                  <span className={`chip ${briefQ === q ? 'err' : ''}`}>USE</span>
                  <span style={{ color: 'var(--cmd-dim)', fontSize: 13 }}>{q}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-center">
            <input className="cmd-input" placeholder="…or write the question" value={briefQ} onChange={e => setBriefQ(e.target.value)} />
            <button className="cmd-btn" disabled={bBusy || !briefQ.trim()} onClick={buildBrief} style={{ whiteSpace: 'nowrap' }}>{bBusy ? 'BUILDING…' : 'BUILD BRIEFING'}</button>
          </div>

          {brief && <>
            <div className="flex items-center gap-3 flex-wrap" style={{ paddingTop: 4 }}>
              <span className={`chip ${brief.audit?.status === 'pass' ? 'ok' : 'warn'}`}>NEUTRALITY: {String(brief.audit?.status || '').toUpperCase()}</span>
              {!brief.audit?.all_factual_moves_cited && <span className="chip err">uncited moves</span>}
              {!brief.audit?.question_is_non_leading && <span className="chip err">leading question</span>}
              <span className="cmd-kbd">{brief.moves?.length} moves</span>
            </div>
            {/* one-move player */}
            {(() => {
              const total = brief.moves.length
              const atQ = step >= total
              const m = brief.moves[Math.min(step, total - 1)]
              return (
                <div className="cmd-panel p-5" style={{ minHeight: 180, display: 'flex', flexDirection: 'column', gap: 10, borderColor: atQ ? 'var(--cmd-red)' : 'var(--cmd-line-hot)' }}>
                  <div className="flex justify-between items-center">
                    <span className="cmd-kbd" style={{ letterSpacing: '0.2em' }}>{atQ ? 'THE QUESTION' : `${KIND[m.kind] || m.kind} · MOVE ${String(step + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`}</span>
                    {!atQ && <span className="flex gap-1">{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: n <= (m.importance || 0) ? 'var(--cmd-amber)' : 'var(--cmd-line)' }} />)}</span>}
                  </div>
                  {atQ ? (
                    <div className="cmd-display" style={{ fontSize: 24, lineHeight: 1.2, color: 'var(--cmd-ink)', margin: 'auto 0' }}>{brief.question.text}</div>
                  ) : <>
                    <div className="cmd-display" style={{ fontSize: 19, lineHeight: 1.25, color: 'var(--cmd-ink)' }}>{m.headline}</div>
                    <div style={{ color: 'var(--cmd-dim)', fontSize: 14, lineHeight: 1.6 }}>{m.body}</div>
                    <div className="flex gap-1 flex-wrap items-center" style={{ marginTop: 'auto' }}>
                      <span className={`chip ${TL[m.truth_label] || ''}`}>{m.truth_label}</span>
                      {(m.evidence_ids || []).map((e: string) => <span key={e} className="chip info">{e}</span>)}
                      {m.uncited && <span className="chip err">UNCITED</span>}
                    </div>
                  </>}
                  <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--cmd-line)', paddingTop: 10 }}>
                    <button className="cmd-btn ghost" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>‹ BACK</button>
                    <span className="cmd-kbd">{atQ ? 'end of briefing' : 'reading one move at a time'}</span>
                    <button className="cmd-btn" disabled={atQ} onClick={() => setStep(s => s + 1)}>{step === total - 1 ? 'THE QUESTION ›' : 'NEXT ›'}</button>
                  </div>
                </div>
              )
            })()}

            {/* BRIEF THE CAST — each host earns a take on its own Model-DNA engine */}
            <div className="space-y-3" style={{ borderTop: '1px solid var(--cmd-line)', paddingTop: 14 }}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="cmd-label" style={{ color: 'var(--cmd-cyan)' }}>BRIEF THE CAST</span>
                <span className="cmd-kbd">each host reads the SAME briefing on its own engine, in character, citing only this evidence</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
                {hosts.map((h: any) => {
                  const on = !deselected.has(h.id)
                  const dna = dnaById[h.model?.dna_id]
                  return (
                    <button key={h.id} onClick={() => setDeselected(s => { const n = new Set(s); n.has(h.id) ? n.delete(h.id) : n.add(h.id); return n })}
                      className="cmd-panel p-2 text-left" style={{ cursor: 'pointer', borderColor: on ? 'var(--cmd-cyan)' : 'var(--cmd-line)', opacity: on ? 1 : 0.45 }}>
                      <div style={{ color: 'var(--cmd-ink)', fontSize: 13, fontWeight: 600 }}>{h.name}</div>
                      <div className="cmd-kbd" style={{ color: on ? 'var(--cmd-cyan)' : 'var(--cmd-faint)' }}>{dna?.attribute || 'no DNA'}</div>
                      <div className="cmd-kbd" style={{ fontSize: 10 }}>{(h.model?.dna_id || '').split('/').pop()}{dna ? ` · ${Math.round((dna.context_tokens || 0) / 1000)}K ctx` : ''}</div>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button className="cmd-btn primary" disabled={aBusy || hosts.every((h: any) => deselected.has(h.id))} onClick={briefCast}>
                  {aBusy ? 'THE ROOM IS READING…' : `BRIEF ${hosts.filter((h: any) => !deselected.has(h.id)).length} HOST${hosts.filter((h: any) => !deselected.has(h.id)).length === 1 ? '' : 'S'}`}
                </button>
                {aBusy && <span className="cmd-kbd">each host forms a take on its own engine (R1 is slow on purpose — that is the gravitas)…</span>}
              </div>

              {agents && (agents.deliveries || []).map((dv: any, i: number) => (
                <div key={i} className="cmd-panel p-4" style={{ borderColor: dv.ok ? 'var(--cmd-line-hot)' : 'var(--cmd-line)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="cmd-display" style={{ fontSize: 15, color: 'var(--cmd-ink)' }}>{dv.name}</span>
                    <span className="chip info">{dv.dna_attribute}</span>
                    <span className="cmd-kbd">{(dv.dna_id || '').split('/').pop()}</span>
                    {dv.ok
                      ? <span className="chip ok ml-auto">BRIEFED · {dv.budget?.toLocaleString()} tok · {(dv.ms / 1000).toFixed(1)}s</span>
                      : <span className="chip err ml-auto">FAILED</span>}
                  </div>
                  {dv.ok ? (
                    <div className="space-y-2" style={{ marginTop: 8 }}>
                      <div style={{ color: 'var(--cmd-ink)', fontSize: 15, lineHeight: 1.5 }}>{dv.stance?.answer}</div>
                      {dv.stance?.thesis && <div style={{ color: 'var(--cmd-dim)', fontSize: 13, lineHeight: 1.55 }}><b style={{ color: 'var(--cmd-cyan)' }}>THESIS </b>{dv.stance.thesis}</div>}
                      <div className="space-y-1">
                        {(dv.stance?.reasons || []).map((r: any, k: number) => (
                          <div key={k} className="flex gap-2" style={{ fontSize: 13, color: 'var(--cmd-dim)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--cmd-red)' }}>▸</span>
                            <span>{r.text} {(r.evidence_ids || []).map((e: string) => <span key={e} className="chip info" style={{ marginLeft: 3 }}>{e}</span>)}</span>
                          </div>
                        ))}
                      </div>
                      {dv.stance?.concession && <div style={{ color: 'var(--cmd-faint)', fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5 }}>concession — {dv.stance.concession}</div>}
                      <div className="cmd-kbd">briefed on: {(dv.moves_included || []).join(' · ')}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 6 }}><span className="chip err">{dv.error}</span>{dv.raw && <div className="cmd-kbd" style={{ marginTop: 4 }}>{dv.raw}</div>}</div>
                  )}
                </div>
              ))}
            </div>
          </>}
        </section>

        {/* EVIDENCE LEDGER — clean cards, legible quotes */}
        <section className="space-y-2">
          <div className="cmd-label" style={{ color: 'var(--cmd-red)' }}>EVIDENCE LEDGER — every claim cited, no invented sources</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(430px,1fr))' }}>
            {(d.evidence || []).map((e: any) => (
              <div key={e.id} className="cmd-panel p-3" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ color: 'var(--cmd-ink)', fontSize: 13.5, lineHeight: 1.45 }}>{e.claim}</div>
                {e.quote && <div style={{ color: 'var(--cmd-dim)', fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, borderLeft: '2px solid var(--cmd-line-hot)', paddingLeft: 9 }}>“{e.quote}”</div>}
                <div className="flex gap-1 items-center flex-wrap">
                  <span className="cmd-kbd">{e.id}</span>
                  <span className={`chip ${TL[e.truth_label] || ''}`}>{e.truth_label}</span>
                  {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }} title={e.source_name}>{e.source_name || e.source_id} ↗</a> : <span className="chip err">UNCITED</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SOURCE LEDGER */}
        <section className="space-y-2">
          <div className="cmd-label" style={{ color: 'var(--cmd-cyan)' }}>SOURCE LEDGER</div>
          <div className="cmd-panel overflow-x-auto">
            <table className="cmd-table">
              <thead><tr><th>ID</th><th>PUBLISHER</th><th>TITLE</th><th>CLASS</th><th>TRANSCRIPT</th><th /></tr></thead>
              <tbody>
                {(d.sources || []).map((s: any) => (
                  <tr key={s.id}>
                    <td className="cmd-kbd">{s.id}</td>
                    <td style={{ color: 'var(--cmd-ink)' }}>{s.publisher}</td>
                    <td style={{ color: 'var(--cmd-dim)', maxWidth: 320 }}>{s.title}</td>
                    <td className="cmd-kbd">{s.trust === 'configured' ? '★ trusted' : s.source_class}</td>
                    <td><span className={`chip ${s.transcript_status === 'ok' ? 'ok' : ''}`}>{s.transcript_status}{s.words ? ` · ${(s.words / 1000).toFixed(1)}k` : ''}</span></td>
                    <td><a href={s.url} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }}>↗</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>}

      {/* RECENT DOSSIERS */}
      {recent.length > 0 && !d && (
        <section className="cmd-panel p-4 space-y-2">
          <div className="cmd-label">RECENT DOSSIERS</div>
          {recent.map((r: any) => (
            <button key={r.id} className="flex items-center gap-3 text-left w-full" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: '4px 0' }} onClick={() => { setRes(r); setBrief(null) }}>
              <span className={`chip ${r.audit?.status === 'pass' ? 'ok' : 'warn'}`}>{r.assignment?.kind}</span>
              <span style={{ color: 'var(--cmd-ink)', fontSize: 13 }}>{r.assignment?.text}</span>
              <span className="cmd-kbd ml-auto">{r.evidence?.length} evidence · {ago(r.created_at).text}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  )
}
