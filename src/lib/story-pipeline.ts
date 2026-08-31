/**
 * Story Pipeline Library
 *
 * End-to-end workflow for creating stories:
 * 1. Research - Search YouTube, gather transcripts
 * 2. Vet - Cross-reference sources, identify perspectives
 * 3. Write - Use Claude API to create compelling story
 */

import { getFreeYouTubeClient, YouTubeVideo, YouTubeTranscript } from './youtube-api'
import { searchWeb, WebSearchResult } from './web-search'
import { supabase } from './db'

// New research workflow (enhanced with query expansion, audio download, AssemblyAI)
import { runResearchWorkflow, WorkflowResult, DocumentSearchResult } from './research-workflow'

// Entity context injection (prevents hallucinations)
import { extractEntityNames, resolveEntityContext, EntityContextForPrompt } from './entity-context-resolver'

// Niche-specific settings
import { getNicheSettings, getStoryConfig } from './niche-settings'

// Twitter sentiment
import { formatTwitterForPrompt, TwitterSentiment } from './twitter-sentiment'

// Configuration
// OpenRouter or Requesty for Claude access (no direct Anthropic API)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const REQUESTY_API_KEY = process.env.REQUESTY_API_KEY
const REQUESTY_URL = 'https://router.requesty.ai/v1/chat/completions'

// ============================================
// TYPES
// ============================================

export interface ResearchConfig {
  query: string
  topic_id?: string
  research_mode?: 'youtube_first' | 'twitter_first'  // Research mode (default: youtube_first)
  max_videos?: number
  include_web_search?: boolean
  min_views?: number
  // New options for enhanced workflow
  use_enhanced_workflow?: boolean  // Use query expansion + AssemblyAI transcription
  force_transcribe?: boolean       // Download audio and transcribe even if no captions
  generate_docs?: boolean          // Generate MD + JSON documentation
  // Interview lookup options (enabled by default in enhanced workflow)
  enable_interview_lookup?: boolean  // Auto-search interviews for public figures
  topic_context?: string            // Context for interview searches (e.g., "battle rap")
  // Twitter sentiment options
  enable_twitter_sentiment?: boolean  // Search Twitter for reactions from event time
  // Document search options (auto-enabled for legal/allegation stories)
  enable_document_search?: boolean   // Search for court docs, paperwork
  document_types?: string[]          // Types: ['paperwork', 'court records', 'arrest']
  document_location?: string         // Location for court record searches
}

export interface ResearchSource {
  type: 'youtube' | 'web'
  title: string
  url: string
  channel?: string
  views?: number
  published_at?: string
  transcript?: string
  transcript_source?: 'youtube_captions' | 'assemblyai' | 'database'
  snippet?: string
  perspective?: string // Extracted perspective/bias
}

export interface InterviewData {
  entity_name: string
  entity_type: string
  video_title: string
  video_url: string
  channel: string
  transcript?: string
  from_cache: boolean
}

export interface TwitterReactionData {
  event_date: string
  sentiment: {
    positive: number
    negative: number
    neutral: number
  }
  key_quotes: string[]
  tweets_found: number
}

export interface ResearchResult {
  query: string
  sources: ResearchSource[]
  interviews: InterviewData[]  // Interview transcripts for identified public figures
  twitter?: TwitterReactionData  // Twitter reactions from the event timeframe
  twitter_activity?: import('./twitter-intelligence').TwitterActivity  // Twitter activity analysis (twitter_first mode)
  documents?: DocumentSearchResult[]  // Court records, paperwork, official documents
  verified_claims?: Array<{  // Fact-checked claims from Twitter (via Perplexity)
    claim: string
    verification: string
    sources: string[]
    status: 'verified' | 'disputed' | 'inconclusive'
  }>
  perspectives: string[]
  key_facts: string[]
  conflicting_info: string[]
  total_transcript_length: number
}

// Story length tiers
export type StoryLength = 'short' | 'medium' | 'long'

export interface StoryLengthConfig {
  word_count: number
  duration_minutes: number
  chapters: string[]
}

export const STORY_LENGTH_TIERS: Record<StoryLength, StoryLengthConfig> = {
  short: {
    word_count: 750,
    duration_minutes: 5,
    chapters: ['Hook', 'Main Story', 'Conclusion']
  },
  medium: {
    word_count: 1500,
    duration_minutes: 10,
    chapters: ['Hook', 'Background', 'The Event', 'Aftermath', 'Conclusion']
  },
  long: {
    word_count: 2500,
    duration_minutes: 17,
    chapters: ['Hook', 'Background', 'Build-up', 'The Event', 'Aftermath', 'Reactions', 'Conclusion']
  }
}

export interface StoryConfig {
  style?: 'documentary' | 'news' | 'analysis' | 'narrative'
  tone?: 'serious' | 'engaging' | 'dramatic' | 'neutral'
  length?: StoryLength  // New: 'short', 'medium', 'long'
  max_length?: number   // Legacy: Target word count (overrides length if set)
  include_intro?: boolean
  include_outro?: boolean
  host_name?: string
  topic_id?: string  // For entity context injection
  chapter_structure?: string[]  // Custom chapter structure
  opening_template?: string  // Custom opening line template
  production_format?: string  // Production format: talk_show, news_bulletin, investigation, etc.
  channel_style_file?: string  // Channel style file slug (e.g., 'algorithm-institute')
}

