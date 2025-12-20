/**
 * Entity YouTube Enrichment
 *
 * For battle rap (and similar niches), YouTube is like Google.
 * To learn about someone:
 * 1. Search "{name} interview"
 * 2. Sort by longest duration (more insight)
 * 3. Download, transcribe, extract context
 *
 * This module handles automated entity enrichment via YouTube interviews.
 */

import { supabase } from './db'
import { searchYouTube } from './youtube-api'
import { getTranscript } from './transcript-fetcher'
import { EntityContext } from '@/types/entity-context'

// LLM for context extraction
const REQUESTY_API_KEY = process.env.REQUESTY_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const LLM_ENDPOINT = process.env.PRESIDIUM_URL || 'http://localhost:11434'
const LLM_MODEL = process.env.DEEP_RESEARCH_MODEL || 'qwen3:14b'

// ============================================
// TYPES
// ============================================

export interface YouTubeEnrichmentConfig {
  entity_id: string
  entity_name: string
  topic_id: string
  search_suffix?: string       // default: "interview"
  prefer_longest?: boolean     // default: true
  max_duration_minutes?: number  // default: 60
  min_duration_minutes?: number  // default: 5
  topic_context?: string       // e.g., "battle rap"
}

export interface YouTubeEnrichmentResult {
  success: boolean
  entity_id: string
  run_id?: string
  video_used?: {
    id: string
    title: string
    channel: string
    duration_seconds: number
    url: string
  }
  extracted_context?: Partial<EntityContext>
  transcript_preview?: string
  cost_cents?: number
  error?: string
}

