/**
 * YouTube Data API Client
 *
 * Two approaches:
 *
 * 1. OFFICIAL API (requires YOUTUBE_API_KEY)
 *    - Free tier: 10,000 units/day
 *    - Search: 100 units per call
 *    - Video details: 1 unit per call
 *    - Channel details: 1 unit per call
 *    - So roughly 100 searches/day on free tier
 *
 * 2. FREE APPROACH (no API key needed!)
 *    - youtubei.js - Channel info, videos, metadata
 *    - youtube-transcript - Transcripts/captions
 *    - Uses YouTube's internal APIs (may break if YouTube changes things)
 *
 * Default: Use FREE approach, fall back to official if needed
 */

import { trackYouTubeCall } from './api-usage'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

interface YouTubeConfig {
  apiKey: string
}

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  duration?: string
  tags?: string[]
}

export interface YouTubeChannel {
  id: string
  title: string
  description: string
  customUrl?: string
  subscriberCount: number
  videoCount: number
  viewCount: number
  thumbnailUrl: string
}

export interface SearchResult {
  videos: YouTubeVideo[]
  nextPageToken?: string
  totalResults: number
}

export class YouTubeApiClient {
  private apiKey: string

  constructor(config: YouTubeConfig) {
    this.apiKey = config.apiKey
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${YOUTUBE_API_BASE}${endpoint}`)
    url.searchParams.append('key', this.apiKey)
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString())

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`YouTube API error ${response.status}: ${error}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Search for videos
   * Cost: 100 units per call
   */
  async searchVideos(
    query: string,
    options: {
      maxResults?: number
      pageToken?: string
      order?: 'date' | 'rating' | 'relevance' | 'viewCount'
      publishedAfter?: Date
      channelId?: string
    } = {}
  ): Promise<SearchResult> {
    const params: Record<string, string> = {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(options.maxResults || 10),
      order: options.order || 'relevance',
    }

    if (options.pageToken) params.pageToken = options.pageToken
    if (options.publishedAfter) params.publishedAfter = options.publishedAfter.toISOString()
    if (options.channelId) params.channelId = options.channelId

    const data = await this.request<any>('/search', params)

    const videos: YouTubeVideo[] = (data.items || []).map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    }))

    return {
      videos,
      nextPageToken: data.nextPageToken,
      totalResults: data.pageInfo?.totalResults || videos.length,
    }
  }

  /**
   * Get video details (views, likes, duration)
   * Cost: 1 unit per video ID
   */
  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
    if (videoIds.length === 0) return []

    const data = await this.request<any>('/videos', {
      part: 'snippet,statistics,contentDetails',
      id: videoIds.join(','),
    })

    return (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails?.high?.url,
      viewCount: parseInt(item.statistics?.viewCount || '0'),
      likeCount: parseInt(item.statistics?.likeCount || '0'),
      commentCount: parseInt(item.statistics?.commentCount || '0'),
      duration: item.contentDetails?.duration,
      tags: item.snippet?.tags || [],
    }))
  }

  /**
   * Get channel details
   * Cost: 1 unit per channel ID
   */
  async getChannelDetails(channelIds: string[]): Promise<YouTubeChannel[]> {
    if (channelIds.length === 0) return []

    const data = await this.request<any>('/channels', {
      part: 'snippet,statistics',
      id: channelIds.join(','),
    })

    return (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      customUrl: item.snippet.customUrl,
      subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
      videoCount: parseInt(item.statistics?.videoCount || '0'),
      viewCount: parseInt(item.statistics?.viewCount || '0'),
      thumbnailUrl: item.snippet.thumbnails?.high?.url,
    }))
  }

  /**
   * Get channel by handle/username
   */
  async getChannelByHandle(handle: string): Promise<YouTubeChannel | null> {
    // Remove @ if present
    const cleanHandle = handle.replace('@', '')

    try {
      const data = await this.request<any>('/channels', {
        part: 'snippet,statistics',
        forHandle: cleanHandle,
      })

      if (!data.items || data.items.length === 0) {
        // Try with forUsername as fallback
        const fallback = await this.request<any>('/channels', {
          part: 'snippet,statistics',
          forUsername: cleanHandle,
        })
        if (!fallback.items || fallback.items.length === 0) return null
        data.items = fallback.items
      }

      const item = data.items[0]
      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        customUrl: item.snippet.customUrl,
        subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
        videoCount: parseInt(item.statistics?.videoCount || '0'),
        viewCount: parseInt(item.statistics?.viewCount || '0'),
        thumbnailUrl: item.snippet.thumbnails?.high?.url,
      }
    } catch (error) {
      console.error(`Error fetching channel ${handle}:`, error)
      return null
    }
  }

  /**
   * Get recent videos from a channel
   * Cost: 100 units (search)
   */
  async getChannelVideos(
    channelId: string,
    options: { maxResults?: number; publishedAfter?: Date } = {}
  ): Promise<YouTubeVideo[]> {
    const searchResult = await this.searchVideos('', {
      channelId,
      maxResults: options.maxResults || 10,
      order: 'date',
      publishedAfter: options.publishedAfter,
    })

    // Get full details for these videos
    if (searchResult.videos.length > 0) {
      return this.getVideoDetails(searchResult.videos.map(v => v.id))
    }

    return []
  }

  /**
   * Get video comments (Official API - reliable)
   * Cost: 1 unit per call
   */
  async getVideoComments(
    videoId: string,
    options: { maxResults?: number; order?: 'time' | 'relevance' } = {}
  ): Promise<YouTubeComment[]> {
    const data = await this.request<any>('/commentThreads', {
      part: 'snippet',
      videoId,
      maxResults: String(options.maxResults || 50),
      order: options.order || 'relevance',
    })

    return (data.items || []).map((item: any) => {
      const comment = item.snippet.topLevelComment.snippet
      return {
        commentId: item.id,
        authorName: comment.authorDisplayName,
        authorChannelId: comment.authorChannelId?.value || '',
        text: comment.textOriginal || comment.textDisplay,
        likeCount: comment.likeCount || 0,
        replyCount: item.snippet.totalReplyCount || 0,
        publishedAt: comment.publishedAt,
        isReply: false,
      }
    })
  }

  /**
   * Smart search - search with battle rap context
   */
  async searchBattleRapContent(
    query: string,
    options: {
      type?: 'battle' | 'reaction' | 'interview' | 'prediction' | 'any'
      maxResults?: number
      recentDays?: number
    } = {}
  ): Promise<SearchResult> {
    // Build smart query based on type
    let smartQuery = query
    switch (options.type) {
      case 'battle':
        smartQuery = `${query} full battle URL KOTD RBE`
        break
      case 'reaction':
        smartQuery = `${query} reaction breakdown`
        break
      case 'interview':
        smartQuery = `${query} interview exclusive`
        break
      case 'prediction':
        smartQuery = `${query} prediction who wins`
        break
      default:
        smartQuery = `${query} battle rap`
    }

    const publishedAfter = options.recentDays
      ? new Date(Date.now() - options.recentDays * 24 * 60 * 60 * 1000)
      : undefined

    return this.searchVideos(smartQuery, {
      maxResults: options.maxResults || 10,
      order: options.recentDays ? 'date' : 'relevance',
      publishedAfter,
    })
  }
}

