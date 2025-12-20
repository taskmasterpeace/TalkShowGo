/**
 * Topic Intel Config API
 *
 * GET /api/topics/[id]/config - Get topic's intel configuration
 * PUT /api/topics/[id]/config - Update topic's intel configuration
 *
 * Config includes:
 * - hours_back: How far back to look for content
 * - min_sources: Minimum sources to detect a story
 * - known_entities: Names/keywords specific to this niche
 * - story_patterns: Keywords that indicate a story (vs, responds, beef, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  const { data: topic, error } = await supabase
    .from('topics')
    .select('id, name, intel_config')
    .eq('id', id)
    .single()

  if (error || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  return NextResponse.json({
    topic_id: topic.id,
    name: topic.name,
    config: topic.intel_config || {
      hours_back: 48,
      min_sources: 2,
      known_entities: [],
      story_patterns: []
    }
  })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await request.json()
    const { hours_back, min_sources, known_entities, story_patterns } = body

    // Build config object
    const config: any = {}
    if (hours_back !== undefined) config.hours_back = hours_back
    if (min_sources !== undefined) config.min_sources = min_sources
    if (known_entities !== undefined) config.known_entities = known_entities
    if (story_patterns !== undefined) config.story_patterns = story_patterns

    const { data, error } = await supabase
      .from('topics')
      .update({ intel_config: config })
      .eq('id', id)
      .select('id, name, intel_config')
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      topic_id: data.id,
      name: data.name,
      config: data.intel_config
    })
  } catch (error) {
    console.error('Update config error:', error)
    return NextResponse.json({
      error: 'Failed to update config',
      details: String(error)
    }, { status: 500 })
  }
}

// PATCH to add entities/patterns without replacing
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await request.json()
    const { add_entities, add_patterns, remove_entities, remove_patterns } = body

    // Get current config
    const { data: topic } = await supabase
      .from('topics')
      .select('intel_config')
      .eq('id', id)
      .single()

    const currentConfig = topic?.intel_config || {
      hours_back: 48,
      min_sources: 2,
      known_entities: [],
      story_patterns: []
    }

    // Add new entities
    if (add_entities && Array.isArray(add_entities)) {
      const existing = new Set(currentConfig.known_entities || [])
      add_entities.forEach((e: string) => existing.add(e.toUpperCase()))
      currentConfig.known_entities = Array.from(existing)
    }

    // Remove entities
    if (remove_entities && Array.isArray(remove_entities)) {
      const toRemove = new Set(remove_entities.map((e: string) => e.toUpperCase()))
      currentConfig.known_entities = (currentConfig.known_entities || [])
        .filter((e: string) => !toRemove.has(e.toUpperCase()))
    }

    // Add patterns
    if (add_patterns && Array.isArray(add_patterns)) {
      const existing = new Set(currentConfig.story_patterns || [])
      add_patterns.forEach((p: string) => existing.add(p.toLowerCase()))
      currentConfig.story_patterns = Array.from(existing)
    }

    // Remove patterns
    if (remove_patterns && Array.isArray(remove_patterns)) {
      const toRemove = new Set(remove_patterns.map((p: string) => p.toLowerCase()))
      currentConfig.story_patterns = (currentConfig.story_patterns || [])
        .filter((p: string) => !toRemove.has(p.toLowerCase()))
    }

    const { data, error } = await supabase
      .from('topics')
      .update({ intel_config: currentConfig })
      .eq('id', id)
      .select('id, name, intel_config')
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      topic_id: data.id,
      config: data.intel_config
    })
  } catch (error) {
    console.error('Patch config error:', error)
    return NextResponse.json({
      error: 'Failed to patch config',
      details: String(error)
    }, { status: 500 })
  }
}
