import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
const ROOT = process.cwd()

function key() {
  if (process.env.TWITTERAPI_IO_KEY) return process.env.TWITTERAPI_IO_KEY // keys law: hydrated env first
  try { return (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^TWITTERAPI_IO_KEY=(.+)$/m) || [])[1] } catch { return undefined }
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
  const { file } = await req.json().catch(() => ({} as any))
  if (!/^[a-z0-9-]+\.json$/.test(file || '')) return NextResponse.json({ error: 'bad file' }, { status: 400 })
  const p = path.join(ROOT, 'lab', 'beats', file)
  let beat: any
  try { beat = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return NextResponse.json({ error: 'beat unreadable' }, { status: 404 }) }
  const K = key()
  if (!K) return NextResponse.json({ error: 'no TWITTERAPI_IO_KEY' }, { status: 500 })
  const today = new Date().toISOString().slice(0, 10)
  const log: string[] = []
  // compute first, write after: the loop takes 10-20s (one network call per handle) and a whole-object
  // write at the end would erase anything else written to the beat meanwhile (a minted token, a scout add)
  const results = new Map<string, any>()
  let misses = 0, hits = 0
  for (const src of (beat.sources?.twitter || [])) {
    if (!src.handle) continue
    let hit = await info(K, src.handle); let used = src.handle
    if (!hit && Array.isArray(src.candidates)) for (const c of src.candidates) { hit = await info(K, c); if (hit) { used = c; break } }
    if (hit) {
      hits++
      results.set(src.handle, { handle: used, userId: hit.id, followers: hit.followers, display_name: hit.name, status: hit.followers < 100 ? `SUSPECT ${today} - only ${hit.followers} followers (possible squatter)` : `VERIFIED ${today}` })
      log.push(`OK @${used} (${hit.followers})`)
    } else {
      misses++
      results.set(src.handle, { status: `NOT FOUND ${today} - needs a human to find the current handle` })
      log.push(`MISS @${src.handle}`)
    }
    await new Promise(r => setTimeout(r, 350))
  }
  // every single lookup failing is a key/outage problem, not 16 dead handles - never mass-downgrade on that
  if (misses > 0 && hits === 0) return NextResponse.json({ error: 'every lookup failed - check the twitterapi.io key / connectivity before trusting NOT FOUND', log }, { status: 502 })
  // re-read NOW and patch only the twitter rows we verified
  let fresh: any
  try { fresh = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return NextResponse.json({ error: 'beat unreadable on re-read - nothing written', log }, { status: 500 }) }
  for (const src of (fresh.sources?.twitter || [])) {
    const r = src.handle ? results.get(src.handle) : null
    if (r) Object.assign(src, r)
  }
  fs.writeFileSync(p + '.tmp', JSON.stringify(fresh, null, 2) + '\n'); fs.renameSync(p + '.tmp', p)
  return NextResponse.json({ ok: true, log, beat: fresh })
}
