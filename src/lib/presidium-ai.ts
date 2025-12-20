/**
 * Presidium AI Integration
 *
 * Unified interface for Machine King Labs' AI infrastructure:
 * - Ollama for LLMs (deepseek-coder-v2:16b, qwen3:30b)
 * - mxbai-embed-large for embeddings
 * - Chatterbox for voice synthesis
 */

// ============================================
// CONFIGURATION
// ============================================

const OLLAMA_URL = process.env.OLLAMA_HOST || process.env.PRESIDIUM_LLM_URL || 'https://ai.machinekinglabs.com'
const CHATTERBOX_URL = process.env.CHATTERBOX_URL || 'https://voice.machinekinglabs.com'

const DEFAULT_LLM_MODEL = process.env.PRESIDIUM_LLM_MODEL || 'deepseek-coder-v2:16b'
const REASONING_MODEL = process.env.PRESIDIUM_REASONING_MODEL || 'qwen3:30b'
const EMBED_MODEL = process.env.PRESIDIUM_EMBED_MODEL || 'mxbai-embed-large'

export const PRESIDIUM_CONFIG = {
  ollama: {
    url: OLLAMA_URL,
    models: {
      default: DEFAULT_LLM_MODEL,
      reasoning: REASONING_MODEL,
      embed: EMBED_MODEL,
    },
  },
  chatterbox: {
    url: CHATTERBOX_URL,
  },
}

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface EmbedOptions {
  model?: string
}

// ============================================
// HEALTH CHECKS
// ============================================

export async function checkOllamaHealth(): Promise<{
  available: boolean
  models: string[]
}> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return { available: false, models: [] }
    }

    const data: any = await response.json()
    const models = data.models?.map((m: any) => m.name) || []

    return { available: true, models }
  } catch {
    return { available: false, models: [] }
  }
}

export async function checkChatterboxHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${CHATTERBOX_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function checkPresidiumHealth(): Promise<{
  ollama: { available: boolean; models: string[] }
  chatterbox: boolean
}> {
  const [ollama, chatterbox] = await Promise.all([
    checkOllamaHealth(),
    checkChatterboxHealth(),
  ])

  return { ollama, chatterbox }
}

// ============================================
// LLM CHAT
// ============================================

/**
 * Chat with Ollama LLM
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const model = options.model || DEFAULT_LLM_MODEL

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.max_tokens ?? 2048,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama chat failed: ${error}`)
  }

  const data: any = await response.json()
  return data.message?.content || ''
}

/**
 * Stream chat responses
 */
export async function* streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): AsyncGenerator<string> {
  const model = options.model || DEFAULT_LLM_MODEL

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.max_tokens ?? 2048,
      },
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error('Stream chat failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(l => l.trim())

    for (const line of lines) {
      try {
        const data = JSON.parse(line)
        if (data.message?.content) {
          yield data.message.content
        }
      } catch {
        // Ignore parse errors
      }
    }
  }
}

/**
 * Generate text completion (simpler than chat)
 */
export async function generate(
  prompt: string,
  options: ChatOptions = {}
): Promise<string> {
  const model = options.model || DEFAULT_LLM_MODEL

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.max_tokens ?? 2048,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama generate failed: ${error}`)
  }

  const data: any = await response.json()
  return data.response || ''
}

/**
 * Chat with JSON response format
 */
export async function chatJSON<T = any>(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<T> {
  // Add JSON instruction to system message
  const jsonMessages = [...messages]
  const systemIdx = jsonMessages.findIndex(m => m.role === 'system')

  if (systemIdx >= 0) {
    jsonMessages[systemIdx] = {
      ...jsonMessages[systemIdx],
      content: jsonMessages[systemIdx].content + '\n\nRespond with valid JSON only.',
    }
  } else {
    jsonMessages.unshift({
      role: 'system',
      content: 'Respond with valid JSON only.',
    })
  }

  const response = await chat(jsonMessages, options)

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  return JSON.parse(jsonMatch[0])
}

// ============================================
// EMBEDDINGS
// ============================================

/**
 * Generate embeddings for text
 */
export async function embed(
  text: string,
  options: EmbedOptions = {}
): Promise<number[]> {
  const model = options.model || EMBED_MODEL

  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: text,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Embedding failed: ${error}`)
  }

  const data: any = await response.json()
  return data.embedding || []
}

