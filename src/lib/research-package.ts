/**
 * Research Package Assembly
 *
 * Converts raw research data into a well-organized ResearchPackage
 * that can be consumed by AI, producers, and external tools.
 */

import { v4 as uuidv4 } from 'uuid'
import { supabase } from './db'
import type {
  ResearchPackage,
  PackageMetadata,
  PackageStats,
  RawSources,
  YouTubeSourceItem,
  TweetSourceItem,
  CommentSourceItem,
  WebDocumentItem,
  ProcessedIntelligence,
  ProcessedEntity,
  ProcessedClaim,
  ProducerMaterials,
  StorySummary,
  KeyFact,
  QuoteItem,
  ProducerWarning,
  HostMaterials,
  ScriptOutline,
  TalkingPoint,
  PronunciationEntry,
  InterviewData,
  InterviewItem,
  TwitterData,
} from '@/types/research-package'
import type { WorkflowResult, ResearchSource, InterviewSource } from './research-workflow'
import type { EntityContext } from '@/types/entity-context'

export interface AssembleOptions {
  topic_id?: string
  story_candidate_id?: string
  include_transcripts?: boolean
  transcript_limit?: number
  generate_producer_materials?: boolean
  generate_host_materials?: boolean
}

/**
 * Assemble a complete ResearchPackage from a WorkflowResult
 */
export async function assembleResearchPackage(
  result: WorkflowResult,
  options: AssembleOptions = {}
): Promise<ResearchPackage> {
  const {
    include_transcripts = true,
    transcript_limit = 10000,
    generate_producer_materials = true,
    generate_host_materials = true,
  } = options

  const package_id = uuidv4()
  const generated_at = new Date().toISOString()

  // Convert sources to YouTube items
  const youtube_videos = convertSourcesToYouTube(
    result.sources,
    include_transcripts,
    transcript_limit
  )

  // Convert Twitter data
  const tweets = convertTwitterToTweets(result.twitter ? {
    tweets: result.twitter.top_reactions.map(r => ({
      id: '',
      text: r.text,
      author: r.author,
      metrics: { likes: r.likes, retweets: r.retweets },
      sentiment: r.sentiment
    }))
  } : undefined)

  // Get comments from database if we have video IDs
  const comments = await fetchComments(result.sources.map(s => s.video_id))

  // Convert documents
  const web_documents = convertDocuments(result.documents || [])

  // Fetch entities from database
  const entities = await fetchEntities(result.sources, result.interviews)

  // Fetch claims from database if we have a topic
  const claims = options.topic_id
    ? await fetchClaims(options.topic_id)
    : []

  // Build raw sources
  const raw_sources: RawSources = {
    youtube_videos,
    tweets,
    comments,
    web_documents,
  }

  // Build processed intelligence
  const intelligence: ProcessedIntelligence = {
    entities,
    claims,
    event_timeline: buildTimeline(result),
    consensus_summary: buildConsensusSummary(result.twitter, tweets),
  }

  // Build interviews
  const interviews = convertInterviews(
    result.interviews,
    include_transcripts,
    transcript_limit
  )

  // Build Twitter data
  const twitter = result.twitter
    ? buildTwitterData(result, tweets)
    : undefined

  // Build producer materials
  const producer: ProducerMaterials = generate_producer_materials
    ? buildProducerMaterials(result, entities, claims, youtube_videos)
    : getEmptyProducerMaterials()

  // Build host materials
  const host: HostMaterials = generate_host_materials
    ? buildHostMaterials(result, entities, producer)
    : getEmptyHostMaterials()

  // Calculate stats
  const stats = calculateStats(raw_sources, intelligence, interviews, result)

  // Build metadata
  const metadata: PackageMetadata = {
    package_id,
    version: '1.0',
    generated_at,
    generated_by: 'system',
    topic_id: options.topic_id,
    story_candidate_id: options.story_candidate_id,
    research_run_id: result.run_id,
    original_query: result.query,
    interpreted_query: result.query_plan?.interpreted_as,
    stats,
  }

  return {
    metadata,
    raw_sources,
    intelligence,
    producer,
    host,
    interviews,
    twitter,
    export_formats_available: ['json', 'markdown'],
  }
}

/**
 * Save a research package to the database
 */
