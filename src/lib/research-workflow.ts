/**
 * Research Workflow
 *
 * Main orchestrator for the research pipeline:
 * 1. Query interpretation & expansion
 * 2. Multi-query YouTube search
 * 3. Filter & prioritize videos
 * 4. Transcript acquisition
 * 5. Generate documentation
 */

import { v4 as uuidv4 } from 'uuid'
import { interpretQuery, QueryPlan, scoreVideoRelevance, isQueryInterpreterConfigured } from './query-interpreter'
import { getMultipleTranscripts, getTranscript } from './transcript-fetcher'
import { searchYouTube } from './youtube-api'
import { supabase } from './db'
import { enrichResearchWithTwitter, formatTwitterForPrompt, TwitterSentiment } from './twitter-sentiment'
import { searchWeb, WebSearchResult } from './web-search'
// Import will be added after research-docs.ts is created
// import { generateResearchDocs } from './research-docs'

// Document types for legal/allegation stories
export interface DocumentSearchResult {
  type: 'court_record' | 'news_article' | 'official_document' | 'social_media'
  title: string
  url: string
  snippet: string
  relevance_score: number
}

// Video type from unified search
interface YouTubeVideo {
  id: string
  title: string
  description?: string
  channel?: string
  views?: number
  duration?: number
  publishedAt?: string
  thumbnailUrl?: string
}

export interface WorkflowOptions {
  query: string
  topic_id?: string
  topic_context?: string        // e.g., "battle rap"
  max_videos?: number           // Default 15
  max_duration_minutes?: number // Default 120
  min_duration_seconds?: number // Default 60
  skip_existing?: boolean       // Default true
  force_transcribe?: boolean    // Default false
  generate_docs?: boolean       // Default true
  // Research package options
  generate_package?: boolean    // Default false - generate and save ResearchPackage
  // Interview lookup options
  enable_interview_lookup?: boolean  // Default true - automatically search interviews for public figures
  max_interviews_per_entity?: number // Default 1
  interview_max_duration_minutes?: number  // Default 60
  interview_min_duration_minutes?: number  // Default 5
  // Twitter sentiment options
  enable_twitter_sentiment?: boolean  // Default false - search Twitter for reactions
  twitter_min_confidence?: 'low' | 'medium' | 'high'  // Default 'medium'
  // Document search options (auto-enabled for legal/allegation stories)
  enable_document_search?: boolean     // Default false - auto-enabled when allegations detected
  document_types?: string[]            // ['paperwork', 'court records', 'arrest']
  document_location?: string           // State/city for court record searches
}

export interface ResearchSource {
  video_id: string
  title: string
  channel: string
  url: string
  views?: number
  published_at?: string
  duration_seconds?: number
  transcript?: string
  transcript_source?: 'youtube_captions' | 'assemblyai'
  transcript_confidence?: number
  relevance_score?: number
}

export interface InterviewSource {
  entity_name: string
  entity_id?: string
  entity_type: string  // 'battler', 'blogger', 'league_owner', etc.
  video_id: string
  title: string
  channel: string
  url: string
  duration_seconds: number
  transcript?: string
  transcript_source?: 'youtube_captions' | 'assemblyai' | 'database' | 'cache'
  from_cache: boolean
  cost_cents: number
}

export interface WorkflowResult {
  run_id: string
  query: string
  query_plan?: QueryPlan
  started_at: string
  completed_at: string

  // Stats
  videos_found: number
  videos_filtered: number
  transcripts_from_youtube: number
  transcripts_from_assemblyai: number
  transcripts_failed: number

  // Interview stats
  entities_identified: number
  public_figures_found: number
  interviews_searched: number
  interviews_found: number
  interviews_from_cache: number
  interviews_cost_cents: number

  // Twitter stats
  twitter_searched: boolean
  twitter_event_date?: string
  twitter_tweets_found: number
  twitter_sentiment?: {
    positive: number
    negative: number
    neutral: number
  }
  twitter_cost_cents: number

  // Document search stats (for legal/allegation stories)
  documents_searched: boolean
  documents_found: number
  real_name_found?: string  // Government name if discovered

  // Results
  sources: ResearchSource[]
  interviews: InterviewSource[]  // Interview data for identified entities
  twitter?: TwitterSentiment     // Twitter reactions (if enabled)
  documents?: DocumentSearchResult[]  // Court records, paperwork (if allegations detected)
  documentation?: {
    markdown_path: string
    json_path: string
  }
  // Research package (if generate_package=true)
  research_package_id?: string

  // Errors
  errors: WorkflowError[]
}

export interface WorkflowError {
  stage: 'query_interpretation' | 'search' | 'filter' | 'download' | 'transcribe' | 'docs' | 'document_search' | 'interview_lookup' | 'twitter_sentiment' | 'research_package'
  video_id?: string
  entity_name?: string
  message: string
  recoverable: boolean
}

/**
 * Search YouTube with multiple queries and deduplicate
 */
async function searchWithMultipleQueries(
  queries: string[],
  maxResults: number
): Promise<Map<string, YouTubeVideo>> {
  const allVideos = new Map<string, YouTubeVideo>()

  console.log(`[ResearchWorkflow] Searching YouTube with ${queries.length} queries`)

  for (const query of queries) {
    try {
      const results = await searchYouTube(query, {
        maxResults: Math.min(maxResults, 25)  // YouTube API limit per query
      })

      for (const video of results.videos) {
        if (!allVideos.has(video.id)) {
          allVideos.set(video.id, video)
        }
      }

      console.log(`[ResearchWorkflow] Query "${query}": ${results.videos.length} results (total unique: ${allVideos.size})`)
    } catch (error) {
      console.error(`[ResearchWorkflow] Search error for "${query}":`, error)
    }
  }

  return allVideos
}

