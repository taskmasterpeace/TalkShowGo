/**
 * Onboarding Quickstart API
 *
 * POST /api/onboarding/quickstart
 *
 * Creates a new topic with initial configuration in one call.
 * Perfect for setting up a new niche quickly.
 *
 * Body:
 * - name: string (required) - Topic name
 * - description: string (optional)
 * - initial_entities: string[] (optional) - Known entities for this niche
 * - initial_patterns: string[] (optional) - Story pattern keywords
 * - hours_back: number (default 48) - How far back to look
 * - min_sources: number (default 2) - Min sources for a story
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      description = '',
      initial_entities = [],
      initial_patterns = ['vs', 'responds', 'beef', 'speaks on'],
      hours_back = 48,
      min_sources = 2
    } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // Check if topic with this name already exists
    const { data: existing } = await supabase
      .from('topics')
      .select('id, name')
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json({
        error: 'Topic already exists',
        existing_topic_id: existing.id
      }, { status: 409 })
    }

    // Build intel config
    const intel_config = {
      hours_back,
      min_sources,
      known_entities: initial_entities.map((e: string) => e.toUpperCase()),
      story_patterns: initial_patterns.map((p: string) => p.toLowerCase())
    }

    // Create the topic
    const { data: topic, error } = await supabase
      .from('topics')
      .insert({
        name,
        description,
        intel_config
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `Topic "${name}" created successfully`,
      topic_id: topic.id,
      name: topic.name,
      description: topic.description,
      config: topic.intel_config,
      next_steps: [
        {
          step: 'add_youtube_sources',
          endpoint: `POST /api/topics/${topic.id}/youtube`,
          example: { channel_name: 'Example Channel', channel_id: 'UC...' }
        },
        {
          step: 'add_more_entities',
          endpoint: `PATCH /api/topics/${topic.id}/config`,
          example: { add_entities: ['ENTITY1', 'ENTITY2'] }
        },
        {
          step: 'test_monitor',
          endpoint: `POST /api/intelligence/monitor`,
          example: { topic_id: topic.id }
        }
      ]
    })
  } catch (error) {
    console.error('Quickstart error:', error)
    return NextResponse.json({
      error: 'Failed to create topic',
      details: String(error)
    }, { status: 500 })
  }
}
