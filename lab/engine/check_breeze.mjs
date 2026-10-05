#!/usr/bin/env node
/** CHECK BREEZE — a REAL-inference probe (a 200 from /v1/health is not proof; mk-breeze once sat
 *  dead for 11 days behind a healthy gateway). Renders two words; prints alive/dead + the fix. */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const key = process.env.CUPCAKE_GATEWAY_KEY || (() => { try { return (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^CUPCAKE_GATEWAY_KEY=(.+)$/m) || [])[1] } catch { return '' } })()
try {
  const h = await (await fetch('http://192.168.1.249:8700/v1/health', { signal: AbortSignal.timeout(6000) })).json()
  if (h.running || h.queue_depth > 0) { console.log(`BUSY: a render owns the GPU (running:${h.running} queue:${h.queue_depth}) - breeze will answer when it frees`); process.exit(0) }
  const t0 = Date.now()
  const r = await fetch('http://192.168.1.249:8700/v1/audio/breeze-design', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ text: 'Mic check.', design: 'Feminine, warm, clear, close-mic studio quality', cfg_scale: 4.0, seed: 42 }),
    signal: AbortSignal.timeout(120000),
  })
  if (r.ok) console.log(`BREEZE ALIVE: ${(await r.arrayBuffer()).byteLength} bytes in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  else { console.error(`BREEZE DEAD (HTTP ${r.status}): ${(await r.text()).slice(0, 100)}\nfix: ssh taskmasterpeace@192.168.1.249 "sudo systemctl restart mk-breeze"  (then ~75s model load)`); process.exit(1) }
} catch (e) { console.error('GATEWAY UNREACHABLE: ' + e.message); process.exit(1) }
