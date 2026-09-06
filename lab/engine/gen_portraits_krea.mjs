#!/usr/bin/env node
/**
 * Cast/library portraits via KREA 2 on the cupcake mk-gateway (Robert 2026-09-02: no DP - Krea 2 on cupcake).
 * Text-to-image (no face ref): POST /v1/image {engine:'krea', prompt, negative_prompt, width, height, seed}
 *   -> {job_id} -> poll GET /v1/jobs/{id} -> GET /v1/jobs/{id}/result (image bytes).
 * Prompts are DATA: lab/cast/images/portraits.json ({_style, subjects:{id:{name,subject}}}).
 * THREE variations per subject (distinct seeds) -> lab/cast/images/<id>_1.png .._2 .._3. Resumable: skips existing.
 * Usage: node lab/engine/gen_portraits_krea.mjs [id]   (no id = whole roster; an id = just that subject)
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readKey = name => { const e = process.env[name]; if (e && e.trim()) return e.trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch {} try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v && String(v).trim()) return String(v).trim() } catch {} return undefined }
const KEY = readKey('CUPCAKE_GATEWAY_KEY')
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'
const IMGDIR = path.join(ROOT, 'lab', 'cast', 'images')
const spec = JSON.parse(fs.readFileSync(path.join(IMGDIR, 'portraits.json'), 'utf8'))
const STYLE = spec._style, SUBJECTS = spec.subjects || {}
const VARIATIONS = spec._variations || ['', '', '']
const SEEDS = spec._seeds || [1111, 2222, 3333]
const TRIGGER = spec._trigger || ''
const LORAS = (spec._loras || []).slice(0, 4)
const NEG = 'black and white, monochrome, grayscale, desaturated, sepia, text, watermark, logo, caption, deformed hands, extra fingers, extra limbs, duplicate, two people, multiple people, blurry, low quality, cartoon, anime, illustration, drawing, 3d render, cgi, disfigured, distorted face, microphone'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }

async function submit(prompt, seed) {
  for (let busy = 0; ;) {
    const res = await fetch(GW + '/v1/image', { method: 'POST', headers: H, body: JSON.stringify({ engine: 'krea', prompt, negative_prompt: NEG, width: 1024, height: 1024, seed, ...(LORAS.length ? { loras: LORAS } : {}) }) })
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
  fs.mkdirSync(IMGDIR, { recursive: true })
  const ids = only ? [only] : Object.keys(SUBJECTS)
  for (const id of ids) {
    const s = SUBJECTS[id]; if (!s) { console.error(`${id}: not in portraits.json`); continue }
    for (let v = 0; v < SEEDS.length; v++) {
      const out = path.join(IMGDIR, `${id}_${v + 1}.png`)
      if (fs.existsSync(out)) { console.error(`${id}_${v + 1}: exists, skip`); continue }
      const prompt = [TRIGGER, s.subject, VARIATIONS[v], STYLE].filter(Boolean).join('. ')
      console.error(`krea ${id} v${v + 1} (${s.name}, seed ${SEEDS[v]})...`)
      try {
        const jid = await submit(prompt, SEEDS[v])
        await waitResult(jid, out)
        console.error(`  saved ${id}_${v + 1}.png ${(fs.statSync(out).size / 1024).toFixed(0)}KB`)
      } catch (e) { console.error(`  ${id}_${v + 1} FAIL: ${e.message}`) }
    }
  }
  console.log(IMGDIR)
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
