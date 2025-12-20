/**
 * Research Runs API
 *
 * GET /api/research/runs?topic_id=...
 * List research runs with transparency stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('research_runs')
      .select(`
        id,
        topic_id,
        query,
        status,
        videos_found,
        videos_filtered,
        transcripts_youtube,
        transcripts_assemblyai,
        transcripts_failed,
        entities_extracted,
        cost_assemblyai_cents,
        cost_llm_tokens,
        started_at,
        completed_at,
        duration_ms,
        output_markdown_path,
        output_json_path,
        created_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (topicId) {
      query = query.eq('topic_id', topicId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch research runs', details: error.message },
        { status: 500 }
      )
    }

    // Calculate aggregate stats
    const stats = data?.reduce(
      (acc, run) => ({
        total_runs: acc.total_runs + 1,
        total_videos_found: acc.total_videos_found + (run.videos_found || 0),
        total_transcripts_youtube: acc.total_transcripts_youtube + (run.transcripts_youtube || 0),
        total_transcripts_assemblyai: acc.total_transcripts_assemblyai + (run.transcripts_assemblyai || 0),
        total_cost_cents: acc.total_cost_cents + (run.cost_assemblyai_cents || 0)
      }),
      {
        total_runs: 0,
        total_videos_found: 0,
        total_transcripts_youtube: 0,
        total_transcripts_assemblyai: 0,
        total_cost_cents: 0
      }
    )

    return NextResponse.json({
      success: true,
      runs: data,
      stats,
      pagination: {
        total: count,
        limit,
        offset,
        has_more: count ? offset + limit < count : false
      }
    })
  } catch (error) {
    console.error('[API] Research runs error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
