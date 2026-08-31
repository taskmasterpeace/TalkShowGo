'use client'
import { useEffect, useState, useCallback } from 'react'

export type CmdState = {
  beats: any[]
  cast: any
  voices: string[]
  images: string[]
  audio: { file: string; bytes: number; mtime: number }[]
  manifest: string
  runs: any[]
  pulls: any[]
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

export async function saveBeat(file: string, beat: any) {
  const r = await fetch('/api/command/beat', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file, beat }) })
  if (!r.ok) throw new Error('save failed')
}

export function Flash({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <span className="chip ok ml-3">{msg}</span>
}

export function fmtBytes(n: number) { return n > 1e6 ? (n / 1e6).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB' }
