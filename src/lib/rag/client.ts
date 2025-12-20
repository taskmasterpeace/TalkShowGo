/**
 * RAG CLIENT
 *
 * Retrieval Augmented Generation - Chat with your data!
 * Combines vector search with LLM to answer questions about your content.
 */

import { VectorStore, SearchResult } from './vectorstore'
import { LLMClient, SmartLLMClient, LLMMessage } from '../llm/client'

// ============================================
// TYPES
// ============================================

export interface RAGConfig {
  collectionName: string
  systemPrompt?: string
  maxRetrievedDocs?: number
  minSimilarity?: number
}

export interface RAGResponse {
  answer: string
  sources: SearchResult[]
  tokensUsed?: {
    prompt: number
    completion: number
    total: number
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: SearchResult[]
}

// ============================================
// DEFAULT PROMPTS
// ============================================

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant for Talk Show Go, a media intelligence platform. Your job is to help researchers and producers understand what's happening in the culture by analyzing tweets, claims, and entities.

When answering questions:
1. Base your answers ONLY on the provided context
2. If the context doesn't contain relevant information, say so
3. Cite specific tweets or claims when possible
4. Identify patterns and connections between different pieces of information
5. Be concise but thorough

You have access to:
- Tweets from monitored accounts
- Extracted claims (statements, opinions, predictions)
- Entity information (people, events, organizations)

Help the team identify stories, understand sentiment, and make informed decisions about what content to produce.`

const RETRIEVAL_PROMPT = `Based on the following context from our database, please answer the user's question.

CONTEXT:
{context}

USER QUESTION: {question}

Please provide a helpful, accurate response based on the context above. If the context doesn't contain enough information to answer fully, acknowledge what's missing.`

// ============================================
// RAG CLIENT CLASS
// ============================================

export class RAGClient {
  private vectorStore: VectorStore
  private llm: SmartLLMClient
  private config: RAGConfig
  private chatHistory: ChatMessage[] = []

  constructor(config: RAGConfig) {
    this.config = {
      maxRetrievedDocs: 5,
      minSimilarity: 0.5,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ...config,
    }
    this.vectorStore = new VectorStore()
    this.llm = new SmartLLMClient()
  }

  /**
   * Initialize the RAG client
   */
  async initialize(): Promise<void> {
    await this.vectorStore.useCollection(this.config.collectionName)
  }

  /**
   * Ask a question and get an answer with sources
   */
  async ask(question: string): Promise<RAGResponse> {
    // Retrieve relevant documents
    const sources = await this.vectorStore.search(
      question,
      this.config.maxRetrievedDocs
    )

    // Filter by similarity
    const relevantSources = sources.filter(
      s => s.similarity >= (this.config.minSimilarity || 0.5)
    )

    // Build context from sources
    const context = this.buildContext(relevantSources)

    // Build prompt
    const prompt = RETRIEVAL_PROMPT
      .replace('{context}', context)
      .replace('{question}', question)

    // Build messages
    const messages: LLMMessage[] = [
      { role: 'system', content: this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      ...this.chatHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ]

    // Get LLM response
    const response = await this.llm.chat(messages)

    // Update chat history
    this.chatHistory.push({ role: 'user', content: question })
    this.chatHistory.push({
      role: 'assistant',
      content: response.content,
      sources: relevantSources,
    })

    return {
      answer: response.content,
      sources: relevantSources,
      tokensUsed: response.tokensUsed,
    }
  }

  /**
   * Chat without retrieval (uses history only)
   */
  async chat(message: string): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      ...this.chatHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const response = await this.llm.chat(messages)

    this.chatHistory.push({ role: 'user', content: message })
    this.chatHistory.push({ role: 'assistant', content: response.content })

    return response.content
  }

  /**
   * Build context string from search results
   */
  private buildContext(sources: SearchResult[]): string {
    if (sources.length === 0) {
      return 'No relevant information found in the database.'
    }

    return sources
      .map((source, i) => {
        const meta = source.metadata
        let header = `[Source ${i + 1}]`

        if (meta.type === 'tweet') {
          header += ` Tweet from @${meta.author || 'unknown'}`
          if (meta.date) header += ` (${meta.date})`
        } else if (meta.type === 'claim') {
          header += ` Claim: ${meta.claimType || 'statement'}`
        } else if (meta.type === 'entity') {
          header += ` Entity: ${meta.entityType || 'unknown'}`
        }

        return `${header}\n${source.content}\nRelevance: ${(source.similarity * 100).toFixed(0)}%`
      })
      .join('\n\n---\n\n')
  }

  /**
   * Get chat history
   */
  getHistory(): ChatMessage[] {
    return [...this.chatHistory]
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    this.chatHistory = []
  }

  /**
   * Get stats about the knowledge base
   */
  async getStats() {
    return this.vectorStore.getStats()
  }
}

// ============================================
// SPECIALIZED RAG CLIENTS
// ============================================

/**
 * Story Research RAG - For researching potential stories
 */
export class StoryResearchRAG extends RAGClient {
  constructor(topicSlug?: string) {
    super({
      collectionName: topicSlug ? `stories_${topicSlug}` : 'stories_all',
      systemPrompt: `You are a story research assistant for Talk Show Go. Your job is to help producers identify compelling stories from social media intelligence.

When analyzing data, consider:
- What claims are being made and by whom?
- Is there consensus or controversy?
- What's the emotional temperature (hype, anger, disappointment)?
- Are there emerging patterns or breaking news?
- What would make this a good story?

Story formats to consider:
- BREAKING NEWS: Time-sensitive, high-consensus
- HOT TAKE: Controversial, opinion-heavy
- DEEP DIVE: Complex, requires explanation
- DEBATE: Multiple strong opposing viewpoints
- NARRATIVE: Evolving story with characters and arc

Help the team find stories worth telling.`,
      maxRetrievedDocs: 10,
    })
  }
}

/**
 * Entity Research RAG - For deep dives on specific people/events
 */
export class EntityResearchRAG extends RAGClient {
  constructor(topicSlug?: string) {
    super({
      collectionName: topicSlug ? `entities_${topicSlug}` : 'entities_all',
      systemPrompt: `You are an entity research assistant for Talk Show Go. Your job is to provide comprehensive information about people, events, and organizations mentioned in our data.

When researching entities:
- Summarize what we know about them
- Track sentiment over time
- Identify relationships with other entities
- Note any controversies or notable events
- Highlight recent activity

Provide accurate, well-sourced information based on our collected data.`,
      maxRetrievedDocs: 15,
    })
  }
}

/**
 * Fact Check RAG - For verifying claims
 */
export class FactCheckRAG extends RAGClient {
  constructor() {
    super({
      collectionName: 'claims_all',
      systemPrompt: `You are a fact-checking assistant for Talk Show Go. Your job is to help verify claims by analyzing what multiple sources say.

When checking claims:
- Identify the specific claim being made
- Find supporting evidence
- Find contradicting evidence
- Assess source credibility
- Provide a confidence level

Be objective and thorough. Present evidence from all sides.`,
      maxRetrievedDocs: 20,
      minSimilarity: 0.6,
    })
  }
}
