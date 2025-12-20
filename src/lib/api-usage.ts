/**
 * API USAGE TRACKER
 *
 * Tracks API calls and estimated costs across all external services.
 * Stores in database for historical analysis.
 */

import { createClient } from '@supabase/supabase-js'

// ============================================
// PRICING (per 1000 calls/items)
// ============================================

export const API_PRICING = {
  twitter: {
    user_info: 0.18,        // $0.18 per 1K profiles
    user_timeline: 0.15,    // $0.15 per 1K tweet fetches
    search: 0.15,           // $0.15 per 1K searches
    followers: 0.15,        // $0.15 per 1K follower fetches
    tweet_detail: 0.15,     // $0.15 per 1K tweet details
    replies: 0.15,          // $0.15 per 1K reply fetches
  },
  youtube: {
    channel_info: 0,        // Free (youtubei.js)
    video_list: 0,          // Free (youtubei.js)
    transcript: 0,          // Free (youtube-transcript)
    // Official API if we use it later
    official_search: 100,   // $100 per 10K units (expensive!)
  },
  llm: {
    ollama: 0,              // Free (local)
    lmstudio: 0,            // Free (local)
    openai_gpt4o_mini: 0.15,// $0.15 per 1M input tokens (approx)
    anthropic_haiku: 0.25,  // $0.25 per 1M input tokens (approx)
  },
  perplexity: {
    sonar: 0,               // Free tier: 5 credits/month (tracked as credits)
    sonar_pro: 0,           // Pro tier: per-query cost
  },
  elevenlabs: {
    text_to_speech: 0.30,   // ~$0.30 per 1K characters (varies by plan)
  },
  searxng: {
    search: 0,              // Free (self-hosted)
  },
}

// Track Perplexity credits separately (5 free per month)
export const PERPLEXITY_MONTHLY_CREDITS = 5

// ============================================
// TYPES
// ============================================

export type ServiceType = 'twitter' | 'youtube' | 'llm' | 'perplexity' | 'elevenlabs' | 'searxng'

export interface APIUsageRecord {
  id?: string
  service: ServiceType
  endpoint: string
  calls: number
  items_fetched: number
  estimated_cost: number
  topic_id?: string
  created_at?: string
}

export interface UsageSummary {
  today: { calls: number; cost: number }
  thisWeek: { calls: number; cost: number }
  thisMonth: { calls: number; cost: number }
  allTime: { calls: number; cost: number }
  byService: Record<string, { calls: number; cost: number }>
}

// ============================================
// IN-MEMORY BUFFER (batches writes)
// ============================================

let usageBuffer: APIUsageRecord[] = []
let flushTimeout: NodeJS.Timeout | null = null

// ============================================
// USAGE TRACKER CLASS
// ============================================

class APIUsageTracker {
  private supabase

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  /**
   * Track an API call
   */
  track(
    service: ServiceType,
    endpoint: string,
    itemsFetched: number = 1,
    topicId?: string
  ) {
    // Calculate estimated cost
    const pricing = API_PRICING[service] as Record<string, number>
    const pricePerK = pricing[endpoint] || 0
    const estimatedCost = (itemsFetched / 1000) * pricePerK

    const record: APIUsageRecord = {
      service,
      endpoint,
      calls: 1,
      items_fetched: itemsFetched,
      estimated_cost: estimatedCost,
      topic_id: topicId,
    }

    // Add to buffer
    usageBuffer.push(record)

    // Schedule flush
    if (!flushTimeout) {
      flushTimeout = setTimeout(() => this.flush(), 5000) // Flush every 5 seconds
    }

    // Log for debugging
    if (estimatedCost > 0) {
      console.log(`[API Usage] ${service}/${endpoint}: ${itemsFetched} items, ~$${estimatedCost.toFixed(4)}`)
    }
  }

