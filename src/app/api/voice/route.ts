/**
 * Voice API
 *
 * Proxy for Chatterbox voice server operations.
 * Handles voice listing, speech generation, and voice cloning.
 */

import { NextRequest, NextResponse } from 'next/server'

const CHATTERBOX_URL = process.env.CHATTERBOX_URL || 'http://localhost:4123'

// GET /api/voice - Get voice server status and available voices
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'status'

  try {
    switch (action) {
      case 'status': {
        // Check health
        const healthRes = await fetch(`${CHATTERBOX_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        }).catch(() => null)

        const isHealthy = healthRes?.ok || false

        // Get voices if healthy
        let voices: any[] = []
        if (isHealthy) {
          const voicesRes = await fetch(`${CHATTERBOX_URL}/v1/voices`)
          if (voicesRes.ok) {
            const data = await voicesRes.json()
            voices = data.voices || data || []
          }
        }

        return NextResponse.json({
          available: isHealthy,
          url: CHATTERBOX_URL,
          voices,
        })
      }

      case 'voices': {
        const response = await fetch(`${CHATTERBOX_URL}/v1/voices`)
        if (!response.ok) {
          return NextResponse.json({ voices: [] })
        }
        const data = await response.json()
        return NextResponse.json({ voices: data.voices || data || [] })
      }

      case 'languages': {
        const response = await fetch(`${CHATTERBOX_URL}/languages`)
        if (!response.ok) {
          return NextResponse.json({ languages: ['en'] })
        }
        const data = await response.json()
        return NextResponse.json({ languages: data.languages || data || ['en'] })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Voice API error:', error)
    return NextResponse.json(
      { error: 'Voice server not available', available: false },
      { status: 503 }
    )
  }
}

// POST /api/voice - Generate speech or clone voice
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // Handle voice cloning (multipart form)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()

      const response = await fetch(`${CHATTERBOX_URL}/v1/voices`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        return NextResponse.json(
          { error: `Voice cloning failed: ${error}` },
          { status: response.status }
        )
      }

      const voice = await response.json()
      return NextResponse.json(voice, { status: 201 })
    }

    // Handle speech generation (JSON)
    const body = await request.json()
    const { text, voice, speed, stream } = body

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // Streaming response
    if (stream) {
      const response = await fetch(`${CHATTERBOX_URL}/v1/audio/speech/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice || 'default',
          speed: speed || 1.0,
        }),
      })

      if (!response.ok || !response.body) {
        return NextResponse.json(
          { error: 'Speech generation failed' },
          { status: 500 }
        )
      }

      // Stream the audio back
      return new Response(response.body, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Transfer-Encoding': 'chunked',
        },
      })
    }

    // Non-streaming response
    const response = await fetch(`${CHATTERBOX_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice || 'default',
        speed: speed || 1.0,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `Speech generation failed: ${error}` },
        { status: response.status }
      )
    }

    // Return audio as blob
    const audioBlob = await response.blob()
    return new Response(audioBlob, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename="speech.mp3"',
      },
    })
  } catch (error) {
    console.error('Voice generation error:', error)
    return NextResponse.json(
      { error: 'Voice server not available' },
      { status: 503 }
    )
  }
}

// DELETE /api/voice - Delete a cloned voice
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const voiceId = searchParams.get('id')

    if (!voiceId) {
      return NextResponse.json(
        { error: 'Voice ID is required' },
        { status: 400 }
      )
    }

    const response = await fetch(`${CHATTERBOX_URL}/v1/voices/${voiceId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to delete voice' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Voice server not available' },
      { status: 503 }
    )
  }
}
