/**
 * EMBEDDINGS CLIENT
 *
 * Generates text embeddings using local or cloud providers.
 * Prioritizes local Ollama for free embeddings!
 */

export interface EmbeddingConfig {
  provider: 'ollama' | 'openai' | 'local'
  baseUrl?: string
  apiKey?: string
  model: string
  dimensions?: number
}

export const DEFAULT_EMBEDDING_CONFIGS: Record<string, EmbeddingConfig> = {
  // Local Ollama (FREE!)
  ollama: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'nomic-embed-text', // Great free embedding model
    dimensions: 768,
  },

  // OpenAI (paid fallback)
  openai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
}

export class EmbeddingClient {
  private config: EmbeddingConfig

  constructor(config: EmbeddingConfig | string = 'ollama') {
    if (typeof config === 'string') {
      this.config = DEFAULT_EMBEDDING_CONFIGS[config] || DEFAULT_EMBEDDING_CONFIGS.ollama
    } else {
      this.config = config
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    switch (this.config.provider) {
      case 'ollama':
        return this.embedOllama(text)
      case 'openai':
        return this.embedOpenAI(text)
      default:
        throw new Error(`Unknown embedding provider: ${this.config.provider}`)
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama doesn't support batch, so we do it sequentially
    if (this.config.provider === 'ollama') {
      const results: number[][] = []
      for (const text of texts) {
        results.push(await this.embed(text))
      }
      return results
    }

    // OpenAI supports batch
    return this.embedOpenAIBatch(texts)
  }

  /**
   * Check if embedding service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (this.config.provider === 'ollama') {
        const res = await fetch(`${this.config.baseUrl}/api/tags`)
        if (!res.ok) return false

        // Check if embedding model is available
        const data = await res.json()
        const models = data.models?.map((m: any) => m.name) || []
        return models.some((m: string) => m.includes('embed') || m === this.config.model)
      }

      if (this.config.provider === 'openai') {
        return !!this.config.apiKey
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.config.dimensions || 768
  }

  // ============================================
  // PROVIDER-SPECIFIC IMPLEMENTATIONS
  // ============================================

  private async embedOllama(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: text,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama embedding error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.embedding || []
  }

  private async embedOpenAI(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI embedding error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.data?.[0]?.embedding || []
  }

  private async embedOpenAIBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI embedding error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.data?.map((d: any) => d.embedding) || []
  }
}

// ============================================
// SMART EMBEDDING CLIENT (auto-selects provider)
// ============================================

export class SmartEmbeddingClient {
  private clients: { config: EmbeddingConfig; priority: number }[] = []

  constructor() {
    // Local first!
    this.clients.push({ config: DEFAULT_EMBEDDING_CONFIGS.ollama, priority: 1 })

    // OpenAI as fallback
    if (process.env.OPENAI_API_KEY) {
      this.clients.push({ config: DEFAULT_EMBEDDING_CONFIGS.openai, priority: 10 })
    }
  }

  async getAvailableClient(): Promise<EmbeddingClient | null> {
    for (const { config } of this.clients) {
      const client = new EmbeddingClient(config)
      if (await client.isAvailable()) {
        console.log(`Using embedding provider: ${config.provider} (${config.model})`)
        return client
      }
    }
    return null
  }

  async embed(text: string): Promise<number[]> {
    const client = await this.getAvailableClient()
    if (!client) {
      throw new Error('No embedding provider available')
    }
    return client.embed(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const client = await this.getAvailableClient()
    if (!client) {
      throw new Error('No embedding provider available')
    }
    return client.embedBatch(texts)
  }
}

// ============================================
// SINGLETON
// ============================================

export const embeddings = new SmartEmbeddingClient()
