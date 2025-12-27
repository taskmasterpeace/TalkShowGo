import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { generateSpeech } from '@/lib/elevenlabs'

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

    // Generate audio
    const audioBuffer = await generateSpeech(story.script, {
      voice_id: story.voice_id || process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9'
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
