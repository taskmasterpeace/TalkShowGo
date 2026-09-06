import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// THE TUNNEL GATE — the take flow is built to be public (the token is the secret), but the producer's
// command surface is NOT: /api/command/** can save keys, verify executables, rewrite beats, list every
// take token, and serve every recorded clip. When the app is exposed through a public tunnel
// (localhost.run, a funnel, any hostname we don't recognize), those routes must be invisible.
//
// A request that arrived through a tunnel carries the tunnel's public hostname; local/LAN/tailnet use
// stays fully open. The tunnel provider routes by hostname, so a tunneled client cannot present a
// local-looking Host. Escape hatch for deliberate remote admin: set COMMAND_SHARED_SECRET and send it
// as the x-command-key header.
//
// Also enforced here: a body-size ceiling. Route handlers buffer req.json() in full before any
// validation runs, so an internet client could OOM the server with one giant POST.

const MAX_BODY_BYTES = 35 * 1024 * 1024 // comfortably above the 25MB audio cap the take route enforces post-parse

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})$/i

function isLocalOrigin(req: NextRequest): boolean {
  const host = (req.headers.get('host') || '').split(':')[0]
  if (LOCAL_HOST.test(host)) return true
  if (host.endsWith('.ts.net')) return true // tailscale serve/funnel to the producer's own tailnet name
  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // body ceiling on every API POST (content-length is set by real browsers and curl; a missing
  // length on a huge streamed body still gets cut off by the route's own 25MB post-parse checks)
  const len = parseInt(req.headers.get('content-length') || '0', 10)
  if (len > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: 'body too large' }, { status: 413 })

  const gated = pathname.startsWith('/api/command') || pathname === '/command' || pathname.startsWith('/command/')
  if (!gated) return NextResponse.next()
  if (isLocalOrigin(req)) return NextResponse.next()

  const secret = process.env.COMMAND_SHARED_SECRET
  if (secret && req.headers.get('x-command-key') === secret) return NextResponse.next()

  // same shape as an unknown take token: a bare 404 that hints at nothing
  return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
}

export const config = {
  matcher: ['/api/:path*', '/command/:path*', '/command'],
}
