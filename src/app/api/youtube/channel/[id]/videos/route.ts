/**
 * YouTube Channel Videos API
 *
 * GET /api/youtube/channel/[id]/videos
 *
 * Fetches recent videos from a YouTube channel.
 * Supports filtering by time window (hours back).
 *
 * Query params:
 * - hoursBack: number (default 48) - Only return videos from last N hours
 * - maxResults: number (default 10) - Max videos to return
 * - includeDetails: boolean (default true) - Include view counts, etc
 */

import { NextRequest, NextResponse } from 'next/server'
import { getYouTubeClient, YouTubeVideo } from '@/lib/youtube-api'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: channelId } = await params
  const searchParams = request.nextUrl.searchParams

  const hoursBack = parseInt(searchParams.get('hoursBack') || '48')
  const maxResults = parseInt(searchParams.get('maxResults') || '10')
  const includeDetails = searchParams.get('includeDetails') !== 'false'

  try {
    const youtube = getYouTubeClient()
    const publishedAfter = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

    // Get recent videos from channel
    const videos = await youtube.getChannelVideos(channelId, {
      maxResults,
      publishedAfter
    })

    // If includeDetails is true, the getChannelVideos already fetches full details
    // Otherwise, strip to basics
    const result = includeDetails
      ? videos
      : videos.map(v => ({
          id: v.id,
          title: v.title,
          publishedAt: v.publishedAt,
          channelTitle: v.channelTitle
        }))

    return NextResponse.json({
      channel_id: channelId,
      hours_back: hoursBack,
      video_count: result.length,
      videos: result,
      fetched_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching channel videos:', error)
    return NextResponse.json({
      error: 'Failed to fetch channel videos',
      details: String(error)
    }, { status: 500 })
  }
}
