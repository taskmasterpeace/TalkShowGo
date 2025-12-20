import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/stories - List story candidates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const bucket = searchParams.get('bucket')
    const status = searchParams.get('status')

    let query = supabase
      .from('story_candidates')
      .select('*')
      .order('priority_rank', { ascending: false })
      .order('created_at', { ascending: false })

    if (topicId) query = query.eq('topic_id', topicId)
    if (bucket) query = query.eq('bucket', bucket)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching stories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stories' },
      { status: 500 }
    )
  }
}
