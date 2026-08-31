/**
 * PERPLEXITY SONAR CLIENT
 *
 * Integration with Perplexity's Sonar API for AI-powered web search.
 * Provides grounded search results with citations.
 *
 * Models:
 * - sonar: Lightweight, fast search ($0.006 per query avg)
 * - sonar-pro: Deeper retrieval with follow-ups
 *
 * API Docs: https://docs.perplexity.ai/
 */

import { trackPerplexityCall, getPerplexityCreditsRemaining, PERPLEXITY_MONTHLY_CREDITS } from './api-usage'
import { getAPIKey } from './api-keys'

// ============================================
// TYPES
// ============================================

export interface PerplexitySearchOptions {
  query: string
  systemPrompt?: string
  model?: 'sonar' | 'sonar-pro'
  search_recency_filter?: 'day' | 'week' | 'month' | 'year'
  search_domain_filter?: string[]  // Include domains, prefix with - to exclude
  return_citations?: boolean
  return_related_questions?: boolean
  response_format?: PerplexityResponseFormat
  temperature?: number
  max_tokens?: number
  topicId?: string
}

export interface PerplexityResponseFormat {
  type: 'json_schema'
  json_schema: {
    name: string
    schema: Record<string, unknown>
  }
}

export interface PerplexitySearchResult {
  url: string
  title: string
  snippet?: string
  date?: string
}

export interface PerplexityResponse {
  answer: string
  citations: string[]
  search_results: PerplexitySearchResult[]
  related_questions?: string[]
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  cost: {
    total_cost: number
  }
}

export interface PerplexityError {
  error: string
  message: string
  credits_remaining?: number
}

// ============================================
// RSS FEED TYPES
// ============================================

export interface RSSFeedResult {
  feed_url: string
  site_name: string
  description?: string
  category: 'news' | 'podcast' | 'youtube' | 'blog' | 'official'
}

export interface RSSDiscoveryResult {
  feeds: RSSFeedResult[]
  notes?: string
  sources_checked: string[]
}

// ============================================
// CONFIGURATION
// ============================================

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const DEFAULT_MODEL = 'sonar'

// ============================================
// CLIENT
// ============================================

