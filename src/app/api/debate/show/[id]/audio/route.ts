/**
 * API: /api/debate/show/[id]/audio
 *
 * POST - Generate audio for show
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateMultiHostAudio } from '@/lib/debate/audio'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[API] Generating audio for show ${params.id}`)
    const supabase = getSupabase()

    // Load show run
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

    // Load hosts
    const { data: hosts } = await supabase
      .from('debate_hosts')
      .select('*')
      .in('id', showRun.host_ids)

    if (!hosts || hosts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Hosts not found'
      }, { status: 404 })
    }

    // Generate audio
    const result = await generateMultiHostAudio(
      params.id,
      showRun.conversation_turns,
      hosts
    )

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('[API] Error generating audio:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
