import { NextRequest, NextResponse } from 'next/server'
import { generateDialogue, isDiaAvailable, checkHealth } from '@/lib/dia'

/**
 * GET /api/voices
 *
 * Check Dia TTS status and available voices
 */
export async function GET() {
  try {
    const available = await isDiaAvailable()

    if (!available) {
      return NextResponse.json({
        configured: false,
        message: 'Dia TTS service is not running. Start with: npm run dia:up',
        voices: [],
      })
    }

    const health = await checkHealth()

    return NextResponse.json({
      configured: true,
      service: 'Dia TTS',
      supports_multi_voice: health.supports_multi_voice,
      supported_emotions: health.supported_emotions,
      voices: [
        { voice_id: 'S1', name: 'Speaker 1', category: 'Dia' },
        { voice_id: 'S2', name: 'Speaker 2', category: 'Dia' },
      ],
    })
  } catch (error) {
    console.error('Error checking voice service:', error)
    return NextResponse.json(
      { error: String(error), configured: false, voices: [] },
      { status: 500 }
    )
  }
}

/**
 * POST /api/voices
 *
 * Generate speech from text using Dia TTS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, seed } = body

    if (!text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      )
    }

    if (!await isDiaAvailable()) {
      return NextResponse.json(
        { error: 'Dia TTS service is not available' },
        { status: 503 }
      )
    }

    const audioBuffer = await generateDialogue({
      segments: [{ speaker: 1, text }],
      seed: seed ?? 42,
    })

    // Return as audio/mpeg (convert Buffer to Uint8Array for NextResponse compatibility)
    return new NextResponse(new Uint8Array(audioBuffer), {
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
