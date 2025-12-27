/**
 * Research Package Schema
 *
 * A complete bundle of all research data for a story or topic.
 * Designed for consumption by:
 * - AI/LLM systems (JSON API)
 * - Human producers (Markdown export)
 * - External tools (Director's Palette)
 */

// ========== METADATA ==========

export interface PackageMetadata {
  package_id: string
  version: string
  generated_at: string
  generated_by: 'system' | 'manual'

  // Source identifiers
  topic_id?: string
  story_candidate_id?: string
  research_run_id?: string

  // Query context
  original_query: string
  interpreted_query?: string

  // Stats summary
  stats: PackageStats
}

export interface PackageStats {
  sources_count: number
  transcripts_count: number
  total_transcript_words: number
  entities_count: number
  claims_count: number
  interviews_count: number
  documents_count: number
  twitter_tweets_count: number
  research_duration_ms?: number
  research_cost_cents?: number
}

// ========== RAW SOURCES ==========

export interface RawSources {
  youtube_videos: YouTubeSourceItem[]
  tweets: TweetSourceItem[]
  comments: CommentSourceItem[]
  web_documents: WebDocumentItem[]
}

export interface YouTubeSourceItem {
  video_id: string
  title: string
  channel: string
  channel_id?: string
  url: string
  published_at?: string
  duration_seconds?: number
  view_count?: number
  like_count?: number
  comment_count?: number
  thumbnail_url?: string

  // Transcript
  has_transcript: boolean
  transcript_source?: 'youtube_captions' | 'assemblyai' | 'database'
  transcript_confidence?: number
  transcript_text?: string
  transcript_word_count?: number

  // Relevance
  relevance_score?: number
  relevance_notes?: string
  is_interview?: boolean
  is_primary_source?: boolean
}

export interface TweetSourceItem {
  tweet_id: string
  text: string
  author_handle: string
  author_name?: string
  author_followers?: number
  is_verified?: boolean
  created_at: string

  // Metrics
  likes: number
  retweets: number
  replies: number
  views?: number

  // Classification
  tweet_type: 'original' | 'reply' | 'quote' | 'retweet'
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed'
  relevance_score?: number
}

export interface CommentSourceItem {
  comment_id: string
  video_id: string
  video_title: string
  text: string
  author: string
  likes: number
  reply_count: number
  published_at: string

  // Classification
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed'
  is_top_comment?: boolean
  consensus_indicator?: boolean
}

export interface WebDocumentItem {
  url: string
  title: string
  domain: string
  fetched_at: string

  // Content
  snippet?: string
  full_text?: string

  // Classification
  document_type:
    | 'court_record'
    | 'news_article'
    | 'official_document'
    | 'social_media'
    | 'other'
  relevance_score: number
  is_primary_source?: boolean
}

// ========== PROCESSED INTELLIGENCE ==========

export interface ProcessedIntelligence {
  entities: ProcessedEntity[]
  claims: ProcessedClaim[]
  event_timeline?: TimelineEvent[]
  consensus_summary?: ConsensusSummary
}

export interface EntityAffiliation {
  name: string
  type: string
  status: 'current' | 'former' | 'rumored'
}

export interface ProcessedEntity {
  id: string
  name: string
  aliases?: string[]
  type: string // 'person', 'organization', 'league', 'event'

  // Context
  role?: string
  sub_roles?: string[]
  gender?: 'male' | 'female' | 'other' | 'unknown'
  gender_needs_review?: boolean
  gender_review_reason?: string

  // Affiliations
  affiliations?: EntityAffiliation[]

  // Intelligence flags
  is_primary_source?: boolean
  is_commentator?: boolean
  bias_indicators?: string[]

  // Mentions in this research
  mention_count: number
  mention_sources: string[]

  // Enrichment status
  enrichment_status?: 'pending' | 'enriched' | 'locked'
  enrichment_notes?: string
}

export interface ClaimEvidence {
  source_type: 'youtube' | 'twitter' | 'web' | 'comment'
  source_id: string
  source_title: string
  snippet: string
  timestamp?: string
}

export interface ProcessedClaim {
  id: string
  claim_text: string
  claim_type: 'factual' | 'opinion' | 'prediction' | 'rumor'

  // Verification
  verdict?: 'confirmed' | 'likely' | 'uncertain' | 'disputed' | 'debunked'
  confidence_score: number

  // Evidence
  evidence_for: ClaimEvidence[]
  evidence_against: ClaimEvidence[]

  // Sources
  first_seen_source: string
  source_count: number
  engagement_total: number
}

