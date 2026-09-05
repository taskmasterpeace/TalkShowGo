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

if (ARG.off) {
  sh('tailscale funnel reset')
  console.log('public funnel CLOSED (tailscale funnel reset)')
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
  sh('tailscale funnel --bg 3000')
  const st = sh('tailscale funnel status')
  const m = st.match(/https:\/\/[^\s/]+/)
  if (m) {
    links.unshift(['PUBLIC (anyone, until you close it)', `${m[0]}/take/${hit.person.token}`])
    console.log('⚠️  PUBLIC FUNNEL IS OPEN: the whole dev app is reachable from the internet while this is up.')
    console.log('    Close it when the takes are in:  node lab/engine/take_link.mjs --off\n')
  } else console.log('(funnel did not report a URL - check `tailscale funnel status`; HTTPS may need enabling on the tailnet)\n')
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