export interface GeneratedStory {
  title: string
  script: string
  word_count: number
  estimated_duration_seconds: number
  sources_cited: string[]
}

export interface StoryPipelineResult {
  research: ResearchResult
  story: GeneratedStory
  audio_path?: string
  audio_url?: string
  pipeline_id: string
  created_at: string
  // Research package (if generate_package=true)
  research_package_id?: string
  research_package_urls?: {
    json: string
    markdown: string
  }
}

// ============================================
// RESEARCH PHASE
// ============================================

/**
 * Research a topic by gathering YouTube videos and transcripts
 *
 * If use_enhanced_workflow is true, uses the new workflow with:
 * - Query interpretation & expansion (LLM-powered)
 * - Audio download via yt-dlp when captions unavailable
 * - AssemblyAI transcription with speaker diarization
 * - Documentation generation (MD + JSON)
 */
export async function researchTopic(config: ResearchConfig): Promise<ResearchResult> {
  const {
    query,
    max_videos = 10,
    include_web_search = true,
    min_views = 1000,
    use_enhanced_workflow = false,
    force_transcribe = false,
    generate_docs = true
  } = config

  // Use enhanced workflow if requested
  if (use_enhanced_workflow) {
    console.log(`[Research] Using enhanced workflow for: ${query}`)

    try {
      const workflowResult = await runResearchWorkflow({
        query,
        topic_id: config.topic_id,
        topic_context: config.topic_context || 'battle rap',
        research_mode: config.research_mode || 'youtube_first',  // NEW
        max_videos,
        force_transcribe,
        generate_docs,
        // Interview lookup is enabled by default
        enable_interview_lookup: config.enable_interview_lookup !== false,
        // Twitter sentiment is disabled by default (costs money)
        enable_twitter_sentiment: config.enable_twitter_sentiment === true,
        // Document search (auto-enabled for legal stories based on query keywords)
        enable_document_search: config.enable_document_search,
        document_types: config.document_types,
        document_location: config.document_location
      })

      // Convert WorkflowResult to ResearchResult
      return convertWorkflowToResearchResult(workflowResult, query)
    } catch (error) {
      console.error('[Research] Enhanced workflow failed, falling back to basic:', error)
      // Fall through to basic workflow
    }
  }

  // Basic workflow (original implementation)
  const youtube = getFreeYouTubeClient()
  const sources: ResearchSource[] = []
  const allTranscripts: string[] = []

  console.log(`[Research] Searching YouTube for: ${query}`)

  // 1. Search YouTube
  const videos = await youtube.search(query, max_videos * 2) // Get extra to filter

  // Filter by views
  const filteredVideos = videos.filter(v => (v.viewCount || 0) >= min_views)
  const topVideos = filteredVideos.slice(0, max_videos)

  console.log(`[Research] Found ${topVideos.length} videos with ${min_views}+ views`)

  // 2. Get transcripts for each video
  for (const video of topVideos) {
    try {
      console.log(`[Research] Fetching transcript for: ${video.title}`)
      const transcript = await youtube.getTranscript(video.id)

      sources.push({
        type: 'youtube',
        title: video.title,
        url: `https://youtube.com/watch?v=${video.id}`,
        channel: video.channelTitle,
        views: video.viewCount,
        published_at: video.publishedAt,
        transcript: transcript?.fullText || undefined,
        snippet: video.description?.substring(0, 500)
      })

      if (transcript?.fullText) {
        allTranscripts.push(`[${video.channelTitle}]: ${transcript.fullText}`)
      }
    } catch (error) {
      console.error(`[Research] Failed to get transcript for ${video.id}:`, error)
      // Still add as source without transcript
      sources.push({
        type: 'youtube',
        title: video.title,
        url: `https://youtube.com/watch?v=${video.id}`,
        channel: video.channelTitle,
        views: video.viewCount,
        published_at: video.publishedAt,
        snippet: video.description?.substring(0, 500)
      })
    }
  }

  // 3. Optionally add web search results
  if (include_web_search) {
    try {
      console.log(`[Research] Adding web search results`)
      const webResults = await searchWeb(query, { max_results: 5 })

      for (const result of webResults) {
        sources.push({
          type: 'web',
          title: result.title,
          url: result.url,
          snippet: result.content
        })
      }
    } catch (error) {
      console.error(`[Research] Web search failed:`, error)
    }
  }

  // 4. Extract key information using LLM
  const analysis = await analyzeResearchSources(query, sources)

  return {
    query,
    sources,
    interviews: [],  // Basic workflow doesn't do interview lookup
    perspectives: analysis.perspectives,
    key_facts: analysis.key_facts,
    conflicting_info: analysis.conflicting_info,
    total_transcript_length: allTranscripts.join(' ').length
  }
}

/**
 * Convert WorkflowResult to ResearchResult format
 */
