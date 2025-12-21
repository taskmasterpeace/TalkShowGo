/**
 * News API Endpoint
 *
 * GET /api/intelligence/news - Search for news articles
 * POST /api/intelligence/news - Search with advanced options
 *
 * Uses the news aggregator with automatic failover:
 * 1. TheNewsAPI (primary)
 * 2. NewsData.io (backup)
 * 3. RSS feeds (tertiary - on demand)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  searchNews,
  getHeadlines,
  getAggregatorStatus,
} from '@/lib/news-aggregator'
import {
  searchRSSArticles,
  fetchFeedsByCategory,
} from '@/lib/rss-fetcher'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/intelligence/news
 *
 * Query params:
 * - q: Search query (optional)
 * - category: Category filter (optional)
 * - limit: Max articles to return (default 10, max 50)
 * - hoursBack: Only articles from last N hours
 * - source: Force specific source ('api' | 'rss' | 'auto')
 * - headlines: If 'true', get top headlines instead of search
 * - status: If 'true', return aggregator status only
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Status check
    if (searchParams.get('status') === 'true') {
      const status = getAggregatorStatus()
      return NextResponse.json({
        success: true,
        status,
      })
    }

    const query = searchParams.get('q') || undefined
    const category = searchParams.get('category') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const hoursBack = searchParams.get('hoursBack')
      ? parseInt(searchParams.get('hoursBack')!)
      : undefined
    const source = searchParams.get('source') || 'auto'
    const headlines = searchParams.get('headlines') === 'true'

    // Force RSS source
    if (source === 'rss') {
      if (query) {
        const result = await searchRSSArticles(query, {
          limit,
          hoursBack: hoursBack || 168, // Default 1 week
        })

        return NextResponse.json({
          success: true,
          articles: result.articles,
          source: 'rss',
          meta: {
            feedsChecked: result.feedsChecked,
            feedsFailed: result.feedsFailed,
          },
        })
      } else if (category) {
        const result = await fetchFeedsByCategory(
          category as any,
          limit
        )

        return NextResponse.json({
          success: true,
          articles: result.articles,
          source: 'rss',
          meta: {
            feedsChecked: result.feedsChecked,
            feedsFailed: result.feedsFailed,
          },
        })
      }
    }

    // Headlines mode
    if (headlines) {
      const result = await getHeadlines({
        categories: category ? [category] : undefined,
        limit,
      })

      return NextResponse.json({
        success: true,
        articles: result.articles,
        source: result.source,
        failedOver: result.failedOver,
        failoverReason: result.failoverReason,
        meta: result.meta,
      })
    }

    // Search mode
    const result = await searchNews({
      query,
      categories: category ? [category] : undefined,
      limit,
      hoursBack,
    })

    // If API sources failed, try RSS as fallback
    if (result.source === 'none' && source === 'auto') {
      console.log('[News API] API sources failed, trying RSS fallback...')

      let rssResult
      if (query) {
        rssResult = await searchRSSArticles(query, {
          limit,
          hoursBack: hoursBack || 168,
        })
      } else {
        const { fetchDefaultFeeds } = await import('@/lib/rss-fetcher')
        rssResult = await fetchDefaultFeeds(limit)
      }

      return NextResponse.json({
        success: true,
        articles: rssResult.articles,
        source: 'rss',
        failedOver: true,
        failoverReason: 'All API sources unavailable, using RSS feeds',
        meta: {
          feedsChecked: rssResult.feedsChecked,
          feedsFailed: rssResult.feedsFailed,
        },
      })
    }

    return NextResponse.json({
      success: true,
      articles: result.articles,
      source: result.source,
      failedOver: result.failedOver,
      failoverReason: result.failoverReason,
      meta: result.meta,
    })
  } catch (error) {
    console.error('[News API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'News search failed',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/intelligence/news
 *
 * Body:
 * {
 *   query?: string
 *   categories?: string[]
 *   language?: string
 *   limit?: number
 *   hoursBack?: number
 *   forceSource?: 'api' | 'rss'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      query,
      categories,
      language = 'en',
      limit = 10,
      hoursBack,
      forceSource,
    } = body

    // Validate limit
    const validLimit = Math.min(Math.max(1, limit), 50)

    // Force RSS
    if (forceSource === 'rss') {
      if (query) {
        const result = await searchRSSArticles(query, {
          limit: validLimit,
          hoursBack: hoursBack || 168,
        })

        return NextResponse.json({
          success: true,
          articles: result.articles,
          source: 'rss',
          meta: {
            feedsChecked: result.feedsChecked,
            feedsFailed: result.feedsFailed,
          },
        })
      } else {
        const category = categories?.[0]
        if (category) {
          const result = await fetchFeedsByCategory(category as any, validLimit)
          return NextResponse.json({
            success: true,
            articles: result.articles,
            source: 'rss',
            meta: {
              feedsChecked: result.feedsChecked,
              feedsFailed: result.feedsFailed,
            },
          })
        }
      }
    }

    // Use aggregator (with automatic failover)
    const result = await searchNews({
      query,
      categories,
      language,
      limit: validLimit,
      hoursBack,
    })

    // RSS fallback if APIs failed
    if (result.source === 'none') {
      let rssResult
      if (query) {
        rssResult = await searchRSSArticles(query, {
          limit: validLimit,
          hoursBack: hoursBack || 168,
        })
      } else {
        const { fetchDefaultFeeds } = await import('@/lib/rss-fetcher')
        rssResult = await fetchDefaultFeeds(validLimit)
      }

      return NextResponse.json({
        success: true,
        articles: rssResult.articles,
        source: 'rss',
        failedOver: true,
        failoverReason: 'All API sources unavailable, using RSS feeds',
        meta: {
          feedsChecked: rssResult.feedsChecked,
          feedsFailed: rssResult.feedsFailed,
        },
      })
    }

    return NextResponse.json({
      success: true,
      articles: result.articles,
      source: result.source,
      failedOver: result.failedOver,
      failoverReason: result.failoverReason,
      meta: result.meta,
    })
  } catch (error) {
    console.error('[News API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'News search failed',
      },
      { status: 500 }
    )
  }
}
