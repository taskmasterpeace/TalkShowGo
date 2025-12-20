import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { GreenlightStoryRequest } from '@/lib/types'

// POST /api/stories/[id]/greenlight - Approve story for production
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: GreenlightStoryRequest = await request.json()

    // Update story candidate status
    const { error: updateError } = await supabase
      .from('story_candidates')
      .update({ status: 'greenlit' })
      .eq('id', params.id)

    if (updateError) throw updateError

    // Get story candidate data
    const { data: storyCandidate, error: fetchError } = await supabase
      .from('story_candidates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError) throw fetchError

    // Create greenlit story
    const { data: story, error: createError } = await supabase
      .from('stories')
      .insert({
        story_candidate_id: params.id,
        final_headline: storyCandidate.headline,
        final_content: body.draft_content,
        greenlit_by: 'user', // Would be actual user ID
        integrity_checklist: body.integrity_checklist,
        production_status: 'pending',
      })
      .select()
      .single()

    if (createError) throw createError

    // Create export package
    const exportPackage = {
      story_id: story.id,
      headline: story.final_headline,
      content: story.final_content,
      entities: [],
      locations: [],
      scenes: [],
      narration: {
        full_script: story.final_content,
        voice_profile: 'news_anchor',
        pacing: 'moderate',
      },
      metadata: {
        topic: storyCandidate.topic_id,
        bucket: storyCandidate.bucket,
        sources_count: 0,
        confidence: storyCandidate.confidence_score,
      },
    }

    const { data: exportData, error: exportError } = await supabase
      .from('export_packages')
      .insert({
        story_id: story.id,
        package_json: exportPackage,
        destination: 'directors_palette',
        status: 'pending',
      })
      .select()
      .single()

    if (exportError) throw exportError

    // Log the action
    await supabase.from('audit_log').insert({
      actor: 'user',
      action: 'greenlight_story',
      target_type: 'story',
      target_id: story.id,
      details: { angle: body.angle, tone: body.tone, length: body.length },
    })

    return NextResponse.json({
      story,
      export_package: exportData,
    })
  } catch (error) {
    console.error('Error greenlighting story:', error)
    return NextResponse.json(
      { error: 'Failed to greenlight story' },
      { status: 500 }
    )
  }
}