function convertWorkflowToResearchResult(
  workflow: WorkflowResult,
  query: string
): ResearchResult {
  // Convert workflow sources to ResearchSource format
  const sources: ResearchSource[] = workflow.sources.map(s => ({
    type: 'youtube' as const,
    title: s.title,
    url: s.url,
    channel: s.channel,
    views: s.views,
    published_at: s.published_at,
    transcript: s.transcript,
    transcript_source: s.transcript_source,
    snippet: s.transcript?.substring(0, 500)
  }))

  // Convert interviews to InterviewData format
  const interviews: InterviewData[] = (workflow.interviews || []).map(i => ({
    entity_name: i.entity_name,
    entity_type: i.entity_type,
    video_title: i.title,
    video_url: i.url,
    channel: i.channel,
    transcript: i.transcript,
    from_cache: i.from_cache
  }))

  // Extract perspectives and facts from transcripts
  const perspectives: string[] = []
  const keyFacts: string[] = []
  const conflictingInfo: string[] = []

  // Simple extraction based on query plan if available
  if (workflow.query_plan) {
    if (workflow.query_plan.entities.length > 0) {
      keyFacts.push(`Entities involved: ${workflow.query_plan.entities.map(e => e.name).join(', ')}`)
    }
  }

  // Add stats as facts
  keyFacts.push(`Found ${workflow.videos_found} videos, analyzed ${workflow.videos_filtered}`)
  keyFacts.push(`Transcripts: ${workflow.transcripts_from_youtube} from YouTube, ${workflow.transcripts_from_assemblyai} from AssemblyAI`)

  // Add interview stats if any
  if (workflow.interviews_found > 0) {
    keyFacts.push(`Interviews: ${workflow.interviews_found} found for ${workflow.public_figures_found} public figures (${workflow.interviews_from_cache} from cache)`)
  }

  // Add Twitter stats if any
  if (workflow.twitter_searched && workflow.twitter_tweets_found > 0) {
    keyFacts.push(`Twitter reactions: ${workflow.twitter_tweets_found} tweets from ${workflow.twitter_event_date?.split('T')[0]}`)
    if (workflow.twitter_sentiment) {
      keyFacts.push(`Twitter sentiment: ${workflow.twitter_sentiment.positive}% positive, ${workflow.twitter_sentiment.negative}% negative`)
    }
  }

  // Add document stats if any
  if (workflow.documents_found && workflow.documents_found > 0) {
    keyFacts.push(`Documents found: ${workflow.documents_found} (${workflow.documents_searched} searches)`)
    if (workflow.real_name_found) {
      keyFacts.push('Real name/government name discovered from documents')
    }
  }

  // Convert Twitter data
  const twitterData: TwitterReactionData | undefined = workflow.twitter ? {
    event_date: workflow.twitter.timeframe.event_date.toISOString(),
    sentiment: workflow.twitter.sentiment,
    key_quotes: workflow.twitter.key_quotes,
    tweets_found: workflow.twitter.tweets_found
  } : undefined

  // Calculate total transcript length (including interviews)
  const sourceLength = sources.reduce((sum, s) => sum + (s.transcript?.length || 0), 0)
  const interviewLength = interviews.reduce((sum, i) => sum + (i.transcript?.length || 0), 0)
  const totalLength = sourceLength + interviewLength

  return {
    query,
    sources,
    interviews,
    twitter: twitterData,
    twitter_activity: workflow.twitter_activity,  // Twitter activity analysis (twitter_first mode)
    documents: workflow.documents,  // Court records, paperwork, official documents
    perspectives,
    key_facts: keyFacts,
    conflicting_info: conflictingInfo,
    total_transcript_length: totalLength
  }
}

/**
 * Analyze research sources to extract perspectives and facts
 */
async function analyzeResearchSources(
  query: string,
  sources: ResearchSource[]
): Promise<{
  perspectives: string[]
  key_facts: string[]
  conflicting_info: string[]
}> {
  // Prepare sources text
  const sourcesText = sources
    .filter(s => s.transcript || s.snippet)
    .slice(0, 8) // Limit to avoid token limits
    .map(s => {
      const content = s.transcript?.substring(0, 3000) || s.snippet || ''
      return `[${s.channel || 'Web'}] ${s.title}\n${content}`
    })
    .join('\n\n---\n\n')

  if (!sourcesText) {
    return { perspectives: [], key_facts: [], conflicting_info: [] }
  }

  // Load prompt (with database override support)
  const { loadPrompt } = await import('./prompt-loader')
  const loaded = await loadPrompt({
    prompt_id: 'analyze_research_sources',
    variables: {
      query,
      sources_text: sourcesText,
    },
  })

  console.log(`[story-pipeline] Using ${loaded.source} prompt v${loaded.version} for research analysis`)

  try {
    const response = await callLocalLLM(loaded.filled)
    return JSON.parse(response)
  } catch (error) {
    console.error('[Research] Analysis failed:', error)
    return { perspectives: [], key_facts: [], conflicting_info: [] }
  }
}

// ============================================
// STORY GENERATION (Claude API)
// ============================================

/**
 * Generate a compelling story using Claude API
 */
