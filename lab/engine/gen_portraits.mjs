#!/usr/bin/env node
/**
 * Generate cast/library portraits via Directors Palette API (nano-banana-2), photorealistic studio white-background.
 * Prompts are DATA: lab/cast/images/portraits.json ({ _style, subjects: { id: { name, subject } } }); prompt = subject + _style.
 * Law (aiobr DP playbook): NEVER set reference_tag/reference_category on scene gens.
 * Usage: node lab/engine/gen_portraits.mjs [id]     (no id = every subject missing on disk; an id = force that one)
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const AENV = (() => { try { return fs.readFileSync('D:/git/aiobr/.env', 'utf8') } catch { console.error('gen_portraits needs DP keys from D:/git/aiobr/.env (not found on this machine) - set DP_API_KEY/DP_BASE_URL in this repo\'s .env instead'); return (() => { try { return fs.readFileSync(path.join(ROOT, '.env'), 'utf8') } catch { return '' } })() } })()
const KEY = (AENV.match(/^DP_API_KEY=(.+)$/m) || [])[1]
const BASE = ((AENV.match(/^DP_BASE_URL=(.+)$/m) || [])[1] || '').replace(/\/$/, '')
if (!KEY || !BASE) { console.error('no DP creds in aiobr .env'); process.exit(1) }
const IMGDIR = path.join(ROOT, 'lab', 'cast', 'images')
fs.mkdirSync(IMGDIR, { recursive: true })

const spec = JSON.parse(fs.readFileSync(path.join(IMGDIR, 'portraits.json'), 'utf8'))
const STYLE = spec._style
const SUBJECTS = spec.subjects || {}

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
  const ids = only ? [only] : Object.keys(SUBJECTS)
  for (const id of ids) {
    const s = SUBJECTS[id]
    if (!s) { console.error(`${id}: not in portraits.json`); continue }
    const out = path.join(IMGDIR, id + '.png')
    if (!only && fs.existsSync(out)) { console.error(`${id}: exists, skip`); continue }
    const prompt = `${s.subject}. ${STYLE}`
    console.error(`generating ${id} (${s.name})...`)
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