export async function saveResearchPackage(
  pkg: ResearchPackage
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('research_packages').insert({
      id: pkg.metadata.package_id,
      topic_id: pkg.metadata.topic_id,
      story_candidate_id: pkg.metadata.story_candidate_id,
      research_run_id: pkg.metadata.research_run_id,
      query: pkg.metadata.original_query,
      interpreted_query: pkg.metadata.interpreted_query,
      package_json: pkg,
      stats: pkg.metadata.stats,
      headline: pkg.producer.story_summary.headline,
      story_type: pkg.producer.story_summary.story_type,
      version: pkg.metadata.version,
      generated_by: pkg.metadata.generated_by,
      status: 'complete',
    })

    if (error) {
      console.error('[ResearchPackage] Save error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[ResearchPackage] Save exception:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Load a research package from the database
 */
export async function loadResearchPackage(
  id: string
): Promise<ResearchPackage | null> {
  const { data, error } = await supabase
    .from('research_packages')
    .select('package_json')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data.package_json as ResearchPackage
}

/**
 * Load packages for a topic
 */
export async function loadPackagesForTopic(
  topic_id: string,
  limit: number = 10
): Promise<ResearchPackage[]> {
  const { data, error } = await supabase
    .from('research_packages')
    .select('package_json')
    .eq('topic_id', topic_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return []
  }

  return data.map(row => row.package_json as ResearchPackage)
}

// ========== CONVERSION HELPERS ==========

function convertSourcesToYouTube(
  sources: ResearchSource[],
  includeTranscripts: boolean,
  transcriptLimit: number
): YouTubeSourceItem[] {
  return sources.map(source => ({
    video_id: source.video_id,
    title: source.title,
    channel: source.channel,
    url: source.url,
    published_at: source.published_at,
    duration_seconds: source.duration_seconds,
    view_count: source.views,

    has_transcript: !!source.transcript,
    transcript_source: source.transcript_source,
    transcript_confidence: source.transcript_confidence,
    transcript_text: includeTranscripts
      ? truncateText(source.transcript, transcriptLimit)
      : undefined,
    transcript_word_count: source.transcript
      ? countWords(source.transcript)
      : undefined,

    relevance_score: source.relevance_score,
    is_interview: false,
    is_primary_source: false,
  }))
}

function convertTwitterToTweets(
  twitter?: { tweets?: Array<{ id: string; text: string; author: string; metrics?: { likes?: number; retweets?: number; replies?: number }; sentiment?: string }> }
): TweetSourceItem[] {
  if (!twitter?.tweets) return []

  return twitter.tweets.map(tweet => ({
    tweet_id: tweet.id,
    text: tweet.text,
    author_handle: tweet.author,
    created_at: new Date().toISOString(), // Not always available
    likes: tweet.metrics?.likes || 0,
    retweets: tweet.metrics?.retweets || 0,
    replies: tweet.metrics?.replies || 0,
    tweet_type: 'original' as const,
    sentiment: (tweet.sentiment as 'positive' | 'negative' | 'neutral' | 'mixed') || 'neutral',
  }))
}

async function fetchComments(videoIds: string[]): Promise<CommentSourceItem[]> {
  if (videoIds.length === 0) return []

  const { data, error } = await supabase
    .from('youtube_comments')
    .select('*')
    .in('video_id', videoIds)
    .order('likes', { ascending: false })
    .limit(50)

  if (error || !data) return []

  return data.map(comment => ({
    comment_id: comment.id,
    video_id: comment.video_id,
    video_title: '', // Would need join
    text: comment.text,
    author: comment.author,
    likes: comment.likes || 0,
    reply_count: comment.reply_count || 0,
    published_at: comment.published_at || comment.created_at,
    is_top_comment: (comment.likes || 0) > 100,
    consensus_indicator: (comment.likes || 0) > 500,
  }))
}

function convertDocuments(
  documents: Array<{ type: string; title: string; url: string; snippet: string; relevance_score: number }>
): WebDocumentItem[] {
  return documents.map(doc => ({
    url: doc.url,
    title: doc.title,
    domain: extractDomain(doc.url),
    fetched_at: new Date().toISOString(),
    snippet: doc.snippet,
    document_type: doc.type as WebDocumentItem['document_type'],
    relevance_score: doc.relevance_score,
    is_primary_source: doc.type === 'court_record' || doc.type === 'official_document',
  }))
}

async function fetchEntities(
  sources: ResearchSource[],
  interviews: InterviewSource[]
): Promise<ProcessedEntity[]> {
  // Get entity names from interviews
  const interviewEntityNames = interviews.map(i => i.entity_name)

  // Fetch entities mentioned in content
  const { data, error } = await supabase
    .from('entities')
    .select('id, canonical_name, entity_type, metadata')
    .in('canonical_name', interviewEntityNames)
    .limit(50)

  if (error || !data) {
    // Return basic entities from interviews
    return interviews.map(interview => ({
      id: interview.entity_id || uuidv4(),
      name: interview.entity_name,
      type: interview.entity_type,
      mention_count: 1,
      mention_sources: [interview.video_id],
    }))
  }

  return data.map(entity => {
    const metadata = entity.metadata as EntityContext || {}
    const interview = interviews.find(i => i.entity_name === entity.canonical_name)

    return {
      id: entity.id,
      name: entity.canonical_name,
      aliases: (metadata as any).aliases,
      type: entity.entity_type,
      role: metadata.role,
      sub_roles: metadata.sub_roles,
      gender: metadata.gender,
      gender_needs_review: metadata.gender_needs_review,
      gender_review_reason: metadata.gender_review_reason,
      affiliations: metadata.affiliations,
      is_primary_source: metadata.is_primary_source,
      is_commentator: metadata.is_commentator,
      bias_indicators: metadata.bias_indicators,
      mention_count: 1,
      mention_sources: interview ? [interview.video_id] : [],
      enrichment_status: metadata.enrichment_status,
    }
  })
}

async function fetchClaims(topic_id: string): Promise<ProcessedClaim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('topic_id', topic_id)
    .limit(20)

  if (error || !data) return []

  return data.map(claim => ({
    id: claim.id,
    claim_text: claim.claim_text,
    claim_type: claim.claim_type || 'factual',
    verdict: claim.verdict,
    confidence_score: claim.confidence_score || 0.5,
    evidence_for: [],
    evidence_against: [],
    first_seen_source: claim.first_source || '',
    source_count: claim.source_count || 1,
    engagement_total: claim.engagement_total || 0,
  }))
}

function convertInterviews(
  interviews: InterviewSource[],
  includeTranscripts: boolean,
  transcriptLimit: number
): InterviewData {
  const items: InterviewItem[] = interviews.map(interview => ({
    entity_name: interview.entity_name,
    entity_type: interview.entity_type,
    video_id: interview.video_id,
    video_title: interview.title,
    channel: interview.channel,
    url: interview.url,
    duration_seconds: interview.duration_seconds,
    has_transcript: !!interview.transcript,
    transcript_source: interview.transcript_source,
    transcript_text: includeTranscripts
      ? truncateText(interview.transcript, transcriptLimit)
      : undefined,
    from_cache: interview.from_cache,
    cost_cents: interview.cost_cents,
  }))

  const totalMinutes = items.reduce((sum, i) => sum + (i.duration_seconds / 60), 0)

  return {
    interviews: items,
    total_interview_minutes: Math.round(totalMinutes),
  }
}

function buildTwitterData(
  result: WorkflowResult,
  tweets: TweetSourceItem[]
): TwitterData | undefined {
  if (!result.twitter) return undefined

  return {
    event_timeframe: {
      event_date: result.twitter_event_date || new Date().toISOString(),
      confidence: 'medium',
      source: 'auto-detected',
    },
    search_query: result.query,
    tweets_found: result.twitter_tweets_found,
    sentiment: result.twitter_sentiment || { positive: 0, negative: 0, neutral: 0 },
    top_reactions: tweets.slice(0, 10),
    key_quotes: tweets.slice(0, 5).map(t => t.text),
    cost_cents: result.twitter_cost_cents,
  }
}

function buildTimeline(result: WorkflowResult): undefined {
  // Timeline building would require more complex processing
  // Returning undefined for now, can be enhanced later
  return undefined
}

function buildConsensusSummary(
  twitter: WorkflowResult['twitter'],
  tweets: TweetSourceItem[]
): undefined {
  // Consensus summary would require LLM processing
  // Returning undefined for now, can be enhanced later
  return undefined
}

// ========== PRODUCER MATERIALS ==========

function buildProducerMaterials(
  result: WorkflowResult,
  entities: ProcessedEntity[],
  claims: ProcessedClaim[],
  videos: YouTubeSourceItem[]
): ProducerMaterials {
  // Build story summary
  const story_summary: StorySummary = {
    headline: generateHeadline(result.query, entities),
    one_liner: `Research on: ${result.query}`,
    full_summary: generateSummary(result, entities),
    story_type: detectStoryType(result.query),
    estimated_interest_level: estimateInterestLevel(result),
    timeliness: detectTimeliness(result),
  }

  // Extract key facts from transcripts
  const key_facts = extractKeyFacts(videos, claims)

  // Extract usable quotes
  const quotes_to_use = extractQuotes(videos, result.interviews)

  // Generate warnings
  const warnings = generateWarnings(entities, claims, result)

  // Suggest angles
  const suggested_angles = suggestAngles(result, entities)

  // Identify research gaps
  const research_gaps = identifyGaps(result, entities)

  return {
    story_summary,
    key_facts,
    quotes_to_use,
    warnings,
    suggested_angles,
    research_gaps,
  }
}

function getEmptyProducerMaterials(): ProducerMaterials {
  return {
    story_summary: {
      headline: '',
      one_liner: '',
      full_summary: '',
      story_type: 'other',
      estimated_interest_level: 'medium',
      timeliness: 'background',
    },
    key_facts: [],
    quotes_to_use: [],
    warnings: [],
    suggested_angles: [],
    research_gaps: [],
  }
}

function generateHeadline(query: string, entities: ProcessedEntity[]): string {
  const entityNames = entities.slice(0, 2).map(e => e.name).join(' and ')
  if (entityNames) {
    return `${entityNames}: ${query}`
  }
  return query
}

function generateSummary(result: WorkflowResult, entities: ProcessedEntity[]): string {
  const lines = []

  lines.push(`Research conducted on "${result.query}".`)

  if (result.sources.length > 0) {
    lines.push(`Found ${result.sources.length} relevant videos with ${result.transcripts_from_youtube + result.transcripts_from_assemblyai} transcripts.`)
  }

  if (result.interviews.length > 0) {
    lines.push(`Located ${result.interviews.length} direct interviews with key figures.`)
  }

  if (entities.length > 0) {
    const entityList = entities.slice(0, 5).map(e => e.name).join(', ')
    lines.push(`Key entities involved: ${entityList}.`)
  }

  if (result.twitter_searched && result.twitter_tweets_found > 0) {
    lines.push(`Twitter analysis found ${result.twitter_tweets_found} relevant reactions.`)
  }

  return lines.join(' ')
}

function detectStoryType(query: string): StorySummary['story_type'] {
  const q = query.toLowerCase()
  if (q.includes(' vs ') || q.includes(' versus ')) return 'battle'
  if (q.includes('beef') || q.includes('responds') || q.includes('shots')) return 'beef'
  if (q.includes('interview') || q.includes('speaks')) return 'interview'
  if (q.includes('announce') || q.includes('confirm')) return 'announcement'
  if (q.includes('snitch') || q.includes('allegation') || q.includes('court') || q.includes('arrest')) return 'allegation'
  return 'other'
}

function estimateInterestLevel(result: WorkflowResult): 'high' | 'medium' | 'low' {
  const totalViews = result.sources.reduce((sum, s) => sum + (s.views || 0), 0)
  if (totalViews > 1000000) return 'high'
  if (totalViews > 100000) return 'medium'
  return 'low'
}

function detectTimeliness(result: WorkflowResult): StorySummary['timeliness'] {
  // Check if any sources are very recent
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  for (const source of result.sources) {
    if (source.published_at) {
      const pubDate = new Date(source.published_at)
      if (pubDate > dayAgo) return 'breaking'
      if (pubDate > weekAgo) return 'developing'
    }
  }

  return 'background'
}

function extractKeyFacts(
  videos: YouTubeSourceItem[],
  claims: ProcessedClaim[]
): KeyFact[] {
  // Extract facts from claims
  return claims.slice(0, 10).map(claim => ({
    fact: claim.claim_text,
    source_count: claim.source_count,
    confidence: claim.verdict === 'confirmed' ? 'confirmed' :
                claim.verdict === 'likely' ? 'likely' : 'unverified',
    primary_source: claim.first_seen_source,
  }))
}

function extractQuotes(
  videos: YouTubeSourceItem[],
  interviews: InterviewSource[]
): QuoteItem[] {
  const quotes: QuoteItem[] = []

  // Extract quotes from interview transcripts
  for (const interview of interviews.slice(0, 5)) {
    if (interview.transcript) {
      // Simple quote extraction - look for quoted text or strong statements
      const text = interview.transcript.slice(0, 2000)
      quotes.push({
        quote: text.slice(0, 200) + '...',
        speaker: interview.entity_name,
        speaker_role: interview.entity_type,
        source_type: 'interview',
        source_title: interview.title,
        source_url: interview.url,
        recommended_use: 'Direct quote from subject',
      })
    }
  }

  return quotes
}

function generateWarnings(
  entities: ProcessedEntity[],
  claims: ProcessedClaim[],
  result: WorkflowResult
): ProducerWarning[] {
  const warnings: ProducerWarning[] = []

  // Check for unverified claims
  const unverifiedClaims = claims.filter(c => c.verdict === 'uncertain' || c.verdict === 'disputed')
  if (unverifiedClaims.length > 0) {
    warnings.push({
      type: 'unverified_claim',
      severity: 'high',
      message: `${unverifiedClaims.length} claims could not be verified`,
      affected_items: unverifiedClaims.map(c => c.id),
      recommendation: 'Present as allegations or unconfirmed reports',
    })
  }

  // Check for gender review needed
  const genderReview = entities.filter(e => e.gender_needs_review)
  if (genderReview.length > 0) {
    warnings.push({
      type: 'gender_unverified',
      severity: 'medium',
      message: `Gender needs verification for: ${genderReview.map(e => e.name).join(', ')}`,
      affected_items: genderReview.map(e => e.id),
      recommendation: 'Verify gender before using gendered pronouns',
    })
  }

  // Check for legal content
  if (result.documents_searched && result.documents_found > 0) {
    warnings.push({
      type: 'legal_risk',
      severity: 'high',
      message: 'Story involves legal allegations - verify all claims before publishing',
      recommendation: 'Have legal review before publishing',
    })
  }

  // Check for missing transcripts
  const missingTranscripts = result.transcripts_failed
  if (missingTranscripts > 0) {
    warnings.push({
      type: 'missing_context',
      severity: 'low',
      message: `${missingTranscripts} videos could not be transcribed`,
      recommendation: 'Some context may be missing from research',
    })
  }

  return warnings
}

function suggestAngles(result: WorkflowResult, entities: ProcessedEntity[]): string[] {
  const angles: string[] = []

  // Suggest based on content found
  if (result.interviews.length > 0) {
    angles.push('Direct interview perspective - let the subject tell their story')
  }

  if (result.documents_found > 0) {
    angles.push('Investigative angle - focus on documents and evidence')
  }

  if (result.twitter_searched && result.twitter_sentiment) {
    const { positive, negative } = result.twitter_sentiment
    if (negative > positive) {
      angles.push('Community backlash angle - explore negative reaction')
    } else if (positive > negative) {
      angles.push('Community support angle - explore positive reception')
    } else {
      angles.push('Balanced perspective - show both sides of community reaction')
    }
  }

  const commentators = entities.filter(e => e.is_commentator)
  if (commentators.length >= 2) {
    angles.push('Panel discussion - multiple commentator perspectives')
  }

  return angles
}

function identifyGaps(result: WorkflowResult, entities: ProcessedEntity[]): string[] {
  const gaps: string[] = []

  // Check for missing interviews
  const primarySources = entities.filter(e => e.is_primary_source)
  const interviewedEntities = result.interviews.map(i => i.entity_name)
  const missingInterviews = primarySources.filter(
    e => !interviewedEntities.includes(e.name)
  )

  if (missingInterviews.length > 0) {
    gaps.push(`No interview found for: ${missingInterviews.map(e => e.name).join(', ')}`)
  }

  // Check for missing Twitter data
  if (!result.twitter_searched) {
    gaps.push('Twitter reactions not searched - community sentiment unknown')
  }

  // Check for low transcript count
  if (result.transcripts_from_youtube + result.transcripts_from_assemblyai < 3) {
    gaps.push('Limited transcript data - consider additional research')
  }

  return gaps
}

// ========== HOST MATERIALS ==========

function buildHostMaterials(
  result: WorkflowResult,
  entities: ProcessedEntity[],
  producer: ProducerMaterials
): HostMaterials {
  const script_outline = buildScriptOutline(result, producer)
  const talking_points = buildTalkingPoints(producer)
  const pronunciation_guide = buildPronunciationGuide(entities)
  const entity_glossary = buildEntityGlossary(entities)

  return {
    script_outline,
    talking_points,
    pronunciation_guide,
    entity_glossary,
  }
}

function getEmptyHostMaterials(): HostMaterials {
  return {
    script_outline: {
      title: '',
      estimated_duration_minutes: 0,
      sections: [],
    },
    talking_points: [],
    pronunciation_guide: [],
    entity_glossary: '',
  }
}

function buildScriptOutline(
  result: WorkflowResult,
  producer: ProducerMaterials
): ScriptOutline {
  const sections = [
    {
      name: 'Hook',
      purpose: 'Grab attention with the key revelation or conflict',
      suggested_content: producer.story_summary.one_liner,
      key_points: [producer.key_facts[0]?.fact || 'Opening hook'],
      estimated_duration_seconds: 30,
    },
    {
      name: 'Background',
      purpose: 'Provide context for viewers unfamiliar with the story',
      suggested_content: 'Set the scene and introduce key players',
      key_points: producer.key_facts.slice(0, 3).map(f => f.fact),
      estimated_duration_seconds: 60,
    },
    {
      name: 'Main Story',
      purpose: 'Present the core narrative with evidence',
      suggested_content: producer.story_summary.full_summary,
      key_points: producer.key_facts.slice(3, 7).map(f => f.fact),
      quotes_to_include: producer.quotes_to_use.slice(0, 2).map(q => q.quote),
      estimated_duration_seconds: 180,
    },
    {
      name: 'Reaction',
      purpose: 'Show community response and different perspectives',
      suggested_content: 'Present Twitter reactions and commentator takes',
      key_points: producer.suggested_angles,
      estimated_duration_seconds: 60,
    },
    {
      name: 'Conclusion',
      purpose: 'Summarize and tease future developments',
      suggested_content: 'Wrap up with key takeaways',
      key_points: ['Summarize main points', 'Note what to watch for'],
      estimated_duration_seconds: 30,
    },
  ]

  const totalSeconds = sections.reduce((sum, s) => sum + s.estimated_duration_seconds, 0)

  return {
    title: producer.story_summary.headline,
    estimated_duration_minutes: Math.ceil(totalSeconds / 60),
    sections,
  }
}

function buildTalkingPoints(producer: ProducerMaterials): TalkingPoint[] {
  return producer.key_facts.map(fact => ({
    point: fact.fact,
    supporting_facts: fact.contradictions || [],
    source_reference: fact.primary_source || 'Multiple sources',
    can_be_cut: fact.confidence === 'unverified',
  }))
}

function buildPronunciationGuide(entities: ProcessedEntity[]): PronunciationEntry[] {
  // Basic pronunciation guide - in production, this could use a pronunciation API
  return entities
    .filter(e => e.name.includes(' ') || e.name.length > 10)
    .map(e => ({
      term: e.name,
      pronunciation: e.name, // Would need actual phonetic data
      notes: e.role || undefined,
    }))
}

function buildEntityGlossary(entities: ProcessedEntity[]): string {
  const lines = ['## Entity Glossary', '']

  for (const entity of entities) {
    let line = `**${entity.name}**`
    if (entity.aliases?.length) {
      line += ` (aka ${entity.aliases.join(', ')})`
    }
    line += ': '

    const details = []
    if (entity.role) details.push(entity.role)
    if (entity.type) details.push(entity.type)
    if (entity.affiliations?.length) {
      details.push(entity.affiliations.map(a => a.name).join(', '))
    }

    line += details.join(' | ')

    if (entity.gender_needs_review) {
      line += ' [GENDER UNVERIFIED]'
    }

    lines.push(line)
  }

  return lines.join('\n')
}

// ========== STATS & UTILITIES ==========

function calculateStats(
  raw_sources: RawSources,
  intelligence: ProcessedIntelligence,
  interviews: InterviewData,
  result: WorkflowResult
): PackageStats {
  const totalWords = raw_sources.youtube_videos.reduce(
    (sum, v) => sum + (v.transcript_word_count || 0),
    0
  )

  return {
    sources_count: raw_sources.youtube_videos.length + raw_sources.tweets.length + raw_sources.web_documents.length,
    transcripts_count: raw_sources.youtube_videos.filter(v => v.has_transcript).length,
    total_transcript_words: totalWords,
    entities_count: intelligence.entities.length,
    claims_count: intelligence.claims.length,
    interviews_count: interviews.interviews.length,
    documents_count: raw_sources.web_documents.length,
    twitter_tweets_count: raw_sources.tweets.length,
    research_cost_cents: result.interviews_cost_cents + result.twitter_cost_cents,
  }
}

function truncateText(text?: string, limit?: number): string | undefined {
  if (!text) return undefined
  if (!limit || text.length <= limit) return text
  return text.slice(0, limit) + '...[truncated]'
}

function countWords(text?: string): number {
  if (!text) return 0
  return text.split(/\s+/).filter(w => w.length > 0).length
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'unknown'
  }
}
