import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDailyShowScheduler } from '@/lib/scheduler/daily-show-scheduler'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * POST /api/schedules/daily-show/[id]/run-now
 * Manually trigger a scheduled show generation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduler = getDailyShowScheduler()
    const { data: schedule, error } = await supabase
      .from('daily_show_schedules')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Execute immediately (access private method via bracket notation)
    // @ts-ignore - accessing private method for manual execution
    await scheduler['executeSchedule'](schedule)

    return NextResponse.json({ success: true, message: 'Show generation started' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
