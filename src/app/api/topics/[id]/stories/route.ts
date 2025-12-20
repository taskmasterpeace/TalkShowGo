import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/topics/[id]/stories
 *
 * Fetch story candidates for a topic
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = supabase
      .from('story_candidates')
      .select('*')
      .eq('topic_id', params.id)
      .order('confidence_score', { ascending: false })
      .limit(limit)

    if (bucket) {
      query = query.eq('bucket', bucket)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching stories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stories' },
      { status: 500 }
    )
  }
}
