import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/nominations - List nominations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const status = searchParams.get('status') || 'pending'

    let query = supabase
      .from('nominations')
      .select('*')
      .order('preliminary_score', { ascending: false })
      .order('created_at', { ascending: false })

    if (topicId) query = query.eq('topic_id', topicId)
    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching nominations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nominations' },
      { status: 500 }
    )
  }
}
