'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useCmdState, useBeat, ago } from '../lib'
import type { Journey, Stage, Sample, Chip, StageKey } from '@/lib/command/dataflow'

// HOW THE DATA TRAVELS. One pull's journey through the Story Resolution Loop, laid out left to right
// as a strip of stage cards: the BIG count at each hop, the sub-counts, the elapsed time, and "what
// came back" (real samples). Click a sample and its lineage lights up across the strip (a lead -> the
// dossier it became -> the briefing -> the show), with the detail opened in the inspector below.
// TRACE ONE STORY narrows the whole strip to that story's lineage (server-side, via /api/command/dataflow).

const UNIT: Record<string, string> = { pull: 'feed items', cluster: 'live clusters', leads: 'leads', rank: 'stories ranked', dossiers: 'dossiers', briefings: 'briefings', stances: 'voices briefed', shows: 'shows' }
const fmtMs = (ms: number) => ms < 1000 ? `${Math.round(ms)}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
const clip = (s: unknown, n: number) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
const base = (p: string | null) => String(p || '').split(/[\\/]/).pop() || ''
const stampOf = (f: string) => f.replace(/^pull_/, '').replace(/\.json$/, '')
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

const CSS = `
.df-strip{display:flex;align-items:stretch;overflow-x:auto;padding:6px 2px 14px;scroll-snap-type:x proximity}
.df-card{flex:0 0 324px;width:324px;display:flex;flex-direction:column;gap:8px;padding:12px;scroll-snap-align:start;transition:border-color .15s}
.df-card.df-empty{border-style:dashed}
.df-card.df-hot{border-color:var(--cmd-line-hot)}
.df-head{display:flex;align-items:center;gap:8px;min-height:24px}
.df-idx{font-family:var(--font-cmd-display);font-size:11px;color:var(--cmd-faint);letter-spacing:.1em}
.df-name{font-size:16px;letter-spacing:.14em;color:var(--cmd-ink)}
.df-what{line-height:1.45;min-height:34px}
.df-big{display:flex;align-items:baseline;gap:8px}
.df-big .cmd-num{font-size:40px}
.df-reason{font-size:11px;color:var(--cmd-amber);line-height:1.45;border:1px dashed var(--cmd-amber);padding:6px 8px}
.df-subs{display:flex;flex-direction:column;gap:2px;max-height:150px;overflow:auto;border-top:1px solid var(--cmd-line);border-bottom:1px solid var(--cmd-line);padding:6px 0}
.df-sub{display:flex;justify-content:space-between;gap:10px;font-size:11px;letter-spacing:.03em;line-height:1.5}
.df-sub .k{color:var(--cmd-faint)}
.df-sub .v{color:var(--cmd-ink);text-align:right;white-space:nowrap}
.df-sub .v.ok{color:var(--cmd-green)} .df-sub .v.warn{color:var(--cmd-amber)} .df-sub .v.err{color:var(--cmd-red)} .df-sub .v.info{color:var(--cmd-cyan)}
.df-file{font-size:10px;color:var(--cmd-faint);letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.df-act{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:2px 9px;border:1px solid var(--cmd-line-hot);background:transparent;color:var(--cmd-dim);font-family:inherit;font-size:10px;letter-spacing:.1em;cursor:pointer;transition:all .15s;white-space:nowrap}
.df-act:hover:not(:disabled){border-color:var(--cmd-amber);color:var(--cmd-amber)}
.df-act:disabled{opacity:.4;cursor:not-allowed}
.df-act.on{border-color:var(--cmd-red);color:var(--cmd-red)}
.df-list{display:flex;flex-direction:column;gap:4px;max-height:340px;overflow:auto}
.df-row{border:1px solid var(--cmd-line);background:var(--cmd-bg);padding:5px 6px;display:flex;flex-direction:column;gap:3px;transition:border-color .15s,opacity .15s}
.df-row.sel{border-color:var(--cmd-red);box-shadow:0 0 0 1px var(--cmd-red) inset}
.df-row.lit{border-color:var(--cmd-amber)}
.df-row.dim{opacity:.38}
.df-pick{display:flex;align-items:center;gap:6px;min-height:26px;width:100%;text-align:left;background:transparent;border:0;color:var(--cmd-ink);font-family:inherit;font-size:12px;cursor:pointer;padding:0}
.df-pick:hover .df-txt{color:var(--cmd-amber)}
.df-txt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.4}
.df-n{font-family:var(--font-cmd-display);font-size:13px;color:var(--cmd-amber);min-width:28px;text-align:right}
.df-med{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:18px;padding:0 5px;font-size:9.5px;letter-spacing:.1em;border:1px solid var(--cmd-line-hot);color:var(--cmd-dim);flex:0 0 auto;font-family:var(--font-cmd-mono),monospace}
.df-med.yt{border-color:var(--cmd-red);color:var(--cmd-red)}
.df-med.web{border-color:var(--cmd-cyan);color:var(--cmd-cyan)}
.df-med.x{border-color:var(--cmd-ink);color:var(--cmd-ink)}
.df-med.tag{color:var(--cmd-faint)}
.df-line{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:10.5px;color:var(--cmd-dim);line-height:1.4;min-height:18px}
.df-line .s{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.df-link{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;color:var(--cmd-cyan);text-decoration:none;border:1px solid transparent;font-size:13px}
.df-link:hover{border-color:var(--cmd-cyan)}
.df-arrow{flex:0 0 36px;display:flex;align-items:center;justify-content:center;position:relative;color:var(--cmd-amber)}
.df-arrow::before{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:var(--cmd-line-hot)}
.df-arrow span{position:relative;background:var(--cmd-bg);padding:0 3px;font-size:20px;line-height:1}
.df-node{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:2px 8px;border:1px solid var(--cmd-line-hot);background:transparent;color:var(--cmd-dim);font-family:inherit;font-size:10.5px;cursor:pointer;max-width:360px;transition:all .15s}
.df-node:hover{border-color:var(--cmd-amber);color:var(--cmd-amber)}
.df-node .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.df-insp{display:flex;flex-direction:column;gap:10px}
.df-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.df-box{border:1px solid var(--cmd-line);background:var(--cmd-bg);padding:8px;max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:6px}
.df-box h4{font-size:10px;letter-spacing:.14em;color:var(--cmd-faint);margin:0 0 2px}
.df-ev{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--cmd-line);font-size:12px;line-height:1.45;color:var(--cmd-dim)}
.df-ev:first-of-type{border-top:0}
.df-ev .c{flex:1;color:var(--cmd-ink)}
.df-q{font-family:var(--font-cmd-display);font-size:19px;letter-spacing:.03em;color:var(--cmd-ink);line-height:1.25}
.df-side{border:1px solid var(--cmd-amber);padding:8px;color:var(--cmd-dim);font-size:12px;line-height:1.5}
.df-side b{display:block;color:var(--cmd-amber);font-size:10px;letter-spacing:.14em;margin-bottom:4px}
.df-imp{height:3px;background:oklch(0.22 0.012 60);width:60px}
.df-imp i{display:block;height:100%;background:var(--cmd-amber)}
.df-pre{white-space:pre-wrap;word-break:break-word;color:var(--cmd-ink);font-size:13px;line-height:1.55}
.df-kv{display:grid;grid-template-columns:max-content 1fr;gap:3px 12px;font-size:11.5px;line-height:1.5}
.df-kv .k{color:var(--cmd-faint);letter-spacing:.06em}
.df-kv .v{color:var(--cmd-ink);word-break:break-word}
`

function Medium({ m, tag }: { m?: string; tag?: string }) {
  if (m === 'youtube') return <span className="df-med yt">YT</span>
  if (m === 'web') return <span className="df-med web">WEB</span>
  if (m === 'x') return <span className="df-med x">𝕏</span>
  return <span className="df-med tag">{tag || '·'}</span>
}
function Chips({ chips }: { chips?: Chip[] }) {
  if (!chips?.length) return null
  return <>{chips.map((c, i) => <span key={i} className={`chip ${c.tone || ''}`}>{c.label}</span>)}</>
}
const tagOf = (key: string, s: Sample) => key === 'pull' ? `#${s.meta?.index ?? '?'}` : key === 'rank' ? `#${s.meta?.rank ?? '?'}` : key === 'dossiers' ? 'DOSSIER' : key === 'briefings' ? 'BRIEF' : key === 'stances' ? (s.meta?.human ? 'HUMAN' : 'VOICE') : key === 'shows' ? 'SHOW' : s.id

