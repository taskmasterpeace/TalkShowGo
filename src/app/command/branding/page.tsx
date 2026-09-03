'use client'
import { useState, useEffect, useRef } from 'react'
import { Flash } from '../lib'

// same rotate-arrow style the cast Face Room uses, so the two pickers feel identical (Robert 2026-09-03)
const rotStyle = (side: 'left' | 'right') => ({ position: 'absolute' as const, top: '50%', [side]: 4, transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 5, background: 'rgba(0,0,0,0.55)', color: '#fff', border: '1px solid var(--cmd-line)', cursor: 'pointer', fontSize: 17, lineHeight: '24px', zIndex: 2 })

type Opt = { v: number | string; url: string }
type Show = { slug: string; beat: string; name: string; tagline: string; show_type: string; variants: Opt[]; uploaded: boolean; locked: number | string | null }

export default function BrandingPage() {
  const [roster, setRoster] = useState<Show[] | null>(null)
  const [idx, setIdx] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const files = useRef<Record<string, HTMLInputElement | null>>({})

  const optsOf = (s: Show): Opt[] => [...s.variants, ...(s.uploaded ? [{ v: 'upload' as const, url: `/api/command/audio/logos/${s.slug}_upload.png?t=${Date.now()}` }] : [])]
  const load = () => fetch('/api/command/logo', { cache: 'no-store' }).then(r => r.json()).then(j => {
    const rs: Show[] = j.roster || []
    setRoster(rs)
    const start: Record<string, number> = {}
    for (const s of rs) { const o = optsOf(s); const i = o.findIndex(x => String(x.v) === String(s.locked)); start[s.slug] = i >= 0 ? i : 0 }
    setIdx(start)
  }).catch(() => setRoster([]))
  useEffect(() => { load() }, [])

  const cur = (s: Show): Opt | undefined => { const o = optsOf(s); return o[idx[s.slug] ?? 0] || o[0] }
  const rotate = (s: Show, dir: number) => { const n = optsOf(s).length; if (n < 2) return; setIdx(m => ({ ...m, [s.slug]: (((m[s.slug] ?? 0) + dir) % n + n) % n })) }

  const gen = async (s: Show) => {
    setBusy(s.slug); setFlash(`Reading "${s.name}" and drawing 3 logo options… (about a minute, on the house box)`)
    try {
      const r = await fetch('/api/command/logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'genLogo', slug: s.slug }) })
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'failed')
      setFlash(`"${s.name}": 3 fresh options ready — rotate and pick one`); await load()
    } catch (e: any) { setFlash('Generate failed: ' + String(e?.message || e)) } finally { setBusy(null) }
  }
  const lock = async (s: Show) => {
    const c = cur(s); if (!c) return
    try {
      const r = await fetch('/api/command/logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lockLogo', slug: s.slug, variant: c.v }) })
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'failed')
      setFlash(`Locked "${s.name}"`); await load()
    } catch (e: any) { setFlash('Lock failed: ' + String(e?.message || e)) }
  }
  const upload = (s: Show, file?: File | null) => {
    if (!file) return
    const rd = new FileReader()
    rd.onload = async () => {
      try {
        const r = await fetch('/api/command/logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'uploadLogo', slug: s.slug, dataUrl: rd.result }) })
        const j = await r.json(); if (!j.ok) throw new Error(j.error || 'failed')
        setFlash(`Uploaded your logo for "${s.name}"`); await load()
      } catch (e: any) { setFlash('Upload failed: ' + String(e?.message || e)) }
    }
    rd.readAsDataURL(file)
  }

  return (
    <div style={{ padding: '1.25rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 className="cmd-display" style={{ fontSize: '1.6rem', margin: 0 }}>BRANDING</h1>
        <div className="cmd-dim" style={{ fontSize: '.85rem', marginTop: 4 }}>A logo for every show. Hit GENERATE and the system reads the show and draws 3 options on the house box (free) — rotate, pick one, or upload your own.</div>
      </div>
      <Flash msg={flash} />
      {roster === null && <div className="cmd-dim" style={{ padding: '2rem 0' }}>loading shows…</div>}
      {roster && roster.length === 0 && <div className="cmd-dim" style={{ padding: '2rem 0' }}>No shows found. A show is a beat with a name in <span className="cmd-kbd">lab/beats/</span>.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '.9rem' }}>
        {(roster || []).map(s => {
          const o = optsOf(s); const c = cur(s); const generating = busy === s.slug
          const isLocked = c && String(c.v) === String(s.locked)
          return (
            <div key={s.slug} className="cmd-panel" style={{ padding: '.85rem', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--cmd-bg)', border: '1px solid var(--cmd-line)', display: 'grid', placeItems: 'center' }}>
                {c
                  ? <img src={c.url} alt={s.name + ' logo'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <div className="cmd-dim" style={{ fontSize: '.8rem', textAlign: 'center', padding: '1rem' }}>{generating ? 'drawing 3 options…' : 'no logo yet'}</div>}
                {o.length > 1 && <>
                  <button style={rotStyle('left')} onClick={() => rotate(s, -1)} aria-label="previous">‹</button>
                  <button style={rotStyle('right')} onClick={() => rotate(s, 1)} aria-label="next">›</button>
                </>}
                {c && <div style={{ position: 'absolute', top: 6, left: 6, fontSize: '.6rem', fontWeight: 700, letterSpacing: '.05em', padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,.6)', color: isLocked ? 'var(--cmd-green)' : '#fff' }}>{isLocked ? '✓ IN USE' : (c.v === 'upload' ? 'YOURS' : `OPTION ${c.v}`)}</div>}
              </div>
              <div>
                <div className="cmd-display" style={{ fontSize: '1.02rem', lineHeight: 1.15 }}>{s.name}</div>
                {s.tagline && <div className="cmd-dim" style={{ fontSize: '.76rem', marginTop: 2 }}>{s.tagline}</div>}
                {s.show_type && <span className="cmd-kbd" style={{ fontSize: '.62rem', marginTop: 4, display: 'inline-block' }}>{s.show_type}</span>}
              </div>
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                <button className="cmd-btn" disabled={generating} onClick={() => gen(s)} title="Analyze the show and draw 3 fresh options (free, on the house box)">{generating ? 'DRAWING…' : (o.length ? '⟳ REGENERATE' : '✦ GENERATE')}</button>
                {c && !isLocked && <button className="cmd-btn" onClick={() => lock(s)} title="Make this the show's logo">✓ USE THIS</button>}
                <button className="cmd-btn" onClick={() => files.current[s.slug]?.click()} title="Upload your own logo instead">⬆ UPLOAD</button>
                <input ref={el => { files.current[s.slug] = el }} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => upload(s, e.target.files?.[0])} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