export interface TimelineEvent {
  date: string
  event_type: 'incident' | 'announcement' | 'battle' | 'interview' | 'reaction'
  description: string
  source_ids: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface ConsensusSummary {
  topic: string
  community_sentiment: {
    positive: number
    negative: number
    neutral: number
  }
  key_opinions: string[]
  areas_of_agreement: string[]
  areas_of_disagreement: string[]
}

// ========== PRODUCER MATERIALS ==========

export interface ProducerMaterials {
  story_summary: StorySummary
  key_facts: KeyFact[]
  quotes_to_use: QuoteItem[]
  warnings: ProducerWarning[]
  suggested_angles: string[]
  research_gaps: string[]
}

export interface StorySummary {
  headline: string
  one_liner: string
  full_summary: string
  story_type:
    | 'battle'
    | 'beef'
    | 'interview'
    | 'announcement'
    | 'allegation'
    | 'other'
  estimated_interest_level: 'high' | 'medium' | 'low'
  timeliness: 'breaking' | 'developing' | 'background' | 'evergreen'
}

export interface KeyFact {
  fact: string
  source_count: number
  confidence: 'confirmed' | 'likely' | 'unverified'
  primary_source?: string
  contradictions?: string[]
}

export interface QuoteItem {
  quote: string
  speaker: string
  speaker_role?: string
  source_type: 'interview' | 'tweet' | 'comment' | 'video'
  source_title: string
  source_url: string
  timestamp?: string
  engagement?: number
  recommended_use?: string
}

export interface ProducerWarning {
  type:
    | 'unverified_claim'
    | 'legal_risk'
    | 'bias_detected'
    | 'outdated_info'
    | 'gender_unverified'
    | 'missing_context'
  severity: 'high' | 'medium' | 'low'
  message: string
  affected_items?: string[]
  recommendation?: string
}

// ========== HOST MATERIALS ==========

export interface HostMaterials {
  script_outline: ScriptOutline
  talking_points: TalkingPoint[]
  pronunciation_guide: PronunciationEntry[]
  entity_glossary: string
}

export interface ScriptOutline {
  title: string
  estimated_duration_minutes: number
  sections: ScriptSection[]
}

export interface ScriptSection {
  name: string
  purpose: string
  suggested_content: string
  key_points: string[]
  quotes_to_include?: string[]
  estimated_duration_seconds: number
}

export interface TalkingPoint {
  point: string
  supporting_facts: string[]
  source_reference: string
  can_be_cut?: boolean
}

export interface PronunciationEntry {
  term: string
  pronunciation: string
  notes?: string
}

// ========== INTERVIEW DATA ==========

export interface InterviewData {
  interviews: InterviewItem[]
  total_interview_minutes: number
}

export interface InterviewItem {
  entity_name: string
  entity_type: string
  video_id: string
  video_title: string
  channel: string
  url: string
  duration_seconds: number

  // Transcript
  has_transcript: boolean
  transcript_source?: string
  transcript_text?: string

  // Key moments
  key_quotes?: string[]
  topics_discussed?: string[]

  // Cache info
  from_cache: boolean
  cost_cents: number
}

// ========== TWITTER DATA ==========

export interface TwitterData {
  event_timeframe: {
    event_date: string
    confidence: 'high' | 'medium' | 'low'
    source: string
  }
  search_query: string
  tweets_found: number
  sentiment: {
    positive: number
    negative: number
    neutral: number
  }
  top_reactions: TweetSourceItem[]
  key_quotes: string[]
  cost_cents: number
}

// ========== COMPLETE PACKAGE ==========

export interface ResearchPackage {
  metadata: PackageMetadata
  raw_sources: RawSources
  intelligence: ProcessedIntelligence
  producer: ProducerMaterials
  host: HostMaterials
  interviews: InterviewData
  twitter?: TwitterData

  // Export options
  export_formats_available: ('json' | 'markdown' | 'pdf')[]
}

// ========== API TYPES ==========

export interface ResearchPackageOptions {
  format?: 'json' | 'markdown'
  sections?: string[]
  include_transcripts?: boolean
  transcript_limit?: number
}

export interface GeneratePackageRequest {
  query: string
  topic_id?: string
  options?: {
    enable_interviews?: boolean
    enable_twitter?: boolean
    enable_documents?: boolean
    max_videos?: number
    max_tweets?: number
  }
  generate_producer_materials?: boolean
  generate_host_materials?: boolean
}

export interface ResearchPackageResponse {
  success: boolean
  package?: ResearchPackage
  markdown?: string
  error?: string
  export_urls?: {
    json: string
    markdown: string
    json_full: string
  }
}
