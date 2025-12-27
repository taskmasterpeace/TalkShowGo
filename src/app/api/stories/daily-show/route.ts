/**
 * Daily Show API
 *
 * POST /api/stories/daily-show
 * Generate a daily news show with multiple stories
 *
 * Body:
 * - topic_id: string (required)
 * - show_name: string (default 'Battle Rap Daily')
 * - host_name: string (default 'Algorithm Institute')
 * - host_slug: string (optional - for host personality injection)
 * - voice_id: string (optional)
 * - stories_count: number (default 3)
 * - hours_back: number (default 24)
 * - generate_audio: boolean (default false - can be expensive)
 * - template_id: string (optional - for template-based generation)
 * - selected_topics: array (optional - pre-selected topics from wizard)
 * - custom_script: string (optional - user-edited script)
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateDailyShow } from '@/lib/story-pipeline'
import { generateSpeech, isElevenLabsConfigured } from '@/lib/elevenlabs'
import { getHostBySlug, generateHostOpening, generateHostClosing } from '@/lib/hosts'
import * as fs from 'fs/promises'
import * as path from 'path'

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      topic_id,
      show_name = 'Battle Rap Daily',
      host_name = 'Algorithm Institute',
      host_slug,
      voice_id = DEFAULT_VOICE_ID,
      stories_count = 3,
      hours_back = 24,
      generate_audio = false,
      template_id,
      selected_topics,
      custom_script,
      production_format,
      channel_style_file
    } = body

    // Get host personality if slug provided
    const host = host_slug ? getHostBySlug(host_slug) : null
    const effectiveHostName = host?.name || host_name

    if (!topic_id) {
      return NextResponse.json(
        { error: 'topic_id is required' },
        { status: 400 }
      )
    }

    console.log(`[API] Generating daily show: ${show_name}`)
    console.log(`[API] Host: ${effectiveHostName}${host ? ` (${host.archetype})` : ''}`)
    console.log(`[API] Custom script: ${custom_script ? 'Yes' : 'No'}`)

    // If custom script provided (from wizard), use it directly
    let show
    if (custom_script) {
      show = {
        show_name,
        show_date: new Date().toISOString().split('T')[0],
        intro_script: '',
        stories: selected_topics?.map((t: { headline: string; summary: string }) => ({
          headline: t.headline,
          script: t.summary,
          duration_seconds: 60
        })) || [],
        outro_script: '',
        total_duration_seconds: Math.ceil(custom_script.split(/\s+/).length / 2.5)
      }
    } else {
      show = await generateDailyShow({
        topic_id,
        show_name,
        host_name: effectiveHostName,
        voice_id,
        stories_count,
        hours_back,
        production_format,
        channel_style_file
      })
    }

    // Use custom script for audio if provided
    const scriptForAudio = custom_script || [
      show.intro_script,
      ...show.stories.map((s: { script: string }) => s.script),
      show.outro_script
    ].join('\n\n')

    // Optionally generate audio for the full show
    let audioUrl: string | undefined

    if (generate_audio && isElevenLabsConfigured()) {
      console.log('[API] Generating audio for daily show')
      console.log(`[API] Script length: ${scriptForAudio.split(/\s+/).length} words`)

      try {
        const audioBuffer = await generateSpeech(scriptForAudio, {
          voice_id,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.8,
            style: 0.15,
            use_speaker_boost: true
          }
        })

        // Save audio
        const outputDir = path.join(process.cwd(), 'public', 'audio')
        await fs.mkdir(outputDir, { recursive: true })
        const filename = `daily_show_${show.show_date}.mp3`
        const audioPath = path.join(outputDir, filename)
        await fs.writeFile(audioPath, Buffer.from(audioBuffer))

        audioUrl = `/audio/${filename}`
      } catch (error) {
        console.error('[API] Audio generation failed:', error)
      }
    }

    return NextResponse.json({
      success: true,
      show: {
        date: show.show_date,
        name: show.show_name,
        total_duration_seconds: show.total_duration_seconds,
        total_duration_minutes: Math.ceil(show.total_duration_seconds / 60),
        stories_count: show.stories.length
      },
      segments: {
        intro: {
          script: show.intro_script,
          word_count: show.intro_script.split(/\s+/).length
        },
        stories: show.stories.map((s: { headline: string; script: string; duration_seconds: number }) => ({
          headline: s.headline,
          script: s.script,
          duration_seconds: s.duration_seconds,
          word_count: s.script.split(/\s+/).length
        })),
        outro: {
          script: show.outro_script,
          word_count: show.outro_script.split(/\s+/).length
        }
      },
      full_script: custom_script || [
        '--- INTRO ---',
        show.intro_script,
        ...show.stories.map((s: { headline: string; script: string }, i: number) => `\n--- STORY ${i + 1}: ${s.headline} ---\n${s.script}`),
        '\n--- OUTRO ---',
        show.outro_script
      ].join('\n\n'),
      audio_url: audioUrl,
      host: host ? {
        id: host.id,
        name: host.name,
        archetype: host.archetype
      } : null,
      template_id
    })
  } catch (error) {
    console.error('[API] Daily show error:', error)
    return NextResponse.json(
      {
        error: 'Daily show generation failed',
        details: String(error)
      },
      { status: 500 }
    )
  }
}

// GET - Info about daily show
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/stories/daily-show',
    description: 'Generate a daily news show with multiple stories',
    example: {
      topic_id: '864dbcf4-e1f7-4b1a-86ed-c18007439ad5',
      show_name: 'Battle Rap Daily',
      host_name: 'Algorithm Institute',
      stories_count: 3,
      hours_back: 24,
      generate_audio: false
    }
  })
}