export async function generateStory(
  research: ResearchResult,
  config: StoryConfig = {}
): Promise<GeneratedStory> {
  const {
    style = 'documentary',
    tone = 'engaging',
    length = 'medium',  // Default to medium length
    include_intro = true,
    include_outro = true,
    host_name = 'Algorithm Institute',
    topic_id,
    chapter_structure,
    opening_template
  } = config

  // Determine target word count - use explicit max_length if set, otherwise use tier
  const lengthTier = STORY_LENGTH_TIERS[length]
  const max_length = config.max_length || lengthTier.word_count
  const chapters = chapter_structure || lengthTier.chapters

  console.log(`[Story] Generating ${length} (${max_length} words) ${style} story with ${chapters.length} chapters`)

  // Build prompt for Claude (now async for entity context injection)
  const prompt = await buildStoryPrompt(research, {
    style,
    tone,
    max_length,
    include_intro,
    include_outro,
    host_name,
    topic_id,
    chapter_structure: chapters,
    opening_template
  })

  console.log(`[Story] Generating ${style} story with Claude...`)

  // Call Claude API
  const story = await callClaudeAPI(prompt)

  // Parse the response
  const wordCount = story.split(/\s+/).length
  const estimatedDuration = Math.ceil(wordCount / 150 * 60) // ~150 words per minute

  return {
    title: extractTitle(story, research.query) || `${research.query} - Full Story`,
    script: story,
    word_count: wordCount,
    estimated_duration_seconds: estimatedDuration,
    sources_cited: research.sources.map(s => s.url)
  }
}

/**
 * Build the story prompt for Claude
 * Now async to support entity context injection
 * Uses chapter-based structure for longer stories
 */
