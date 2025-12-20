/**
 * RAG Indexing API
 *
 * POST /api/rag/index - Index content for a topic
 * GET /api/rag/index?topic=slug - Get index status
 *
 * Body (POST):
 * - topicSlug: string - Topic to index
 * - reindex?: boolean - Whether to clear and rebuild
 */

import { NextRequest, NextResponse } from 'next/server'
import { ragIndexer } from '@/lib/rag'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topicSlug, reindex = false } = body

    if (!topicSlug) {
      return NextResponse.json(
        { error: 'topicSlug is required' },
        { status: 400 }
      )
    }

    // Index the topic
    const stats = reindex
      ? await ragIndexer.reindexTopic(topicSlug)
      : await ragIndexer.indexTopic(topicSlug)

    return NextResponse.json({
      success: true,
      topicSlug,
      reindexed: reindex,
      stats,
    })
  } catch (error) {
    console.error('RAG indexing error:', error)
    return NextResponse.json(
      {
        error: 'Indexing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicSlug = searchParams.get('topic')

    if (!topicSlug) {
      return NextResponse.json(
        { error: 'topic query param is required' },
        { status: 400 }
      )
    }

    const status = await ragIndexer.getIndexStatus(topicSlug)

    return NextResponse.json({
      topicSlug,
      status,
      totalIndexed:
        status.tweets.indexed +
        status.claims.indexed +
        status.entities.indexed,
      totalPending:
        status.tweets.pending +
        status.claims.pending +
        status.entities.pending,
    })
  } catch (error) {
    console.error('RAG status error:', error)
    return NextResponse.json(
      {
        error: 'Status check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
