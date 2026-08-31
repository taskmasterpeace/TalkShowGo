import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
const ROOT = process.cwd()

function key() {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
  return (env.match(/^TWITTERAPI_IO_KEY=(.+)$/m) || [])[1]
}
async function info(K: string, handle: string) {
  try {
    const r = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(handle)}`, { headers: { 'X-API-Key': K }, signal: AbortSignal.timeout(12000) })
    const j: any = await r.json()
    if (j?.data?.id) return { id: j.data.id, followers: j.data.followers, name: j.data.name }
  } catch {}
  return null
}

/** POST {file} — re-verify every twitter handle in the beat; stores userIds. Polling law: IDs, not handles. */
export async function POST(req: Request) {
  const { file } = await req.json()
  if (!/^[a-z0-9-]+\.json$/.test(file || '')) return NextResponse.json({ error: 'bad file' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'beats', file)
  const beat = JSON.parse(fs.readFileSync(p, 'utf8'))
  const K = key()
  if (!K) return NextResponse.json({ error: 'no TWITTERAPI_IO_KEY' }, { status: 500 })
  const today = new Date().toISOString().slice(0, 10)
  const log: string[] = []
  for (const src of beat.sources.twitter || []) {
    if (!src.handle) continue
    let hit = await info(K, src.handle); let used = src.handle
    if (!hit && Array.isArray(src.candidates)) for (const c of src.candidates) { hit = await info(K, c); if (hit) { used = c; break } }
    if (hit) {
      src.handle = used; src.userId = hit.id; src.followers = hit.followers; src.display_name = hit.name
      src.status = hit.followers < 100 ? `SUSPECT ${today} - only ${hit.followers} followers (possible squatter)` : `VERIFIED ${today}`
      log.push(`OK @${used} (${hit.followers})`)
    } else {
      src.status = `NOT FOUND ${today} - needs a human to find the current handle`
      log.push(`MISS @${src.handle}`)
    }
    await new Promise(r => setTimeout(r, 350))
  }
  fs.writeFileSync(p, JSON.stringify(beat, null, 2) + '\n')
  return NextResponse.json({ ok: true, log, beat })
}
