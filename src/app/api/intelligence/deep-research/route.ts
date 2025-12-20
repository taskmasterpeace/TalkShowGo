/**
 * Deep Research API
 *
 * POST /api/intelligence/deep-research
 *
 * Performs iterative deep research on a topic using:
 * - SearXNG for web search
 * - Presidium/Ollama for LLM analysis
 *
 * This is for comprehensive historical research like:
 * - "Old Red battle rap complete history"
 * - "Debo Cap fight in the rain full story"
 *
 * Body:
 * - topic_id: string (optional) - For tracking
 * - query: string (required) - What to research
 * - depth: number (default 3) - How many iterations
 * - breadth: number (default 3) - Queries per iteration
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDeepResearch, checkLLMHealth } from '@/lib/deep-research'
import { checkSearXNGHealth } from '@/lib/web-search'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      topic_id,
      query,
      depth = 3,
      breadth = 3
    } = body

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    // Check dependencies
    const [searxngOk, llmOk] = await Promise.all([
      checkSearXNGHealth(),
      checkLLMHealth()
    ])

    if (!searxngOk) {
      return NextResponse.json({
        error: 'SearXNG service unavailable',
        details: 'Start SearXNG with: docker-compose up -d searxng'
      }, { status: 503 })
    }

    if (!llmOk) {
      return NextResponse.json({
        error: 'LLM service unavailable',
        details: 'Ensure Presidium/Ollama is running at the configured endpoint'
      }, { status: 503 })
    }

    // Run deep research
    const result = await runDeepResearch({
      topic_id,
      query,
      depth,
      breadth
    })

    return NextResponse.json({
      success: true,
      run_id: result.run_id,
      query: result.query,
      report: result.report,
      summary: {
        learnings_count: result.learnings.length,
        sources_count: result.sources.length,
        iterations: result.iterations,
        total_queries: result.total_queries
      },
      learnings: result.learnings,
      sources: result.sources
    })
  } catch (error) {
    console.error('Deep research error:', error)
    return NextResponse.json({
      error: 'Deep research failed',
      details: String(error)
    }, { status: 500 })
  }
}

// GET endpoint for checking status
export async function GET(request: NextRequest) {
  const [searxngOk, llmOk] = await Promise.all([
    checkSearXNGHealth(),
    checkLLMHealth()
  ])

  return NextResponse.json({
    status: searxngOk && llmOk ? 'ready' : 'not_ready',
    services: {
      searxng: searxngOk ? 'ok' : 'unavailable',
      llm: llmOk ? 'ok' : 'unavailable'
    },
    config: {
      searxng_url: process.env.SEARXNG_URL || 'http://localhost:8888',
      llm_endpoint: process.env.DEEP_RESEARCH_LLM_ENDPOINT || process.env.PRESIDIUM_URL || 'http://localhost:11434',
      llm_model: process.env.DEEP_RESEARCH_MODEL || 'qwen3:14b'
    }
  })
}
