/**
 * Entity YouTube Enrichment API
 *
 * POST /api/entities/[id]/enrich/youtube
 * Trigger YouTube interview enrichment for an entity
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { enrichEntityViaYouTube } from '@/lib/entity-youtube-enrichment'

/**
 * POST - Trigger enrichment for an entity
 *
 * Body:
 * - search_suffix?: string (default: "interview")
 * - prefer_longest?: boolean (default: true)
 * - max_duration_minutes?: number (default: 60)
 * - min_duration_minutes?: number (default: 5)
 * - topic_context?: string (default: "battle rap")
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params
    const body = await request.json()

    // Get entity info
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id, name, topic_id, metadata')
      .eq('id', entityId)
      .single()

    if (entityError || !entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      )
    }

    // Check if entity is locked for enrichment
    const metadata = entity.metadata as any
    if (metadata?.enrichment_status === 'locked') {
      return NextResponse.json(
        {
          error: 'Entity enrichment is locked',
          locked_by: metadata.enrichment_locked_by,
          locked_at: metadata.enrichment_locked_at
        },
        { status: 403 }
      )
    }

    console.log(`[API] Starting YouTube enrichment for: ${entity.name}`)

    // Run enrichment
    const result = await enrichEntityViaYouTube({
      entity_id: entityId,
      entity_name: entity.name,
      topic_id: entity.topic_id,
      search_suffix: body.search_suffix || 'interview',
      prefer_longest: body.prefer_longest ?? true,
      max_duration_minutes: body.max_duration_minutes || 60,
      min_duration_minutes: body.min_duration_minutes || 5,
      topic_context: body.topic_context || 'battle rap'
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        entity_id: entityId,
        entity_name: entity.name,
        run_id: result.run_id,
        video_used: result.video_used,
        extracted_context: result.extracted_context,
        transcript_preview: result.transcript_preview,
        cost_cents: result.cost_cents
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          entity_id: entityId,
          entity_name: entity.name,
          run_id: result.run_id,
          error: result.error
        },
        { status: result.error === 'No videos found' ? 404 : 500 }
      )
    }
  } catch (error) {
    console.error('[API] Entity enrichment error:', error)
    return NextResponse.json(
      { error: 'Enrichment failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET - Get enrichment history for an entity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params

    // Get entity info
    const { data: entity } = await supabase
      .from('entities')
      .select('id, name, metadata')
      .eq('id', entityId)
      .single()

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      )
    }

    // Get enrichment runs
    const { data: runs } = await supabase
      .from('entity_enrichment_runs')
      .select(`
        id,
        search_query,
        status,
        videos_found,
        best_video_title,
        best_video_url,
        transcript_source,
        extracted_context,
        cost_cents,
        started_at,
        completed_at,
        error
      `)
      .eq('entity_id', entityId)
      .order('started_at', { ascending: false })
      .limit(10)

    const metadata = entity.metadata as any

    return NextResponse.json({
      success: true,
      entity_id: entityId,
      entity_name: entity.name,
      enrichment_status: metadata?.enrichment_status || 'pending',
      last_enriched: metadata?.enrichment_last_run,
      enrichment_history: runs || [],
      current_context: {
        role: metadata?.role,
        affiliations: metadata?.affiliations,
        is_commentator: metadata?.is_commentator,
        is_primary_source: metadata?.is_primary_source
      }
    })
  } catch (error) {
    console.error('[API] Entity enrichment history error:', error)
    return NextResponse.json(
      { error: 'Failed to get enrichment history', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Lock/unlock entity enrichment
 *
 * Query params:
 * - action: 'lock' | 'unlock'
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (!action || !['lock', 'unlock'].includes(action)) {
      return NextResponse.json(
        { error: 'action query param must be "lock" or "unlock"' },
        { status: 400 }
      )
    }

    // Get current entity
    const { data: entity } = await supabase
      .from('entities')
      .select('metadata')
      .eq('id', entityId)
      .single()

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      )
    }

    const currentMetadata = (entity.metadata || {}) as any

    if (action === 'lock') {
      await supabase
        .from('entities')
        .update({
          metadata: {
            ...currentMetadata,
            enrichment_status: 'locked',
            enrichment_locked_by: 'producer',
            enrichment_locked_at: new Date().toISOString()
          }
        })
        .eq('id', entityId)

      return NextResponse.json({
        success: true,
        message: 'Entity enrichment locked'
      })
    } else {
      await supabase
        .from('entities')
        .update({
          metadata: {
            ...currentMetadata,
            enrichment_status: 'pending',
            enrichment_locked_by: null,
            enrichment_locked_at: null
          }
        })
        .eq('id', entityId)

      return NextResponse.json({
        success: true,
        message: 'Entity enrichment unlocked'
      })
    }
  } catch (error) {
    console.error('[API] Entity lock/unlock error:', error)
    return NextResponse.json(
      { error: 'Failed to update lock status', details: String(error) },
      { status: 500 }
    )
  }
}