interface YouTubeVideo {
  id: string
  title: string
  description?: string
  channel?: string
  channelTitle?: string
  views?: number
  viewCount?: number
  duration?: number
  publishedAt?: string
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

/**
 * Enrich an entity by finding and analyzing YouTube interviews
 */
export async function enrichEntityViaYouTube(
  config: YouTubeEnrichmentConfig
): Promise<YouTubeEnrichmentResult> {
  const {
    entity_id,
    entity_name,
    topic_id,
    search_suffix = 'interview',
    prefer_longest = true,
    max_duration_minutes = 60,
    min_duration_minutes = 5,
    topic_context = 'battle rap'
  } = config

  console.log(`[YouTubeEnrichment] Starting enrichment for: ${entity_name}`)

  // Create enrichment run record
  const { data: runData, error: runError } = await supabase
    .from('entity_enrichment_runs')
    .insert({
      entity_id,
      topic_id,
      search_query: `${entity_name} ${search_suffix}`,
      search_suffix,
      status: 'searching'
    })
    .select('id')
    .single()

  const runId = runData?.id

  try {
    // 1. Search for interviews
    console.log(`[YouTubeEnrichment] Searching: "${entity_name} ${search_suffix}"`)
    const videos = await searchForInterviews(entity_name, search_suffix)

    if (videos.length === 0) {
      await updateEnrichmentRun(runId, {
        status: 'no_videos',
        error: 'No videos found'
      })
      return {
        success: false,
        entity_id,
        run_id: runId,
        error: 'No videos found'
      }
    }

    // Update run with videos found
    await updateEnrichmentRun(runId, {
      videos_found: videos.length,
      videos_considered: videos.slice(0, 5).map(v => ({
        id: v.id,
        title: v.title,
        duration: v.duration,
        channel: v.channel || v.channelTitle
      }))
    })

    // 2. Select best video
    console.log(`[YouTubeEnrichment] Found ${videos.length} videos, selecting best...`)
    const bestVideo = selectBestVideo(videos, {
      prefer_longest,
      max_duration_minutes,
      min_duration_minutes
    })

    if (!bestVideo) {
      await updateEnrichmentRun(runId, {
        status: 'no_suitable_video',
        error: 'No video within duration limits'
      })
      return {
        success: false,
        entity_id,
        run_id: runId,
        error: 'No video within duration limits'
      }
    }

    console.log(`[YouTubeEnrichment] Selected: "${bestVideo.title}" (${Math.round((bestVideo.duration || 0) / 60)}min)`)

    // Update run with selected video
    await updateEnrichmentRun(runId, {
      status: 'transcribing',
      best_video_id: bestVideo.id,
      best_video_title: bestVideo.title,
      best_video_url: `https://www.youtube.com/watch?v=${bestVideo.id}`,
      best_video_duration_seconds: bestVideo.duration,
      best_video_channel: bestVideo.channel || bestVideo.channelTitle
    })

    // 3. Get transcript
    console.log(`[YouTubeEnrichment] Getting transcript for: ${bestVideo.id}`)
    const transcriptResult = await getTranscript(bestVideo.id, {
      prefer_youtube: true,
      enable_download: true,
      max_duration_minutes,
      force_refresh: false
    })

    if (!transcriptResult.success || !transcriptResult.text) {
      await updateEnrichmentRun(runId, {
        status: 'transcript_failed',
        error: transcriptResult.error || 'Failed to get transcript'
      })
      return {
        success: false,
        entity_id,
        run_id: runId,
        video_used: {
          id: bestVideo.id,
          title: bestVideo.title,
          channel: bestVideo.channel || bestVideo.channelTitle || 'Unknown',
          duration_seconds: bestVideo.duration || 0,
          url: `https://www.youtube.com/watch?v=${bestVideo.id}`
        },
        error: transcriptResult.error || 'Failed to get transcript'
      }
    }

    // Calculate cost (AssemblyAI charges ~$0.006/min)
    const durationMinutes = (bestVideo.duration || 0) / 60
    const costCents = transcriptResult.source === 'assemblyai'
      ? Math.ceil(durationMinutes * 0.6)  // $0.006/min = 0.6 cents/min
      : 0

    // Update run with transcript info
    await updateEnrichmentRun(runId, {
      status: 'extracting',
      transcript_text: transcriptResult.text.substring(0, 50000), // Limit storage
      transcript_source: transcriptResult.source,
      transcript_confidence: transcriptResult.confidence,
      cost_cents: costCents
    })

    // 4. Extract context from transcript
    console.log(`[YouTubeEnrichment] Extracting context from transcript (${transcriptResult.text.length} chars)`)
    const extractedContext = await extractContextFromTranscript(
      transcriptResult.text,
      entity_name,
      topic_context
    )

    // 5. Update entity with extracted context
    if (extractedContext && Object.keys(extractedContext).length > 0) {
      await updateEntityContext(entity_id, extractedContext)
    }

    // Update run as completed
    await updateEnrichmentRun(runId, {
      status: 'completed',
      extracted_context: extractedContext,
      completed_at: new Date().toISOString()
    })

    console.log(`[YouTubeEnrichment] Successfully enriched ${entity_name}`)

    return {
      success: true,
      entity_id,
      run_id: runId,
      video_used: {
        id: bestVideo.id,
        title: bestVideo.title,
        channel: bestVideo.channel || bestVideo.channelTitle || 'Unknown',
        duration_seconds: bestVideo.duration || 0,
        url: `https://www.youtube.com/watch?v=${bestVideo.id}`
      },
      extracted_context: extractedContext,
      transcript_preview: transcriptResult.text.substring(0, 500) + '...',
      cost_cents: costCents
    }

  } catch (error) {
    console.error(`[YouTubeEnrichment] Error:`, error)

    await updateEnrichmentRun(runId, {
      status: 'error',
      error: String(error),
      completed_at: new Date().toISOString()
    })

    return {
      success: false,
      entity_id,
      run_id: runId,
      error: String(error)
    }
  }
}

// ============================================
// YOUTUBE SEARCH
// ============================================

/**
 * Search YouTube for interviews about a person
 */
async function searchForInterviews(
  name: string,
  suffix: string
): Promise<YouTubeVideo[]> {
  const query = `${name} ${suffix}`

  try {
    const result = await searchYouTube(query, {
      maxResults: 20  // Get enough to filter
    })

    return result.videos || []
  } catch (error) {
    console.error('[YouTubeEnrichment] Search error:', error)
    return []
  }
}

/**
 * Select the best video for enrichment
 * Prefers longer videos (more insight) within duration limits
 */
function selectBestVideo(
  videos: YouTubeVideo[],
  options: {
    prefer_longest: boolean
    max_duration_minutes: number
    min_duration_minutes: number
  }
): YouTubeVideo | null {
  const {
    prefer_longest,
    max_duration_minutes,
    min_duration_minutes
  } = options

  const maxSeconds = max_duration_minutes * 60
  const minSeconds = min_duration_minutes * 60

  // Filter by duration
  const eligible = videos.filter(v => {
    const duration = v.duration || 0
    return duration >= minSeconds && duration <= maxSeconds
  })

  if (eligible.length === 0) {
    return null
  }

  // Sort by duration (longest first if preferred)
  if (prefer_longest) {
    eligible.sort((a, b) => (b.duration || 0) - (a.duration || 0))
  } else {
    // Otherwise sort by views (most popular)
    eligible.sort((a, b) => (b.views || b.viewCount || 0) - (a.views || a.viewCount || 0))
  }

  return eligible[0]
}

// ============================================
// CONTEXT EXTRACTION
// ============================================

/**
 * Extract entity context from transcript using LLM
 */
async function extractContextFromTranscript(
  transcript: string,
  entityName: string,
  topicContext: string
): Promise<Partial<EntityContext>> {
  // Truncate transcript if too long
  const maxLength = 15000
  const truncatedTranscript = transcript.length > maxLength
    ? transcript.substring(0, maxLength) + '...[truncated]'
    : transcript

  const prompt = `Analyze this interview transcript about "${entityName}" in the context of ${topicContext}.

Extract information about ${entityName} and return a JSON object with these fields (only include fields you find evidence for):

{
  "role": "string - primary role (e.g., 'battler', 'blogger', 'league owner', 'promoter')",
  "sub_roles": ["array of additional roles"],
  "gender": "'male' | 'female' | 'other'",
  "affiliations": [
    {
      "name": "organization name (e.g., 'URL', 'QOTR', 'Angry Fans Radio')",
      "type": "league | media | company | brand",
      "status": "current | former | rumored"
    }
  ],
  "content_types": ["what they create/do: battles, reactions, interviews, podcasts"],
  "is_primary_source": "boolean - are they an official/authoritative source?",
  "is_commentator": "boolean - do they comment on/react to others?",
  "covers_topics": ["topics they discuss"],
  "bias_indicators": ["known biases or strong opinions"],
  "reliability_notes": "notes about reliability/credibility",
  "notes": "important context about this person"
}

TRANSCRIPT:
${truncatedTranscript}

Return ONLY valid JSON, no explanation. If you can't find information for a field, omit it.`

  try {
    const response = await callLLM(prompt)

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])

