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
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execSync } from 'node:child_process'
const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true] }))
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const sh = (c, opts = {}) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim() } catch (e) { return '' } }
const killPid = (f) => { try { const pid = parseInt(fs.readFileSync(f, 'utf8'), 10); if (pid) sh(`taskkill /PID ${pid} /T /F`); fs.unlinkSync(f) } catch { /* not running */ } }

const PIDF = path.join(ROOT, 'lab', 'takes', '.tunnel.pid')
const KEEPF = path.join(ROOT, 'lab', 'takes', '.keeper.pid')
if (ARG.off) {
  sh('tailscale funnel reset')
  killPid(PIDF); killPid(KEEPF)
  console.log('public tunnels CLOSED (funnel reset + ssh tunnel + warm-keeper killed)')
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
// prefer a REAL wifi/ethernet address: 172.x only counts in the private 172.16-31 range, and Docker/WSL
// vEthernet adapters (172.x.x.x virtuals) previously won the pick and put an unreachable IP on the QR
const cands = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))
const lan = (cands.find(a => a.address.startsWith('192.168.')) || cands[0])?.address
const tsIp = sh('tailscale ip -4')
const links = []
if (lan) links.push(['same wifi', `http://${lan}:3000/take/${hit.person.token}`])
if (tsIp) links.push(['tailnet (their phone runs Tailscale)', `http://${tsIp}:3000/take/${hit.person.token}`])

if (ARG.public) {
  // a fresh --public run owns the tunnel: kill anything a previous run left behind FIRST, or the old
  // ssh/keeper pids get orphaned forever (a re-run used to overwrite the pid files without killing them)
  killPid(PIDF); killPid(KEEPF)
  // 1) Tailscale Funnel (the durable path - needs a ONE-TIME enable on the tailnet).
  // No `timeout` prefix: System32's timeout.exe rejects trailing args, so under cmd/PowerShell the
  // wrapper silently prevented funnel from EVER running. --bg returns on its own; execSync's timeout is the guard.
  let pub = null
  const fun = sh('tailscale funnel --bg 3000', { timeout: 15000 }) + '\n' + sh('tailscale funnel status', { timeout: 10000 })
  const fm = fun.match(/https:\/\/[^\s/]+\.ts\.net[^\s/]*/)
  if (fm) pub = fm[0]
  else if (/not enabled/i.test(fun)) {
    const em = fun.match(/https:\/\/login\.tailscale\.com[^\s]+/)
    console.log(`(Tailscale Funnel needs a one-time enable${em ? ': ' + em[0] : ''} - falling back to localhost.run)`)
  }
  // 2) fallback: localhost.run over ssh (free, no enable, DIES AT ~31 MIN - their cull, nothing extends it)
  let child = null
  if (!pub) {
    const { spawn } = await import('node:child_process')
    const logf = path.join(ROOT, 'lab', 'takes', '.tunnel.log')
    fs.mkdirSync(path.dirname(logf), { recursive: true })
    const out = fs.openSync(logf, 'w')
    child = spawn('ssh', ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ExitOnForwardFailure=yes', '-R', '80:localhost:3000', 'nokey@localhost.run'], { detached: true, stdio: ['ignore', out, out] })
    child.unref()
    fs.writeFileSync(PIDF, String(child.pid))
    for (let i = 0; i < 15 && !pub; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const lm = fs.readFileSync(logf, 'utf8').match(/https:\/\/[a-z0-9]+\.lhr\.life/)
      if (lm) pub = lm[0]
    }
    // never leave a tunnel we can't name running: no URL detected = kill it, or the app stays exposed
    // on an address nobody knows while the producer is told there is no tunnel
    if (!pub) killPid(PIDF)
  }
  if (pub) {
    // verify before handing it out - against the STATIC logo (the take route logs every GET as
    // "<person> opened their take link"; verification pings were writing phantom visits)
    let ok = false
    try { ok = (await fetch(`${pub}/logo.svg`, { signal: AbortSignal.timeout(20000) })).ok } catch { /* dead */ }
    if (ok) {
      links.unshift(['PUBLIC (anyone, until you close it)', `${pub}/take/${hit.person.token}`])
      if (pub.includes('.lhr.life')) console.log('note: free localhost.run tunnels are culled at ~31 minutes no matter what - re-run this when it dies, or enable Tailscale Funnel once for a permanent link.')
      console.log('⚠️  PUBLIC TUNNEL IS OPEN: the whole dev app is reachable from the internet while this is up.')
      console.log('    Close it when the takes are in:  node lab/engine/take_link.mjs --off\n')
    } else {
      // a tunnel that won't serve is worse than none - and one we leave running is worse than that
      if (pub.includes('.lhr.life')) killPid(PIDF); else sh('tailscale funnel reset')
      console.log(`(tunnel ${pub} came up but did not serve the app - closed it, not handing it out)\n`)
    }
  } else console.log('(no public tunnel available right now - use the wifi/tailnet links)\n')
}

console.log(`${hit.person.name} → ${hit.show} (${hit.beat})`)
for (const [label, url] of links) console.log(`  ${label}: ${url}`)
const best = links[0]?.[1]
if (best && ARG.qr !== 'false' && ARG.qr !== '0') { // ARG values are strings: `!== false` could never opt out
  const qrp = path.join(ROOT, 'lab', 'takes', `qr-${hit.beat}-${hit.person.slug}.png`)
  fs.mkdirSync(path.dirname(qrp), { recursive: true })
  sh(`npx --yes qrcode -o "${qrp}" -w 512 "${best}"`)
  if (fs.existsSync(qrp)) console.log(`  QR: ${qrp}`)
}
