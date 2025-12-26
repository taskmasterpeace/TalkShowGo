import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDailyShowScheduler } from '@/lib/scheduler/daily-show-scheduler'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * GET /api/schedules/daily-show/[id]
 * Get a single schedule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: schedule, error } = await supabase
      .from('daily_show_schedules')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error

    return NextResponse.json({ schedule })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/schedules/daily-show/[id]
 * Update a schedule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const { data: schedule, error } = await supabase
      .from('daily_show_schedules')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    // Reload scheduler
    const scheduler = getDailyShowScheduler()
    await scheduler.reloadSchedule(schedule.id)

    return NextResponse.json({ schedule })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/schedules/daily-show/[id]
 * Delete a schedule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('daily_show_schedules')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    // Reload scheduler (will remove the job)
    const scheduler = getDailyShowScheduler()
    await scheduler.reloadSchedule(params.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
