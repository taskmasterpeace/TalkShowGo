import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** GET /api/command — the solidified API index. Every control-plane endpoint, its shape, and its status. */
export async function GET() {
  return NextResponse.json({
    name: 'TSG COMMAND API',
    version: 2,
    endpoints: [
      { method: 'GET', path: '/api/command/state', body: null, does: 'full control-room state: beats, cast, voices, images, audio+manifest, engine runs, pulls, mined topics, show_types, health lamps', status: 'live' },
      { method: 'PUT', path: '/api/command/beat', body: '{file, beat}', does: 'write a beat json (sources CRUD, show identity, timespan, show_type)', status: 'live' },
      { method: 'PUT', path: '/api/command/cast', body: '{cast}', does: 'write cast.json (host bundles, producer, knobs, personas)', status: 'live' },
      { method: 'POST', path: '/api/command/verify', body: '{file}', does: 'twitter source-verify: handle->userId, followers, squatter detection', status: 'live' },
      { method: 'POST', path: '/api/command/youtube', body: "{file, action:'resolve'}", does: 'resolve channel names -> channel_ids via youtubei.js', status: 'live' },
      { method: 'POST', path: '/api/command/process', body: '{file}', does: 'STAGE 1 PULL: twitter last-tweets by userId + youtube channel RSS, within beat timespan -> lab/runs/pull_*.json', status: 'live' },
      { method: 'POST', path: '/api/command/topics', body: '{}', does: 'STAGE 2 TOPIC MINER: overlap detection + follow-ups across the latest pull (cupcake qwen3:30b, free)', status: 'live' },
      { method: 'POST', path: '/api/command/transcript', body: '{video_id}', does: 'full YouTube transcript via yt-dlp (the deep-dive leg)', status: 'live' },
      { method: 'POST', path: '/api/command/voice', body: "{host, action:'design', aesthetic, ref_text?, seed?} OR multipart {host, ref_text, file.wav}", does: 'design a locked Breeze ref from a description (CFG 4.0 law) or upload your own reference voice', status: 'live' },
      { method: 'GET', path: '/api/command/audio/{audio|voices|images}/<file>', body: null, does: 'serve rendered mp3s, cast ref wavs, cast portraits', status: 'live' },
      { method: 'POST', path: '(next) /api/command/showplan', body: '{file}', does: 'STAGE 3: Showrunner turns mined topics into a beat sheet per the selected show_type', status: 'wire-up next' },
      { method: 'POST', path: '(next) /api/command/floor', body: '{showplan}', does: 'STAGE 4: actor-loop floor -> MIX -> segment (engine exists at lab/engine/run_floor.mjs)', status: 'engine ready' },
      { method: 'POST', path: '(next) /api/command/render', body: '{segment}', does: 'STAGE 5: Breeze per-turn render (engine exists at lab/engine/render_breeze.mjs)', status: 'engine ready' },
    ],
    engines: {
      floor: 'lab/engine/run_floor.mjs (actor loop, waypoints, guards)',
      voice: 'lab/engine/render_breeze.mjs (breeze-tts-2 skill: cfg 1.0/4.0 law, seed ledger)',
      portraits: 'lab/engine/gen_portraits.mjs (Directors Palette, no reference_tag law)',
      verify: 'lab/engine/verify_sources.mjs',
      fingerprint: 'lab/engine/fingerprint.mjs (realism gate)',
    },
  })
}
