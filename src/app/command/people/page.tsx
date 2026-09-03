'use client'
import { useCallback, useEffect, useState } from 'react'
import { useCmdState, useBeat, BeatPicker, Flash } from '../lib'

// PEOPLE ON A BEAT — the delegates attached to a coverage area (Dad on the Falcons, a neighbor on Orangeburg).
// Each carries a private /take link; whatever they drop lands in the beat's take inbox to be seated on the next
// show. Reads /api/command/people?beat=<id>&takes=1; every field is treated as optional so a hand-edited beat
// (or a beat with no people[]) can never crash the page.
export default function People() {
  const { state } = useCmdState()
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { beat, beats, pick } = useBeat(state)
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  // attach-a-person form
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [channel, setChannel] = useState('link')
  const [address, setAddress] = useState('')

  const beatId: string = beat?.id || ''
  const load = useCallback(async () => {
    if (!beatId) { setData(null); return }
    try {
      const r = await fetch(`/api/command/people?beat=${encodeURIComponent(beatId)}&takes=1`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({} as any))
      if (!r.ok || !j?.ok) throw new Error(j?.error || `http ${r.status}`)
      setData(j); setErr(null)
    } catch (e: any) { setErr(String(e?.message || e)); setData(null) }
  }, [beatId])
  useEffect(() => { load() }, [load])

  if (!state) return <div className="p-8 cmd-kbd">LOADING PEOPLE...</div>
  if (!beat) return <div className="p-8 cmd-kbd">NO BEAT LOADED</div>

  const people: any[] = Array.isArray(data?.people) ? data.people : []
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const flashMsg = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 1400) }

  const addPerson = async () => {
    const nm = name.trim(); if (nm.length < 2 || busy) return
    setBusy('add'); setErr(null)
    try {
      const body: any = { beat: beatId, name: nm, relation: relation.trim(), channel }
      if (channel !== 'link') body.address = address.trim()
      const r = await fetch('/api/command/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({} as any))
      if (!r.ok || !j?.ok) throw new Error(j?.error || `http ${r.status}`)
      setName(''); setRelation(''); setAddress(''); setChannel('link')
      await load(); flashMsg('ADDED ' + nm.toUpperCase())
    } catch (e: any) { setErr(String(e?.message || e)) }
    finally { setBusy(null) }
  }
  const removePerson = async (p: any) => {
    if (!p?.slug || busy) return
    setBusy('rm:' + p.slug); setErr(null)
    try {
      const r = await fetch('/api/command/people', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ beat: beatId, slug: p.slug }) })
      const j = await r.json().catch(() => ({} as any))
      if (!r.ok || !j?.ok) throw new Error(j?.error || `http ${r.status}`)
      await load(); flashMsg('REMOVED ' + String(p.name || p.slug).toUpperCase())
    } catch (e: any) { setErr(String(e?.message || e)) }
    finally { setBusy(null) }
  }
  const copyLink = (p: any) => {
    const url = origin + (p?.link_path || (p?.token ? `/take/${p.token}` : ''))
    try { navigator.clipboard?.writeText(url); flashMsg('LINK COPIED') } catch {}
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>PEOPLE — {beat.name?.toUpperCase() || beatId.toUpperCase()}</span>
        <BeatPicker beats={beats} beat={beat} pick={pick} />
        <span className="chip">{people.length} ON THIS BEAT</span>
        <Flash msg={flash} />
      </div>

      {err && <div><span className="chip err" title={err}>{err.slice(0, 160)}</span></div>}

      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>DELEGATES ON THIS BEAT</h2></div>
          <span className="cmd-kbd">each carries a private /take link &middot; what they drop lands in the beat&apos;s take inbox</span>
        </div>
        {people.length === 0 ? (
          <div className="p-4 cmd-kbd">NOBODY ATTACHED YET &middot; add a person below to mint their private take link</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cmd-table">
              <thead><tr><th>NAME</th><th>RELATION</th><th>CHANNEL</th><th>TAKES</th><th>PRIVATE LINK</th><th /></tr></thead>
              <tbody>
                {people.map((p: any, i: number) => {
                  const link = p?.link_path || (p?.token ? `/take/${p.token}` : '')
                  return (
                    <tr key={p?.slug || p?.token || i}>
                      <td style={{ color: 'var(--cmd-ink)', minWidth: 140 }}>{p?.name || '—'}</td>
                      <td style={{ color: 'var(--cmd-dim)' }}>{p?.relation || '—'}</td>
                      <td><span className="cmd-kbd">{p?.channel || 'link'}{p?.address ? ` · ${p.address}` : ''}</span></td>
                      <td>
                        <span className="flex gap-1 items-center">
                          <span className={`chip ${(p?.take_count || 0) > 0 ? 'ok' : ''}`}>{p?.take_count || 0}</span>
                          {(p?.pending || 0) > 0 && <span className="chip warn" title="dropped, not yet seated on a show">{p.pending} PENDING</span>}
                        </span>
                      </td>
                      <td>
                        {link
                          ? <span className="flex gap-2 items-center">
                              <a href={link} target="_blank" rel="noreferrer" className="cmd-kbd" style={{ color: 'var(--cmd-cyan)', textDecoration: 'none' }}>{link}</a>
                              <button className="cmd-btn ghost" onClick={() => copyLink(p)}>COPY</button>
                            </span>
                          : <span className="chip err" title="no token minted">NO LINK</span>}
                      </td>
                      <td><button className="chip err" style={{ cursor: 'pointer' }} disabled={busy !== null} onClick={() => removePerson(p)}>{busy === 'rm:' + p?.slug ? '…' : '✕'}</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cmd-panel">
        <div className="cmd-h"><div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>ATTACH A PERSON</h2></div></div>
        <div className="p-4 flex flex-wrap items-end gap-3">
          <div style={{ minWidth: 180 }}>
            <label className="cmd-label">NAME</label>
            <input className="cmd-input" spellCheck={false} placeholder="e.g. Marcus (Dad)" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPerson() }} />
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="cmd-label">RELATION</label>
            <input className="cmd-input" spellCheck={false} placeholder="how they fit the beat" value={relation} onChange={e => setRelation(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPerson() }} />
          </div>
          <div style={{ width: 120 }}>
            <label className="cmd-label">CHANNEL</label>
            <select className="cmd-select" value={channel} onChange={e => setChannel(e.target.value)}>
              {['link', 'email', 'phone'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {channel !== 'link' && (
            <div style={{ minWidth: 200 }}>
              <label className="cmd-label">{channel === 'email' ? 'EMAIL' : 'PHONE (E.164)'}</label>
              <input className="cmd-input" spellCheck={false} placeholder={channel === 'email' ? 'name@example.com' : '+14045551234'} value={address} onChange={e => setAddress(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPerson() }} />
            </div>
          )}
          <button className="cmd-btn primary" disabled={busy !== null || name.trim().length < 2} onClick={addPerson}>{busy === 'add' ? 'ADDING…' : '+ ATTACH'}</button>
        </div>
        <div className="px-4 pb-4 cmd-kbd">a link-channel person just gets a private URL to open &middot; email/phone are stored for you to reach them (delivery is manual for now)</div>
      </section>
    </div>
  )
}
