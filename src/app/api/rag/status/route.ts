/**
 * RAG System Status API
 *
 * GET /api/rag/status - Check RAG system health
 *
 * Returns:
 * - Embedding provider status
 * - LLM provider status
 * - Collection stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { embeddings, vectorStore } from '@/lib/rag'
import { llm } from '@/lib/llm/client'

export async function GET(request: NextRequest) {
  const status = {
    embeddingProvider: {
      available: false,
      provider: null as string | null,
      error: null as string | null,
    },
    llmProvider: {
      available: false,
      provider: null as string | null,
      error: null as string | null,
    },
    vectorStore: {
      available: false,
      collections: [] as any[],
      totalDocuments: 0,
      error: null as string | null,
    },
    ready: false,
  }

  // Check embedding provider
  try {
    const embeddingClient = await embeddings.getAvailableClient()
    if (embeddingClient) {
      status.embeddingProvider.available = true
      status.embeddingProvider.provider = 'ollama' // Could be improved to return actual provider
    }
  } catch (error) {
    status.embeddingProvider.error =
      error instanceof Error ? error.message : 'Unknown error'
  }

  // Check LLM provider
  try {
    const llmClient = await llm.getAvailableClient()
    if (llmClient) {
      status.llmProvider.available = true
      status.llmProvider.provider = 'local' // Could be improved
    }
  } catch (error) {
    status.llmProvider.error =
      error instanceof Error ? error.message : 'Unknown error'
  }

  // Check vector store
  try {
    const stats = await vectorStore.getStats()
    status.vectorStore.available = true
    status.vectorStore.collections = stats.collections
    status.vectorStore.totalDocuments = stats.documentCount
  } catch (error) {
    status.vectorStore.error =
      error instanceof Error ? error.message : 'Unknown error'
  }

  // Overall readiness
  status.ready =
    status.embeddingProvider.available &&
    status.llmProvider.available &&
    status.vectorStore.available

  return NextResponse.json(status)
}
