import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

const ROOT = process.cwd()
const BASES: Record<string, string> = {
  audio: path.join(ROOT, 'lab', 'engine', 'audio'),
  voices: path.join(ROOT, 'lab', 'cast', 'voices'),
  images: path.join(ROOT, 'lab', 'cast', 'images'),
  logos: path.join(ROOT, 'lab', 'branding', 'logos'),
  shows: path.join(ROOT, 'lab', 'shows'),
  clips: path.join(ROOT, 'lab', 'clips'),
  takes: path.join(ROOT, 'lab', 'takes'),
}
const TYPES: Record<string, string> = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }

/** Serves media under an allow-listed base. Supports HTTP Range (206) so players can seek, and
 *  ?download=1 for a save-as. Path guard uses the base + separator so a sibling dir can't match. */
export async function GET(req: Request, { params }: { params: { p: string[] } }) {
  const [base, ...rest] = params.p || []
  const dir = BASES[base]
  if (!dir || !rest.length) return new Response('not found', { status: 404 })
  const root = path.resolve(dir)
  const file = path.resolve(dir, rest.join('/'))
  if (file !== root && !file.startsWith(root + path.sep)) return new Response('nope', { status: 403 })
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('not found', { status: 404 })
  const type = TYPES[path.extname(file).toLowerCase()]
  if (!type) return new Response('unsupported', { status: 415 })

  const size = fs.statSync(file).size
  const url = new URL(req.url)
  const headers: Record<string, string> = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' }
  if (url.searchParams.get('download')) headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`

  const range = req.headers.get('range')
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range)
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : Math.max(0, size - parseInt(m[2], 10))
    let end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1
    if (isNaN(start) || isNaN(end) || start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    const buf = Buffer.alloc(end - start + 1)
    const fd = fs.openSync(file, 'r'); try { fs.readSync(fd, buf, 0, buf.length, start) } finally { fs.closeSync(fd) }
    return new Response(buf, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(buf.length) } })
  }
  const buf = fs.readFileSync(file)
  return new Response(buf, { headers: { ...headers, 'Content-Length': String(buf.length) } })
}
