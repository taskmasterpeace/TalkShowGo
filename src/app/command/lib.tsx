'use client'
import { useEffect, useState, useCallback } from 'react'

export type CmdState = {
  beats: any[]
  cast: any
  guests: any[]
  voices: string[]
  images: string[]
  audio: { file: string; bytes: number; mtime: number }[]
  manifest: string
  runs: any[]
  pulls: any[]
  topics: any
  topicsAll: any[]
  formats: any
  production_skins: any
  models: any
  stringers: any[]
  briefings: any[]
  health: Record<string, boolean | null>
}

export function useCmdState() {
  const [state, setState] = useState<CmdState | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/command/state', { cache: 'no-store' })
      setState(await r.json())
      setErr(null)
    } catch (e: any) { setErr(String(e?.message || e)) }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { state, err, reload }
}

export function useBeat(state: CmdState | null) {
  const [beatFile, setBeatFile] = useState<string | null>(null)
  useEffect(() => { try { const s = localStorage.getItem('tsg_beat'); if (s) setBeatFile(s) } catch {} }, [])
  const beats = state?.beats || []
  const beat = beats.find(b => b.file === beatFile) || beats[0] || null
  const pick = (f: string) => { setBeatFile(f); try { localStorage.setItem('tsg_beat', f) } catch {} }
  return { beat, beats, pick }
}

export function BeatPicker({ beats, beat, pick }: { beats: any[]; beat: any; pick: (f: string) => void }) {
  if (beats.length < 2) return null
  return (
    <div className="flex gap-1">
      {beats.map(b => (
        <button key={b.file} className={`chip ${beat?.file === b.file ? 'err' : ''}`} style={{ cursor: 'pointer' }} onClick={() => pick(b.file)}>
          {(b.show?.name || b.name || b.id).toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export async function saveBeat(file: string, beat: any) {
  const r = await fetch('/api/command/beat', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file, beat }) })
  if (!r.ok) throw new Error('save failed')
}

export function Flash({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <span className="chip ok ml-3">{msg}</span>
}

export function fmtBytes(n: number) { return n > 1e6 ? (n / 1e6).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB' }

/** Freshness: relative time + age class for "when was this last touched" indicators. */
export function ago(iso?: string | null): { text: string; cls: string } {
  if (!iso) return { text: 'never', cls: 'err' }
  const t = new Date(iso).getTime()
  if (isNaN(t)) return { text: String(iso), cls: '' }
  const m = Math.max(0, Math.round((Date.now() - t) / 60000))
  const text = m < 60 ? `${m}m ago` : m < 2880 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
  const cls = m < 1440 ? 'ok' : m < 10080 ? '' : m < 43200 ? 'warn' : 'err'
  return { text, cls }
}
/** Parse the date out of status strings like "VERIFIED 2026-08-31". */
export function statusDate(status?: string): string | null {
  const m = String(status || '').match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}
