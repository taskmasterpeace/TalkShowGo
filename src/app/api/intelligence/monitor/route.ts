/**
 * MONITOR Mode API
 *
 * POST /api/intelligence/monitor
 *
 * Sweeps all trusted sources for a topic, detects patterns/stories.
 * Use this for daily monitoring - "What's happening NOW?"
 *
 * Body:
 * - topic_id: string (required)
 * - hours_back: number (default 48) - How far back to look
 * - min_sources: number (default 2) - Minimum sources to detect a story
 */

import { NextRequest, NextResponse } from 'next/server'
import { runMonitor } from '@/lib/intelligence-framework'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic_id, hours_back = 48, min_sources = 2 } = body

    if (!topic_id) {
      return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
    }

    const result = await runMonitor({
      topic_id,
      hours_back,
      min_sources
    })

    return NextResponse.json({
      success: true,
      run_id: result.run_id,
      summary: {
        videos_found: result.videos_found,
        stories_detected: result.stories_detected.length
      },
      stories: result.stories_detected.map(s => ({
        name: s.name,
        type: s.type,
        source_count: s.source_count,
        key_entities: s.key_entities,
        latest_video: s.sources[0]?.title,
        latest_channel: s.sources[0]?.channel_name
      })),
      raw_videos: result.raw_videos.map(v => ({
        title: v.title,
        channel: v.channel_name,
        published: v.published_at,
        url: v.url
      }))
    })
  } catch (error) {
    console.error('Monitor error:', error)
    return NextResponse.json({
      error: 'Monitor failed',
      details: String(error)
    }, { status: 500 })
  }
}
