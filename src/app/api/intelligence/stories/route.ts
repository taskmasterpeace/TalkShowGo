/**
 * Stories API
 *
 * GET /api/intelligence/stories
 *
 * Get all detected stories for a topic.
 *
 * Query params:
 * - topic_id: string (required)
 * - status: string (default 'active') - Filter by status
 * - limit: number (default 20)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStories } from '@/lib/intelligence-framework'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const topic_id = searchParams.get('topic_id')
  const status = searchParams.get('status') || 'active'
  const limit = parseInt(searchParams.get('limit') || '20')

  if (!topic_id) {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }

  try {
    const stories = await getStories(topic_id, { status, limit })

    return NextResponse.json({
      topic_id,
      story_count: stories.length,
      stories: stories.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        source_count: s.source_count,
        key_entities: s.key_entities,
        keywords: s.keywords,
        sources: s.sources.slice(0, 5).map(src => ({
          title: src.title,
          channel: src.channel_name,
          url: src.url,
          published: src.published_at
        }))
      }))
    })
  } catch (error) {
    console.error('Get stories error:', error)
    return NextResponse.json({
      error: 'Failed to get stories',
      details: String(error)
    }, { status: 500 })
  }
}
