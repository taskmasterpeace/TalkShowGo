'use client'
import { useEffect, useState } from 'react'
import { useCmdState, saveBeat, Flash, useBeat, BeatPicker, ago, statusDate } from '../lib'

export default function Sources() {
  const { state, reload } = useCmdState()
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  // SCOUT panel: topic-first discovery (who's covering it on YouTube / X) + resolve-a-name
  const [topic, setTopic] = useState('')
  const [hours, setHours] = useState(48)
  const [scout, setScout] = useState<any>(null)
  const [scoutErr, setScoutErr] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [resolved, setResolved] = useState<any>(undefined)   // undefined = untouched, null = no match
  const [resolveErr, setResolveErr] = useState<string | null>(null)
  // Robert 2026-09-02: "It should suggest channels but allow you to verify it." The scout SUGGESTS every channel with
  // three-plus videos on the topic inside the window; a human ADDs or DISMISSes. AUTO-ADD (no review) skips the
  // review: OFF on a fresh browser, remembered per browser once the owner turns it on. X never auto-adds (needs a userId).
  const AUTO_KEY = 'tsg_scout_auto'
  const [auto, setAuto] = useState(false)
  useEffect(() => { try { const s = localStorage.getItem(AUTO_KEY); if (s === '1') setAuto(true) } catch {} }, [])
  const toggleAuto = () => { const n = !auto; setAuto(n); try { localStorage.setItem(AUTO_KEY, n ? '1' : '0') } catch {} }
  // EXPLORE: the beat's own topics (cases, top story clusters, the show name) -> channels it has never used
  const [explored, setExplored] = useState<any>(null)
  const [exploreErr, setExploreErr] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { beat, beats, pick } = useBeat(state)
  if (!state) return <div className="p-8 cmd-kbd">LOADING SOURCES...</div>
  if (!beat) return <div className="p-8 cmd-kbd">NO BEAT LOADED</div>
  const tw = beat.sources?.twitter || []
  const yt = beat.sources?.youtube || []
  // handles never keep an '@' (typed OR pasted); strip every one (leading or embedded)
  const stripAt = (v: string) => (v || '').replace(/@/g, '')
  // a hand-edited beat may be missing sources or a sub-array; never deref undefined on a click
  const withSources = (b: any) => { if (!b.sources || typeof b.sources !== 'object') b.sources = {}; if (!Array.isArray(b.sources.twitter)) b.sources.twitter = []; if (!Array.isArray(b.sources.youtube)) b.sources.youtube = []; return b }

  const save = async (next: any, msg = 'SAVED') => {
    await saveBeat(beat.file, next)
    setFlash(msg); setTimeout(() => setFlash(null), 1200)
    reload()
  }
  const patchTw = (i: number, patch: any) => {
    const next = withSources(structuredClone(beat)); if (!next.sources.twitter[i]) return
    Object.assign(next.sources.twitter[i], patch)
    if (patch.handle !== undefined) { next.sources.twitter[i].status = 'unverified (edited)'; delete next.sources.twitter[i].userId }
    save(next)
  }
  const removeTw = (i: number) => { const next = withSources(structuredClone(beat)); next.sources.twitter.splice(i, 1); save(next, 'REMOVED') }
  const addTw = () => { const next = withSources(structuredClone(beat)); next.sources.twitter.push({ handle: '', label: '', type: 'blogger', priority: 2, status: 'unverified (new)' }); save(next, 'ADDED') }
  const patchYt = (i: number, patch: any) => {
    const next = withSources(structuredClone(beat)); if (!next.sources.youtube[i]) return
    Object.assign(next.sources.youtube[i], patch)
    if (patch.channel_name !== undefined) { next.sources.youtube[i].status = 'unverified (edited)'; delete next.sources.youtube[i].channel_id }
    save(next)
  }
  const removeYt = (i: number) => { const next = withSources(structuredClone(beat)); next.sources.youtube.splice(i, 1); save(next, 'REMOVED') }
  const addYt = () => { const next = withSources(structuredClone(beat)); next.sources.youtube.push({ channel_name: '', type: 'blogger', priority: 2, status: 'unverified (new)' }); save(next, 'ADDED') }

  const runVerify = async () => {
    setBusy('tw'); setLog([])
    try { const r = await fetch('/api/command/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: beat.file }) }); const j = await r.json(); setLog(j.log || []) }
    finally { setBusy(null); reload() }
  }
  const runResolve = async () => {
    setBusy('yt'); setLog([])
    try { const r = await fetch('/api/command/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: beat.file, action: 'resolve' }) }); const j = await r.json(); setLog(j.log || []) }
    finally { setBusy(null); reload() }
  }

  // --- SCOUT: topic -> who's covering it; name -> channel; one-click ADD into THIS beat ---
  const scoutPost = async (body: any) => {
    const r = await fetch('/api/command/scout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({} as any))
    if (!r.ok || !j?.ok) throw new Error((j?.error || `http ${r.status}`) + (j?.stage ? ` [${j.stage}]` : ''))
    return j
  }
  const runScout = async () => {
    const t = topic.trim(); if (t.length < 2 || busy) return
    setBusy('scout'); setScoutErr(null)
    try {
      const j = await scoutPost({ topic: t, beat_file: beat.file, hours, auto })
      setScout(j)
      const n = (j.auto_added || []).length
      // the beat just changed on disk: pull it back so the YOUTUBE table below shows the new rows
      if (n) { await reload(); setFlash(`AUTO-ADDED ${n}`); setTimeout(() => setFlash(null), 1600) }
    }
    catch (e: any) { setScoutErr(String(e?.message || e)) }
    finally { setBusy(null) }
  }
  const runResolveName = async () => {
    const n = name.trim(); if (n.length < 2 || busy) return
    setBusy('resolve'); setResolveErr(null); setResolved(undefined)
    try { const j = await scoutPost({ resolve: n }); setResolved(j.channel ?? null) }
    catch (e: any) { setResolveErr(String(e?.message || e)) }
    finally { setBusy(null) }
  }
  const runExplore = async () => {
    if (busy) return
    setBusy('explore'); setExploreErr(null)
    try { setExplored(await scoutPost({ explore: true, beat_file: beat.file, hours: 168 })) }
    catch (e: any) { setExploreErr(String(e?.message || e)) }
    finally { setBusy(null) }
  }
  // a human said no: the channel lands on lab/scout/dismissed_<beat>.json and is never suggested again
  const dismissSuggestion = async (s: any) => {
    const dk = 'dismiss:' + s.channel_id
    if (busy) return
    setBusy(dk); setScoutErr(null)
    try {
      await scoutPost({ dismiss: { beat_file: beat.file, channel_id: s.channel_id, channel_name: s.channel_name } })
      setScout((cur: any) => cur ? { ...cur, suggested: (cur.suggested || []).filter((x: any) => x.channel_id !== s.channel_id) } : cur)
      setExplored((cur: any) => cur ? { ...cur, explored: (cur.explored || []).map((e: any) => ({ ...e, suggested: (e.suggested || []).filter((x: any) => x.channel_id !== s.channel_id) })) } : cur)
      setFlash('DISMISSED ' + String(s.channel_name).toUpperCase()); setTimeout(() => setFlash(null), 1600)
    } catch (e: any) { setScoutErr('DISMISS FAILED: ' + String(e?.message || e)) }
    finally { setBusy(null) }
  }
  // live against the CURRENT beat (server flags go stale the moment the picker switches beats)
  const inBeatYt = (id?: string | null) => !!id && yt.some((c: any) => c.channel_id === id)
  const inBeatTw = (h?: string | null) => !!h && tw.some((s: any) => String(s.handle || '').toLowerCase() === String(h).replace(/^@/, '').toLowerCase())
  // channels THIS scout wrote into the beat on its own (shown as ADDED (auto) instead of IN BEAT / + ADD)
  const autoAdded: any[] = scout?.auto_added || []
  const autoAddedIds = new Set<string>(autoAdded.map((a: any) => a.channel_id))
  const scoutAdd = async (key: string, add: any, label: string) => {
    setBusy(key); setScoutErr(null)
    try { await scoutPost({ add: { beat_file: beat.file, ...add } }); await reload(); setFlash('ADDED ' + label.toUpperCase()); setTimeout(() => setFlash(null), 1600) }
    catch (e: any) { setScoutErr('ADD FAILED: ' + String(e?.message || e)) }
    finally { setBusy(null) }
  }

  // a suggested channel (from SCOUT or EXPLORE): who · how many inside the window · why · ADD (verified) / DISMISS (never again)
  const suggestionTable = (list: any[], hours: number) => (
    <div className="overflow-x-auto">
      <table className="cmd-table">
        <thead><tr><th>CHANNEL</th><th>IN WINDOW</th><th>WHY</th><th /></tr></thead>
        <tbody>
          {list.map((s: any) => {
            const k = 'add:yt:' + s.channel_id, dk = 'dismiss:' + s.channel_id
            const inBeat = inBeatYt(s.channel_id)
            return (
              <tr key={s.channel_id}>
                <td style={{ minWidth: 170 }}>
                  <div className="flex items-center gap-2">
                    <div><div style={{ color: 'var(--cmd-ink)' }}>{s.channel_name}</div>{s.handle && <div className="cmd-kbd" style={{ color: 'var(--cmd-cyan)' }}>{s.handle}</div>}</div>
                    {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }} title="open the channel - eyeball it's the right one before you ADD">↗</a>}
                  </div>
                </td>
                <td><span className="chip warn" title={`${s.in_window} videos inside the last ${hours}h (${s.video_count} on the topic overall)`}>{s.in_window} IN {hours}H</span></td>
                <td style={{ color: 'var(--cmd-dim)' }}>
                  {s.reason}
                  {s.latest_title && <div className="cmd-kbd truncate" style={{ maxWidth: 340 }} title={s.latest_title}>{s.latest_url ? <a href={s.latest_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{s.latest_title}</a> : s.latest_title}</div>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div className="flex items-center gap-2">
                    {inBeat
                      ? <span className="chip ok">IN BEAT</span>
                      : <button className="cmd-btn ghost" disabled={busy !== null} onClick={() => scoutAdd(k, { youtube: { channel_id: s.channel_id, channel_name: s.channel_name, subscribers: s.handle } }, s.channel_name)}>{busy === k ? 'ADDING…' : '✓ ADD'}</button>}
                    {!inBeat && <button className="cmd-btn ghost" disabled={busy !== null} onClick={() => dismissSuggestion(s)} title="never suggest this channel again for this beat">{busy === dk ? '…' : '✕ DISMISS'}</button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  // one resolved-channel row (the pick, or an alternate): title · @handle · subs · id · open · ADD/IN BEAT
  const channelRow = (c: any, suspect = false) => {
    const k = 'add:yt:' + c.channel_id
    return (
      <div key={c.channel_id} className="flex flex-wrap items-center gap-2">
        <span style={{ color: 'var(--cmd-ink)' }}>{c.title}</span>
        {c.handle && <span style={{ color: 'var(--cmd-cyan)' }}>{c.handle}</span>}
        {c.subscribers && <span className={`chip ${suspect ? 'warn' : ''}`} title={suspect ? 'tiny channel with a matching name: possible squatter, eyeball it' : undefined}>{suspect ? 'SUSPECT: ' : ''}{String(c.subscribers).toUpperCase()}</span>}
        <span className="cmd-kbd">{c.channel_id}</span>
        <a href={c.url} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }} title="open the channel - eyeball it's the right one">↗</a>
        {inBeatYt(c.channel_id)
          ? <span className="chip ok">IN BEAT</span>
          : <button className="cmd-btn ghost" disabled={busy !== null} onClick={() => scoutAdd(k, { youtube: { channel_id: c.channel_id, channel_name: c.title, subscribers: c.handle } }, c.title)}>{busy === k ? 'ADDING…' : '+ ADD'}</button>}
      </div>
    )
  }

  // enrich: activity from THIS SHOW's latest pull only (no cross-show bleed)
  const pull = (state.pulls || []).find((p: any) => p?.beat === beat?.id)
  const pullAge = ago(pull?.pulled_at)
  const twWin: Record<string, number> = {}
  const twLast: Record<string, string | null> = {}
  for (const s of pull?.twitter || []) if (s.handle) {
    twWin[s.handle.toLowerCase()] = s.in_window ?? 0
    const newest = (s.top || []).reduce((a: number, t: any) => Math.max(a, new Date(t.created).getTime() || 0), 0)
    twLast[s.handle.toLowerCase()] = newest ? new Date(newest).toISOString() : null
  }
  const ytWin: Record<string, number> = {}
  const ytLast: Record<string, string | null> = {}
  for (const c of pull?.youtube || []) if (c.channel_id) {
    ytWin[c.channel_id] = c.in_window ?? 0
    ytLast[c.channel_id] = c.videos?.[0]?.published || null
  }
  const ageChip = (status?: string) => {
    const d = statusDate(status); if (!d) return null
    const a = ago(d + 'T12:00:00Z')
    return <span className={`chip ${a.cls}`} title={`last checked ${d}`}>{a.text}</span>
  }

  const chip = (status: string) => {
    const s = String(status || '')
    if (s.startsWith('VERIFIED') || s.startsWith('RESOLVED')) return <span className="chip ok">{s.split(' ')[0]}</span>
    if (s.startsWith('SUSPECT')) return <span className="chip warn" title={s}>SUSPECT</span>
    if (s.startsWith('NOT FOUND') || s.startsWith('ERROR')) return <span className="chip err" title={s}>{s.split(' ')[0]}</span>
    return <span className="chip" title={s}>UNVERIFIED</span>
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>SOURCES — {beat.name?.toUpperCase()}</span>
        <BeatPicker beats={beats} beat={beat} pick={pick} />
        <span className={`chip ${pullAge.cls}`}>LAST PULL: {pullAge.text.toUpperCase()}</span>
        <Flash msg={flash} />
      </div>

      {/* SCOUT: topic-first source discovery. When a story gets hot you look up the TOPIC, then you end up
          looking up somebody's NAME. Both live here, and every hit is one click from joining this beat. */}
      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>SCOUT A TOPIC</h2></div>
          <span className="cmd-kbd">ADDS GO TO <span style={{ color: 'var(--cmd-amber)' }}>{String(beat.show?.name || beat.name || beat.id).toUpperCase()}</span> (switch beats in the header)</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1" style={{ minWidth: 260 }}>
              <label className="cmd-label">WHAT&apos;S THE STORY?</label>
              <input className="cmd-input" spellCheck={false} placeholder="what's the story? (e.g. Lil Durk case)" value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runScout() }} />
            </div>
            <div style={{ width: 120 }}>
              <label className="cmd-label">WINDOW</label>
              <select className="cmd-select" value={hours} onChange={e => setHours(Number(e.target.value))}>
                {[24, 48, 72, 168].map(h => <option key={h} value={h}>{h === 168 ? '7 DAYS' : `${h}H`}</option>)}
              </select>
            </div>
            <button className="cmd-btn primary" disabled={busy !== null || topic.trim().length < 2} onClick={runScout}>{busy === 'scout' ? 'SCOUTING…' : 'SCOUT'}</button>
            <button className="cmd-btn" disabled={busy !== null} onClick={runExplore} title="scout this beat's own topics (its cases, the top story clusters, the show name) over the last 7 days for channels it has never used">{busy === 'explore' ? 'EXPLORING…' : '⌖ EXPLORE'}</button>
            <button type="button" role="switch" aria-checked={auto} className="cmd-btn ghost" disabled={busy !== null} onClick={toggleAuto} title="ON = every channel that clears the bar (3+ videos on the topic inside the window, real channel id, not already in the beat) is written into the beat with no review. OFF = it is SUGGESTED and you verify. X handles are never auto-added (they need the verify flow's userId).">
              AUTO-ADD (no review) <span className={`chip ${auto ? 'warn' : ''}`}>{auto ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <div className="cmd-kbd">the scout SUGGESTS every channel with 3+ videos on the topic inside the window (real channel id, not already in the beat, not dismissed) · you verify: ADD, or DISMISS = never again for this beat · EXPLORE walks the beat&apos;s own topics for channels it has never used</div>
          {scoutErr && <div><span className="chip err" title={scoutErr}>SCOUT FAILED: {scoutErr.slice(0, 140)}</span></div>}
          {scout && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip info">{scout.counts?.youtube_videos ?? 0} VIDEOS</span>
                <span className="chip info">{scout.counts?.x_posts ?? 0} POSTS</span>
                <span className={`chip ${(scout.suggested || []).length ? 'warn' : ''}`} title="channels that cleared the bar and wait for your verify">SUGGESTED {(scout.suggested || []).length}</span>
                {scout.auto && <span className={`chip ${autoAdded.length ? 'ok' : ''}`} title={autoAdded.length ? autoAdded.map((a: any) => `${a.channel_name} (${a.in_window} in ${scout.hours}h)`).join(' · ') : 'auto-add was on; no channel cleared the bar this time'}>AUTO-ADDED {autoAdded.length}</span>}
                <span className="cmd-kbd">{`"${scout.topic}" · LAST ${scout.hours}H · ${new Date(scout.generated_at).toLocaleTimeString()}`}</span>
                {(scout.warnings || []).map((w: string, i: number) => <span key={i} className="chip warn" title={w}>{w.slice(0, 90)}</span>)}
              </div>
              {/* SUGGESTED: cleared the bar, waits for a human. ADD = the same path as the manual + ADD; DISMISS = never again. */}
              {(scout.suggested || []).length > 0 ? (
                <div className="cmd-grid-line">
                  <div className="cmd-h justify-between"><h2 style={{ fontSize: 13 }}>SUGGESTED · {scout.suggested.length} CLEARED THE BAR</h2><span className="cmd-kbd">3+ videos on &quot;{scout.topic}&quot; inside {scout.hours}h · open the channel, eyeball it, then ADD · DISMISS = never suggested again for this beat</span></div>
                  {suggestionTable(scout.suggested, scout.hours)}
                </div>
              ) : (scout.auto && autoAdded.length > 0) ? null : (
                <div className="cmd-kbd">NO NEW CHANNEL CLEARED THE BAR FOR &quot;{scout.topic}&quot; (3+ videos inside {scout.hours}h, real channel id, not already in the beat, not dismissed) · everyone the scout saw is below; widen the window or try EXPLORE</div>
              )}
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="cmd-grid-line">
                  <div className="cmd-h"><h2 style={{ fontSize: 13 }}>YOUTUBE · WHO&apos;S COVERING IT</h2><span className="cmd-kbd">ranked by videos, then freshest</span></div>
                  {(scout.youtube || []).length === 0 ? <div className="p-4 cmd-kbd">NOBODY FOUND ON YOUTUBE IN THIS WINDOW</div> : (
                    <div className="overflow-x-auto">
                      <table className="cmd-table">
                        <thead><tr><th>CHANNEL</th><th>VIDEOS</th><th>LATEST</th><th /></tr></thead>
                        <tbody>
                          {scout.youtube.map((c: any) => {
                            const inBeat = c.already_in_beat || inBeatYt(c.channel_id)
                            const k = 'add:yt:' + (c.channel_id || c.channel_name)
                            return (
                              <tr key={k}>
                                <td style={{ minWidth: 160 }}>
                                  <div className="flex items-center gap-2">
                                    <div><div style={{ color: 'var(--cmd-ink)' }}>{c.channel_name}</div>{c.handle && <div className="cmd-kbd" style={{ color: 'var(--cmd-cyan)' }}>{c.handle}</div>}</div>
                                    {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }} title="open the channel - eyeball it's the right one">↗</a>}
                                    {c.id_from === 'search' && <span className="chip warn" title="the video carried no channel id; this one came from a name search on the author label (collab streams can land on the wrong half), eyeball it before adding">BY NAME</span>}
                                  </div>
                                </td>
                                <td><span className="flex gap-1 items-center"><span className={`chip ${c.video_count > 1 ? 'ok' : ''}`}>{c.video_count}</span>{c.in_window > 0 && <span className="chip warn" title={`${c.in_window} inside the last ${scout.hours}h`}>{c.in_window} IN {scout.hours}H</span>}</span></td>
                                <td>
                                  {c.latest ? (
                                    <a href={c.latest.url} target="_blank" rel="noreferrer" style={{ color: 'var(--cmd-dim)', textDecoration: 'none' }} title={c.latest.title}>
                                      <div className="truncate" style={{ maxWidth: 300 }}>{c.latest.title}</div>
                                      <div className="cmd-kbd">{[c.latest.published, c.latest.views].filter(Boolean).join(' · ')}</div>
                                    </a>
                                  ) : <span className="cmd-kbd">·</span>}
                                </td>
                                <td>{c.channel_id && autoAddedIds.has(c.channel_id) ? <span className="chip ok" title={`auto-added: ${c.in_window} videos on the topic inside the last ${scout.hours}h`}>ADDED (auto)</span> : inBeat ? <span className="chip ok">IN BEAT</span> : c.channel_id ? <button className="cmd-btn ghost" disabled={busy !== null} onClick={() => scoutAdd(k, { youtube: { channel_id: c.channel_id, channel_name: c.channel_name, subscribers: c.handle } }, c.channel_name)}>{busy === k ? 'ADDING…' : '+ ADD'}</button> : <span className="chip" title="YouTube returned no channel id for this one">NO ID</span>}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="cmd-grid-line">
                  <div className="cmd-h"><h2 style={{ fontSize: 13 }}>𝕏 · WHO&apos;S TALKING</h2><span className="cmd-kbd">ranked by likes + 2x reposts, then posts</span></div>
                  {(scout.x || []).length === 0 ? <div className="p-4 cmd-kbd">NOBODY FOUND ON X IN THIS WINDOW</div> : (
                    <div className="overflow-x-auto">
                      <table className="cmd-table">
                        <thead><tr><th>HANDLE</th><th>POSTS</th><th>♥ / ↻</th><th>SAMPLE</th><th /></tr></thead>
                        <tbody>
                          {scout.x.map((a: any) => {
                            const inBeat = a.already_in_beat || inBeatTw(a.handle)
                            const k = 'add:tw:' + a.handle
                            return (
                              <tr key={k}>
                                <td style={{ minWidth: 150 }}>
                                  <div className="flex items-center gap-2">
                                    <div><div style={{ color: 'var(--cmd-ink)' }}>@{a.handle}</div><div className="cmd-kbd">{a.name}{a.followers != null ? ` · ${Number(a.followers).toLocaleString()} followers` : ''}</div></div>
                                    <a href={a.url} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }} title={`open x.com/${a.handle} - eyeball it's the right account`}>↗</a>
                                  </div>
                                </td>
                                <td><span className={`chip ${a.posts > 1 ? 'ok' : ''}`}>{a.posts}</span></td>
                                <td style={{ color: 'var(--cmd-amber)', whiteSpace: 'nowrap' }}>{Number(a.likes).toLocaleString()} / {Number(a.rts).toLocaleString()}</td>
                                <td>
                                  {a.sample_url
                                    ? <a href={a.sample_url} target="_blank" rel="noreferrer" style={{ color: 'var(--cmd-dim)', textDecoration: 'none' }} title={a.sample_text}><div className="truncate" style={{ maxWidth: 300 }}>{a.sample_text}</div></a>
                                    : <div className="truncate" style={{ maxWidth: 300, color: 'var(--cmd-dim)' }} title={a.sample_text}>{a.sample_text}</div>}
                                </td>
                                <td>{inBeat ? <span className="chip ok">IN BEAT</span> : <button className="cmd-btn ghost" disabled={busy !== null} onClick={() => scoutAdd(k, { twitter: { handle: a.handle, label: a.name } }, '@' + a.handle)}>{busy === k ? 'ADDING…' : '+ ADD'}</button>}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {/* EXPLORE: the beat's own topics -> channels it has never used. Each channel surfaces once (seen ledger);
              the JANITOR's scout_explore position keeps the pending ones as proposals, so nothing is lost. */}
          {exploreErr && <div><span className="chip err" title={exploreErr}>EXPLORE FAILED: {exploreErr.slice(0, 140)}</span></div>}
          {explored && (
            <div className="cmd-grid-line">
              <div className="cmd-h justify-between">
                <h2 style={{ fontSize: 13 }}>EXPLORE · CHANNELS THIS BEAT HAS NEVER USED</h2>
                <span className="cmd-kbd">{(explored.topics || []).length} TOPICS · LAST {explored.hours}H · <span style={{ color: explored.suggested_total ? 'var(--cmd-amber)' : undefined }}>{explored.suggested_total || 0} NEW</span> · a channel surfaces once; the <a href="/command/janitor" style={{ color: 'var(--cmd-amber)' }}>JANITOR</a> keeps the ones you have not decided</span>
              </div>
              {(explored.topics || []).length === 0 ? (
                <div className="p-4 cmd-kbd">NOTHING TO EXPLORE YET · give the beat a case or a show name, or run PULL then CLUSTER so it has story clusters to walk</div>
              ) : (
                <div className="p-3 space-y-3">
                  {(explored.explored || []).map((e: any) => (
                    <div key={e.topic}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="cmd-display" style={{ letterSpacing: '0.04em' }}>&quot;{e.topic}&quot;</span>
                        <span className="chip" title="where this topic came from">{String(e.from || '').toUpperCase()}</span>
                        <span className="cmd-kbd">{e.candidates} channels seen · {(e.suggested || []).length} new</span>
                        {(e.warnings || []).map((w: string, i: number) => <span key={i} className="chip warn" title={w}>{w.slice(0, 80)}</span>)}
                      </div>
                      {(e.suggested || []).length > 0
                        ? <div className="mt-1">{suggestionTable(e.suggested, e.hours)}</div>
                        : <div className="cmd-kbd mt-1">nothing new on this topic · everyone with 3+ videos is already in the beat, dismissed, or surfaced before</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="pt-4" style={{ borderTop: '1px solid var(--cmd-line)' }}>
            <label className="cmd-label">RESOLVE A NAME TO A YOUTUBE CHANNEL</label>
            <div className="flex flex-wrap items-center gap-3">
              <input className="cmd-input" style={{ maxWidth: 340 }} spellCheck={false} placeholder="e.g. Ceddy Nash" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runResolveName() }} />
              <button className="cmd-btn" disabled={busy !== null || name.trim().length < 2} onClick={runResolveName}>{busy === 'resolve' ? 'RESOLVING…' : 'RESOLVE'}</button>
              {resolveErr && <span className="chip err" title={resolveErr}>RESOLVE FAILED: {resolveErr.slice(0, 120)}</span>}
              {resolved === null && <span className="chip err">NO CHANNEL MATCHED</span>}
              {resolved && channelRow(resolved, !!resolved.suspect)}
            </div>
            {resolved && (resolved.alternates || []).length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="cmd-kbd">ALSO MATCHED (eyeball which one you mean):</div>
                {(resolved.alternates || []).map((c: any) => channelRow(c, c.subs != null && c.subs < 1000))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>TWITTER / X — THE PULSE</h2></div>
          <div className="flex gap-2">
            <button className="cmd-btn ghost" onClick={addTw}>+ ADD</button>
            <button className="cmd-btn" disabled={busy === 'tw'} onClick={runVerify}>{busy === 'tw' ? 'VERIFYING…' : '⟳ VERIFY ALL'}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cmd-table">
            <thead><tr><th>HANDLE</th><th /><th>LABEL</th><th>TYPE</th><th>PRI</th><th>FOLLOWERS</th><th>LAST 24H</th><th>LAST POST SEEN</th><th>USER ID</th><th>STATUS · CHECKED</th><th /></tr></thead>
            <tbody>
              {tw.map((s: any, i: number) => (
                <tr key={`${beat.file}:tw:${i}:${s.handle}`}>
                  <td style={{ minWidth: 150 }}><div className="flex items-center gap-1"><span style={{ color: 'var(--cmd-faint)' }}>@</span>
                    <input className="cmd-input" style={{ border: 'none', padding: '2px 4px', background: 'transparent' }} defaultValue={s.handle}
                      onChange={e => { const v = stripAt(e.currentTarget.value); if (v !== e.currentTarget.value) e.currentTarget.value = v }}
                      onPaste={e => { e.preventDefault(); const el = e.currentTarget; const t = stripAt(e.clipboardData.getData('text')); const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? el.value.length; el.value = stripAt(el.value.slice(0, a) + t + el.value.slice(b)); const p = a + t.length; el.setSelectionRange(p, p) }}
                      onBlur={e => { const v = stripAt(e.currentTarget.value); if (v !== s.handle) patchTw(i, { handle: v }) }} /></div></td>
                  <td>{s.handle && <a href={`https://x.com/${s.handle}`} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }} title={`open x.com/${s.handle} - eyeball it's the right account`}>↗</a>}</td>
                  <td style={{ minWidth: 150 }}><input className="cmd-input" style={{ border: 'none', padding: '2px 4px', background: 'transparent' }} defaultValue={s.label || ''} onBlur={e => e.target.value !== s.label && patchTw(i, { label: e.target.value })} /></td>
                  <td>
                    <select className="cmd-select" style={{ border: 'none', padding: '2px', background: 'transparent', width: 'auto' }} value={s.type} onChange={e => patchTw(i, { type: e.target.value })}>
                      {['league', 'battler', 'blogger', 'media', 'fan'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="cmd-select" style={{ border: 'none', padding: '2px', background: 'transparent', width: 'auto' }} value={s.priority} onChange={e => patchTw(i, { priority: Number(e.target.value) })}>
                      {[1, 2, 3].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={{ color: 'var(--cmd-amber)' }}>{s.followers?.toLocaleString?.() || '—'}</td>
                  <td>{twWin[s.handle?.toLowerCase?.()] !== undefined ? <span className={`chip ${twWin[s.handle.toLowerCase()] > 0 ? 'ok' : ''}`}>{twWin[s.handle.toLowerCase()]}</span> : <span className="cmd-kbd">—</span>}</td>
                  <td>{(() => { const l = twLast[s.handle?.toLowerCase?.()]; if (!l) return <span className="cmd-kbd">—</span>; const a = ago(l); return <span className={`chip ${a.cls}`}>{a.text}</span> })()}</td>
                  <td className="cmd-kbd">{s.userId || '—'}</td>
                  <td><span className="flex gap-1 items-center">{chip(s.status)}{ageChip(s.status)}</span></td>
                  <td><button className="chip err" style={{ cursor: 'pointer' }} onClick={() => removeTw(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cmd-panel">
        <div className="cmd-h justify-between">
          <div className="flex items-center gap-3"><div className="vu"><i /><i /><i /><i /></div><h2>YOUTUBE — THE DEEP DIVE</h2></div>
          <div className="flex gap-2">
            <button className="cmd-btn ghost" onClick={addYt}>+ ADD</button>
            <button className="cmd-btn" disabled={busy === 'yt'} onClick={runResolve}>{busy === 'yt' ? 'RESOLVING…' : '⟳ RESOLVE ALL'}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cmd-table">
            <thead><tr><th>CHANNEL</th><th /><th>TYPE</th><th>PRI</th><th>RESOLVED</th><th>HANDLE</th><th>LAST 24H</th><th>LAST UPLOAD SEEN</th><th>STATUS · CHECKED</th><th /></tr></thead>
            <tbody>
              {yt.map((c: any, i: number) => (
                <tr key={`${beat.file}:yt:${i}:${c.channel_name}`}>
                  <td style={{ minWidth: 190 }}><input className="cmd-input" style={{ border: 'none', padding: '2px 4px', background: 'transparent' }} defaultValue={c.channel_name} onBlur={e => e.target.value !== c.channel_name && patchYt(i, { channel_name: e.target.value })} /></td>
                  <td>{c.channel_id && <a href={`https://www.youtube.com/channel/${c.channel_id}`} target="_blank" rel="noreferrer" className="chip info" style={{ textDecoration: 'none' }} title="open the channel - eyeball it's the right one">↗</a>}</td>
                  <td>
                    <select className="cmd-select" style={{ border: 'none', padding: '2px', background: 'transparent', width: 'auto' }} value={c.type} onChange={e => patchYt(i, { type: e.target.value })}>
                      {['league', 'blogger', 'interviews', 'media'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>{c.priority}</td>
                  <td className="cmd-kbd">{c.resolved_title || '—'}</td>
                  <td style={{ color: 'var(--cmd-cyan)' }}>{c.subscribers || '—'}</td>
                  <td>{ytWin[c.channel_id] !== undefined ? <span className={`chip ${ytWin[c.channel_id] > 0 ? 'ok' : ''}`}>{ytWin[c.channel_id]}</span> : <span className="cmd-kbd">—</span>}</td>
                  <td>{(() => { const l = ytLast[c.channel_id]; if (!l) return <span className="cmd-kbd">—</span>; const a = ago(l); return <span className={`chip ${a.cls}`}>{a.text}</span> })()}</td>
                  <td><span className="flex gap-1 items-center">{chip(c.status)}{ageChip(c.status)}</span></td>
                  <td><button className="chip err" style={{ cursor: 'pointer' }} onClick={() => removeYt(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {log.length > 0 && (
        <section className="cmd-panel p-4">
          <div className="cmd-label mb-2">LAST OPERATION LOG</div>
          <div className="text-xs space-y-1" style={{ color: 'var(--cmd-dim)' }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>
        </section>
      )}
    </div>
  )
}
