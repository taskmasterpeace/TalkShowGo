import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROOT = process.cwd()
const j = (p: string) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }

export async function GET() {
  const beatsDir = path.join(ROOT, 'lab', 'beats')
  const beats = fs.existsSync(beatsDir)
    ? fs.readdirSync(beatsDir).filter(f => f.endsWith('.json')).map(f => ({ file: f, ...j(path.join(beatsDir, f)) }))
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
  const show_types = j(path.join(ROOT, 'lab', 'show_types.json'))

  // health lamps
  const env = (() => { try { return fs.readFileSync(path.join(ROOT, '.env'), 'utf8') } catch { return '' } })()
  const health: Record<string, boolean | null> = {
    twitter_key: /TWITTERAPI_IO_KEY=.+/.test(env),
    gateway_key: /CUPCAKE_GATEWAY_KEY=.+/.test(env),
    gateway: null,
    breeze_refs: voices.length >= 3,
  }
  try {
    const r = await fetch('http://192.168.1.249:8700/v1/health', { signal: AbortSignal.timeout(4000) })
    health.gateway = r.ok
  } catch { health.gateway = false }

  return NextResponse.json({ beats, cast, guests, voices, images, audio, manifest, runs, pulls, topics, topicsAll, show_types, health })
}
