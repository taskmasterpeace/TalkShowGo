import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/jobs - List recent job runs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')

    let query = supabase
      .from('job_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}
