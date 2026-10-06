/**
 * RSS Source Adapter
 *
 * Fetches articles from RSS feeds with proper date handling
 */

import { TimeRange, isWithinTimeRange } from '../time-range'
import {
  SourceAdapter,
  SourceConfig,
  UnifiedContent,
  RSSArticle,
  rssToUnified,
} from './types'
import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ContentKingdom/1.0)',
  },
})

/**
 * Fetch articles from an RSS feed
 */
export async function fetchRSSFeed(
  feedUrl: string,
  timeRange: TimeRange
): Promise<RSSArticle[]> {
  try {
    const feed = await parser.parseURL(feedUrl)
    const feedTitle = feed.title || 'Unknown Feed'

    const articles: RSSArticle[] = []

    for (const item of feed.items || []) {
      // Parse the publication date
      const pubDate = item.pubDate || item.isoDate
      if (!pubDate) continue

      const publishedAt = new Date(pubDate)
      if (isNaN(publishedAt.getTime())) continue

      // Check time range
      if (!isWithinTimeRange(publishedAt, timeRange)) continue

      articles.push({
        id: item.guid || item.link || `${feedUrl}:${item.title}`,
        title: item.title || 'Untitled',
        link: item.link || '',
        description: item.contentSnippet || item.summary || '',
        content: item.content || item['content:encoded'] || '',
        author: item.creator || item.author || '',
        published_at: publishedAt,
        categories: item.categories || [],
        enclosure_url: item.enclosure?.url,
        feed_title: feedTitle,
      })
    }

    return articles
  } catch (error) {
    console.error(`[RSS] Error fetching ${feedUrl}:`, error)
    return []
  }
}

/**
 * Fetch from multiple RSS feeds
 */
export async function fetchMultipleFeeds(
  feedUrls: string[],
  timeRange: TimeRange
): Promise<RSSArticle[]> {
  const results = await Promise.allSettled(
    feedUrls.map((url) => fetchRSSFeed(url, timeRange))
  )

  const allArticles: RSSArticle[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value)
    }
  }

  // Sort by date (newest first)
  allArticles.sort(
    (a, b) => b.published_at.getTime() - a.published_at.getTime()
  )

  return allArticles
}

/**
 * RSS Source Adapter
 * Implements SourceAdapter interface for unified source fetching
 */
export class RSSAdapter implements SourceAdapter {
  name: 'rss' = 'rss'

  isConfigured(): boolean {
    // RSS is always available, no API key needed
    return true
  }

  async fetchContent(config: SourceConfig): Promise<UnifiedContent[]> {
    if (!config.feed_urls || config.feed_urls.length === 0) {
      return []
    }

    console.log(
      `[RSS] Fetching ${config.feed_urls.length} feeds (last ${config.time_range.hours_back}h)`
    )

    const articles = await fetchMultipleFeeds(
      config.feed_urls,
      config.time_range
    )

    console.log(`[RSS] Got ${articles.length} articles`)

    // Convert to unified content
    const content = articles.map(rssToUnified)

    // Apply max items limit
    const maxItems = config.max_items || 50
    return content.slice(0, maxItems)
  }
}

// Singleton instance
let adapter: RSSAdapter | null = null

export function getRSSAdapter(): RSSAdapter {
  if (!adapter) {
    adapter = new RSSAdapter()
  }
  return adapter
}
