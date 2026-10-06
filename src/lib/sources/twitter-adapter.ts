/**
 * Twitter Source Adapter
 *
 * Uses twitterapi.io for Twitter data
 * Properly handles time filtering with createdAt timestamps
 */

import { TimeRange, isWithinTimeRange, toTwitterApiFormat } from '../time-range'
import {
  SourceAdapter,
  SourceConfig,
  UnifiedContent,
  TwitterTweet,
  twitterToUnified,
} from './types'
import {
  getTwitterClient,
  isTwitterConfigured,
  buildBattleRapSearchQuery,
  Tweet,
} from '../twitter-api'

/**
 * Convert API tweet to our TwitterTweet type
 */
function toTwitterTweet(tweet: Tweet): TwitterTweet {
  return {
    id: tweet.id,
    text: tweet.text,
    author_id: tweet.author.id,
    author_name: tweet.author.name,
    author_handle: tweet.author.userName,
    created_at: new Date(tweet.createdAt),
    retweet_count: tweet.retweetCount,
    like_count: tweet.likeCount,
    reply_count: tweet.replyCount,
    quote_count: tweet.quoteCount,
    is_retweet: tweet.isRetweet,
    is_reply: tweet.isReply,
    media_urls: tweet.media?.map((m) => m.url),
  }
}

/**
 * Fetch tweets from a user's timeline
 */
export async function fetchUserTimeline(
  username: string,
  timeRange: TimeRange
): Promise<TwitterTweet[]> {
  const client = getTwitterClient()
  if (!client) return []

  try {
    const result = await client.getUserTimeline(username)

    // Filter by time range
    const filtered = result.tweets
      .map(toTwitterTweet)
      .filter((t) => isWithinTimeRange(t.created_at, timeRange))

    return filtered
  } catch (error) {
    console.error(`[Twitter] Error fetching timeline for ${username}:`, error)
    return []
  }
}

/**
 * Fetch tweets from multiple users
 */
export async function fetchMultipleTimelines(
  usernames: string[],
  timeRange: TimeRange
): Promise<TwitterTweet[]> {
  const client = getTwitterClient()
  if (!client) return []

  const results = await Promise.allSettled(
    usernames.map((u) => fetchUserTimeline(u, timeRange))
  )

  const allTweets: TwitterTweet[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allTweets.push(...result.value)
    }
  }

  // Sort by date (newest first)
  allTweets.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

  return allTweets
}

/**
 * Search Twitter with time filtering
 */
export async function searchTwitter(
  query: string,
  timeRange: TimeRange
): Promise<TwitterTweet[]> {
  const client = getTwitterClient()
  if (!client) return []

  try {
    // Build query with date filter
    const { since } = toTwitterApiFormat(timeRange)
    const sinceDate = since.split('T')[0] // Twitter API needs YYYY-MM-DD format
    const fullQuery = `${query} since:${sinceDate}`

    const result = await client.searchTweets(fullQuery, {
      queryType: 'Latest',
    })

    // Extra filter to ensure time range (API might return some older tweets)
    return result.tweets
      .map(toTwitterTweet)
      .filter((t) => isWithinTimeRange(t.created_at, timeRange))
  } catch (error) {
    console.error(`[Twitter] Error searching:`, error)
    return []
  }
}

/**
 * Twitter Source Adapter
 * Implements SourceAdapter interface for unified source fetching
 */
export class TwitterAdapter implements SourceAdapter {
  name: 'twitter' = 'twitter'

  isConfigured(): boolean {
    return isTwitterConfigured()
  }

  async fetchContent(config: SourceConfig): Promise<UnifiedContent[]> {
    if (!this.isConfigured()) {
      console.log('[Twitter] Skipping - API key not configured')
      return []
    }

    const content: UnifiedContent[] = []

    // 1. Fetch from configured handles
    if (config.handles && config.handles.length > 0) {
      console.log(
        `[Twitter] Fetching ${config.handles.length} timelines (last ${config.time_range.hours_back}h)`
      )
      const timelineTweets = await fetchMultipleTimelines(
        config.handles,
        config.time_range
      )
      content.push(...timelineTweets.map(twitterToUnified))
      console.log(`[Twitter] Got ${timelineTweets.length} tweets from timelines`)
    }

    // 2. Search for query if provided
    if (config.twitter_search_query) {
      console.log(
        `[Twitter] Searching: "${config.twitter_search_query}" (last ${config.time_range.hours_back}h)`
      )
      const searchTweets = await searchTwitter(
        config.twitter_search_query,
        config.time_range
      )
      content.push(...searchTweets.map(twitterToUnified))
      console.log(`[Twitter] Got ${searchTweets.length} tweets from search`)
    }

    // Deduplicate by tweet ID
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
   * Get credits remaining (if API supports it)
   */
  async getCreditsRemaining(): Promise<number> {
    // TwitterAPI.io doesn't have a credits endpoint
    // Return -1 to indicate unknown
    return -1
  }
}

// Singleton instance
let adapter: TwitterAdapter | null = null

export function getTwitterAdapter(): TwitterAdapter {
  if (!adapter) {
    adapter = new TwitterAdapter()
  }
  return adapter
}

/**
 * Build a battle rap focused search query
 */
export function buildBattleRapQuery(options: {
  entities?: string[]
  accounts?: string[]
  since?: Date
}): string {
  return buildBattleRapSearchQuery({
    entities: options.entities,
    accounts: options.accounts,
    excludeRetweets: true,
    since: options.since,
  })
}
