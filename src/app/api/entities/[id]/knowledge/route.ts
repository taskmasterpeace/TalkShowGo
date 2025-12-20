/**
 * Entity Knowledge API
 *
 * GET  - Get all accumulated knowledge about an entity
 * POST - Add a new fact about an entity
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/entities/[id]/knowledge - Get everything we know about an entity
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    // Get the entity itself
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single()

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    // Get all facts about this entity
    const { data: facts } = await supabase
      .from('entity_facts')
      .select('*')
      .eq('entity_id', id)
      .order('learned_at', { ascending: false })

    // Get all relationships
    const { data: relationshipsA } = await supabase
      .from('entity_relationships')
      .select(`
        *,
        entity_b:entity_b_id(id, canonical_name, entity_type)
      `)
      .eq('entity_a_id', id)

    const { data: relationshipsB } = await supabase
      .from('entity_relationships')
      .select(`
        *,
        entity_a:entity_a_id(id, canonical_name, entity_type)
      `)
      .eq('entity_b_id', id)

    // Get activity history (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: activity } = await supabase
      .from('entity_activity')
      .select('activity_date, mention_count, total_engagement')
      .eq('entity_id', id)
      .gte('activity_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('activity_date', { ascending: false })

    // Get mention count from entity_mentions table
    const { count: totalMentions } = await supabase
      .from('entity_mentions')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', id)

    // Combine relationships
    const relationships = [
      ...(relationshipsA || []).map(r => ({
        id: r.id,
        type: r.relationship_type,
        direction: r.relationship_direction,
        strength: r.strength,
        related_entity: r.entity_b,
        source_type: r.source_type,
        source_id: r.source_id,
        created_at: r.created_at
      })),
      ...(relationshipsB || []).map(r => ({
        id: r.id,
        type: r.relationship_type,
        direction: r.relationship_direction === 'a_to_b' ? 'b_to_a' : r.relationship_direction,
        strength: r.strength,
        related_entity: r.entity_a,
        source_type: r.source_type,
        source_id: r.source_id,
        created_at: r.created_at
      }))
    ]

    // Group facts by type
    const factsByType: Record<string, any[]> = {}
    for (const fact of facts || []) {
      if (!factsByType[fact.fact_type]) {
        factsByType[fact.fact_type] = []
      }
      factsByType[fact.fact_type].push(fact)
    }

    return NextResponse.json({
      entity: {
        id: entity.id,
        canonical_name: entity.canonical_name,
        entity_type: entity.entity_type,
        metadata: entity.metadata,
        first_seen: entity.first_seen,
        last_seen: entity.last_seen,
        mention_count: entity.mention_count
      },
      facts: facts || [],
      facts_by_type: factsByType,
      fact_count: facts?.length || 0,
      relationships,
      relationship_count: relationships.length,
      activity: activity || [],
      total_mentions: totalMentions || 0,
      summary: {
        has_bio: factsByType['bio']?.length > 0,
        has_battle_record: factsByType['battle_record']?.length > 0,
        has_affiliations: factsByType['affiliation']?.length > 0,
        verified_facts: facts?.filter(f => f.verified).length || 0
      }
    })
  } catch (error) {
    console.error('Error fetching entity knowledge:', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 })
  }
}

// POST /api/entities/[id]/knowledge - Add a fact about an entity
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await request.json()
    const {
      fact_type,
      fact_text,
      fact_date,
      source_type,
      source_id,
      source_url,
      source_timestamp,
      confidence = 0.8,
      metadata = {}
    } = body

    if (!fact_type || !fact_text || !source_type) {
      return NextResponse.json({
        error: 'Missing required fields: fact_type, fact_text, source_type'
      }, { status: 400 })
    }

    // Check entity exists
    const { data: entity } = await supabase
      .from('entities')
      .select('id, topic_id')
      .eq('id', id)
      .single()

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    // Create hash for dedup
    const factHash = Buffer.from(
      `${id}:${fact_type}:${fact_text.toLowerCase().trim()}`
    ).toString('base64')

    // Check for duplicate
    const { data: existing } = await supabase
      .from('entity_facts')
      .select('id')
      .eq('fact_hash', factHash)
      .single()

    if (existing) {
      return NextResponse.json({
        message: 'Fact already exists',
        fact_id: existing.id,
        duplicate: true
      })
    }

    // Insert the fact
    const { data: fact, error } = await supabase
      .from('entity_facts')
      .insert({
        entity_id: id,
        topic_id: entity.topic_id,
        fact_type,
        fact_text,
        fact_date,
        source_type,
        source_id,
        source_url,
        source_timestamp,
        confidence,
        fact_hash: factHash,
        metadata
      })
      .select()
      .single()

    if (error) throw error

    // Update entity last_seen
    await supabase
      .from('entities')
      .update({
        last_seen: new Date().toISOString(),
        mention_count: (entity as any).mention_count + 1 || 1
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      fact_id: fact.id,
      message: `Added ${fact_type} fact to entity`
    })
  } catch (error) {
    console.error('Error adding fact:', error)
    return NextResponse.json({ error: 'Failed to add fact' }, { status: 500 })
  }
}
