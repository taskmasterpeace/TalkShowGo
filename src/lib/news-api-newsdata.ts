/**
 * NewsData.io Client
 *
 * Backup/failover news source for the aggregator.
 * Docs: https://newsdata.io/documentation
 *
 * Free tier: 200 credits/day, 12-hour delay
 * Basic ($199/mo): 20,000 credits/month, real-time
 */

import { NormalizedArticle } from './news-api-thenewsapi'

const NEWSDATA_BASE_URL = 'https://newsdata.io/api/1'

export interface NewsDataArticle {
  article_id: string
  title: string
  link: string
  keywords: string[] | null
  creator: string[] | null
  video_url: string | null
  description: string | null
  content: string | null
  pubDate: string
  image_url: string | null
  source_id: string
  source_name: string
  source_url: string
  source_icon: string | null
  language: string
  country: string[]
  category: string[]
  ai_tag?: string
  sentiment?: string
  sentiment_stats?: object
  ai_region?: string
}

export interface NewsDataResponse {
  status: string
  totalResults: number
  results: NewsDataArticle[]
  nextPage?: string
}

export interface NewsDataSearchParams {
  query?: string
  category?: string[]
  language?: string
  country?: string[]
  size?: number  // max 50 for free, 50 for paid
  page?: string
  from_date?: string  // YYYY-MM-DD
  to_date?: string    // YYYY-MM-DD
  domain?: string[]
  domainurl?: string[]
  excludedomain?: string[]
}

/**
 * Check if NewsData.io is configured
 */
export function isNewsDataConfigured(): boolean {
  return !!process.env.NEWSDATA_API_KEY
}

/**
 * Get the API key (for health checks)
 */
export function getNewsDataAPIKey(): string | undefined {
  return process.env.NEWSDATA_API_KEY
}

/**
 * Normalize NewsData.io article to common format
 */
function normalizeArticle(article: NewsDataArticle): NormalizedArticle {
  return {
    id: article.article_id,
    title: article.title,
    description: article.description || '',
    content: article.content || article.description || '',
    url: article.link,
    imageUrl: article.image_url,
    publishedAt: article.pubDate,
    source: article.source_url,
    sourceName: article.source_name,
    categories: article.category || [],
    provider: 'newsdata',
  }
}

/**
 * Search for news articles using NewsData.io
 */
