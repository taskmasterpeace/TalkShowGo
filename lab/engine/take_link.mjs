#!/usr/bin/env node
/**
 * TAKE LINK — hand somebody their take link the right way (Robert 2026-09-05: "we do need a QR code.
 * We need to be publicly available when needed.")
 *
 *   node lab/engine/take_link.mjs --person=robert                    links + QR (LAN + tailnet)
 *   node lab/engine/take_link.mjs --person=dad --public              ALSO opens a public HTTPS funnel (on-demand)
 *   node lab/engine/take_link.mjs --off                              close the public funnel
 *
 * PUBLIC = Tailscale Funnel on this machine, ON-DEMAND ONLY: it exposes the whole dev app (every route) to
 * the internet while it's up, so open it when collecting takes and close it after. The tool says so out loud.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() } catch (e) { return '' } }

const PIDF = path.join(ROOT, 'lab', 'takes', '.tunnel.pid')
if (ARG.off) {
  sh('tailscale funnel reset')
  try { const pid = parseInt(fs.readFileSync(PIDF, 'utf8'), 10); if (pid) sh(`taskkill /PID ${pid} /T /F`); fs.unlinkSync(PIDF) } catch { /* no ssh tunnel */ }
  console.log('public tunnels CLOSED (funnel reset + ssh tunnel killed)')
  process.exit(0)
}
const who = String(ARG.person || '').trim()
if (!who) { console.error('need --person=<slug> [--beat=<id>] [--public] · or --off to close the funnel'); process.exit(1) }

// find the person's token (in the named beat, or across all beats)
const beatFiles = String(ARG.beat || '') ? [String(ARG.beat) + '.json'] : fs.readdirSync(path.join(ROOT, 'lab', 'beats')).filter(f => f.endsWith('.json'))
let hit = null
for (const bf of beatFiles) {
  try {
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'beats', bf), 'utf8'))
    const p = (b.people || []).find(x => x.slug === who || String(x.name || '').toLowerCase() === who.toLowerCase())
    if (p?.token) { hit = { beat: b.id, show: b.show?.name || b.id, person: p }; break }
  } catch { /* skip bad beat */ }
}
if (!hit) { console.error(`no person "${who}" with a token in ${beatFiles.length} beat(s) - add them to the beat's people[] first`); process.exit(1) }

const os = await import('node:os')
const lan = Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal && /^192\.|^10\.|^172\./.test(a.address))?.address
const tsIp = sh('tailscale ip -4')
const links = []
if (lan) links.push(['same wifi', `http://${lan}:3000/take/${hit.person.token}`])
if (tsIp) links.push(['tailnet (their phone runs Tailscale)', `http://${tsIp}:3000/take/${hit.person.token}`])

if (ARG.public) {
  // 1) Tailscale Funnel (the durable path - needs a ONE-TIME enable on the tailnet)
  let pub = null
  const fun = sh('timeout 12 tailscale funnel --bg 3000') + '\n' + sh('tailscale funnel status')
  const fm = fun.match(/https:\/\/[^\s/]+\.ts\.net[^\s/]*/)
  if (fm) pub = fm[0]
  else if (/not enabled/i.test(fun)) {
    const em = fun.match(/https:\/\/login\.tailscale\.com[^\s]+/)
    console.log(`(Tailscale Funnel needs a one-time enable${em ? ': ' + em[0] : ''} - falling back to localhost.run)`)
  }
  // 2) fallback: localhost.run over ssh (free, no enable) - spawned detached so it outlives this script
  if (!pub) {
    const { spawn } = await import('node:child_process')
    const logf = path.join(ROOT, 'lab', 'takes', '.tunnel.log')
    fs.mkdirSync(path.dirname(logf), { recursive: true })
    const out = fs.openSync(logf, 'w')
    const child = spawn('ssh', ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ExitOnForwardFailure=yes', '-R', '80:localhost:3000', 'nokey@localhost.run'], { detached: true, stdio: ['ignore', out, out] })
    child.unref()
    fs.writeFileSync(PIDF, String(child.pid))
    for (let i = 0; i < 15 && !pub; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const lm = fs.readFileSync(logf, 'utf8').match(/https:\/\/[a-z0-9]+\.lhr\.life/)
      if (lm) pub = lm[0]
    }
  }
  if (pub) {
    // verify before handing it out - a tunnel that 404s is worse than no tunnel
    let ok = false
    try { ok = (await fetch(`${pub}/api/take/${hit.person.token}`, { signal: AbortSignal.timeout(20000) })).ok } catch { /* dead */ }
    if (ok) {
      links.unshift(['PUBLIC (anyone, until you close it)', `${pub}/take/${hit.person.token}`])
      console.log('⚠️  PUBLIC TUNNEL IS OPEN: the whole dev app is reachable from the internet while this is up.')
      console.log('    Close it when the takes are in:  node lab/engine/take_link.mjs --off\n')
    } else console.log(`(tunnel ${pub} came up but did not serve the take page - not handing it out)\n`)
  } else console.log('(no public tunnel available right now - use the wifi/tailnet links)\n')
}

console.log(`${hit.person.name} → ${hit.show} (${hit.beat})`)
for (const [label, url] of links) console.log(`  ${label}: ${url}`)
const best = links[0]?.[1]
if (best && ARG.qr !== false) {
  const qrp = path.join(ROOT, 'lab', 'takes', `qr-${hit.beat}-${hit.person.slug}.png`)
  fs.mkdirSync(path.dirname(qrp), { recursive: true })
  sh(`npx --yes qrcode -o "${qrp}" -w 512 "${best}"`)
  if (fs.existsSync(qrp)) console.log(`  QR: ${qrp}`)
}
