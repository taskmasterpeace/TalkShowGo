'use client'
// THE TAKE PAGE — what a real person (Dad, on his phone) sees when they tap their private link.
// Flow (Robert's redesign): INFORM first (impartial brief on the topic - who/what/pros-cons), let them
// ASK questions answered by a live web lookup, THEN capture their informed take. A cold "what's your take?"
// was useless when they don't know the topic yet. Zero login: the token in the URL is the whole handshake.
//   GET -> show + person + prompts + brief · POST {ask} -> impartial web answer · POST audio_b64 -> transcript
//   POST {followups} -> choices · POST {answers} -> saved take
import { useEffect, useRef, useState } from 'react'

type Info = { show: { name: string; tagline: string }; person: { name: string; slug: string; relation: string }; beat: string; prompts: string[]; max_seconds: number; brief: Brief | null }
type Brief = { headline: string; points: { headline: string; detail: string }[]; question: string | null }
type Followup = { q: string; choices: string[] }
type Answer = { q: string; a: string; source: 'voice' | 'typed' | 'choice'; wav?: string }
type Src = { title?: string; url?: string; publisher?: string }
type QA = { q: string; a: string; sources: Src[] }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function TakePage({ params }: { params: { token: string } }) {
  const api = `/api/take/${params.token}`
  const [phase, setPhase] = useState<'loading' | 'dead' | 'brief' | 'follow' | 'ready' | 'recording' | 'transcribing' | 'review' | 'typing' | 'followups' | 'sending' | 'done' | 'error'>('loading')
  const [depth, setDepth] = useState<string | null>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [wavName, setWavName] = useState<string | null>(null)
  const [takeNo, setTakeNo] = useState<number | null>(null)
  const [capped, setCapped] = useState(false)
  const [typed, setTyped] = useState('')
  const [fups, setFups] = useState<Followup[]>([])
  const [fupAns, setFupAns] = useState<Record<number, { a: string; source: 'choice' | 'typed' }>>({})
  const [fupTyping, setFupTyping] = useState<Record<number, string>>({})
  // INFORM/ASK state
  const [askInput, setAskInput] = useState('')
  const [askThread, setAskThread] = useState<QA[]>([])
  const [asking, setAsking] = useState(false)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch(api).then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then((j: Info) => { setInfo(j); setPhase(j.brief && j.brief.points?.length ? 'brief' : 'follow') }).catch(() => setPhase('dead'))
    return () => { if (timer.current) clearInterval(timer.current); try { rec.current?.stream.getTracks().forEach(t => t.stop()) } catch { /* leaving */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prompt = info?.prompts?.[0] || 'What is your take?'

  async function ask() {
    const q = askInput.trim()
    if (!q || asking) return
    setAskInput(''); setAsking(true)
    setAskThread(t => [...t, { q, a: '', sources: [] }])
    try {
      const j = await (await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ask: q }) })).json()
      setAskThread(t => t.map((x, i) => i === t.length - 1 ? { ...x, a: j.answer || '(no answer)', sources: j.sources || [] } : x))
    } catch { setAskThread(t => t.map((x, i) => i === t.length - 1 ? { ...x, a: "Couldn't look that up right now. Try again, or go with what you've got." } : x)) }
    setAsking(false)
  }

  // FAN DEPTH: worded as HOW they keep up (never "are you a superfan"); retunes the questions for their level.
  // Optimistic: move on immediately, swap the prompts in when the retuned set arrives; any failure keeps the defaults.
  async function pickDepth(d: string) {
    setDepth(d); setPhase('ready')
    try {
      const j = await (await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ depth: d }) })).json()
      if (j?.ok && Array.isArray(j.prompts) && j.prompts.length) setInfo(prev => (prev ? { ...prev, prompts: j.prompts } : prev))
    } catch { /* keep the default prompts */ }
  }

  async function startRecording() {
    setErr('')
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { setErr('Could not use the microphone (this needs an https link on a phone). Type it instead below.'); setPhase('typing'); return }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || ''
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    chunks.current = []
    r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
    r.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
      if (blob.size < 2000) { setErr('That was too short. Hold the button and talk.'); setPhase('ready'); return }
      setPhase('transcribing')
      const b64 = await new Promise<string>(res => { const fr = new FileReader(); fr.onloadend = () => res(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob) })
      try {
        const j = await (await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio_b64: b64, mime: blob.type, ...(takeNo ? { take: takeNo } : {}) }) })).json()
        if (!j.ok) throw new Error(j.error || 'upload failed')
        setTakeNo(j.take); setCapped(!!j.capped)
        if (j.empty) { setErr("We couldn't hear any words in that. Try again, or type it."); setPhase('ready'); return }
        setTranscript(j.transcript); setWavName(j.wav); setPhase('review')
      } catch (e: any) { setErr('That did not go through: ' + String(e?.message || e).slice(0, 120) + '. Try again, or type it.'); setPhase('ready') }
    }
    rec.current = r
    r.start()
    setSecs(0); setPhase('recording')
    timer.current = setInterval(() => setSecs(s => { if (s >= 299) { try { r.stop() } catch { /* stopped */ } } return s + 1 }), 1000)
  }
  function stopRecording() { if (timer.current) clearInterval(timer.current); try { rec.current?.stop() } catch { /* not recording */ } }

  async function loadFollowups(mainQ: string, mainA: string) {
    setPhase('followups'); setFups([])
    try {
      const j = await (await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followups: true, transcript_so_far: [{ q: mainQ, a: mainA }] }) })).json()
      if (j.ok && Array.isArray(j.followups) && j.followups.length) setFups(j.followups); else setFups([])
    } catch { setFups([]) }
  }

  async function sendTake() {
    if (!info) return
    setPhase('sending'); setErr('')
    const main: Answer = wavName ? { q: prompt, a: transcript, source: 'voice', wav: wavName } : { q: prompt, a: transcript, source: 'typed' }
    const extras: Answer[] = fups.map((f, i) => (fupAns[i] ? { q: f.q, a: fupAns[i].a, source: fupAns[i].source } : null)).filter(Boolean) as Answer[]
    const body = JSON.stringify({ answers: [main, ...extras], ...(takeNo ? { take: takeNo } : {}), ...(depth ? { depth } : {}), prompt, prompts: info.prompts, capped, via: 'link' })
    // two attempts with a beat between: a tunnel/link blip shouldn't cost the person their take. And a non-JSON
    // body (a tunnel's HTML error page) gets a HUMAN message, not a browser riddle.
    let lastErr = ''
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        const text = await res.text()
        let j: any = null
        try { j = JSON.parse(text) } catch { throw new Error(`the line to the studio hiccuped (HTTP ${res.status}). Your words are still right here.`) }
        if (!j.ok) throw new Error(j.error || 'save failed')
        setPhase('done'); return
      } catch (e: any) {
        lastErr = String(e?.message || e).slice(0, 140)
        if (attempt === 1) await new Promise(r => setTimeout(r, 1500))
      }
    }
    setErr('Could not send it: ' + lastErr + ' — tap SEND again in a few seconds.'); setPhase('followups')
  }

  function reset() { setTranscript(''); setWavName(null); setTakeNo(null); setCapped(false); setTyped(''); setFups([]); setFupAns({}); setFupTyping({}); setErr(''); setPhase(info?.brief?.points?.length ? 'brief' : 'ready') }

  const S = styles
  if (phase === 'loading') return <main style={S.page}><p style={S.dim}>One second…</p></main>
  if (phase === 'dead') return <main style={S.page}><h1 style={S.h1}>This link isn&apos;t active.</h1><p style={S.dim}>Ask the person who sent it for a fresh one.</p></main>

  return (
    <main style={S.page}>
      <header style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={S.kicker}>YOU&apos;RE ON</div>
        <h1 style={S.h1}>{info?.show.name}</h1>
        {info?.show.tagline ? <p style={S.dim}>{info.show.tagline}</p> : null}
      </header>

      {err ? <div style={S.err}>{err}</div> : null}

      {phase === 'brief' && info?.brief && (
        <section style={S.card}>
          <p style={S.hello}>Hey {info.person.name} — before you weigh in, here&apos;s the story.</p>
          <div style={S.briefBox}>
            <p style={S.briefHead}>{info.brief.headline}</p>
            <ul style={S.briefList}>
              {info.brief.points.map((p, i) => (
                <li key={i} style={S.briefItem}><strong style={S.briefItemHead}>{p.headline}.</strong> {p.detail}</li>
              ))}
            </ul>
          </div>

          <p style={S.dimSmall}>GOT A QUESTION? ASK — I&apos;LL LOOK IT UP:</p>
          {askThread.map((qa, i) => (
            <div key={i} style={S.qa}>
              <p style={S.qaQ}>{qa.q}</p>
              <p style={S.qaA}>{qa.a || (asking && i === askThread.length - 1 ? 'Looking it up…' : '')}</p>
              {qa.sources?.length ? <p style={S.qaSrc}>{qa.sources.map(s => s.publisher || s.url).filter(Boolean).slice(0, 4).join(' · ')}</p> : null}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
            <input style={{ ...S.inp, marginTop: 0, flex: 1 }} placeholder="e.g. who is Divine Deablo?" value={askInput}
              onChange={e => setAskInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask() }} disabled={asking} />
            <button style={S.askBtn} onClick={ask} disabled={asking || !askInput.trim()}>Ask</button>
          </div>

          <button style={S.mainBtn} onClick={() => setPhase(depth ? 'ready' : 'follow')}>I&apos;M CAUGHT UP — GIVE MY TAKE →</button>
        </section>
      )}

      {phase === 'follow' && (
        <section style={S.card}>
          <p style={S.hello}>Real quick, {info?.person.name} — how do you keep up with the team?</p>
          <p style={S.dimSmall}>So the questions fit how you actually watch. No wrong answer.</p>
          <div style={S.chips}>
            {([
              ['Every snap. I don’t miss a game.', 'diehard'],
              ['Most games, and I follow the storylines.', 'regular'],
              ['Highlights and headlines mostly.', 'casual'],
              ['I check in when something big happens.', 'casual'],
            ] as [string, string][]).map(([label, d], i) => (
              <button key={i} style={{ ...S.chip, ...(depth === d ? S.chipOn : {}) }} onClick={() => pickDepth(d)}>{label}</button>
            ))}
          </div>
        </section>
      )}

      {phase === 'ready' && (
        <section style={S.card}>
          <p style={S.hello}>Alright {info?.person.name} — your take:</p>
          <p style={S.prompt}>{prompt}</p>
          <button style={S.recBtn} onClick={startRecording}>● &nbsp;HOLD THE FLOOR</button>
          <p style={S.dimSmall}>Tap, talk like you would on the phone, tap again to stop. We keep your exact words.</p>
          <button style={S.linkBtn} onClick={() => setPhase('typing')}>type it instead</button>
          {info?.brief?.points?.length ? <button style={S.linkBtn} onClick={() => setPhase('brief')}>back to the story</button> : null}
        </section>
      )}

      {phase === 'recording' && (
        <section style={{ ...S.card, textAlign: 'center' as const }}>
          <p style={S.prompt}>{prompt}</p>
          <div style={S.liveDot}>● REC {fmt(secs)}</div>
          <button style={{ ...S.recBtn, background: '#e8483f' }} onClick={stopRecording}>■ &nbsp;DONE TALKING</button>
          <p style={S.dimSmall}>Say it all — we transcribe the first 3 minutes.</p>
        </section>
      )}

      {phase === 'transcribing' && <section style={S.card}><p style={S.dim}>Getting your words down…</p></section>}

      {phase === 'review' && (
        <section style={S.card}>
          <p style={S.dimSmall}>HERE&apos;S WHAT WE GOT{capped ? ' (first 3 minutes)' : ''}:</p>
          <blockquote style={S.quote}>&ldquo;{transcript}&rdquo;</blockquote>
          <button style={S.mainBtn} onClick={() => loadFollowups(prompt, transcript)}>THAT&apos;S MY TAKE →</button>
          <button style={S.linkBtn} onClick={() => { setErr(''); setPhase('ready') }}>re-record it</button>
        </section>
      )}

      {phase === 'typing' && (
        <section style={S.card}>
          <p style={S.prompt}>{prompt}</p>
          <textarea style={S.ta} rows={6} value={typed} onChange={e => setTyped(e.target.value)} placeholder="Say it in your own words…" />
          <button style={S.mainBtn} disabled={!typed.trim()} onClick={() => { setTranscript(typed.trim()); setWavName(null); loadFollowups(prompt, typed.trim()) }}>THAT&apos;S MY TAKE →</button>
          <button style={S.linkBtn} onClick={() => setPhase('ready')}>try recording instead</button>
        </section>
      )}

      {phase === 'followups' && (
        <section style={S.card}>
          {fups.length === 0 ? <p style={S.dim}>Locking that in…</p> : <p style={S.dimSmall}>QUICK FOLLOW-UPS — tap one, type, or skip:</p>}
          {fups.map((f, i) => (
            <div key={i} style={{ marginBottom: '1.1rem' }}>
              <p style={S.fq}>{f.q}</p>
              <div style={S.chips}>
                {f.choices.map(c => (
                  <button key={c} style={{ ...S.chip, ...(fupAns[i]?.a === c ? S.chipOn : {}) }} onClick={() => setFupAns(p => ({ ...p, [i]: { a: c, source: 'choice' } }))}>{c}</button>
                ))}
              </div>
              <input style={S.inp} placeholder="…or say it your way" value={fupTyping[i] || ''}
                onChange={e => { const v = e.target.value; setFupTyping(p => ({ ...p, [i]: v })); if (v.trim()) setFupAns(p => ({ ...p, [i]: { a: v.trim(), source: 'typed' } })); else setFupAns(p => { const n = { ...p }; delete n[i]; return n }) }} />
            </div>
          ))}
          <button style={S.mainBtn} onClick={sendTake}>SEND IT TO THE SHOW 🎙️</button>
          <p style={S.dimSmall}>Your words land on the next show, word for word.</p>
        </section>
      )}

      {phase === 'sending' && <section style={S.card}><p style={S.dim}>Sending it to the desk…</p></section>}

      {phase === 'done' && (
        <section style={{ ...S.card, textAlign: 'center' as const }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>🎙️</div>
          <h2 style={{ ...S.h1, fontSize: '1.4rem' }}>That&apos;s it, {info?.person.name}.</h2>
          <p style={S.dim}>You&apos;re on the next show — your exact words, in your voice.</p>
          <button style={S.linkBtn} onClick={reset}>drop another take</button>
        </section>
      )}
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'oklch(0.15 0.012 60)', color: 'oklch(0.95 0.01 80)', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem 1.25rem 4rem', maxWidth: '30rem', margin: '0 auto' },
  kicker: { letterSpacing: '.3em', fontSize: '.7rem', color: 'oklch(0.72 0.13 70)', fontWeight: 700 },
  h1: { fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.025em', margin: '.25rem 0' },
  dim: { color: 'oklch(0.68 0.03 70)', fontSize: '.95rem', lineHeight: 1.5 },
  dimSmall: { color: 'oklch(0.62 0.03 70)', fontSize: '.72rem', letterSpacing: '.08em', fontWeight: 600, margin: '1.1rem 0 .5rem' },
  hello: { fontSize: '1rem', color: 'oklch(0.8 0.04 75)', marginBottom: '.75rem' },
  prompt: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.35, margin: '0 0 1.25rem' },
  card: { background: 'oklch(0.19 0.014 60)', border: '1px solid oklch(0.3 0.02 60)', borderRadius: '0.625rem', padding: '1.5rem' },
  briefBox: { background: 'oklch(0.16 0.012 60)', border: '1px solid oklch(0.28 0.02 60)', borderRadius: '0.5rem', padding: '1rem 1rem .5rem', margin: '.25rem 0 .5rem' },
  briefHead: { fontSize: '1.05rem', fontWeight: 700, margin: '0 0 .6rem', color: 'oklch(0.9 0.03 80)' },
  briefList: { margin: 0, paddingLeft: '1.1rem' },
  briefItem: { fontSize: '.9rem', lineHeight: 1.5, marginBottom: '.6rem', color: 'oklch(0.82 0.02 80)' },
  briefItemHead: { color: 'oklch(0.9 0.05 80)' },
  qa: { borderLeft: '2px solid oklch(0.4 0.08 70)', paddingLeft: '.7rem', margin: '.6rem 0' },
  qaQ: { fontSize: '.9rem', fontWeight: 700, margin: '0 0 .2rem', color: 'oklch(0.85 0.03 75)' },
  qaA: { fontSize: '.9rem', lineHeight: 1.5, margin: 0, color: 'oklch(0.82 0.02 80)' },
  qaSrc: { fontSize: '.68rem', color: 'oklch(0.58 0.05 70)', margin: '.3rem 0 0' },
  recBtn: { display: 'block', width: '100%', padding: '1.1rem', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '.05em', color: '#fff', background: 'oklch(0.55 0.19 35)', border: 'none', borderRadius: '0.625rem', cursor: 'pointer' },
  mainBtn: { display: 'block', width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 800, color: 'oklch(0.15 0.01 60)', background: 'oklch(0.78 0.15 80)', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', marginTop: '1rem' },
  askBtn: { padding: '0 1.1rem', fontSize: '.9rem', fontWeight: 700, color: 'oklch(0.15 0.01 60)', background: 'oklch(0.72 0.1 75)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' },
  linkBtn: { display: 'block', margin: '0.9rem auto 0', background: 'none', border: 'none', color: 'oklch(0.65 0.1 70)', textDecoration: 'underline', cursor: 'pointer', fontSize: '.85rem' },
  liveDot: { color: '#ff6b61', fontWeight: 800, fontSize: '1.3rem', margin: '1rem 0' },
  quote: { fontSize: '1.05rem', lineHeight: 1.55, fontStyle: 'italic', color: 'oklch(0.9 0.02 80)', borderLeft: '3px solid oklch(0.78 0.15 80)', margin: '0 0 1.25rem', padding: '.25rem 0 .25rem 1rem' },
  ta: { width: '100%', background: 'oklch(0.14 0.01 60)', color: 'inherit', border: '1px solid oklch(0.32 0.02 60)', borderRadius: '0.625rem', padding: '.8rem', fontSize: '1rem', fontFamily: 'inherit', marginBottom: '.75rem' },
  inp: { width: '100%', background: 'oklch(0.14 0.01 60)', color: 'inherit', border: '1px solid oklch(0.3 0.02 60)', borderRadius: '0.5rem', padding: '.6rem .7rem', fontSize: '.9rem', fontFamily: 'inherit', marginTop: '.4rem' },
  fq: { fontWeight: 700, fontSize: '.98rem', margin: '0 0 .5rem' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '.45rem' },
  chip: { padding: '.5rem .8rem', borderRadius: '999px', border: '1px solid oklch(0.35 0.03 70)', background: 'oklch(0.22 0.015 60)', color: 'oklch(0.88 0.02 80)', fontSize: '.85rem', cursor: 'pointer' },
  chipOn: { background: 'oklch(0.78 0.15 80)', color: 'oklch(0.15 0.01 60)', fontWeight: 700, border: '1px solid oklch(0.78 0.15 80)' },
  err: { background: 'oklch(0.3 0.09 30)', border: '1px solid oklch(0.45 0.13 30)', color: 'oklch(0.93 0.03 40)', borderRadius: '0.625rem', padding: '.7rem .9rem', fontSize: '.88rem', marginBottom: '1rem' },
}
