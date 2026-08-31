import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const maxDuration = 300
const ROOT = process.cwd()
const OLLAMA = process.env.ENGINE_OLLAMA_URL || 'http://192.168.1.249:11434'

/** POST {} — THE TOPIC MINER (stage 2 of PROCESS).
 *  Reads the latest pull report, finds the topics: cross-source OVERLAP (the story),
 *  plus non-overlap follow-ups (birthdays, tags, someone going quiet-loud). Free, on cupcake qwen3:30b. */
export async function POST() {
  const pullsDir = path.join(ROOT, 'lab', 'runs')
  const pulls = fs.existsSync(pullsDir) ? fs.readdirSync(pullsDir).filter(f => f.startsWith('pull_')).sort().reverse() : []
  if (!pulls.length) return NextResponse.json({ error: 'no pull report - run PULL first' }, { status: 400 })
  const report = JSON.parse(fs.readFileSync(path.join(pullsDir, pulls[0]), 'utf8'))

  const material: string[] = []
  for (const s of report.twitter || []) for (const t of s.top || []) material.push(`[X @${s.handle}] ${t.text} (♥${t.likes} rt${t.rts}) ${t.created}`)
  for (const c of report.youtube || []) for (const v of c.videos || []) material.push(`[YT ${c.channel}] "${v.title}" ${v.published}`)
  if (!material.length) return NextResponse.json({ error: 'pull report is empty' }, { status: 400 })

  const sys = `You are the story editor for a daily battle-rap talk show. You get today's raw feed items from trusted Twitter accounts and YouTube channels. Find THE TOPICS:
1. OVERLAP topics: the same event/story appearing across MULTIPLE sources = the day's real story. Score overlap by how many distinct sources touch it.
2. SOLO items still worth the desk: someone's birthday, a callout/tag to follow up, an announcement, someone going unusually loud or quiet.
3. For each topic: a committed, punchy title (never vague), which feed items belong to it, why it matters TODAY, and a suggested angle for the show.
Output STRICT JSON only: {"topics":[{"title":"...","overlap_sources":n,"kind":"story|follow-up|smalltalk","items":[indices],"why_today":"...","angle":"..."}],"the_lead":"title of the #1 topic and one sentence on why it leads"}`
  const user = 'TODAY\'S FEED (' + material.length + ' items, index from 0):\n' + material.map((m, i) => i + '. ' + m).join('\n')

  try {
    const r = await fetch(OLLAMA + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3:30b', stream: false, think: false, format: 'json', messages: [{ role: 'system', content: sys + '\n/no_think' }, { role: 'user', content: user }], options: { temperature: 0.4, num_predict: 1600 } }),
      signal: AbortSignal.timeout(280000),
    })
    if (!r.ok) throw new Error('ollama ' + r.status)
    let content = (await r.json()).message.content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*?<\/think>\s*/, '')
    const mined = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}')
    // join item texts back in for the UI
    for (const t of mined.topics || []) t.evidence = (t.items || []).map((i: number) => material[i]).filter(Boolean)
    const out = { pulled_from: pulls[0], mined_at: new Date().toISOString(), feed_count: material.length, ...mined }
    fs.writeFileSync(path.join(pullsDir, pulls[0].replace('pull_', 'topics_')), JSON.stringify(out, null, 2) + '\n')
    return NextResponse.json({ ok: true, ...out })
  } catch (e: any) {
    return NextResponse.json({ error: 'miner failed: ' + String(e?.message || e).slice(0, 150) }, { status: 502 })
  }
}
