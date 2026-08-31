/**
 * API: /api/producer/generate-show
 *
 * POST - Producer-driven show generation (THE GAME-CHANGER)
 *
 * This is the professional API that users interact with:
 * - Choose producer personality
 * - System analyzes Twitter intelligence
 * - Auto-selects optimal hosts
 * - Generates broadcast-quality show
 * - Quality gates ensure readiness
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateProducerShow, ProducerShowRequest } from '@/lib/debate/producer-orchestrator'
import { ProducerArchetype } from '@/lib/producers/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.producer_archetype || !body.topic_id || !body.topic) {
      return NextResponse.json({
        success: false,
        error: 'producer_archetype, topic_id, and topic are required'
      }, { status: 400 })
    }

    // Validate producer archetype
    const validArchetypes: ProducerArchetype[] = [
      'drama_hunter',
      'fact_checker',
      'deep_diver',
      'speed_demon',
      'storyteller',
      'community_pulse'
    ]

    if (!validArchetypes.includes(body.producer_archetype)) {
      return NextResponse.json({
        success: false,
        error: `Invalid producer_archetype. Must be one of: ${validArchetypes.join(', ')}`
      }, { status: 400 })
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`[API] Producer Show Generation Request`)
    console.log(`Producer: ${body.producer_archetype}`)
    console.log(`Topic: ${body.topic}`)
    console.log(`Topic ID: ${body.topic_id}`)
    console.log('='.repeat(80))

    // Build request
    const showRequest: ProducerShowRequest = {
      producer_archetype: body.producer_archetype,
      topic_id: body.topic_id,
      topic: body.topic,
      host_ids: body.host_ids,  // Optional: producer auto-selects if not provided
      show_format_id: body.show_format_id,  // Optional: producer decides if not provided
      target_duration_minutes: body.target_duration_minutes,
      twitter_activity: body.twitter_activity,  // Optional: will fetch if not provided
      research_package_id: body.research_package_id,
      editorial_notes: body.editorial_notes
    }

    // Generate show
    const result = await generateProducerShow(showRequest)

    console.log(`\n✅ Producer show generated successfully!`)
    console.log(`Show Run ID: ${result.show_run_id}`)
    console.log(`Producer: ${result.producer_name}`)
    console.log(`Readiness: ${(result.readiness_score * 100).toFixed(0)}%`)

    // Return comprehensive result
    return NextResponse.json({
      success: true,
      show_run_id: result.show_run_id,

      // Producer info
      producer: {
        name: result.producer_name,
        archetype: result.producer_archetype,
        production_brief: result.production_brief
      },

      // Show details
      format: {
        id: result.format.id,
        type: result.format.format_type,
        name: result.format.name,
        duration: result.format.target_duration_minutes
      },

      hosts: result.hosts.map(h => ({
        id: h.id,
        name: h.name,
        archetype: h.archetype,
        bio: h.bio
      })),

      // Intelligence used
      intelligence: result.intelligence_used,

      // Quality metrics
      quality: {
        readiness_score: result.readiness_score,
        status: result.readiness_score >= 0.7 ? 'ready_to_publish' : 'needs_review',
        gates: result.quality_gates
      },

      // Show stats
      stats: result.stats,

      // Full conversation (if needed)
      conversation: body.include_conversation ? result.conversation : undefined
    })
  } catch (error) {
    console.error('[API] Producer show generation error:', error)

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'NO_TWEETS_FOUND') {
        return NextResponse.json({
          success: false,
          error: 'No recent tweets found for this topic. Check if topic_id is correct and tweets exist.'
        }, { status: 404 })
      }

      if (error.message === 'NO_TOPICS_OR_ENTITIES_EXTRACTED') {
        return NextResponse.json({
          success: false,
          error: 'Could not extract topics or entities from tweets. Content may be too sparse.'
        }, { status: 422 })
      }

      if (error.message.includes('declined to produce')) {
        return NextResponse.json({
          success: false,
          error: error.message,
          suggestion: 'Try a different producer archetype or topic with more engagement'
        }, { status: 422 })
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET - List available producers and their capabilities
 */
export async function GET() {
  const producers = [
    {
      archetype: 'drama_hunter',
      name: 'The Drama Hunter',
      description: 'Lives for controversy and conflict. Creates highly engaging, viral content.',
      best_for: ['debates', 'hot takes', 'controversial topics'],
      speed: 'fast',
      accuracy: 'moderate',
      engagement: 'very_high'
    },
    {
      archetype: 'fact_checker',
      name: 'The Fact Checker',
      description: 'Thorough and skeptical. Verifies everything before publishing.',
      best_for: ['investigations', 'news bulletins', 'rumor verification'],
      speed: 'slow',
      accuracy: 'very_high',
      engagement: 'moderate'
    },
    {
      archetype: 'deep_diver',
      name: 'The Deep Diver',
      description: 'Goes down every rabbit hole. Finds connections others miss.',
      best_for: ['deep dives', 'narrative stories', 'interviews'],
      speed: 'very_slow',
      accuracy: 'high',
      engagement: 'high'
    },
    {
      archetype: 'speed_demon',
      name: 'The Speed Demon',
      description: 'Breaking news specialist. Gets content out fast.',
      best_for: ['breaking news', 'quick reactions', 'hot takes'],
      speed: 'very_fast',
      accuracy: 'moderate',
      engagement: 'moderate'
    },
    {
      archetype: 'storyteller',
      name: 'The Storyteller',
      description: 'Crafts compelling narratives with dramatic arcs.',
      best_for: ['narrative stories', 'documentaries', 'interviews'],
      speed: 'moderate',
      accuracy: 'high',
      engagement: 'very_high'
    },
    {
      archetype: 'community_pulse',
      name: 'The Community Pulse',
      description: 'Monitors sentiment and community reactions. Voice of the people.',
      best_for: ['panel discussions', 'recaps', 'predictions'],
      speed: 'moderate',
      accuracy: 'moderate',
      engagement: 'high'
    }
  ]

  return NextResponse.json({
    producers,
    usage: {
      endpoint: 'POST /api/producer/generate-show',
      required_fields: ['producer_archetype', 'topic_id', 'topic'],
      optional_fields: ['host_ids', 'show_format_id', 'target_duration_minutes', 'editorial_notes'],
      example_request: {
        producer_archetype: 'drama_hunter',
        topic_id: 'uuid-here',
        topic: 'Should battle rappers prioritize performance or lyrical complexity?',
        target_duration_minutes: 15
      }
    }
  })
}
