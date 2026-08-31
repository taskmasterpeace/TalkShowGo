import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
const ROOT = process.cwd()

/** PUT {file, beat} — writes a beat json (the UI's CRUD surface for sources/show/timespan). */
export async function PUT(req: Request) {
  const { file, beat } = await req.json()
  if (!file || !/^[a-z0-9-]+\.json$/.test(file)) return NextResponse.json({ error: 'bad file' }, { status: 400 })
  if (!beat || typeof beat !== 'object' || !beat.id || !beat.sources) return NextResponse.json({ error: 'bad beat' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'beats', file)
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'unknown beat' }, { status: 404 })
  delete (beat as any).file
  fs.writeFileSync(p, JSON.stringify(beat, null, 2) + '\n')
  return NextResponse.json({ ok: true })
}
