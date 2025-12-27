import { NextRequest, NextResponse } from 'next/server'

interface SearchResult {
  title: string
  url: string
  excerpt: string
  date: string | null
  author: string | null
  source: string
}

interface WebsiteConfig {
  name: string
  baseUrl: string
  searchPath: string
  searchParam: string
}

// Configured websites we can search
const SEARCHABLE_WEBSITES: Record<string, WebsiteConfig> = {
  letstalkbattlerap: {
    name: "Let's Talk Battle Rap",
    baseUrl: 'https://www.letstalkbattlerap.com',
    searchPath: '/',
    searchParam: 's',
  },
}

// Parse search results from Let's Talk Battle Rap (WordPress site)
async function searchLetsTalkBattleRap(query: string): Promise<SearchResult[]> {
  const config = SEARCHABLE_WEBSITES.letstalkbattlerap
  const searchUrl = `${config.baseUrl}${config.searchPath}?${config.searchParam}=${encodeURIComponent(query)}`

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'TalkShowGo/1.0 (News Aggregator)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const results: SearchResult[] = []

    // Parse WordPress search results
    // Looking for article elements with titles, links, excerpts
    const articleRegex = /<article[^>]*>[\s\S]*?<\/article>/gi
    const articles = html.match(articleRegex) || []

    for (const article of articles.slice(0, 20)) {
      // Extract title and URL
      const titleMatch = article.match(/<h[12][^>]*class="[^"]*entry-title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i)
      if (!titleMatch) continue

      const url = titleMatch[1]
      const title = titleMatch[2].trim()

      // Extract excerpt
      const excerptMatch = article.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                          article.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
      const excerpt = excerptMatch
        ? excerptMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) + '...'
        : ''

      // Extract date
      const dateMatch = article.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i) ||
                       article.match(/(\w+\s+\d{1,2},\s+\d{4})/i)
      const date = dateMatch ? dateMatch[1] : null

      // Extract author
      const authorMatch = article.match(/by\s+<a[^>]*>([^<]+)<\/a>/i) ||
                         article.match(/<span[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/span>/i)
      const author = authorMatch ? authorMatch[1].trim() : null

      results.push({
        title,
        url,
        excerpt,
        date,
        author,
        source: config.name,
      })
    }

    return results
  } catch (error) {
    console.error(`Error searching ${config.name}:`, error)
    return []
  }
}

// GET /api/search/website?site=letstalkbattlerap&q=geechi+gotti
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const site = searchParams.get('site')
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    let results: SearchResult[] = []

    if (site === 'letstalkbattlerap' || !site) {
      results = await searchLetsTalkBattleRap(query)
    } else if (!SEARCHABLE_WEBSITES[site]) {
      return NextResponse.json(
        { error: `Unknown site: ${site}. Available: ${Object.keys(SEARCHABLE_WEBSITES).join(', ')}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      query,
      site: site || 'letstalkbattlerap',
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('Error in website search:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}

// POST /api/search/website - Search with more options
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { site, query, entity } = body

    if (!query && !entity) {
      return NextResponse.json(
        { error: 'Either query or entity is required' },
        { status: 400 }
      )
    }

    const searchTerm = query || entity
    let results: SearchResult[] = []

    // Search all configured sites or specific one
    if (site && SEARCHABLE_WEBSITES[site]) {
      if (site === 'letstalkbattlerap') {
        results = await searchLetsTalkBattleRap(searchTerm)
      }
    } else {
      // Search all sites
      results = await searchLetsTalkBattleRap(searchTerm)
    }

    return NextResponse.json({
      query: searchTerm,
      entity: entity || null,
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('Error in website search:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
