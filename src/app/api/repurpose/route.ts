/**
 * Content Repurposing API
 *
 * POST /api/repurpose
 * Take a YouTube video, research the topic deeper, and create an improved version
 *
 * Body:
 * - video_url: string (required) - YouTube video URL
 * - topic_id: string (optional) - Topic/niche for context
 * - style: 'documentary' | 'news' | 'analysis' | 'narrative' (default 'documentary')
 * - length: 'short' | 'medium' | 'long' (default 'medium')
 * - generate_audio: boolean (default false)
 * - host_name: string (default 'Algorithm Institute')
 * - seed: number (optional) - Dia voice seed for consistency
 *
 * GET /api/repurpose?video_url=xxx
 * Get info about a video before repurposing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTranscript } from '@/lib/transcript-fetcher'
import { runResearchWorkflow } from '@/lib/research-workflow'
import { generateDialogue, DialogueSegment, checkHealth as checkDiaHealth } from '@/lib/dia'
import { callOpenRouter } from '@/lib/openrouter'
import { searchWeb, searchNews } from '@/lib/web-search'
import { supabaseAdmin } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/  // Just the ID
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

// Generate repurposed script - sounds 100% original, NO source attribution
async function generateRepurposedScript(
  topic: string,
  originalTranscript: string,
  supplementalSources: Array<{ title: string; transcript?: string }>,
  config: {
    style: string
    length: string
    host_name: string
  }
): Promise<{ script: string; title: string; word_count: number }> {

  // Combine all research material (without attribution)
  const allContent = [
    originalTranscript,
    ...supplementalSources
      .filter(s => s.transcript)
      .map(s => s.transcript)
  ].join('\n\n---\n\n')

  // Word count targets - LONGER since we do more research than original
  const lengthTargets: Record<string, number> = {
    short: 800,
    medium: 1500,   // ~6 minutes
    long: 2500      // ~10 minutes
  }
  const targetWords = lengthTargets[config.length] || 1500

  const prompt = `You are ${config.host_name}, writing a ${config.style}-style script to be read aloud.

CRITICAL RULES:
1. Write ONLY the spoken words - NO formatting like "HOST:", "SCENE:", "(V.O.)", stage directions, or headers
2. This must sound like 100% ORIGINAL content that YOU researched
3. NEVER mention any sources, YouTubers, bloggers, channels, or where info came from
4. NEVER say "according to...", "as reported by...", "one creator said..."
5. Present all information as YOUR OWN analysis and research
6. Write in first person - you ARE the host speaking directly to the audience

TOPIC: ${topic}

RESEARCH MATERIAL (use this info but NEVER cite it):
${allContent.slice(0, 35000)}

Write a COMPREHENSIVE ${config.style} script (~${targetWords} words) that:
1. Opens with a dramatic hook that grabs attention immediately
2. Goes DEEP into each major point - don't just skim, provide real analysis and detail
3. Cover EVERY major event, battle, or topic mentioned in the research
4. Add context and background that makes this MORE informative than the original
5. Include specific details, names, dates, and outcomes where available
6. Flows naturally as spoken words - like you're telling a story to someone
7. Presents facts as YOUR OWN reporting and analysis
8. NO screenplay formatting - just paragraphs of what you'll actually say
9. Ends with YOUR perspective on what this means for the culture

IMPORTANT: Since we did extensive research, this script should be MORE comprehensive and detailed than a simple summary. Go deep. Add value. Make it worth watching.

OUTPUT FORMAT: Just the script text. No titles, no "HOST:", no scene markers, no stage directions. Pure spoken content only.

Write the full script now:`

  const response = await callOpenRouter({
    model: 'deepseek/deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `You are ${config.host_name}, a documentary narrator. Write compelling, original-sounding content. NEVER mention sources or where information came from.`
      },
      { role: 'user', content: prompt }
    ],
    max_tokens: 4000,
    temperature: 0.8
  })

  const script = response.content
  const wordCount = script.split(/\s+/).length

  // Extract or generate title
  const titleMatch = script.match(/^#\s*(.+)|^Title:\s*(.+)|^\*\*(.+?)\*\*/im)
  const title = titleMatch
    ? (titleMatch[1] || titleMatch[2] || titleMatch[3]).replace(/\*+/g, '').trim()
    : `${topic} - The Full Story`

  return {
    script,
    title,
    word_count: wordCount
  }
}

