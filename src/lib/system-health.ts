/**
 * System Health Check Module
 *
 * Provides health checks for all services used by Talk Show Go.
 * Shows what's connected, what's working, and what's missing.
 */

import { checkSearXNGHealth } from './web-search'
import { checkOllamaHealth } from './presidium-ai'
import { isElevenLabsConfigured, getSubscriptionInfo } from './elevenlabs'
import { supabase } from './db'

// ============================================
// TYPES
// ============================================

export type ServiceStatus = 'connected' | 'error' | 'missing' | 'rate_limited' | 'warning'

export interface ServiceHealth {
  name: string
  status: ServiceStatus
  message: string
  details?: Record<string, any>
  configuredKey?: string  // Masked API key for display
}

export interface SystemHealthReport {
  timestamp: string
  overall: ServiceStatus
  services: {
    news: ServiceHealth[]
    content: ServiceHealth[]
    ai: ServiceHealth[]
    voice: ServiceHealth[]
    database: ServiceHealth[]
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function maskApiKey(key: string | undefined): string | undefined {
  if (!key) return undefined
  if (key.length <= 8) return '***'
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

// ============================================
// INDIVIDUAL SERVICE CHECKS
// ============================================

/**
 * Check TheNewsAPI
 */
export async function checkTheNewsAPI(): Promise<ServiceHealth> {
  const apiKey = process.env.THENEWSAPI_KEY

  if (!apiKey) {
    return {
      name: 'TheNewsAPI',
      status: 'missing',
      message: 'Missing THENEWSAPI_KEY in environment',
    }
  }

  try {
    const response = await fetch(`https://api.thenewsapi.com/v1/news/top?api_token=${apiKey}&limit=1`, {
      signal: AbortSignal.timeout(10000),
    })

    if (response.status === 429) {
      return {
        name: 'TheNewsAPI',
        status: 'rate_limited',
        message: 'Rate limited - will failover to backup',
        configuredKey: maskApiKey(apiKey),
      }
    }

    if (!response.ok) {
      const error = await response.text()
      return {
        name: 'TheNewsAPI',
        status: 'error',
        message: `API error: ${response.status}`,
        details: { error },
        configuredKey: maskApiKey(apiKey),
      }
    }

    const data = await response.json()
    return {
      name: 'TheNewsAPI',
      status: 'connected',
      message: `Connected (${data.meta?.found || 0} articles available)`,
      configuredKey: maskApiKey(apiKey),
      details: {
        articlesFound: data.meta?.found,
      }
    }
  } catch (error) {
    return {
      name: 'TheNewsAPI',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
      configuredKey: maskApiKey(apiKey),
    }
  }
}

/**
 * Check NewsData.io
 */
export async function checkNewsDataIO(): Promise<ServiceHealth> {
  const apiKey = process.env.NEWSDATA_API_KEY

  if (!apiKey) {
    return {
      name: 'NewsData.io',
      status: 'missing',
      message: 'Missing NEWSDATA_API_KEY in environment',
    }
  }

  try {
    const response = await fetch(`https://newsdata.io/api/1/latest?apikey=${apiKey}&language=en&size=1`, {
      signal: AbortSignal.timeout(10000),
    })

    if (response.status === 429) {
      return {
        name: 'NewsData.io',
        status: 'rate_limited',
        message: 'Rate limited - cooldown active',
        configuredKey: maskApiKey(apiKey),
      }
    }

    if (!response.ok) {
      const error = await response.text()
      return {
        name: 'NewsData.io',
        status: 'error',
        message: `API error: ${response.status}`,
        details: { error },
        configuredKey: maskApiKey(apiKey),
      }
    }

    const data = await response.json()
    return {
      name: 'NewsData.io',
      status: 'connected',
      message: 'Connected (backup ready)',
      configuredKey: maskApiKey(apiKey),
      details: {
        totalResults: data.totalResults,
      }
    }
  } catch (error) {
    return {
      name: 'NewsData.io',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
      configuredKey: maskApiKey(apiKey),
    }
  }
}

/**
 * Check SearXNG (self-hosted web search)
 */
export async function checkSearXNG(): Promise<ServiceHealth> {
  const searxngUrl = process.env.SEARXNG_URL || 'http://localhost:8888'

  try {
    const isHealthy = await withTimeout(checkSearXNGHealth(), 5000, false)

    if (isHealthy) {
      return {
        name: 'SearXNG',
        status: 'connected',
        message: `Running at ${searxngUrl}`,
        details: { url: searxngUrl }
      }
    }

    return {
      name: 'SearXNG',
      status: 'error',
      message: 'Not running - start with docker-compose',
      details: { url: searxngUrl }
    }
  } catch {
    return {
      name: 'SearXNG',
      status: 'error',
      message: 'Not reachable',
      details: { url: searxngUrl }
    }
  }
}

/**
 * Check YouTube (youtubei.js - no API key needed)
 */
export async function checkYouTube(): Promise<ServiceHealth> {
  // YouTube via youtubei.js doesn't need an API key
  // We just verify the library is working by doing a simple check
  try {
    // Import dynamically to avoid initialization issues
    const { Innertube } = await import('youtubei.js')
    const youtube = await Innertube.create()

    // Quick search to verify it works
    const results = await youtube.search('test', { type: 'video' })

    return {
      name: 'YouTube',
      status: 'connected',
      message: 'Working (youtubei.js)',
      details: {
        library: 'youtubei.js',
        resultsFound: results.results?.length || 0
      }
    }
  } catch (error) {
    return {
      name: 'YouTube',
      status: 'error',
      message: error instanceof Error ? error.message : 'YouTube client error',
    }
  }
}

/**
 * Check Twitter API (twitterapi.io)
 */
export async function checkTwitter(): Promise<ServiceHealth> {
  const apiKey = process.env.TWITTER_API_KEY

  if (!apiKey) {
    return {
      name: 'Twitter',
      status: 'missing',
      message: 'Missing TWITTER_API_KEY in environment',
    }
  }

  try {
    // Test with a simple user lookup
    const response = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=Twitter`, {
      headers: {
        'X-API-Key': apiKey,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (response.status === 429) {
      return {
        name: 'Twitter',
        status: 'rate_limited',
        message: 'Rate limited',
        configuredKey: maskApiKey(apiKey),
      }
    }

    if (!response.ok) {
      return {
        name: 'Twitter',
        status: 'error',
        message: `API error: ${response.status}`,
        configuredKey: maskApiKey(apiKey),
      }
    }

    return {
      name: 'Twitter',
      status: 'connected',
      message: 'Connected (twitterapi.io)',
      configuredKey: maskApiKey(apiKey),
    }
  } catch (error) {
    return {
      name: 'Twitter',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
      configuredKey: maskApiKey(apiKey),
    }
  }
}

/**
 * Check Ollama/Presidium (local LLM)
 */
export async function checkOllama(): Promise<ServiceHealth> {
  const ollamaUrl = process.env.OLLAMA_HOST || process.env.PRESIDIUM_LLM_URL || 'http://192.168.1.211:11434'

  try {
    const result = await withTimeout(checkOllamaHealth(), 5000, { available: false, models: [] })

    if (result.available) {
      return {
        name: 'Ollama',
        status: 'connected',
        message: `Connected (${result.models.length} models loaded)`,
        details: {
          url: ollamaUrl,
          models: result.models.slice(0, 5),  // Show first 5 models
        }
      }
    }

    return {
      name: 'Ollama',
      status: 'error',
      message: 'Not reachable at configured address',
      details: { url: ollamaUrl }
    }
  } catch {
    return {
      name: 'Ollama',
      status: 'error',
      message: 'Connection failed',
      details: { url: ollamaUrl }
    }
  }
}

/**
 * Check Claude API (Anthropic)
 */
export async function checkClaudeAPI(): Promise<ServiceHealth> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      name: 'Claude API',
      status: 'missing',
      message: 'Missing ANTHROPIC_API_KEY in environment',
    }
  }

  try {
    // Just verify the API key format is valid
    // (We don't make a real call to avoid wasting tokens)
    if (apiKey.startsWith('sk-ant-')) {
      return {
        name: 'Claude API',
        status: 'connected',
        message: 'API key configured',
        configuredKey: maskApiKey(apiKey),
      }
    }

    return {
      name: 'Claude API',
      status: 'warning',
      message: 'API key format looks invalid',
      configuredKey: maskApiKey(apiKey),
    }
  } catch {
    return {
      name: 'Claude API',
      status: 'error',
      message: 'Configuration error',
      configuredKey: maskApiKey(apiKey),
    }
  }
}

/**
 * Check ElevenLabs TTS
 */
export async function checkElevenLabs(): Promise<ServiceHealth> {
  if (!isElevenLabsConfigured()) {
    return {
      name: 'ElevenLabs TTS',
      status: 'missing',
      message: 'Missing ELEVENLABS_API_KEY in environment',
    }
  }

  const apiKey = process.env.ELEVENLABS_API_KEY

  try {
    const subscription = await getSubscriptionInfo()

    const remainingCredits = subscription.character_limit - subscription.character_count
    const usagePercent = Math.round((subscription.character_count / subscription.character_limit) * 100)

    return {
      name: 'ElevenLabs TTS',
      status: 'connected',
      message: `Connected (${remainingCredits.toLocaleString()} credits remaining)`,
      configuredKey: maskApiKey(apiKey),
      details: {
        used: subscription.character_count,
        limit: subscription.character_limit,
        usagePercent,
        remainingCredits,
        voiceLimit: subscription.voice_limit,
      }
    }
  } catch (error) {
    return {
      name: 'ElevenLabs TTS',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
      configuredKey: maskApiKey(apiKey),
    }
  }
}

/**
 * Check PostgreSQL database
 */
export async function checkPostgreSQL(): Promise<ServiceHealth> {
  try {
    // Test connection with a simple query
    const { data, error } = await supabase.from('topics').select('id').limit(1)

    if (error) {
      return {
        name: 'PostgreSQL',
        status: 'error',
        message: `Query failed: ${error.message}`,
        details: { error: error.message }
      }
    }

    return {
      name: 'PostgreSQL',
      status: 'connected',
      message: 'Connected (talkshowgo)',
      details: {
        database: 'talkshowgo',
      }
    }
  } catch (error) {
    return {
      name: 'PostgreSQL',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

/**
 * Check RSS feeds (placeholder - will be implemented with RSS module)
 */
export async function checkRSSFeeds(): Promise<ServiceHealth> {
  // TODO: Once RSS module is built, this will check configured feeds
  return {
    name: 'RSS Feeds',
    status: 'warning',
    message: 'Not yet configured',
    details: {
      feedCount: 0,
      note: 'RSS feeds will be available after Phase 2 implementation'
    }
  }
}

// ============================================
// FULL SYSTEM HEALTH CHECK
// ============================================

/**
 * Run all health checks and return a complete system report
 */
export async function getSystemHealth(): Promise<SystemHealthReport> {
  // Run all checks in parallel for speed
  const [
    theNewsAPI,
    newsDataIO,
    rssFeeds,
    youtube,
    twitter,
    searxng,
    ollama,
    claudeAPI,
    elevenLabs,
    postgresql,
  ] = await Promise.all([
    checkTheNewsAPI(),
    checkNewsDataIO(),
    checkRSSFeeds(),
    checkYouTube(),
    checkTwitter(),
    checkSearXNG(),
    checkOllama(),
    checkClaudeAPI(),
    checkElevenLabs(),
    checkPostgreSQL(),
  ])

  const services = {
    news: [theNewsAPI, newsDataIO, rssFeeds],
    content: [youtube, twitter, searxng],
    ai: [ollama, claudeAPI],
    voice: [elevenLabs],
    database: [postgresql],
  }

  // Determine overall status
  const allServices = Object.values(services).flat()
  const hasErrors = allServices.some(s => s.status === 'error')
  const hasMissing = allServices.some(s => s.status === 'missing')
  const hasRateLimits = allServices.some(s => s.status === 'rate_limited')

  let overall: ServiceStatus = 'connected'
  if (hasErrors) overall = 'error'
  else if (hasMissing) overall = 'warning'
  else if (hasRateLimits) overall = 'rate_limited'

  return {
    timestamp: new Date().toISOString(),
    overall,
    services,
  }
}

/**
 * Get a quick summary of system health
 */
export async function getHealthSummary(): Promise<{
  status: ServiceStatus
  connected: number
  issues: number
  missing: number
}> {
  const report = await getSystemHealth()
  const allServices = Object.values(report.services).flat()

  return {
    status: report.overall,
    connected: allServices.filter(s => s.status === 'connected').length,
    issues: allServices.filter(s => s.status === 'error' || s.status === 'rate_limited').length,
    missing: allServices.filter(s => s.status === 'missing').length,
  }
}
