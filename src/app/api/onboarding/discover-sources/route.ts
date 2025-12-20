/**
 * Source Discovery API
 *
 * POST /api/onboarding/discover-sources
 *
 * Searches for potential sources (YouTube channels) matching a niche.
 * Returns suggestions that can be added to the topic.
 *
 * Body:
 * - topic_id: string (optional) - For context
 * - search_terms: string[] (required) - Terms to search for
 * - platform: string (default 'youtube') - Currently only youtube supported
 * - max_results: number (default 10) - Max channels to return
 */

import { NextRequest, NextResponse } from 'next/server'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

interface ChannelSuggestion {
  channel_id: string
  channel_name: string
  description: string
  subscriber_count?: string
  video_count?: string
  thumbnail_url?: string
  url: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      topic_id,
      search_terms,
      platform = 'youtube',
      max_results = 10
    } = body

    if (!search_terms || !Array.isArray(search_terms) || search_terms.length === 0) {
      return NextResponse.json({ error: 'search_terms array is required' }, { status: 400 })
    }

    if (platform !== 'youtube') {
      return NextResponse.json({ error: 'Only youtube platform is currently supported' }, { status: 400 })
    }

    const suggestions: ChannelSuggestion[] = []
    const seenChannels = new Set<string>()

    // Search for each term
    for (const term of search_terms) {
      const channels = await searchYouTubeChannels(term, Math.ceil(max_results / search_terms.length))

      for (const channel of channels) {
        if (!seenChannels.has(channel.channel_id)) {
          seenChannels.add(channel.channel_id)
          suggestions.push(channel)
        }
      }

      if (suggestions.length >= max_results) break
    }

    return NextResponse.json({
      success: true,
      topic_id,
      search_terms,
      platform,
      suggestions_count: suggestions.length,
      suggestions: suggestions.slice(0, max_results),
      add_channel_example: {
        endpoint: topic_id ? `POST /api/topics/${topic_id}/youtube` : 'POST /api/topics/{topic_id}/youtube',
        body: {
          channel_name: suggestions[0]?.channel_name || 'Channel Name',
          channel_id: suggestions[0]?.channel_id || 'UCxxxxxxxxx'
        }
      }
    })
  } catch (error) {
    console.error('Discover sources error:', error)
    return NextResponse.json({
      error: 'Failed to discover sources',
      details: String(error)
    }, { status: 500 })
  }
}

/**
 * Search YouTube for channels matching a query
 */
async function searchYouTubeChannels(query: string, maxResults: number = 10): Promise<ChannelSuggestion[]> {
  try {
    // Search for channels
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=${encodeURIComponent(query)}&type=channel&part=snippet&maxResults=${maxResults}`

    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json()

    if (!searchData.items) {
      return []
    }

    // Get channel details for subscriber counts
    const channelIds = searchData.items.map((item: any) => item.id.channelId).join(',')
    const statsUrl = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&id=${channelIds}&part=statistics,snippet`

    const statsRes = await fetch(statsUrl)
    const statsData = await statsRes.json()

    const statsMap = new Map<string, any>()
    for (const channel of statsData.items || []) {
      statsMap.set(channel.id, channel)
    }

    return searchData.items.map((item: any) => {
      const stats = statsMap.get(item.id.channelId)
      return {
        channel_id: item.id.channelId,
        channel_name: item.snippet.title,
        description: item.snippet.description?.substring(0, 200) || '',
        subscriber_count: stats?.statistics?.subscriberCount ? formatCount(stats.statistics.subscriberCount) : 'N/A',
        video_count: stats?.statistics?.videoCount || 'N/A',
        thumbnail_url: item.snippet.thumbnails?.default?.url,
        url: `https://youtube.com/channel/${item.id.channelId}`
      }
    })
  } catch (error) {
    console.error('YouTube channel search error:', error)
    return []
  }
}

function formatCount(count: string): string {
  const num = parseInt(count)
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return count
}