/**
 * Filter and prioritize videos based on QueryPlan
 */
function filterAndPrioritizeVideos(
  videos: Map<string, YouTubeVideo>,
  plan: QueryPlan,
  options: WorkflowOptions
): YouTubeVideo[] {
  const maxDuration = (options.max_duration_minutes || 120) * 60
  const minDuration = options.min_duration_seconds || 60
  const maxVideos = options.max_videos || 15

  const scoredVideos: Array<{ video: YouTubeVideo; score: number }> = []

  for (const video of Array.from(videos.values())) {
    // Filter by duration
    const duration = video.duration || 0
    if (duration > maxDuration) {
      console.log(`[ResearchWorkflow] Skipping "${video.title}" - too long (${Math.round(duration / 60)}min)`)
      continue
    }
    if (duration < minDuration) {
      console.log(`[ResearchWorkflow] Skipping "${video.title}" - too short (${duration}s)`)
      continue
    }

    // Score relevance
    let score = scoreVideoRelevance(video.title, video.description || '', plan)

    // DURATION BONUS: Prioritize longer content (interviews > reactions)
    // Interviews are typically 20-60+ minutes, reactions are 5-15 minutes
    const durationMinutes = duration / 60
    if (durationMinutes >= 30) {
      score += 40  // Long interview bonus
    } else if (durationMinutes >= 20) {
      score += 25  // Medium interview bonus
    } else if (durationMinutes >= 10) {
      score += 10  // Decent length bonus
    }
    // Short videos (< 10 min) get no bonus - likely reactions/clips

    // INTERVIEW KEYWORD BONUS: Look for interview indicators in title
    const titleLower = video.title.toLowerCase()
    if (titleLower.includes('interview') || titleLower.includes('sits down') ||
        titleLower.includes('full conversation') || titleLower.includes('exclusive')) {
      score += 30  // Explicit interview bonus
    }
    if (titleLower.includes('hhir') || titleLower.includes('hip hop is real') ||
        titleLower.includes('vladtv') || titleLower.includes('no jumper')) {
      score += 20  // Known interview platform bonus
    }

    // Skip if negative score (likely irrelevant)
    if (score < 0) {
      console.log(`[ResearchWorkflow] Skipping "${video.title}" - low relevance (${score})`)
      continue
    }

    scoredVideos.push({ video, score })
  }

  // Sort by score (descending) - duration and interview bonuses now included
  scoredVideos.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    // Tiebreaker: prefer longer videos, then higher views
    const durationDiff = (b.video.duration || 0) - (a.video.duration || 0)
    if (durationDiff !== 0) return durationDiff
    return (b.video.views || 0) - (a.video.views || 0)
  })

  // Take top N
  const selected = scoredVideos.slice(0, maxVideos)

  console.log(`[ResearchWorkflow] Selected ${selected.length} videos from ${videos.size} candidates`)

  return selected.map(s => s.video)
}

// ============================================
// PUBLIC FIGURE CLASSIFICATION
// ============================================

/**
 * Entity types that should have interview lookup
 * These are public figures who likely have interviews on YouTube
 */
const PUBLIC_FIGURE_TYPES = [
  'battler',
  'rapper',
  'blogger',
  'host',
  'media_personality',
  'league_owner',
  'promoter',
  'producer',
  'dj',
  'commentator',
  'journalist',
  'influencer',
  'content_creator',
  'person'  // Generic person type - check further
]

/**
 * Entity types that should NOT have interview lookup
 * Organizations, events, etc.
 */
const NON_PERSON_TYPES = [
  'league',
  'organization',
  'company',
  'brand',
  'event',
  'location',
  'venue',
  'media',
  'channel',
  'show',
  'podcast'
]

interface IdentifiedEntity {
  name: string
  type: string
  id?: string
  is_public_figure: boolean
}

/**
 * Determine if an entity is a public figure who would have interviews
 */
function isPublicFigure(entityType: string): boolean {
  const normalizedType = entityType.toLowerCase().replace(/[_-]/g, '')

  // Check if explicitly a non-person type
  for (const nonPerson of NON_PERSON_TYPES) {
    if (normalizedType.includes(nonPerson.replace(/[_-]/g, ''))) {
      return false
    }
  }

  // Check if explicitly a public figure type
  for (const publicType of PUBLIC_FIGURE_TYPES) {
    if (normalizedType.includes(publicType.replace(/[_-]/g, ''))) {
      return true
    }
  }

  // Default: assume it could be a person if unknown
  return true
}

/**
 * Extract and classify entities from query plan and research
 */