// Helper to check if video is battle rap related
export function isBattleRapRelated(video: YouTubeVideo): boolean {
  const text = `${video.title} ${video.description}`.toLowerCase()
  const keywords = [
    'battle rap', 'url', 'ultimate rap league', 'kotd', 'king of the dot',
    'rbe', 'rare breed', 'smack', 'loaded lux', 'geechi gotti', 'tay roc',
    'rum nitty', 'battle', 'vs', 'versus', 'bars', 'bodybag', '3-0'
  ]
  return keywords.some(kw => text.includes(kw))
}

// Helper to extract battler names from title
export function extractBattlerNames(title: string): string[] {
  // Pattern: "Name1 vs Name2" or "Name1 VS Name2"
  const vsMatch = title.match(/(.+?)\s+(?:vs\.?|VS\.?|versus)\s+(.+?)(?:\s*[-|]|$)/i)
  if (vsMatch) {
    return [vsMatch[1].trim(), vsMatch[2].trim()]
  }
  return []
}

// Singleton instance (official API)
let client: YouTubeApiClient | null = null

export function getYouTubeClient(): YouTubeApiClient {
  if (!client) {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY environment variable is required')
    }
    client = new YouTubeApiClient({ apiKey })
  }
  return client
}

// ============================================
// FREE YOUTUBE CLIENT (No API Key Required!)
// ============================================

