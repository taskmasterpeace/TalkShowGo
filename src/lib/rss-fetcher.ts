/**
 * RSS Feed Fetcher
 *
 * Free, unlimited news source via RSS feeds.
 * Used as tertiary fallback when API sources are rate limited.
 */

import Parser from 'rss-parser'
import { NormalizedArticle } from './news-api-thenewsapi'
import { DEFAULT_RSS_FEEDS, RSS_FEEDS_BY_CATEGORY, RSSFeedConfig } from './rss-feeds-config'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'TalkShowGo/1.0 (RSS Reader)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
})

export interface RSSItem {
  title?: string
  link?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  creator?: string
  categories?: string[]
  isoDate?: string
  guid?: string
  enclosure?: {
    url?: string
    type?: string
    length?: string
  }
  mediaContent?: {
    $?: {
      url?: string
      medium?: string
    }
  }
  mediaThumbnail?: {
    $?: {
      url?: string
    }
  }
  contentEncoded?: string
}

export interface RSSFeed {
  title?: string
  description?: string
  link?: string
  items: RSSItem[]
}

export interface RSSFetchResult {
  articles: NormalizedArticle[]
  feedsChecked: number
  feedsFailed: number
  errors: string[]
}

/**
 * Extract image URL from RSS item
 */
function extractImageUrl(item: RSSItem): string | null {
  // Try enclosure first (common for podcasts/media)
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url
  }

  // Try media:content
  if (item.mediaContent?.$?.url) {
    return item.mediaContent.$.url
  }

  // Try media:thumbnail
  if (item.mediaThumbnail?.$?.url) {
    return item.mediaThumbnail.$.url
  }

  // Try to extract from content
  const content = item.contentEncoded || item.content || ''
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/)
  if (imgMatch) {
    return imgMatch[1]
  }

  return null
}

/**
 * Normalize RSS item to common article format
 */
function normalizeRSSItem(item: RSSItem, feedTitle: string, feedUrl: string): NormalizedArticle {
  const publishedAt = item.isoDate || item.pubDate || new Date().toISOString()

  return {
    id: item.guid || item.link || `rss-${Date.now()}-${Math.random()}`,
    title: item.title || 'Untitled',
    description: item.contentSnippet || item.content?.slice(0, 300) || '',
    content: item.contentEncoded || item.content || item.contentSnippet || '',
    url: item.link || '',
    imageUrl: extractImageUrl(item),
    publishedAt,
    source: feedUrl,
    sourceName: feedTitle,
    categories: item.categories || [],
    provider: 'rss',
  }
}

/**
 * Fetch a single RSS feed
 */
export async function fetchFeed(url: string): Promise<{
  feed: RSSFeed | null
  error?: string
}> {
  try {
    const feed = await parser.parseURL(url)
    return { feed: feed as RSSFeed }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[RSS] Failed to fetch ${url}:`, message)
    return { feed: null, error: message }
  }
}

/**
 * Fetch multiple RSS feeds in parallel
 */
export async function fetchFeeds(feeds: RSSFeedConfig[]): Promise<RSSFetchResult> {
  const results = await Promise.allSettled(
    feeds.map(async (feedConfig) => {
      const { feed, error } = await fetchFeed(feedConfig.url)
      if (error || !feed) {
        return { success: false, error: error || 'Empty feed', feedConfig }
      }

      const articles = (feed.items || []).map((item) =>
        normalizeRSSItem(item, feedConfig.name, feedConfig.url)
      )

      return { success: true, articles, feedConfig }
    })
  )

  const allArticles: NormalizedArticle[] = []
  const errors: string[] = []
  let feedsFailed = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.success && result.value.articles) {
        allArticles.push(...result.value.articles)
      } else {
        feedsFailed++
        errors.push(`${result.value.feedConfig.name}: ${result.value.error}`)
      }
    } else {
      feedsFailed++
      errors.push(`Feed error: ${result.reason}`)
    }
  }

  // Sort by published date, newest first
  allArticles.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })

  return {
    articles: allArticles,
    feedsChecked: feeds.length,
    feedsFailed,
    errors,
  }
}

/**
 * Fetch all default RSS feeds
 */
export async function fetchDefaultFeeds(limit?: number): Promise<RSSFetchResult> {
  const result = await fetchFeeds(DEFAULT_RSS_FEEDS)

  if (limit && result.articles.length > limit) {
    result.articles = result.articles.slice(0, limit)
  }

  return result
}

/**
 * Fetch RSS feeds by category
 */
export async function fetchFeedsByCategory(
  category: keyof typeof RSS_FEEDS_BY_CATEGORY,
  limit?: number
): Promise<RSSFetchResult> {
  const feeds = RSS_FEEDS_BY_CATEGORY[category] || []
  const result = await fetchFeeds(feeds)

  if (limit && result.articles.length > limit) {
    result.articles = result.articles.slice(0, limit)
  }

  return result
}

/**
 * Search RSS articles by keyword
 * Note: This fetches all feeds first, then filters - use sparingly
 */
export async function searchRSSArticles(
  query: string,
  options: {
    feeds?: RSSFeedConfig[]
    limit?: number
    hoursBack?: number
  } = {}
): Promise<RSSFetchResult> {
  const feeds = options.feeds || DEFAULT_RSS_FEEDS
  const result = await fetchFeeds(feeds)

  const queryLower = query.toLowerCase()
  const now = Date.now()
  const hoursBackMs = (options.hoursBack || 168) * 60 * 60 * 1000 // Default 1 week

  // Filter by query and time
  result.articles = result.articles.filter((article) => {
    // Time filter
    const articleTime = new Date(article.publishedAt).getTime()
    if (now - articleTime > hoursBackMs) {
      return false
    }

    // Query filter
    const searchText = `${article.title} ${article.description} ${article.content}`.toLowerCase()
    return searchText.includes(queryLower)
  })

  if (options.limit && result.articles.length > options.limit) {
    result.articles = result.articles.slice(0, options.limit)
  }

  return result
}

/**
 * Check if RSS feeds are working
 */
export async function checkRSSHealth(): Promise<{
  available: boolean
  feedsWorking: number
  feedsTotal: number
}> {
  // Just test a couple of feeds to check if RSS is working
  const testFeeds = DEFAULT_RSS_FEEDS.slice(0, 3)
  const result = await fetchFeeds(testFeeds)

  return {
    available: result.feedsChecked - result.feedsFailed > 0,
    feedsWorking: result.feedsChecked - result.feedsFailed,
    feedsTotal: result.feedsChecked,
  }
}
