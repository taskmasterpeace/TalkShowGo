/**
 * Web Search Library
 *
 * Uses SearXNG (self-hosted) for web search capabilities.
 * SearXNG aggregates results from Google, Bing, DuckDuckGo, Wikipedia, etc.
 */

const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8888'

interface SearXNGResult {
  url: string
  title: string
  content: string
  engine: string
  category?: string
  score?: number
  publishedDate?: string
}

export interface WebSearchResult {
  title: string
  url: string
  content: string  // Snippet/description
  engine: string   // Which search engine returned this
  category: string
  published_date?: string
}

export interface WebSearchOptions {
  max_results?: number
  categories?: ('general' | 'news' | 'social media' | 'images' | 'videos')[]
  engines?: string[]  // Specific engines: google, bing, duckduckgo, wikipedia
  time_range?: 'day' | 'week' | 'month' | 'year'
  language?: string
}

export interface EntityInfo {
  name: string
  summary?: string
  wikipedia_url?: string
  related_urls: string[]
  facts: Record<string, string>
}

/**
 * Search the web using SearXNG
 */
export async function searchWeb(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult[]> {
  const {
    max_results = 10,
    categories = ['general'],
    engines,
    time_range,
    language = 'en'
  } = options

  // Build SearXNG query params
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    language: language
  })

  // Add categories
  if (categories.length > 0) {
    params.set('categories', categories.join(','))
  }

  // Add specific engines if requested
  if (engines && engines.length > 0) {
    params.set('engines', engines.join(','))
  }

  // Add time range
  if (time_range) {
    params.set('time_range', time_range)
  }

  try {
    const response = await fetch(`${SEARXNG_URL}/search?${params.toString()}`)

    if (!response.ok) {
      throw new Error(`SearXNG error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Map SearXNG results to our format
    const results: WebSearchResult[] = (data.results || [])
      .slice(0, max_results)
      .map((result: SearXNGResult) => ({
        title: result.title || '',
        url: result.url || '',
        content: result.content || '',
        engine: result.engine || 'unknown',
        category: result.category || 'general',
        published_date: result.publishedDate
      }))

    return results
  } catch (error) {
    console.error('Web search error:', error)
    throw error
  }
}

/**
 * Search for entity information
 * Combines Wikipedia + general web search for context
 */
export async function searchEntity(
  entityName: string,
  nicheKeywords: string[] = []
): Promise<EntityInfo> {
  // Build search query with niche context
  const contextQuery = nicheKeywords.length > 0
    ? `${entityName} ${nicheKeywords.slice(0, 2).join(' ')}`
    : entityName

  // Search Wikipedia specifically
  const wikiResults = await searchWeb(`${entityName}`, {
    max_results: 3,
    engines: ['wikipedia']
  })

  // General web search with niche context
  const webResults = await searchWeb(contextQuery, {
    max_results: 10,
    categories: ['general', 'news']
  })

  // Build entity info from results
  const entityInfo: EntityInfo = {
    name: entityName,
    related_urls: [],
    facts: {}
  }

  // Get Wikipedia summary if found
  const wikiResult = wikiResults.find(r => r.url.includes('wikipedia.org'))
  if (wikiResult) {
    entityInfo.wikipedia_url = wikiResult.url
    entityInfo.summary = wikiResult.content
  }

  // Collect related URLs
  entityInfo.related_urls = webResults
    .filter(r => !r.url.includes('wikipedia.org'))
    .map(r => r.url)
    .slice(0, 10)

  return entityInfo
}

/**
 * Search for news about a topic
 */
export async function searchNews(
  query: string,
  options: { max_results?: number; time_range?: 'day' | 'week' | 'month' } = {}
): Promise<WebSearchResult[]> {
  const { max_results = 10, time_range = 'week' } = options

  return searchWeb(query, {
    max_results,
    categories: ['news'],
    time_range
  })
}

/**
 * Quick web context lookup - returns just snippets for LLM context
 */
export async function getWebContext(
  query: string,
  maxSnippets: number = 5
): Promise<string[]> {
  const results = await searchWeb(query, { max_results: maxSnippets })
  return results.map(r => `${r.title}: ${r.content}`)
}

/**
 * Check if SearXNG is available
 */
export async function checkSearXNGHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SEARXNG_URL}/healthz`)
    return response.ok
  } catch {
    // Try a simple search as fallback health check
    try {
      const response = await fetch(`${SEARXNG_URL}/search?q=test&format=json`)
      return response.ok
    } catch {
      return false
    }
  }
}
