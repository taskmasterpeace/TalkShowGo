/**
 * Story Pipeline API
 *
 * POST /api/stories/pipeline
 * Run the full story pipeline: Research → Story → Audio
 *
 * Body:
 * - query: string (required for youtube_first) - Topic to research
 * - topic_id: string (required for twitter_first, optional for youtube_first) - Link to a topic
 * - research_mode: 'youtube_first' | 'twitter_first' (default: 'youtube_first') - Research strategy
 * - style: 'documentary' | 'news' | 'analysis' | 'narrative'
 * - tone: 'serious' | 'engaging' | 'dramatic' | 'neutral'
 * - length: 'short' | 'medium' | 'long' (default: 'medium') - Story length tier
 * - generate_audio: boolean (default true)
 * - voice_id: string (optional) - Voice configuration
 * - max_videos: number (default 10)
 * - include_web_search: boolean (default true)
 * - use_enhanced_workflow: boolean (default false) - Use query expansion + AssemblyAI transcription
 * - force_transcribe: boolean (default false) - Re-transcribe even if cached
 * - generate_docs: boolean (default true) - Generate MD + JSON documentation
 * - enable_interview_lookup: boolean (default true) - Auto-search interviews for public figures
 * - enable_twitter_sentiment: boolean (default false) - Search Twitter for reactions
 * - enable_document_search: boolean (auto) - Search for court docs/paperwork (auto-enabled for legal stories)
 * - document_types: string[] - Types of docs to search: ['paperwork', 'court records', 'arrest']
 * - document_location: string (optional) - Location for court record searches
 * - topic_context: string (default: 'battle rap') - Context for searches
 */

import { NextRequest, NextResponse } from 'next/server'
import { runStoryPipeline, generateDailyShow } from '@/lib/story-pipeline'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      query,
      topic_id,
      style = 'documentary',
      tone = 'engaging',
      length = 'medium',  // 'short' | 'medium' | 'long'
      generate_audio = true,
      voice_id,
      max_videos = 10,
      include_web_search = true,
      max_length,  // Legacy - overrides length if set
      host_name = 'Algorithm Institute',
      // Enhanced workflow options
      use_enhanced_workflow = false,
      force_transcribe = false,
      generate_docs = true,
      // New options
      enable_interview_lookup = true,
      enable_twitter_sentiment = false,
      topic_context = 'battle rap',
      // Document search (auto-enabled for legal stories)
      enable_document_search,  // Auto if not specified - based on query
      document_types = ['paperwork', 'court records', 'arrest'],
      document_location,
      // Research mode
      research_mode = 'youtube_first'  // 'youtube_first' | 'twitter_first'
    } = body

    // Validation
    if (research_mode === 'twitter_first' && !topic_id) {
      return NextResponse.json(
        { error: 'topic_id is required for twitter_first mode' },
        { status: 400 }
      )
    }

    if (!query && research_mode === 'youtube_first') {
      return NextResponse.json(
        { error: 'query is required for youtube_first mode' },
        { status: 400 }
      )
    }

    console.log(`[API] Starting story pipeline: ${research_mode} mode for "${query}" (length: ${length}, interviews: ${enable_interview_lookup}, twitter: ${enable_twitter_sentiment})`)

    const result = await runStoryPipeline({
      query,
      topic_id,
      research_options: {
        research_mode,
        max_videos,
        include_web_search,
        min_views: 1000,
        // Enhanced workflow options
        use_enhanced_workflow,
        force_transcribe,
        generate_docs,
        // New options
        enable_interview_lookup,
        enable_twitter_sentiment,
        topic_context,
        // Document search (auto if query contains legal keywords)
        enable_document_search,
        document_types,
        document_location
      },
      story_options: {
        style,
        tone,
        length,  // New: story length tier
        max_length,  // Legacy: explicit word count
        include_intro: true,
        include_outro: true,
        host_name
      },
    })

    // Count transcripts
    const transcriptCount = result.research.sources.filter(s => s.transcript).length
    const interviewCount = result.research.interviews?.length || 0

    return NextResponse.json({
      success: true,
      pipeline_id: result.pipeline_id,
      created_at: result.created_at,
      research_mode,
      enhanced_workflow: use_enhanced_workflow,
      settings: {
        length,
        interview_lookup: enable_interview_lookup,
        twitter_sentiment: enable_twitter_sentiment,
        document_search: enable_document_search
      },
      research: {
        query: result.research.query,
        sources_count: result.research.sources.length,
        transcripts_obtained: transcriptCount,
        interviews_found: interviewCount,
        key_facts: result.research.key_facts,
        perspectives: result.research.perspectives,
        conflicting_info: result.research.conflicting_info,
        sources: result.research.sources.map(s => ({
          type: s.type,
          title: s.title,
          url: s.url,
          channel: s.channel,
          views: s.views,
          has_transcript: !!s.transcript,
          transcript_source: s.transcript_source
        })),
        // Interview data
        interviews: result.research.interviews?.map(i => ({
          entity_name: i.entity_name,
          entity_type: i.entity_type,
          video_title: i.video_title,
          video_url: i.video_url,
          channel: i.channel,
          has_transcript: !!i.transcript,
          from_cache: i.from_cache
        })) || [],
        // Twitter data
        twitter: result.research.twitter ? {
          event_date: result.research.twitter.event_date,
          tweets_found: result.research.twitter.tweets_found,
          sentiment: result.research.twitter.sentiment,
          key_quotes: result.research.twitter.key_quotes
        } : null,
        // Document search data (court records, paperwork, etc.)
        documents: result.research.documents?.map(d => ({
          type: d.type,
          title: d.title,
          url: d.url,
          snippet: d.snippet,
          relevance_score: d.relevance_score
        })) || []
      },
      story: {
        title: result.story.title,
        script: result.story.script,
        word_count: result.story.word_count,
        estimated_duration_seconds: result.story.estimated_duration_seconds,
        estimated_duration_minutes: Math.ceil(result.story.estimated_duration_seconds / 60)
      },
      audio: result.audio_url ? {
        url: result.audio_url,
        path: result.audio_path
      } : null
    })
  } catch (error) {
    console.error('[API] Story pipeline error:', error)
    return NextResponse.json(
      {
        error: 'Story pipeline failed',
        details: String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET /api/stories/pipeline - Check status
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    capabilities: {
      research: true,
      story_generation: !!process.env.REQUESTY_API_KEY || !!process.env.OPENROUTER_API_KEY,
      audio_generation: true,  // Dia TTS (local, no API key needed)
      local_llm_fallback: true,
      twitter_first_mode: true
    },
    research_modes: ['youtube_first', 'twitter_first'],
    endpoints: {
      pipeline: 'POST /api/stories/pipeline',
      daily_show: 'POST /api/stories/daily-show'
    },
    example: {
      query: 'Debo vs Caps fight in the rain battle rap',
      style: 'documentary',
      tone: 'engaging',
      generate_audio: true,
      use_enhanced_workflow: true
    },
    example_enhanced: {
      description: 'Enhanced workflow with query expansion + AssemblyAI transcription',
      query: 'Debo Caps incident rain',
      use_enhanced_workflow: true,
      force_transcribe: false,
      generate_docs: true
    }
  })
}
