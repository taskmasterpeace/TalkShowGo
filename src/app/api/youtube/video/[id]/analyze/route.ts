/**
 * YouTube Video Analysis API
 *
 * POST /api/youtube/video/[id]/analyze
 *
 * Analyzes a video transcript using LLM to extract:
 * - Main topics discussed
 * - Entities mentioned (battlers, leagues, bloggers)
 * - Key claims or statements
 * - Follow-up questions for research
 * - Relevant keywords for searching
 *
 * Body params:
 * - transcript: string (optional) - If not provided, will fetch it
 * - topic_id: string (optional) - Link analysis to a topic
 * - store_facts: boolean (default false) - Auto-store extracted facts to entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/presidium-ai'
import { supabase } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

const ANALYSIS_PROMPT = `Analyze this battle rap video transcript and extract structured information.

Return a JSON object with:
{
  "main_topics": ["topic1", "topic2"],  // Main subjects discussed
  "entities": [
    {
      "name": "Entity Name",
      "type": "battler|blogger|league|event|other",
      "context": "Brief context about how they're mentioned",
      "sentiment": "positive|negative|neutral"
    }
  ],
  "claims": [
    {
      "claim": "The specific claim or statement",
      "speaker": "Who said it (if known)",
      "confidence": 0.8,  // How confident this is factual
      "type": "opinion|fact|prediction|rumor"
    }
  ],
  "relationships_mentioned": [
    {
      "entity_a": "Name1",
      "entity_b": "Name2",
      "relationship": "battled|beef|friends|affiliated",
      "context": "Brief context"
    }
  ],
  "follow_up_questions": ["Question that needs more research"],
  "keywords": ["keyword1", "keyword2"],  // For searching related content
  "summary": "2-3 sentence summary of the video content"
}

Important:
- Focus on battle rap specific content
- Extract real names of battlers, leagues (URL, KOTD, RBE, TBL), events
- Note any drama, beef, or controversy mentioned
- Identify any breaking news or announcements

Transcript:
`

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: videoId } = await params

  try {
    const body = await request.json()
    let { transcript, topic_id, store_facts = false } = body

    // If no transcript provided, fetch it
    if (!transcript) {
      const { getSubtitles } = await import('youtube-caption-extractor')
      const transcriptData = await getSubtitles({ videoID: videoId, lang: 'en' })
      transcript = transcriptData.map((item: any) => item.text).join(' ')
    }

    if (!transcript || transcript.length < 50) {
      return NextResponse.json({
        error: 'Transcript too short or unavailable',
        video_id: videoId
      }, { status: 400 })
    }

    // Truncate very long transcripts
    const maxLength = 15000
    const truncatedTranscript = transcript.length > maxLength
      ? transcript.substring(0, maxLength) + '... [truncated]'
      : transcript

    // Call LLM for analysis
    const response = await chat(
      [
        {
          role: 'system',
          content: 'You are a battle rap expert analyst. Return only valid JSON, no markdown.'
        },
        {
          role: 'user',
          content: ANALYSIS_PROMPT + truncatedTranscript
        }
      ],
      {
        temperature: 0.3,
        max_tokens: 2000
      }
    )

    // Parse LLM response
    let analysis
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', response)
      return NextResponse.json({
        error: 'Failed to parse analysis',
        video_id: videoId,
        raw_response: response
      }, { status: 500 })
    }

    // Store analysis in database
    await supabase
      .from('youtube_videos')
      .update({
        analysis_results: analysis,
        analyzed_at: new Date().toISOString()
      })
      .eq('video_id', videoId)

    // If store_facts is true and we have a topic_id, store extracted facts
    let facts_stored = 0
    if (store_facts && topic_id && analysis.entities) {
      for (const entity of analysis.entities) {
        // Find or create entity
        const { data: existingEntity } = await supabase
          .from('entities')
          .select('id')
          .eq('topic_id', topic_id)
          .ilike('canonical_name', entity.name)
          .single()

        if (existingEntity && entity.context) {
          // Add fact about this entity
          await supabase.from('entity_facts').insert({
            entity_id: existingEntity.id,
            topic_id,
            fact_type: 'mention',
            fact_text: entity.context,
            source_type: 'youtube_video',
            source_id: videoId,
            confidence: 0.7,
            metadata: { sentiment: entity.sentiment }
          })
          facts_stored++
        }
      }
    }

    return NextResponse.json({
      video_id: videoId,
      analysis,
      transcript_length: transcript.length,
      truncated: transcript.length > maxLength,
      facts_stored,
      analyzed_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error analyzing video:', error)
    return NextResponse.json({
      error: 'Failed to analyze video',
      video_id: videoId,
      details: String(error)
    }, { status: 500 })
  }
}
