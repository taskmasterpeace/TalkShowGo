/**
 * YouTube Video Transcript API
 *
 * GET /api/youtube/video/[id]/transcript
 *
 * Fetches the transcript/captions for a YouTube video.
 * Uses youtube-transcript library (free, no API key needed).
 *
 * Query params:
 * - language: string (default 'en') - Preferred language
 * - format: 'full' | 'segments' (default 'full') - Return full text or timestamped segments
 */

import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: videoId } = await params
  const searchParams = request.nextUrl.searchParams

  const language = searchParams.get('language') || 'en'
  const format = searchParams.get('format') || 'full'

  try {
    // Dynamic import to avoid issues if library not installed
    const { YoutubeTranscript } = await import('youtube-transcript')

    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: language
    })

    if (!transcript || transcript.length === 0) {
      return NextResponse.json({
        error: 'No transcript available',
        video_id: videoId,
        has_transcript: false
      }, { status: 404 })
    }

    // Format segments
    const segments = transcript.map((item: any) => ({
      text: item.text,
      start: item.offset / 1000,  // Convert ms to seconds
      duration: item.duration / 1000,
      start_formatted: formatTime(item.offset / 1000)
    }))

    // Build full text
    const fullText = segments.map((s: any) => s.text).join(' ')

    // Word count and duration
    const wordCount = fullText.split(/\s+/).length
    const totalDuration = segments.length > 0
      ? segments[segments.length - 1].start + segments[segments.length - 1].duration
      : 0

    return NextResponse.json({
      video_id: videoId,
      language,
      has_transcript: true,
      word_count: wordCount,
      duration_seconds: Math.round(totalDuration),
      duration_formatted: formatTime(totalDuration),
      segment_count: segments.length,
      ...(format === 'segments'
        ? { segments }
        : { full_text: fullText, segments }),
      fetched_at: new Date().toISOString()
    })
  } catch (error: any) {
    // Check if it's a "transcript disabled" error
    if (error.message?.includes('disabled') || error.message?.includes('Transcript')) {
      return NextResponse.json({
        error: 'Transcript disabled or unavailable',
        video_id: videoId,
        has_transcript: false,
        details: error.message
      }, { status: 404 })
    }

    console.error('Error fetching transcript:', error)
    return NextResponse.json({
      error: 'Failed to fetch transcript',
      video_id: videoId,
      details: String(error)
    }, { status: 500 })
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
