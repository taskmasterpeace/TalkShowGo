#!/usr/bin/env node
/**
 * Talk-show LOGO generator via KREA 2 on the cupcake mk-gateway (free, in-house - the same engine that
 * made the cast; Robert 2026-09-03: NOT Director's Palette). Text-to-image, flat-vector logo look (no
 * photoreal LoRA). One show -> 3 candidates -> lab/branding/logos/<slug>_1.png .._2 .._3. Resumable.
 *
 *   POST /v1/image {engine:'krea', prompt, negative_prompt, width, height, seed} -> {job_id}
 *     -> poll GET /v1/jobs/{id} -> GET /v1/jobs/{id}/result (png bytes)
 *
 * Config is DATA: lab/branding/logos.json ({_style, _seeds, _neg, shows:{slug:{name,tagline,prompt}}}).
 * Usage: node lab/engine/gen_logo.mjs [slug]   (no slug = every show in logos.json; a slug = just that one)
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const readKey = name => { const e = process.env[name]; if (e && e.trim()) return e.trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch {} try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v && String(v).trim()) return String(v).trim() } catch {} return undefined }
const KEY = readKey('CUPCAKE_GATEWAY_KEY')
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'
const BRAND = path.join(ROOT, 'lab', 'branding')
const OUTDIR = path.join(BRAND, 'logos')
const spec = JSON.parse(fs.readFileSync(path.join(BRAND, 'logos.json'), 'utf8'))
const STYLE = spec._style || ''
const SEEDS = spec._seeds || [7001, 7002, 7003]
const NEG = spec._neg || 'photorealistic, cluttered, gibberish text, blurry, low quality, purple, violet'
const SHOWS = spec.shows || {}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }

async function submit(prompt, seed) {
  for (let busy = 0; ;) {
    const res = await fetch(GW + '/v1/image', { method: 'POST', headers: H, body: JSON.stringify({ engine: 'krea', prompt, negative_prompt: NEG, width: 1024, height: 1024, seed }) })
    if (res.status === 409) { if (++busy > 20) throw new Error('box busy (409) too long'); console.error(`  busy (409) wait 60s (${busy}/20)`); await sleep(60000); continue }
    if (!res.ok) throw new Error('submit ' + res.status + ' ' + (await res.text()).slice(0, 160))
    const j = await res.json(); return j.job_id || j.id
  }
}
async function waitResult(jid, outfile) {
  for (let i = 0; i < 220; i++) {
    await sleep(4000)
    let st; try { st = await (await fetch(GW + `/v1/jobs/${jid}`, { headers: H })).json() } catch { continue }
    const s = String(st.status || st.status_str || '').toLowerCase()
    if (['error', 'failed'].includes(s)) throw new Error('job ' + s + ' ' + JSON.stringify(st).slice(0, 160))
    if (['done', 'success', 'completed', 'complete'].includes(s)) {
      const r = await fetch(GW + `/v1/jobs/${jid}/result`, { headers: H })
      if (!r.ok) throw new Error('result ' + r.status)
      fs.writeFileSync(outfile, Buffer.from(await r.arrayBuffer())); return
    }
  }
  throw new Error('poll timeout')
}

const only = process.argv[2]
const main = async () => {
  if (!KEY) { console.error('no CUPCAKE_GATEWAY_KEY (env/.env/lab/settings/keys.json)'); process.exit(1) }
  fs.mkdirSync(OUTDIR, { recursive: true })
  const slugs = only ? [only] : Object.keys(SHOWS)
  for (const slug of slugs) {
    const show = SHOWS[slug]; if (!show) { console.error(`${slug}: not in logos.json`); continue }
    const base = `${show.prompt}. ${STYLE}`
    for (let v = 0; v < SEEDS.length; v++) {
      const out = path.join(OUTDIR, `${slug}_${v + 1}.png`)
      if (fs.existsSync(out)) { console.error(`${slug}_${v + 1}: exists, skip`); continue }
      console.error(`${slug}_${v + 1}: submitting (seed ${SEEDS[v]})...`)
      const jid = await submit(base, SEEDS[v])
      await waitResult(jid, out)
      console.error(`  saved ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)}KB)`)
    }
  }
  console.error('done. pick a candidate into logos.json _picks.')
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
