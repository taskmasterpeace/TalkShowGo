'use client'
import { useCmdState, fmtBytes } from '../lib'

export default function TapePage() {
  const { state } = useCmdState()
  if (!state) return <div className="p-8 cmd-kbd">LOADING TAPE...</div>

  // parse manifest rows for provenance chips
  const manifestRows: Record<string, { words: string; voiced: string }> = {}
  for (const line of (state.manifest || '').split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*[^|]*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/)
    if (m && m[1].endsWith('.mp3')) manifestRows[m[1]] = { words: m[2], voiced: m[3] }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <span className="cmd-display text-lg" style={{ letterSpacing: '0.1em' }}>TAPE — EVERY RENDERED CUT</span>
        <span className="cmd-kbd">PROVENANCE LAW: EVERY FILE KNOWS WHO WROTE IT AND WHAT VOICED IT</span>
      </div>

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