async function identifyEntitiesForInterviewLookup(
  queryPlan: QueryPlan,
  topicId: string | undefined
): Promise<IdentifiedEntity[]> {
  const entities: IdentifiedEntity[] = []
  const seenNames = new Set<string>()

  // 1. Get entities from query plan
  if (queryPlan.entities && queryPlan.entities.length > 0) {
    for (const entity of queryPlan.entities) {
      const name = entity.name?.trim()
      if (!name || seenNames.has(name.toLowerCase())) continue
      seenNames.add(name.toLowerCase())

      const type = entity.type || 'person'
      entities.push({
        name,
        type,
        is_public_figure: isPublicFigure(type)
      })
    }
  }

  // 2. Check entity_lookups from query plan (these are string search queries)
  if (queryPlan.entity_lookups && queryPlan.entity_lookups.length > 0) {
    for (const lookup of queryPlan.entity_lookups) {
      const name = lookup  // entity_lookups is string[]
      if (!name || seenNames.has(name.toLowerCase())) continue
      seenNames.add(name.toLowerCase())

      entities.push({
        name,
        type: 'person',
        is_public_figure: true
      })
    }
  }

  // 3. If we have a topic_id, look up known entities from database
  if (topicId && entities.length > 0) {
    const names = entities.map(e => e.name)

    const { data: dbEntities } = await supabase
      .from('entities')
      .select('id, canonical_name, entity_type, metadata')
      .eq('topic_id', topicId)
      .or(names.map(n => `canonical_name.ilike.${n}`).join(','))

    if (dbEntities) {
      for (const dbEntity of dbEntities) {
        const matchingEntity = entities.find(
          e => e.name.toLowerCase() === dbEntity.canonical_name.toLowerCase()
        )
        if (matchingEntity) {
          matchingEntity.id = dbEntity.id
          // Use database type if more specific
          if (dbEntity.entity_type) {
            matchingEntity.type = dbEntity.entity_type
            matchingEntity.is_public_figure = isPublicFigure(dbEntity.entity_type)
          }
        }
      }
    }
  }

  return entities
}

// ============================================
// INTERVIEW LOOKUP
// ============================================

interface InterviewLookupOptions {
  max_duration_minutes: number
  min_duration_minutes: number
  prefer_longest: boolean
}

/**
 * Get trusted YouTube channels for a topic
 */
async function getTrustedChannels(topicId: string | undefined): Promise<Set<string>> {
  if (!topicId) return new Set()

  const { data } = await supabase
    .from('youtube_channels')
    .select('channel_id, channel_name')
    .eq('topic_id', topicId)

  const channelIds = new Set<string>()
  if (data) {
    for (const ch of data) {
      if (ch.channel_id) channelIds.add(ch.channel_id)
      // Also add channel name for matching (lowercase for comparison)
      if (ch.channel_name) channelIds.add(ch.channel_name.toLowerCase())
    }
  }
  return channelIds
}

/**
 * Search YouTube for content where entities DISCUSS each other or the topic
 * NOT generic interviews - we want overlaps and topic-specific discussions
 */
async function searchForRelevantDiscussion(
  entityNames: string[],  // All entities to find overlaps
  topicKeywords: string[], // Topic keywords from query plan
  trustedChannels: Set<string>,
  options: InterviewLookupOptions
): Promise<YouTubeVideo[]> {
  const allVideos: YouTubeVideo[] = []
  const seenIds = new Set<string>()

  // Strategy 1: Search for entity pairs (overlaps)
  // E.g., "Debo Caps" - finds videos discussing both
  if (entityNames.length >= 2) {
    for (let i = 0; i < entityNames.length && i < 3; i++) {
      for (let j = i + 1; j < entityNames.length && j < 4; j++) {
        const query = `${entityNames[i]} ${entityNames[j]}`
        console.log(`[InterviewLookup] Searching overlap: "${query}"`)

        try {
          const result = await searchYouTube(query, { maxResults: 10 })
          if (result.videos) {
            for (const v of result.videos) {
              if (!seenIds.has(v.id)) {
                seenIds.add(v.id)
                allVideos.push(v)
              }
            }
          }
        } catch (e) {
          console.error(`[InterviewLookup] Search error for "${query}":`, e)
        }
      }
    }
  }

  // Strategy 2: Search for entity + topic keywords
  // E.g., "Debo fight" or "Caps incident"
  for (const entity of entityNames.slice(0, 3)) {
    for (const keyword of topicKeywords.slice(0, 2)) {
      const query = `${entity} ${keyword}`
      console.log(`[InterviewLookup] Searching topic: "${query}"`)

      try {
        const result = await searchYouTube(query, { maxResults: 8 })
        if (result.videos) {
          for (const v of result.videos) {
            if (!seenIds.has(v.id)) {
              seenIds.add(v.id)
              allVideos.push(v)
            }
          }
        }
      } catch (e) {
        console.error(`[InterviewLookup] Search error for "${query}":`, e)
      }
    }
  }

  // Strategy 3: Search for entity + interview platforms (HHIR, VladTV, etc.)
  // These platforms host long-form interviews with the actual person
  const interviewPlatforms = ['HHIR', 'hip hop is real', 'vladtv', 'no jumper', 'interview']
  for (const entity of entityNames.slice(0, 3)) {
    for (const platform of interviewPlatforms) {
      const query = `${entity} ${platform}`
      console.log(`[InterviewLookup] Searching interview platform: "${query}"`)

      try {
        const result = await searchYouTube(query, { maxResults: 5 })
        if (result.videos) {
          for (const v of result.videos) {
            if (!seenIds.has(v.id)) {
              seenIds.add(v.id)
              allVideos.push(v)
            }
          }
        }
      } catch (e) {
        console.error(`[InterviewLookup] Search error for "${query}":`, e)
      }
    }
  }

  // Filter by duration
  const maxSeconds = options.max_duration_minutes * 60
  const minSeconds = options.min_duration_minutes * 60

  const eligible = allVideos.filter(v => {
    const duration = v.duration || 0
    return duration >= minSeconds && duration <= maxSeconds
  })

  // Score and sort videos
  // Priority: 1) From trusted channel, 2) Longer duration, 3) More views
  eligible.sort((a, b) => {
    // Check if from trusted channel
    const aChannel = a.channel?.toLowerCase() || ''
    const bChannel = b.channel?.toLowerCase() || ''
    const aTrusted = trustedChannels.has(aChannel) ? 1 : 0
    const bTrusted = trustedChannels.has(bChannel) ? 1 : 0

    if (aTrusted !== bTrusted) {
      return bTrusted - aTrusted  // Trusted first
    }

    // Longer videos tend to be more in-depth discussions
    const aDuration = a.duration || 0
    const bDuration = b.duration || 0
    if (Math.abs(aDuration - bDuration) > 300) {  // 5 min difference
      return bDuration - aDuration  // Longer first
    }

    // More views = more relevance
    return (b.views || 0) - (a.views || 0)
  })

  console.log(`[InterviewLookup] Found ${eligible.length} eligible videos from ${allVideos.length} total`)

  return eligible
}

