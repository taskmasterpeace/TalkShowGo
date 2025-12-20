/**
 * RESEARCH Mode API
 *
 * POST /api/intelligence/research
 *
 * Searches for content about a specific topic/story.
 * Use this for historical research - "What happened with Old Red?" or "Debo Cap fight"
 *
 * Body:
 * - topic_id: string (required)
 * - query: string (required) - What to search for
 * - mode: string (default 'quick') - 'quick' (YouTube only) or 'deep' (iterative web research)
 * - max_results: number (default 25) - How many videos to fetch (quick mode)
 * - depth: number (default 3) - Research iterations (deep mode)
 * - breadth: number (default 3) - Queries per iteration (deep mode)
 * - create_story: boolean (default true) - Create a story record
 * - story_name: string (optional) - Name for the story (defaults to query)
 * - story_type: string (default 'historical') - Type of story
 */

import { NextRequest, NextResponse } from 'next/server'
import { runResearch } from '@/lib/intelligence-framework'
import { runDeepResearch, checkLLMHealth } from '@/lib/deep-research'
import { checkSearXNGHealth } from '@/lib/web-search'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      topic_id,
      query,
      mode = 'quick',  // 'quick' or 'deep'
      max_results = 25,
      depth = 3,
      breadth = 3,
      create_story = true,
      story_name,
      story_type = 'historical'
    } = body

    if (!topic_id) {
      return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
    }

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    // DEEP MODE - Iterative web research
    if (mode === 'deep') {
      // Check dependencies
      const [searxngOk, llmOk] = await Promise.all([
        checkSearXNGHealth(),
        checkLLMHealth()
      ])

      if (!searxngOk) {
        return NextResponse.json({
          error: 'SearXNG service unavailable for deep research',
          details: 'Start SearXNG with: docker-compose up -d searxng'
        }, { status: 503 })
      }

      if (!llmOk) {
        return NextResponse.json({
          error: 'LLM service unavailable for deep research',
          details: 'Ensure Presidium/Ollama is running'
        }, { status: 503 })
      }

      const deepResult = await runDeepResearch({
        topic_id,
        query,
        depth,
        breadth
      })

      return NextResponse.json({
        success: true,
        mode: 'deep',
        run_id: deepResult.run_id,
        query: deepResult.query,
        report: deepResult.report,
        summary: {
          learnings_count: deepResult.learnings.length,
          sources_count: deepResult.sources.length,
          iterations: deepResult.iterations
        },
        learnings: deepResult.learnings,
        sources: deepResult.sources
      })
    }

    // QUICK MODE - YouTube search (default)
    const result = await runResearch(topic_id, query, {
      max_results,
      create_story,
      story_name,
      story_type
    })

    return NextResponse.json({
      success: true,
      mode: 'quick',
      run_id: result.run_id,
      query: result.query,
      videos_found: result.videos_found,
      story_id: result.story_id,
      sources: result.sources.map(v => ({
        video_id: v.video_id,
        title: v.title,
        channel: v.channel_name,
        published: v.published_at,
        url: v.url,
        description: v.description?.substring(0, 200)
      }))
    })
  } catch (error) {
    console.error('Research error:', error)
    return NextResponse.json({
      error: 'Research failed',
      details: String(error)
    }, { status: 500 })
  }
}