async function buildStoryPrompt(
  research: ResearchResult,
  config: StoryConfig & { chapter_structure?: string[] }
): Promise<string> {
  // === CHANNEL STYLE INJECTION ===
  // Load channel-specific style if requested (e.g., Algorithm Institute style)
  let channelStylePrompt = ''
  if (config.channel_style_file) {
    try {
      const { loadStyleProfile, generateStylePrompt } = await import('./style-analyzer')
      const styleProfile = await loadStyleProfile(config.channel_style_file)

      if (styleProfile) {
        channelStylePrompt = generateStylePrompt(styleProfile)
        console.log(`[Story] Loaded channel style: ${styleProfile.channel_name}`)
      } else {
        console.warn(`[Story] Channel style file not found: ${config.channel_style_file}`)
      }
    } catch (error) {
      console.error('[Story] Failed to load channel style:', error)
      // Continue without style - better to generate something than fail
    }
  }

  // === ENTITY CONTEXT INJECTION ===
  // This prevents hallucinations like saying "Caps was connected to QOTR"
  // when it was actually Debo who owns QOTR
  let entitySection = ''
  let entityContext: EntityContextForPrompt | null = null

  if (config.topic_id) {
    try {
      console.log('[Story] Resolving entity context for prompt injection...')

      // Extract entity names from research
      const entityNames = await extractEntityNames(
        research,
        config.topic_id
      )

      if (entityNames.length > 0) {
        console.log(`[Story] Found ${entityNames.length} entities to resolve: ${entityNames.join(', ')}`)

        // Resolve context from database
        entityContext = await resolveEntityContext(entityNames, config.topic_id)

        if (entityContext.entities.length > 0) {
          entitySection = entityContext.entity_glossary
          console.log(`[Story] Injecting glossary with ${entityContext.entities.length} resolved entities`)
        }

        if (entityContext.unknown_entities.length > 0) {
          console.log(`[Story] Warning: ${entityContext.unknown_entities.length} entities not found: ${entityContext.unknown_entities.join(', ')}`)
        }
      }
    } catch (error) {
      console.error('[Story] Entity context injection failed:', error)
      // Continue without entity context - better to generate something than fail
    }
  }

  // === TWITTER ACTIVITY (PRIMARY SOURCE - if twitter_first mode) ===
  let twitterActivitySection = ''
  if (research.twitter_activity) {
    const activity = research.twitter_activity
    twitterActivitySection = `
=== PRIMARY SOURCE: TWITTER ACTIVITY ===
Analyzed ${activity.tweets_analyzed} tweets from last 72 hours in the ${activity.niche} niche.

THIS IS WHAT'S HAPPENING RIGHT NOW:

TRENDING DISCUSSIONS:
${activity.discussion_topics.slice(0, 5).map(t =>
  `- ${t.topic} (${t.tweet_count} tweets, ${t.engagement_total} engagement)
   Sentiment: ${t.sentiment}
   Key quotes from the community:
   ${t.key_quotes.slice(0, 3).map(q => `   * "${q}"`).join('\n')}
`).join('\n')}

TOP TWEETS (What people are saying):
${activity.trending_tweets.slice(0, 10).map(tweet =>
  `- @${tweet.author_handle}: "${tweet.text}"
   (${tweet.engagement} engagement, ${tweet.timestamp.toLocaleDateString()})
   Context: ${tweet.context}
`).join('\n')}

ENTITIES BEING DISCUSSED:
${activity.entities.slice(0, 10).map(e =>
  `- ${e.name} (${e.type}): ${e.mention_count} mentions, ${e.engagement} engagement
`).join('\n')}

CLAIMS BEING MADE:
${activity.claims.slice(0, 5).map(c =>
  `- "${c.claim_text}" (${c.type})
   Supporting tweets: ${c.supporting_tweets.length}
`).join('\n')}

INSTRUCTION:
1. The story is ABOUT what people are saying on Twitter
2. Use the trending tweets and quotes as PRIMARY content
3. Use YouTube transcripts to VERIFY or provide CONTEXT for what Twitter is discussing
4. Structure the story around what the COMMUNITY is saying/feeling
=== END TWITTER ACTIVITY ===
`
  }

  // Compile research into context
  const factsSection = research.key_facts.length > 0
    ? `KEY FACTS (verified across sources):\n${research.key_facts.map(f => `- ${f}`).join('\n')}`
    : ''

  const perspectivesSection = research.perspectives.length > 0
    ? `DIFFERENT PERSPECTIVES:\n${research.perspectives.map(p => `- ${p}`).join('\n')}`
    : ''

  const conflictsSection = research.conflicting_info.length > 0
    ? `CONFLICTING INFORMATION (note for balance):\n${research.conflicting_info.map(c => `- ${c}`).join('\n')}`
    : ''

  // Get FULL transcripts for longer stories (use excerpts for short)
  const isLongStory = (config.max_length || 800) >= 1500
  const transcriptContent = research.sources
    .filter(s => s.transcript)
    .slice(0, isLongStory ? 8 : 5)
    .map(s => {
      const maxLen = isLongStory ? 5000 : 1500
      const transcript = s.transcript || ''
      return `[${s.channel}] "${transcript.length > maxLen ? transcript.substring(0, maxLen) + '...' : transcript}"`
    })
    .join('\n\n')

  // Include interview transcripts (these are gold - full context about people)
  const interviewContent = research.interviews && research.interviews.length > 0
    ? research.interviews
        .filter(i => i.transcript)
        .map(i => {
          const maxLen = isLongStory ? 8000 : 3000  // Interviews get more space
          const transcript = i.transcript || ''
          return `[INTERVIEW: ${i.entity_name}] (from ${i.channel})\n"${transcript.length > maxLen ? transcript.substring(0, maxLen) + '...' : transcript}"`
        })
        .join('\n\n')
    : ''

  // Include Twitter reactions (real-time sentiment from when it happened)
  const twitterContent = research.twitter && research.twitter.tweets_found > 0
    ? `\n=== TWITTER REACTIONS (${new Date(research.twitter.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}) ===
Community sentiment: ${research.twitter.sentiment.positive}% positive, ${research.twitter.sentiment.negative}% negative

Top reactions:
${research.twitter.key_quotes.map(q => `- ${q}`).join('\n')}
=== END TWITTER ===`
    : ''

  // Include official documents (court records, paperwork, etc.)
  const documentContent = research.documents && research.documents.length > 0
    ? `\n=== OFFICIAL DOCUMENTS & RECORDS ===
These are verified documents found during research. Reference them for factual accuracy on legal matters.

${research.documents.map(d => `[${d.type.toUpperCase()}] ${d.title}
Source: ${d.url}
${d.snippet}
`).join('\n')}
=== END DOCUMENTS ===`
    : ''

  // Include verified claims from Perplexity fact-checking (ACCURACY pillar)
  const verifiedClaimsSection = research.verified_claims && research.verified_claims.length > 0
    ? `\n=== FACT-CHECKED CLAIMS (Verified via Perplexity) ===`
    : ''

  const verifiedClaimsContent = research.verified_claims && research.verified_claims.length > 0
    ? `\n=== FACT-CHECKED CLAIMS FROM TWITTER (Perplexity Verification) ===
These claims were extracted from Twitter discussions and verified against web sources.
USE THESE to ensure accuracy and provide authoritative context.

${research.verified_claims.map((vc) => {
  const statusEmoji = vc.status === 'verified' ? '✓' : vc.status === 'disputed' ? '✗' : '?'
  return `${statusEmoji} CLAIM: "${vc.claim}"
   STATUS: ${vc.status.toUpperCase()}
   VERIFICATION: ${vc.verification}
   SOURCES: ${vc.sources.join(', ')}
`
}).join('\n')}
=== END FACT-CHECKED CLAIMS ===

INSTRUCTION: When these claims appear in the story:
- If VERIFIED: State them confidently with source attribution
- If DISPUTED: Present both sides and note the disagreement
- If INCONCLUSIVE: Acknowledge uncertainty and multiple viewpoints`
    : ''

  // Build the entity context requirement text
  const entityRequirement = entitySection
    ? `9. CRITICAL: Use the ENTITY GLOSSARY above to correctly identify people and their roles. Do NOT assume affiliations or roles not listed in the glossary.`
    : ''

  // Build chapter structure section
  const chapters = config.chapter_structure || ['Hook', 'Main Story', 'Conclusion']
  const chapterDescriptions: Record<string, string> = {
    'Hook': 'Start with a compelling opening that grabs attention immediately.',
    'Background': 'Introduce the key players: who they are, their roles, and why they matter.',
    'Build-up': 'Describe what events led to this moment. Build tension.',
    'The Event': 'Describe what happened in vivid detail. This is the main story.',
    'Main Story': 'The core of what happened, with specific details from sources.',
    'Aftermath': 'Reactions, interviews, consequences. What people said and did after.',
    'Reactions': 'What did the community say? Include quotes from interviews if available.',
    'Conclusion': 'Where things stand now. End with a memorable thought.',
    'Legacy': 'The lasting impact of these events.'
  }

  const chapterInstructions = chapters
    .map((ch, i) => `${i + 1}. ${ch.toUpperCase()}: ${chapterDescriptions[ch] || 'Expand on this section.'}`)
    .join('\n')

  // Custom opening template
  const openingLine = config.opening_template
    ? `BEGIN WITH: "${config.opening_template.replace('{topic}', research.query)}"`
    : 'Begin with "In the world of battle rap..."'

  // Load prompt (with database override support)
  const { loadPrompt } = await import('./prompt-loader')
  const loaded = await loadPrompt({
    prompt_id: 'story_generation',
    variables: {
      host_name: config.host_name,
      style: config.style,
      tone: config.tone,
      query: research.query,
      max_length: String(config.max_length),
      duration_minutes: String(Math.ceil((config.max_length || 800) / 150)),
      entity_glossary: entitySection,
      chapter_instructions: chapterInstructions,
      opening_instruction: openingLine,
      channel_style: channelStylePrompt,
      production_format: config.production_format || 'news_bulletin',
      facts_section: factsSection,
      perspectives_section: perspectivesSection,
      conflicts_section: conflictsSection,
      verified_claims_section: verifiedClaimsSection,
      verified_claims_content: verifiedClaimsContent,
      transcript_content: transcriptContent,
      interview_content: interviewContent || '',
      twitter_content: twitterContent,
      twitter_activity: twitterActivitySection,
      document_content: documentContent,
    },
  })

  console.log(`[story-pipeline] Using ${loaded.source} prompt v${loaded.version} for story generation`)

  return loaded.filled
}