      // Add enrichment metadata
      parsed.enrichment_status = 'enriched'
      parsed.enrichment_last_run = new Date().toISOString()
      parsed.context_updated_at = new Date().toISOString()
      parsed.context_updated_by = 'youtube_enrichment'

      return parsed as Partial<EntityContext>
    }

    return {}
  } catch (error) {
    console.error('[YouTubeEnrichment] Context extraction error:', error)
    return {}
  }
}

/**
 * Call LLM for context extraction
 */
async function callLLM(prompt: string): Promise<string> {
  // Try Requesty/OpenRouter first
  const apiKey = REQUESTY_API_KEY || OPENROUTER_API_KEY
  const apiUrl = REQUESTY_API_KEY
    ? 'https://router.requesty.ai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions'

  if (apiKey) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (response.ok) {
        const data = await response.json()
        return data.choices?.[0]?.message?.content || ''
      }
    } catch (error) {
      console.error('[YouTubeEnrichment] Cloud LLM error:', error)
    }
  }

  // Fall back to local LLM
  try {
    const response = await fetch(`${LLM_ENDPOINT}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: 'You are an expert at extracting structured information from text. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    })

    if (response.ok) {
      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    }
  } catch (error) {
    console.error('[YouTubeEnrichment] Local LLM error:', error)
  }

  return ''
}

// ============================================
// DATABASE UPDATES
// ============================================

/**
 * Update enrichment run record
 */
async function updateEnrichmentRun(
  runId: string | undefined,
  updates: Record<string, unknown>
): Promise<void> {
  if (!runId) return

  try {
    await supabase
      .from('entity_enrichment_runs')
      .update(updates)
      .eq('id', runId)
  } catch (error) {
    console.error('[YouTubeEnrichment] Failed to update run:', error)
  }
}

/**
 * Update entity with extracted context
 * Merges with existing context, doesn't overwrite
 */
async function updateEntityContext(
  entityId: string,
  newContext: Partial<EntityContext>
): Promise<void> {
  // Get current entity
  const { data: entity } = await supabase
    .from('entities')
    .select('metadata')
    .eq('id', entityId)
    .single()

  const existingContext = (entity?.metadata || {}) as EntityContext

  // Merge contexts (new context takes precedence for non-null values)
  const mergedContext: EntityContext = {
    ...existingContext,
    ...Object.fromEntries(
      Object.entries(newContext).filter(([_, v]) => v !== undefined && v !== null)
    )
  }

  // Handle array merging for affiliations
  if (newContext.affiliations && existingContext.affiliations) {
    const existingAffNames = new Set(existingContext.affiliations.map(a => a.name))
    const newAffs = newContext.affiliations.filter(a => !existingAffNames.has(a.name))
    mergedContext.affiliations = [...existingContext.affiliations, ...newAffs]
  }

  // Update entity
  await supabase
    .from('entities')
    .update({
      metadata: mergedContext,
      updated_at: new Date().toISOString()
    })
    .eq('id', entityId)
}

// ============================================
// BATCH ENRICHMENT
// ============================================

/**
 * Enrich multiple entities
 */
export async function enrichMultipleEntities(
  entities: Array<{ id: string; name: string }>,
  topicId: string,
  options?: Partial<YouTubeEnrichmentConfig>
): Promise<YouTubeEnrichmentResult[]> {
  const results: YouTubeEnrichmentResult[] = []

  for (const entity of entities) {
    console.log(`[YouTubeEnrichment] Enriching ${entity.name}...`)

    const result = await enrichEntityViaYouTube({
      entity_id: entity.id,
      entity_name: entity.name,
      topic_id: topicId,
      ...options
    })

    results.push(result)

    // Small delay between requests to be nice to YouTube
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  return results
}

/**
 * Get entities that need enrichment
 */
export async function getEntitiesNeedingEnrichment(
  topicId: string,
  limit: number = 10
): Promise<Array<{ id: string; name: string; mention_count: number }>> {
  // Find entities with mention counts but no enrichment
  const { data } = await supabase
    .from('entities')
    .select('id, canonical_name, mention_count')
    .eq('topic_id', topicId)
    .or('metadata->enrichment_status.is.null,metadata->enrichment_status.eq.pending')
    .order('mention_count', { ascending: false })
    .limit(limit)

  return data?.map(e => ({ id: e.id, name: e.canonical_name, mention_count: e.mention_count })) || []
}