class PerplexityClient {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY
  }

  /**
   * Set API key dynamically (for UI-based configuration)
   */
  setApiKey(key: string) {
    this.apiKey = key
  }

  /**
   * Check if the client is configured (sync check - only checks env/instance)
   */
  isConfigured(): boolean {
    return !!this.apiKey
  }

  /**
   * Check if the client is configured (async - checks database too)
   */
  async isConfiguredAsync(): Promise<boolean> {
    if (this.apiKey) return true
    const dbKey = await getAPIKey('perplexity')
    return !!dbKey
  }

  /**
   * Search using Perplexity Sonar
   */
  async search(options: PerplexitySearchOptions): Promise<PerplexityResponse> {
    // Try to get API key from database first, then fall back to instance variable / env
    let apiKey = this.apiKey
    if (!apiKey) {
      apiKey = await getAPIKey('perplexity') || undefined
    }

    if (!apiKey) {
      throw new Error('Perplexity API key not configured. Set PERPLEXITY_API_KEY in environment or configure via Settings > API Keys.')
    }

    const model = options.model || DEFAULT_MODEL

    // Build messages array
    const messages: { role: string; content: string }[] = []
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: options.query })

    // Build request body
    const body: Record<string, unknown> = {
      model,
      messages,
      return_citations: options.return_citations ?? true,
      return_related_questions: options.return_related_questions ?? true,
    }

    // Optional parameters
    if (options.search_recency_filter) {
      body.search_recency_filter = options.search_recency_filter
    }
    if (options.search_domain_filter && options.search_domain_filter.length > 0) {
      body.search_domain_filter = options.search_domain_filter.slice(0, 20) // Max 20 domains
    }
    if (options.response_format) {
      body.response_format = options.response_format
    }
    if (options.temperature !== undefined) {
      body.temperature = options.temperature
    }
    if (options.max_tokens !== undefined) {
      body.max_tokens = options.max_tokens
    }

    try {
      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Perplexity API error: ${response.status}`)
      }

      const data = await response.json()

      // Track the API call
      trackPerplexityCall(model === 'sonar-pro' ? 'sonar_pro' : model, options.topicId)

      // Parse the response
      const choice = data.choices?.[0]
      const message = choice?.message

      return {
        answer: message?.content || '',
        citations: data.citations || [],
        search_results: (data.search_results || []).map((r: Record<string, unknown>) => ({
          url: r.url as string,
          title: r.title as string,
          snippet: r.snippet as string,
          date: r.date as string,
        })),
        related_questions: data.related_questions || [],
        model: data.model,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        },
        cost: {
          total_cost: data.usage?.cost?.total_cost || 0,
        },
      }
    } catch (error) {
      console.error('Perplexity search error:', error)
      throw error
    }
  }

  /**
   * Search with structured JSON output
   */
  async searchStructured<T>(
    options: PerplexitySearchOptions & { schema: { name: string; schema: Record<string, unknown> } }
  ): Promise<{ data: T; response: PerplexityResponse }> {
    const result = await this.search({
      ...options,
      response_format: {
        type: 'json_schema',
        json_schema: options.schema,
      },
    })

    // Parse the JSON from the answer
    let data: T
    try {
      data = JSON.parse(result.answer)
    } catch (e) {
      console.error('Failed to parse structured response:', result.answer)
      throw new Error('Failed to parse structured response from Perplexity')
    }

    return { data, response: result }
  }

  /**
   * Discover RSS feeds for a niche/topic
   */
  async discoverRSSFeeds(
    niche: string,
    keywords: string[] = [],
    existingSources: string[] = []
  ): Promise<RSSDiscoveryResult> {
    const keywordStr = keywords.length > 0 ? ` Keywords: ${keywords.join(', ')}.` : ''
    const existingStr = existingSources.length > 0
      ? ` Already tracking: ${existingSources.join(', ')} - find different sources.`
      : ''

    const query = `Find RSS feeds for ${niche} news, commentary, blogs, and YouTube channels.${keywordStr}${existingStr} Include official sources, media outlets, podcasts, and YouTube channel RSS feeds. Focus on active, regularly updated sources.`

    const schema = {
      name: 'rss_discovery',
      schema: {
        type: 'object',
        properties: {
          feeds: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                feed_url: { type: 'string', description: 'The RSS feed URL' },
                site_name: { type: 'string', description: 'Name of the source' },
                description: { type: 'string', description: 'Brief description of the source' },
                category: {
                  type: 'string',
                  enum: ['news', 'podcast', 'youtube', 'blog', 'official'],
                  description: 'Type of source',
                },
              },
              required: ['feed_url', 'site_name', 'category'],
            },
          },
          notes: { type: 'string', description: 'Any notes about the feeds found' },
        },
        required: ['feeds'],
      },
    }

    const { data, response } = await this.searchStructured<{ feeds: RSSFeedResult[]; notes?: string }>({
      query,
      systemPrompt: 'You are a research assistant that finds RSS feeds. For YouTube channels, use the format: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID. Always provide working feed URLs when possible.',
      schema,
    })

    return {
      feeds: data.feeds || [],
      notes: data.notes,
      sources_checked: response.citations,
    }
  }

  /**
   * Research an entity for enrichment
   */
  async researchEntity(
    entityName: string,
    nicheContext: string,
    existingInfo?: Record<string, unknown>
  ): Promise<{
    role?: string
    affiliations?: { name: string; type: string; status: string }[]
    platforms?: Record<string, string>
    notes?: string
    sources: string[]
  }> {
    const existingStr = existingInfo
      ? ` Known info: ${JSON.stringify(existingInfo)}.`
      : ''

    const query = `Research ${entityName} in the context of ${nicheContext}.${existingStr} Find their role, affiliations, social media handles, and any notable information.`

    const schema = {
      name: 'entity_research',
      schema: {
        type: 'object',
        properties: {
          role: { type: 'string', description: 'Primary role (e.g., battler, blogger, promoter)' },
          sub_roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional roles',
          },
          affiliations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                status: { type: 'string', enum: ['current', 'former', 'rumored'] },
              },
            },
          },
          platforms: {
            type: 'object',
            properties: {
              twitter_handle: { type: 'string' },
              youtube_channel_id: { type: 'string' },
              instagram_handle: { type: 'string' },
            },
          },
          notes: { type: 'string', description: 'Notable information' },
        },
      },
    }

    const { data, response } = await this.searchStructured<{
      role?: string
      affiliations?: { name: string; type: string; status: string }[]
      platforms?: Record<string, string>
      notes?: string
    }>({
      query,
      systemPrompt: `You are a research assistant specializing in ${nicheContext}. Provide accurate, verifiable information only.`,
      schema,
      search_recency_filter: 'month',
    })

    return {
      ...data,
      sources: response.citations,
    }
  }

  /**
   * Get credits status
   */
  async getCreditsStatus(): Promise<{ used: number; remaining: number; total: number }> {
    const remaining = await getPerplexityCreditsRemaining()
    return {
      used: PERPLEXITY_MONTHLY_CREDITS - remaining,
      remaining,
      total: PERPLEXITY_MONTHLY_CREDITS,
    }
  }
}

// ============================================
// SINGLETON
// ============================================

export const perplexity = new PerplexityClient()

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Quick search helper
 */
export async function searchWithPerplexity(
  query: string,
  options?: Partial<PerplexitySearchOptions>
): Promise<PerplexityResponse> {
  return perplexity.search({
    query,
    ...options,
  })
}

/**
 * Discover RSS feeds for a niche
 */
export async function discoverRSSFeedsForNiche(
  niche: string,
  keywords?: string[],
  existingSources?: string[]
): Promise<RSSDiscoveryResult> {
  return perplexity.discoverRSSFeeds(niche, keywords, existingSources)
}

/**
 * Research an entity
 */
export async function researchEntityWithPerplexity(
  entityName: string,
  nicheContext: string,
  existingInfo?: Record<string, unknown>
) {
  return perplexity.researchEntity(entityName, nicheContext, existingInfo)
}

/**
 * Check if Perplexity is available (has credits and is configured)
 */
export async function isPerplexityAvailable(): Promise<boolean> {
  if (!perplexity.isConfigured()) return false
  const credits = await getPerplexityCreditsRemaining()
  return credits > 0
}

/**
 * Get a formatted status message about Perplexity availability
 */
export async function getPerplexityStatus(): Promise<{
  available: boolean
  configured: boolean
  credits: { used: number; remaining: number; total: number }
  message: string
}> {
  const configured = perplexity.isConfigured()
  const credits = await perplexity.getCreditsStatus()
  const available = configured && credits.remaining > 0

  let message: string
  if (!configured) {
    message = 'Perplexity API key not configured'
  } else if (credits.remaining <= 0) {
    message = 'No Perplexity credits remaining this month'
  } else {
    message = `${credits.remaining}/${credits.total} credits available`
  }

  return {
    available,
    configured,
    credits,
    message,
  }
}
