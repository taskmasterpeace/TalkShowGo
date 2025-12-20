import { NextRequest, NextResponse } from 'next/server'
import { getYouTubeClient } from '@/lib/youtube-api'

/**
 * POST /api/youtube/search
 *
 * Search YouTube for battle rap content
 * Cost: ~100 units per search (10,000 free/day)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      query,
      type = 'any',      // battle, reaction, interview, prediction, any
      maxResults = 10,
      recentDays,
      pageToken,
    } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const youtube = getYouTubeClient()
    const results = await youtube.searchBattleRapContent(query, {
      type,
      maxResults,
      recentDays,
    })

    // Get full video details (view counts, etc.)
    const videoIds = results.videos.map(v => v.id)
    const detailedVideos = videoIds.length > 0
      ? await youtube.getVideoDetails(videoIds)
      : []

    return NextResponse.json({
      query,
      type,
      videos: detailedVideos,
      totalResults: results.totalResults,
      nextPageToken: results.nextPageToken,
    })
  } catch (error) {
    console.error('YouTube search error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/youtube/search?q=xxx
 *
 * Quick search endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const maxResults = parseInt(searchParams.get('max') || '10')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter q is required' },
        { status: 400 }
      )
    }

    const youtube = getYouTubeClient()
    const results = await youtube.searchBattleRapContent(query, { maxResults })

    return NextResponse.json({
      query,
      videos: results.videos,
      totalResults: results.totalResults,
    })
  } catch (error) {
    console.error('YouTube search error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