export async function searchNews(params: NewsDataSearchParams): Promise<{
  articles: NormalizedArticle[]
  meta: {
    totalResults: number
    nextPage?: string
  }
  rateLimited: boolean
}> {
  const apiKey = process.env.NEWSDATA_API_KEY

  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY not configured')
  }

  // Build query parameters
  const queryParams = new URLSearchParams({
    apikey: apiKey,
    language: params.language || 'en',
    size: String(params.size || 10),
  })

  if (params.query) {
    queryParams.set('q', params.query)
  }

  if (params.category?.length) {
    queryParams.set('category', params.category.join(','))
  }

  if (params.country?.length) {
    queryParams.set('country', params.country.join(','))
  }

  if (params.from_date) {
    queryParams.set('from_date', params.from_date)
  }

  if (params.to_date) {
    queryParams.set('to_date', params.to_date)
  }

  if (params.domain?.length) {
    queryParams.set('domain', params.domain.join(','))
  }

  if (params.domainurl?.length) {
    queryParams.set('domainurl', params.domainurl.join(','))
  }

  if (params.excludedomain?.length) {
    queryParams.set('excludedomain', params.excludedomain.join(','))
  }

  if (params.page) {
    queryParams.set('page', params.page)
  }

  try {
    const response = await fetch(
      `${NEWSDATA_BASE_URL}/latest?${queryParams.toString()}`,
      {
        signal: AbortSignal.timeout(15000),
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    // Handle rate limiting
    if (response.status === 429) {
      console.warn('[NewsData.io] Rate limited')
      return {
        articles: [],
        meta: { totalResults: 0 },
        rateLimited: true,
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NewsData.io error ${response.status}: ${errorText}`)
    }

    const data: NewsDataResponse = await response.json()

    // Check for error in response body
    if (data.status !== 'success') {
      throw new Error(`NewsData.io returned status: ${data.status}`)
    }

    return {
      articles: (data.results || []).map(normalizeArticle),
      meta: {
        totalResults: data.totalResults,
        nextPage: data.nextPage,
      },
      rateLimited: false,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('NewsData.io request timed out')
    }
    throw error
  }
}

/**
 * Get news by category (headlines)
 */
export async function getHeadlinesByCategory(params: {
  category?: string[]
  language?: string
  country?: string[]
  size?: number
} = {}): Promise<{
  articles: NormalizedArticle[]
  rateLimited: boolean
}> {
  const apiKey = process.env.NEWSDATA_API_KEY

  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY not configured')
  }

  const queryParams = new URLSearchParams({
    apikey: apiKey,
    language: params.language || 'en',
    size: String(params.size || 10),
  })

  if (params.category?.length) {
    queryParams.set('category', params.category.join(','))
  }

  if (params.country?.length) {
    queryParams.set('country', params.country.join(','))
  }

  try {
    const response = await fetch(
      `${NEWSDATA_BASE_URL}/latest?${queryParams.toString()}`,
      {
        signal: AbortSignal.timeout(15000),
      }
    )

    if (response.status === 429) {
      return { articles: [], rateLimited: true }
    }

    if (!response.ok) {
      throw new Error(`NewsData.io error: ${response.status}`)
    }

    const data: NewsDataResponse = await response.json()

    return {
      articles: (data.results || []).map(normalizeArticle),
      rateLimited: false,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('NewsData.io request timed out')
    }
    throw error
  }
}

/**
 * Search news archive (requires paid plan)
 */
export async function searchArchive(params: NewsDataSearchParams): Promise<{
  articles: NormalizedArticle[]
  meta: {
    totalResults: number
    nextPage?: string
  }
  rateLimited: boolean
}> {
  const apiKey = process.env.NEWSDATA_API_KEY

  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY not configured')
  }

  const queryParams = new URLSearchParams({
    apikey: apiKey,
    language: params.language || 'en',
    size: String(params.size || 10),
  })

  if (params.query) {
    queryParams.set('q', params.query)
  }

  if (params.category?.length) {
    queryParams.set('category', params.category.join(','))
  }

  if (params.from_date) {
    queryParams.set('from_date', params.from_date)
  }

  if (params.to_date) {
    queryParams.set('to_date', params.to_date)
  }

  if (params.page) {
    queryParams.set('page', params.page)
  }

  try {
    const response = await fetch(
      `${NEWSDATA_BASE_URL}/archive?${queryParams.toString()}`,
      {
        signal: AbortSignal.timeout(15000),
      }
    )

    if (response.status === 429) {
      return {
        articles: [],
        meta: { totalResults: 0 },
        rateLimited: true,
      }
    }

    if (!response.ok) {
      throw new Error(`NewsData.io archive error: ${response.status}`)
    }

    const data: NewsDataResponse = await response.json()

    return {
      articles: (data.results || []).map(normalizeArticle),
      meta: {
        totalResults: data.totalResults,
        nextPage: data.nextPage,
      },
      rateLimited: false,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('NewsData.io archive request timed out')
    }
    throw error
  }
}

/**
 * Available categories in NewsData.io
 */
export const NEWSDATA_CATEGORIES = [
  'business',
  'crime',
  'domestic',
  'education',
  'entertainment',
  'environment',
  'food',
  'health',
  'lifestyle',
  'other',
  'politics',
  'science',
  'sports',
  'technology',
  'top',
  'tourism',
  'world',
] as const

export type NewsDataCategory = typeof NEWSDATA_CATEGORIES[number]
