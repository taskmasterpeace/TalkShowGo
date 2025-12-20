/**
 * RAG Chat API
 *
 * POST /api/rag/chat - Chat with your data
 *
 * Body:
 * - message: string - The question to ask
 * - topicSlug?: string - Optional topic to scope the search
 * - mode?: 'story' | 'entity' | 'factcheck' | 'general' - Chat mode
 * - history?: { role: string; content: string }[] - Previous messages
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  RAGClient,
  StoryResearchRAG,
  EntityResearchRAG,
  FactCheckRAG,
} from '@/lib/rag'

// Cache RAG clients per request (could use Redis for persistence)
const clientCache = new Map<string, RAGClient>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, topicSlug, mode = 'general', history } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get or create appropriate RAG client
    const cacheKey = `${mode}_${topicSlug || 'all'}`
    let client = clientCache.get(cacheKey)

    if (!client) {
      switch (mode) {
        case 'story':
          client = new StoryResearchRAG(topicSlug)
          break
        case 'entity':
          client = new EntityResearchRAG(topicSlug)
          break
        case 'factcheck':
          client = new FactCheckRAG()
          break
        default:
          client = new RAGClient({
            collectionName: topicSlug ? `stories_${topicSlug}` : 'stories_all',
          })
      }

      await client.initialize()
      clientCache.set(cacheKey, client)
    }

    // Restore history if provided
    if (history && history.length > 0) {
      client.clearHistory()
      // Note: This is a simplified approach. In production, you might want
      // to properly restore the full history with sources
    }

    // Ask the question
    const response = await client.ask(message)

    return NextResponse.json({
      answer: response.answer,
      sources: response.sources.map(s => ({
        id: s.id,
        content: s.content.substring(0, 500), // Truncate for response size
        type: s.metadata.type,
        similarity: s.similarity,
        metadata: {
          author: s.metadata.author,
          date: s.metadata.date,
          claimType: s.metadata.claimType,
          entityType: s.metadata.entityType,
        },
      })),
      tokensUsed: response.tokensUsed,
      mode,
      topicSlug,
    })
  } catch (error) {
    console.error('RAG chat error:', error)
    return NextResponse.json(
      {
        error: 'Chat failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