export interface YouTubeTranscript {
  videoId: string
  language: string
  segments: {
    text: string
    start: number
    duration: number
  }[]
  fullText: string
}

export interface YouTubeComment {
  commentId: string
  authorName: string
  authorChannelId: string
  text: string
  likeCount: number
  replyCount: number
  publishedAt: string
  isReply: boolean
  parentCommentId?: string
}

export class FreeYouTubeClient {
  private innertube: any = null
  private initialized = false

  /**
   * Initialize youtubei.js (lazy)
   */
  private async init() {
    if (this.initialized) return

    try {
      const { Innertube } = await import('youtubei.js')
      this.innertube = await Innertube.create({
        lang: 'en',
        location: 'US',
        retrieve_player: false,
      })
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize YouTube client:', error)
      throw new Error('YouTube client initialization failed. Install: npm i youtubei.js')
    }
  }

  /**
   * Get channel info by handle or ID (FREE!)
   */
  async getChannel(handleOrId: string): Promise<YouTubeChannel | null> {
    await this.init()

    try {
      const query = handleOrId.replace('@', '')
      const channel = await this.innertube.getChannel(query)

      if (!channel) return null

      trackYouTubeCall('channel_info', 1)

      return {
        id: channel.metadata?.external_id || query,
        title: channel.metadata?.title || '',
        description: channel.metadata?.description || '',
        customUrl: channel.metadata?.vanity_channel_url,
        subscriberCount: this.parseCount(channel.metadata?.subscriber_count),
        videoCount: this.parseCount(channel.metadata?.video_count),
        viewCount: this.parseCount(channel.metadata?.view_count),
        thumbnailUrl: channel.metadata?.avatar?.[0]?.url || '',
      }
    } catch (error) {
      console.error(`Error fetching channel ${handleOrId}:`, error)
      return null
    }
  }

  /**
   * Get channel's recent videos (FREE!)
   */
  async getChannelVideos(handleOrId: string, limit: number = 20): Promise<YouTubeVideo[]> {
    await this.init()

    try {
      const query = handleOrId.replace('@', '')
      const channel = await this.innertube.getChannel(query)

      if (!channel) return []

      const videosTab = await channel.getVideos()
      const videos: YouTubeVideo[] = []

      for (const video of videosTab.videos || []) {
        if (videos.length >= limit) break

        videos.push({
          id: video.id,
          title: video.title?.text || '',
          description: video.description_snippet?.text || '',
          channelId: channel.metadata?.external_id || query,
          channelTitle: channel.metadata?.title || '',
          publishedAt: video.published?.text || '',
          thumbnailUrl: video.thumbnails?.[0]?.url || '',
          viewCount: this.parseCount(video.view_count?.text),
          duration: video.duration?.text,
        })
      }

      trackYouTubeCall('video_list', videos.length)

      return videos
    } catch (error) {
      console.error(`Error fetching videos for ${handleOrId}:`, error)
      return []
    }
  }

  /**
   * Get video transcript (FREE!)
   */
  async getTranscript(videoId: string, language: string = 'en'): Promise<YouTubeTranscript | null> {
    try {
      const { getSubtitles } = await import('youtube-caption-extractor')

      const subtitles = await getSubtitles({
        videoID: videoId,
        lang: language
      })

      if (!subtitles || subtitles.length === 0) {
        console.log(`[YouTube] No captions for ${videoId}`)
        return null
      }

      trackYouTubeCall('transcript', 1)

      const segments = subtitles.map((item: any) => ({
        text: item.text,
        start: parseFloat(item.start),
        duration: parseFloat(item.dur),
      }))

      return {
        videoId,
        language,
        segments,
        fullText: segments.map((s: any) => s.text).join(' '),
      }
    } catch (error) {
      console.error(`[YouTube] Caption extraction failed for ${videoId}:`, error)
      return null
    }
  }

