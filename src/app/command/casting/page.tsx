'use client'
// THE CASTING OFFICE (Robert 2026-09-07): "generate the personality, and the personality makes the
// voice." Flow: describe the character -> full Personality Print v4 (free, cupcake) -> the print's own
// voice aesthetic -> HEAR a few candidates (different seeds) -> add/remove attributes in plain words ->
// hire to the cast (print + locked voice ref land in cast.json / lab/cast/voices).
// Low friction, but the FIELD GUIDE panel teaches exactly how Breeze reads a description.
import { useEffect, useRef, useState } from 'react'

type Guest = any
const post = (u: string, b: any) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => { const t = await r.text(); try { return JSON.parse(t) } catch { return { error: `HTTP ${r.status}` } } })

// a fresh candidate needs words to say - a range-spanning audition script (~9s read)
const AUDITION_SCRIPT = "Look, I hear what you're saying, but the tape doesn't lie. Eighty-seven points is a statement. (laugh) Now hold on, hold on... let me finish. If they show up flat on Saturday, everything we said this week means nothing. That's the game."

const SECTION_LABELS: Record<string, string> = { essence: 'ESSENCE', speech: 'HOW THEY TALK', processing: 'HOW THEY THINK', argument: 'HOW THEY FIGHT', emotion: 'HEAT', knowledge: 'WHAT THEY KNOW', lexicon: 'THEIR WORDS', things_they_say: 'THINGS THEY SAY', contrast: 'NEVER CONFUSED WITH', drives: 'WHAT DRIVES THEM' }

function PrintView({ print }: { print: any }) {
  if (!print) return null
  const render = (v: any): string => Array.isArray(v) ? v.join(' · ') : typeof v === 'object' && v ? Object.entries(v).map(([k, x]) => `${k.replace(/_/g, ' ')}: ${render(x)}`).join('  ·  ') : String(v ?? '')
  return (
    <div className="space-y-2">
      {Object.entries(SECTION_LABELS).map(([key, label]) => print[key] ? (
        <div key={key}>
          <div className="cmd-label" style={{ fontSize: '.62rem', letterSpacing: '.12em', fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: '.82rem', lineHeight: 1.5 }}>{typeof print[key] === 'string' ? print[key] : Object.entries(print[key]).map(([k, v]) => (
            <div key={k}><span className="cmd-label">{k.replace(/_/g, ' ')}:</span> {render(v)}</div>
          ))}</div>
        </div>
      ) : null)}
    </div>
  )
}

// THE FIELD GUIDE - how Breeze actually reads a voice description (the detailed tooltip Robert asked for)
function FieldGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid var(--cmd-line)', borderRadius: 8, padding: '.7rem .9rem', margin: '.6rem 0' }}>
      <button className="cmd-btn ghost" onClick={() => setOpen(o => !o)}>{open ? '▾' : '▸'} HOW BREEZE READS A VOICE DESCRIPTION</button>
      {open && (
        <div style={{ fontSize: '.8rem', lineHeight: 1.6, marginTop: '.6rem' }} className="space-y-2">
          <p><b>Write it in this order</b> (telegraphic comma phrases, 30-60 words): gender/age → role → pitch &amp; timbre → texture → accent → pace/rhythm → emotional register → personality. Example: <i>&quot;Masculine, mature adult. Deep, gravelly, resonant bass-baritone. Gruff, authoritative, drill-sergeant cadence. Fast, high-intensity.&quot;</i></p>
          <p><b>Words the model is trained on</b> (these steer hard): warm · calm · bright · gentle · energetic · authoritative · sincere · weary · precise · refined · urgent · friendly · articulate · steady · playful · compassionate · reflective · measured · rhythmic · passionate.</p>
          <p><b>Accents that work:</b> american, british, scottish, irish, australian, canadian, us_southern, us_new_york, indian, south_african, russian, japanese, korean, chinese.</p>
          <p><b>ALWAYS end with a clarity term</b> — &quot;clear, full-bodied, close-mic studio quality.&quot; Without it you can roll a muffled telephone voice: the model obeys acoustic words, so never write phone/radio/distant/muffled unless you WANT a caller-on-the-line character (that&apos;s a real move — the HOT WIRE format uses it).</p>
          <p><b>The seed is the identity.</b> Same description + same seed = the same person every time. Different seeds = different people from the same description — that&apos;s why you audition a few. When one lands, we freeze that exact take as the locked reference and every future line CLONES it.</p>
          <p><b>Nonverbals live in the script, not here:</b> (laugh) (sigh) (clears throat) (cough) placed exactly where the sound belongs. Sustained states — whispering, breathless, near tears — are per-line delivery directions, which the show writes automatically from the personality.</p>
        </div>
      )}
    </div>
  )
}

