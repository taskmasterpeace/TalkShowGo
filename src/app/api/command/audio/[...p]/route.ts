import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

const ROOT = process.cwd()
const BASES: Record<string, string> = {
  audio: path.join(ROOT, 'lab', 'engine', 'audio'),
  voices: path.join(ROOT, 'lab', 'cast', 'voices'),
  images: path.join(ROOT, 'lab', 'cast', 'images'),
  shows: path.join(ROOT, 'lab', 'shows'),
}
const TYPES: Record<string, string> = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

export async function GET(_: Request, { params }: { params: { p: string[] } }) {
  const [base, ...rest] = params.p || []
  const dir = BASES[base]
  if (!dir || !rest.length) return new Response('not found', { status: 404 })
  const file = path.resolve(dir, rest.join('/'))
  if (!file.startsWith(path.resolve(dir))) return new Response('nope', { status: 403 })
  if (!fs.existsSync(file)) return new Response('not found', { status: 404 })
  const type = TYPES[path.extname(file).toLowerCase()]
  if (!type) return new Response('unsupported', { status: 415 })
  const buf = fs.readFileSync(file)
  return new Response(buf, { headers: { 'Content-Type': type, 'Content-Length': String(buf.length), 'Cache-Control': 'no-cache' } })
}
