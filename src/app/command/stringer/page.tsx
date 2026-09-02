'use client'
import { useEffect, useRef, useState } from 'react'
import { useCmdState, useBeat, BeatPicker, ago } from '../lib'

const TL: Record<string, string> = { FACT: 'ok', ATTRIBUTED_CLAIM: 'info', ANALYSIS: 'warn' }
// per-medium provenance badge (on-brand tokens only, no new colors): YouTube / Web / X
const MED: Record<string, { tag: string; color: string }> = {
  youtube: { tag: 'YT', color: 'var(--cmd-red)' }, web: { tag: 'WEB', color: 'var(--cmd-cyan)' }, x: { tag: '𝕏', color: 'var(--cmd-amber)' },
}
const medOf = (name?: string, url?: string) => String(name || '').startsWith('@') ? MED.x : /youtube\.com|youtu\.be/.test(String(url || '')) ? MED.youtube : MED.web
const KIND: Record<string, string> = { event: 'THE EVENT', stat: 'THE NUMBERS', tradeoff: 'THE TRADE-OFF', larger_context: 'THE BIGGER PICTURE', uncertainty: 'WHAT WE DON’T KNOW' }
const Lamp = ({ on, label }: { on: boolean | null | undefined; label: string }) => (
  <span className={`lamp ${on ? 'on' : on === false ? 'err' : ''}`}><i />{label}</span>
)

