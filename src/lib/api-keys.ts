/**
 * API KEY MANAGEMENT
 *
 * Handles secure storage and retrieval of API keys.
 * Keys can be stored in the database or read from environment variables.
 * Database keys take precedence over environment variables.
 */

import { supabase } from './db'

// ============================================
// TYPES
// ============================================

export type ServiceType = 'perplexity' | 'twitter' | 'openai' | 'anthropic'

export interface APIKeyConfig {
  service: ServiceType
  displayName: string
  description: string
  envVar: string
  docsUrl: string
  placeholder: string
  testEndpoint?: string
}

export interface APIKeyStatus {
  service: ServiceType
  displayName: string
  description: string
  configured: boolean
  source: 'database' | 'environment' | 'none'
  lastVerified?: string
  verificationStatus: 'pending' | 'valid' | 'invalid' | 'not_configured'
  masked?: string  // Last 4 chars for display
}

export interface SaveKeyResult {
  success: boolean
  error?: string
  verificationStatus?: 'valid' | 'invalid' | 'pending'
}

// ============================================
// SERVICE CONFIGURATIONS
// ============================================

export const API_KEY_CONFIGS: Record<ServiceType, APIKeyConfig> = {
  perplexity: {
    service: 'perplexity',
    displayName: 'Perplexity',
    description: 'AI-powered web search with Sonar models. Used for RSS discovery and research.',
    envVar: 'PERPLEXITY_API_KEY',
    docsUrl: 'https://docs.perplexity.ai/',
    placeholder: 'pplx-xxxxxxxxxxxxxxxxxxxx',
  },
  twitter: {
    service: 'twitter',
    displayName: 'Twitter (twitterapi.io)',
    description: 'Fetch tweets and user data. Uses twitterapi.io service, NOT official Twitter API.',
    envVar: 'TWITTER_API_KEY',
    docsUrl: 'https://twitterapi.io/docs',
    placeholder: 'your-twitter-api-key',
  },
  openai: {
    service: 'openai',
    displayName: 'OpenAI',
    description: 'GPT models for content generation and analysis.',
    envVar: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/docs',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
  },
  anthropic: {
    service: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude models for content generation and analysis.',
    envVar: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://docs.anthropic.com/',
    placeholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxx',
  },
}

// ============================================
// API KEY RETRIEVAL
// ============================================

/**
 * Get an API key for a service.
 * Checks database first, then falls back to environment variable.
 */
export async function getAPIKey(service: ServiceType): Promise<string | null> {
  // First check database
  const { data, error } = await supabase
    .from('api_keys')
    .select('api_key, is_active')
    .eq('service', service)
    .eq('is_active', true)
    .single()

  if (!error && data?.api_key) {
    return data.api_key
  }

  // Fall back to environment variable
  const config = API_KEY_CONFIGS[service]
  if (config) {
    return process.env[config.envVar] || null
  }

  return null
}

/**
 * Get status of all API keys
 */
export async function getAllAPIKeyStatuses(): Promise<APIKeyStatus[]> {
  // Get all keys from database
  const { data: dbKeys, error } = await supabase
    .from('api_keys')
    .select('service, api_key, is_active, last_verified_at, verification_status')

  const dbKeyMap = new Map<string, {
    api_key: string
    is_active: boolean
    last_verified_at: string | null
    verification_status: string
  }>()

  if (!error && dbKeys) {
    dbKeys.forEach((key: { service: string; api_key: string; is_active: boolean; last_verified_at: string | null; verification_status: string }) => {
      dbKeyMap.set(key.service, key)
    })
  }

  // Build status for each service
  const statuses: APIKeyStatus[] = []

  for (const [service, config] of Object.entries(API_KEY_CONFIGS)) {
    const serviceKey = service as ServiceType
    const dbKey = dbKeyMap.get(service)
    const envKey = process.env[config.envVar]

    let configured = false
    let source: 'database' | 'environment' | 'none' = 'none'
    let masked: string | undefined
    let verificationStatus: 'pending' | 'valid' | 'invalid' | 'not_configured' = 'not_configured'
    let lastVerified: string | undefined

    if (dbKey?.api_key && dbKey.is_active) {
      configured = true
      source = 'database'
      masked = maskKey(dbKey.api_key)
      verificationStatus = (dbKey.verification_status as 'pending' | 'valid' | 'invalid') || 'pending'
      lastVerified = dbKey.last_verified_at || undefined
    } else if (envKey) {
      configured = true
      source = 'environment'
      masked = maskKey(envKey)
      verificationStatus = 'valid' // Assume env vars are valid
    }

    statuses.push({
      service: serviceKey,
      displayName: config.displayName,
      description: config.description,
      configured,
      source,
      lastVerified,
      verificationStatus,
      masked,
    })
  }

  return statuses
}

