import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * GET /api/schedules/daily-show/[id]/history
 * Get execution history for a schedule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = getSupabase()
    const { data: history, error } = await supabase
      .from('daily_show_run_history')
      .select('*')
      .eq('schedule_id', params.id)
      .order('executed_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ history })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