/**
 * Legacy: Search YouTube for an interview with a specific person
 * Now used as fallback when overlap search doesn't find results
 */
async function searchForPersonInterview(
  entityName: string,
  topicContext: string,
  options: InterviewLookupOptions
): Promise<YouTubeVideo | null> {
  // Build search query - now includes topic context better
  const searchQuery = `${entityName} ${topicContext}`

  console.log(`[InterviewLookup] Fallback searching: "${searchQuery}"`)

  try {
    const result = await searchYouTube(searchQuery, {
      maxResults: 15
    })

    if (!result.videos || result.videos.length === 0) {
      console.log(`[InterviewLookup] No videos found for ${entityName}`)
      return null
    }

    // Filter by duration
    const maxSeconds = options.max_duration_minutes * 60
    const minSeconds = options.min_duration_minutes * 60

    const eligible = result.videos.filter(v => {
      const duration = v.duration || 0
      return duration >= minSeconds && duration <= maxSeconds
    })

    if (eligible.length === 0) {
      console.log(`[InterviewLookup] No videos within duration limits for ${entityName}`)
      return null
    }

    // Sort by duration (longest first if preferred)
    if (options.prefer_longest) {
      eligible.sort((a, b) => (b.duration || 0) - (a.duration || 0))
    } else {
      eligible.sort((a, b) => (b.views || 0) - (a.views || 0))
    }

    const selected = eligible[0]
    console.log(`[InterviewLookup] Selected: "${selected.title}" (${Math.round((selected.duration || 0) / 60)}min)`)

    return selected
  } catch (error) {
    console.error(`[InterviewLookup] Search error for ${entityName}:`, error)
    return null
  }
}

/**
 * Check if we have a cached interview for this entity
 */
async function getCachedInterview(
  entityName: string,
  topicId: string | undefined
): Promise<InterviewSource | null> {
  if (!topicId) return null

  // Check youtube_videos table for cached interviews
  const { data } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('topic_id', topicId)
    .ilike('title', `%${entityName}%interview%`)
    .not('transcript', 'is', null)
    .order('duration_seconds', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    const cached = data[0]
    console.log(`[InterviewLookup] Found cached interview for ${entityName}: "${cached.title}"`)

    return {
      entity_name: entityName,
      entity_type: 'person',
      video_id: cached.video_id,
      title: cached.title,
      channel: cached.channel_title || 'Unknown',
      url: `https://www.youtube.com/watch?v=${cached.video_id}`,
      duration_seconds: cached.duration_seconds || 0,
      transcript: cached.transcript,
      transcript_source: 'cache',
      from_cache: true,
      cost_cents: 0
    }
  }

  return null
}

/**
 * Cache an interview for future use
 */
async function cacheInterview(
  video: YouTubeVideo,
  transcript: string,
  transcriptSource: string,
  topicId: string | undefined
): Promise<void> {
  if (!topicId) return

  try {
    await supabase
      .from('youtube_videos')
      .upsert({
        video_id: video.id,
        topic_id: topicId,
        title: video.title,
        channel_title: video.channel,
        duration_seconds: video.duration,
        view_count: video.views,
        published_at: video.publishedAt,
        transcript: transcript,
        transcript_source: transcriptSource,
        is_interview: true,
        fetched_at: new Date().toISOString()
      }, {
        onConflict: 'video_id'
      })

    console.log(`[InterviewLookup] Cached interview: "${video.title}"`)
  } catch (error) {
    console.error('[InterviewLookup] Failed to cache interview:', error)
  }
}

/**
 * Look up relevant discussions for identified public figures
 * NEW APPROACH: Search for entity OVERLAPS and topic-specific content
 * NOT generic interviews - we want videos where entities discuss EACH OTHER
 */
