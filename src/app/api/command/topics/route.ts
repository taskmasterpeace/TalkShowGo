import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { appendLog, logTimer } from '@/lib/command/log'

export const runtime = 'nodejs'
export const maxDuration = 300
const ROOT = process.cwd()
const OLLAMA = process.env.ENGINE_OLLAMA_URL || 'http://192.168.1.249:11434'

/** POST {file?} — THE TOPIC MINER (stage 2 of PROCESS), PER SHOW.
 *  Mines the latest pull report FOR THE GIVEN BEAT ONLY (no cross-show bleed):
 *  cross-source OVERLAP = the story; non-overlap = follow-ups/smalltalk. Free, cupcake qwen3:30b. */
export async function POST(req: Request) {
  const { file } = await req.json().catch(() => ({} as any))
  let beatId: string | null = null
  if (file && /^[a-z0-9-]+\.json$/.test(file)) {
    try { beatId = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'beats', file), 'utf8')).id } catch {}
  }
  const pullsDir = path.join(ROOT, 'lab', 'runs')
  const allPulls = fs.existsSync(pullsDir) ? fs.readdirSync(pullsDir).filter(f => f.startsWith('pull_')).sort().reverse() : []
  const pulls = allPulls.filter(f => {
    if (!beatId) return true
    try { return JSON.parse(fs.readFileSync(path.join(pullsDir, f), 'utf8')).beat === beatId } catch { return false }
  })
  if (!pulls.length) {
    appendLog({ kind: 'topics', stage: 'load', ok: false, beat: beatId, summary: beatId ? `topics · no pull yet for ${beatId}` : 'topics · no pull report', error: 'run PULL first' })
    return NextResponse.json({ error: beatId ? `no pull yet for this show (${beatId}) - run PULL first` : 'no pull report - run PULL first' }, { status: 400 })
  }
  const report = JSON.parse(fs.readFileSync(path.join(pullsDir, pulls[0]), 'utf8'))

  const material: string[] = []
  for (const s of report.twitter || []) for (const t of s.top || []) material.push(`[X @${s.handle}] ${t.text} (♥${t.likes} rt${t.rts}) ${t.created}`)
  for (const c of report.youtube || []) for (const v of c.videos || []) material.push(`[YT ${c.channel}] "${v.title}" ${v.published}`)
  if (!material.length) {
    appendLog({ kind: 'topics', stage: 'load', ok: false, beat: report.beat || beatId, ref: pulls[0], summary: 'topics · pull report is empty', error: 'pull report is empty' })
    return NextResponse.json({ error: 'pull report is empty' }, { status: 400 })
  }

  const sys = `You are the story editor for a daily battle-rap talk show. You get today's raw feed items from trusted Twitter accounts and YouTube channels. Find THE TOPICS:
1. OVERLAP topics: the same event/story appearing across MULTIPLE sources = the day's real story. Score overlap by how many distinct sources touch it.
2. SOLO items still worth the desk: someone's birthday, a callout/tag to follow up, an announcement, someone going unusually loud or quiet.
3. For each topic: a committed, punchy title (never vague), which feed items belong to it, why it matters TODAY, and a suggested angle for the show.
Output STRICT JSON only: {"topics":[{"title":"...","overlap_sources":n,"kind":"story|follow-up|smalltalk","items":[indices],"why_today":"...","angle":"..."}],"the_lead":"title of the #1 topic and one sentence on why it leads"}`
  const user = 'TODAY\'S FEED (' + material.length + ' items, index from 0):\n' + material.map((m, i) => i + '. ' + m).join('\n')

  const topicsFile = pulls[0].replace('pull_', 'topics_')
  const t = logTimer()
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
    const out = { pulled_from: pulls[0], beat: report.beat, mined_at: new Date().toISOString(), feed_count: material.length, ...mined }
    fs.writeFileSync(path.join(pullsDir, topicsFile), JSON.stringify(out, null, 2) + '\n')
    t.done(() => {
      const topics: any[] = mined.topics || []
      const n = (k: string) => topics.filter(x => x.kind === k).length
      return {
        kind: 'topics', stage: 'mine', ok: true, beat: report.beat || beatId, ref: topicsFile,
        summary: `${topics.length} topics · ${n('story')} stories · ${n('follow-up')} follow-ups · lead: ${mined.the_lead || 'none'}`,
        meta: { pulled_from: pulls[0], feed_count: material.length, stories: n('story'), follow_ups: n('follow-up'), smalltalk: n('smalltalk'), max_overlap: Math.max(0, ...topics.map(x => Number(x.overlap_sources) || 0)), model: 'qwen3:30b' },
      }
    })
    return NextResponse.json({ ok: true, ...out })
  } catch (e: any) {
    t.done(() => ({ kind: 'topics', stage: 'mine', ok: false, beat: report.beat || beatId, ref: pulls[0], summary: `topic miner failed · ${material.length} feed items`, error: String(e?.message || e), meta: { pulled_from: pulls[0], model: 'qwen3:30b' } }))
    return NextResponse.json({ error: 'miner failed: ' + String(e?.message || e).slice(0, 150) }, { status: 502 })
  }
}
