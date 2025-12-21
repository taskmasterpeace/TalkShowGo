/**
 * TheNewsAPI Client
 *
 * Primary news source for the aggregator.
 * Docs: https://www.thenewsapi.com/documentation
 *
 * Free tier: 100 requests/day, 3 articles per request
 * Basic ($19/mo): 2,500 requests/day, 25 articles per request
 */

const THENEWSAPI_BASE_URL = 'https://api.thenewsapi.com/v1'

export interface TheNewsArticle {
  uuid: string
  title: string
  description: string
  snippet: string
  url: string
  image_url: string | null
  published_at: string
  source: string
  categories: string[]
  relevance_score: number | null
  locale: string
}

export interface TheNewsResponse {
  meta: {
    found: number
    returned: number
    limit: number
    page: number
  }
  data: TheNewsArticle[]
}

export interface TheNewsSearchParams {
  query?: string
  categories?: string[]
  language?: string
  countries?: string[]
  limit?: number
  page?: number
  published_after?: string  // ISO date
  published_before?: string // ISO date
  domains?: string[]
  exclude_domains?: string[]
}

// Normalized article format for the aggregator
export interface NormalizedArticle {
  id: string
  title: string
  description: string
  content: string
  url: string
  imageUrl: string | null
  publishedAt: string
  source: string
  sourceName: string
  categories: string[]
  provider: 'thenewsapi' | 'newsdata' | 'rss'
}

/**
 * Check if TheNewsAPI is configured
 */
export function isTheNewsAPIConfigured(): boolean {
  return !!process.env.THENEWSAPI_KEY
}

/**
 * Get the API key (for health checks)
 */
export function getTheNewsAPIKey(): string | undefined {
  return process.env.THENEWSAPI_KEY
}

/**
 * Normalize TheNewsAPI article to common format
 */
function normalizeArticle(article: TheNewsArticle): NormalizedArticle {
  return {
    id: article.uuid,
    title: article.title,
    description: article.description || article.snippet,
    content: article.snippet,
    url: article.url,
    imageUrl: article.image_url,
    publishedAt: article.published_at,
    source: article.url,
    sourceName: article.source,
    categories: article.categories || [],
    provider: 'thenewsapi',
  }
}

/**
 * Search for news articles using TheNewsAPI
 */
export async function searchNews(params: TheNewsSearchParams): Promise<{
  articles: NormalizedArticle[]
  meta: {
    found: number
    returned: number
    page: number
  }
  rateLimited: boolean
}> {
  const apiKey = process.env.THENEWSAPI_KEY

  if (!apiKey) {
    throw new Error('THENEWSAPI_KEY not configured')
  }

  // Build query parameters
  const queryParams = new URLSearchParams({
    api_token: apiKey,
    language: params.language || 'en',
    limit: String(params.limit || 10),
    page: String(params.page || 1),
  })

  if (params.query) {
    queryParams.set('search', params.query)
  }

  if (params.categories?.length) {
    queryParams.set('categories', params.categories.join(','))
  }

  if (params.countries?.length) {
    queryParams.set('locale', params.countries.join(','))
  }

  if (params.published_after) {
    queryParams.set('published_after', params.published_after)
  }

  if (params.published_before) {
    queryParams.set('published_before', params.published_before)
  }

  if (params.domains?.length) {
    queryParams.set('domains', params.domains.join(','))
  }

  if (params.exclude_domains?.length) {
    queryParams.set('exclude_domains', params.exclude_domains.join(','))
  }

  try {
    const response = await fetch(
      `${THENEWSAPI_BASE_URL}/news/all?${queryParams.toString()}`,
      {
        signal: AbortSignal.timeout(15000),
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    // Handle rate limiting
    if (response.status === 429) {
      console.warn('[TheNewsAPI] Rate limited')
      return {
        articles: [],
        meta: { found: 0, returned: 0, page: 1 },
        rateLimited: true,
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TheNewsAPI error ${response.status}: ${errorText}`)
    }

    const data: TheNewsResponse = await response.json()

    return {
      articles: data.data.map(normalizeArticle),
      meta: {
        found: data.meta.found,
        returned: data.meta.returned,
        page: data.meta.page,
      },
      rateLimited: false,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('TheNewsAPI request timed out')
    }
    throw error
  }
}

/**
 * Get top headlines (uses /news/top endpoint)
 */
export async function getTopHeadlines(params: {
  categories?: string[]
  language?: string
  limit?: number
} = {}): Promise<{
  articles: NormalizedArticle[]
  rateLimited: boolean
}> {
  const apiKey = process.env.THENEWSAPI_KEY

  if (!apiKey) {
    throw new Error('THENEWSAPI_KEY not configured')
  }

  const queryParams = new URLSearchParams({
    api_token: apiKey,
    language: params.language || 'en',
    limit: String(params.limit || 10),
  })

  if (params.categories?.length) {
    queryParams.set('categories', params.categories.join(','))
  }

  try {
    const response = await fetch(
      `${THENEWSAPI_BASE_URL}/news/top?${queryParams.toString()}`,
      {
        signal: AbortSignal.timeout(15000),
      }
    )

    if (response.status === 429) {
      return { articles: [], rateLimited: true }
    }

    if (!response.ok) {
      throw new Error(`TheNewsAPI error: ${response.status}`)
    }

    const data: TheNewsResponse = await response.json()

    return {
      articles: data.data.map(normalizeArticle),
      rateLimited: false,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('TheNewsAPI request timed out')
    }
    throw error
  }
}

/**
 * Available categories in TheNewsAPI
 */
export const THENEWSAPI_CATEGORIES = [
  'general',
  'business',
  'entertainment',
  'health',
  'science',
  'sports',
  'tech',
  'politics',
  'food',
  'travel',
] as const

export type TheNewsAPICategory = typeof THENEWSAPI_CATEGORIES[number]
