/**
 * Perplexity Search API Endpoint
 *
 * POST /api/search/perplexity - Search using Perplexity Sonar
 * GET /api/search/perplexity/status - Get API status and credits
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchWithPerplexity, getPerplexityStatus, isPerplexityAvailable } from '@/lib/perplexity'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, model, search_recency_filter, topicId } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Check availability first
    const available = await isPerplexityAvailable()
    if (!available) {
      const status = await getPerplexityStatus()
      return NextResponse.json(
        { error: status.message, credits: status.credits },
        { status: 402 } // Payment required (no credits)
      )
    }

    // Perform the search
    const result = await searchWithPerplexity(query, {
      model,
      search_recency_filter,
      topicId,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Perplexity search error:', error)
    const message = error instanceof Error ? error.message : 'Search failed'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const status = await getPerplexityStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Failed to get Perplexity status:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