  /**
   * Get video comments (FREE!)
   * Returns top-level comments sorted by engagement (likes)
   */
  async getVideoComments(videoId: string, limit: number = 100): Promise<YouTubeComment[]> {
    await this.init()

    try {
      // Use getComments directly on innertube
      const commentsData = await this.innertube.getComments(videoId)

      if (!commentsData || !commentsData.contents) return []

      const comments: YouTubeComment[] = []

      // Process comments - handle different response formats
      const commentList = commentsData.contents || []

      for (const item of commentList) {
        if (comments.length >= limit) break

        // Get the actual comment object - may be nested
        const comment = item.comment?.content || item.content || item

        if (!comment) continue

        // Extract author info
        const authorName = comment.author?.name?.text ||
                          comment.author?.name ||
                          comment.author_text?.simpleText ||
                          ''

        const authorChannelId = comment.author?.id ||
                               comment.author_endpoint?.browse_endpoint?.browse_id ||
                               ''

        // Extract comment text
        const text = comment.content?.text ||
                    comment.text?.text ||
                    (typeof comment.text === 'string' ? comment.text : '') ||
                    ''

        // Extract engagement metrics
        const likeText = comment.vote_count?.text ||
                        comment.like_count?.text ||
                        comment.likes?.text ||
                        '0'
        const likeCount = this.parseCount(likeText)

        const replyCount = parseInt(comment.reply_count || '0') || 0

        comments.push({
          commentId: comment.comment_id || item.id || '',
          authorName,
          authorChannelId,
          text,
          likeCount,
          replyCount,
          publishedAt: comment.published?.text || comment.published_time_text?.text || '',
          isReply: false,
        })
      }

      // Sort by likes (engagement indicator)
      comments.sort((a, b) => b.likeCount - a.likeCount)

      trackYouTubeCall('comments', comments.length)

      return comments
    } catch (error) {
      console.error(`Error fetching comments for ${videoId}:`, error)
      return []
    }
  }

  /**
   * Search YouTube (FREE!)
   */
  async search(query: string, limit: number = 20): Promise<YouTubeVideo[]> {
    await this.init()

    try {
      const results = await this.innertube.search(query, { type: 'video' })
      const videos: YouTubeVideo[] = []

      for (const item of results.videos || []) {
        if (videos.length >= limit) break

        videos.push({
          id: item.id,
          title: item.title?.text || '',
          description: item.description_snippet?.text || '',
          channelId: item.author?.id || '',
          channelTitle: item.author?.name || '',
          publishedAt: item.published?.text || '',
          thumbnailUrl: item.thumbnails?.[0]?.url || '',
          viewCount: this.parseCount(item.view_count?.text),
          duration: item.duration?.text,
        })
      }

      trackYouTubeCall('search', videos.length)

      return videos
    } catch (error) {
      console.error(`Error searching YouTube:`, error)
      return []
    }
  }

  /**
   * Check if video title is relevant based on keywords
   */
  isRelevantVideo(video: YouTubeVideo, keywords: string[], minViews: number = 1000): boolean {
    if ((video.viewCount || 0) < minViews) return false

    const text = `${video.title} ${video.description}`.toLowerCase()
    return keywords.some(kw => text.includes(kw.toLowerCase()))
  }

  private parseCount(text: string | number | undefined): number {
    if (typeof text === 'number') return text
    if (!text) return 0

    const cleaned = text.toString().toLowerCase().replace(/,/g, '')

    if (cleaned.includes('k')) return parseFloat(cleaned) * 1000
    if (cleaned.includes('m')) return parseFloat(cleaned) * 1000000
    if (cleaned.includes('b')) return parseFloat(cleaned) * 1000000000

    return parseInt(cleaned) || 0
  }
}

// Singleton (free client)
let freeClient: FreeYouTubeClient | null = null

export function getFreeYouTubeClient(): FreeYouTubeClient {
  if (!freeClient) {
    freeClient = new FreeYouTubeClient()
  }
  return freeClient
}

// ============================================
// SMART CLIENT (uses free first, official as fallback)
// ============================================