function SampleRow({ s, stageKey, state, onPick }: { s: Sample; stageKey: string; state: 'sel' | 'lit' | 'dim' | ''; onPick: (id: string) => void }) {
  return (
    <div className={`df-row ${state}`}>
      <button className="df-pick" onClick={() => onPick(s.id)} title={`${s.text}\n(click: light up its lineage + open the inspector)`}>
        <Medium m={s.medium} tag={tagOf(stageKey, s)} />
        <span className="df-txt">{s.text}</span>
        {s.n != null && <span className="df-n" title={s.nLabel || ''}>{s.n}</span>}
      </button>
      <div className="df-line">
        <Chips chips={s.chips} />
        {s.sub && <span className="s" title={s.sub}>{s.sub}</span>}
        {s.url && <a className="df-link ml-auto" href={s.url} target="_blank" rel="noreferrer" title={s.url}>↗</a>}
      </div>
    </div>
  )
}

function StageCard({ stage, idx, selected, lit, onPick, hot }: { stage: Stage; idx: number; selected: string | null; lit: Set<string> | null; onPick: (id: string) => void; hot: boolean }) {
  const [open, setOpen] = useState(true)
  const [more, setMore] = useState(false)
  const total = stage.sample.length + stage.rest.length
  const rowState = (id: string): 'sel' | 'lit' | 'dim' | '' => selected === id ? 'sel' : lit ? (lit.has(id) ? 'lit' : 'dim') : ''
  const at = stage.at ? ago(stage.at) : null
  return (
    <section className={`df-card cmd-panel${stage.empty ? ' df-empty' : ''}${hot ? ' df-hot' : ''}`}>
      <header className="df-head">
        <span className="df-idx">0{idx + 1}</span>
        <span className="cmd-display df-name">{stage.name}</span>
        <span className="ml-auto flex gap-1 items-center">
          {stage.ms != null && <span className="chip warn" title={`elapsed at this hop · from the ${stage.ms_source === 'log' ? 'activity log' : 'artifact itself'}${stage.timing ? `\nlast log event: ${stage.timing.kind}/${stage.timing.stage || ''} ${stage.timing.ms != null ? fmtMs(stage.timing.ms) : ''} · ${stage.timing.summary}` : ''}`}>⏱ {fmtMs(stage.ms)}</span>}
          {stage.ms == null && stage.timing?.ms != null && <span className="chip" title={`last ${stage.timing.kind} in the log · ${stage.timing.summary}`}>⏱ {fmtMs(stage.timing.ms)}</span>}
          {at && <span className={`chip ${at.cls}`} title={stage.at || ''}>{at.text}</span>}
        </span>
      </header>
      <div className="df-what cmd-kbd">{stage.what}</div>
      <div className="df-big">
        <span className="cmd-num" style={{ color: stage.count ? 'var(--cmd-ink)' : 'var(--cmd-faint)' }}>{stage.count}</span>
        <span className="cmd-kbd">{UNIT[stage.key] || stage.key}</span>
      </div>
      {stage.empty && <div className="df-reason">{stage.empty}</div>}
      {stage.subcounts.length > 0 && (
        <div className="df-subs">
          {stage.subcounts.map((sc, i) => <div key={i} className="df-sub"><span className="k">{sc.label}</span><span className={`v ${sc.tone || ''}`}>{sc.value}</span></div>)}
        </div>
      )}
      {stage.file && <div className="df-file" title={stage.file}>{base(stage.file) || stage.file}</div>}
      {total > 0 && (
        <>
          <button className={`df-act${open ? ' on' : ''}`} onClick={() => setOpen(v => !v)}>{open ? '▾' : '▸'} WHAT CAME BACK · {total}</button>
          {open && (
            <div className="df-list">
              {stage.sample.map(s => <SampleRow key={s.id} s={s} stageKey={stage.key} state={rowState(s.id)} onPick={onPick} />)}
              {more && stage.rest.map(s => <SampleRow key={s.id} s={s} stageKey={stage.key} state={rowState(s.id)} onPick={onPick} />)}
              {stage.rest.length > 0 && <button className="df-act" onClick={() => setMore(v => !v)}>{more ? 'TOP ONLY' : `+ ${stage.rest.length} MORE`}</button>}
            </div>
          )}
        </>
      )}
    </section>
  )
}