/**
 * Get status of a single API key
 */
export async function getAPIKeyStatus(service: ServiceType): Promise<APIKeyStatus> {
  const statuses = await getAllAPIKeyStatuses()
  const status = statuses.find(s => s.service === service)

  if (!status) {
    const config = API_KEY_CONFIGS[service]
    return {
      service,
      displayName: config?.displayName || service,
      description: config?.description || '',
      configured: false,
      source: 'none',
      verificationStatus: 'not_configured',
    }
  }

  return status
}

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * Save an API key to the database
 */
export async function saveAPIKey(
  service: ServiceType,
  apiKey: string,
  verify = true
): Promise<SaveKeyResult> {
  // Verify the key if requested
  let verificationStatus: 'valid' | 'invalid' | 'pending' = 'pending'

  if (verify) {
    const isValid = await verifyAPIKey(service, apiKey)
    verificationStatus = isValid ? 'valid' : 'invalid'

    if (!isValid) {
      return {
        success: false,
        error: 'API key verification failed. Please check the key and try again.',
        verificationStatus: 'invalid',
      }
    }
  }

  // Upsert the key
  const { error } = await supabase
    .from('api_keys')
    .upsert({
      service,
      api_key: apiKey,
      is_active: true,
      verification_status: verificationStatus,
      last_verified_at: verify ? new Date().toISOString() : null,
    }, {
      onConflict: 'service',
    })

  if (error) {
    console.error('Error saving API key:', error)
    return {
      success: false,
      error: 'Failed to save API key to database.',
    }
  }

  return {
    success: true,
    verificationStatus,
  }
}

/**
 * Delete an API key from the database
 */
export async function deleteAPIKey(service: ServiceType): Promise<boolean> {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('service', service)

  if (error) {
    console.error('Error deleting API key:', error)
    return false
  }

  return true
}

// ============================================
// VERIFICATION
// ============================================

/**
 * Verify an API key works
 */
export async function verifyAPIKey(service: ServiceType, apiKey: string): Promise<boolean> {
  try {
    switch (service) {
      case 'perplexity':
        return await verifyPerplexityKey(apiKey)
      case 'twitter':
        return await verifyTwitterKey(apiKey)
      case 'openai':
        return await verifyOpenAIKey(apiKey)
      case 'anthropic':
        return await verifyAnthropicKey(apiKey)
      default:
        return true // Unknown service, assume valid
    }
  } catch (error) {
    console.error(`Error verifying ${service} API key:`, error)
    return false
  }
}

async function verifyPerplexityKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    })
    return response.ok || response.status === 400 // 400 might mean bad request but valid key
  } catch {
    return false
  }
}

async function verifyTwitterKey(apiKey: string): Promise<boolean> {
  try {
    // twitterapi.io verification
    const response = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=twitter`, {
      headers: {
        'X-API-Key': apiKey,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

async function verifyOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

async function verifyAnthropicKey(apiKey: string): Promise<boolean> {
  try {
    // Anthropic doesn't have a simple verification endpoint
    // We'll try a minimal messages request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'test' }],
      }),
    })
    return response.ok || response.status === 400
  } catch {
    return false
  }
}

// ============================================
// HELPERS
// ============================================

function maskKey(key: string): string {
  if (key.length <= 8) {
    return '****' + key.slice(-4)
  }
  return key.slice(0, 4) + '...' + key.slice(-4)
}