export async function getSmartYouTubeClient(): Promise<FreeYouTubeClient | YouTubeApiClient> {
  // Try free client first
  try {
    const free = getFreeYouTubeClient()
    // Test if it works
    await free.search('test', 1)
    return free
  } catch {
    // Fall back to official
    console.log('Free YouTube client failed, using official API')
    return getYouTubeClient()
  }
}

// ============================================
// HELPERS
// ============================================

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function extractChannelHandle(url: string): string | null {
  const patterns = [
    /youtube\.com\/@([^\/\?]+)/,
    /youtube\.com\/channel\/([^\/\?]+)/,
    /youtube\.com\/c\/([^\/\?]+)/,
    /^@?([a-zA-Z0-9_-]+)$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// ============================================
// RECENCY-FOCUSED SEARCH HELPERS
// ============================================

/**
 * Search for recent videos on a topic (last N hours)
 * Uses official API for date filtering capability
 */
export async function searchRecentVideos(
  query: string,
  options: {
    hoursBack?: number
    maxResults?: number
  } = {}
): Promise<YouTubeVideo[]> {
  const { hoursBack = 48, maxResults = 10 } = options
  const publishedAfter = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

  const youtube = getYouTubeClient()
  const result = await youtube.searchVideos(query, {
    maxResults,
    publishedAfter,
    order: 'date',
  })

  return result.videos
}

/**
 * Search multiple topics in parallel and combine results
 */
export async function searchMultipleTopics(
  topics: string[],
  options: { hoursBack?: number; maxPerTopic?: number } = {}
): Promise<{ topic: string; videos: YouTubeVideo[] }[]> {
  const { hoursBack = 48, maxPerTopic = 5 } = options

  const results = await Promise.all(
    topics.map(async (topic) => ({
      topic,
      videos: await searchRecentVideos(`${topic} battle rap`, {
        hoursBack,
        maxResults: maxPerTopic,
      }),
    }))
  )

  return results
}

// ============================================
// UNIFIED SEARCH INTERFACE
// ============================================

export interface YouTubeSearchResult {
  videos: {
    id: string
    title: string
    description?: string
    channel?: string
    views?: number
    duration?: number
    publishedAt?: string
    thumbnailUrl?: string
  }[]
  totalResults: number
}

/**
 * Unified search function - uses free client by default
 * Falls back to official API if free client fails
 */
export async function searchYouTube(
  query: string,
  options?: {
    maxResults?: number
    order?: 'relevance' | 'date' | 'viewCount'
  }
): Promise<YouTubeSearchResult> {
  const maxResults = options?.maxResults || 20

  try {
    // Try free client first
    const freeClient = getFreeYouTubeClient()
    const videos = await freeClient.search(query, maxResults)

    return {
      videos: videos.map(v => ({
        id: v.id,
        title: v.title,
        description: v.description || '',
        channel: v.channelTitle || '',
        views: v.viewCount,
        duration: parseDurationToSeconds(v.duration),
        publishedAt: v.publishedAt,
        thumbnailUrl: v.thumbnailUrl
      })),
      totalResults: videos.length
    }
  } catch (freeError) {
    console.log('[YouTube] Free client failed, trying official API...')

    // Fall back to official API
    try {
      const officialClient = getYouTubeClient()
      const result = await officialClient.searchVideos(query, {
        maxResults,
        order: options?.order
      })

      return {
        videos: result.videos.map(v => ({
          id: v.id,
          title: v.title,
          description: v.description || '',
          channel: v.channelTitle || '',
          views: v.viewCount,
          duration: parseDurationToSeconds(v.duration),
          publishedAt: v.publishedAt,
          thumbnailUrl: v.thumbnailUrl
        })),
        totalResults: result.totalResults
      }
    } catch (officialError) {
      console.error('[YouTube] Both clients failed:', officialError)
      return { videos: [], totalResults: 0 }
    }
  }
}

/**
 * Parse ISO 8601 duration (PT1H23M45S) to seconds
 */
function parseDurationToSeconds(duration?: string): number {
  if (!duration) return 0

  // Handle "1:23:45" format
  if (duration.includes(':')) {
    const parts = duration.split(':').map(Number)
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
    return parts[0] || 0
  }

  // Handle ISO 8601 format (PT1H23M45S)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (match) {
    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')
    return hours * 3600 + minutes * 60 + seconds
  }

  return 0
}
