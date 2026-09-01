'use client'
import { useState } from 'react'
import { useCmdState, useBeat, BeatPicker, ago } from '../lib'

const TL: Record<string, string> = { FACT: 'ok', ATTRIBUTED_CLAIM: 'info', ANALYSIS: 'warn' }
const Lamp = ({ on, label }: { on: boolean | null | undefined; label: string }) => (
  <span className="flex items-center gap-1 cmd-kbd" style={{ fontSize: 10 }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? 'var(--cmd-green,#5cd08a)' : on === false ? 'var(--cmd-red,#ff3b34)' : '#6f665b', display: 'inline-block' }} />{label}
  </span>
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
  if (!state) return <div className="p-8 cmd-kbd">LOADING STRINGER…</div>

  const run = async () => {
    if (!text.trim()) return
    setBusy(true); setErr(null); setRes(null)
    try {
      const r = await fetch('/api/command/stringer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { kind, text, questions: qs.split('\n').map(s => s.trim()).filter(Boolean) }, beat_file: beat?.file }),
      })
      const j = await r.json()
      if (!j.ok) setErr(j.error || 'stringer failed'); else setRes(j)
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setBusy(false) }
  }
  const recent: any[] = state.stringers || []
  const dossier = res || null

  return (
    <div className="p-6 space-y-5">
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
          <div className="flex">
            {(['subject', 'question'] as const).map(k => (
              <button key={k} className={`chip ${kind === k ? 'err' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setKind(k)}>{k.toUpperCase()}</button>
            ))}
          </div>
          <BeatPicker beats={beats} beat={beat} pick={pick} />
          <span className="cmd-kbd" style={{ fontSize: 10 }}>{beat ? `trusted channels from: ${(beat.show?.name || beat.name || beat.id)}` : 'global YouTube search'}</span>
        </div>
        <input className="cmd-input w-full" placeholder={kind === 'subject' ? 'a subject or person to dig on (e.g. Tay Roc, the Lil Durk case)' : 'a specific question to answer'} value={text} onChange={e => setText(e.target.value)} />
        <textarea className="cmd-textarea w-full" rows={2} placeholder="questions to answer, one per line (optional for a subject)" value={qs} onChange={e => setQs(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="cmd-btn" disabled={busy || !text.trim()} onClick={run}>{busy ? 'DIGGING…' : '⛏ RESEARCH'}</button>
          {busy && <span className="cmd-kbd" style={{ fontSize: 10 }}>searching YouTube → transcripts → impartial parse (30-90s)…</span>}
          {err && <span className="chip err">{err}</span>}
        </div>
      </section>

      {dossier && (
        <>
          {/* AUDIT */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`chip ${dossier.audit?.status === 'pass' ? 'ok' : 'warn'}`}>IMPARTIALITY: {String(dossier.audit?.status || '').toUpperCase()}</span>
            <span className="cmd-kbd">{dossier.audit?.distinct_publishers} publishers · {dossier.usage?.transcripts} transcripts · {(dossier.usage?.transcript_words || 0).toLocaleString()} words · {dossier.evidence?.length} evidence</span>
            {dossier.audit?.needs_web && <span className="chip warn" title="thin YouTube coverage - a web supplement would strengthen this">NEEDS WEB</span>}
            {(dossier.audit?.warnings || []).map((w: string, i: number) => <span key={i} className="chip err" style={{ fontSize: 9 }}>{w}</span>)}
          </div>

          {/* ANSWER BOARD */}
          {(dossier.answers || []).length > 0 && (
            <section className="cmd-panel p-4 space-y-3">
              <div className="cmd-label" style={{ color: 'var(--cmd-red)' }}>ANSWER BOARD</div>
              {dossier.answers.map((a: any, i: number) => (
                <div key={i} className="border p-3" style={{ borderColor: 'var(--cmd-line)' }}>
                  <div className="cmd-display" style={{ fontSize: 14 }}>{a.question}</div>
                  <div style={{ color: 'var(--cmd-dim)', fontSize: 14, margin: '6px 0', lineHeight: 1.5 }}>{a.direct_answer}</div>
                  <div className="flex gap-1 flex-wrap items-center">
                    <span className="cmd-kbd" style={{ fontSize: 9 }}>{a.confidence?.toUpperCase()} ·</span>
                    {(a.evidence_ids || []).map((e: string) => <span key={e} className="chip info" style={{ fontSize: 9 }}>{e}</span>)}
                    {(a.unknowns || []).map((u: string, k: number) => <span key={k} className="chip warn" style={{ fontSize: 9 }} title="unknown">? {u}</span>)}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* CANDIDATE QUESTIONS (subject mode) — future: SELECT FOR BRIEFING */}
          {(dossier.candidate_questions || []).length > 0 && (
            <section className="cmd-panel p-4 space-y-2">
              <div className="cmd-label" style={{ color: 'var(--cmd-cyan)' }}>CANDIDATE QUESTIONS — pick one to become THE BRIEFING</div>
              {dossier.candidate_questions.map((q: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="chip" style={{ opacity: 0.5 }} title="THE BRIEFING is the next build">SELECT</span>
                  <span style={{ color: 'var(--cmd-dim)', fontSize: 13 }}>{q}</span>
                </div>
              ))}
            </section>
          )}

          {/* EVIDENCE LEDGER */}
          <section className="cmd-panel p-4 space-y-2">
            <div className="cmd-label" style={{ color: 'var(--cmd-red)' }}>EVIDENCE LEDGER — every claim cited, no invented sources</div>
            <div className="overflow-x-auto">
              <table className="cmd-table">
                <thead><tr><th>ID</th><th>CLAIM</th><th>LABEL</th><th>SOURCE</th><th>QUOTE</th></tr></thead>
                <tbody>
                  {(dossier.evidence || []).map((e: any) => (
                    <tr key={e.id}>
                      <td className="cmd-kbd">{e.id}</td>
                      <td style={{ fontSize: 12, maxWidth: 320 }}>{e.claim}</td>
                      <td><span className={`chip ${TL[e.truth_label] || ''}`} style={{ fontSize: 9 }}>{e.truth_label}</span></td>
                      <td>{e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="chip info" style={{ fontSize: 9, textDecoration: 'none' }} title={e.source_name}>{e.source_id} ↗</a> : <span className="chip err" style={{ fontSize: 9 }}>UNCITED</span>}</td>
                      <td className="cmd-kbd" style={{ fontSize: 10, maxWidth: 240, color: 'var(--cmd-faint)' }}>{e.quote ? '“' + e.quote.slice(0, 90) + '”' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SOURCE LEDGER */}
          <section className="cmd-panel p-4 space-y-2">
            <div className="cmd-label" style={{ color: 'var(--cmd-cyan)' }}>SOURCE LEDGER</div>
            <div className="overflow-x-auto">
              <table className="cmd-table">
                <thead><tr><th>ID</th><th>PUBLISHER</th><th>TITLE</th><th>CLASS</th><th>TRANSCRIPT</th><th /></tr></thead>
                <tbody>
                  {(dossier.sources || []).map((s: any) => (
                    <tr key={s.id}>
                      <td className="cmd-kbd">{s.id}</td>
                      <td style={{ fontSize: 12 }}>{s.publisher}</td>
                      <td style={{ fontSize: 12, maxWidth: 300, color: 'var(--cmd-dim)' }}>{s.title}</td>
                      <td className="cmd-kbd" style={{ fontSize: 10 }}>{s.trust === 'configured' ? '★ trusted' : s.source_class}</td>
                      <td><span className={`chip ${s.transcript_status === 'ok' ? 'ok' : ''}`} style={{ fontSize: 9 }}>{s.transcript_status}{s.words ? ` · ${(s.words / 1000).toFixed(1)}k` : ''}</span></td>
                      <td><a href={s.url} target="_blank" rel="noreferrer" className="chip info" style={{ fontSize: 9, textDecoration: 'none' }}>↗</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* RECENT DOSSIERS */}
      {recent.length > 0 && !dossier && (
        <section className="cmd-panel p-4 space-y-2">
          <div className="cmd-label">RECENT DOSSIERS</div>
          {recent.map((d: any) => (
            <div key={d.id} className="flex items-center gap-3" style={{ cursor: 'pointer' }} onClick={() => setRes(d)}>
              <span className={`chip ${d.audit?.status === 'pass' ? 'ok' : 'warn'}`} style={{ fontSize: 9 }}>{d.assignment?.kind}</span>
              <span style={{ fontSize: 13 }}>{d.assignment?.text}</span>
              <span className="cmd-kbd ml-auto" style={{ fontSize: 10 }}>{d.evidence?.length} evidence · {ago(d.created_at).text}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
