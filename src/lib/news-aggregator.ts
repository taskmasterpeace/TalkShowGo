/**
 * News Aggregator with Automatic Failover
 *
 * Manages news fetching with automatic failover:
 * 1. TheNewsAPI (primary)
 * 2. NewsData.io (backup)
 * 3. RSS feeds (tertiary - always available)
 *
 * Tracks rate limits and automatically switches sources.
 */

import {
  searchNews as searchTheNewsAPI,
  getTopHeadlines as getTheNewsAPIHeadlines,
  isTheNewsAPIConfigured,
  NormalizedArticle,
} from './news-api-thenewsapi'

import {
  searchNews as searchNewsData,
  getHeadlinesByCategory as getNewsDataHeadlines,
  isNewsDataConfigured,
} from './news-api-newsdata'

// Rate limit tracking
interface RateLimitState {
  theNewsAPI: {
    isLimited: boolean
    limitedAt: number | null
    cooldownMs: number
  }
  newsData: {
    isLimited: boolean
    limitedAt: number | null
    cooldownMs: number
  }
}

// In-memory rate limit state
const rateLimitState: RateLimitState = {
  theNewsAPI: {
    isLimited: false,
    limitedAt: null,
    cooldownMs: 60 * 60 * 1000, // 1 hour cooldown
  },
  newsData: {
    isLimited: false,
    limitedAt: null,
    cooldownMs: 15 * 60 * 1000, // 15 min cooldown
  },
}

export interface NewsSearchParams {
  query?: string
  categories?: string[]
  language?: string
  limit?: number
  hoursBack?: number
}

export interface AggregatorResult {
  articles: NormalizedArticle[]
  source: 'thenewsapi' | 'newsdata' | 'rss' | 'none'
  failedOver: boolean
  failoverReason?: string
  meta: {
    totalFound: number
    returned: number
  }
}

/**
 * Check if a rate limit has expired
 */
function isRateLimitExpired(limitedAt: number | null, cooldownMs: number): boolean {
  if (!limitedAt) return true
  return Date.now() - limitedAt > cooldownMs
}

/**
 * Mark a source as rate limited
 */
function markRateLimited(source: 'theNewsAPI' | 'newsData'): void {
  rateLimitState[source].isLimited = true
  rateLimitState[source].limitedAt = Date.now()
  console.log(`[NewsAggregator] ${source} marked as rate limited`)
}

/**
 * Check if a source is available (configured and not rate limited)
 */
function isSourceAvailable(source: 'theNewsAPI' | 'newsData'): boolean {
  const state = rateLimitState[source]

  // Check if rate limit has expired
  if (state.isLimited && isRateLimitExpired(state.limitedAt, state.cooldownMs)) {
    state.isLimited = false
    state.limitedAt = null
    console.log(`[NewsAggregator] ${source} rate limit expired, source available again`)
  }

  if (state.isLimited) {
    return false
  }

  // Check if configured
  if (source === 'theNewsAPI') {
    return isTheNewsAPIConfigured()
  }
  return isNewsDataConfigured()
}

/**
 * Get the current status of all news sources
 */
export function getAggregatorStatus(): {
  theNewsAPI: {
    configured: boolean
    available: boolean
    rateLimited: boolean
    cooldownRemaining?: number
  }
  newsData: {
    configured: boolean
    available: boolean
    rateLimited: boolean
    cooldownRemaining?: number
  }
} {
  const now = Date.now()

  const theNewsAPIState = rateLimitState.theNewsAPI
  const newsDataState = rateLimitState.newsData

  return {
    theNewsAPI: {
      configured: isTheNewsAPIConfigured(),
      available: isSourceAvailable('theNewsAPI'),
      rateLimited: theNewsAPIState.isLimited,
      cooldownRemaining: theNewsAPIState.isLimited && theNewsAPIState.limitedAt
        ? Math.max(0, theNewsAPIState.cooldownMs - (now - theNewsAPIState.limitedAt))
        : undefined,
    },
    newsData: {
      configured: isNewsDataConfigured(),
      available: isSourceAvailable('newsData'),
      rateLimited: newsDataState.isLimited,
      cooldownRemaining: newsDataState.isLimited && newsDataState.limitedAt
        ? Math.max(0, newsDataState.cooldownMs - (now - newsDataState.limitedAt))
        : undefined,
    },
  }
}

/**
 * Search for news with automatic failover
 */