  /**
   * Flush buffer to database
   */
  async flush() {
    if (usageBuffer.length === 0) return

    const records = [...usageBuffer]
    usageBuffer = []
    flushTimeout = null

    try {
      // Aggregate records by service/endpoint
      const aggregated = new Map<string, APIUsageRecord>()

      for (const record of records) {
        const key = `${record.service}:${record.endpoint}:${record.topic_id || 'none'}`
        const existing = aggregated.get(key)

        if (existing) {
          existing.calls += record.calls
          existing.items_fetched += record.items_fetched
          existing.estimated_cost += record.estimated_cost
        } else {
          aggregated.set(key, { ...record })
        }
      }

      // Insert aggregated records
      const { error } = await this.supabase
        .from('api_usage')
        .insert(Array.from(aggregated.values()))

      if (error) {
        console.error('Failed to save API usage:', error)
        // Re-add to buffer for retry
        usageBuffer.push(...records)
      }
    } catch (error) {
      console.error('Failed to flush API usage:', error)
      usageBuffer.push(...records)
    }
  }

  /**
   * Get usage summary
   */
  async getSummary(topicId?: string): Promise<UsageSummary> {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    let query = this.supabase
      .from('api_usage')
      .select('service, endpoint, calls, items_fetched, estimated_cost, created_at')

    if (topicId) {
      query = query.eq('topic_id', topicId)
    }

    const { data: records, error } = await query

    if (error || !records) {
      return {
        today: { calls: 0, cost: 0 },
        thisWeek: { calls: 0, cost: 0 },
        thisMonth: { calls: 0, cost: 0 },
        allTime: { calls: 0, cost: 0 },
        byService: {},
      }
    }

    const summary: UsageSummary = {
      today: { calls: 0, cost: 0 },
      thisWeek: { calls: 0, cost: 0 },
      thisMonth: { calls: 0, cost: 0 },
      allTime: { calls: 0, cost: 0 },
      byService: {},
    }

    for (const record of records) {
      const createdAt = new Date(record.created_at)

      // All time
      summary.allTime.calls += record.calls
      summary.allTime.cost += record.estimated_cost

      // This month
      if (createdAt >= monthStart) {
        summary.thisMonth.calls += record.calls
        summary.thisMonth.cost += record.estimated_cost
      }

      // This week
      if (createdAt >= weekStart) {
        summary.thisWeek.calls += record.calls
        summary.thisWeek.cost += record.estimated_cost
      }

      // Today
      if (createdAt >= todayStart) {
        summary.today.calls += record.calls
        summary.today.cost += record.estimated_cost
      }

      // By service
      if (!summary.byService[record.service]) {
        summary.byService[record.service] = { calls: 0, cost: 0 }
      }
      summary.byService[record.service].calls += record.calls
      summary.byService[record.service].cost += record.estimated_cost
    }

    return summary
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 50): Promise<APIUsageRecord[]> {
    const { data, error } = await this.supabase
      .from('api_usage')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    return data || []
  }
}

// ============================================
// SINGLETON
// ============================================

export const apiUsage = new APIUsageTracker()

// ============================================
// HELPER: Wrap Twitter client with tracking
// ============================================

export function trackTwitterCall(endpoint: string, itemsFetched: number, topicId?: string) {
  apiUsage.track('twitter', endpoint, itemsFetched, topicId)
}

export function trackYouTubeCall(endpoint: string, itemsFetched: number, topicId?: string) {
  apiUsage.track('youtube', endpoint, itemsFetched, topicId)
}

export function trackLLMCall(provider: string, tokensUsed: number, topicId?: string) {
  apiUsage.track('llm', provider, tokensUsed, topicId)
}

export function trackPerplexityCall(model: 'sonar' | 'sonar_pro' = 'sonar', topicId?: string) {
  // Each Perplexity call counts as 1 credit
  apiUsage.track('perplexity', model, 1, topicId)
}

export function trackElevenLabsCall(charactersUsed: number, topicId?: string) {
  apiUsage.track('elevenlabs', 'text_to_speech', charactersUsed, topicId)
}

export function trackSearXNGCall(topicId?: string) {
  apiUsage.track('searxng', 'search', 1, topicId)
}

// ============================================
// HELPER: Get Perplexity credits used this month
// ============================================

export async function getPerplexityCreditsUsedThisMonth(): Promise<number> {
  const summary = await apiUsage.getSummary()
  const perplexityUsage = summary.byService['perplexity']
  return perplexityUsage?.calls || 0
}

export async function getPerplexityCreditsRemaining(): Promise<number> {
  const used = await getPerplexityCreditsUsedThisMonth()
  return Math.max(0, PERPLEXITY_MONTHLY_CREDITS - used)
}
