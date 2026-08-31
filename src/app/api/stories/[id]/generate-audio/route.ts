import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { generateDialogue, isDiaAvailable } from '@/lib/dia'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get story
    const { data: story, error: fetchError } = await supabase
      .from('story_candidates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !story) {
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      )
    }

    if (story.script_review_status !== 'approved') {
      return NextResponse.json(
        { error: 'Story not approved for audio generation' },
        { status: 400 }
      )
    }

    // Check Dia availability
    if (!await isDiaAvailable()) {
      return NextResponse.json(
        { error: 'Dia TTS service is not available' },
        { status: 503 }
      )
    }

    // Generate audio with Dia
    const audioBuffer = await generateDialogue({
      segments: [{ speaker: 1, text: story.script }],
      seed: 42
    })

    // Save to storage
    const audioPath = `stories/${story.id}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(audioPath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload audio' },
        { status: 500 }
      )
    }

    // Update story
    const { error: updateError } = await supabase
      .from('story_candidates')
      .update({ audio_url: audioPath })
      .eq('id', params.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update story' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, audio_url: audioPath })
  } catch (error) {
    console.error('Audio generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
