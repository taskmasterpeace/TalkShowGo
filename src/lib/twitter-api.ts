/**
 * TwitterAPI.io Client
 *
 * Third-party Twitter API with pay-as-you-go pricing:
 * - Tweets: $0.15 per 1K
 * - Profiles: $0.18 per 1K
 * - Followers: $0.15 per 1K
 *
 * Docs: https://docs.twitterapi.io
 */

const TWITTER_API_BASE = 'https://api.twitterapi.io'

interface TwitterApiConfig {
  apiKey: string
}

interface TwitterUser {
  id: string
  userName: string
  name: string
  description?: string
  profilePicture?: string
  followersCount: number
  followingCount: number
  isVerified: boolean
  isBlueVerified: boolean
  created?: string
  location?: string
  url?: string
}

interface Tweet {
  id: string
  text: string
  createdAt: string
  author: {
    id: string
    userName: string
    name: string
    profilePicture?: string
    isVerified: boolean
    followersCount: number
  }
  likeCount: number
  retweetCount: number
  replyCount: number
  viewCount: number
  quoteCount?: number
  isRetweet: boolean
  isQuote: boolean
  isReply: boolean
  inReplyToId?: string
  quotedTweetId?: string
  media?: Array<{
    type: string
    url: string
  }>
  urls?: Array<{
    url: string
    expandedUrl: string
  }>
  hashtags?: string[]
  mentions?: string[]
}

interface SearchResult {
  tweets: Tweet[]
  cursor?: string
  hasMore: boolean
}

interface UserTimelineResult {
  tweets: Tweet[]
  cursor?: string
  hasMore: boolean
}

export class TwitterApiClient {
  private apiKey: string

