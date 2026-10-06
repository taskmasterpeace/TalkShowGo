/**
 * Centralized Configuration
 *
 * Single source of truth for all system configuration.
 * Merges: Environment variables > Database > Defaults
 */

import { supabase } from './db'

// ============================================
// Configuration Types
// ============================================

export interface TimeConfig {
  default_hours_back: number
  max_hours_back: number
  freshness_priority: 'strict' | 'relaxed'
}

export interface RateLimitConfig {
  youtube_requests_per_minute: number
  twitter_requests_per_minute: number
  rss_requests_per_minute: number
}

export interface CacheConfig {
  video_cache_minutes: number
  search_cache_minutes: number
  entity_cache_minutes: number
}

export interface ServiceEndpoints {
  searxng_url: string
  ollama_url: string
  dia_url: string
  postgres_url: string
}

export interface SystemConfig {
  time: TimeConfig
  rate_limits: RateLimitConfig
  cache: CacheConfig
  endpoints: ServiceEndpoints
  api_keys: {
    youtube: boolean
    twitter: boolean
    elevenlabs: boolean
    openrouter: boolean
    perplexity: boolean
  }
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: SystemConfig = {
  time: {
    default_hours_back: 48,
    max_hours_back: 168, // 7 days
    freshness_priority: 'strict',
  },
  rate_limits: {
    youtube_requests_per_minute: 100,
    twitter_requests_per_minute: 60,
    rss_requests_per_minute: 30,
  },
  cache: {
    video_cache_minutes: 60,
    search_cache_minutes: 15,
    entity_cache_minutes: 120,
  },
  endpoints: {
    searxng_url: 'http://localhost:8888',
    ollama_url: 'http://192.168.1.211:11434',
    dia_url: 'http://localhost:8765',
    postgres_url: 'postgresql://postgres:postgres@localhost:5432/talkshowgo',
  },
  api_keys: {
    youtube: false,
    twitter: false,
    elevenlabs: false,
    openrouter: false,
    perplexity: false,
  },
}

// ============================================
// Configuration Loading
// ============================================

let cachedConfig: SystemConfig | null = null
let configLoadedAt: number = 0
const CONFIG_CACHE_MS = 60000 // 1 minute

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<SystemConfig> {
  const config: Partial<SystemConfig> = {
    time: {
      default_hours_back: parseInt(process.env.DEFAULT_HOURS_BACK || '48'),
      max_hours_back: parseInt(process.env.MAX_HOURS_BACK || '168'),
      freshness_priority: (process.env.FRESHNESS_PRIORITY as 'strict' | 'relaxed') || 'strict',
    },
    endpoints: {
      searxng_url: process.env.SEARXNG_URL || DEFAULT_CONFIG.endpoints.searxng_url,
      ollama_url: process.env.OLLAMA_URL || process.env.PRESIDIUM_URL || DEFAULT_CONFIG.endpoints.ollama_url,
      dia_url: process.env.DIA_URL || DEFAULT_CONFIG.endpoints.dia_url,
      postgres_url: process.env.DATABASE_URL || DEFAULT_CONFIG.endpoints.postgres_url,
    },
    api_keys: {
      youtube: !!process.env.YOUTUBE_API_KEY,
      twitter: !!process.env.TWITTER_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
    },
  }

  return config
}

/**
 * Load topic-specific configuration from database
 */
async function loadTopicConfig(topicId: string): Promise<Partial<TimeConfig>> {
  try {
    const { data } = await supabase
      .from('topics')
      .select('intel_config')
      .eq('id', topicId)
      .single()

    if (data?.intel_config) {
      return {
        default_hours_back: data.intel_config.hours_back || DEFAULT_CONFIG.time.default_hours_back,
      }
    }
  } catch (error) {
    console.warn('[Config] Could not load topic config:', error)
  }

  return {}
}

/**
 * Get the full system configuration
 * Merges: Environment > Database > Defaults
 */
export function getConfig(): SystemConfig {
  // Check cache
  if (cachedConfig && Date.now() - configLoadedAt < CONFIG_CACHE_MS) {
    return cachedConfig
  }

  // Load from environment
  const envConfig = loadEnvConfig()

  // Merge with defaults
  cachedConfig = {
    time: { ...DEFAULT_CONFIG.time, ...envConfig.time },
    rate_limits: { ...DEFAULT_CONFIG.rate_limits, ...envConfig.rate_limits },
    cache: { ...DEFAULT_CONFIG.cache, ...envConfig.cache },
    endpoints: { ...DEFAULT_CONFIG.endpoints, ...envConfig.endpoints },
    api_keys: { ...DEFAULT_CONFIG.api_keys, ...envConfig.api_keys },
  }

  configLoadedAt = Date.now()
  return cachedConfig
}

/**
 * Get time configuration for a specific topic
 * Topic config overrides system defaults
 */
export async function getTimeConfig(topicId?: string): Promise<TimeConfig> {
  const systemConfig = getConfig()

  if (!topicId) {
    return systemConfig.time
  }

  const topicConfig = await loadTopicConfig(topicId)

  return {
    ...systemConfig.time,
    ...topicConfig,
  }
}

/**
 * Clear the config cache (for testing or after settings change)
 */
export function clearConfigCache(): void {
  cachedConfig = null
  configLoadedAt = 0
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Check if a service is available
 */
export async function isServiceAvailable(service: 'searxng' | 'ollama' | 'dia'): Promise<boolean> {
  const config = getConfig()
  const urls: Record<string, string> = {
    searxng: config.endpoints.searxng_url,
    ollama: config.endpoints.ollama_url,
    dia: config.endpoints.dia_url,
  }

  try {
    const healthEndpoint = service === 'ollama' ? '/api/tags' : '/health'
    const response = await fetch(urls[service] + healthEndpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get default hours_back for the system
 */
export function getDefaultHoursBack(): number {
  return getConfig().time.default_hours_back
}

/**
 * Check which API keys are configured
 */
export function getConfiguredApis(): string[] {
  const config = getConfig()
  return Object.entries(config.api_keys)
    .filter(([, configured]) => configured)
    .map(([name]) => name)
}

/**
 * Get service endpoint URL
 */
export function getEndpoint(service: keyof ServiceEndpoints): string {
  return getConfig().endpoints[service]
}
