/**
 * Onboarding Test API
 *
 * POST /api/onboarding/test
 *
 * Runs a limited test of the intelligence system to verify setup.
 * Use this to confirm everything is working before going live.
 *
 * Body:
 * - topic_id: string (required)
 * - mode: 'monitor' | 'research' | 'web_search' | 'deep_research'
 * - query: string (required for research modes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { runMonitor, runResearch } from '@/lib/intelligence-framework'
import { searchWeb, checkSearXNGHealth } from '@/lib/web-search'
import { runDeepResearch, checkLLMHealth } from '@/lib/deep-research'
import { supabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      topic_id,
      mode = 'monitor',
      query
    } = body

    if (!topic_id) {
      return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
    }

    // Verify topic exists and get info
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id, name, intel_config')
      .eq('id', topic_id)
      .single()

    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Run the appropriate test
    switch (mode) {
      case 'monitor': {
        // Test monitor mode - limited sweep
        const { count: channelCount } = await supabase
          .from('youtube_channels')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topic_id)

        if (!channelCount || channelCount === 0) {
          return NextResponse.json({
            success: false,
            mode: 'monitor',
            error: 'No YouTube channels found for this topic',
            fix: 'Add YouTube channels first: POST /api/topics/{topic_id}/youtube'
          }, { status: 400 })
        }

        const result = await runMonitor({
          topic_id,
          hours_back: 72,  // Look back further for test
          min_sources: 1   // Lower threshold for test
        })

        return NextResponse.json({
          success: true,
          mode: 'monitor',
          test_result: 'passed',
          summary: {
            channels_checked: channelCount,
            videos_found: result.videos_found,
            stories_detected: result.stories_detected.length
          },
          sample_videos: result.raw_videos.slice(0, 5).map(v => ({
            title: v.title,
            channel: v.channel_name,
            url: v.url
          })),
          stories: result.stories_detected.slice(0, 3).map(s => ({
            name: s.name,
            type: s.type,
            sources: s.source_count
          }))
        })
      }

      case 'research': {
        if (!query) {
          return NextResponse.json({
            success: false,
            mode: 'research',
            error: 'query is required for research test'
          }, { status: 400 })
        }

        const result = await runResearch(topic_id, query, {
          max_results: 10,
          create_story: false  // Don't create story for test
        })

        return NextResponse.json({
          success: true,
          mode: 'research',
          test_result: result.videos_found > 0 ? 'passed' : 'no_results',
          query,
          summary: {
            videos_found: result.videos_found
          },
          sample_results: result.sources.slice(0, 5).map(v => ({
            title: v.title,
            channel: v.channel_name,
            url: v.url
          }))
        })
      }

      case 'web_search': {
        const searxngOk = await checkSearXNGHealth()
        if (!searxngOk) {
          return NextResponse.json({
            success: false,
            mode: 'web_search',
            error: 'SearXNG service unavailable',
            fix: 'Start SearXNG with: docker-compose up -d searxng'
          }, { status: 503 })
        }

        const testQuery = query || `${topic.name} news`
        const results = await searchWeb(testQuery, { max_results: 5 })

        return NextResponse.json({
          success: true,
          mode: 'web_search',
          test_result: results.length > 0 ? 'passed' : 'no_results',
          query: testQuery,
          summary: {
            results_found: results.length
          },
          sample_results: results.slice(0, 5)
        })
      }

      case 'deep_research': {
        const [searxngOk, llmOk] = await Promise.all([
          checkSearXNGHealth(),
          checkLLMHealth()
        ])

        if (!searxngOk) {
          return NextResponse.json({
            success: false,
            mode: 'deep_research',
            error: 'SearXNG service unavailable',
            fix: 'Start SearXNG with: docker-compose up -d searxng'
          }, { status: 503 })
        }

        if (!llmOk) {
          return NextResponse.json({
            success: false,
            mode: 'deep_research',
            error: 'LLM service unavailable',
            fix: 'Ensure Presidium/Ollama is running at the configured endpoint'
          }, { status: 503 })
        }

        if (!query) {
          return NextResponse.json({
            success: false,
            mode: 'deep_research',
            error: 'query is required for deep research test'
          }, { status: 400 })
        }

        // Run a shallow deep research for testing
        const result = await runDeepResearch({
          topic_id,
          query,
          depth: 1,     // Minimal depth for test
          breadth: 2    // Minimal breadth for test
        })

        return NextResponse.json({
          success: true,
          mode: 'deep_research',
          test_result: result.learnings.length > 0 ? 'passed' : 'no_results',
          query,
          summary: {
            learnings_found: result.learnings.length,
            sources_found: result.sources.length
          },
          sample_learnings: result.learnings.slice(0, 3),
          report_preview: result.report.substring(0, 500) + '...'
        })
      }

      default:
        return NextResponse.json({
          error: `Unknown mode: ${mode}`,
          available_modes: ['monitor', 'research', 'web_search', 'deep_research']
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Onboarding test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: String(error)
    }, { status: 500 })
  }
}