// THE DELEGATE interview, voice path: an answer is typed, spoken (recorded -> transcribed, editable), or a tapped
// follow-up choice; every recorded take is kept and the LONGEST becomes the person's voice sample for the floor.
type IvSource = 'typed' | 'voice' | 'choice'
type IvAnswer = { text: string; source: IvSource; wav?: string; seconds?: number; transcript?: string }
type IvTake = { k: number; wav: string; seconds: number; transcript: string }
type IvFollowup = { q: string; choices: string[]; pick: string | null; other: string }
type Iv = {
  idx: number; questions: string[]; answers: IvAnswer[]; busy: boolean; done?: any; error?: string | null
  phase: 'answer' | 'followups'; followups: IvFollowup[]; fuBusy: boolean; fuNote?: string | null
  rec: { k: number; secs: number } | null; uploading: number | null; takes: IvTake[]; mic: 'unsupported' | 'denied' | null
}
type IvRec = { mr: MediaRecorder; stream: MediaStream; timer: ReturnType<typeof setInterval>; k: number; startedAt: number; abort: boolean }
const IV_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
const blobToB64 = (blob: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '').split(',')[1] || ''); fr.onerror = () => rej(fr.error || new Error('could not read the recording')); fr.readAsDataURL(blob) })

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
  const [delegates, setDelegates] = useState<{ name: string; persona_note?: string }[]>([])
  const [dName, setDName] = useState('')
  const [dNote, setDNote] = useState('')
  const [show, setShow] = useState<any>(null)
  const [showBusy, setShowBusy] = useState(false)
  const [traceOpen, setTraceOpen] = useState<number | null>(null)
  // the human delegate interview: the show asks, the person answers in their own words (typed, or spoken and
  // transcribed), taps through 2-3 follow-ups, and their longest take is kept as their voice sample for the floor
  const [iv, setIv] = useState<Iv | null>(null)
  const recRef = useRef<IvRec | null>(null)
  // never leave a live mic behind if the page unmounts mid-take
  useEffect(() => () => { const r = recRef.current; if (!r) return; clearInterval(r.timer); r.abort = true; try { if (r.mr.state !== 'inactive') r.mr.stop() } catch { /* already stopped */ } r.stream.getTracks().forEach(t => t.stop()); recRef.current = null }, [])
  if (!state) return <div className="p-8 cmd-kbd">LOADING STRINGER…</div>

  const d = res
  const evById: Record<string, any> = Object.fromEntries(((res?.evidence) || []).map((e: any) => [e.id, e]))
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
  // ---- THE DELEGATE interview (voice path) ----
  const ivPost = async (body: any) => {
    const r = await fetch('/api/command/briefing/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json(); if (!j.ok) throw new Error(j.error || 'interview failed'); return j
  }
  const freshIv = (i: number, p: Partial<Iv> = {}): Iv => ({ idx: i, questions: [], answers: [], busy: false, error: null, phase: 'answer', followups: [], fuBusy: false, rec: null, uploading: null, takes: [], mic: null, ...p })
  // stop the live take; abort=true throws it away (closing the panel), otherwise onstop uploads it
  const stopRec = (abort = false) => {
    const r = recRef.current; if (!r) return
    clearInterval(r.timer); r.abort = abort; recRef.current = null
    try { if (r.mr.state !== 'inactive') r.mr.stop(); else r.stream.getTracks().forEach(t => t.stop()) } catch { r.stream.getTracks().forEach(t => t.stop()) }
    if (abort) setIv(v => v ? { ...v, rec: null } : v)
  }
  const startInterview = async (i: number) => {
    if (!brief?.id) return
    stopRec(true)
    setIv(freshIv(i, { busy: true }))
    try {
      const j = await ivPost({ briefing_id: brief.id, delegate: delegates[i] })
      setIv(freshIv(i, { questions: j.questions, answers: j.questions.map(() => ({ text: '', source: 'typed' as IvSource })) }))
    } catch (e: any) { setIv(freshIv(i, { error: String(e?.message || e) })) }
  }
  // one take -> base64 -> the route converts + transcribes -> the transcript lands in the textarea (editable)
  const uploadTake = async (briefingId: string, delegate: any, question: string, k: number, blob: Blob, secs: number) => {
    try {
      if (blob.size < 1000) throw new Error('that take was empty: hit RECORD and talk for a few seconds before STOP')
      const audio_b64 = await blobToB64(blob)
      const j = await ivPost({ briefing_id: briefingId, delegate, question, audio_b64, mime: blob.type || 'audio/webm' })
      const text = String(j.transcript || '').trim(), seconds = Number(j.seconds) || secs
      setIv(v => {
        if (!v) return v
        if (!text) return { ...v, uploading: null, error: 'no speech heard in that take: try again a little closer to the mic' }
        const answers = v.answers.map((a, i) => i === k ? { text, source: 'voice' as IvSource, wav: String(j.wav), seconds, transcript: text } : a)
        return { ...v, uploading: null, error: null, answers, takes: [...v.takes, { k, wav: String(j.wav), seconds, transcript: text }] }
      })
    } catch (e: any) { setIv(v => v ? { ...v, uploading: null, error: String(e?.message || e) } : v) }
  }
  const startRec = async (k: number) => {
    if (!iv || iv.done || !brief?.id || recRef.current) return
    const briefingId = brief.id, delegate = delegates[iv.idx], question = iv.questions[k]
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setIv(v => v ? { ...v, mic: 'unsupported' } : v); return }
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) }
    catch (e: any) { setIv(v => v ? { ...v, mic: /NotAllowed|Security|Permission/i.test(String(e?.name || e)) ? 'denied' : 'unsupported' } : v); return }
    const mime = IV_MIMES.find(m => MediaRecorder.isTypeSupported(m)) || ''
    let mr: MediaRecorder
    try { mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream) }
    catch { stream.getTracks().forEach(t => t.stop()); setIv(v => v ? { ...v, mic: 'unsupported' } : v); return }
    const chunks: Blob[] = []
    const startedAt = Date.now()
    const me: IvRec = { mr, stream, k, startedAt, abort: false, timer: setInterval(() => setIv(v => v && v.rec ? { ...v, rec: { ...v.rec, secs: Math.floor((Date.now() - startedAt) / 1000) } } : v), 250) }
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      if (me.abort) return
      const secs = Math.round((Date.now() - startedAt) / 10) / 100
      const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' })
      setIv(v => v ? { ...v, rec: null, uploading: k } : v)
      void uploadTake(briefingId, delegate, question, k, blob, secs)
    }
    recRef.current = me
    mr.start(250)
    setIv(v => v ? { ...v, rec: { k, secs: 0 }, mic: null, error: null } : v)
  }
  const loadFollowups = async () => {
    if (!iv || !brief?.id) return
    const sofar = iv.questions.map((q, k) => ({ q, a: (iv.answers[k]?.text || '').trim() })).filter(x => x.a)
    if (!sofar.length) return
    setIv(v => v ? { ...v, fuBusy: true, error: null } : v)
    try {
      const j = await ivPost({ briefing_id: brief.id, delegate: delegates[iv.idx], transcript_so_far: sofar, followups: true })
      const fus: IvFollowup[] = (j.followups || []).map((f: any) => ({ q: String(f.q || ''), choices: (f.choices || []).map(String), pick: null, other: '' })).filter((f: IvFollowup) => f.q && f.choices.length)
      setIv(v => v ? { ...v, fuBusy: false, phase: 'followups', followups: fus, fuNote: j.fallback ? 'the show could not write custom follow-ups just now, so these are the standard ones' : null } : v)
    } catch (e: any) { setIv(v => v ? { ...v, fuBusy: false, error: String(e?.message || e) } : v) }
  }
  const submitInterview = async () => {
    if (!iv || !brief?.id) return
    const answers: { q: string; a: string; source: IvSource; wav?: string }[] = iv.questions
      .map((q, k) => { const a = iv.answers[k]; return { q, a: (a?.text || '').trim(), source: a?.source || 'typed', ...(a?.wav ? { wav: a.wav } : {}) } })
      .filter(x => x.a)
    for (const f of iv.followups) { const other = f.other.trim(); if (other || f.pick) answers.push({ q: f.q, a: other || String(f.pick), source: other ? 'typed' : 'choice' }) }
    if (!answers.length) return
    // the LONGEST recorded take is the voice sample; its ref text is that take's transcript as the person corrected it
    const longest = [...iv.takes].sort((a, b) => b.seconds - a.seconds)[0]
    const refText = longest ? ((iv.answers[longest.k]?.wav === longest.wav && (iv.answers[longest.k]?.text || '').trim()) || longest.transcript) : ''
    const voice = longest && refText ? { sample_wav: longest.wav, ref_text: refText } : undefined
    setIv(v => v ? { ...v, busy: true, error: null } : v)
    try {
      const j = await ivPost({ briefing_id: brief.id, delegate: delegates[iv.idx], answers, ...(voice ? { voice } : {}) })
      setIv(v => v ? { ...v, busy: false, done: j.delivery } : v)
      // surface the human take in the room without re-briefing anyone
      setAgents((a: any) => ({ ...(a || { briefing_id: brief.id, question: brief.question?.text }), deliveries: [...((a?.deliveries) || []).filter((x: any) => x.cast_id !== j.delivery.cast_id), j.delivery] }))
    } catch (e: any) { setIv(v => v ? { ...v, busy: false, error: String(e?.message || e) } : v) }
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
    if (!cast_ids.length && !delegates.length) return
    setABusy(true); setAgents(null); setErr(null)
    try {
      const r = await fetch('/api/command/briefing/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ briefing_id: brief.id, cast_ids, delegates }) })
      const j = await r.json(); if (j.ok) setAgents(j); else setErr(j.error || 'cast brief failed')
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setABusy(false) }
  }
  const addDelegate = () => { if (!dName.trim()) return; setDelegates(d => [...d, { name: dName.trim(), persona_note: dNote.trim() || undefined }]); setDName(''); setDNote('') }
  const pollShow = async (slug: string) => {
    try {
      const r = await fetch(`/api/command/showbuild?show=${slug}`); const j = await r.json()
      if (j.ok) {
        setShow({ slug, status: j.status })
        if (j.status.stage !== 'done' && j.status.stage !== 'error') setTimeout(() => pollShow(slug), 3000)
        else setShowBusy(false)
      } else setShowBusy(false)
    } catch { setTimeout(() => pollShow(slug), 4000) }
  }
  const produceShow = async () => {
    if (!brief?.id || !d?.id) return
    setShowBusy(true); setShow(null); setErr(null)
    try {
      const r = await fetch('/api/command/showbuild', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stringer_id: d.id, briefing_id: brief.id, voice: true }) })
      const j = await r.json()
      if (j.ok) { setShow({ slug: j.show, status: { stage: 'queued', pct: 1, message: 'starting the build…' } }); pollShow(j.show) }
      else { setErr(j.error || 'show build failed'); setShowBusy(false) }
    } catch (e: any) { setErr(String(e?.message || e)); setShowBusy(false) }
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
        <input className="cmd-input" spellCheck={false} placeholder={kind === 'subject' ? 'a subject or person to dig on (e.g. Tay Roc, the Lil Durk case)' : 'a specific question to answer'} value={text} onChange={e => setText(e.target.value)} />
        <textarea className="cmd-textarea" spellCheck={false} rows={2} placeholder="questions to answer, one per line (optional for a subject)" value={qs} onChange={e => setQs(e.target.value)} />
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
                  {(a.evidence_ids || []).map((e: string) => { const ev = evById[e]; const m = ev ? medOf(ev.source_name, ev.url) : null; return <span key={e} className="chip" title={ev?.claim || e} style={m ? { borderColor: m.color, color: m.color } : {}}>{e}</span> })}
                  {(a.unknowns || []).map((u: string, k: number) => <span key={k} className="chip warn" title="open question">? {u}</span>)}
                  {(a.evidence_ids || []).length > 0 && <button className="cmd-kbd" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cmd-cyan)', marginLeft: 4 }} onClick={() => setTraceOpen(traceOpen === i ? null : i)}>{traceOpen === i ? '▾ hide trace' : `⛓ trace (${(a.evidence_ids || []).length})`}</button>}
                </div>
                {traceOpen === i && (
                  <div className="space-y-1" style={{ marginTop: 8, borderTop: '1px solid var(--cmd-line)', paddingTop: 8 }}>
                    {(a.evidence_ids || []).map((e: string) => {
                      const ev = evById[e]
                      if (!ev) return <div key={e} className="cmd-kbd">{e} · (not in ledger)</div>
                      const m = medOf(ev.source_name, ev.url)
                      return (
                        <div key={e} className="flex gap-2" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                          <span className="chip" style={{ borderColor: m.color, color: m.color, alignSelf: 'flex-start' }}>{m.tag}</span>
                          <span style={{ color: 'var(--cmd-dim)' }}>{ev.claim}{' '}{ev.url ? <a href={ev.url} target="_blank" rel="noreferrer" style={{ color: m.color, textDecoration: 'none', whiteSpace: 'nowrap' }}>— {ev.source_name} ↗</a> : <span className="chip err">uncited</span>}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
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
            <input className="cmd-input" spellCheck={false} placeholder="…or write the question" value={briefQ} onChange={e => setBriefQ(e.target.value)} />
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
              {/* THE DELEGATE — a viewer names a real person to represent a point of view */}
              <div className="cmd-panel p-3 space-y-2" style={{ borderStyle: 'dashed' }}>
                <div className="cmd-kbd" style={{ color: 'var(--cmd-red)' }}>THE DELEGATE — add a real person to represent a view. fed the SAME briefing, forms their OWN take.</div>
                {delegates.length > 0 && (
                  <div className="flex gap-2 flex-wrap items-center">
                    {delegates.map((d, i) => (
                      <span key={i} className="chip" style={{ borderColor: 'var(--cmd-red)', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 24 }}>
                        {d.name}{d.persona_note ? ` · ${d.persona_note.slice(0, 30)}` : ''}
                        <button onClick={() => startInterview(i)} title="the show asks this person questions; their answers are saved verbatim" style={{ background: 'none', border: '1px solid var(--cmd-red)', color: 'var(--cmd-red)', cursor: 'pointer', fontSize: 10, padding: '1px 6px' }}>INTERVIEW</button>
                        <button onClick={() => setDelegates(x => x.filter((_, k) => k !== i))} style={{ background: 'none', border: 'none', color: 'var(--cmd-dim)', cursor: 'pointer' }}>✕</button>
                      </span>
                    ))}
                    <span className="cmd-kbd">BRIEF = a model plays them from the briefing · INTERVIEW = the real person answers, verbatim</span>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <input className="cmd-input" spellCheck={false} style={{ maxWidth: 210 }} placeholder="name (a fan, a fighter, you…)" value={dName} onChange={e => setDName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addDelegate() }} />
                  <input className="cmd-input" spellCheck={false} style={{ flex: 1, minWidth: 220 }} placeholder="who they are / where they stand (optional)" value={dNote} onChange={e => setDNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addDelegate() }} />
                  <button className="cmd-btn ghost" disabled={!dName.trim()} onClick={addDelegate}>+ ADD</button>
                </div>
                {iv && (() => {
                  const who = delegates[iv.idx]
                  const answered = iv.answers.some(a => (a.text || '').trim())
                  const locked = !!iv.done || iv.busy
                  const inFlight = iv.rec !== null || iv.uploading !== null || iv.fuBusy
                  const fuAnswered = iv.followups.filter(f => f.pick || f.other.trim()).length
                  const longestSecs = iv.takes.length ? Math.round(Math.max(...iv.takes.map(t => t.seconds))) : 0
                  return (
                  <div className="cmd-panel p-3 space-y-2" style={{ borderColor: 'var(--cmd-red)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="cmd-label" style={{ color: 'var(--cmd-red)', margin: 0 }}>THE SHOW INTERVIEWS {String(who?.name || '').toUpperCase()}</span>
                      <span className="cmd-kbd">talk or type. nothing gets rewritten. this is your take, verbatim.</span>
                      {iv.phase === 'followups' && <span className="chip" style={{ borderColor: 'var(--cmd-red)', color: 'var(--cmd-red)' }}>FOLLOW-UPS</span>}
                      <button className="cmd-btn ghost ml-auto" onClick={() => { stopRec(true); setIv(null) }}>✕</button>
                    </div>
                    {iv.busy && !iv.questions.length && <span role="status" className="cmd-kbd">writing questions from the briefing…</span>}
                    {iv.mic === 'unsupported' && <span className="chip err">this browser cannot record audio here: use Chrome or Edge on localhost or https, or just type your answers</span>}
                    {iv.mic === 'denied' && <span className="chip err">microphone blocked: allow the mic for this site in the address bar, then hit RECORD again</span>}
                    {iv.error && <span className="chip err">{iv.error}</span>}
                    {iv.questions.map((q, k) => {
                      const a = iv.answers[k] || { text: '', source: 'typed' as IvSource }
                      const recHere = iv.rec?.k === k, upHere = iv.uploading === k
                      return (
                        <div key={k} className="space-y-1">
                          <label style={{ color: 'var(--cmd-ink)', fontSize: 13.5, display: 'block' }} htmlFor={`iv-${k}`}>{k + 1}. {q}</label>
                          <textarea id={`iv-${k}`} className="cmd-textarea" spellCheck={false} rows={2} value={a.text} disabled={locked || recHere || upHere}
                            onChange={e => { const val = e.target.value; setIv(v => v ? { ...v, answers: v.answers.map((x, j) => j === k ? { ...x, text: val } : x) } : v) }}
                            placeholder={recHere ? 'listening…' : upHere ? 'transcribing…' : 'type your answer, or hit RECORD and just talk'} />
                          <div className="flex items-center gap-2 flex-wrap">
                            {recHere
                              ? <button type="button" className="cmd-btn primary" style={{ padding: '8px 16px' }} onClick={() => stopRec()}>■ STOP</button>
                              : <button type="button" className="cmd-btn ghost" disabled={locked || inFlight} onClick={() => startRec(k)} style={{ color: 'var(--cmd-red)' }} title="record this answer with your voice; it gets transcribed word for word">🎙 {a.source === 'voice' ? 'RECORD AGAIN' : 'RECORD'}</button>}
                            {recHere && <span role="status" className="chip err" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cmd-red)', animation: 'blink 1s steps(2) infinite' }} />REC {iv.rec?.secs ?? 0}s</span>}
                            {upHere && <span role="status" className="chip info">TRANSCRIBING…</span>}
                            {a.source === 'voice' && !recHere && !upHere && <>
                              <span className="chip" style={{ borderColor: 'var(--cmd-red)', color: 'var(--cmd-red)' }}>VOICE{a.seconds ? ` · ${Math.round(a.seconds)}s` : ''}</span>
                              <span className="cmd-kbd">transcribed from your voice, edit if it misheard</span>
                            </>}
                          </div>
                        </div>
                      )
                    })}
                    {iv.questions.length > 0 && !iv.done && iv.phase === 'answer' && (
                      <div className="flex items-center gap-3 flex-wrap" style={{ paddingTop: 4 }}>
                        <button type="button" className="cmd-btn primary" disabled={locked || inFlight || !answered} onClick={loadFollowups}>{iv.fuBusy ? 'WRITING FOLLOW-UPS…' : 'NEXT: FOLLOW-UPS ›'}</button>
                        <button type="button" className="cmd-btn ghost" disabled={locked || inFlight || !answered} onClick={submitInterview}>{iv.busy ? 'SAVING…' : 'SKIP, THAT IS MY TAKE'}</button>
                        <span className="cmd-kbd">{iv.takes.length
                          ? `${iv.takes.length} take${iv.takes.length === 1 ? '' : 's'} recorded · your longest (${longestSecs}s) becomes your voice sample for the floor`
                          : 'record at least one answer and your voice gets cloned for your turns on the floor (a clear 10 to 20 second answer is ideal)'}</span>
                      </div>
                    )}
                    {iv.phase === 'followups' && !iv.done && (
                      <div className="space-y-3" style={{ borderTop: '1px solid var(--cmd-line)', paddingTop: 10 }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="cmd-label" style={{ color: 'var(--cmd-red)', margin: 0 }}>FOLLOW-UPS</span>
                          <span className="cmd-kbd">the show heard you. tap the closest answer, or say it your way.</span>
                          {iv.fuNote && <span className="chip warn">{iv.fuNote}</span>}
                        </div>
                        {iv.followups.length === 0 && <span className="cmd-kbd">no follow-ups this time. save your take below.</span>}
                        {iv.followups.map((f, n) => (
                          <div key={n} className="space-y-2">
                            <div style={{ color: 'var(--cmd-ink)', fontSize: 13.5 }}>{iv.questions.length + n + 1}. {f.q}</div>
                            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}>
                              {f.choices.map((c, ci) => {
                                const sel = f.pick === c
                                return (
                                  <button key={ci} type="button" className="cmd-btn ghost" disabled={locked} aria-pressed={sel}
                                    onClick={() => setIv(v => v ? { ...v, followups: v.followups.map((x, j) => j === n ? { ...x, pick: sel ? null : c, other: sel ? x.other : '' } : x) } : v)}
                                    style={{ minHeight: 48, padding: '10px 14px', justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', letterSpacing: '0.02em', fontSize: 13.5, lineHeight: 1.35, borderWidth: 2, borderColor: sel ? 'var(--cmd-red)' : undefined, color: sel ? 'var(--cmd-ink)' : undefined, background: sel ? 'var(--cmd-panel2)' : undefined }}>
                                    <span style={{ color: sel ? 'var(--cmd-red)' : 'var(--cmd-faint)', flex: 'none' }}>{sel ? '●' : '○'}</span>{c}
                                  </button>
                                )
                              })}
                            </div>
                            <input className="cmd-input" spellCheck={false} disabled={locked} placeholder="something else…" value={f.other} style={{ maxWidth: 520, fontSize: 12.5, padding: '6px 10px' }}
                              onChange={e => { const val = e.target.value; setIv(v => v ? { ...v, followups: v.followups.map((x, j) => j === n ? { ...x, other: val, pick: val.trim() ? null : x.pick } : x) } : v) }} />
                          </div>
                        ))}
                        <div className="flex items-center gap-3 flex-wrap">
                          <button type="button" className="cmd-btn primary" disabled={locked || inFlight || !answered} onClick={submitInterview}>{iv.busy ? 'SAVING…' : 'THAT IS MY TAKE'}</button>
                          <button type="button" className="cmd-btn ghost" disabled={locked} onClick={() => setIv(v => v ? { ...v, phase: 'answer' } : v)}>‹ BACK TO THE QUESTIONS</button>
                          <span className="cmd-kbd">{fuAnswered} of {iv.followups.length} follow-ups answered · an unanswered one is simply skipped{iv.takes.length ? ` · voice sample: your longest take (${longestSecs}s)` : ''}</span>
                        </div>
                      </div>
                    )}
                    {iv.done && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="chip ok">SAVED VERBATIM{iv.done.voice ? ' · VOICE SAMPLE KEPT' : ''}</span>
                        <span className="cmd-kbd">{who?.name} is on this briefing as a HUMAN delegate{iv.done.voice
                          ? `. your voice will be cloned for your turns on the floor (${Math.round(iv.done.voice.seconds || 0)}s sample)`
                          : '. no voice sample was kept: record an answer next time and your voice gets cloned for the floor'}</span>
                      </div>
                    )}
                  </div>
                  )
                })()}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {(() => {
                  const nH = hosts.filter((h: any) => !deselected.has(h.id)).length, n = nH + delegates.length
                  return (
                    <button className="cmd-btn primary" disabled={aBusy || n === 0} onClick={briefCast}>
                      {aBusy ? 'THE ROOM IS READING…' : `BRIEF ${n} ${n === 1 ? 'VOICE' : 'VOICES'}${delegates.length ? ` (${nH} host${nH === 1 ? '' : 's'} + ${delegates.length} delegate${delegates.length === 1 ? '' : 's'})` : ''}`}
                    </button>
                  )
                })()}
                {aBusy && <span className="cmd-kbd">each voice forms a take on its own engine (R1 is slow on purpose — that is the gravitas)…</span>}
              </div>

              {agents && (agents.deliveries || []).map((dv: any, i: number) => (
                <div key={i} className="cmd-panel p-4" style={{ borderColor: dv.ok ? 'var(--cmd-line-hot)' : 'var(--cmd-line)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="cmd-display" style={{ fontSize: 15, color: 'var(--cmd-ink)' }}>{dv.name}</span>
                    {dv.kind === 'delegate' && <span className="chip" style={{ borderColor: 'var(--cmd-red)', color: 'var(--cmd-red)' }}>DELEGATE</span>}
                    {dv.human && <span className="chip ok" title="a real person answered the show's questions; saved word for word">HUMAN · VERBATIM</span>}
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
                            <span>{r.asked && <span className="cmd-kbd" style={{ display: 'block', color: 'var(--cmd-faint)' }}>{r.asked}</span>}{r.text} {(r.evidence_ids || []).map((e: string) => <span key={e} className="chip info" style={{ marginLeft: 3 }}>{e}</span>)}</span>
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

              {/* PRODUCE THE SHOW — the whole lineage becomes one rendered audio talk show */}
              {agents && (agents.deliveries || []).filter((x: any) => x.ok && x.kind !== 'delegate').length >= 2 && (
                <div className="space-y-3" style={{ borderTop: '1px solid var(--cmd-line)', paddingTop: 14 }}>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="cmd-label" style={{ color: 'var(--cmd-red)' }}>PRODUCE THE SHOW</span>
                    <span className="cmd-kbd">the showrunner splits the room into a real argument · the floor writes it live · Breeze voices it → one audio talk show</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button className="cmd-btn primary" disabled={showBusy} onClick={produceShow}>{showBusy ? 'BUILDING…' : '▶ BUILD SHOW + AUDIO'}</button>
                    {show?.status && show.status.stage !== 'done' && show.status.stage !== 'error' && <span className="cmd-kbd">[{show.status.pct}%] {show.status.stage} — {show.status.message}</span>}
                    {show?.status?.stage === 'error' && <span className="chip err">{show.status.message}</span>}
                  </div>
                  {showBusy && show?.status?.stage !== 'done' && <div className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>compile → floor (each host argues on its own engine, R1 is slow) → voices. a full build runs a few minutes.</div>}
                  {show?.status?.audio_url && (
                    <div className="cmd-panel p-4 space-y-2" style={{ borderColor: 'var(--cmd-line-hot)' }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="chip ok">SHOW READY</span>
                        <span className="cmd-display" style={{ color: 'var(--cmd-ink)', fontSize: 14 }}>{show.status.question}</span>
                        {show.status.duration_s ? <span className="cmd-kbd ml-auto">{Math.floor(show.status.duration_s / 60)}:{String(show.status.duration_s % 60).padStart(2, '0')}</span> : null}
                      </div>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio controls src={show.status.audio_url} style={{ width: '100%' }} />
                      {show.status.script && <details><summary className="cmd-kbd" style={{ cursor: 'pointer' }}>read the transcript</summary><pre style={{ whiteSpace: 'pre-wrap', color: 'var(--cmd-dim)', fontSize: 12.5, lineHeight: 1.6, marginTop: 8 }}>{show.status.script}</pre></details>}
                    </div>
                  )}
                </div>
              )}
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
                  {e.url ? (() => { const m = medOf(e.source_name, e.url); return <a href={e.url} target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: 'none', borderColor: m.color, color: m.color }} title={e.source_name}>{m.tag} · {e.source_name || e.source_id} ↗</a> })() : <span className="chip err">UNCITED</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 𝕏 POSTS — real recent posts folded in as attributed evidence (see the reactions) */}
        {(d.sources || []).some((s: any) => s.medium === 'x' && s.text) && (
          <section className="space-y-2">
            <div className="cmd-label" style={{ color: 'var(--cmd-amber)' }}>𝕏 POSTS — recent reactions, folded in with @handle + permalink provenance</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
              {(d.sources || []).filter((s: any) => s.medium === 'x' && s.text).map((s: any) => (
                <div key={s.id} className="cmd-panel p-3" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--cmd-amber)', fontWeight: 700 }}>𝕏</span>
                    <span style={{ color: 'var(--cmd-ink)', fontSize: 13, fontWeight: 600 }}>{s.publisher}</span>
                    {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="cmd-kbd ml-auto" style={{ textDecoration: 'none' }}>view ↗</a>}
                  </div>
                  <div style={{ color: 'var(--cmd-dim)', fontSize: 13, lineHeight: 1.5 }}>{s.text}</div>
                  <div className="cmd-kbd">♥ {(s.likes || 0).toLocaleString()} · ↻ {(s.rts || 0).toLocaleString()}{s.published_at ? ` · ${String(s.published_at).slice(0, 10)}` : ''}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SOURCE LEDGER — grouped view of every medium the evidence stands on */}
        <section className="space-y-2">
          {(() => {
            const src = d.sources || []
            const count = (m: string) => src.filter((s: any) => (MED[s.medium] ? s.medium : (medOf(s.publisher, s.url) === MED.youtube ? 'youtube' : medOf(s.publisher, s.url) === MED.x ? 'x' : 'web')) === m).length
            return (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="cmd-label" style={{ color: 'var(--cmd-cyan)', margin: 0 }}>SOURCE LEDGER</span>
                {(['youtube', 'web', 'x'] as const).map(m => count(m) > 0 && <span key={m} className="chip" style={{ borderColor: MED[m].color, color: MED[m].color }}>{MED[m].tag} {count(m)}</span>)}
              </div>
            )
          })()}
          <div className="cmd-panel overflow-x-auto">
            <table className="cmd-table">
              <thead><tr><th>SRC</th><th>SOURCE</th><th>TITLE</th><th>STATUS</th><th /></tr></thead>
              <tbody>
                {(d.sources || []).map((s: any) => {
                  const m = MED[s.medium] || medOf(s.publisher, s.url)
                  return (
                    <tr key={s.id}>
                      <td><span className="chip" style={{ borderColor: m.color, color: m.color }} title={s.id}>{m.tag}</span></td>
                      <td style={{ color: 'var(--cmd-ink)' }}>{s.publisher}{s.trust === 'configured' && <span className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}> ★</span>}</td>
                      <td style={{ color: 'var(--cmd-dim)', maxWidth: 320 }}>{s.title}</td>
                      <td><span className={`chip ${s.transcript_status === 'ok' ? 'ok' : ''}`}>{s.transcript_status}{s.words ? ` · ${(s.words / 1000).toFixed(1)}k` : ''}</span></td>
                      <td>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: 'none', borderColor: m.color, color: m.color }}>↗</a> : null}</td>
                    </tr>
                  )
                })}
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
