/**
 * Entity Enrichment API
 *
 * POST /api/entities/[id]/enrich
 * Enrich an entity with web search + LLM analysis
 *
 * Body:
 * - force: boolean (optional) - Force re-enrichment even if locked/recent
 * - niche_keywords: string[] (optional) - Context keywords for better search
 *
 * POST /api/entities/[id]/enrich/lock
 * Lock entity to prevent enrichment
 *
 * POST /api/entities/[id]/enrich/unlock
 * Unlock entity to allow enrichment
 */

import { NextRequest, NextResponse } from 'next/server'
import { enrichEntity, lockEntity, unlockEntity } from '@/lib/entity-enrichment'
import { supabase } from '@/lib/db'

// POST /api/entities/[id]/enrich - Enrich entity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params
    const body = await request.json().catch(() => ({}))

    const { force = false, niche_keywords = [] } = body

    // Check for lock/unlock actions in path
    const pathname = request.nextUrl.pathname
    if (pathname.endsWith('/lock')) {
      await lockEntity(entityId, body.locked_by || 'producer')
      return NextResponse.json({
        success: true,
        message: 'Entity locked',
        entity_id: entityId
      })
    }

    if (pathname.endsWith('/unlock')) {
      await unlockEntity(entityId)
      return NextResponse.json({
        success: true,
        message: 'Entity unlocked',
        entity_id: entityId
      })
    }

    // Get entity topic for context
    const { data: entity } = await supabase
      .from('entities')
      .select('topic_id')
      .eq('id', entityId)
      .single()

    // Run enrichment
    const result = await enrichEntity({
      entity_id: entityId,
      topic_id: entity?.topic_id,
      force,
      niche_keywords
    })

    return NextResponse.json({
      success: result.was_enriched,
      entity_id: result.entity_id,
      entity_name: result.entity_name,
      entity_type: result.entity_type,
      was_enriched: result.was_enriched,
      reason: result.reason,
      summary: result.enrichment_summary,
      sources_count: result.sources_used.length,
      context: result.new_context
    })
  } catch (error) {
    console.error('Entity enrichment error:', error)
    return NextResponse.json(
      { error: 'Failed to enrich entity', details: String(error) },
      { status: 500 }
    )
  }
}

// GET /api/entities/[id]/enrich - Get enrichment status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params

    const { data: entity, error } = await supabase
      .from('entities')
      .select('id, canonical_name, entity_type, metadata')
      .eq('id', entityId)
      .single()

    if (error || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const context = entity.metadata || {}

    return NextResponse.json({
      entity_id: entity.id,
      entity_name: entity.canonical_name,
      entity_type: entity.entity_type,
      enrichment_status: context.enrichment_status || 'pending',
      enrichment_last_run: context.enrichment_last_run,
      enrichment_sources: context.enrichment_sources || [],
      is_locked: context.enrichment_status === 'locked',
      locked_by: context.enrichment_locked_by,
      locked_at: context.enrichment_locked_at
    })
  } catch (error) {
    console.error('Get enrichment status error:', error)
    return NextResponse.json(
      { error: 'Failed to get enrichment status' },
      { status: 500 }
    )
  }
}
