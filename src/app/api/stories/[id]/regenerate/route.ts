/**
 * Story Regenerate API
 *
 * POST /api/stories/[id]/regenerate
 * Re-runs the story pipeline for an existing story
 *
 * Use cases:
 * - Retry a failed story generation
 * - Regenerate with updated sources
 * - Rebuild after editing entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { runStoryPipeline } from '@/lib/story-pipeline'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    // Get the existing story to find the original query
    const { data: story, error: storyError } = await supabase
      .from('story_candidates')
      .select('*')
      .eq('id', id)
      .single()

    if (storyError) {
      if (storyError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 })
      }
      throw storyError
    }

    // Extract the original query from headline or evidence package
    const originalQuery = story.headline ||
      story.evidence_package?.query ||
      story.summary?.substring(0, 100)

    if (!originalQuery) {
      return NextResponse.json(
        { error: 'Cannot determine original query for regeneration' },
        { status: 400 }
      )
    }

    // Update story status to "regenerating"
    await supabase
      .from('story_candidates')
      .update({
        status: 'regenerating',
        metadata: {
          ...story.metadata,
          regenerate_started: new Date().toISOString(),
          regenerate_reason: body.reason || 'manual_retry'
        }
      })
      .eq('id', id)

    console.log(`[Regenerate] Starting regeneration for story ${id}: "${originalQuery}"`)

    // Get options from request body or use defaults
    const options = {
      query: body.query || originalQuery,  // Allow override
      topic_id: story.topic_id,
      style: body.style || 'documentary',
      tone: body.tone || 'engaging',
      length: body.length || 'medium',
      generate_audio: body.generate_audio !== false,
      use_enhanced_workflow: true,
      enable_interview_lookup: body.enable_interview_lookup !== false,
      enable_twitter_sentiment: body.enable_twitter_sentiment === true,
      enable_document_search: body.enable_document_search,
      force_transcribe: body.force_transcribe === true,
    }

    // Run the story pipeline
    const result = await runStoryPipeline({
      query: options.query,
      topic_id: options.topic_id,
      research_options: {
        max_videos: 15,
        include_web_search: true,
        use_enhanced_workflow: true,
        enable_interview_lookup: options.enable_interview_lookup,
        enable_twitter_sentiment: options.enable_twitter_sentiment,
        enable_document_search: options.enable_document_search,
        force_transcribe: options.force_transcribe,
      },
      story_options: {
        style: options.style as any,
        tone: options.tone as any,
        length: options.length as any,
        include_intro: true,
        include_outro: true,
        host_name: 'Algorithm Institute',
        topic_id: options.topic_id,
      },
    })

    // Update the story with new content
    const { error: updateError } = await supabase
      .from('story_candidates')
      .update({
        status: 'candidate',
        headline: result.story.title,
        summary: result.story.script.substring(0, 500),
        evidence_package: {
          ...story.evidence_package,
          query: options.query,
          regenerated: true,
          regenerated_at: new Date().toISOString(),
          pipeline_id: result.pipeline_id,
          sources_count: result.research.sources.length,
          interviews_count: result.research.interviews?.length || 0,
        },
        metadata: {
          ...story.metadata,
          regenerated: true,
          regenerated_at: new Date().toISOString(),
          previous_status: story.status,
          regenerate_completed: new Date().toISOString(),
        }
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Also save the new draft
    await supabase
      .from('story_drafts')
      .insert({
        story_candidate_id: id,
        content: result.story.script,
        word_count: result.story.word_count,
        revision_number: (story.metadata?.revision_count || 0) + 1,
        created_by: 'regenerate_api',
        metadata: {
          pipeline_id: result.pipeline_id,
          audio_path: result.audio_path,
          sources_used: result.research.sources.length,
        }
      })

    console.log(`[Regenerate] Completed regeneration for story ${id}`)

    return NextResponse.json({
      success: true,
      story_id: id,
      pipeline_id: result.pipeline_id,
      title: result.story.title,
      word_count: result.story.word_count,
      sources_used: result.research.sources.length,
      interviews_found: result.research.interviews?.length || 0,
      audio_generated: !!result.audio_path,
      audio_path: result.audio_path,
    })

  } catch (error) {
    console.error('[Regenerate] Error:', error)

    // Try to update status to failed
    try {
      const { id } = await params
      await supabase
        .from('story_candidates')
        .update({
          status: 'failed',
          metadata: {
            regenerate_error: String(error),
            regenerate_failed_at: new Date().toISOString(),
          }
        })
        .eq('id', id)
    } catch (e) {
      // Ignore update error
    }

    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Story regeneration failed. Check logs for details.'
      },
      { status: 500 }
    )
  }
}
