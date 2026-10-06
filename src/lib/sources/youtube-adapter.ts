/**
 * YouTube Source Adapter
 *
 * Uses RSS feeds for channel monitoring (accurate timestamps)
 * Uses YouTube Data API for searches (has publishedAfter parameter)
 * Falls back to free client for transcripts and comments
 *
 * NEVER uses youtubei.js for date-sensitive operations (returns "1 year ago")
 */

import { TimeRange, isWithinTimeRange } from '../time-range'
import {
  SourceAdapter,
  SourceConfig,
  UnifiedContent,
  YouTubeVideo as UnifiedYouTubeVideo,
  youtubeToUnified,
} from './types'
import { getFreeYouTubeClient, getYouTubeClient, YouTubeVideo } from '../youtube-api'
import { parseStringPromise } from 'xml2js'

const RSS_BASE_URL = 'https://www.youtube.com/feeds/videos.xml'

interface RSSEntry {
  'yt:videoId': string[]
  'yt:channelId': string[]
  title: string[]
  author: { name: string[]; uri: string[] }[]
  published: string[]
  updated: string[]
  'media:group': {
    'media:title': string[]
    'media:content': { $: { url: string; width: string; height: string } }[]
    'media:thumbnail': { $: { url: string; width: string; height: string } }[]
    'media:description': string[]
    'media:community': {
      'media:starRating': { $: { count: string; average: string } }[]
      'media:statistics': { $: { views: string } }[]
    }[]
  }[]
}

interface RSSFeed {
  feed: {
    title: string[]
    author: { name: string[]; uri: string[] }[]
    entry?: RSSEntry[]
  }
}

/**
 * Fetch videos from a YouTube channel using RSS feed
 * Returns videos with ACCURATE ISO timestamps
 */