/**
 * Batch embed multiple texts
 */
export async function embedBatch(
  texts: string[],
  options: EmbedOptions = {}
): Promise<number[][]> {
  // Ollama doesn't support batch, so we parallelize
  const embeddings = await Promise.all(
    texts.map(text => embed(text, options))
  )
  return embeddings
}

// ============================================
// SPECIALIZED TASKS
// ============================================

/**
 * Extract entities from text using DeepSeek
 */
export async function extractEntities(text: string): Promise<{
  people: string[]
  organizations: string[]
  events: string[]
  topics: string[]
}> {
  const result = await chatJSON<{
    people: string[]
    organizations: string[]
    events: string[]
    topics: string[]
  }>([
    {
      role: 'system',
      content: `Extract named entities from the text. Return JSON with arrays for:
- people: Names of people mentioned
- organizations: Companies, teams, brands
- events: Events, battles, matches, shows
- topics: Main topics/themes discussed`,
    },
    { role: 'user', content: text },
  ])

  return result
}

/**
 * Generate a summary using Qwen (better for reasoning)
 */
export async function summarize(text: string, maxLength?: number): Promise<string> {
  return chat([
    {
      role: 'system',
      content: `Summarize the following text concisely.${maxLength ? ` Keep it under ${maxLength} words.` : ''}`,
    },
    { role: 'user', content: text },
  ], { model: REASONING_MODEL })
}

/**
 * Analyze sentiment and claims
 */
export async function analyzeClaims(text: string): Promise<{
  claims: { text: string; sentiment: 'positive' | 'negative' | 'neutral' }[]
  overall_sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
}> {
  return chatJSON([
    {
      role: 'system',
      content: `Analyze the text for claims and sentiment. Return JSON with:
- claims: Array of {text: "claim", sentiment: "positive/negative/neutral"}
- overall_sentiment: "positive", "negative", "neutral", or "mixed"`,
    },
    { role: 'user', content: text },
  ], { model: REASONING_MODEL })
}

/**
 * Generate host narration script
 */
export async function generateNarration(
  content: string,
  hostPersonality: {
    name: string
    archetype: string
    voice_style: string
    catchphrases: string[]
  }
): Promise<string> {
  return chat([
    {
      role: 'system',
      content: `You are ${hostPersonality.name}, ${hostPersonality.archetype}.
Your voice style: ${hostPersonality.voice_style}
Your catchphrases: ${hostPersonality.catchphrases.join(', ')}

Write a narration script for the following content. Stay in character.
Use your catchphrases naturally. Make it engaging and match your personality.`,
    },
    { role: 'user', content: content },
  ], { model: REASONING_MODEL, temperature: 0.8 })
}

// ============================================
// OPENAI-COMPATIBLE CLIENT
// ============================================

/**
 * OpenAI-compatible client for libraries that expect that interface
 */
export class PresidiumClient {
  private baseUrl: string
  private defaultModel: string

  constructor(options?: { baseUrl?: string; model?: string }) {
    this.baseUrl = options?.baseUrl || OLLAMA_URL
    this.defaultModel = options?.model || DEFAULT_LLM_MODEL
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    return chat(messages, { ...options, model: options?.model || this.defaultModel })
  }

  async embed(text: string): Promise<number[]> {
    return embed(text)
  }

  async generate(prompt: string, options?: ChatOptions): Promise<string> {
    return generate(prompt, { ...options, model: options?.model || this.defaultModel })
  }
}

// Export singleton client
export const presidium = new PresidiumClient()
