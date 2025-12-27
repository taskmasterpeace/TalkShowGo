/**
 * OpenRouter API Client
 *
 * Allows calling multiple LLM models through a single API:
 * - Claude Opus 4.5, Sonnet, Haiku
 * - GPT-4o, GPT-4 Turbo, GPT-3.5
 * - DeepSeek V3
 * - Llama 3.3 70B
 * - Gemini 2.0 Flash, Pro
 *
 * Each host can use a different model based on their personality.
 */

// Configuration - Try Requesty first (what we use), then OpenRouter as fallback
const REQUESTY_API_KEY = process.env.REQUESTY_API_KEY
const REQUESTY_URL = 'https://router.requesty.ai/v1/chat/completions'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Use whichever is configured
const API_KEY = REQUESTY_API_KEY || OPENROUTER_API_KEY
const API_URL = REQUESTY_API_KEY ? REQUESTY_URL : OPENROUTER_URL
const IS_REQUESTY = !!REQUESTY_API_KEY

export interface OpenRouterRequest {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  max_tokens?: number
  temperature?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
}

export interface OpenRouterResponse {
  id: string
  model: string
  created: number
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenRouterModel {
  id: string
  name: string
  description: string
  pricing: {
    prompt: number  // per token
    completion: number  // per token
  }
  context_length: number
  top_provider: {
    context_length: number
    max_completion_tokens: number
  }
}

/**
 * Call OpenRouter API
 */
export async function callOpenRouter(request: OpenRouterRequest): Promise<{
  content: string
  tokens: number
  model: string
}> {
  if (!API_KEY) {
    throw new Error('REQUESTY_API_KEY or OPENROUTER_API_KEY must be configured')
  }

  const serviceName = IS_REQUESTY ? 'Requesty' : 'OpenRouter'
  console.log(`[${serviceName}] Calling ${request.model} (max_tokens: ${request.max_tokens || 'default'}, temp: ${request.temperature || 0.7})`)

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      // Only add these headers for OpenRouter, not Requesty
      ...(OPENROUTER_API_KEY && !IS_REQUESTY ? {
        'HTTP-Referer': 'https://talkshowgo.com',
        'X-Title': 'Talk Show Go - Multi-Host System'
      } : {})
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens || 1000,
      temperature: request.temperature !== undefined ? request.temperature : 0.7,
      top_p: request.top_p,
      frequency_penalty: request.frequency_penalty,
      presence_penalty: request.presence_penalty
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[${serviceName}] Error: ${response.status} - ${error}`)
    throw new Error(`${serviceName} API error: ${response.status} - ${error}`)
  }

  const data: OpenRouterResponse = await response.json()
  const content = data.choices[0]?.message?.content || ''
  const tokens = data.usage?.total_tokens || 0

  console.log(`[${serviceName}] Response from ${data.model}: ${tokens} tokens`)

  return {
    content,
    tokens,
    model: data.model
  }
}

/**
 * Get list of available models from OpenRouter/Requesty
 */
export async function getAvailableModels(): Promise<OpenRouterModel[]> {
  if (!API_KEY) {
    throw new Error('REQUESTY_API_KEY or OPENROUTER_API_KEY must be configured')
  }

  // Both services use the same models endpoint format
  const modelsUrl = IS_REQUESTY
    ? 'https://router.requesty.ai/v1/models'
    : 'https://openrouter.ai/api/v1/models'

  const response = await fetch(modelsUrl, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch models: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.data || []
}

/**
 * Model selection strategies based on host personality
 */
export interface DebateHost {
  id: string
  name: string
  opinion_strength: number
  aggression: number
  humor: number
  analytical_depth: number
  empathy: number
  speed: number
  formality: number
  preferred_model?: string
  model_selection: 'auto' | 'manual'
}

/**
 * Auto-select the best model for a host based on their attributes
 */
export function selectModelForHost(host: DebateHost): string {
  // If manual selection and preferred model is set, use it
  if (host.model_selection === 'manual' && host.preferred_model) {
    return host.preferred_model
  }

  // Auto-selection based on personality attributes
  const { analytical_depth, opinion_strength, speed, humor, aggression, empathy, formality } = host

  // High analytical depth + high opinion strength = Deep reasoning needed
  if (analytical_depth > 80 && opinion_strength > 70) {
    return 'anthropic/claude-opus-4.5'
  }

  // High speed + high humor = Fast creative responses
  if (speed > 80 && humor > 60) {
    return 'openai/gpt-4o'
  }

  // High aggression + need for budget efficiency = DeepSeek
  if (aggression > 75) {
    return 'deepseek/deepseek-chat'
  }

  // High empathy + analytical = Claude Sonnet (balanced)
  if (empathy > 70 && analytical_depth > 60) {
    return 'anthropic/claude-sonnet-4-20250514'
  }

  // High formality + analytical = Gemini Pro (structured)
  if (formality > 70 && analytical_depth > 60) {
    return 'google/gemini-2.0-flash-exp:free'
  }

  // Contrarian/alternative perspectives = Llama
  if (opinion_strength > 70 && aggression > 60) {
    return 'meta-llama/llama-3.3-70b-instruct'
  }

  // Default: Balanced, cost-effective
  return 'google/gemini-2.0-flash-exp:free'
}

/**
 * Get model cost per 1000 tokens (approximate)
 */
export function getModelCost(model: string): { prompt: number; completion: number } {
  // Costs are per 1000 tokens
  const costs: Record<string, { prompt: number; completion: number }> = {
    'anthropic/claude-opus-4.5': { prompt: 0.015, completion: 0.075 },
    'anthropic/claude-sonnet-4-20250514': { prompt: 0.003, completion: 0.015 },
    'anthropic/claude-3.5-haiku': { prompt: 0.001, completion: 0.005 },
    'openai/gpt-4o': { prompt: 0.0025, completion: 0.01 },
    'openai/gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
    'deepseek/deepseek-chat': { prompt: 0.00014, completion: 0.00028 },
    'meta-llama/llama-3.3-70b-instruct': { prompt: 0.0004, completion: 0.0004 },
    'google/gemini-2.0-flash-exp:free': { prompt: 0, completion: 0 },
    'google/gemini-pro-1.5': { prompt: 0.00125, completion: 0.005 }
  }

  return costs[model] || { prompt: 0.001, completion: 0.002 }
}

/**
 * Calculate cost for a request
 */
export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = getModelCost(model)
  const promptCost = (promptTokens / 1000) * costs.prompt
  const completionCost = (completionTokens / 1000) * costs.completion
  return promptCost + completionCost
}

/**
 * Check if LLM API is configured (Requesty or OpenRouter)
 */
export function isOpenRouterConfigured(): boolean {
  return !!API_KEY
}
