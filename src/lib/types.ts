// Core types for Talk Show Go

export type TopicStatus = 'active' | 'paused' | 'archived'
export type Platform = 'twitter' | 'youtube' | 'rss'
export type SourceStatus = 'seed' | 'nominated' | 'verified' | 'banned'
export type YouTubeStatus = 'trusted' | 'monitoring' | 'banned'
export type TweetType = 'original' | 'reply' | 'quote' | 'retweet'
export type EntityType = 'person' | 'organization' | 'place' | 'event' | 'product' | 'other'
export type MentionType = 'subject' | 'object' | 'reference'
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed'
export type ClaimType = 'factual' | 'opinion' | 'prediction' | 'rumor'
export type ClaimStatus = 'emerging' | 'active' | 'stale'
export type Stance = 'supports' | 'denies' | 'neutral' | 'questions'
export type Verdict = 'confirmed' | 'likely' | 'uncertain' | 'disputed' | 'debunked'
export type StoryBucket = 'breaking' | 'developing' | 'background' | 'recurring' | 'feature'
export type StoryStatus = 'candidate' | 'reviewing' | 'greenlit' | 'killed'
export type DraftStatus = 'draft' | 'approved' | 'sent'
export type ProductionStatus = 'pending' | 'in_production' | 'published'
export type ExportDestination = 'directors_palette' | '11labs' | 'both'
export type ExportStatus = 'pending' | 'sent' | 'acknowledged' | 'failed'
export type NominationStatus = 'pending' | 'approved' | 'rejected' | 'deferred'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

// Database types
export interface Topic {
  id: string
  name: string
  description?: string
  status: TopicStatus
  created_at: string
  updated_at: string
}

export interface SourceAccount {
  id: string
  topic_id: string
  platform: Platform
  handle: string
  display_name?: string
  description?: string
  notes?: string
  profile_image_url?: string
  follower_count: number
  credibility_score: number
  status: SourceStatus
  last_checked?: string
  created_at: string
  updated_at: string
  metadata: Record<string, any>
}

export interface CredibilityProfile {
  id: string
  topic_id: string
  youtube_min_subscribers: number
  youtube_min_views: number
  youtube_verified_bonus: number
  twitter_min_followers: number
  twitter_verified_bonus: number
  engagement_weight: number
  recency_weight: number
  created_at: string
  updated_at: string
}

export interface TweetRaw {
  id: string
  tweet_id: string
  topic_id: string
  source_account_id?: string
  text: string
  author_handle: string
  author_name?: string
  author_profile_image?: string
  tweet_type: TweetType
  reply_to_tweet_id?: string
  quote_of_tweet_id?: string
  metrics_likes: number
  metrics_retweets: number
  metrics_replies: number
  metrics_views: number
  media_urls: string[]
  links: string[]
  tweet_created_at?: string
  fetched_at: string
  processed: boolean
  raw_payload?: Record<string, any>
}

export interface Entity {
  id: string
  topic_id: string
  canonical_name: string
  entity_type: EntityType
  description?: string
  notes?: string
  first_seen: string
  mention_count: number
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Claim {
  id: string
  topic_id: string
  claim_text: string
  claim_type: ClaimType
  cluster_id?: string
  first_seen: string
  mention_count: number
  status: ClaimStatus
  created_at: string
  updated_at: string
}

export interface ConsensusScore {
  id: string
  claim_id: string
  consensus: number // -1 to 1
  contention: number // 0 to 1
  confidence: number // 0 to 1
  source_count: number
  engagement_total: number
  evidence_summary?: string
  computed_at: string
}

export interface ClaimVerdict {
  id: string
  claim_id: string
  verdict: Verdict
  reasoning?: string
  evidence_for: string[]
  evidence_against: string[]
  requires_editorial: boolean
  computed_at: string
}

export interface StoryCandidate {
  id: string
  topic_id: string
  bucket: StoryBucket
  headline?: string
  summary?: string
  primary_entities: string[]
  primary_claims: string[]
  evidence_package: Record<string, any>
  confidence_score: number
  engagement_total: number
  priority_rank: number
  status: StoryStatus
  created_at: string
  updated_at: string
}

export interface Story {
  id: string
  story_candidate_id: string
  final_headline?: string
  final_content?: string
  greenlit_by?: string
  greenlit_at: string
  integrity_checklist: Record<string, any>
  production_status: ProductionStatus
  created_at: string
}

export interface Nomination {
  id: string
  topic_id: string
  platform: Platform
  identifier: string
  discovered_via?: string
  discovery_context?: string
  preliminary_score: number
  status: NominationStatus
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
}

export interface JobRun {
  id: string
  job_type: string
  topic_id?: string
  status: JobStatus
  started_at?: string
  completed_at?: string
  duration_ms?: number
  items_processed: number
  errors: any[]
  metadata: Record<string, any>
  created_at: string
}

// API Request/Response types
export interface CreateTopicRequest {
  name: string
  description?: string
}

export interface AddSourceRequest {
  topic_id: string
  platform: Platform
  handle: string
  notes?: string
}

export interface UpdateSourceRequest {
  notes?: string
  status?: SourceStatus
  credibility_score?: number
}

export interface GreenlightStoryRequest {
  angle: string
  tone: string
  length: 'short' | 'medium' | 'long'
  format?: string
  draft_content: string
  integrity_checklist: Record<string, boolean>
}

export interface ReviewNominationRequest {
  action: 'approve' | 'reject' | 'defer'
  rejection_reason?: string
}

// Export package structure for Director's Palette
export interface ExportPackage {
  story_id: string
  headline: string
  content: string
  entities: ExportEntity[]
  locations: ExportLocation[]
  scenes: ExportScene[]
  narration: ExportNarration
  metadata: ExportMetadata
}

export interface ExportEntity {
  name: string
  type: EntityType
  role: string
  visual_description?: string
  notes?: string
}

export interface ExportLocation {
  name: string
  type: string
  visual_description?: string
}

export interface ExportScene {
  scene_number: number
  description: string
  narration: string
  visual_instruction: string
  duration_seconds: number
  entities_present: string[]
}

export interface ExportNarration {
  full_script: string
  voice_profile: string
  pacing: string
}

export interface ExportMetadata {
  topic: string
  bucket: StoryBucket
  sources_count: number
  confidence: number
}
