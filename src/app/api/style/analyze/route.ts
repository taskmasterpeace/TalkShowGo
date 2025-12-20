/**
 * Style Analysis API
 *
 * POST /api/style/analyze
 * Analyze a YouTube channel's style patterns
 *
 * Body:
 * - channel_id: string (required) - YouTube channel ID or handle
 * - video_count: number (default 10)
 * - random_selection: boolean (default true)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeChannelStyle,
  loadStyleProfile,
  listStyleProfiles,
  generateStylePrompt
} from '@/lib/style-analyzer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      channel_id,
      video_count = 10,
      random_selection = true
    } = body

    if (!channel_id) {
      return NextResponse.json(
        { error: 'channel_id is required' },
        { status: 400 }
      )
    }

    console.log(`[API] Analyzing style for channel: ${channel_id}`)

    const analysis = await analyzeChannelStyle(channel_id, {
      video_count,
      random_selection,
      save_to_file: true
    })

    // Generate style prompt that can be used for content generation
    const stylePrompt = generateStylePrompt(analysis)

    return NextResponse.json({
      success: true,
      analysis: {
        channel_id: analysis.channel_id,
        channel_name: analysis.channel_name,
        analyzed_at: analysis.analyzed_at,
        videos_analyzed: analysis.videos_analyzed,
        opening_patterns: analysis.opening_patterns,
        closing_patterns: analysis.closing_patterns,
        transition_phrases: analysis.transition_phrases,
        tone_descriptors: analysis.tone_descriptors,
        narrative_structure: analysis.narrative_structure,
        vocabulary_complexity: analysis.vocabulary_complexity,
        average_word_count: analysis.average_word_count,
        average_sentence_length: analysis.average_sentence_length,
        example_count: analysis.example_segments.length,
        videos_used: analysis.videos_used.length
      },
      style_prompt: stylePrompt,
      file_saved: true
    })
  } catch (error) {
    console.error('[API] Style analysis error:', error)
    return NextResponse.json(
      {
        error: 'Style analysis failed',
        details: String(error)
      },
      { status: 500 }
    )
  }
}

// GET - List available style profiles or get a specific one
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel')

    if (channel) {
      // Get specific style profile
      const profile = await loadStyleProfile(channel)
      if (!profile) {
        return NextResponse.json(
          { error: `Style profile not found for: ${channel}` },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        profile,
        style_prompt: generateStylePrompt(profile)
      })
    }

    // List all profiles
    const profiles = await listStyleProfiles()

    return NextResponse.json({
      success: true,
      profiles,
      count: profiles.length,
      endpoint_info: {
        description: 'Analyze YouTube channel style patterns',
        post_body: {
          channel_id: 'string (required) - YouTube channel ID or handle',
          video_count: 'number (default 10) - Videos to analyze',
          random_selection: 'boolean (default true) - Random vs most recent'
        },
        get_params: {
          channel: 'string (optional) - Get specific profile by slug'
        }
      }
    })
  } catch (error) {
    console.error('[API] Style GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get style profiles', details: String(error) },
      { status: 500 }
    )
  }
}
