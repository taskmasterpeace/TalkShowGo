/**
 * Unified Source Types
 *
 * Common interfaces for all content sources (YouTube, Twitter, RSS).
 * Every piece of content has a guaranteed published_at date.
 */

import { TimeRange } from '../time-range'

export type SourceType = 'youtube' | 'twitter' | 'rss'
export type ContentType = 'video' | 'tweet' | 'article' | 'comment'

/**
 * Unified content representation from any source
 * published_at is REQUIRED - no more missing dates
 */
export interface UnifiedContent {
  id: string
  source: SourceType
  type: ContentType
  title: string
  body?: string
  author: {
    name: string
    id?: string
    handle?: string
    channel_id?: string
  }
  published_at: Date // REQUIRED - accurate timestamp
  url: string
  engagement: {
    views?: number
    likes?: number
    comments?: number
    retweets?: number
    replies?: number
  }
  media?: {
    thumbnail_url?: string
    duration_seconds?: number
  }
  metadata?: Record<string, unknown>
  raw_data: unknown // Original source data for debugging
}

/**
 * Configuration for fetching from a source
 */
export interface SourceConfig {
  time_range: TimeRange
  topic_id: string

  // YouTube-specific
  channel_ids?: string[]
  youtube_search_query?: string

  // Twitter-specific
  handles?: string[]
  twitter_search_query?: string

  // RSS-specific
  feed_urls?: string[]

  // General options
  max_items?: number
  include_comments?: boolean
}

/**
 * Interface that all source adapters must implement
 */
export interface SourceAdapter {
  name: SourceType
  isConfigured(): boolean
  fetchContent(config: SourceConfig): Promise<UnifiedContent[]>
  getCreditsRemaining?(): Promise<number>
}

/**
 * Result of fetching from multiple sources
 */
export interface FetchResult {
  content: UnifiedContent[]
  sources_used: SourceType[]
  errors: Array<{ source: SourceType; error: string }>
  fetch_time_ms: number
  time_range: TimeRange
  stats: {
    total_items: number
    by_source: Record<SourceType, number>
    filtered_out: number // Items outside time range
  }
}

/**
 * YouTube-specific video type (before conversion to UnifiedContent)
 */
export interface YouTubeVideo {
  id: string
  title: string
  channel_id: string
  channel_name: string
  published_at: Date
  description?: string
  thumbnail_url?: string
  duration_seconds?: number
  view_count?: number
  like_count?: number
  comment_count?: number
  transcript?: string
}

/**
 * Twitter-specific tweet type (before conversion to UnifiedContent)
 */
export interface TwitterTweet {
  id: string
  text: string
  author_id: string
  author_name: string
  author_handle: string
  created_at: Date
  retweet_count?: number
  like_count?: number
  reply_count?: number
  quote_count?: number
  is_retweet: boolean
  is_reply: boolean
  media_urls?: string[]
}

/**
 * RSS-specific article type (before conversion to UnifiedContent)
 */
export interface RSSArticle {
  id: string
  title: string
  link: string
  description?: string
  content?: string
  author?: string
  published_at: Date
  categories?: string[]
  enclosure_url?: string
  feed_title: string
}

/**
 * Convert YouTube video to unified content
 */
export function youtubeToUnified(video: YouTubeVideo): UnifiedContent {
  return {
    id: `youtube:${video.id}`,
    source: 'youtube',
    type: 'video',
    title: video.title,
    body: video.description,
    author: {
      name: video.channel_name,
      channel_id: video.channel_id,
    },
    published_at: video.published_at,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    engagement: {
      views: video.view_count,
      likes: video.like_count,
      comments: video.comment_count,
    },
    media: {
      thumbnail_url: video.thumbnail_url,
      duration_seconds: video.duration_seconds,
    },
    metadata: {
      transcript: video.transcript,
    },
    raw_data: video,
  }
}

/**
 * Convert Twitter tweet to unified content
 */
export function twitterToUnified(tweet: TwitterTweet): UnifiedContent {
  return {
    id: `twitter:${tweet.id}`,
    source: 'twitter',
    type: 'tweet',
    title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
    body: tweet.text,
    author: {
      name: tweet.author_name,
      id: tweet.author_id,
      handle: tweet.author_handle,
    },
    published_at: tweet.created_at,
    url: `https://twitter.com/${tweet.author_handle}/status/${tweet.id}`,
    engagement: {
      likes: tweet.like_count,
      retweets: tweet.retweet_count,
      replies: tweet.reply_count,
    },
    metadata: {
      is_retweet: tweet.is_retweet,
      is_reply: tweet.is_reply,
      media_urls: tweet.media_urls,
    },
    raw_data: tweet,
  }
}

/**
 * Convert RSS article to unified content
 */
export function rssToUnified(article: RSSArticle): UnifiedContent {
  return {
    id: `rss:${article.id}`,
    source: 'rss',
    type: 'article',
    title: article.title,
    body: article.content || article.description,
    author: {
      name: article.author || article.feed_title,
    },
    published_at: article.published_at,
    url: article.link,
    engagement: {},
    metadata: {
      categories: article.categories,
      feed_title: article.feed_title,
    },
    raw_data: article,
  }
}