type Node = { s: Sample; stage: Stage }

function NodeChips({ ids, byId, onPick, label }: { ids: string[]; byId: Map<string, Node>; onPick: (id: string) => void; label: string }) {
  const nodes = ids.map(id => byId.get(id)).filter(Boolean) as Node[]
  return (
    <div className="df-line">
      <span className="cmd-kbd" style={{ letterSpacing: '0.12em', color: 'var(--cmd-faint)' }}>{label}</span>
      {nodes.length === 0 && <span className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>none yet</span>}
      {nodes.map(n => (
        <button key={n.s.id} className="df-node" onClick={() => onPick(n.s.id)} title={n.s.text}>
          <Medium m={n.s.medium} tag={tagOf(n.stage.key, n.s)} />
          <span className="t">{n.stage.name.toLowerCase()} · {clip(n.s.text, 44)}</span>
        </button>
      ))}
    </div>
  )
}

function KV({ rows }: { rows: [string, any][] }) {
  return <div className="df-kv">{rows.filter(r => r[1] !== null && r[1] !== undefined && r[1] !== '').map(([k, v], i) => <Fragment key={i}><span className="k">{k}</span><span className="v">{String(v)}</span></Fragment>)}</div>
}

function Inspector({ node, byId, fwd, back, onPick, onClose }: { node: Node; byId: Map<string, Node>; fwd: Map<string, string[]>; back: Map<string, string[]>; onPick: (id: string) => void; onClose: () => void }) {
  const { s, stage } = node
  const m = s.meta || {}
  const up = back.get(s.id) || [], down = fwd.get(s.id) || []
  const body = (() => {
    switch (stage.key) {
      case 'pull': return (
        <>
          <div className="df-pre">{s.text}</div>
          <KV rows={[['source', m.source], ['posted', m.when], ['likes', m.likes], ['reposts', m.rts], ['feed index', m.index]]} />
          {s.url && <a className="cmd-btn ghost" href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>↗ OPEN ON {s.medium === 'youtube' ? 'YOUTUBE' : 'X'}</a>}
        </>)
      case 'cluster': {
        const f = m.fingerprint || {}
        return (
          <>
            {(f.subject || f.claim) && <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cmd-dim)' }}><b style={{ color: 'var(--cmd-cyan)' }}>{f.subject} </b>{[f.action, f.object].filter(Boolean).join(' ')}{f.claim ? ` · ${f.claim}` : ''}</div>}
            {m.why_moving && <div className="cmd-kbd">{m.why_moving}</div>}
            <div className="df-line">{(m.shared_signals || []).map((x: string, i: number) => <span key={i} className="chip">{x}</span>)}{(f.named_entities || []).slice(0, 8).map((x: string, i: number) => <span key={'e' + i} className="chip info">{x}</span>)}</div>
            {m.original_title && <div className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>renamed by the producer · AI title was: {m.original_title}</div>}
            {(m.merged_titles || []).length > 0 && <div className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>⇢ absorbed: {m.merged_titles.join(' · ')}</div>}
            {m.split_from && <div className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>✂ split out of {m.split_from}</div>}
            <div className="df-box">
              <h4>THE ITEMS IN THIS CLUSTER · {(m.items || []).length}</h4>
              {(m.items || []).map((it: any, i: number) => {
                const feed = byId.get('feed:' + it.index)
                return (
                  <div key={i} className="df-ev">
                    <button className="df-node" onClick={() => feed && onPick(feed.s.id)} disabled={!feed} title={feed ? 'open this feed item' : 'not in this pull'}><Medium m={feed?.s.medium} tag={'#' + it.index} /></button>
                    <span className="c">{it.text}</span>
                    {feed?.s.url && <a className="df-link" href={feed.s.url} target="_blank" rel="noreferrer">↗</a>}
                  </div>
                )
              })}
            </div>
          </>)
      }
      case 'leads': return (
        <>
          <KV rows={[['type', m.type], ['destination', m.destination], ['score', `${m.score} · ${String(m.band || '').toUpperCase()}`], ['archive window', m.window], ['why', m.why]]} />
          <div className="df-box" style={{ maxHeight: 90 }}><h4>THE SEARCH IT WOULD RUN</h4><div className="df-pre" style={{ color: 'var(--cmd-amber)' }}>{m.query}</div></div>
          <div className="cmd-kbd">{down.length ? 'this lead was expanded into the dossier(s) below' : 'not expanded yet: EXPAND → on DISCOVERY turns it into a cited dossier'}</div>
        </>)
      case 'rank': return (
        <>
          <div className="df-big"><span className="cmd-num" style={{ fontSize: 34 }}>{m.show_value}</span><span className="cmd-kbd">show value · #{m.rank}{m.best_format ? ` · ${String(m.best_format).toUpperCase()}` : ''}{m.debatable ? ' · DEBATABLE' : ''}{m.pinned ? ' · PINNED' : ''}</span></div>
          {m.rationale && <div style={{ color: 'var(--cmd-dim)', fontSize: 13, lineHeight: 1.5 }}>{m.rationale}</div>}
          {m.best_angle && <div className="cmd-kbd">angle: {m.best_angle}</div>}
          {(m.sides || []).length > 0 && <div className="df-cols">{m.sides.map((x: string, i: number) => <div key={i} className="df-side"><b>SIDE {String.fromCharCode(65 + i)}</b>{x}</div>)}</div>}
        </>)
      case 'dossiers': {
        const srcs: any[] = m.sources || []
        const col = (med: string, label: string) => {
          const list = srcs.filter(x => x.medium === med)
          return (
            <div className="df-box" key={med}>
              <h4>{label} · {list.length}</h4>
              {list.length === 0 && <span className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>none</span>}
              {list.map((x, i) => (
                <div key={i} className="df-ev">
                  <span className="df-med tag">{x.id}</span>
                  <span className="c"><span style={{ color: 'var(--cmd-cyan)' }}>{x.publisher}</span> · {x.title}<div className="cmd-kbd">{x.transcript_status}{x.words ? ` · ${x.words} words` : ''}{x.published_at ? ` · ${x.published_at}` : ''}</div></span>
                  {x.url && <a className="df-link" href={x.url} target="_blank" rel="noreferrer">↗</a>}
                </div>
              ))}
            </div>
          )
        }
        const ex = m.expanded_from
        return (
          <>
            <KV rows={[['assignment', `${m.mode}${m.dual ? ' · dual (freshness + relevance)' : ''} · ${m.status || ''}`], ['question', (m.questions || [])[0]], ['transcripts', `${m.transcripts} ok · ${m.transcript_words} words`], ['publishers', m.distinct_publishers], ['audit', `${String(m.audit?.status || '').toUpperCase().replace('_', ' ')}${m.audit?.needs_web ? ' · needs web' : ''}${m.audit?.uncited ? ` · ${m.audit.uncited} uncited` : ''}`], ['from lead', ex ? `${ex.lead_id || '?'} · ${ex.lead_value || ''} → ${ex.destination || ''} (${ex.mode || ''})` : null], ['evidence', Object.entries(m.evidence_by_label || {}).map(([k, v]) => `${v} ${k}`).join(' · ') + ` · ${m.valid_evidence} cited to a shown source`]]} />
            <div className="df-cols">{col('youtube', 'YOUTUBE')}{col('web', 'WEB')}{col('x', 'X POSTS')}</div>
            <div className="df-box">
              <h4>TOP EVIDENCE · {(m.evidence || []).length} of {s.n}</h4>
              {(m.evidence || []).map((e: any, i: number) => (
                <div key={i} className="df-ev">
                  <span className={`chip ${e.tone}`} title={e.valid_source ? 'cited to a source the parser was shown' : 'UNCITED: no shown source backs this'}>{e.valid_source ? String(e.truth_label).replace('_', ' ') : 'UNCITED'}</span>
                  <span className="c">{e.claim}<div className="cmd-kbd">{e.id} · {e.source_name || e.source_id || 'no source'}{e.quote ? ` · “${e.quote}”` : ''}</div></span>
                  {e.url && <a className="df-link" href={e.url} target="_blank" rel="noreferrer">↗</a>}
                </div>
              ))}
            </div>
          </>)
      }
      case 'briefings': return (
        <>
          <div className="df-q">{m.question}</div>
          <div className="df-line"><span className={`chip ${m.audit?.status === 'pass' ? 'ok' : 'warn'}`}>AUDIT {String(m.audit?.status || '?').toUpperCase().replace('_', ' ')}</span><span className={`chip ${m.audit?.question_is_non_leading ? 'ok' : 'err'}`}>{m.audit?.question_is_non_leading ? 'NON-LEADING' : 'LEADING QUESTION'}</span><span className={`chip ${m.audit?.all_factual_moves_cited ? 'ok' : 'err'}`}>{m.audit?.all_factual_moves_cited ? 'ALL MOVES CITED' : 'UNCITED MOVES'}</span><span className="cmd-kbd">{m.evidence_cited} evidence ids cited · {m.elapsed_ms ? fmtMs(m.elapsed_ms) : ''}</span></div>
          <div className="df-box" style={{ maxHeight: 420 }}>
            <h4>THE MOVES · {(m.moves || []).length}</h4>
            {(m.moves || []).map((mv: any, i: number) => (
              <div key={i} className="df-ev">
                <span className="df-med tag">{mv.id}</span>
                <span className="c">
                  <div className="df-line"><span className={`chip ${mv.tone}`}>{String(mv.kind || '').toUpperCase()}</span><span className="chip">{String(mv.truth_label || '').replace('_', ' ')}</span>{mv.uncited && <span className="chip err">UNCITED</span>}<span className="df-imp" title={`importance ${mv.importance}/5`}><i style={{ width: `${Math.max(0, Math.min(5, mv.importance)) * 20}%` }} /></span></div>
                  <div style={{ color: 'var(--cmd-ink)', fontSize: 13, marginTop: 3 }}>{mv.headline}</div>
                  <div className="cmd-kbd">{mv.body}</div>
                  {(mv.evidence_ids || []).length > 0 && <div className="cmd-kbd" style={{ color: 'var(--cmd-cyan)' }}>{mv.evidence_ids.join(' · ')}</div>}
                </span>
              </div>
            ))}
          </div>
        </>)
      case 'stances': return (
        <>
          <div className="df-q">{m.answer || '(no answer)'}</div>
          {m.thesis && m.thesis !== m.answer && <div style={{ color: 'var(--cmd-dim)', fontSize: 13, lineHeight: 1.5 }}>{m.thesis}</div>}
          <KV rows={[['DNA', `${m.dna_attribute || ''}${m.dna_id ? ` · ${m.dna_id}` : ''}`], ['budget', m.budget], ['took', m.ms ? fmtMs(m.ms) : null], ['moves read', (m.moves_included || []).join(' ')], ['evidence allowed', m.allowed_evidence], ['error', m.error]]} />
          <div className="df-box">
            <h4>REASONS · {(m.reasons || []).length}</h4>
            {(m.reasons || []).map((r: any, i: number) => <div key={i} className="df-ev"><span className="df-med tag">{i + 1}</span><span className="c">{r.asked && <div className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>Q: {r.asked}</div>}{r.text}{(r.evidence_ids || []).length > 0 && <div className="cmd-kbd" style={{ color: 'var(--cmd-cyan)' }}>{r.evidence_ids.join(' · ')}</div>}</span></div>)}
          </div>
          {(m.concession || m.uncertainty) && <div className="df-cols">{m.concession && <div className="df-side"><b>CONCEDES</b>{m.concession}</div>}{m.uncertainty && <div className="df-side"><b>UNCERTAIN</b>{m.uncertainty}</div>}</div>}
        </>)
      case 'shows': return (
        <>
          <div className="df-q">{m.question || s.text}</div>
          <div className="df-line"><Chips chips={s.chips} />{m.lines ? <span className="cmd-kbd">{m.lines} lines</span> : null}{m.pct != null && m.stage !== 'done' ? <span className="cmd-kbd">{m.pct}%</span> : null}{m.elapsed_s ? <span className="cmd-kbd">built in {mmss(m.elapsed_s)}</span> : null}</div>
          {m.audio_url && <>{/* eslint-disable-next-line jsx-a11y/media-has-caption */}<audio controls src={m.audio_url} style={{ width: '100%', maxWidth: 720 }} /></>}
          <div className="df-line">
            {m.download_url && <a className="cmd-btn ghost" href={m.download_url} style={{ textDecoration: 'none' }}>⬇ MP3</a>}
            {m.segment_url && <a className="cmd-btn ghost" href={m.segment_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>READ THE SCRIPT</a>}
          </div>
          <KV rows={[['started', m.started ? `${m.started} (${ago(m.started).text})` : null], ['updated', m.updated ? `${m.updated} (${ago(m.updated).text})` : null], ['briefing', m.briefing], ['dossier', m.stringer], ['engine', m.voice_engine], ['message', m.message], ['failed at', m.failed_stage]]} />
          {m.error && <div className="df-reason" style={{ borderColor: 'var(--cmd-red)', color: 'var(--cmd-red)', whiteSpace: 'pre-wrap' }}>{m.error}</div>}
        </>)
      default: return null
    }
  })()
  return (
    <section className="cmd-panel-hot p-4 df-insp">
      <div className="df-head" style={{ flexWrap: 'wrap' }}>
        <span className="df-idx">INSPECTOR</span>
        <Medium m={s.medium} tag={tagOf(stage.key, s)} />
        <span className="cmd-display" style={{ fontSize: 15, color: 'var(--cmd-ink)' }}>{clip(s.text, 120)}</span>
        <Chips chips={s.chips} />
        <span className="cmd-kbd">{stage.name.toLowerCase()}{s.n != null ? ` · ${s.n} ${s.nLabel || ''}` : ''}{m.created_at ? ` · ${ago(m.created_at).text}` : ''}</span>
        <button className="df-act ml-auto" onClick={onClose}>✕ CLOSE</button>
      </div>
      {body}
      <div style={{ borderTop: '1px solid var(--cmd-line)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <NodeChips ids={up} byId={byId} onPick={onPick} label="CAME FROM" />
        <NodeChips ids={down} byId={byId} onPick={onPick} label="BECAME" />
      </div>
    </section>
  )
}

function closure(start: string, next: Map<string, string[]>): Set<string> {
  const seen = new Set<string>([start])
  const q = [start]
  while (q.length) { const id = q.pop() as string; for (const n of next.get(id) || []) if (!seen.has(n)) { seen.add(n); q.push(n) } }
  return seen
}

export default function Dataflow() {
  const { state } = useCmdState()
  const { beat, beats, pick } = useBeat(state)
  const [pull, setPull] = useState('')
  const [story, setStory] = useState('')
  const [journey, setJourney] = useState<Journey | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const beatId: string = beat?.id ? String(beat.id) : ''

  useEffect(() => { setPull(''); setStory(''); setSelected(null) }, [beatId])

  useEffect(() => {
    if (state === null) return   // beats not known yet
    let dead = false
    setLoading(true)
    const qs = new URLSearchParams()
    if (beatId) qs.set('beat', beatId)
    if (pull) qs.set('pull', pull)
    if (story) qs.set('story', story)
    fetch('/api/command/dataflow?' + qs.toString(), { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (dead) return; if (j?.ok) { setJourney(j.journey); setErr(j.journey?.error || null) } else setErr(j?.error || 'dataflow failed') })
      .catch(e => { if (!dead) setErr('network: ' + String(e?.message || e)) })
      .finally(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
  }, [state, beatId, pull, story, tick])

  const stages: Stage[] = journey?.stages || []
  const { byId, fwd, back } = useMemo(() => {
    const byId = new Map<string, Node>(), fwd = new Map<string, string[]>(), back = new Map<string, string[]>()
    for (const st of stages) for (const s of [...st.sample, ...st.rest]) byId.set(s.id, { s, stage: st })
    for (const e of journey?.edges || []) { fwd.set(e.from, [...(fwd.get(e.from) || []), e.to]); back.set(e.to, [...(back.get(e.to) || []), e.from]) }
    return { byId, fwd, back }
  }, [journey, stages])
  const lit = useMemo(() => selected ? new Set<string>(Array.from(closure(selected, fwd)).concat(Array.from(closure(selected, back)))) : null, [selected, fwd, back])
  const node = selected ? byId.get(selected) || null : null
  const titles: string[] = (stages.find(s => s.key === 'rank')?.detail?.titles as string[]) || []
  const hotKeys = new Set<StageKey>(); if (lit) lit.forEach(id => { const n = byId.get(id); if (n) hotKeys.add(n.stage.key) })
  const pickNode = (id: string) => { setSelected(id); try { document.getElementById('df-inspector')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } catch { /* no-op */ } }

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: 1440 }}>
      {/* injected as HTML, not a text node: React escapes the quotes in `content:''` on the server while the
          browser keeps <style> raw, so a text child hydrates with "Text content does not match" on every cold load */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.12em' }}>HOW THE DATA TRAVELS</span>
        <span className="cmd-kbd">DATAFLOW · pull → cluster → leads → rank → dossiers → briefings → stances → shows · real counts and real samples at every hop · click anything to light up its lineage</span>
      </div>

      {/* controls */}
      <section className="cmd-panel p-3 flex gap-3 flex-wrap items-end">
        <label style={{ minWidth: 220 }}>
          <span className="cmd-label">BEAT</span>
          {beats.length
            ? <select className="cmd-select" value={beat?.file || ''} onChange={e => pick(e.target.value)}>{beats.map((b: any) => <option key={b.file} value={b.file}>{String(b.show?.name || b.name || b.id).toUpperCase()}</option>)}</select>
            : <span className="cmd-kbd">no beats configured · showing the newest pull{journey?.beats?.length ? ` (beats seen: ${journey.beats.join(', ')})` : ''}</span>}
        </label>
        <label style={{ minWidth: 300 }}>
          <span className="cmd-label">PULL</span>
          <select className="cmd-select" value={pull} onChange={e => { setPull(e.target.value); setSelected(null) }}>
            <option value="">LATEST{journey?.pull ? ` · ${stampOf(journey.pull)}` : ''}</option>
            {(journey?.pulls || []).map(p => <option key={p.file} value={p.file}>{stampOf(p.file)} · {p.items} items{p.pulled_at ? ` · ${ago(p.pulled_at).text}` : ''}</option>)}
          </select>
        </label>
        <label style={{ minWidth: 340, flex: 1 }}>
          <span className="cmd-label" style={{ color: 'var(--cmd-red)' }}>TRACE ONE STORY</span>
          <select className="cmd-select" value={story} onChange={e => { setStory(e.target.value); setSelected(null) }} disabled={!titles.length} title={titles.length ? 'narrow the whole strip to one ranked story\'s lineage' : 'rank the pull first (③ RANK FOR SHOW on DISCOVERY)'}>
            <option value="">WHOLE PULL{titles.length ? '' : ' · nothing ranked yet'}</option>
            {titles.map((t, i) => <option key={i} value={t}>#{i + 1} · {t}</option>)}
          </select>
        </label>
        <div className="flex gap-2 items-center" style={{ minHeight: 36 }}>
          {story && <button className="df-act on" style={{ minHeight: 36 }} onClick={() => { setStory(''); setSelected(null) }}>✕ CLEAR TRACE</button>}
          {selected && <button className="df-act" style={{ minHeight: 36 }} onClick={() => setSelected(null)}>UNLIGHT</button>}
          <button className="df-act" style={{ minHeight: 36 }} disabled={loading} onClick={() => setTick(t => t + 1)}>{loading ? 'READING…' : '↻ REFRESH'}</button>
        </div>
        <div className="flex gap-2 items-center flex-wrap" style={{ width: '100%' }}>
          {journey?.beat && <span className="chip">{journey.beat.toUpperCase()}</span>}
          {journey?.pull && <span className="chip info" title={journey.pull}>{stampOf(journey.pull)}</span>}
          {journey?.story && <span className="chip err" title="the strip is narrowed to this story's lineage">TRACING · {clip(journey.story, 70)}</span>}
          {journey?.story_error && <span className="chip warn" title={journey.story_error}>{clip(journey.story_error, 90)}</span>}
          {journey?.built_at && <span className="cmd-kbd">built {ago(journey.built_at).text} · {journey.edges.length} links across {stages.length} hops</span>}
          {err && <span className="chip err" title={err}>{clip(err, 90)}</span>}
        </div>
      </section>

      {/* the strip */}
      {loading && !journey && <section className="cmd-panel p-4"><span role="status" className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>READING THE RUN…</span></section>}
      {journey && !journey.pull && (
        <section className="cmd-panel p-4"><div className="cmd-kbd">no pull on disk{journey.beat ? ` for ${journey.beat.toUpperCase()}` : ''}. run PULL on the DESK, then ① CLUSTER · ② MINE LEADS · ③ RANK on DISCOVERY, and the journey draws itself here.</div></section>
      )}
      {journey && journey.pull && (
        <div className="df-strip" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          {stages.map((st, i) => (
            <Fragment key={st.key}>
              {i > 0 && <div className="df-arrow" aria-hidden><span>→</span></div>}
              <StageCard stage={st} idx={i} selected={selected} lit={lit} onPick={pickNode} hot={hotKeys.has(st.key)} />
            </Fragment>
          ))}
        </div>
      )}

      {/* the inspector */}
      <div id="df-inspector">
        {node
          ? <Inspector node={node} byId={byId} fwd={fwd} back={back} onPick={pickNode} onClose={() => setSelected(null)} />
          : journey?.pull ? <section className="cmd-panel p-3"><span className="cmd-kbd">click any item in a card: a feed post, a cluster, a lead, a ranked story, a dossier, a briefing, a voice, a show. Its lineage lights up in amber across the strip and the detail opens here.</span></section> : null}
      </div>

      {/* the clock */}
      {journey && journey.timings.length > 0 && (
        <section className="cmd-panel">
          <div className="cmd-h"><div className="vu"><i /><i /><i /><i /></div><h2>THE CLOCK · what each action took</h2><span className="cmd-kbd ml-auto">newest first · from lab/logs/activity.jsonl</span></div>
          <div style={{ overflow: 'auto', maxHeight: 320 }}>
            <table className="cmd-table">
              <thead><tr><th>WHEN</th><th>KIND</th><th>STAGE</th><th>OK</th><th>TOOK</th><th>REF</th><th>SUMMARY</th></tr></thead>
              <tbody>
                {journey.timings.map((t, i) => (
                  <tr key={i}>
                    <td className="cmd-kbd" style={{ whiteSpace: 'nowrap' }}>{ago(t.ts).text}</td>
                    <td><span className="chip info">{t.kind.toUpperCase()}</span></td>
                    <td className="cmd-kbd">{t.stage || ''}</td>
                    <td><span className={`lamp ${t.ok ? 'on' : 'err'}`}><i /></span></td>
                    <td className="cmd-kbd" style={{ color: 'var(--cmd-amber)', whiteSpace: 'nowrap' }}>{t.ms != null ? fmtMs(t.ms) : ''}</td>
                    <td className="cmd-kbd" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.ref || ''}>{t.ref || ''}</td>
                    <td style={{ color: t.ok ? 'var(--cmd-ink)' : 'var(--cmd-red)' }}>{t.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