async function enrichWithInterviews(
  entities: IdentifiedEntity[],
  options: WorkflowOptions,
  errors: WorkflowError[],
  queryPlan?: QueryPlan  // Now accepts query plan for keywords
): Promise<{
  interviews: InterviewSource[]
  stats: {
    searched: number
    found: number
    from_cache: number
    cost_cents: number
  }
}> {
  const interviews: InterviewSource[] = []
  const stats = {
    searched: 0,
    found: 0,
    from_cache: 0,
    cost_cents: 0
  }

  // Filter to public figures only
  const publicFigures = entities.filter(e => e.is_public_figure)

  if (publicFigures.length === 0) {
    console.log('[InterviewLookup] No public figures identified for interview lookup')
    return { interviews, stats }
  }

  console.log(`[InterviewLookup] Looking up discussions for ${publicFigures.length} public figures`)

  const lookupOptions: InterviewLookupOptions = {
    max_duration_minutes: options.interview_max_duration_minutes || 60,
    min_duration_minutes: options.interview_min_duration_minutes || 3,  // Lower min for discussions
    prefer_longest: true
  }

  // Get trusted channels for prioritization
  const trustedChannels = await getTrustedChannels(options.topic_id)
  console.log(`[InterviewLookup] Found ${trustedChannels.size} trusted channels`)

  // Get entity names for overlap search
  const entityNames = publicFigures.map(e => e.name)

  // Get topic keywords from query plan or derive from query
  const topicKeywords: string[] = []
  if (queryPlan) {
    // Extract keywords from primary queries
    for (const q of queryPlan.primary_queries) {
      const words = q.split(/\s+/).filter(w => w.length > 3)
      topicKeywords.push(...words)
    }
    // Add entity names as keywords
    for (const entity of queryPlan.entities || []) {
      if (entity.name) topicKeywords.push(entity.name)
    }
  }
  // Dedupe keywords
  const uniqueKeywords = Array.from(new Set(topicKeywords)).slice(0, 5)

  console.log(`[InterviewLookup] Searching with entities: ${entityNames.join(', ')}`)
  console.log(`[InterviewLookup] Topic keywords: ${uniqueKeywords.join(', ')}`)

  // NEW APPROACH: Search for overlaps and topic discussions
  const relevantVideos = await searchForRelevantDiscussion(
    entityNames,
    uniqueKeywords,
    trustedChannels,
    lookupOptions
  )

  // Limit to top N videos to avoid excessive API calls
  const maxVideos = options.max_interviews_per_entity || 3
  const videosToProcess = relevantVideos.slice(0, maxVideos * 2)  // Extra in case some fail

  console.log(`[InterviewLookup] Processing top ${videosToProcess.length} relevant videos`)

  const processedIds = new Set<string>()

  for (const video of videosToProcess) {
    // Stop if we have enough
    if (stats.found >= maxVideos) break

    // Skip if already processed
    if (processedIds.has(video.id)) continue
    processedIds.add(video.id)

    stats.searched++

    try {
      // Determine which entity this is most relevant to
      const matchingEntity = findMatchingEntity(video.title, publicFigures)
      const entityName = matchingEntity?.name || entityNames[0]

      // Check cache first
      const cached = await getCachedInterview(entityName, options.topic_id)
      if (cached && cached.video_id === video.id) {
        cached.entity_id = matchingEntity?.id
        cached.entity_type = matchingEntity?.type || 'person'
        interviews.push(cached)
        stats.found++
        stats.from_cache++
        continue
      }

      // Get transcript
      const transcriptResult = await getTranscript(video.id, {
        prefer_youtube: true,
        enable_download: true,
        max_duration_minutes: lookupOptions.max_duration_minutes,
        force_refresh: false
      })

      if (!transcriptResult.success || !transcriptResult.text) {
        errors.push({
          stage: 'interview_lookup',
          entity_name: entityName,
          video_id: video.id,
          message: transcriptResult.error || 'Failed to get transcript',
          recoverable: true
        })
        continue
      }

      // Calculate cost (AssemblyAI charges ~$0.006/min)
      const durationMinutes = (video.duration || 0) / 60
      const costCents = transcriptResult.source === 'assemblyai'
        ? Math.ceil(durationMinutes * 0.6)
        : 0

      // Cache for future use
      await cacheInterview(video, transcriptResult.text, transcriptResult.source || 'unknown', options.topic_id)

      // Check if from trusted channel
      const isTrusted = trustedChannels.has(video.channel?.toLowerCase() || '')

      // Add to results
      interviews.push({
        entity_name: entityName,
        entity_id: matchingEntity?.id,
        entity_type: matchingEntity?.type || 'person',
        video_id: video.id,
        title: video.title + (isTrusted ? ' [TRUSTED]' : ''),
        channel: video.channel || 'Unknown',
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration_seconds: video.duration || 0,
        transcript: transcriptResult.text,
        transcript_source: transcriptResult.source,
        from_cache: false,
        cost_cents: costCents
      })

      stats.found++
      stats.cost_cents += costCents

      // Small delay between lookups to be nice to YouTube
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`[InterviewLookup] Error processing ${video.id}:`, error)
      errors.push({
        stage: 'interview_lookup',
        video_id: video.id,
        message: String(error),
        recoverable: true
      })
    }
  }

  console.log(`[InterviewLookup] Complete: ${stats.found}/${stats.searched} relevant discussions found (${stats.from_cache} from cache)`)

  return { interviews, stats }
}

/**
 * Find which entity a video title is most relevant to
 */
function findMatchingEntity(
  title: string,
  entities: IdentifiedEntity[]
): IdentifiedEntity | null {
  const lowerTitle = title.toLowerCase()
  for (const entity of entities) {
    if (lowerTitle.includes(entity.name.toLowerCase())) {
      return entity
    }
  }
  return entities[0] || null
}

/**
 * Search for documents related to legal/allegation stories
 * Uses web search to find court records, arrest records, news articles about paperwork
 */
