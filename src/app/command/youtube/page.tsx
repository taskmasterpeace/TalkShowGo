'use client'
import { useEffect, useState } from 'react'
import { useCmdState, useBeat, ago } from '../lib'

// YOUTUBE — Robert, 2026-09-02: "That YouTube thing, that is the most important thing... We need to
// have that displayed. Can you get the transcript? The timestamp? Because certain shows might even be
// playing snippets." The 3-rung pull (RSS -> Innertube -> yt-dlp, with dead-id repair) already finds the
// videos; this page is where a producer SEES that health at a glance, reads a real timestamped
// transcript, clicks a line to jump the embedded player there, and cuts a bounded (<=30s) audio snippet.
// Thin client on purpose: /api/command/youtube does the file reading, this just renders it.

type Segment = { start_s: number; end_s: number; text: string }
type TrData = { segments: Segment[]; words: number; duration_s: number; format: string }
type TrState = { loading: boolean; error: string | null; notFound: boolean; data: TrData | null }
type Video = { video_id: string; title: string; url: string | null; published: string | null; age_hours: number | null; ago: string | null; views: string | null; approx: boolean; thumbnail: string | null }
type ChannelView = {
  channel_name: string | null; channel_id: string | null; type: string | null; priority: number | null
  resolved_title: string | null; subscribers: string | null; status: string | null; pulled: boolean
  rung: 'rss' | 'innertube' | 'ytdlp' | 'repaired' | 'error' | null; repaired_from: string | null
  in_window: number | null; error: string | null; videos: Video[]
}
type YoutubeView = {
  beat: string | null; beat_name: string | null; beats: string[]; pull_file: string | null; pulled_at: string | null; timespan_hours: number | null
  channels: ChannelView[]
  health: { channels_total: number; channels_answered: number; rung_mix: Record<string, number>; last_pull_at: string | null }
}

const RUNG_TONE: Record<string, string> = { rss: 'ok', innertube: 'info', ytdlp: 'warn', repaired: 'warn', error: 'err' }
const RUNG_LABEL: Record<string, string> = { rss: 'RSS', innertube: 'INNERTUBE', ytdlp: 'YTDLP', repaired: 'REPAIRED', error: 'ERROR' }
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const CSS = `
.yt-page{max-width:1440px}
.yt-health{display:flex;gap:18px;flex-wrap:wrap;align-items:center}
.yt-rungs{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.yt-channels{display:flex;flex-direction:column;gap:14px}
.yt-chanhead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--cmd-line)}
.yt-vidrow{border-top:1px solid var(--cmd-line);padding:10px 14px;display:flex;gap:12px;flex-wrap:wrap}
.yt-channels .yt-vidrow:first-of-type{border-top:none}
.yt-thumb{width:120px;height:68px;object-fit:cover;background:var(--cmd-bg);border:1px solid var(--cmd-line-hot);flex:0 0 auto}
.yt-thumb.ph{display:flex;align-items:center;justify-content:center;color:var(--cmd-faint);font-size:10px;letter-spacing:.08em}
.yt-vidmeta{flex:1;min-width:220px;display:flex;flex-direction:column;gap:4px}
.yt-vidtitle{color:var(--cmd-ink);font-size:12.5px;line-height:1.4;text-decoration:none;display:block}
.yt-vidtitle:hover{color:var(--cmd-amber)}
.yt-vidrow-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:0 0 auto}
.yt-drawer{flex:1 1 100%;width:100%;margin-top:10px;padding-top:10px;border-top:1px dashed var(--cmd-line-hot);display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:14px}
@media (max-width: 760px){.yt-drawer{grid-template-columns:1fr}}
.yt-frame-wrap{position:relative;width:100%;padding-top:56.25%;background:#000;border:1px solid var(--cmd-line-hot)}
.yt-frame-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.yt-seglist{display:flex;flex-direction:column;max-height:300px;overflow:auto;border:1px solid var(--cmd-line);background:var(--cmd-bg)}
.yt-seg{display:flex;gap:10px;padding:5px 8px;text-align:left;background:transparent;border:0;border-bottom:1px solid oklch(0.24 0.014 60);color:var(--cmd-dim);font-family:inherit;font-size:11.5px;cursor:pointer;width:100%;line-height:1.4}
.yt-seg:hover{background:oklch(1 0 0/0.035);color:var(--cmd-ink)}
.yt-seg.active{border-left:2px solid var(--cmd-red);color:var(--cmd-ink);background:oklch(1 0 0/0.045)}
.yt-seg .t{flex:0 0 auto;font-family:var(--font-cmd-display);color:var(--cmd-amber);font-size:10.5px;min-width:40px;padding-top:1px}
.yt-clipbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px;border:1px solid var(--cmd-line);background:var(--cmd-bg)}
.yt-clipbar input.cmd-input{width:64px;padding:6px 8px;text-align:center}
.yt-empty{padding:44px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
.yt-empty .ic{width:48px;height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;border:1px solid var(--cmd-line-hot);color:var(--cmd-faint);font-size:20px}
`