export default function CastingPage() {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [guest, setGuest] = useState<Guest | null>(null)
  const [aesthetic, setAesthetic] = useState('')
  const [attr, setAttr] = useState('')
  const [seedBase, setSeedBase] = useState(0)
  const [cands, setCands] = useState<{ file: string; url: string; seed: number }[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [hired, setHired] = useState<string | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const liveRef = useRef(true)
  useEffect(() => () => { liveRef.current = false }, [])
  useEffect(() => { fetch('/api/command/state').then(r => r.json()).then(s => { if (liveRef.current) setGuests(s.guests || []) }).catch(() => {}) }, [hired])

  const generate = async () => {
    if (!name.trim() || !desc.trim() || busy) return
    setBusy('print'); setErr(null); setGuest(null); setCands([]); setPicked(null); setHired(null)
    const j = await post('/api/command/personality', { name: name.trim(), description: desc.trim() })
    if (!liveRef.current) return
    if (j.ok && j.guest) { setGuest(j.guest); setAesthetic(j.guest.voice?.aesthetic || ''); setSeedBase(j.guest.voice?.seed || 1000 + Math.floor(Math.random() * 9000)) }
    else setErr(j.error || 'the print generator came back empty - try again (cupcake may be busy)')
    setBusy(null)
  }
  const resumeGuest = (g: Guest) => { setGuest(g); setName(g.name); setDesc(g.source_description || ''); setAesthetic(g.voice?.aesthetic || ''); setSeedBase(g.voice?.seed || 4242); setCands([]); setPicked(null); setHired(null); setErr(null) }

  const audition = async (howMany = 3) => {
    if (!aesthetic.trim() || busy) return
    setBusy('voices'); setErr(null); setPicked(null)
    const got: typeof cands = []
    for (let i = 0; i < howMany; i++) {
      const seed = seedBase + i
      const j = await post('/api/command/voice', { action: 'audition', aesthetic: aesthetic.trim(), ref_text: AUDITION_SCRIPT, seed })
      if (!liveRef.current) return
      if (j.ok) got.push({ file: j.file, url: j.url, seed })
      else { setErr(j.busy ? 'the render box is busy with a video job - candidates will work when it frees' : (j.error || 'audition failed')); break }
      setCands([...got])
    }
    setBusy(null)
  }

  // plain-words attribute editing: "+gravelly" / "-fast" / or just type words to add
  const applyAttr = () => {
    const t = attr.trim(); if (!t) return
    let next = aesthetic
    for (const piece of t.split(/[,;]+/).map(s => s.trim()).filter(Boolean)) {
      if (piece.startsWith('-')) {
        const w = piece.slice(1).trim()
        next = next.split(/,\s*/).filter(p => !p.toLowerCase().includes(w.toLowerCase())).join(', ')
      } else {
        const w = piece.replace(/^\+/, '').trim()
        // keep the clarity term LAST always
        next = next.replace(/,?\s*(clear[^.]*quality\.?)$/i, '') + `, ${w}` + (next.match(/(clear[^.]*quality\.?)$/i) ? `, ${next.match(/(clear[^.]*quality\.?)$/i)![1]}` : '')
      }
    }
    if (!/clear|studio quality/i.test(next)) next += ', clear, full-bodied, close-mic studio quality'
    setAesthetic(next.replace(/,\s*,/g, ',').trim())
    setAttr(''); setCands([]); setPicked(null); setSeedBase(s => s) // same seeds, new description: hear the difference
  }

  const hire = async () => {
    if (!guest || !picked || busy) return
    setBusy('hire'); setErr(null)
    const c = cands.find(x => x.file === picked)
    const j = await post('/api/command/voice', { action: 'hire', guest_id: guest.id, candidate: picked, aesthetic: aesthetic.trim(), ref_text: AUDITION_SCRIPT, seed: c?.seed })
    if (!liveRef.current) return
    if (j.ok) setHired(j.hired.name)
    else setErr(j.error || 'hire failed')
    setBusy(null)
  }

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: '60rem' }}>
      <div>
        <div className="cmd-display text-lg" style={{ letterSpacing: '.1em' }}>THE CASTING OFFICE</div>
        <div className="cmd-kbd text-sm">Describe a person → get their full personality print → the print writes their voice → hear candidates → hire them to the cast.</div>
      </div>
      {err ? <div><span className="chip err" title={err}>{err.slice(0, 160)}</span></div> : null}

      {/* STEP 1 - THE IDEA */}
      <section className="cmd-panel p-4 space-y-2">
        <div className="cmd-label" style={{ fontSize: '.68rem', letterSpacing: '.14em', fontWeight: 700 }}>1 · WHO IS THIS PERSON?</div>
        <input className="cmd-input w-full" placeholder="Name (e.g. Bernadette Okafor)" value={name} onChange={e => setName(e.target.value)} />
        <textarea className="cmd-textarea w-full" rows={3} placeholder="Describe them like you'd describe a real person: where they're from, what they did before the desk, what sets them off, what makes them different from everybody else we have…" value={desc} onChange={e => setDesc(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="cmd-btn" disabled={!name.trim() || !desc.trim() || !!busy} onClick={generate}>{busy === 'print' ? 'BUILDING THE PRINT… (30-90s)' : 'GENERATE THE PERSONALITY'}</button>
          <span className="cmd-kbd text-xs">Free (runs on the house box). The print is built to be DISTINCT from all {guests.length ? 19 : 19} current hosts by construction.</span>
        </div>
        {guests.length > 0 && !guest && (
          <div className="text-xs cmd-kbd">Or pick up a print you already generated: {guests.map((g: any) => <button key={g.id} className="cmd-btn ghost" style={{ marginRight: '.3rem' }} onClick={() => resumeGuest(g)}>{g.name}</button>)}</div>
        )}
      </section>

      {/* STEP 2 - THE PRINT */}
      {guest && (
        <section className="cmd-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="cmd-label" style={{ fontSize: '.68rem', letterSpacing: '.14em', fontWeight: 700 }}>2 · THE PRINT — {guest.name.toUpperCase()}</div>
            <button className="cmd-btn ghost" disabled={!!busy} onClick={generate}>↻ REGENERATE</button>
          </div>
          <PrintView print={guest.print} />
        </section>
      )}

      {/* STEP 3 - THE VOICE BOOTH */}
      {guest && (
        <section className="cmd-panel p-4 space-y-2">
          <div className="cmd-label" style={{ fontSize: '.68rem', letterSpacing: '.14em', fontWeight: 700 }}>3 · THE VOICE — written by the print, edited by you</div>
          <textarea className="cmd-textarea w-full" rows={3} value={aesthetic} onChange={e => { setAesthetic(e.target.value); setCands([]); setPicked(null) }} />
          <div className="flex gap-2 items-center">
            <input className="cmd-input" style={{ flex: 1 }} placeholder='Add or remove in plain words: "gravelly, +slower" adds · "-fast, -bright" removes' value={attr} onChange={e => setAttr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyAttr() }} />
            <button className="cmd-btn ghost" onClick={applyAttr} disabled={!attr.trim()}>APPLY</button>
          </div>
          <FieldGuide />
          <div className="flex items-center gap-3">
            <button className="cmd-btn" disabled={!aesthetic.trim() || !!busy} onClick={() => audition(3)}>{busy === 'voices' ? `AUDITIONING… (${cands.length}/3)` : cands.length ? '↻ NEW ROUND (same seeds, current description)' : 'HEAR 3 CANDIDATES'}</button>
            <span className="cmd-kbd text-xs">~20-60s each on the house box. Same description, three different people — the seed is the identity.</span>
          </div>
          {cands.length > 0 && (
            <div className="space-y-2">
              {cands.map(c => (
                <div key={c.file} className="flex items-center gap-3" style={{ border: `1px solid ${picked === c.file ? 'var(--cmd-line-hot)' : 'var(--cmd-line)'}`, borderRadius: 8, padding: '.5rem .7rem' }}>
                  <button className="cmd-btn ghost" onClick={() => setPicked(c.file)}>{picked === c.file ? '● PICKED' : 'PICK'}</button>
                  <span className="cmd-kbd text-xs" style={{ minWidth: '5.5rem' }}>seed {c.seed}</span>
                  <audio controls src={c.url} style={{ height: 32, flex: 1 }} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* STEP 4 - HIRE */}
      {guest && picked && !hired && (
        <section className="cmd-panel p-4 flex items-center gap-3">
          <button className="cmd-btn" disabled={!!busy} onClick={hire}>{busy === 'hire' ? 'HIRING…' : `HIRE ${guest.name.toUpperCase()} TO THE CAST 🎙️`}</button>
          <span className="cmd-kbd text-xs">The picked take becomes their LOCKED voice ref; the print + voice land in cast.json. Every future line clones this exact voice.</span>
        </section>
      )}
      {hired && (
        <section className="cmd-panel p-4">
          <b>{hired} is on the cast.</b> <span className="cmd-kbd text-sm">See them on the CAST page — seat them on a show by adding their id to the beat&apos;s hosts.</span>
        </section>
      )}
    </div>
  )
}
