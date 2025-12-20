import { NextRequest, NextResponse } from 'next/server'
import * as elevenlabs from '@/lib/elevenlabs'

/**
 * GET /api/voices
 *
 * List all available voices from ElevenLabs
 */
export async function GET() {
  try {
    // Check if ElevenLabs is configured
    if (!elevenlabs.isElevenLabsConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'ELEVENLABS_API_KEY not set',
        voices: [],
      })
    }

    const voices = await elevenlabs.listVoices()

    return NextResponse.json({
      configured: true,
      voices: voices.map((v) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        description: v.description,
        preview_url: v.preview_url,
        labels: v.labels,
      })),
    })
  } catch (error) {
    console.error('Error fetching voices:', error)
    return NextResponse.json(
      { error: String(error), configured: false, voices: [] },
      { status: 500 }
    )
  }
}

/**
 * POST /api/voices/generate
 *
 * Generate speech from text
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, voice_id, model_id, stability, similarity_boost, style } = body

    if (!text || !voice_id) {
      return NextResponse.json(
        { error: 'text and voice_id are required' },
        { status: 400 }
      )
    }

    if (!elevenlabs.isElevenLabsConfigured()) {
      return NextResponse.json(
        { error: 'ElevenLabs not configured' },
        { status: 500 }
      )
    }

    const audioBuffer = await elevenlabs.generateSpeech(text, {
      voice_id,
      model_id,
      voice_settings: {
        stability: stability ?? 0.5,
        similarity_boost: similarity_boost ?? 0.75,
        style: style ?? 0.0,
        use_speaker_boost: true,
      },
    })

    // Return as audio/mpeg
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
      },
    })
  } catch (error) {
    console.error('Error generating speech:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