async function searchForDocuments(
  entityNames: string[],
  queryPlan: QueryPlan,
  location?: string
): Promise<{ documents: DocumentSearchResult[]; realName?: string }> {
  console.log(`[DocumentSearch] Searching for documents about: ${entityNames.join(', ')}`)

  const documents: DocumentSearchResult[] = []
  let realName: string | undefined

  // Document types to search for
  const documentTypes = [
    'court records',
    'arrest records',
    'paperwork',
    'case documents',
    'indictment'
  ]

  // First, try to find real name if we only have stage names
  for (const entityName of entityNames) {
    try {
      const realNameQueries = [
        `"${entityName}" real name`,
        `"${entityName}" government name`,
        `"${entityName}" born name`
      ]

      for (const query of realNameQueries) {
        const results = await searchWeb(query, { max_results: 3 })
        for (const result of results) {
          // Look for patterns like "real name is X" or "born X"
          const nameMatch = result.content?.match(
            /(?:real name|born|government name)(?:\s+is)?[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
          )
          if (nameMatch && nameMatch[1]) {
            realName = nameMatch[1].trim()
            console.log(`[DocumentSearch] Found real name: ${realName} for ${entityName}`)
            break
          }
        }
        if (realName) break
      }
    } catch (error) {
      console.error(`[DocumentSearch] Error finding real name for ${entityName}:`, error)
    }
  }

  // Search for documents using both stage name and real name
  const searchNames = [...entityNames]
  if (realName) searchNames.push(realName)

  for (const name of searchNames) {
    for (const docType of documentTypes) {
      try {
        const query = location
          ? `"${name}" ${docType} ${location}`
          : `"${name}" ${docType}`

        const results = await searchWeb(query, { max_results: 3 })

        for (const result of results) {
          // Determine document type from URL and content
          let type: DocumentSearchResult['type'] = 'news_article'
          const urlLower = result.url.toLowerCase()
          const titleLower = result.title.toLowerCase()

          if (urlLower.includes('court') || urlLower.includes('.gov') ||
              titleLower.includes('court') || titleLower.includes('case')) {
            type = 'court_record'
          } else if (urlLower.includes('arrest') || titleLower.includes('arrest') ||
                     titleLower.includes('mugshot')) {
            type = 'official_document'
          } else if (urlLower.includes('twitter') || urlLower.includes('instagram') ||
                     urlLower.includes('facebook')) {
            type = 'social_media'
          }

          // Calculate relevance score
          let relevanceScore = 0
          if (result.title.toLowerCase().includes(name.toLowerCase())) relevanceScore += 30
          if (result.content?.toLowerCase().includes('paperwork')) relevanceScore += 20
          if (result.content?.toLowerCase().includes('snitch')) relevanceScore += 20
          if (result.content?.toLowerCase().includes('court')) relevanceScore += 15
          if (type === 'court_record') relevanceScore += 25

          // Only add if somewhat relevant
          if (relevanceScore >= 20) {
            // Check for duplicates
            const exists = documents.some(d => d.url === result.url)
            if (!exists) {
              documents.push({
                type,
                title: result.title,
                url: result.url,
                snippet: result.content || '',
                relevance_score: relevanceScore
              })
            }
          }
        }
      } catch (error) {
        console.error(`[DocumentSearch] Error searching ${docType} for ${name}:`, error)
      }
    }
  }

  // Sort by relevance
  documents.sort((a, b) => b.relevance_score - a.relevance_score)

  console.log(`[DocumentSearch] Found ${documents.length} relevant documents`)

  return { documents: documents.slice(0, 10), realName }
}

/**
 * Main research workflow
 */
export async function runResearchWorkflow(
  options: WorkflowOptions
): Promise<WorkflowResult> {
  const runId = uuidv4()
  const startedAt = new Date().toISOString()
  const errors: WorkflowError[] = []

  console.log(`[ResearchWorkflow] Starting workflow ${runId} for query: "${options.query}"`)

  // Initialize result
  const result: WorkflowResult = {
    run_id: runId,
    query: options.query,
    started_at: startedAt,
    completed_at: '',
    videos_found: 0,
    videos_filtered: 0,
    transcripts_from_youtube: 0,
    transcripts_from_assemblyai: 0,
    transcripts_failed: 0,
    // Interview stats
    entities_identified: 0,
    public_figures_found: 0,
    interviews_searched: 0,
    interviews_found: 0,
    interviews_from_cache: 0,
    interviews_cost_cents: 0,
    // Twitter stats
    twitter_searched: false,
    twitter_tweets_found: 0,
    twitter_cost_cents: 0,
    // Document search stats
    documents_searched: false,
    documents_found: 0,
    // Results
    sources: [],
    interviews: [],
    errors: []
  }

  // STEP 0: Query interpretation & expansion
  let queryPlan: QueryPlan
  try {
    if (isQueryInterpreterConfigured()) {
      console.log('[ResearchWorkflow] Step 0: Interpreting query...')
      queryPlan = await interpretQuery(options.query, {
        topic_context: options.topic_context || 'battle rap',
        depth: 'thorough'
      })
      result.query_plan = queryPlan
      console.log(`[ResearchWorkflow] Query interpreted as: "${queryPlan.interpreted_as}"`)
    } else {
      console.log('[ResearchWorkflow] Query interpreter not configured, using simple query')
      queryPlan = {
        original_query: options.query,
        interpreted_as: options.query,
        primary_queries: [options.query],
        secondary_queries: [],
        entity_lookups: [],
        search_type: 'youtube_only',
        expected_content: 'mixed',
        entities: [],
        keywords_must_have: options.query.split(' ').slice(0, 2),
        keywords_nice_to_have: [],
        exclude_patterns: [],
        involves_legal_allegations: false,
        document_search_recommended: false,
        real_name_search_needed: false
      }
    }
  } catch (error) {
    console.error('[ResearchWorkflow] Query interpretation error:', error)
    errors.push({
      stage: 'query_interpretation',
      message: String(error),
      recoverable: true
    })
    // Fallback to simple query
    queryPlan = {
      original_query: options.query,
      interpreted_as: options.query,
      primary_queries: [options.query],
      secondary_queries: [],
      entity_lookups: [],
      search_type: 'youtube_only',
      expected_content: 'mixed',
      entities: [],
      keywords_must_have: [],
      keywords_nice_to_have: [],
      exclude_patterns: [],
      involves_legal_allegations: false,
      document_search_recommended: false,
      real_name_search_needed: false
    }
  }

  // STEP 1: Multi-query YouTube search
  console.log('[ResearchWorkflow] Step 1: Searching YouTube...')
  const allQueries = [...queryPlan.primary_queries, ...queryPlan.secondary_queries]
  const allVideos = await searchWithMultipleQueries(allQueries, options.max_videos || 15)
  result.videos_found = allVideos.size

  if (allVideos.size === 0) {
    errors.push({
      stage: 'search',
      message: 'No videos found for any query',
      recoverable: false
    })
    result.errors = errors
    result.completed_at = new Date().toISOString()
    return result
  }

  // STEP 2: Filter & prioritize
  console.log('[ResearchWorkflow] Step 2: Filtering and prioritizing...')
  const filteredVideos = filterAndPrioritizeVideos(allVideos, queryPlan, options)
  result.videos_filtered = filteredVideos.length

  if (filteredVideos.length === 0) {
    errors.push({
      stage: 'filter',
      message: 'All videos were filtered out',
      recoverable: false
    })
    result.errors = errors
    result.completed_at = new Date().toISOString()
    return result
  }

  // STEP 3: Transcript acquisition
  console.log('[ResearchWorkflow] Step 3: Getting transcripts...')
  const videoIds = filteredVideos.map(v => v.id)
  const transcriptResults = await getMultipleTranscripts(videoIds, {
    prefer_youtube: true,
    enable_download: !options.skip_existing,
    max_duration_minutes: options.max_duration_minutes,
    min_duration_seconds: options.min_duration_seconds,
    force_refresh: options.force_transcribe
  })

  // STEP 4: Aggregate results
  console.log('[ResearchWorkflow] Step 4: Aggregating results...')

  for (let i = 0; i < filteredVideos.length; i++) {
    const video = filteredVideos[i]
    const transcript = transcriptResults[i]

    const source: ResearchSource = {
      video_id: video.id,
      title: video.title,
      channel: video.channel || 'Unknown',
      url: `https://www.youtube.com/watch?v=${video.id}`,
      views: video.views,
      published_at: video.publishedAt,
      duration_seconds: video.duration,
      relevance_score: scoreVideoRelevance(video.title, video.description || '', queryPlan)
    }

    if (transcript.success && transcript.text) {
      source.transcript = transcript.text
      source.transcript_source = transcript.source === 'database'
        ? 'youtube_captions'  // Cached transcripts were originally from one of these
        : transcript.source
      source.transcript_confidence = transcript.confidence

      if (transcript.source === 'youtube_captions' || transcript.source === 'database') {
        result.transcripts_from_youtube++
      } else if (transcript.source === 'assemblyai') {
        result.transcripts_from_assemblyai++
      }
    } else {
      result.transcripts_failed++
      errors.push({
        stage: 'transcribe',
        video_id: video.id,
        message: transcript.error || 'Unknown error',
        recoverable: true
      })
    }

    result.sources.push(source)
  }

  // Sort sources by relevance score
  result.sources.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))

  // STEP 4.5: Document search for legal/allegation stories
  const shouldSearchDocuments = queryPlan.involves_legal_allegations ||
    queryPlan.document_search_recommended ||
    options.enable_document_search

  if (shouldSearchDocuments) {
    console.log('[ResearchWorkflow] Step 4.5: Searching for documents (legal story detected)...')

    // Extract entity names for document search
    const entityNames = queryPlan.entities.map(e => e.name)

    // Also extract entity names from the query itself
    const queryWords = options.query.split(/\s+/)
    const capitalizedWords = queryWords.filter(w =>
      w.length > 2 && w[0] === w[0].toUpperCase() && w !== w.toUpperCase()
    )
    const allEntityNames = Array.from(new Set([...entityNames, ...capitalizedWords]))

    if (allEntityNames.length > 0) {
      const documentTypes = options.document_types || ['paperwork', 'court records', 'arrest']

      try {
        const searchResult = await searchForDocuments(
          allEntityNames,
          queryPlan,
          options.document_location
        )

        result.documents_searched = true
        result.documents_found = searchResult.documents.length
        result.documents = searchResult.documents

        // Check if we found a real name
        const realNameDoc = searchResult.documents.find(d =>
          d.snippet.toLowerCase().includes('born') ||
          d.snippet.toLowerCase().includes('real name') ||
          d.snippet.toLowerCase().includes('government name')
        )
        if (realNameDoc) {
          result.real_name_found = realNameDoc.title || realNameDoc.snippet.slice(0, 100)
          console.log('[ResearchWorkflow] Found potential real name in documents')
        }

        console.log(`[ResearchWorkflow] Found ${searchResult.documents.length} relevant documents`)
      } catch (docError) {
        console.error('[ResearchWorkflow] Document search error:', docError)
        errors.push({
          stage: 'document_search',
          message: String(docError),
          recoverable: true
        })
      }
    } else {
      console.log('[ResearchWorkflow] No entities found for document search')
    }
  }

  // STEP 5: Interview lookup for public figures (enabled by default)
  if (options.enable_interview_lookup !== false) {
    console.log('[ResearchWorkflow] Step 5: Looking up interviews for public figures...')

    // Identify entities from query plan
    const identifiedEntities = await identifyEntitiesForInterviewLookup(queryPlan, options.topic_id)
    result.entities_identified = identifiedEntities.length
    result.public_figures_found = identifiedEntities.filter(e => e.is_public_figure).length

    if (identifiedEntities.length > 0) {
      console.log(`[ResearchWorkflow] Identified ${identifiedEntities.length} entities, ${result.public_figures_found} public figures`)

      // Look up interviews - pass queryPlan for keyword extraction
      const interviewResult = await enrichWithInterviews(identifiedEntities, options, errors, queryPlan)

      result.interviews = interviewResult.interviews
      result.interviews_searched = interviewResult.stats.searched
      result.interviews_found = interviewResult.stats.found
      result.interviews_from_cache = interviewResult.stats.from_cache
      result.interviews_cost_cents = interviewResult.stats.cost_cents
    }
  }

  // STEP 6: Twitter sentiment (if enabled)
  // Twitter requires knowing WHEN the event happened (from video dates)
  // Then searches for reactions from that specific time period
  if (options.enable_twitter_sentiment) {
    console.log('[ResearchWorkflow] Step 6: Searching Twitter for reactions...')

    try {
      const twitterSentiment = await enrichResearchWithTwitter(
        {
          sources: result.sources.map(s => ({
            title: s.title,
            published_at: s.published_at,
            channel: s.channel,
            relevance_score: s.relevance_score
          })),
          query_plan: queryPlan
        },
        {
          enabled: true,
          min_confidence: options.twitter_min_confidence || 'medium'
        }
      )

      if (twitterSentiment) {
        result.twitter_searched = true
        result.twitter = twitterSentiment
        result.twitter_event_date = twitterSentiment.timeframe.event_date.toISOString()
        result.twitter_tweets_found = twitterSentiment.tweets_found
        result.twitter_sentiment = twitterSentiment.sentiment
        result.twitter_cost_cents = twitterSentiment.cost_cents

        console.log(`[ResearchWorkflow] Twitter: Found ${twitterSentiment.tweets_found} tweets from ${twitterSentiment.timeframe.event_date.toISOString().split('T')[0]}`)
      } else {
        console.log('[ResearchWorkflow] Twitter: No results or skipped')
      }
    } catch (error) {
      console.error('[ResearchWorkflow] Twitter sentiment error:', error)
      errors.push({
        stage: 'twitter_sentiment',
        message: String(error),
        recoverable: true
      })
    }
  }

  // STEP 7: Generate documentation (placeholder - will be implemented in research-docs.ts)
  if (options.generate_docs !== false && result.sources.some(s => s.transcript)) {
    console.log('[ResearchWorkflow] Step 7: Generating documentation...')
    try {
      // Dynamically import to avoid circular dependency
      const { generateResearchDocs } = await import('./research-docs')
      const docs = await generateResearchDocs(result, options.topic_id)
      result.documentation = docs
    } catch (error) {
      console.error('[ResearchWorkflow] Documentation error:', error)
      errors.push({
        stage: 'docs',
        message: String(error),
        recoverable: true
      })
    }
  }

  // STEP 8: Generate and save research package (if enabled)
  if (options.generate_package && result.sources.some(s => s.transcript)) {
    console.log('[ResearchWorkflow] Step 8: Generating research package...')
    try {
      // Dynamically import to avoid circular dependency
      const { assembleResearchPackage, saveResearchPackage } = await import('./research-package')
      const pkg = await assembleResearchPackage(result, {
        topic_id: options.topic_id,
        include_transcripts: true,
        generate_producer_materials: true,
        generate_host_materials: true,
      })
      const saveResult = await saveResearchPackage(pkg)
      if (saveResult.success) {
        result.research_package_id = pkg.metadata.package_id
        console.log(`[ResearchWorkflow] Research package saved: ${pkg.metadata.package_id}`)
      } else {
        throw new Error(saveResult.error)
      }
    } catch (error) {
      console.error('[ResearchWorkflow] Research package error:', error)
      errors.push({
        stage: 'research_package',
        message: String(error),
        recoverable: true
      })
    }
  }

  result.errors = errors
  result.completed_at = new Date().toISOString()

  // Summary
  const successCount = result.transcripts_from_youtube + result.transcripts_from_assemblyai
  console.log(`[ResearchWorkflow] Workflow complete:`)
  console.log(`  - Videos found: ${result.videos_found}`)
  console.log(`  - Videos filtered: ${result.videos_filtered}`)
  console.log(`  - Transcripts from YouTube: ${result.transcripts_from_youtube}`)
  console.log(`  - Transcripts from AssemblyAI: ${result.transcripts_from_assemblyai}`)
  console.log(`  - Transcripts failed: ${result.transcripts_failed}`)
  console.log(`  - Transcript success rate: ${((successCount / result.videos_filtered) * 100).toFixed(1)}%`)
  // Interview stats
  if (result.entities_identified > 0) {
    console.log(`  - Entities identified: ${result.entities_identified}`)
    console.log(`  - Public figures: ${result.public_figures_found}`)
    console.log(`  - Interviews found: ${result.interviews_found} (${result.interviews_from_cache} from cache)`)
    console.log(`  - Interview cost: $${(result.interviews_cost_cents / 100).toFixed(2)}`)
  }
  // Twitter stats
  if (result.twitter_searched) {
    console.log(`  - Twitter event date: ${result.twitter_event_date?.split('T')[0]}`)
    console.log(`  - Twitter tweets: ${result.twitter_tweets_found}`)
    if (result.twitter_sentiment) {
      console.log(`  - Twitter sentiment: ${result.twitter_sentiment.positive}% pos, ${result.twitter_sentiment.negative}% neg`)
    }
    console.log(`  - Twitter cost: $${(result.twitter_cost_cents / 100).toFixed(3)}`)
  }
  // Total cost
  const totalCost = result.interviews_cost_cents + result.twitter_cost_cents
  if (totalCost > 0) {
    console.log(`  - Total research cost: $${(totalCost / 100).toFixed(3)}`)
  }
  // Research package
  if (result.research_package_id) {
    console.log(`  - Research package ID: ${result.research_package_id}`)
  }

  return result
}
