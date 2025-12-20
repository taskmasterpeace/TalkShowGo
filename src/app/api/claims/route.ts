import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/claims - List claims
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabase
      .from('claims')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (topicId) query = query.eq('topic_id', topicId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      // Table might not exist yet - return empty array
      console.log('Claims table may not exist yet:', error.message)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching claims:', error)
    return NextResponse.json([])
  }
}