  constructor(config: TwitterApiConfig) {
    this.apiKey = config.apiKey
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${TWITTER_API_BASE}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`TwitterAPI error ${response.status}: ${error}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Get user profile by username
   * Cost: ~$0.00018 per call
   */
  async getUserByUsername(username: string): Promise<TwitterUser | null> {
    try {
      // Remove @ if present
      const handle = username.replace('@', '')
      const data = await this.request<{ data: TwitterUser }>('/twitter/user/info', {
        userName: handle,
      })
      return data.data
    } catch (error) {
      console.error(`Error fetching user ${username}:`, error)
      return null
    }
  }

  /**
   * Get user's recent tweets/timeline
   * Cost: ~$0.00015 per call (returns ~20 tweets)
   */
  async getUserTimeline(username: string, cursor?: string): Promise<UserTimelineResult> {
    try {
      const handle = username.replace('@', '')
      const response = await this.request<{
        status: string
        data: {
          tweets: any[]
          next_cursor?: string
        }
      }>('/twitter/user/last_tweets', {
        userName: handle,
        cursor: cursor || '',
      })

      // Map API response to our Tweet type
      const tweets: Tweet[] = (response.data?.tweets || []).map((t: any) => ({
        id: t.id,
        text: t.text,
        createdAt: t.createdAt,
        author: {
          id: t.author?.id || '',
          userName: t.author?.userName || handle,
          name: t.author?.name || '',
          profilePicture: t.author?.profilePicture,
          isVerified: t.author?.isVerified || false,
          followersCount: t.author?.followersCount || 0,
        },
        likeCount: t.likeCount || 0,
        retweetCount: t.retweetCount || 0,
        replyCount: t.replyCount || 0,
        viewCount: t.viewCount || 0,
        quoteCount: t.quoteCount || 0,
        isRetweet: t.isRetweet || t.type === 'retweet',
        isQuote: t.isQuote || t.type === 'quote',
        isReply: t.isReply || !!t.inReplyToId,
        inReplyToId: t.inReplyToId,
        quotedTweetId: t.quotedTweetId,
        media: t.media,
        urls: t.urls,
        hashtags: t.hashtags,
        mentions: t.mentions,
      }))

      return {
        tweets,
        cursor: response.data?.next_cursor,
        hasMore: !!response.data?.next_cursor,
      }
    } catch (error) {
      console.error(`Error fetching timeline for ${username}:`, error)
      return { tweets: [], hasMore: false }
    }
  }

  /**
   * Advanced tweet search
   * Cost: ~$0.00015 per call (returns ~20 tweets)
   *
   * Query syntax examples:
   * - "battle rap" from:urltv
   * - @GeechiGotti since:2024-01-01
   * - "Summer Madness" -is:retweet
   */
  async searchTweets(
    query: string,
    options: {
      queryType?: 'Latest' | 'Top'
      cursor?: string
    } = {}
  ): Promise<SearchResult> {
    try {
      const data = await this.request<{
        tweets: Tweet[]
        next_cursor?: string
      }>('/twitter/tweet/advanced_search', {
        query,
        queryType: options.queryType || 'Latest',
        cursor: options.cursor || '',
      })

      return {
        tweets: data.tweets || [],
        cursor: data.next_cursor,
        hasMore: !!data.next_cursor,
      }
    } catch (error) {
      console.error(`Error searching tweets:`, error)
      return { tweets: [], hasMore: false }
    }
  }

  /**
   * Get user's followers
   * Cost: ~$0.00015 per call
   */
  async getUserFollowers(username: string, cursor?: string): Promise<{
    users: TwitterUser[]
    cursor?: string
    hasMore: boolean
  }> {
    try {
      const handle = username.replace('@', '')
      const data = await this.request<{
        users: TwitterUser[]
        next_cursor?: string
      }>('/twitter/user/followers', {
        userName: handle,
        cursor: cursor || '',
      })

      return {
        users: data.users || [],
        cursor: data.next_cursor,
        hasMore: !!data.next_cursor,
      }
    } catch (error) {
      console.error(`Error fetching followers for ${username}:`, error)
      return { users: [], hasMore: false }
    }
  }

  /**
   * Get tweet by ID
   */
  async getTweetById(tweetId: string): Promise<Tweet | null> {
    try {
      const data = await this.request<{ data: Tweet }>('/twitter/tweet/detail', {
        tweetId,
      })
      return data.data
    } catch (error) {
      console.error(`Error fetching tweet ${tweetId}:`, error)
      return null
    }
  }

  /**
   * Get tweet replies
   */
  async getTweetReplies(tweetId: string, cursor?: string): Promise<SearchResult> {
    try {
      const data = await this.request<{
        tweets: Tweet[]
        next_cursor?: string
      }>('/twitter/tweet/replies', {
        tweetId,
        cursor: cursor || '',
      })

      return {
        tweets: data.tweets || [],
        cursor: data.next_cursor,
        hasMore: !!data.next_cursor,
      }
    } catch (error) {
      console.error(`Error fetching replies for tweet ${tweetId}:`, error)
      return { tweets: [], hasMore: false }
    }
  }

  /**
   * Check if user follows another user
   */
  async checkFollowRelationship(sourceUser: string, targetUser: string): Promise<boolean> {
    try {
      const data = await this.request<{ isFollowing: boolean }>('/twitter/user/check_follow', {
        sourceUserName: sourceUser.replace('@', ''),
        targetUserName: targetUser.replace('@', ''),
      })
      return data.isFollowing
    } catch (error) {
      console.error(`Error checking follow relationship:`, error)
      return false
    }
  }
}

// Helper to build search queries for battle rap
export function buildBattleRapSearchQuery(options: {
  entities?: string[]
  accounts?: string[]
  excludeRetweets?: boolean
  since?: Date
  until?: Date
  minLikes?: number
}): string {
  const parts: string[] = []

  // Add entity terms (OR them together)
  if (options.entities && options.entities.length > 0) {
    const entityTerms = options.entities
      .map(e => `"${e}"`)
      .join(' OR ')
    parts.push(`(${entityTerms})`)
  }

  // Add from: filters for specific accounts
  if (options.accounts && options.accounts.length > 0) {
    const fromTerms = options.accounts
      .map(a => `from:${a.replace('@', '')}`)
      .join(' OR ')
    parts.push(`(${fromTerms})`)
  }

  // Exclude retweets
  if (options.excludeRetweets) {
    parts.push('-is:retweet')
  }

  // Date range
  if (options.since) {
    parts.push(`since:${options.since.toISOString().split('T')[0]}`)
  }
  if (options.until) {
    parts.push(`until:${options.until.toISOString().split('T')[0]}`)
  }

  // Minimum engagement (likes)
  if (options.minLikes) {
    parts.push(`min_faves:${options.minLikes}`)
  }

  return parts.join(' ')
}

// Singleton instance
let client: TwitterApiClient | null = null

export function getTwitterClient(): TwitterApiClient {
  if (!client) {
    const apiKey = process.env.TWITTER_API_KEY
    if (!apiKey) {
      throw new Error('TWITTER_API_KEY environment variable is required')
    }
    client = new TwitterApiClient({ apiKey })
  }
  return client
}

// Export types
export type { TwitterUser, Tweet, SearchResult, UserTimelineResult }