/**
 * Call Claude via Requesty or OpenRouter
 * Uses OpenAI-compatible endpoint
 */
async function callClaudeAPI(prompt: string): Promise<string> {
  // Try Requesty first, then OpenRouter, then local LLM
  const apiKey = REQUESTY_API_KEY || OPENROUTER_API_KEY
  const apiUrl = REQUESTY_API_KEY ? REQUESTY_URL : OPENROUTER_URL

  if (!apiKey) {
    console.log('[Story] No Requesty/OpenRouter API key, falling back to local LLM')
    return callLocalLLM(prompt)
  }

  console.log(`[Story] Using ${REQUESTY_API_KEY ? 'Requesty' : 'OpenRouter'} for Claude`)

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(OPENROUTER_API_KEY && !REQUESTY_API_KEY ? {
        'HTTP-Referer': 'https://talkshowgo.local',
        'X-Title': 'Talk Show Go'
      } : {})
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[Story] Claude API error:', error)
    // Fall back to local LLM
    return callLocalLLM(prompt)
  }

  const data = await response.json()
  // OpenAI-compatible response format
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Call local LLM (Presidium/Ollama) as fallback
 */
async function callLocalLLM(prompt: string): Promise<string> {
  const LLM_ENDPOINT = process.env.PRESIDIUM_URL || 'http://localhost:11434'
  const LLM_MODEL = process.env.DEEP_RESEARCH_MODEL || 'qwen3:14b'

  const response = await fetch(`${LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You are a professional scriptwriter. Write compelling, factual scripts.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  })

  if (!response.ok) {
    throw new Error(`Local LLM error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Extract title from script or generate a descriptive one
 */
function extractTitle(script: string, query?: string): string | null {
  // Look for a title pattern at the start
  const titleMatch = script.match(/^#\s*(.+)|^Title:\s*(.+)/im)
  if (titleMatch) {
    return titleMatch[1] || titleMatch[2]
  }

  // If no title in script, generate from query
  if (query) {
    // Check for vs/versus battles
    const vsMatch = query.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+)/i)
    if (vsMatch) {
      return `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}: The Full Story`
    }

    // Check for allegation/legal stories
    const allegationKeywords = ['snitch', 'paperwork', 'court', 'arrest', 'allegations']
    const hasAllegation = allegationKeywords.some(kw => query.toLowerCase().includes(kw))
    if (hasAllegation) {
      // Extract the person's name (first capitalized word)
      const nameMatch = query.match(/([A-Z][a-zA-Z]+)/)
      if (nameMatch) {
        return `${nameMatch[1]}: The Allegations Explained`
      }
    }

    // Check for interview/response stories
    if (query.toLowerCase().includes('interview') || query.toLowerCase().includes('responds')) {
      const nameMatch = query.match(/([A-Z][a-zA-Z]+)/)
      if (nameMatch) {
        return `${nameMatch[1]} Speaks: Exclusive Breakdown`
      }
    }

    // Default: capitalize and format the query
    return query.split(' ')
      .filter(w => w.length > 2)
      .slice(0, 4)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ') + ': The Story'
  }

  return null
}

// ============================================
// FULL PIPELINE
// ============================================

/**
 * Run the complete story pipeline
 * Automatically loads niche settings from database if topic_id is provided
 */
export async function runStoryPipeline(config: {
  query: string
  topic_id?: string
  research_options?: Partial<ResearchConfig>
  story_options?: StoryConfig
  generate_package?: boolean  // Generate and save ResearchPackage
}): Promise<StoryPipelineResult> {
  const pipelineId = `pipeline_${Date.now()}`
  console.log(`[Pipeline] Starting ${pipelineId} for: ${config.query}`)

  // Load niche settings if topic_id is provided
  let nicheSettings = null
  if (config.topic_id) {
    try {
      nicheSettings = await getNicheSettings(config.topic_id)
      console.log(`[Pipeline] Loaded niche settings: ${nicheSettings.name}`)
    } catch (error) {
      console.warn('[Pipeline] Could not load niche settings, using defaults')
    }
  }

  // Apply niche settings to research options
  const researchOptions: Partial<ResearchConfig> = {
    use_enhanced_workflow: true,  // Always use enhanced workflow
    enable_interview_lookup: true,
    topic_context: nicheSettings?.name || 'battle rap',
    ...config.research_options
  }

  // 1. Research Phase
  console.log('[Pipeline] Phase 1: Research')
  const research = await researchTopic({
    query: config.query,
    topic_id: config.topic_id,
    ...researchOptions
  })

  console.log(`[Pipeline] Found ${research.sources.length} sources, ${research.interviews.length} interviews, ${research.key_facts.length} facts`)

  // Apply niche settings to story options
  const storyConfig = nicheSettings ? getStoryConfig(nicheSettings, config.story_options?.length) : null
  const storyOptions: StoryConfig = {
    length: storyConfig?.default_length || 'medium',
    opening_template: storyConfig?.opening_template,
    chapter_structure: storyConfig?.chapters,
    ...config.story_options,
    topic_id: config.topic_id  // Pass topic_id for entity context injection
  }

  // 2. Story Generation Phase
  console.log('[Pipeline] Phase 2: Story Generation')
  const story = await generateStory(research, storyOptions)

  console.log(`[Pipeline] Generated ${story.word_count} word story (~${Math.ceil(story.estimated_duration_seconds / 60)} min)`)

  // 3. Save to database (optional)
  if (config.topic_id) {
    try {
      await supabase.from('story_candidates').insert({
        topic_id: config.topic_id,
        bucket: 'feature',
        headline: story.title,
        summary: story.script.substring(0, 500),
        evidence_package: {
          research: {
            query: research.query,
            sources_count: research.sources.length,
            key_facts: research.key_facts,
            perspectives: research.perspectives
          },
          story: {
            word_count: story.word_count,
            duration_seconds: story.estimated_duration_seconds
          },
        },
        status: 'candidate'
      })
    } catch (error) {
      console.error('[Pipeline] Database save failed:', error)
    }
  }

  // 5. Generate Research Package (optional)
  let researchPackageId: string | undefined
  let researchPackageUrls: StoryPipelineResult['research_package_urls']

  if (config.generate_package) {
    console.log('[Pipeline] Phase 5: Generating Research Package')
    try {
      const { assembleResearchPackage, saveResearchPackage } = await import('./research-package')

      // Build a minimal WorkflowResult from ResearchResult
      const workflowResult = {
        run_id: pipelineId,
        query: research.query,
        query_plan: undefined,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        videos_found: research.sources.length,
        videos_filtered: research.sources.length,
        transcripts_from_youtube: research.sources.filter(s => s.transcript_source === 'youtube_captions').length,
        transcripts_from_assemblyai: research.sources.filter(s => s.transcript_source === 'assemblyai').length,
        transcripts_failed: 0,
        entities_identified: 0,
        public_figures_found: 0,
        interviews_searched: research.interviews.length,
        interviews_found: research.interviews.length,
        interviews_from_cache: research.interviews.filter(i => i.from_cache).length,
        interviews_cost_cents: 0,
        twitter_searched: !!research.twitter,
        twitter_event_date: research.twitter?.event_date,
        twitter_tweets_found: research.twitter?.tweets_found || 0,
        twitter_sentiment: research.twitter?.sentiment,
        twitter_cost_cents: 0,
        entities_enriched: 0,
        documents_searched: !!research.documents,
        documents_found: research.documents?.length || 0,
        sources: research.sources.map(s => ({
          video_id: s.url.split('v=')[1] || '',
          title: s.title,
          channel: s.channel || '',
          url: s.url,
          views: s.views,
          published_at: s.published_at,
          transcript: s.transcript,
          transcript_source: s.transcript_source,
        })),
        interviews: research.interviews.map(i => ({
          entity_name: i.entity_name,
          entity_type: i.entity_type,
          video_id: i.video_url.split('v=')[1] || '',
          title: i.video_title,
          channel: i.channel,
          url: i.video_url,
          duration_seconds: 0,
          transcript: i.transcript,
          from_cache: i.from_cache,
          cost_cents: 0,
        })),
        documents: research.documents,
        verified_claims: research.verified_claims,
        research_mode: config.research_options?.research_mode || 'youtube_first',
        errors: []
      } as WorkflowResult

      const pkg = await assembleResearchPackage(workflowResult, {
        topic_id: config.topic_id,
        include_transcripts: true,
        generate_producer_materials: true,
        generate_host_materials: true,
      })

      const saveResult = await saveResearchPackage(pkg)
      if (saveResult.success) {
        researchPackageId = pkg.metadata.package_id
        researchPackageUrls = {
          json: `/api/research-package/${researchPackageId}?format=json`,
          markdown: `/api/research-package/${researchPackageId}?format=markdown`
        }
        console.log(`[Pipeline] Research package saved: ${researchPackageId}`)
      }
    } catch (error) {
      console.error('[Pipeline] Research package generation failed:', error)
    }
  }

  return {
    research,
    story,
    pipeline_id: pipelineId,
    created_at: new Date().toISOString(),
    research_package_id: researchPackageId,
    research_package_urls: researchPackageUrls
  }
}

// ============================================
// DAILY NEWS SHOW WORKFLOW
// ============================================

export interface DailyShowConfig {
  topic_id: string
  show_name?: string
  host_name?: string
  stories_count?: number
  hours_back?: number
  production_format?: string
  channel_style_file?: string
}

export interface DailyShowResult {
  show_date: string
  show_name: string
  intro_script: string
  stories: Array<{
    headline: string
    script: string
    duration_seconds: number
  }>
  outro_script: string
  total_duration_seconds: number
  audio_segments?: string[]
}

/**
 * Generate a daily news show with multiple stories
 */
export async function generateDailyShow(config: DailyShowConfig): Promise<DailyShowResult> {
  const {
    topic_id,
    show_name = 'Battle Rap Daily',
    host_name = 'Algorithm Institute',
    stories_count = 5,  // Changed from 3 to 5 for 15-20 minute shows
    hours_back = 24,
    production_format,
    channel_style_file
  } = config

  console.log(`[DailyShow] Generating ${show_name} with ${stories_count} stories (target: 15-20 minutes)`)
  console.log(`[DailyShow] Using TWITTER-FIRST mode - Twitter is PRIMARY intelligence source`)

  // 1. Try to get trending topics from Twitter intelligence first
  let storyTopics: string[] = []

  try {
    const { analyzeTwitterActivity } = await import('./twitter-intelligence')
    console.log(`[DailyShow] Analyzing Twitter activity for topic_id=${topic_id}`)

    const twitterActivity = await analyzeTwitterActivity(topic_id, {
      hoursBack: hours_back,
      minEngagement: 10,
      maxTweets: 200
    })

    // Use top discussion topics from Twitter as story topics
    storyTopics = twitterActivity.discussion_topics
      .sort((a, b) => b.engagement_total - a.engagement_total)
      .slice(0, stories_count)
      .map(t => t.topic)

    console.log(`[DailyShow] Found ${storyTopics.length} trending topics from Twitter`)

  } catch (error) {
    console.warn('[DailyShow] Twitter intelligence failed, falling back to story_candidates:', error)

    // Fallback 1: Get recent stories from story_candidates
    const { data: recentStories } = await supabase
      .from('story_candidates')
      .select('*')
      .eq('topic_id', topic_id)
      .gte('created_at', new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString())
      .order('engagement_total', { ascending: false })
      .limit(stories_count)

    if (recentStories && recentStories.length > 0) {
      storyTopics = recentStories.map(s => s.headline || s.summary?.substring(0, 50))
    } else {
      // Fallback 2: Search YouTube for trending topics
      console.log('[DailyShow] No recent stories, searching YouTube for trending topics')
      const youtube = getFreeYouTubeClient()
      const recentVideos = await youtube.search('trending news today', 10)

      storyTopics = recentVideos
        .slice(0, stories_count)
        .map(v => v.title)
    }
  }

  // 3. Generate intro
  const introScript = await generateShowIntro(show_name, host_name, storyTopics)

  // 4. Generate each story segment
  const stories: DailyShowResult['stories'] = []

  for (const topic of storyTopics.slice(0, stories_count)) {
    try {
      console.log(`[DailyShow] Generating story: ${topic}`)
      const pipeline = await runStoryPipeline({
        query: topic,
        topic_id,
        research_options: {
          research_mode: 'twitter_first',  // Use Twitter as PRIMARY intelligence source
          use_enhanced_workflow: true,     // Enable full research workflow
          max_videos: 8                     // YouTube for context/verification
        },
        story_options: {
          style: 'news',
          tone: 'engaging',
          max_length: 650,  // Increased from 400 to 650 for more substantial stories (3-4 min each)
          include_intro: false,
          include_outro: false,
          host_name,
          production_format,
          channel_style_file
        }
      })

      stories.push({
        headline: pipeline.story.title,
        script: pipeline.story.script,
        duration_seconds: pipeline.story.estimated_duration_seconds
      })
    } catch (error) {
      console.error(`[DailyShow] Failed to generate story for ${topic}:`, error)
    }
  }

  // 5. Generate outro
  const outroScript = await generateShowOutro(show_name, host_name)

  // 6. Calculate total duration
  const totalDuration = stories.reduce((sum, s) => sum + s.duration_seconds, 0)
    + 30 // Intro
    + 20 // Outro

  return {
    show_date: new Date().toISOString().split('T')[0],
    show_name,
    intro_script: introScript,
    stories,
    outro_script: outroScript,
    total_duration_seconds: totalDuration
  }
}

async function generateShowIntro(
  showName: string,
  hostName: string,
  topics: string[]
): Promise<string> {
  const { loadPrompt } = await import('./prompt-loader')
  const loaded = await loadPrompt({
    prompt_id: 'show_intro',
    variables: {
      show_name: showName,
      host_name: hostName,
      story_list: topics.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    },
  })

  console.log(`[story-pipeline] Using ${loaded.source} prompt v${loaded.version} for show intro`)

  return callClaudeAPI(loaded.filled)
}

async function generateShowOutro(
  showName: string,
  hostName: string
): Promise<string> {
  const { loadPrompt } = await import('./prompt-loader')
  const loaded = await loadPrompt({
    prompt_id: 'show_outro',
    variables: {
      show_name: showName,
      host_name: hostName,
    },
  })

  console.log(`[story-pipeline] Using ${loaded.source} prompt v${loaded.version} for show outro`)

  return callClaudeAPI(loaded.filled)
}

// ============================================
// EXPORTS
// ============================================

export {
  callClaudeAPI,
  callLocalLLM
}
