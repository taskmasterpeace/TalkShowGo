/**
 * Individual Research Run API
 *
 * GET /api/research/runs/[id]
 * Get detailed information about a specific research run
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabase
      .from('research_runs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Research run not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch research run', details: error.message },
        { status: 500 }
      )
    }

    // Get related entity enrichment runs if any
    const { data: enrichmentRuns } = await supabase
      .from('entity_enrichment_runs')
      .select(`
        id,
        entity_id,
        search_query,
        status,
        best_video_title,
        best_video_url,
        cost_cents,
        started_at,
        completed_at
      `)
      .eq('topic_id', data.topic_id)
      .gte('started_at', data.started_at)
      .order('started_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      run: data,
      related_enrichments: enrichmentRuns || [],
      // Add human-readable summary
      summary: {
        query: data.query,
        status: data.status,
        videos: `${data.videos_filtered || 0} selected from ${data.videos_found || 0} found`,
        transcripts: {
          youtube: data.transcripts_youtube || 0,
          assemblyai: data.transcripts_assemblyai || 0,
          failed: data.transcripts_failed || 0
        },
        entities: (data.entities_extracted || []).length,
        cost: `$${((data.cost_assemblyai_cents || 0) / 100).toFixed(2)}`,
        duration: data.duration_ms ? `${(data.duration_ms / 1000).toFixed(1)}s` : 'N/A'
      }
    })
  } catch (error) {
    console.error('[API] Research run detail error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/research/runs/[id]
 * Delete a research run
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabase
      .from('research_runs')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete research run', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Research run deleted'
    })
  } catch (error) {
    console.error('[API] Research run delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
