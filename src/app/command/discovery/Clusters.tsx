'use client'
import { useEffect, useRef, useState } from 'react'

// STORY CLUSTERS with the producer in the loop. The AI clusters the feed by EVENT fingerprint; a human can
// MERGE two clusters, SPLIT an item out into its own cluster, RENAME one, PIN one as today's story, or
// DISMISS one as not-a-story. Every op POSTs to /api/command/cluster/edit, which appends it to the overrides
// layer for this clusters file and returns the EFFECTIVE list (AI output + human ops replayed); that list is
// handed back through onChange so the page (and the producer rank) see what the human decided.
const KINDCHIP: Record<string, string> = { story: 'ok', substory: 'info', topic: '' }
const API = '/api/command/cluster/edit'

type Item = { index: number; text: string }
type Props = { clusters: any[]; file: string | null; onChange: (effective: any[]) => void }

/** the single feed items of a cluster, addressable by feed index (server sends items[]; older shapes are zipped) */
function itemsOf(c: any): Item[] {
  if (Array.isArray(c?.items) && c.items.length) return c.items
  const idx: number[] = Array.isArray(c?.item_indices) ? c.item_indices : []
  const ev: string[] = Array.isArray(c?.evidence) ? c.evidence : []
  if (idx.length) return idx.map((n, k) => ({ index: n, text: String(ev[k] ?? '') }))
  return ev.map(t => ({ index: -1, text: String(t) }))
}
/** "subject action object · claim" or null when the fingerprint is empty (human-split clusters) */
function fingerprint(c: any): { head: string; rest: string } | null {
  const f = c?.event_fingerprint
  if (!f) return null
  const rest = [f.action, f.object].filter(Boolean).join(' ') + (f.claim ? ` · ${f.claim}` : '')
  if (!f.subject && !rest.trim()) return null
  return { head: String(f.subject || ''), rest }
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const CSS = `
.clu-act{display:inline-flex;align-items:center;gap:5px;min-height:24px;padding:2px 9px;border:1px solid var(--cmd-line-hot);background:transparent;color:var(--cmd-dim);font-family:inherit;font-size:10px;letter-spacing:.08em;cursor:pointer;transition:all .15s;white-space:nowrap}
.clu-act:hover:not(:disabled){border-color:var(--cmd-amber);color:var(--cmd-amber)}
.clu-act:disabled{opacity:.4;cursor:not-allowed}
.clu-act.on{border-color:var(--cmd-red);color:var(--cmd-red)}
.clu-act.on:hover:not(:disabled){background:oklch(0.6 0.24 27 / .12);color:var(--cmd-red);border-color:var(--cmd-red)}
.clu-card{transition:border-color .15s,box-shadow .15s}
.clu-card:hover{border-color:var(--cmd-line-hot);box-shadow:0 2px 14px oklch(0 0 0 / .35)}
.clu-card.pinned{border-left:3px solid var(--cmd-red)}
.clu-sub{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px;border:1px dashed var(--cmd-line-hot);background:var(--cmd-bg)}
.clu-item{display:flex;gap:8px;align-items:flex-start;padding:6px 6px;border-top:1px solid var(--cmd-line)}
.clu-item:first-child{border-top:0}
.clu-item:hover{background:oklch(1 0 0 / .03)}
.clu-item .t{flex:1;color:var(--cmd-dim);font-size:11.5px;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.clu-dis{opacity:.55}
.clu-dis .cmd-display{text-decoration:line-through}
`

export default function Clusters({ clusters, file, onChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [opCount, setOpCount] = useState(0)
  const [staleOps, setStaleOps] = useState(0)
  const [showDismissed, setShowDismissed] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [merging, setMerging] = useState<string | null>(null)
  const [mergeInto, setMergeInto] = useState('')
  const [splitOpen, setSplitOpen] = useState<Record<string, boolean>>({})
  // the parent may pass an inline onChange; keep the newest one in a ref so the mount sync never loops
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const absorb = (j: any) => {
    setOpCount(j?.overrides?.ops?.length || 0)
    setStaleOps(j?.overrides?.stale ? (j.overrides.stale_ops || 0) : 0)
    if (Array.isArray(j?.clusters) && j.clusters.length) onChangeRef.current(j.clusters)
  }

  // sync the human layer for this clusters file on mount / file change: op count for UNDO, and the effective
  // (human-applied) list in case the parent handed us the raw AI output
  useEffect(() => {
    let dead = false
    fetch(API + (file ? '?file=' + encodeURIComponent(file) : ''), { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!dead && j?.ok && j.file) absorb(j) })
      .catch(() => {})
    return () => { dead = true }
  }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (key: string, body: Record<string, any>): Promise<boolean> => {
    setBusy(key); setErr(null)
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(file ? { file } : {}), ...body }) })
      const j = await r.json().catch(() => ({} as any))
      if (j?.ok) { absorb(j); return true }
      setErr(`${j?.stage ? j.stage + ': ' : ''}${j?.error || 'edit failed (http ' + r.status + ')'}${j?.retryable ? ' (retry)' : ''}`)
    } catch (e: any) { setErr('network: ' + String(e?.message || e)) }
    finally { setBusy(null) }
    return false
  }
  const op = (key: string, o: Record<string, any>) => send(key, { op: o })
  const pin = (c: any) => op('pin:' + c.id, { op: 'pin', id: c.id, pinned: !c.pinned })
  const dismiss = (c: any) => op('dismiss:' + c.id, { op: 'dismiss', id: c.id, dismissed: !c.dismissed })
  const split = (c: any, index: number) => op(`split:${c.id}:${index}`, { op: 'split', from: c.id, item_index: index })
  const undo = () => send('undo', { undo: true })
  const startRename = (c: any) => { setMerging(null); setRenaming(c.id); setDraft(String(c.title || '')) }
  const rename = async (c: any) => {
    const t = draft.trim()
    if (!t || t === c.title) { setRenaming(null); return }
    if (await op('rename:' + c.id, { op: 'rename', id: c.id, title: t })) setRenaming(null)
  }
  const startMerge = (c: any) => { setRenaming(null); setMerging(c.id); setMergeInto('') }
  const merge = async (c: any) => {
    if (!mergeInto) return
    if (await op('merge:' + c.id, { op: 'merge', into: mergeInto, from: c.id })) { setMerging(null); setMergeInto('') }
  }

  if (!clusters.length) return null
  const live = clusters.filter(c => c && !c.dismissed)
  const dismissedN = clusters.length - live.length
  const humanN = clusters.filter(c => c?.human).length
  const pinnedN = live.filter(c => c.pinned).length
  const n = { stories: live.filter(c => c.kind === 'story').length, substories: live.filter(c => c.kind === 'substory').length, topics: live.filter(c => c.kind === 'topic').length }
  const visible = showDismissed ? clusters : live
  const lbl = (key: string, idle: string, working: string) => (busy === key ? working : idle)

  return (
    <section className="space-y-2">
      {/* HTML-injected, not a text child: React escapes quotes in the CSS on the server while the browser keeps
          <style> raw, which hydrates as "Text content does not match" on every cold load (same fix as DATAFLOW) */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="flex items-center gap-3 flex-wrap">
        <span className="cmd-label" style={{ color: 'var(--cmd-cyan)', margin: 0 }}>STORY CLUSTERS · grouped by EVENT, not topic · the producer can merge, split, rename, pin, dismiss</span>
        <span className="cmd-kbd">{plural(n.stories, 'story', 'stories')} · {plural(n.substories, 'substory', 'substories')} · {plural(n.topics, 'topic', 'topics')}</span>
        {pinnedN > 0 && <span className="chip err">📌 {pinnedN}</span>}
        <span className={`chip ${humanN ? 'warn' : ''}`} title={`${opCount} human op${opCount === 1 ? '' : 's'} on this clustering`}>HUMAN {humanN}</span>
        {staleOps > 0 && <span className="chip info" title="the AI re-clustered this pull after those edits were made; they were retired, not applied">{staleOps} EARLIER EDITS RETIRED</span>}
        <span className="ml-auto flex items-center gap-2 flex-wrap">
          {err && <span className="chip err" title={err}>{err.slice(0, 72)}</span>}
          {dismissedN > 0 && <button className={`clu-act${showDismissed ? ' on' : ''}`} style={{ minHeight: 24 }} onClick={() => setShowDismissed(v => !v)}>{showDismissed ? 'HIDE DISMISSED' : `SHOW DISMISSED (${dismissedN})`}</button>}
          <button className="clu-act" style={{ minHeight: 24 }} disabled={!!busy || opCount === 0} onClick={undo} title={opCount ? `undo the last human op (${opCount} on file)` : 'no human ops yet'}>{lbl('undo', '↶ UNDO', 'UNDOING…')}</button>
        </span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(460px,1fr))' }}>
        {visible.map((c: any, i: number) => {
          const id = String(c.id || i)
          const items = itemsOf(c)
          const fp = fingerprint(c)
          const others = live.filter(x => x.id !== c.id)

          if (c.dismissed) return (
            <div key={id} className="cmd-panel p-2 clu-card clu-dis flex items-center gap-2 flex-wrap">
              <span className={`chip ${KINDCHIP[c.kind] || ''}`}>{String(c.kind || 'topic').toUpperCase()}</span>
              <span className="cmd-display" style={{ fontSize: 12.5, color: 'var(--cmd-dim)' }}>{c.title}</span>
              <span className="cmd-kbd">DISMISSED · not a story</span>
              <button className="clu-act ml-auto" style={{ minHeight: 24 }} disabled={!!busy} onClick={() => dismiss(c)}>{lbl('dismiss:' + c.id, 'RESTORE', 'RESTORING…')}</button>
            </div>
          )

          return (
            <div key={id} className={`cmd-panel p-3 clu-card${c.pinned ? ' pinned' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`chip ${KINDCHIP[c.kind] || ''}`}>{String(c.kind || 'topic').toUpperCase()}</span>
                {renaming === c.id
                  ? <input className="cmd-input" autoFocus value={draft} onChange={e => setDraft(e.target.value)} style={{ flex: 1, minWidth: 200, padding: '4px 8px', fontSize: 13 }} placeholder="new title · Enter saves · Esc cancels"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rename(c) } else if (e.key === 'Escape') { e.preventDefault(); setRenaming(null) } }} />
                  : <span className="cmd-display" style={{ fontSize: 13.5, color: 'var(--cmd-ink)' }}>{c.title}</span>}
                {c.pinned && <span className="chip err">TODAY&apos;S STORY</span>}
                {c.human && <span className="chip warn" title={`human: ${(c.human_ops || []).join(', ') || 'edited'}`}>HUMAN</span>}
                <span className="cmd-kbd ml-auto" style={{ fontSize: 10 }}>{c.id}</span>
              </div>
              {fp && <div style={{ color: 'var(--cmd-dim)', fontSize: 12.5, lineHeight: 1.5 }}><b style={{ color: 'var(--cmd-cyan)' }}>{fp.head} </b>{fp.rest}</div>}
              {c.why_moving && <div style={{ color: 'var(--cmd-dim)', fontSize: 12.5 }}>{c.why_moving}</div>}
              {c.split_from && <div className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>✂ split out of {c.split_from}{c.split_from_title ? ` · ${c.split_from_title}` : ''}</div>}
              {(c.merged_titles || []).length > 0 && <div className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>⇢ absorbed: {c.merged_titles.join(' · ')}</div>}
              <div className="flex gap-1 flex-wrap items-center">
                {(c.shared_signals || []).slice(0, 5).map((sig: string, k: number) => <span key={k} className="cmd-kbd" style={{ fontSize: 10 }}>{sig}</span>)}
                <span className="cmd-kbd ml-auto">{plural(items.length, 'item', 'items')}</span>
              </div>

              {/* the human controls */}
              <div className="flex items-center gap-1 flex-wrap" style={{ borderTop: '1px solid var(--cmd-line)', paddingTop: 7, marginTop: 1 }}>
                <button className={`clu-act${c.pinned ? ' on' : ''}`} style={{ minHeight: 24 }} disabled={!!busy} onClick={() => pin(c)} title={c.pinned ? 'unpin' : "pin as today's story"}>{lbl('pin:' + c.id, c.pinned ? '📌 PINNED' : '📌 PIN', 'PINNING…')}</button>
                {renaming === c.id
                  ? <><button className="clu-act on" style={{ minHeight: 24 }} disabled={!!busy} onClick={() => rename(c)}>{lbl('rename:' + c.id, 'SAVE', 'SAVING…')}</button><button className="clu-act" style={{ minHeight: 24 }} disabled={!!busy} onClick={() => setRenaming(null)}>CANCEL</button></>
                  : <button className="clu-act" style={{ minHeight: 24 }} disabled={!!busy} onClick={() => startRename(c)}>✎ RENAME</button>}
                <button className={`clu-act${merging === c.id ? ' on' : ''}`} style={{ minHeight: 24 }} disabled={!!busy || !others.length} onClick={() => (merging === c.id ? setMerging(null) : startMerge(c))} title={others.length ? 'fold this cluster into another one' : 'no other cluster to merge into'}>⇢ MERGE INTO…</button>
                <button className={`clu-act${splitOpen[c.id] ? ' on' : ''}`} style={{ minHeight: 24 }} disabled={!!busy} onClick={() => setSplitOpen(s => ({ ...s, [c.id]: !s[c.id] }))} title="show the items; split one out into its own cluster">✂ SPLIT ({items.length})</button>
                <button className="clu-act" style={{ minHeight: 24 }} disabled={!!busy} onClick={() => dismiss(c)} title="hide as not-a-story (restorable)">{lbl('dismiss:' + c.id, '✕ DISMISS', 'DISMISSING…')}</button>
              </div>

              {merging === c.id && (
                <div className="clu-sub">
                  <span className="cmd-kbd" style={{ whiteSpace: 'nowrap' }}>merge <b style={{ color: 'var(--cmd-ink)' }}>{c.id}</b> into</span>
                  <select className="cmd-select" value={mergeInto} onChange={e => setMergeInto(e.target.value)} style={{ width: 'auto', flex: 1, minWidth: 180, padding: '3px 6px', fontSize: 11.5 }}>
                    <option value="">pick the cluster that keeps its fingerprint…</option>
                    {others.map(x => <option key={x.id} value={x.id}>{x.id} · {String(x.title || '').slice(0, 70)}</option>)}
                  </select>
                  <button className="clu-act on" style={{ minHeight: 24 }} disabled={!!busy || !mergeInto} onClick={() => merge(c)}>{lbl('merge:' + c.id, 'CONFIRM MERGE', 'MERGING…')}</button>
                  <button className="clu-act" style={{ minHeight: 24 }} disabled={!!busy} onClick={() => setMerging(null)}>CANCEL</button>
                </div>
              )}

              {splitOpen[c.id] && (
                <div style={{ border: '1px solid var(--cmd-line)', background: 'var(--cmd-bg)' }}>
                  {items.length < 2 && <div className="cmd-kbd" style={{ padding: '6px 8px', color: 'var(--cmd-amber)' }}>one item: this cluster is already its own story</div>}
                  {items.map((it, k) => (
                    <div key={k} className="clu-item">
                      <span className="cmd-kbd" style={{ fontSize: 10, minWidth: 28, color: 'var(--cmd-faint)' }}>{it.index >= 0 ? '#' + it.index : '?'}</span>
                      <span className="t" title={it.text}>{it.text || '(no text)'}</span>
                      <button className="clu-act" style={{ minHeight: 24 }} disabled={!!busy || items.length < 2 || it.index < 0} onClick={() => split(c, it.index)} title="make this item its own cluster">{lbl(`split:${c.id}:${it.index}`, 'split out', 'splitting…')}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
