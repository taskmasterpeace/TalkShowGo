import { NextRequest, NextResponse } from 'next/server'
import { getTwitterClient } from '@/lib/twitter-api'

/**
 * GET /api/twitter/timeline?username=xxx
 *
 * Get user's recent tweets
 * Cost: ~$0.15 per 1K tweets
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const cursor = searchParams.get('cursor') || undefined

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    const twitter = getTwitterClient()
    const timeline = await twitter.getUserTimeline(username, cursor)

    return NextResponse.json({
      username,
      tweets: timeline.tweets,
      cursor: timeline.cursor,
      hasMore: timeline.hasMore,
      count: timeline.tweets.length,
    })
  } catch (error) {
    console.error('Twitter timeline error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