export async function fetchChannelRSS(channelId: string): Promise<UnifiedYouTubeVideo[]> {
  const url = `${RSS_BASE_URL}?channel_id=${channelId}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ContentKingdom/1.0)',
      },
    })

    if (!response.ok) {
      console.error(`[YouTube RSS] Failed to fetch ${channelId}: ${response.status}`)
      return []
    }

    const xml = await response.text()
    const parsed: RSSFeed = await parseStringPromise(xml)

    if (!parsed.feed?.entry) {
      return []
    }

    const channelName = parsed.feed.author?.[0]?.name?.[0] || 'Unknown Channel'

    return parsed.feed.entry.map((entry): UnifiedYouTubeVideo => {
      const videoId = entry['yt:videoId'][0]
      const mediaGroup = entry['media:group']?.[0]
      const community = mediaGroup?.['media:community']?.[0]

      return {
        id: videoId,
        title: entry.title[0],
        channel_id: channelId,
        channel_name: channelName,
        published_at: new Date(entry.published[0]), // ACCURATE ISO timestamp!
        description: mediaGroup?.['media:description']?.[0] || '',
        thumbnail_url: mediaGroup?.['media:thumbnail']?.[0]?.$?.url || '',
        view_count: parseInt(community?.['media:statistics']?.[0]?.$?.views || '0'),
      }
    })
  } catch (error) {
    console.error(`[YouTube RSS] Error fetching ${channelId}:`, error)
    return []
  }
}

/**
 * Fetch videos from multiple channels via RSS
 */
export async function fetchMultipleChannelsRSS(
  channelIds: string[],
  timeRange: TimeRange
): Promise<UnifiedYouTubeVideo[]> {
  const results = await Promise.allSettled(
    channelIds.map((id) => fetchChannelRSS(id))
  )

  const allVideos: UnifiedYouTubeVideo[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      // Filter by time range
      const filtered = result.value.filter((v) =>
        isWithinTimeRange(v.published_at, timeRange)
      )
      allVideos.push(...filtered)
    }
  }

  // Sort by date (newest first)
  allVideos.sort((a, b) => b.published_at.getTime() - a.published_at.getTime())

  return allVideos
}

/**
 * Search YouTube with date filtering using official API
 * Only works if YOUTUBE_API_KEY is configured
 */
export async function searchYouTubeWithDateFilter(
  query: string,
  timeRange: TimeRange,
  maxResults: number = 20
): Promise<UnifiedYouTubeVideo[]> {
  if (!process.env.YOUTUBE_API_KEY) {
    console.warn('[YouTube] No API key - cannot filter by date in search')
    return []
  }

  try {
    const client = getYouTubeClient()
    const result = await client.searchVideos(query, {
      maxResults,
      publishedAfter: timeRange.start_date,
      order: 'date',
    })

    return result.videos.map(
      (v): UnifiedYouTubeVideo => ({
        id: v.id,
        title: v.title,
        channel_id: v.channelId,
        channel_name: v.channelTitle,
        published_at: new Date(v.publishedAt),
        description: v.description,
        thumbnail_url: v.thumbnailUrl,
        view_count: v.viewCount,
        like_count: v.likeCount,
        comment_count: v.commentCount,
      })
    )
  } catch (error) {
    console.error('[YouTube Search] Error:', error)
    return []
  }
}

/**
 * YouTube Source Adapter
 * Implements SourceAdapter interface for unified source fetching
 */
export class YouTubeAdapter implements SourceAdapter {
  name: 'youtube' = 'youtube'

  isConfigured(): boolean {
    // YouTube is always available via RSS
    // Official API is optional but enables search with date filtering
    return true
  }

  async fetchContent(config: SourceConfig): Promise<UnifiedContent[]> {
    const content: UnifiedContent[] = []

    // 1. Fetch from configured channels via RSS
    if (config.channel_ids && config.channel_ids.length > 0) {
      console.log(
        `[YouTube] Fetching ${config.channel_ids.length} channels via RSS`
      )
      const channelVideos = await fetchMultipleChannelsRSS(
        config.channel_ids,
        config.time_range
      )
      content.push(...channelVideos.map(youtubeToUnified))
      console.log(
        `[YouTube] Got ${channelVideos.length} videos from channels (within ${config.time_range.hours_back}h)`
      )
    }

    // 2. Search for query if provided (requires API key for date filtering)
    if (config.youtube_search_query) {
      console.log(
        `[YouTube] Searching: "${config.youtube_search_query}" (last ${config.time_range.hours_back}h)`
      )
      const searchVideos = await searchYouTubeWithDateFilter(
        config.youtube_search_query,
        config.time_range,
        config.max_items || 20
      )
      content.push(...searchVideos.map(youtubeToUnified))
      console.log(`[YouTube] Got ${searchVideos.length} videos from search`)
    }

    // Deduplicate by video ID
    const seen = new Set<string>()
    const unique = content.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    // Sort by date (newest first)
    unique.sort(
      (a, b) => b.published_at.getTime() - a.published_at.getTime()
    )

    // Apply max items limit
    const maxItems = config.max_items || 50
    return unique.slice(0, maxItems)
  }

  /**
   * Get transcript for a video
   */
  async getTranscript(videoId: string): Promise<string | null> {
    try {
      const client = getFreeYouTubeClient()
      const transcript = await client.getTranscript(videoId)
      return transcript?.fullText || null
    } catch (error) {
      console.error(`[YouTube] Transcript error for ${videoId}:`, error)
      return null
    }
  }

  /**
   * Get comments for a video
   */
  async getComments(videoId: string, limit: number = 50): Promise<UnifiedContent[]> {
    try {
      const client = getFreeYouTubeClient()
      const comments = await client.getVideoComments(videoId, limit)

      return comments.map((c) => ({
        id: `youtube:comment:${c.commentId}`,
        source: 'youtube' as const,
        type: 'comment' as const,
        title: c.text.substring(0, 100),
        body: c.text,
        author: {
          name: c.authorName,
          id: c.authorChannelId,
        },
        published_at: new Date(c.publishedAt || Date.now()),
        url: `https://www.youtube.com/watch?v=${videoId}&lc=${c.commentId}`,
        engagement: {
          likes: c.likeCount,
          replies: c.replyCount,
        },
        raw_data: c,
      }))
    } catch (error) {
      console.error(`[YouTube] Comments error for ${videoId}:`, error)
      return []
    }
  }
}

// Singleton instance
let adapter: YouTubeAdapter | null = null

export function getYouTubeAdapter(): YouTubeAdapter {
  if (!adapter) {
    adapter = new YouTubeAdapter()
  }
  return adapter
}
