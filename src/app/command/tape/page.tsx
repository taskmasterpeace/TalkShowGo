'use client'
import { useState } from 'react'
import { useCmdState, fmtBytes, ago } from '../lib'

const STAGE_CHIP: Record<string, string> = { done: 'ok', error: 'err', cancelled: 'warn' }
const TERMINAL = new Set(['done', 'error', 'cancelled'])

export default function TapePage() {
  const { state, reload } = useCmdState()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  if (!state) return <div className="p-8 cmd-kbd">LOADING TAPE...</div>

  const act = async (key: string, fn: () => Promise<Response>) => {
    setBusy(key); setMsg(null)
    try { const j = await (await fn()).json(); setMsg(j.ok ? (j.show ? `started ${j.show}` : 'ok') : (j.error || 'failed')); reload() }
    catch (e: any) { setMsg(String(e?.message || e)) } finally { setBusy(null) }
  }
  const buildAgain = (s: any) => act('again:' + s.slug, () => fetch('/api/command/showbuild', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ briefing_id: s.briefing, voice: true }) }))
  const cancel = (s: any) => act('cancel:' + s.slug, () => fetch('/api/command/showbuild?show=' + s.slug, { method: 'DELETE' }))
  const shows: any[] = state.shows || []

  // parse manifest rows for provenance chips
  const manifestRows: Record<string, { words: string; voiced: string }> = {}
  for (const line of (state.manifest || '').split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*[^|]*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/)
    if (m && m[1].endsWith('.mp3')) manifestRows[m[1]] = { words: m[2], voiced: m[3] }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>TAPE — EVERY RENDERED CUT</span>
        <span className="cmd-kbd">PROVENANCE LAW: EVERY FILE KNOWS WHO WROTE IT AND WHAT VOICED IT</span>
        {msg && <span className="chip info ml-auto">{msg}</span>}
      </div>

      {/* SHOWS — every build, live or finished, never lost after a reload */}
      <section className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="cmd-label" style={{ color: 'var(--cmd-red)', margin: 0 }}>SHOWS</span>
          <span className="cmd-kbd">{shows.filter(s => s.stage === 'done').length} finished · {shows.filter(s => !TERMINAL.has(s.stage)).length} building</span>
        </div>
        {shows.length === 0 && <div className="cmd-panel p-4 cmd-kbd">no shows built yet — rank a story on DISCOVERY and press BUILD THIS SHOW</div>}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(420px,1fr))' }}>
          {shows.map((s: any) => {
            const live = !TERMINAL.has(s.stage)
            return (
              <section key={s.slug} className="cmd-panel" style={{ borderColor: s.stage === 'done' ? 'var(--cmd-line-hot)' : s.stage === 'error' ? 'var(--cmd-red-deep)' : 'var(--cmd-line)' }}>
                <div className="cmd-h justify-between">
                  <h2 className="truncate" style={{ maxWidth: 300 }} title={s.question || s.slug}>{(s.question || s.slug).slice(0, 60)}</h2>
                  <span className={`chip ${STAGE_CHIP[s.stage] || 'info'}`}>{String(s.stage).toUpperCase()}{live ? ` ${s.pct || 0}%` : ''}</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex gap-2 flex-wrap items-center">
                    {s.voice_engine && <span className={`chip ${s.voice_engine === 'breeze' ? 'ok' : 'warn'}`}>{s.voice_engine === 'breeze' ? 'BREEZE' : 'KOKORO DRAFT'}</span>}
                    {s.duration_s ? <span className="cmd-kbd">{Math.floor(s.duration_s / 60)}:{String(s.duration_s % 60).padStart(2, '0')} · {s.lines} lines</span> : null}
                    <span className="cmd-kbd ml-auto" title={s.updated || ''}>{ago(s.updated || s.started).text}</span>
                  </div>
                  {live && <div className="cmd-kbd" style={{ color: 'var(--cmd-amber)' }}>{s.message}</div>}
                  {s.stage === 'error' && <div className="chip err" style={{ whiteSpace: 'normal', display: 'block' }} title={s.error || s.message}>{String(s.error || s.message || 'failed').slice(0, 160)}</div>}
                  {s.audio_url && <audio controls preload="none" src={s.audio_url} />}
                  <div className="flex gap-2 flex-wrap">
                    {s.audio_url && <a className="cmd-btn ghost" href={s.audio_url + '?download=1'} style={{ textDecoration: 'none' }}>⬇ MP3</a>}
                    {s.briefing && !live && <button className="cmd-btn ghost" disabled={!!busy} onClick={() => buildAgain(s)}>{busy === 'again:' + s.slug ? 'STARTING…' : '↻ BUILD AGAIN'}</button>}
                    {live && <button className="cmd-btn ghost" disabled={!!busy} onClick={() => cancel(s)} style={{ borderColor: 'var(--cmd-red)', color: 'var(--cmd-red)' }}>{busy === 'cancel:' + s.slug ? 'CANCELLING…' : '■ CANCEL'}</button>}
                    <span className="cmd-kbd" style={{ alignSelf: 'center' }}>{s.slug}</span>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </section>

      <div className="cmd-label" style={{ color: 'var(--cmd-cyan)' }}>ENGINE TEST CUTS (legacy renders)</div>
      <div className="grid grid-cols-2 gap-4">
        {state.audio.map(a => {
          const prov = manifestRows[a.file]
          return (
            <section key={a.file} className="cmd-panel">
              <div className="cmd-h justify-between">
                <h2 className="truncate" style={{ maxWidth: 320 }}>{a.file.replace('.mp3', '').toUpperCase()}</h2>
                <span className="cmd-kbd">{fmtBytes(a.bytes)}</span>
              </div>
              <div className="p-3 space-y-2">
                <audio controls preload="none" src={`/api/command/audio/audio/${a.file}`} />
                {prov ? (
                  <div className="flex gap-2 flex-wrap">
                    <span className="chip info" title={prov.words}>WORDS: {prov.words.slice(0, 38)}</span>
                    <span className={`chip ${/breeze/i.test(prov.voiced) ? 'ok' : /elevenlabs/i.test(prov.voiced) ? 'info' : 'warn'}`} title={prov.voiced}>VOICE: {prov.voiced.slice(0, 42)}</span>
                  </div>
                ) : <span className="chip err">NOT IN MANIFEST — ADD A ROW</span>}
              </div>
            </section>
          )
        })}
      </div>

      <section className="cmd-panel">
        <div className="cmd-h"><div className="vu"><i /><i /><i /><i /></div><h2>ENGINE RUNS (THE WRITER&apos;S ROOM LOG)</h2></div>
        <div className="overflow-x-auto">
          <table className="cmd-table">
            <thead><tr><th>RUN</th><th>BEAT</th><th>PROVIDER</th><th>TURNS</th><th>WORDS</th><th>FINISHED</th></tr></thead>
            <tbody>
              {state.runs.sort((a, b) => String(b.finished).localeCompare(String(a.finished))).map(r => (
                <tr key={r.run}>
                  <td style={{ color: 'var(--cmd-amber)' }}>{r.run}</td>
                  <td>{r.beat}</td>
                  <td className="cmd-kbd">{r.provider}</td>
                  <td>{r.turns}</td>
                  <td>{r.spoken_words}</td>
                  <td className="cmd-kbd">{r.finished?.slice(0, 19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
