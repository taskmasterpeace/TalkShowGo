#!/usr/bin/env node
/**
 * Generate cast portraits via Directors Palette API (nano-banana-2).
 * Law (aiobr DP playbook): NEVER set reference_tag/reference_category on scene gens.
 * Usage: node lab/engine/gen_portraits.mjs [hostId]   (default: all missing)
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const AENV = fs.readFileSync('D:/git/aiobr/.env', 'utf8')
const KEY = (AENV.match(/^DP_API_KEY=(.+)$/m) || [])[1]
const BASE = ((AENV.match(/^DP_BASE_URL=(.+)$/m) || [])[1] || '').replace(/\/$/, '')
if (!KEY || !BASE) { console.error('no DP creds in aiobr .env'); process.exit(1) }
const IMGDIR = path.join(ROOT, 'lab', 'cast', 'images')
fs.mkdirSync(IMGDIR, { recursive: true })

const STYLE = 'Bold animated broadcast portrait, cel-shaded, thick confident outlines, dramatic studio key light, dark charcoal control-room backdrop with deep red ON-AIR glow, head-and-shoulders, facing camera with attitude, rich warm skin tones, NO text, NO logos, no purple anywhere'
const PROMPTS = {
  'marcus-blaze': `Animated talk-show host portrait: big charismatic Black American man in his thirties, athletic build, short beard, mid-shout with a huge grin and pointed finger, wearing a sharp open-collar blazer, explosive sports-debate energy. ${STYLE}`,
  'tasha-raw': `Animated talk-show host portrait: effortlessly cool Black American woman in her late twenties, sleek hair, knowing smirk, one eyebrow raised, hoop earrings, stylish streetwear jacket, holding court with quiet menace. ${STYLE}`,
  'king-knowledge': `Animated talk-show host portrait: distinguished older Black American man in his late fifties, gray-flecked beard, calm heavy-lidded wise eyes, flat cap and cardigan, barbershop-elder gravitas, slight knowing smile. ${STYLE}`,
}

const api = (p, opts = {}) => fetch(BASE + '/api/v2' + p, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY, ...(opts.headers || {}) } }).then(r => r.json())
const findUrl = o => { let hit = null; JSON.stringify(o, (k, v) => { if (!hit && typeof v === 'string' && /^https?:\/\/.*\.(png|jpg|jpeg|webp)/i.test(v)) hit = v; return v }); return hit }

async function poll(jobId) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const j = await api('/jobs/' + jobId)
    const status = j?.data?.status || j?.status
    if (/succeed|complete|done/i.test(String(status))) return findUrl(j)
    if (/fail|error|cancel/i.test(String(status))) throw new Error('job ' + status + ': ' + JSON.stringify(j).slice(0, 150))
    process.stderr.write('.')
  }
  throw new Error('poll timeout')
}

const only = process.argv[2]
const main = async () => {
  for (const [id, prompt] of Object.entries(PROMPTS)) {
    if (only && id !== only) continue
    const out = path.join(IMGDIR, id + '.png')
    if (!only && fs.existsSync(out)) { console.error(`${id}: exists, skip`); continue }
    console.error(`generating ${id}...`)
    const r = await api('/images/generate', { method: 'POST', body: JSON.stringify({ model: 'nano-banana-2', prompt, aspect_ratio: '1:1' }) })
    if (!r?.success) { console.error(`${id} FAIL: ${JSON.stringify(r).slice(0, 200)}`); continue }
    const url = findUrl(r) || await poll(r.data.job_id)
    if (!url) { console.error(`${id}: no image url`); continue }
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
    fs.writeFileSync(out, buf)
    console.error(`\n${id}.png ${(buf.length / 1024).toFixed(0)}KB`)
  }
  console.log(IMGDIR)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