function RungBadge({ rung, repairedFrom }: { rung: ChannelView['rung']; repairedFrom?: string | null }) {
  if (!rung) return <span className="chip" title="not seen in the last pull for this beat">·</span>
  return <span className={`chip ${RUNG_TONE[rung] || ''}`} title={rung === 'repaired' && repairedFrom ? `dead channel id ${repairedFrom} was re-resolved this pull` : undefined}>{RUNG_LABEL[rung] || rung.toUpperCase()}</span>
}

function CaptionsBadge({ tr }: { tr: TrState }) {
  if (tr.loading) return <span className="chip warn">CHECKING…</span>
  if (tr.data) return <span className="chip ok" title={`${tr.data.segments.length} timestamped lines`}>{tr.data.format.toUpperCase()} · {mmss(tr.data.duration_s)}</span>
  if (tr.notFound) return <span className="chip err">NO CAPTIONS</span>
  if (tr.error) return <span className="chip err" title={tr.error}>CAPTIONS ERROR</span>
  return <span className="chip" title="click TRANSCRIPT to check">CC ?</span>
}

function VideoRow({ v }: { v: Video }) {
  const [open, setOpen] = useState(false)
  const [tr, setTr] = useState<TrState>({ loading: false, error: null, notFound: false, data: null })
  const [play, setPlay] = useState<{ start: number; n: number } | null>(null)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [clipStart, setClipStart] = useState(0)
  const [clipLen, setClipLen] = useState(15)
  const [clipBusy, setClipBusy] = useState(false)
  const [clipErr, setClipErr] = useState<string | null>(null)
  const [clipUrl, setClipUrl] = useState<string | null>(null)
  const [clipCached, setClipCached] = useState(false)

  const fetchTranscript = async () => {
    if (tr.loading || tr.data) return
    setTr({ loading: true, error: null, notFound: false, data: null })
    try {
      const r = await fetch(`/api/command/transcript?video_id=${encodeURIComponent(v.video_id)}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({} as any))
      if (r.status === 404) { setTr({ loading: false, error: null, notFound: true, data: null }); return }
      if (!r.ok || !j.ok) { setTr({ loading: false, error: j.error || `http ${r.status}`, notFound: false, data: null }); return }
      setTr({ loading: false, error: null, notFound: false, data: { segments: j.segments || [], words: j.words || 0, duration_s: j.duration_s || 0, format: j.format || '?' } })
    } catch (e: any) { setTr({ loading: false, error: String(e?.message || e), notFound: false, data: null }) }
  }

  const toggle = () => { const next = !open; setOpen(next); if (next) fetchTranscript() }

  const pickLine = (s: Segment, i: number) => {
    setPlay(p => ({ start: Math.floor(s.start_s), n: (p?.n || 0) + 1 }))
    setActiveIdx(i)
    setClipStart(Math.floor(s.start_s))
    setClipErr(null); setClipUrl(null)
  }

  const makeClip = async () => {
    const start = Math.max(0, Math.round(clipStart) || 0)
    const len = Math.max(1, Math.min(30, Math.round(clipLen) || 15))
    setClipBusy(true); setClipErr(null); setClipUrl(null); setClipCached(false)
    try {
      const r = await fetch('/api/command/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_id: v.video_id, start_s: start, end_s: start + len }) })
      const j = await r.json().catch(() => ({} as any))
      if (!r.ok || !j.ok) throw new Error(j.error || `http ${r.status}`)
      setClipUrl(j.url); setClipCached(!!j.cached)
    } catch (e: any) { setClipErr(String(e?.message || e)) }
    finally { setClipBusy(false) }
  }

  return (
    <div className="yt-vidrow">
      {v.thumbnail
        ? <img className="yt-thumb" src={v.thumbnail} alt="" loading="lazy" />
        : <div className="yt-thumb ph">NO THUMB</div>}
      <div className="yt-vidmeta">
        <a className="yt-vidtitle" href={v.url || undefined} target="_blank" rel="noreferrer" title={v.title}>{clip(v.title, 110)}</a>
        <div className="flex gap-2 items-center flex-wrap">
          {v.ago && <span className="chip" title={v.published || undefined}>{v.ago.toUpperCase()}{v.approx ? ' (approx)' : ''}</span>}
          {v.views && <span className="cmd-kbd">{v.views}</span>}
          <CaptionsBadge tr={tr} />
        </div>
      </div>
      <div className="yt-vidrow-actions">
        <button className="cmd-btn ghost" onClick={toggle}>{open ? '▾' : '▸'} TRANSCRIPT</button>
      </div>

      {open && (
        <div className="yt-drawer">
          <div className="yt-frame-wrap">
            {play
              ? <iframe key={`${v.video_id}-${play.n}`} src={`https://www.youtube.com/embed/${v.video_id}?start=${play.start}&autoplay=1`} title={v.title} allow="autoplay; encrypted-media" allowFullScreen />
              : <iframe src={`https://www.youtube.com/embed/${v.video_id}`} title={v.title} allow="encrypted-media" allowFullScreen />}
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: 0 }}>
            {tr.loading && <div className="p-3 cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>FETCHING TRANSCRIPT (yt-dlp)…</div>}
            {tr.notFound && <div className="p-3 cmd-kbd">NO CAPTIONS AVAILABLE FOR THIS VIDEO — this channel didn&apos;t turn captions on.</div>}
            {tr.error && <div className="p-3"><span className="chip err" title={tr.error}>TRANSCRIPT FAILED: {clip(tr.error, 100)}</span></div>}
            {tr.data && (
              <>
                <div className="cmd-kbd">{tr.data.segments.length} lines · {tr.data.words} words · {mmss(tr.data.duration_s)} · via {tr.data.format} · click a line to jump the player &amp; preload a clip start</div>
                <div className="yt-seglist">
                  {tr.data.segments.map((s, i) => (
                    <button key={i} className={`yt-seg${activeIdx === i ? ' active' : ''}`} onClick={() => pickLine(s, i)} title="jump the player here + set clip start">
                      <span className="t">{mmss(s.start_s)}</span>
                      <span>{s.text}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="yt-clipbar">
              <span className="cmd-kbd">CLIP</span>
              <label className="flex items-center gap-1"><span className="cmd-kbd">START</span><input className="cmd-input" type="number" min={0} value={clipStart} onChange={e => setClipStart(Number(e.target.value))} /><span className="cmd-kbd">s</span></label>
              <label className="flex items-center gap-1"><span className="cmd-kbd">LEN</span><input className="cmd-input" type="number" min={1} max={30} value={clipLen} onChange={e => setClipLen(Number(e.target.value))} /><span className="cmd-kbd">s (max 30)</span></label>
              <button className="cmd-btn" disabled={clipBusy} onClick={makeClip}>{clipBusy ? 'RENDERING…' : '✂ MAKE CLIP'}</button>
              {clipErr && <span className="chip err" title={clipErr}>{clip(clipErr, 90)}</span>}
              {clipCached && <span className="chip info">CACHED</span>}
              {clipUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls src={clipUrl} style={{ height: 30, flex: '1 1 220px', minWidth: 200 }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelCard({ c }: { c: ChannelView }) {
  return (
    <section className="cmd-panel">
      <div className="yt-chanhead">
        <span className="cmd-display" style={{ fontSize: 14 }}>{(c.resolved_title || c.channel_name || '(unnamed)').toUpperCase()}</span>
        {c.type && <span className="chip">{c.type.toUpperCase()}</span>}
        <RungBadge rung={c.rung} repairedFrom={c.repaired_from} />
        {!c.pulled && <span className="chip" title="added to the beat after the last pull ran">NOT YET PULLED</span>}
        {c.error && <span className="chip err" title={c.error}>{clip(c.error, 80)}</span>}
        {c.in_window != null && <span className="chip ok" title="videos inside the show's window on the last pull">{c.in_window} IN WINDOW</span>}
        {c.subscribers && <span className="cmd-kbd" style={{ color: 'var(--cmd-cyan)' }}>{c.subscribers}</span>}
        {c.channel_id && <a href={`https://www.youtube.com/channel/${c.channel_id}`} target="_blank" rel="noreferrer" className="chip info ml-auto" style={{ textDecoration: 'none' }} title="open the channel">↗</a>}
      </div>
      {c.videos.length === 0 ? (
        <div className="p-4 cmd-kbd">{c.pulled ? 'no videos in the window on the last pull' : 'no data yet for this channel — run PULL on the DESK'}</div>
      ) : (
        <div>{c.videos.map(v => <VideoRow key={v.video_id} v={v} />)}</div>
      )}
    </section>
  )
}

export default function YoutubePage() {
  const { state } = useCmdState()
  const { beat } = useBeat(state)
  const [view, setView] = useState<YoutubeView | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [pulling, setPulling] = useState(false)
  const beatId: string = beat?.id ? String(beat.id) : ''

  useEffect(() => {
    if (state === null) return
    let dead = false
    setLoading(true)
    const qs = beatId ? `?beat=${encodeURIComponent(beatId)}` : ''
    fetch('/api/command/youtube' + qs, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (dead) return; if (j?.ok) { setView(j.view); setErr(null) } else setErr(j?.error || 'failed to load') })
      .catch(e => { if (!dead) setErr('network: ' + String(e?.message || e)) })
      .finally(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
  }, [state, beatId, tick])

  const runPull = async () => {
    if (!beat?.file || pulling) return
    setPulling(true)
    try { await fetch('/api/command/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: beat.file }) }) }
    finally { setPulling(false); setTick(t => t + 1) }
  }

  if (!state) return <div className="p-8 cmd-kbd">LOADING…</div>
  if (!beat) return <div className="p-8 cmd-kbd">NO BEAT LOADED</div>

  const h = view?.health
  const rungEntries = h ? Object.entries(h.rung_mix) : []
  const pulledAgo = view?.pulled_at ? ago(view.pulled_at) : null

  return (
    <div className="p-6 space-y-5 yt-page">
      <style>{CSS}</style>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>YOUTUBE — {(view?.beat_name || beat.name || beat.id || '').toUpperCase()}</span>
        {/* show switching lives in the master bar at the top of every page */}
        <button className="cmd-btn ghost ml-auto" disabled={loading} onClick={() => setTick(t => t + 1)}>{loading ? 'READING…' : '↻ REFRESH'}</button>
      </div>

      {err && <section className="cmd-panel p-4"><span className="chip err" title={err}>{err}</span></section>}

      {/* health header */}
      <section className="cmd-panel p-4">
        {view && h ? (
          <div className="yt-health">
            <div className="flex items-baseline gap-2">
              <span className="cmd-num" style={{ color: h.channels_answered === h.channels_total && h.channels_total > 0 ? 'var(--cmd-green)' : 'var(--cmd-ink)' }}>{h.channels_answered}/{h.channels_total}</span>
              <span className="cmd-kbd">CHANNELS ANSWERED</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`chip ${pulledAgo?.cls || ''}`} style={{ fontSize: 11 }}>{pulledAgo ? pulledAgo.text.toUpperCase() : 'NEVER'}</span>
              <span className="cmd-kbd">LAST PULL{view.timespan_hours ? ` · ${view.timespan_hours}H WINDOW` : ''}</span>
            </div>
            <div className="yt-rungs">
              <span className="cmd-kbd">RUNG MIX</span>
              {rungEntries.length === 0 && <span className="cmd-kbd" style={{ color: 'var(--cmd-faint)' }}>—</span>}
              {rungEntries.map(([k, n]) => <span key={k} className={`chip ${RUNG_TONE[k] || ''}`}>{(RUNG_LABEL[k] || k).toUpperCase()} {n}</span>)}
            </div>
            {view.pull_file && <span className="cmd-kbd ml-auto" title={view.pull_file}>{view.pull_file}</span>}
          </div>
        ) : <span className="cmd-kbd">{loading ? 'READING…' : 'NO DATA'}</span>}
      </section>

      {/* channels */}
      {view && view.channels.length === 0 && (
        <section className="cmd-panel"><div className="yt-empty">
          <div className="ic">▸</div>
          <div className="cmd-kbd">NO YOUTUBE CHANNELS CONFIGURED FOR THIS BEAT — add some on SOURCES.</div>
        </div></section>
      )}
      {view && view.channels.length > 0 && !view.pull_file && (
        <section className="cmd-panel"><div className="yt-empty">
          <div className="ic">▸</div>
          <div className="cmd-kbd">NO PULL YET FOR THIS BEAT — run it here, or on the DESK.</div>
          <button className="cmd-btn primary" disabled={pulling} onClick={runPull}>{pulling ? 'PULLING…' : '▶ RUN PULL NOW'}</button>
        </div></section>
      )}
      {view && view.channels.length > 0 && (
        <div className="yt-channels">
          {view.channels.map(c => <ChannelCard key={c.channel_id || c.channel_name} c={c} />)}
        </div>
      )}
    </div>
  )
}
