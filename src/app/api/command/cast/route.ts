import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
const ROOT = process.cwd()

/** PUT {cast} — write cast.json (host bundles + producer are UI-editable; voices/images ride separate files). */
export async function PUT(req: Request) {
  const { cast } = await req.json()
  if (!cast || !Array.isArray(cast.hosts) || !cast.producer) return NextResponse.json({ error: 'bad cast' }, { status: 400 })
  fs.writeFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), JSON.stringify(cast, null, 2) + '\n')
  return NextResponse.json({ ok: true })
}
