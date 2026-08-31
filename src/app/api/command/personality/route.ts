import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const maxDuration = 300
const ROOT = process.cwd()
const OLLAMA = process.env.ENGINE_OLLAMA_URL || 'http://192.168.1.249:11434'
const GDIR = path.join(ROOT, 'lab', 'cast', 'guests')

/** POST {name, description} — GENERATE a full Personality Print v4 for a guest (free, cupcake qwen3:30b).
 *  Existing cast contrast cards are passed as constraints so every guest lands DISTINCT by construction.
 *  DELETE {id} — remove a guest. */
export async function POST(req: Request) {
  const { name, description } = await req.json()
  if (!name || !description) return NextResponse.json({ error: 'need name + description' }, { status: 400 })
  const cast = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'cast', 'cast.json'), 'utf8'))
  const existing = cast.hosts.map((h: any) => `${h.name}: ${h.print?.essence || ''} (notices first: ${h.print?.processing?.notices_first || '?'})`).join('\n')

  const sys = `You build PERSONALITY PRINT v4 profiles for AI talk-show guests. A print is DETAILED and OPERATIONAL - every field changes how the character talks or thinks. The guest must be UNMISTAKABLY DISTINCT from the existing cast:\n${existing}\n
Output STRICT JSON exactly in this shape (all fields required, be specific and vivid, no generic filler):
{"print":{"essence":"2 lines - who this is on the mic","speech":{"tone":"","pace":"","register":"","sentence_shape":"","delivery_habits":""},"processing":{"notices_first":"","reasons_by":"","convinced_by":"","dismisses":"","blind_spot":"","mind_change":""},"argument":{"attack":"","questions":"","concession":"","verdict":""},"emotion":{"default":"","heat_curve":"","humor":"","signature_flip":""},"knowledge":{"deep":"","eras":"","reaches_for":""},"lexicon":{"registers":[],"metaphor_pools":[],"motifs":[],"banned":[]},"things_they_say":{"signature_lines":["8 lines in THEIR voice"],"moves":{"opener":"","comeback":"","concession":""}},"contrast":{"vs_cast":"one line: how they can never be confused with the existing hosts"},"drives":{"wants":"","self_view":""}},"voice":{"aesthetic":"Breeze voice-design prompt: gender/age, role, pitch+timbre, texture, accent, pace, dynamics, personality, ALWAYS ending with: clear, close-mic studio quality","default_instruction":"3-6 word default delivery","emotion_map":{"state1":"instruction","state2":"instruction","state3":"instruction"},"nonverbal_habits":"which of (laugh)/(sigh)/(clears throat)/(cough) they use and when"},"behavior":{"verbosity":0.5,"filler_rate":0.3,"interruption_rate":0.4,"backchannel_rate":0.3},"catchphrase_rare":["one phrase"]}`
  const user = `GUEST NAME: ${name}\nDESCRIPTION: ${description}\nBuild the full print. JSON only.`

  try {
    const r = await fetch(OLLAMA + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3:30b', stream: false, think: false, format: 'json', messages: [{ role: 'system', content: sys + '\n/no_think' }, { role: 'user', content: user }], options: { temperature: 0.8, num_predict: 3200 } }),
      signal: AbortSignal.timeout(280000),
    })
    if (!r.ok) throw new Error('ollama ' + r.status)
    const content = (await r.json()).message.content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*?<\/think>\s*/, '')
    const g = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}')
    if (!g.print?.essence) throw new Error('generator returned no essence')
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const guest = { id: slug, name, role: 'guest', persona_version: 1, created: new Date().toISOString().slice(0, 10), source_description: description, model: { provider: 'requesty', id: 'anthropic/claude-sonnet-5', temperature: 0.85 }, ...g, voice: { engine: 'breeze-tts-2 (see skill)', seed: 1000 + Math.floor(Math.random() * 9000), ...g.voice } }
    fs.mkdirSync(GDIR, { recursive: true })
    fs.writeFileSync(path.join(GDIR, slug + '.json'), JSON.stringify(guest, null, 2) + '\n')
    return NextResponse.json({ ok: true, guest })
  } catch (e: any) {
    return NextResponse.json({ error: 'generator failed: ' + String(e?.message || e).slice(0, 150) }, { status: 502 })
  }
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!/^[a-z0-9-]+$/.test(id || '')) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  const p = path.join(GDIR, id + '.json')
  if (fs.existsSync(p)) fs.unlinkSync(p)
  return NextResponse.json({ ok: true })
}
