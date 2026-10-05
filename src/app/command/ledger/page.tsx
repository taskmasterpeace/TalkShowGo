'use client'
// THE LEDGER — every on-record prediction, graded, forever (unasked-for build, 2026-10-05: the
// postgame was already writing this file; receipts this good deserve a page). Standings first,
// then the call log. The jsonl is the record; this page never writes.
import { useEffect, useState } from 'react'

const V: Record<string, { label: string; cls: string }> = {
  HIT: { label: 'HIT', cls: 'on' }, MISS: { label: 'MISS', cls: 'err' },
  PUSH: { label: 'PUSH', cls: 'warn' }, UNGRADED: { label: 'UNGRADED', cls: '' },
}

export default function LedgerPage() {
  const [beats, setBeats] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { fetch('/api/command/ledger').then(r => r.json()).then(j => { setBeats(j.beats || []); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: '62rem' }}>
      <div>
        <div className="cmd-display text-lg" style={{ letterSpacing: '.1em' }}>THE LEDGER</div>
        <div className="cmd-kbd text-sm">Every prediction the desk put on the record, graded against what actually happened. The comments hold the keys; this page holds the receipts.</div>
      </div>
      {loaded && beats.length === 0 && (
        <div className="cmd-panel p-4 cmd-kbd">No graded predictions yet. The ledger opens itself the first time a postgame runs: <span className="cmd-display">npm run show:postgame</span></div>
      )}
      {beats.map(b => (
        <section key={b.beat} className="cmd-panel">
          <div className="cmd-h"><h2>{b.beat.toUpperCase().replace(/-/g, ' ')}</h2></div>
          <div className="p-4 space-y-4">
            <table className="cmd-table w-full">
              <thead><tr><th>HOST</th><th>RECORD</th><th>HIT %</th><th>PUSH</th><th>UNGRADED</th></tr></thead>
              <tbody>
                {b.standings.map((s: any) => (
                  <tr key={s.host}>
                    <td className="cmd-display">{s.host}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.record}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.pct == null ? '—' : s.pct + '%'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.PUSH}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.UNGRADED}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-2">
              {b.rows.map((r: any, i: number) => (
                <div key={i} style={{ borderLeft: '2px solid var(--cmd-line-hot)', paddingLeft: '.7rem' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`chip ${V[r.verdict]?.cls || ''}`}>{V[r.verdict]?.label || r.verdict}</span>
                    <span className="cmd-display text-sm">{r.host}</span>
                    <span className="cmd-kbd text-xs">{r.game?.team} vs {r.game?.opponent} · {r.game?.winner} {r.game?.score} · {String(r.ts).slice(0, 10)}</span>
                  </div>
                  <div className="text-sm" style={{ margin: '.2rem 0' }}>&ldquo;{r.prediction}&rdquo;</div>
                  <div className="cmd-kbd text-xs">{r.why}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
