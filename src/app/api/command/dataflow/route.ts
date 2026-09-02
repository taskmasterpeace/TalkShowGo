import { NextResponse } from 'next/server'
import { buildJourney, traceStory } from '@/lib/command/dataflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET ?beat=&pull=&story= — HOW THE DATA TRAVELS. One pull's journey through the loop
 *  (pull -> cluster -> leads -> rank -> dossiers -> briefings -> stances -> shows) with real counts,
 *  samples, cross-stage edges and log timings. `pull` names a lab/runs/pull_*.json (default: the
 *  beat's newest); `story` narrows the whole journey to one ranked story's lineage. */
export function GET(req: Request) {
  try {
    const u = new URL(req.url)
    const beat = (u.searchParams.get('beat') || '').trim().slice(0, 80) || undefined
    const pullRaw = (u.searchParams.get('pull') || '').trim()
    if (pullRaw && !/^pull_[\w:.-]+\.json$/.test(pullRaw)) return NextResponse.json({ ok: false, error: 'pull must name a lab/runs/pull_*.json file', stage: 'validate' }, { status: 400 })
    const story = (u.searchParams.get('story') || '').trim().slice(0, 300)
    const opts = { beat, pull: pullRaw || undefined }
    const journey = story ? traceStory(story, opts) : buildJourney(opts)
    return NextResponse.json({ ok: true, journey })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'dataflow failed: ' + String(e?.message || e).slice(0, 160), stage: 'build' }, { status: 500 })
  }
}
