#!/usr/bin/env node
/**
 * Talk-show LOGO generator via KREA 2 on the cupcake mk-gateway (free, in-house - the same engine that
 * made the cast; Robert 2026-09-03: NOT Director's Palette). It ANALYZES the show (name + tagline +
 * show_type from its beat) and writes its own prompt, so any show makes a logo with no hand-authored
 * prompt. 3 candidates per show. Every logo is saved on its color AND as a TRANSPARENT cutout
 * (_alpha.png, via ffmpeg colorkey on the flat background) so it drops over any thumbnail.
 *
 *   POST /v1/image {engine:'krea', prompt, negative_prompt, width, height, seed} -> {job_id}
 *     -> poll GET /v1/jobs/{id} -> GET /v1/jobs/{id}/result (png bytes)
 *
 * Config: lab/branding/logos.json ({_style,_seeds,_neg, shows:{slug:{beat?, name?, tagline?, show_type?, prompt?}}}).
 * A show with a `prompt` uses it verbatim; otherwise the prompt is ANALYZED from name/tagline/show_type
 * (pulled from lab/beats/<beat>.json when only `beat` is given).
 * Usage: node lab/engine/gen_logo.mjs [slug]   (no slug = every show; a slug = just that one)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const readKey = name => { const e = process.env[name]; if (e && e.trim()) return e.trim(); try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) return m[1].trim() } catch {} try { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'settings', 'keys.json'), 'utf8'))[name]; if (v && String(v).trim()) return String(v).trim() } catch {} return undefined }
const KEY = readKey('CUPCAKE_GATEWAY_KEY')
const GW = process.env.CUPCAKE_GATEWAY_URL || 'http://192.168.1.249:8700'
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const BRAND = path.join(ROOT, 'lab', 'branding')
const OUTDIR = path.join(BRAND, 'logos')
const spec = JSON.parse(fs.readFileSync(path.join(BRAND, 'logos.json'), 'utf8'))
const STYLE = spec._style || ''
const SEEDS = spec._seeds || [7001, 7002, 7003]
const NEG = spec._neg || 'photorealistic, cluttered, gibberish text, blurry, low quality, purple, violet'
const SHOWS = spec.shows || {}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }

// --- ANALYZE the show -> a tailored logo prompt (Robert: "it should analyze the type of show it is"). ---
function analyze(name, tagline, showType) {
  const short = String(name || 'THE SHOW').replace(/\s+/g, ' ').trim()
  const hay = `${short} ${tagline || ''} ${showType || ''}`.toLowerCase()
  let kind, emblem, palette, energy
  if (/sport|huddle|field|team|game|arena|stadium|fieldhouse|pacer|falcon/.test(hay)) {
    kind = 'daily sports talk show'; emblem = 'a simple bold sports emblem (a broadcast microphone or a ball)'; palette = 'warm gold and deep charcoal with a single punch of red'; energy = 'athletic, high-energy, broadcast-desk'
  } else if (/battle ?rap|algorithm|cypher|bars|emcee/.test(hay)) {
    kind = 'hip-hop culture and battle-rap news desk'; emblem = 'a bold street emblem (a microphone or a crown)'; palette = 'gold and near-black with a punch of red'; energy = 'gritty, confident, street-authoritative'
  } else if (/kid|kids/.test(hay)) {
    kind = 'fun kids news show'; emblem = 'a friendly rounded emblem (a star or a smiling microphone)'; palette = 'bright cheerful gold, teal and warm orange, never purple'; energy = 'playful, warm, rounded and friendly'
  } else if (/debate|take|head to head|versus| vs |collision/.test(hay)) {
    kind = 'bold daily debate show'; emblem = 'a split or two-opposing-arrows emblem'; palette = 'high-contrast gold and deep charcoal with red'; energy = 'confrontational, high-contrast, bold'
  } else if (/news|history|receipt|street|hood|report|desk|daily/.test(hay)) {
    kind = 'serious daily news-desk show'; emblem = 'a clean broadcast emblem (a desk microphone or a shield)'; palette = 'deep charcoal and gold with a restrained red accent'; energy = 'authoritative, trustworthy, editorial'
  } else {
    kind = 'daily talk show'; emblem = 'a simple confident broadcast emblem (a microphone)'; palette = 'warm gold and deep charcoal with a red accent'; energy = 'bold, clean, confident'
  }
  const longName = short.length > 16 || short.split(' ').length > 2
  const nameClause = longName
    ? `the name "${short}" in clean heavy uppercase lettering, stacked on two or three lines so every word is large and correctly spelled`
    : `the words "${short}" in big clean heavy condensed uppercase sans-serif lettering`
  return `a bold modern LOGO for a ${kind} named "${short}", ${nameClause}, ${emblem} worked in, ${energy} branding, ${palette}, flat vector, very high contrast, centered, confident and iconic`
}

// resolve a show's identity, pulling from its beat when only `beat` is given
function resolveShow(show) {
  let name = show.name, tagline = show.tagline, showType = show.show_type
  if ((!name || !tagline || !showType) && show.beat) {
    try { const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'beats', `${show.beat}.json`), 'utf8')).show || {}; name = name || b.name; tagline = tagline || b.tagline; showType = showType || b.show_type } catch {}
  }
  return { name, tagline, showType }
}

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

// TRANSPARENT cutout: sample the flat background color from a corner, key it out. ffmpeg only.
function makeAlpha(png, out) {
  const raw = execFileSync(FFMPEG, ['-v', 'error', '-i', png, '-vf', 'crop=4:4:0:0,format=rgb24', '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1e7 })
  const hex = '0x' + [raw[0], raw[1], raw[2]].map(x => x.toString(16).padStart(2, '0')).join('')
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', png, '-vf', `colorkey=${hex}:0.14:0.06,format=rgba`, out])
  return hex
}

const only = process.argv[2]
const main = async () => {
  if (!KEY) { console.error('no CUPCAKE_GATEWAY_KEY (env/.env/lab/settings/keys.json)'); process.exit(1) }
  fs.mkdirSync(OUTDIR, { recursive: true })
  const slugs = only ? [only] : Object.keys(SHOWS)
  for (const slug of slugs) {
    const show = SHOWS[slug]; if (!show) { console.error(`${slug}: not in logos.json`); continue }
    const { name, tagline, showType } = resolveShow(show)
    const prompt = show.prompt || analyze(name, tagline, showType)
    if (!show.prompt) console.error(`${slug}: analyzed as [${showType || 'talk'}] "${name}"`)
    const base = `${prompt}. ${STYLE}`
    for (let v = 0; v < SEEDS.length; v++) {
      const out = path.join(OUTDIR, `${slug}_${v + 1}.png`)
      if (!fs.existsSync(out)) {
        console.error(`${slug}_${v + 1}: submitting (seed ${SEEDS[v]})...`)
        const jid = await submit(base, SEEDS[v]); await waitResult(jid, out)
        console.error(`  saved ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)}KB)`)
      } else console.error(`${slug}_${v + 1}: exists, skip`)
      const alpha = path.join(OUTDIR, `${slug}_${v + 1}_alpha.png`)
      if (!fs.existsSync(alpha)) { try { const hex = makeAlpha(out, alpha); console.error(`  transparent -> ${path.basename(alpha)} (keyed ${hex})`) } catch (e) { console.error(`  alpha skipped: ${e.message.slice(0, 80)}`) } }
    }
  }
  console.error('done. pick a candidate into logos.json _picks.')
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1) })
