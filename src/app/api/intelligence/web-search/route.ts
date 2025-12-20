/**
 * Web Search API
 *
 * POST /api/intelligence/web-search
 *
 * Search the web using self-hosted SearXNG.
 * Useful for entity background info, news, and general context.
 *
 * Body:
 * - query: string (required) - What to search for
 * - topic_id: string (optional) - For logging/tracking
 * - max_results: number (default 10)
 * - categories: string[] (default ['general']) - 'general', 'news', 'social media'
 * - engines: string[] (optional) - 'google', 'bing', 'duckduckgo', 'wikipedia'
 * - time_range: string (optional) - 'day', 'week', 'month', 'year'
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchWeb, searchEntity, searchNews, checkSearXNGHealth } from '@/lib/web-search'
import { supabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      query,
      topic_id,
      max_results = 10,
      categories = ['general'],
      engines,
      time_range,
      search_type = 'web'  // 'web', 'entity', 'news'
    } = body

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    // Check SearXNG availability
    const isHealthy = await checkSearXNGHealth()
    if (!isHealthy) {
      return NextResponse.json({
        error: 'SearXNG service unavailable',
        details: 'Start SearXNG with: docker-compose up -d searxng'
      }, { status: 503 })
    }

    let results
    let resultType = search_type

    switch (search_type) {
      case 'entity':
        // Get entity info from Wikipedia + web
        const topicConfig = topic_id ? await getTopicKeywords(topic_id) : []
        results = await searchEntity(query, topicConfig)
        break

      case 'news':
        // News-specific search
        results = await searchNews(query, { max_results, time_range })
        break

      case 'web':
      default:
        // General web search
        results = await searchWeb(query, {
          max_results,
          categories,
          engines,
          time_range
        })
        break
    }

    // Log the search if topic_id provided
    if (topic_id) {
      await supabase.from('research_queries').insert({
        topic_id,
        query,
        query_type: `web_search_${search_type}`,
        results_count: Array.isArray(results) ? results.length : 1
      })
    }

    return NextResponse.json({
      success: true,
      query,
      search_type: resultType,
      result_count: Array.isArray(results) ? results.length : 1,
      results
    })
  } catch (error) {
    console.error('Web search error:', error)
    return NextResponse.json({
      error: 'Web search failed',
      details: String(error)
    }, { status: 500 })
  }
}

// GET endpoint for quick searches
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const max_results = parseInt(searchParams.get('max') || '5')

  if (!query) {
    return NextResponse.json({ error: 'q parameter is required' }, { status: 400 })
  }

  try {
    const results = await searchWeb(query, { max_results })

    return NextResponse.json({
      query,
      results
    })
  } catch (error) {
    console.error('Web search error:', error)
    return NextResponse.json({
      error: 'Web search failed',
      details: String(error)
    }, { status: 500 })
  }
}

/**
 * Get topic keywords for entity context
 */
async function getTopicKeywords(topic_id: string): Promise<string[]> {
  const { data: topic } = await supabase
    .from('topics')
    .select('name, intel_config')
    .eq('id', topic_id)
    .single()

  if (!topic) return []

  const keywords: string[] = [topic.name]
  if (topic.intel_config?.known_entities) {
    keywords.push(...topic.intel_config.known_entities.slice(0, 5))
  }

  return keywords
}