// Extract main topic AND specific sub-topics from transcript for deep research
async function extractTopicFromTranscript(
  title: string,
  transcript: string,
  nicheContext?: string
): Promise<{
  topic: string
  entities: string[]
  sub_topics: string[]  // Specific things to research individually
  events: string[]      // Events/battles mentioned
  people: string[]      // Specific people mentioned
  summary: string
}> {
  const prompt = `Analyze this video and extract EVERYTHING we should research deeper.

VIDEO TITLE: ${title}
${nicheContext ? `NICHE CONTEXT: ${nicheContext}` : ''}

TRANSCRIPT:
${transcript.slice(0, 8000)}

Extract ALL specific items mentioned that we can research individually:

Return JSON with:
- topic: Main topic as a search query
- entities: Array of ALL people, leagues, organizations mentioned (up to 15)
- sub_topics: Array of specific sub-topics or themes discussed (up to 10)
- events: Array of specific events, battles, or cards mentioned (e.g., "TBL Apollo Houston", "Chrome 23 Read the Room", "URL Summer Madness")
- people: Array of specific battlers/people mentioned with context (e.g., "Rum Nitty vs Daylyt", "Eazy the Block Captain vs Suge")
- summary: 2-3 sentence summary

BE THOROUGH - extract every specific event, battle, and person mentioned. We need to research each one.

Return ONLY valid JSON, no explanation.`

  const response = await callOpenRouter({
    model: 'deepseek/deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a JSON extraction AI. Extract every specific entity, event, and person mentioned. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1500,
    temperature: 0.3
  })

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const parsed = JSON.parse(jsonMatch[0])
    return {
      topic: parsed.topic || title,
      entities: parsed.entities || [],
      sub_topics: parsed.sub_topics || [],
      events: parsed.events || [],
      people: parsed.people || [],
      summary: parsed.summary || 'Unable to extract summary'
    }
  } catch {
    // Fallback
    return {
      topic: title,
      entities: [],
      sub_topics: [],
      events: [],
      people: [],
      summary: 'Unable to extract summary'
    }
  }
}

// Convert story script to Dia dialogue format
function scriptToDialogueSegments(script: string): DialogueSegment[] {
  const segments: DialogueSegment[] = []
  const paragraphs = script.split(/\n\n+/).filter(p => p.trim())

  let currentSpeaker: 1 | 2 = 1

  for (const paragraph of paragraphs) {
    const text = paragraph.trim()
    if (!text || text.length < 10) continue

    // Split long paragraphs into chunks for natural speech
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    let chunk = ''

    for (const sentence of sentences) {
      if ((chunk + sentence).length > 300) {
        if (chunk) {
          segments.push({ speaker: currentSpeaker, text: chunk.trim() })
          currentSpeaker = currentSpeaker === 1 ? 2 : 1
        }
        chunk = sentence
      } else {
        chunk += sentence
      }
    }

    if (chunk) {
      segments.push({ speaker: currentSpeaker, text: chunk.trim() })
      currentSpeaker = currentSpeaker === 1 ? 2 : 1
    }
  }

  return segments
}

