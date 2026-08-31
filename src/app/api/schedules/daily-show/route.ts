import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDailyShowScheduler } from '@/lib/scheduler/daily-show-scheduler'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * GET /api/schedules/daily-show
 * List all daily show schedules
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const activeOnly = searchParams.get('active') === 'true'

    const supabase = getSupabase()
    let query = supabase
      .from('daily_show_schedules')
      .select('*')
      .order('created_at', { ascending: false })

    if (topicId) {
      query = query.eq('topic_id', topicId)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: schedules, error } = await query

    if (error) throw error

    return NextResponse.json({ schedules })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/schedules/daily-show
 * Create a new schedule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.topic_id || !body.schedule_type) {
      return NextResponse.json(
        { error: 'topic_id and schedule_type are required' },
        { status: 400 }
      )
    }

    // Insert schedule
    const supabase = getSupabase()
    const { data: schedule, error } = await supabase
      .from('daily_show_schedules')
      .insert(body)
      .select()
      .single()

    if (error) throw error

    // Reload scheduler
    const scheduler = getDailyShowScheduler()
    await scheduler.reloadSchedule(schedule.id)

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
