import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { listStringers } from '@/lib/command/stringer'
import { listBriefings } from '@/lib/command/briefing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROOT = process.cwd()
const j = (p: string) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }

// the cupcake lamp is a courtesy, not worth stalling every page load for: probe fast, remember for a minute
// (every command page + the layout's ShowSwitcher hit this route; off-LAN that was a 4s stall apiece)
let gwCache: { at: number; ok: boolean } | null = null
async function gatewayHealth(): Promise<boolean> {
  if (gwCache && Date.now() - gwCache.at < 60000) return gwCache.ok
  let ok = false
  try { ok = (await fetch((process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700') + '/v1/health', { signal: AbortSignal.timeout(1500) })).ok } catch { ok = false }
  gwCache = { at: Date.now(), ok }
  return ok
}

export async function GET() {
  const beatsDir = path.join(ROOT, 'lab', 'beats')
  const beats = fs.existsSync(beatsDir)
    ? fs.readdirSync(beatsDir).filter(f => f.endsWith('.json')).map(f => {
        const beat = { file: f, ...j(path.join(beatsDir, f)) } as any
        // tokens ARE the take links' whole auth - this aggregate view never needs them (the PEOPLE page fetches its own)
        if (Array.isArray(beat.people)) beat.people = beat.people.map((p: any) => ({ ...p, token: undefined }))
        return beat
      })
    : []

  const cast = j(path.join(ROOT, 'lab', 'cast', 'cast.json'))
  const guestsDir = path.join(ROOT, 'lab', 'cast', 'guests')
  const guests = fs.existsSync(guestsDir) ? fs.readdirSync(guestsDir).filter(f => f.endsWith('.json')).map(f => j(path.join(guestsDir, f))).filter(Boolean) : []
  const voicesDir = path.join(ROOT, 'lab', 'cast', 'voices')
  const voices = fs.existsSync(voicesDir) ? fs.readdirSync(voicesDir).filter(f => f.endsWith('.wav')) : []
  const imagesDir = path.join(ROOT, 'lab', 'cast', 'images')
  const images = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : []

  const audioDir = path.join(ROOT, 'lab', 'engine', 'audio')
  const audio = fs.existsSync(audioDir)
    ? fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3')).map(f => {
        const st = fs.statSync(path.join(audioDir, f))
        return { file: f, bytes: st.size, mtime: st.mtimeMs }
      }).sort((a, b) => b.mtime - a.mtime)
    : []

  const manifest = (() => { try { return fs.readFileSync(path.join(ROOT, 'lab', 'engine', 'AUDIO_MANIFEST.md'), 'utf8') } catch { return '' } })()

  const runsDir = path.join(ROOT, 'lab', 'engine', 'runs')
  const runs = fs.existsSync(runsDir)
    ? fs.readdirSync(runsDir).filter(d => fs.existsSync(path.join(runsDir, d, 'meta.json'))).map(d => ({ run: d, ...j(path.join(runsDir, d, 'meta.json')) }))
    : []

  const pullsDir = path.join(ROOT, 'lab', 'runs')
  const pulls = fs.existsSync(pullsDir)
    ? fs.readdirSync(pullsDir).filter(f => f.startsWith('pull_')).sort().reverse().slice(0, 5).map(f => j(path.join(pullsDir, f)))
    : []
  const topicsFiles = fs.existsSync(pullsDir) ? fs.readdirSync(pullsDir).filter(f => f.startsWith('topics_')).sort().reverse() : []
  const topicsAll = topicsFiles.slice(0, 5).map(f => j(path.join(pullsDir, f))).filter(Boolean)
  const topics = topicsAll[0] || null
  const formats = j(path.join(ROOT, 'lab', 'formats.json'))
  const production_skins = j(path.join(ROOT, 'lab', 'production_skins.json'))
  const models = j(path.join(ROOT, 'lab', 'models.json'))

  // health lamps - keys law: hydrated process.env is the truth (SETTINGS saves land there), .env is the cold-boot fallback
  const env = (() => { try { return fs.readFileSync(path.join(ROOT, '.env'), 'utf8') } catch { return '' } })()
  const has = (name: string) => !!process.env[name] || new RegExp(`^${name}=.+`, 'm').test(env)
  const health: Record<string, boolean | null> = {
    twitter_key: has('TWITTERAPI_IO_KEY'),
    gateway_key: has('CUPCAKE_GATEWAY_KEY'),
    gateway: null,
    breeze_refs: voices.length >= 3,
    openrouter_key: has('OPENROUTER_API_KEY'),
    perplexity_key: has('PERPLEXITY_API_KEY'),
    ytdlp: fs.existsSync(process.env.YTDLP_PATH || 'C:/Users/taskm/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe'),
  }
  const stringers = listStringers(60)   // enough history that per-show filtering on the Research Desk still has material
  const briefings = listBriefings(60)
  // briefings carry their source beat; a built show inherits it via its briefing, so TAPE can scope per show
  const briefingBeat: Record<string, string> = {}
  for (const b of briefings) if (b?.id && b?.beat) briefingBeat[b.id] = b.beat

  // every built show, newest first — so a finished mp3 is never unreachable after a reload
  const showsDir = path.join(ROOT, 'lab', 'shows')
  const shows = fs.existsSync(showsDir)
    ? fs.readdirSync(showsDir).map(d => {
        const s = j(path.join(showsDir, d, 'status.json'))
        if (!s) return null
        const age_s = s.updated ? Math.round((Date.now() - new Date(s.updated).getTime()) / 1000) : null
        // present a job that stopped heartbeating as dead (same stale rule the showbuild GET persists)
        const STALE: Record<string, number> = { queued: 180, compile: 300, floor: 900, scripted: 300, audio: 900 }
        const stale = !['done', 'error', 'cancelled'].includes(s.stage) && age_s != null && age_s > (STALE[s.stage] || 600)
        return { slug: d, stage: stale ? 'error' : s.stage, stale, pct: s.pct, message: stale ? `stopped reporting during ${s.stage}` : s.message, question: s.question || null, briefing: s.briefing || null, beat: s.beat || briefingBeat[s.briefing] || null, started: s.started || null, updated: s.updated || null, age_s, duration_s: s.duration_s || null, lines: s.lines || null, voice_engine: s.voice_engine || null, pid: s.pid || null, audio_url: s.audio ? `/api/command/audio/shows/${d}/${path.basename(s.audio)}` : null }
      }).filter(Boolean).sort((a: any, b: any) => String(b.started || '').localeCompare(String(a.started || '')))
    : []
  health.gateway = await gatewayHealth()

  return NextResponse.json({ beats, cast, guests, voices, images, audio, manifest, runs, pulls, topics, topicsAll, formats, production_skins, models, stringers, briefings, shows, health })
}
