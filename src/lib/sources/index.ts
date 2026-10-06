/**
 * Unified Source Fetcher
 *
 * Single entry point for fetching content from all sources.
 * Set hours_back once, applies to YouTube, Twitter, and RSS.
 */

import { createTimeRange, TimeRange, TimeRangeConfig } from '../time-range'
import {
  SourceAdapter,
  SourceConfig,
  SourceType,
  UnifiedContent,
  FetchResult,
} from './types'
import { getYouTubeAdapter } from './youtube-adapter'
import { getTwitterAdapter } from './twitter-adapter'
import { getRSSAdapter } from './rss-adapter'

// Re-export types
export * from './types'
export { createTimeRange, TimeRange } from '../time-range'

/**
 * Get all available adapters
 */
function getAdapters(): Map<SourceType, SourceAdapter> {
  return new Map([
    ['youtube', getYouTubeAdapter()],
    ['twitter', getTwitterAdapter()],
    ['rss', getRSSAdapter()],
  ])
}

/**
 * Get configured adapters (those that have API keys/credentials)
 */
export function getConfiguredAdapters(): SourceAdapter[] {
  const adapters = getAdapters()
  return Array.from(adapters.values()).filter((a) => a.isConfigured())
}

/**
 * Configuration for unified source fetching
 */
export interface UnifiedSourceConfig {
  // Time control - THE single point of control
  hours_back: number
  time_config?: Partial<TimeRangeConfig>

  // Topic context
  topic_id: string

  // Source-specific settings
  youtube?: {
    channel_ids?: string[]
    search_query?: string
  }
  twitter?: {
    handles?: string[]
    search_query?: string
  }
  rss?: {
    feed_urls?: string[]
  }

  // General options
  max_items_per_source?: number
  include_sources?: SourceType[]
  exclude_sources?: SourceType[]
}

/**
 * Fetch content from all configured sources with unified time filtering
 *
 * @example
 * ```typescript
 * const result = await fetchAllSources({
 *   hours_back: 48,  // Single control point - filters ALL sources
 *   topic_id: "battle-rap",
 *   youtube: {
 *     channel_ids: ["UC123", "UC456"]
 *   },
 *   twitter: {
 *     handles: ["urltv", "jayblac"]
 *   }
 * })
 * ```
 */
export async function fetchAllSources(
  config: UnifiedSourceConfig
): Promise<FetchResult> {
  const startTime = Date.now()

  // Create time range from hours_back
  const timeRange = createTimeRange(config.hours_back, config.time_config)

  console.log(`[Sources] Fetching content from last ${config.hours_back} hours`)
  console.log(`[Sources] Time range: ${timeRange.start_date.toISOString()} to ${timeRange.end_date.toISOString()}`)

  const adapters = getAdapters()
  const allContent: UnifiedContent[] = []
  const sourcesUsed: SourceType[] = []
  const errors: Array<{ source: SourceType; error: string }> = []
  const bySource: Record<SourceType, number> = {
    youtube: 0,
    twitter: 0,
    rss: 0,
  }

  // Determine which sources to use
  let sourcesToFetch = Array.from(adapters.keys())
  if (config.include_sources) {
    sourcesToFetch = sourcesToFetch.filter((s) => config.include_sources!.includes(s))
  }
  if (config.exclude_sources) {
    sourcesToFetch = sourcesToFetch.filter((s) => !config.exclude_sources!.includes(s))
  }

  // Fetch from each source in parallel
  const fetchPromises = sourcesToFetch.map(async (sourceType) => {
    const adapter = adapters.get(sourceType)!

    if (!adapter.isConfigured()) {
      console.log(`[Sources] Skipping ${sourceType} - not configured`)
      return { sourceType, content: [] as UnifiedContent[], error: null }
    }

    // Build source config
    const sourceConfig: SourceConfig = {
      time_range: timeRange,
      topic_id: config.topic_id,
      max_items: config.max_items_per_source || 50,
    }

    // Add source-specific options
    if (sourceType === 'youtube' && config.youtube) {
      sourceConfig.channel_ids = config.youtube.channel_ids
      sourceConfig.youtube_search_query = config.youtube.search_query
    } else if (sourceType === 'twitter' && config.twitter) {
      sourceConfig.handles = config.twitter.handles
      sourceConfig.twitter_search_query = config.twitter.search_query
    } else if (sourceType === 'rss' && config.rss) {
      sourceConfig.feed_urls = config.rss.feed_urls
    }

    // Skip if no source-specific config provided
    const hasConfig =
      (sourceType === 'youtube' && (config.youtube?.channel_ids?.length || config.youtube?.search_query)) ||
      (sourceType === 'twitter' && (config.twitter?.handles?.length || config.twitter?.search_query)) ||
      (sourceType === 'rss' && config.rss?.feed_urls?.length)

    if (!hasConfig) {
      return { sourceType, content: [] as UnifiedContent[], error: null }
    }

    try {
      const content = await adapter.fetchContent(sourceConfig)
      return { sourceType, content, error: null }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[Sources] Error from ${sourceType}:`, errorMsg)
      return { sourceType, content: [] as UnifiedContent[], error: errorMsg }
    }
  })

  const results = await Promise.all(fetchPromises)

  // Aggregate results
  for (const { sourceType, content, error } of results) {
    if (error) {
      errors.push({ source: sourceType, error })
    }
    if (content.length > 0) {
      sourcesUsed.push(sourceType)
      allContent.push(...content)
      bySource[sourceType] = content.length
    }
  }

  // Sort all content by date (newest first)
  allContent.sort((a, b) => b.published_at.getTime() - a.published_at.getTime())

  const fetchTimeMs = Date.now() - startTime

  console.log(`[Sources] Fetched ${allContent.length} items from ${sourcesUsed.length} sources in ${fetchTimeMs}ms`)

  return {
    content: allContent,
    sources_used: sourcesUsed,
    errors,
    fetch_time_ms: fetchTimeMs,
    time_range: timeRange,
    stats: {
      total_items: allContent.length,
      by_source: bySource,
      filtered_out: 0, // Already filtered in adapters
    },
  }
}

/**
 * Quick fetch from YouTube channels only
 */
export async function fetchYouTubeContent(
  channelIds: string[],
  hoursBack: number = 48
): Promise<UnifiedContent[]> {
  const result = await fetchAllSources({
    hours_back: hoursBack,
    topic_id: 'quick-fetch',
    youtube: { channel_ids: channelIds },
    include_sources: ['youtube'],
  })
  return result.content
}

/**
 * Quick fetch from Twitter handles only
 */
export async function fetchTwitterContent(
  handles: string[],
  hoursBack: number = 48
): Promise<UnifiedContent[]> {
  const result = await fetchAllSources({
    hours_back: hoursBack,
    topic_id: 'quick-fetch',
    twitter: { handles },
    include_sources: ['twitter'],
  })
  return result.content
}

/**
 * Check which sources are available
 */
export function getSourceStatus(): Record<SourceType, { configured: boolean; name: string }> {
  const adapters = getAdapters()
  const status: Record<SourceType, { configured: boolean; name: string }> = {} as any

  for (const [type, adapter] of adapters) {
    status[type] = {
      configured: adapter.isConfigured(),
      name: type,
    }
  }

  return status
}
