import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
const ROOT = process.cwd()

/** PUT {file, beat} — writes a beat json (the UI's CRUD surface for sources/show/timespan). */
export async function PUT(req: Request) {
  const { file, beat } = await req.json().catch(() => ({} as any))
  if (!file || !/^[a-z0-9-]+\.json$/.test(file)) return NextResponse.json({ error: 'bad file' }, { status: 400 })
  if (!beat || typeof beat !== 'object' || !beat.id || !beat.sources) return NextResponse.json({ error: 'bad beat' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'beats', file)
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'unknown beat' }, { status: 404 })
  delete (beat as any).file
  // people[] law (people.ts): delegate rows and their tokens are patched ONLY through the people API.
  // The editor's copy can be minutes stale - writing it verbatim once erased a freshly minted token and
  // killed a link already texted out. The rows on DISK win; also strip the tokens the state API now
  // withholds so a stale editor copy can't write token-less rows back.
  try {
    const cur = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (Array.isArray(cur.people)) (beat as any).people = cur.people
    else delete (beat as any).people
  } catch { return NextResponse.json({ error: 'beat unreadable on disk - not overwriting it' }, { status: 500 }) }
  fs.writeFileSync(p + '.tmp', JSON.stringify(beat, null, 2) + '\n'); fs.renameSync(p + '.tmp', p) // atomic: a torn beat kills every take link on it
  return NextResponse.json({ ok: true })
}