export async function searchNews(params: NewsSearchParams): Promise<AggregatorResult> {
  const { query, categories, language = 'en', limit = 10, hoursBack } = params

  // Calculate date range if hoursBack specified
  let publishedAfter: string | undefined
  if (hoursBack) {
    const date = new Date(Date.now() - hoursBack * 60 * 60 * 1000)
    publishedAfter = date.toISOString().split('T')[0] // YYYY-MM-DD
  }

  // Try TheNewsAPI first if available
  if (isSourceAvailable('theNewsAPI')) {
    try {
      console.log('[NewsAggregator] Trying TheNewsAPI...')
      const result = await searchTheNewsAPI({
        query,
        categories,
        language,
        limit,
        published_after: publishedAfter,
      })

      if (result.rateLimited) {
        markRateLimited('theNewsAPI')
        // Fall through to try NewsData.io
      } else {
        return {
          articles: result.articles,
          source: 'thenewsapi',
          failedOver: false,
          meta: {
            totalFound: result.meta.found,
            returned: result.meta.returned,
          },
        }
      }
    } catch (error) {
      console.error('[NewsAggregator] TheNewsAPI error:', error)
      // Fall through to try NewsData.io
    }
  }

  // Try NewsData.io as backup
  if (isSourceAvailable('newsData')) {
    try {
      console.log('[NewsAggregator] Failing over to NewsData.io...')
      const result = await searchNewsData({
        query,
        category: categories,
        language,
        size: limit,
        from_date: publishedAfter,
      })

      if (result.rateLimited) {
        markRateLimited('newsData')
        // Return empty result, RSS would be next but needs separate implementation
      } else {
        return {
          articles: result.articles,
          source: 'newsdata',
          failedOver: true,
          failoverReason: 'Primary source (TheNewsAPI) unavailable',
          meta: {
            totalFound: result.meta.totalResults,
            returned: result.articles.length,
          },
        }
      }
    } catch (error) {
      console.error('[NewsAggregator] NewsData.io error:', error)
    }
  }

  // Both sources unavailable
  console.warn('[NewsAggregator] All news sources unavailable')
  return {
    articles: [],
    source: 'none',
    failedOver: true,
    failoverReason: 'All news sources are rate limited or unavailable',
    meta: {
      totalFound: 0,
      returned: 0,
    },
  }
}

/**
 * Get top headlines with automatic failover
 */
export async function getHeadlines(params: {
  categories?: string[]
  language?: string
  limit?: number
} = {}): Promise<AggregatorResult> {
  const { categories, language = 'en', limit = 10 } = params

  // Try TheNewsAPI first
  if (isSourceAvailable('theNewsAPI')) {
    try {
      console.log('[NewsAggregator] Getting headlines from TheNewsAPI...')
      const result = await getTheNewsAPIHeadlines({
        categories,
        language,
        limit,
      })

      if (result.rateLimited) {
        markRateLimited('theNewsAPI')
      } else {
        return {
          articles: result.articles,
          source: 'thenewsapi',
          failedOver: false,
          meta: {
            totalFound: result.articles.length,
            returned: result.articles.length,
          },
        }
      }
    } catch (error) {
      console.error('[NewsAggregator] TheNewsAPI headlines error:', error)
    }
  }

  // Try NewsData.io as backup
  if (isSourceAvailable('newsData')) {
    try {
      console.log('[NewsAggregator] Failing over to NewsData.io for headlines...')
      const result = await getNewsDataHeadlines({
        category: categories,
        language,
        size: limit,
      })

      if (result.rateLimited) {
        markRateLimited('newsData')
      } else {
        return {
          articles: result.articles,
          source: 'newsdata',
          failedOver: true,
          failoverReason: 'Primary source (TheNewsAPI) unavailable',
          meta: {
            totalFound: result.articles.length,
            returned: result.articles.length,
          },
        }
      }
    } catch (error) {
      console.error('[NewsAggregator] NewsData.io headlines error:', error)
    }
  }

  return {
    articles: [],
    source: 'none',
    failedOver: true,
    failoverReason: 'All news sources are rate limited or unavailable',
    meta: {
      totalFound: 0,
      returned: 0,
    },
  }
}

/**
 * Category mapping between APIs
 *
 * TheNewsAPI categories: general, business, entertainment, health, science, sports, tech, politics, food, travel
 * NewsData.io categories: business, crime, domestic, education, entertainment, environment, food, health, lifestyle, other, politics, science, sports, technology, top, tourism, world
 */
export function mapCategory(category: string, targetApi: 'thenewsapi' | 'newsdata'): string {
  const mappings: Record<string, { thenewsapi: string; newsdata: string }> = {
    general: { thenewsapi: 'general', newsdata: 'top' },
    business: { thenewsapi: 'business', newsdata: 'business' },
    entertainment: { thenewsapi: 'entertainment', newsdata: 'entertainment' },
    health: { thenewsapi: 'health', newsdata: 'health' },
    science: { thenewsapi: 'science', newsdata: 'science' },
    sports: { thenewsapi: 'sports', newsdata: 'sports' },
    tech: { thenewsapi: 'tech', newsdata: 'technology' },
    technology: { thenewsapi: 'tech', newsdata: 'technology' },
    politics: { thenewsapi: 'politics', newsdata: 'politics' },
    food: { thenewsapi: 'food', newsdata: 'food' },
    travel: { thenewsapi: 'travel', newsdata: 'tourism' },
    world: { thenewsapi: 'general', newsdata: 'world' },
    crime: { thenewsapi: 'general', newsdata: 'crime' },
    education: { thenewsapi: 'general', newsdata: 'education' },
    environment: { thenewsapi: 'science', newsdata: 'environment' },
    lifestyle: { thenewsapi: 'general', newsdata: 'lifestyle' },
  }

  const mapping = mappings[category.toLowerCase()]
  if (mapping) {
    return mapping[targetApi]
  }

  // Return as-is if no mapping found
  return category
}

/**
 * Reset rate limit state (useful for testing)
 */
export function resetRateLimits(): void {
  rateLimitState.theNewsAPI.isLimited = false
  rateLimitState.theNewsAPI.limitedAt = null
  rateLimitState.newsData.isLimited = false
  rateLimitState.newsData.limitedAt = null
}
