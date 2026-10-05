import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const ROOT = process.cwd()

/** GET — the prediction ledger, every beat: per-host standings (computed from the file, never stored)
 *  plus the full call log, newest first. The file is the record; this is just the window. */
export async function GET() {
  const dir = path.join(ROOT, 'lab', 'ledger')
  if (!fs.existsSync(dir)) return NextResponse.json({ ok: true, beats: [] })
  const beats: any[] = []
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.predictions.jsonl'))) {
    const rows = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    const hosts = new Map<string, any>()
    for (const r of rows) {
      const h = hosts.get(r.host) || { host: r.host, host_id: r.host_id, HIT: 0, MISS: 0, PUSH: 0, UNGRADED: 0 }
      h[r.verdict] = (h[r.verdict] || 0) + 1
      hosts.set(r.host, h)
    }
    const standings = [...hosts.values()].map(h => ({ ...h, record: `${h.HIT}-${h.MISS}`, pct: h.HIT + h.MISS ? Math.round(100 * h.HIT / (h.HIT + h.MISS)) : null }))
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.HIT - a.HIT)
    beats.push({ beat: f.replace('.predictions.jsonl', ''), standings, rows: rows.reverse() })
  }
  return NextResponse.json({ ok: true, beats })
}
