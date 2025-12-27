/**
 * API: /api/debate/show/[id]/status
 *
 * GET - Get show generation status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: showRun, error } = await supabase
      .from('debate_show_runs')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !showRun) {
      return NextResponse.json({
        success: false,
        error: 'Show run not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      show_run: showRun,
      status: showRun.status,
      progress: calculateProgress(showRun.status)
    })
  } catch (error) {
    console.error('[API] Error fetching show status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function calculateProgress(status: string): number {
  switch (status) {
    case 'prep_pending': return 0
    case 'prep_running': return 25
    case 'debate_pending': return 50
    case 'debate_running': return 75
    case 'completed': return 100
    case 'failed': return 0
    default: return 0
  }
}
