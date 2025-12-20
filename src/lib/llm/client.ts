/**
 * LLM CLIENT
 *
 * Flexible client that can connect to:
 * - Local Ollama
 * - Local LM Studio
 * - OpenAI-compatible APIs (LocalAI, vLLM, etc.)
 * - OpenAI
 * - Anthropic
 *
 * Prioritizes local LLMs to save money!
 */

// ============================================
// TYPES
// ============================================

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'openai-compatible' | 'anthropic' | 'local'
  baseUrl?: string
  apiKey?: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  tokensUsed: {
    prompt: number
    completion: number
    total: number
  }
  model: string
  provider: string
}

export interface LLMStreamChunk {
  content: string
  done: boolean
}

// ============================================
// DEFAULT CONFIGS
// ============================================

export const DEFAULT_CONFIGS: Record<string, LLMConfig> = {
  // Local Ollama (default)
  ollama: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama2',
    temperature: 0.7,
  },

  // Local LM Studio
  lmstudio: {
    provider: 'openai-compatible',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    temperature: 0.7,
  },

  // LocalAI
  localai: {
    provider: 'openai-compatible',
    baseUrl: 'http://localhost:8080/v1',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
  },

  // OpenAI
  openai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    temperature: 0.7,
  },

  // Anthropic
  anthropic: {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-haiku-20240307',
    temperature: 0.7,
  },
}

// ============================================
// LLM CLIENT CLASS
// ============================================

export class LLMClient {
  private config: LLMConfig

  constructor(config: LLMConfig | string = 'ollama') {
    if (typeof config === 'string') {
      this.config = DEFAULT_CONFIGS[config] || DEFAULT_CONFIGS.ollama
    } else {
      this.config = config
    }
  }

  /**
   * Send a chat completion request
   */
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'ollama':
        return this.chatOllama(messages)
      case 'openai':
      case 'openai-compatible':
        return this.chatOpenAI(messages)
      case 'anthropic':
        return this.chatAnthropic(messages)
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`)
    }
  }

  /**
   * Simple completion (just a prompt, get a response)
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: LLMMessage[] = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    messages.push({ role: 'user', content: prompt })

    const response = await this.chat(messages)
    return response.content
  }

  /**
   * Check if the LLM is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (this.config.provider === 'ollama') {
        const res = await fetch(`${this.config.baseUrl}/api/tags`)
        return res.ok
      }

      if (this.config.provider === 'openai-compatible' || this.config.provider === 'openai') {
        const res = await fetch(`${this.config.baseUrl}/models`, {
          headers: this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {},
        })
        return res.ok
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      if (this.config.provider === 'ollama') {
        const res = await fetch(`${this.config.baseUrl}/api/tags`)
        const data = await res.json()
        return data.models?.map((m: any) => m.name) || []
      }

      if (this.config.provider === 'openai-compatible' || this.config.provider === 'openai') {
        const res = await fetch(`${this.config.baseUrl}/models`, {
          headers: this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {},
        })
        const data = await res.json()
        return data.data?.map((m: any) => m.id) || []
      }

      return []
    } catch {
      return []
    }
  }

  // ============================================
  // PROVIDER-SPECIFIC IMPLEMENTATIONS
  // ============================================

  private async chatOllama(messages: LLMMessage[]): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
        options: {
          temperature: this.config.temperature,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      content: data.message?.content || '',
      tokensUsed: {
        prompt: data.prompt_eval_count || 0,
        completion: data.eval_count || 0,
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      model: this.config.model,
      provider: 'ollama',
    }
  }

  private async chatOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI error: ${error}`)
    }

    const data = await response.json()

    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      },
      model: this.config.model,
      provider: this.config.provider,
    }
  }

  private async chatAnthropic(messages: LLMMessage[]): Promise<LLMResponse> {
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 4096,
        system: systemMessage?.content,
        messages: chatMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic error: ${error}`)
    }

    const data = await response.json()

    return {
      content: data.content?.[0]?.text || '',
      tokensUsed: {
        prompt: data.usage?.input_tokens || 0,
        completion: data.usage?.output_tokens || 0,
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      model: this.config.model,
      provider: 'anthropic',
    }
  }
}

// ============================================
// SMART CLIENT (Auto-selects best available)
// ============================================

export class SmartLLMClient {
  private clients: { config: LLMConfig; priority: number }[] = []

  constructor() {
    // Add providers in priority order (local first!)
    this.addProvider(DEFAULT_CONFIGS.ollama, 1)
    this.addProvider(DEFAULT_CONFIGS.lmstudio, 2)
    this.addProvider(DEFAULT_CONFIGS.localai, 3)

    // Only add cloud providers if API keys exist
    if (process.env.OPENAI_API_KEY) {
      this.addProvider(DEFAULT_CONFIGS.openai, 10)
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.addProvider(DEFAULT_CONFIGS.anthropic, 11)
    }
  }

  addProvider(config: LLMConfig, priority: number) {
    this.clients.push({ config, priority })
    // Sort by priority
    this.clients.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Find first available provider
   */
  async getAvailableClient(): Promise<LLMClient | null> {
    for (const { config } of this.clients) {
      const client = new LLMClient(config)
      if (await client.isAvailable()) {
        console.log(`Using LLM provider: ${config.provider} (${config.baseUrl})`)
        return client
      }
    }
    return null
  }

  /**
   * Chat using best available provider
   */
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const client = await this.getAvailableClient()
    if (!client) {
      throw new Error('No LLM provider available')
    }
    return client.chat(messages)
  }

  /**
   * Simple completion using best available provider
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const client = await this.getAvailableClient()
    if (!client) {
      throw new Error('No LLM provider available')
    }
    return client.complete(prompt, systemPrompt)
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

export const llm = new SmartLLMClient()

// Direct provider access
export const ollama = new LLMClient('ollama')
export const openai = new LLMClient('openai')