// GET - Fetch video info before repurposing
export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get('video_url')

  if (!videoUrl) {
    return NextResponse.json({ error: 'video_url is required' }, { status: 400 })
  }

  const videoId = extractVideoId(videoUrl)
  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
  }

  try {
    // Fetch video info via YouTube API
    const { searchYouTube, getVideoDetails } = await import('@/lib/youtube-api')

    // Try to get video details
    let videoInfo
    try {
      videoInfo = await getVideoDetails(videoId)
    } catch {
      // Fallback: search for the video
      const search = await searchYouTube(videoId, { maxResults: 1 })
      videoInfo = search.videos[0]
    }

    // Check if we can get transcript
    let hasTranscript = false
    let transcriptPreview = ''
    try {
      const result = await getTranscript(videoId)
      hasTranscript = result.success && !!result.text && result.text.length > 100
      transcriptPreview = result.text?.slice(0, 500) || ''
    } catch {
      hasTranscript = false
    }

    return NextResponse.json({
      video_id: videoId,
      title: videoInfo?.title || 'Unknown',
      channel: videoInfo?.channel || 'Unknown',
      duration: videoInfo?.duration,
      views: videoInfo?.views,
      published_at: videoInfo?.publishedAt,
      thumbnail_url: videoInfo?.thumbnailUrl,
      has_transcript: hasTranscript,
      transcript_preview: transcriptPreview,
      can_repurpose: hasTranscript
    })
  } catch (error) {
    console.error('[Repurpose] Failed to fetch video info:', error)
    return NextResponse.json({
      error: 'Failed to fetch video info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Run the repurposing pipeline
export async function POST(request: NextRequest) {
  const runId = uuidv4()

  try {
    const body = await request.json()
    const {
      video_url,
      topic_id,
      style = 'documentary',
      length = 'medium',
      generate_audio = false,
      host_name = 'Algorithm Institute',
      seed,
      channel_style_file
    } = body

    if (!video_url) {
      return NextResponse.json({ error: 'video_url is required' }, { status: 400 })
    }

    const videoId = extractVideoId(video_url)
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
    }

    console.log(`[Repurpose:${runId}] Starting repurposing for video: ${videoId}`)

    // Step 1: Fetch original video transcript
    console.log(`[Repurpose:${runId}] Step 1: Fetching transcript`)
    let originalTranscript: string
    try {
      const transcriptResult = await getTranscript(videoId)
      if (!transcriptResult.success || !transcriptResult.text || transcriptResult.text.length < 100) {
        return NextResponse.json({
          error: 'Video has no usable transcript',
          details: 'Cannot repurpose videos without captions or transcripts'
        }, { status: 400 })
      }
      originalTranscript = transcriptResult.text
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to fetch transcript',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 400 })
    }

    // Get video title
    const { getVideoDetails } = await import('@/lib/youtube-api')
    let videoTitle = 'Unknown Video'
    try {
      const details = await getVideoDetails(videoId)
      videoTitle = details?.title || 'Unknown Video'
    } catch {
      // Use fallback
    }

    console.log(`[Repurpose:${runId}] Original video: ${videoTitle}`)
    console.log(`[Repurpose:${runId}] Transcript length: ${originalTranscript.length} chars`)

    // Step 2: Extract main topic from transcript
    console.log(`[Repurpose:${runId}] Step 2: Extracting topic`)

    // Get topic context if topic_id provided
    let nicheContext: string | undefined
    if (topic_id) {
      const { data: topic } = await supabaseAdmin
        .from('topics')
        .select('name')
        .eq('id', topic_id)
        .single()
      nicheContext = topic?.name
    }

    const extracted = await extractTopicFromTranscript(videoTitle, originalTranscript, nicheContext)
    console.log(`[Repurpose:${runId}] Extracted topic: ${extracted.topic}`)
    console.log(`[Repurpose:${runId}] Entities: ${extracted.entities.join(', ')}`)

    // Step 3: Research the topic deeper (YouTube + Web Search)
    console.log(`[Repurpose:${runId}] Step 3: Deep research`)

    // Try YouTube research (may fail due to API issues)
    let researchResult
    try {
      researchResult = await runResearchWorkflow({
        query: extracted.topic,
        topic_id,
        topic_context: nicheContext,
        max_videos: 10,
        enable_interview_lookup: true,
        enable_twitter_sentiment: false,
        enable_relationship_extraction: true,
        use_llm_extraction: false
      })
    } catch (error) {
      console.error(`[Repurpose:${runId}] YouTube research failed:`, error)
      researchResult = {
        videos_found: 0,
        transcripts_from_youtube: 0,
        transcripts_from_assemblyai: 0,
        interviews_found: 0,
        sources: [],
        interviews: []
      }
    }

    // Deep web search for each specific topic mentioned
    console.log(`[Repurpose:${runId}] Step 3b: Deep research on specific topics`)
    let webResults: Array<{ title: string; content: string; url: string; query: string }> = []

    try {
      // Search for the main topic
      console.log(`[Repurpose:${runId}] Searching main topic: ${extracted.topic}`)
      const mainResults = await searchWeb(extracted.topic, { max_results: 5 })
      webResults.push(...mainResults.map(r => ({ ...r, query: 'main_topic' })))

      // Search for each specific EVENT mentioned
      console.log(`[Repurpose:${runId}] Searching ${extracted.events?.length || 0} events`)
      for (const event of (extracted.events || []).slice(0, 8)) {
        const eventResults = await searchWeb(`${event} battle rap 2025`, { max_results: 3 })
        webResults.push(...eventResults.map(r => ({ title: r.title, content: r.content, url: r.url, query: `event: ${event}` })))
      }

      // Search for each specific BATTLE/MATCHUP mentioned
      console.log(`[Repurpose:${runId}] Searching ${extracted.people?.length || 0} battles/people`)
      for (const matchup of (extracted.people || []).slice(0, 10)) {
        const matchResults = await searchWeb(`${matchup} battle rap`, { max_results: 2 })
        webResults.push(...matchResults.map(r => ({ title: r.title, content: r.content, url: r.url, query: `matchup: ${matchup}` })))
      }

      // Search for each entity/league for background
      console.log(`[Repurpose:${runId}] Searching ${extracted.entities?.length || 0} entities`)
      for (const entity of (extracted.entities || []).slice(0, 8)) {
        const entityResults = await searchWeb(`${entity} ${nicheContext || 'battle rap'}`, { max_results: 2 })
        webResults.push(...entityResults.map(r => ({ title: r.title, content: r.content, url: r.url, query: `entity: ${entity}` })))
      }

      // Search sub-topics for additional angles
      console.log(`[Repurpose:${runId}] Searching ${extracted.sub_topics?.length || 0} sub-topics`)
      for (const subTopic of (extracted.sub_topics || []).slice(0, 5)) {
        const subResults = await searchWeb(`${subTopic} battle rap`, { max_results: 2 })
        webResults.push(...subResults.map(r => ({ title: r.title, content: r.content, url: r.url, query: `subtopic: ${subTopic}` })))
      }

      // Deduplicate by URL
      const seen = new Set<string>()
      webResults = webResults.filter(r => {
        if (seen.has(r.url)) return false
        seen.add(r.url)
        return true
      })

      console.log(`[Repurpose:${runId}] Deep research found ${webResults.length} unique results`)
    } catch (error) {
      console.error(`[Repurpose:${runId}] Web search failed:`, error)
    }

    console.log(`[Repurpose:${runId}] Research complete: ${researchResult.videos_found} videos, ${researchResult.transcripts_from_youtube + researchResult.transcripts_from_assemblyai} transcripts, ${webResults.length} web results`)

    // Step 4: Generate improved script
    console.log(`[Repurpose:${runId}] Step 4: Generating script`)

    // Collect supplemental sources (research beyond the original)
    // Include YouTube research + web search results
    const supplementalSources = [
      // YouTube videos with transcripts
      ...researchResult.sources.map(s => ({
        title: s.title,
        url: s.url,
        channel: s.channel,
        transcript: s.transcript,
        views: s.views,
        source_type: 'youtube'
      })),
      // Interview videos
      ...researchResult.interviews.map(i => ({
        title: i.title,
        url: i.url,
        channel: i.channel,
        transcript: i.transcript,
        entity: i.entity_name,
        source_type: 'interview'
      })),
      // Web search results (treat content as transcript for script generation)
      ...webResults.map(w => ({
        title: w.title,
        url: w.url,
        transcript: w.content, // Web content becomes research material
        source_type: 'web'
      }))
    ]

    console.log(`[Repurpose:${runId}] Supplemental sources: ${supplementalSources.length} (${supplementalSources.filter(s => s.transcript).length} with transcripts)`)

    // Generate script using our custom repurposing function
    // This creates 100% original-sounding content with NO source attribution
    const story = await generateRepurposedScript(
      extracted.topic,
      originalTranscript,
      supplementalSources,
      { style, length, host_name }
    )
    console.log(`[Repurpose:${runId}] Script generated: ${story.word_count} words`)

    // Step 4b: Save script and research files to disk
    console.log(`[Repurpose:${runId}] Step 4b: Saving files to disk`)

    const filesDir = path.join(process.cwd(), 'public', 'repurposed')
    await fs.mkdir(filesDir, { recursive: true })

    // Save script file
    const scriptFilename = `repurpose-${runId}-script.txt`
    const scriptPath = path.join(filesDir, scriptFilename)
    await fs.writeFile(scriptPath, story.script)
    const scriptUrl = `/repurposed/${scriptFilename}`

    // Save research summary JSON
    const researchData = {
      run_id: runId,
      generated_at: new Date().toISOString(),
      original_video: {
        video_id: videoId,
        title: videoTitle,
        transcript_length: originalTranscript.length
      },
      extracted: {
        topic: extracted.topic,
        entities: extracted.entities,
        events: extracted.events || [],
        people: extracted.people || [],
        sub_topics: extracted.sub_topics || [],
        summary: extracted.summary
      },
      supplemental_research: {
        youtube_videos_found: researchResult.videos_found,
        youtube_transcripts_acquired: researchResult.transcripts_from_youtube + researchResult.transcripts_from_assemblyai,
        interviews_found: researchResult.interviews_found,
        web_results_found: webResults.length,
        total_supplemental_sources: supplementalSources.length,
        sources: supplementalSources.map(s => ({
          title: s.title,
          source_type: s.source_type,
          url: s.url,
          has_content: !!s.transcript,
          content_length: s.transcript?.length || 0
        }))
      },
      script_stats: {
        word_count: story.word_count,
        estimated_duration_seconds: Math.ceil(story.word_count / 150 * 60)
      }
    }
    const researchFilename = `repurpose-${runId}-research.json`
    const researchPath = path.join(filesDir, researchFilename)
    await fs.writeFile(researchPath, JSON.stringify(researchData, null, 2))
    const researchUrl = `/repurposed/${researchFilename}`

    console.log(`[Repurpose:${runId}] Files saved: ${scriptFilename}, ${researchFilename}`)

    // Step 5: Generate audio (optional)
    let audioUrl: string | undefined
    let audioPath: string | undefined
    let audioFilename: string | undefined

    if (generate_audio) {
      console.log(`[Repurpose:${runId}] Step 5: Generating audio with Dia`)

      try {
        // Check Dia health
        const diaHealth = await checkDiaHealth()
        if (diaHealth.status !== 'ok') {
          throw new Error('Dia service not available')
        }

        // Convert script to dialogue segments
        const segments = scriptToDialogueSegments(story.script)
        console.log(`[Repurpose:${runId}] Script split into ${segments.length} dialogue segments`)

        // Generate audio
        const audioBuffer = await generateDialogue({
          segments,
          seed: seed || 42
        })

        // Save audio file (in same directory as other files)
        audioFilename = `repurpose-${runId}.mp3`
        audioPath = path.join(filesDir, audioFilename)
        await fs.writeFile(audioPath, audioBuffer)

        audioUrl = `/repurposed/${audioFilename}`
        console.log(`[Repurpose:${runId}] Audio saved: ${audioUrl}`)
      } catch (error) {
        console.error(`[Repurpose:${runId}] Audio generation failed:`, error)
        // Continue without audio
      }
    }

    // Step 6: Save to database
    console.log(`[Repurpose:${runId}] Step 6: Saving to database`)

    // Note: The stories table uses final_headline/final_content columns
    const { data: savedStory, error: saveError } = await supabaseAdmin
      .from('stories')
      .insert({
        final_headline: `Repurposed: ${videoTitle}`,
        final_content: story.script,
        production_status: 'pending',
        integrity_checklist: {
          original_video_id: videoId,
          original_video_title: videoTitle,
          original_transcript_length: originalTranscript.length,
          extracted_topic: extracted.topic,
          extracted_entities: extracted.entities,
          research_videos_found: researchResult.videos_found,
          research_transcripts: researchResult.transcripts_from_youtube + researchResult.transcripts_from_assemblyai,
          word_count: story.word_count,
          style,
          length,
          audio_url: audioUrl,
          run_id: runId
        }
      })
      .select()
      .single()

    if (saveError) {
      console.error(`[Repurpose:${runId}] Failed to save story:`, saveError)
    }

    // Return result
    return NextResponse.json({
      success: true,
      run_id: runId,
      story_id: savedStory?.id,

      // Original video
      original: {
        video_id: videoId,
        title: videoTitle,
        transcript_length: originalTranscript.length
      },

      // Extracted info - what we found to research
      extracted: {
        topic: extracted.topic,
        entities: extracted.entities,
        events: extracted.events || [],
        people: extracted.people || [],
        sub_topics: extracted.sub_topics || [],
        summary: extracted.summary
      },

      // Supplemental research (what we found beyond the original)
      supplemental_research: {
        youtube_videos_found: researchResult.videos_found,
        youtube_transcripts_acquired: researchResult.transcripts_from_youtube + researchResult.transcripts_from_assemblyai,
        interviews_found: researchResult.interviews_found,
        web_results_found: webResults.length,
        total_supplemental_sources: supplementalSources.length,
        // List of supplemental sources used (so you can see what enriched the content)
        sources: supplementalSources.map(s => ({
          title: s.title,
          source_type: s.source_type,
          channel: s.channel,
          has_content: !!s.transcript,
          content_length: s.transcript?.length || 0
        }))
      },

      // Generated content (100% original, no source attribution)
      script: {
        content: story.script,
        word_count: story.word_count,
        estimated_duration_seconds: Math.ceil(story.word_count / 150 * 60),
        title: story.title
      },

      // Audio (if generated)
      audio: audioUrl ? {
        url: audioUrl,
        path: audioPath
      } : null,

      // Files created (for download UI)
      files: {
        script: {
          filename: scriptFilename,
          url: scriptUrl,
          word_count: story.word_count,
          size_bytes: Buffer.byteLength(story.script, 'utf8')
        },
        research: {
          filename: researchFilename,
          url: researchUrl,
          source_count: supplementalSources.length
        },
        audio: audioUrl ? {
          filename: audioFilename!,
          url: audioUrl,
          duration_seconds: Math.ceil(story.word_count / 150 * 60)
        } : null
      }
    })

  } catch (error) {
    console.error(`[Repurpose:${runId}] Pipeline failed:`, error)
    return NextResponse.json({
      error: 'Repurposing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      run_id: runId
    }, { status: 500 })
  }
}
