#!/usr/bin/env node
/**
 * Source-verify: resolve every Twitter handle in a beat file via twitterapi.io user/info,
 * store userId + followers + verified date (polling law: IDs not handles - handles rot).
 * Usage: node lab/engine/verify_sources.mjs lab/beats/battle-rap.json
 */
import fs from 'node:fs'
import path from 'node:path'
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
// key precedence: process env > .env > lab/settings/keys.json (a key pasted in the SETTINGS page); no .env is fine
const readKey = name => { const e = process.env[name]; if (e && e.trim()) return e.trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch { /* no .env */ } try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v && String(v).trim()) return String(v).trim() } catch { /* no settings file */ } return undefined }
const KEY = readKey('TWITTERAPI_IO_KEY')
const beatPath = path.resolve(process.argv[2] || '')
const beat = JSON.parse(fs.readFileSync(beatPath, 'utf8'))
const today = new Date().toISOString().slice(0, 10)

async function info(handle) {
  const res = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(handle)}`, { headers: { 'X-API-Key': KEY } })
  const j = await res.json().catch(() => null)
  if (j && j.data && j.data.id) return { id: j.data.id, followers: j.data.followers, name: j.data.name, verified: !!(j.data.isBlueVerified || j.data.isVerified) }
  return null
}
const main = async () => {
  for (const src of beat.sources.twitter) {
    if (!src.handle) continue
    let hit = await info(src.handle), used = src.handle
    if (!hit && Array.isArray(src.candidates)) for (const c of src.candidates) { hit = await info(c); if (hit) { used = c; break } }
    if (hit) {
      src.handle = used
      src.userId = hit.id
      src.followers = hit.followers
      src.display_name = hit.name
      src.status = hit.followers < 100 ? `SUSPECT ${today} - only ${hit.followers} followers (possible squatter)` : `VERIFIED ${today}`
      console.log(`OK   @${used}  id=${hit.id}  followers=${hit.followers}  (${hit.name})`)
    } else {
      src.status = `NOT FOUND ${today} - needs a human to find the current handle`
      console.log(`MISS @${src.handle} (and candidates) - not found`)
    }
    await new Promise(r => setTimeout(r, 400))
  }
  fs.writeFileSync(beatPath, JSON.stringify(beat, null, 2) + '\n')
  console.log('beat updated: ' + beatPath)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
