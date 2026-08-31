/**
 * API: /api/debate/show/generate
 *
 * POST - Generate complete debate show (preparation + conversation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { runPreparationPhase } from '@/lib/debate/preparation'
import { generateDebateConversation, saveConversation } from '@/lib/debate/orchestrator'
import { getHostById } from '@/lib/debate/host-generator'
import { createClient } from '@supabase/supabase-js'
import type { EmotionalBeat } from '@/lib/debate/types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface GenerateShowRequest {
  topic_id?: string
  topic: string
  host_ids: string[]
  show_format_id: string
  research_package_id?: string
  producer_instructions?: string
  emotional_beats?: EmotionalBeat[]
  target_duration_minutes?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateShowRequest = await request.json()
    const supabase = getSupabase()

    // Validate required fields
    if (!body.topic || !body.host_ids || body.host_ids.length === 0 || !body.show_format_id) {
      return NextResponse.json({
        success: false,
        error: 'topic, host_ids, and show_format_id are required'
      }, { status: 400 })
    }

    console.log(`[API] Generating show: ${body.topic}`)
    console.log(`[API] Hosts: ${body.host_ids.length}`)

    // 1. Create show run record
    const { data: showRun, error: createError } = await supabase
      .from('debate_show_runs')
      .insert({
        topic_id: body.topic_id,
        topic: body.topic,
        show_format_id: body.show_format_id,
        host_ids: body.host_ids,
        research_package_id: body.research_package_id,
        producer_instructions: body.producer_instructions,
        emotional_beats: body.emotional_beats || [],
        status: 'prep_running'
      })
      .select()
      .single()

    if (createError || !showRun) {
      console.error('[API] Error creating show run:', createError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create show run'
      }, { status: 500 })
    }

    console.log(`[API] Created show run: ${showRun.id}`)

    // 2. Load hosts
    const hosts = await Promise.all(
      body.host_ids.map(id => getHostById(id))
    )

    const validHosts = hosts.filter(h => h !== null) as any[]

    if (validHosts.length === 0) {
      await supabase
        .from('debate_show_runs')
        .update({ status: 'failed', error_message: 'No valid hosts found' })
        .eq('id', showRun.id)

      return NextResponse.json({
        success: false,
        error: 'No valid hosts found'
      }, { status: 400 })
    }

    // 3. Load show format
    const { data: format } = await supabase
      .from('show_formats')
      .select('*')
      .eq('id', body.show_format_id)
      .single()

    if (!format) {
      return NextResponse.json({
        success: false,
        error: 'Show format not found'
      }, { status: 404 })
    }

    // 4. Run preparation phase
    console.log(`[API] Running preparation phase...`)
    const preparationResults = await runPreparationPhase(
      validHosts,
      body.topic,
      body.research_package_id
    )

    // Update status
    await supabase
      .from('debate_show_runs')
      .update({
        status: 'debate_running',
        preparation_summary: {
          hosts: preparationResults.map(p => ({
            host_id: p.host_id,
            stance: p.stance,
            talking_points: p.talking_points
          }))
        }
      })
      .eq('id', showRun.id)

    // 5. Generate debate conversation
    console.log(`[API] Generating debate conversation...`)
    const conversation = await generateDebateConversation({
      format,
      hosts: validHosts,
      preparationResults,
      topic: body.topic,
      emotionalBeats: body.emotional_beats,
      targetDurationMinutes: body.target_duration_minutes
    })

    // 6. Save conversation
    await saveConversation(showRun.id, conversation)

    // 7. Calculate total costs
    const totalTokens = preparationResults.reduce((sum, p) => sum + p.tokens_used, 0) +
      conversation.reduce((sum, t) => sum + (t.tokens_used || 0), 0)

    // Rough cost estimate (varies by model)
    const costUsd = totalTokens * 0.00001 // ~$0.01 per 1000 tokens

    await supabase
      .from('debate_show_runs')
      .update({
        status: 'completed',
        total_tokens_used: totalTokens,
        cost_usd: costUsd,
        completed_at: new Date().toISOString()
      })
      .eq('id', showRun.id)

    console.log(`[API] Show generation complete!`)
    console.log(`[API] Total tokens: ${totalTokens}`)
    console.log(`[API] Estimated cost: $${costUsd.toFixed(4)}`)

    // Return complete show data
    return NextResponse.json({
      success: true,
      show_run_id: showRun.id,
      conversation,
      stats: {
        total_turns: conversation.length,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        hosts: validHosts.length
      }
    })
  } catch (error) {
    console.error('[API] Error generating show:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
