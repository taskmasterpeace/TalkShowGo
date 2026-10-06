/**
 * Decision Logger
 *
 * Tracks the reasoning path behind Daily Show topic proposals.
 * Captures search queries, analysis steps, and decision points
 * for auditing and performance analysis.
 */

export interface ProposalDecisionLog {
  id?: string
  topic_id: string
  proposed_at: string

  // What was searched
  searches: {
    youtube: {
      channels_queried: string[]
      date_range: { start: string; end: string }
      videos_found: number
    }
    twitter: {
      accounts_queried: string[]
      date_range: { start: string; end: string }
      tweets_found: number
    }
  }

  // What was analyzed deeper
  analysis: {
    transcripts_fetched: TranscriptLog[]
    entities_detected: string[]
  }

  // Decision points
  decisions: Decision[]

  // Final outcome
  topics_proposed: number
  topics_selected: TopicSummary[]
  topics_rejected: RejectedTopic[]

  // Processing metadata
  processing_time_ms?: number
}

export interface TranscriptLog {
  video_id: string
  title: string
  channel: string
  reason: string
  transcript_length?: number
  key_quotes_extracted?: number
}

export interface Decision {
  step: string
  action: string
  details: string
  timestamp: string
}

export interface TopicSummary {
  rank: number
  headline: string
  engagement_score: number
  source_count: number
  primary_reason: string
  freshest_content: string
}

export interface RejectedTopic {
  headline: string
  engagement_score: number
  rejection_reason: string
}

/**
 * DecisionLogger class to track proposal decisions
 */
export class DecisionLogger {
  private log: ProposalDecisionLog
  private startTime: number

  constructor(topicId: string) {
    this.startTime = Date.now()
    this.log = {
      topic_id: topicId,
      proposed_at: new Date().toISOString(),
      searches: {
        youtube: {
          channels_queried: [],
          date_range: { start: '', end: '' },
          videos_found: 0,
        },
        twitter: {
          accounts_queried: [],
          date_range: { start: '', end: '' },
          tweets_found: 0,
        },
      },
      analysis: {
        transcripts_fetched: [],
        entities_detected: [],
      },
      decisions: [],
      topics_proposed: 0,
      topics_selected: [],
      topics_rejected: [],
    }
  }

  /**
   * Log a YouTube search
   */
  logYouTubeSearch(
    channels: string[],
    dateRange: { start: Date; end: Date },
    videosFound: number
  ) {
    this.log.searches.youtube = {
      channels_queried: channels,
      date_range: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
      videos_found: videosFound,
    }
    this.logDecision(
      'fetch',
      `Queried ${channels.length} YouTube channels`,
      `Found ${videosFound} videos in date range`
    )
  }

  /**
   * Log a Twitter search
   */
  logTwitterSearch(
    accounts: string[],
    dateRange: { start: Date; end: Date },
    tweetsFound: number
  ) {
    this.log.searches.twitter = {
      accounts_queried: accounts,
      date_range: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
      tweets_found: tweetsFound,
    }
    this.logDecision(
      'fetch',
      `Queried ${accounts.length} Twitter accounts`,
      `Found ${tweetsFound} tweets in date range`
    )
  }

  /**
   * Log a transcript fetch
   */
  logTranscriptFetch(
    videoId: string,
    title: string,
    channel: string,
    reason: string,
    transcriptLength?: number,
    quotesExtracted?: number
  ) {
    this.log.analysis.transcripts_fetched.push({
      video_id: videoId,
      title,
      channel,
      reason,
      transcript_length: transcriptLength,
      key_quotes_extracted: quotesExtracted,
    })
  }

  /**
   * Log detected entities
   */
  logEntitiesDetected(entities: string[]) {
    this.log.analysis.entities_detected = entities
    this.logDecision(
      'entity_extraction',
      `Detected ${entities.length} unique entities`,
      entities.slice(0, 10).join(', ') + (entities.length > 10 ? '...' : '')
    )
  }

  /**
   * Log a decision point
   */
  logDecision(step: string, action: string, details: string) {
    this.log.decisions.push({
      step,
      action,
      details,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Log clustering results
   */
  logClustering(totalClusters: number, details: string) {
    this.logDecision('clustering', `Created ${totalClusters} topic clusters`, details)
  }

  /**
   * Log scoring
   */
  logScoring(formula: string) {
    this.logDecision('scoring', 'Calculated engagement scores', `Formula: ${formula}`)
  }

  /**
   * Log filtering
   */
  logFiltering(removed: number, threshold: number) {
    this.logDecision(
      'filtering',
      `Removed ${removed} low-engagement clusters`,
      `Threshold: engagement_score >= ${threshold}`
    )
  }

  /**
   * Log final ranking
   */
  logRanking(topTopicHeadline: string, topScore: number) {
    this.logDecision(
      'ranking',
      `Ranked topics by engagement`,
      `Top topic: ${topTopicHeadline} with ${topScore.toLocaleString()} engagement`
    )
  }

  /**
   * Log a selected topic
   */
  logTopicSelected(
    rank: number,
    headline: string,
    engagementScore: number,
    sourceCount: number,
    reason: string,
    freshestContent: string | Date
  ) {
    this.log.topics_selected.push({
      rank,
      headline,
      engagement_score: engagementScore,
      source_count: sourceCount,
      primary_reason: reason,
      freshest_content:
        freshestContent instanceof Date
          ? freshestContent.toISOString()
          : freshestContent,
    })
    this.log.topics_proposed = this.log.topics_selected.length
  }

  /**
   * Log a rejected topic
   */
  logTopicRejected(headline: string, engagementScore: number, reason: string) {
    this.log.topics_rejected.push({
      headline,
      engagement_score: engagementScore,
      rejection_reason: reason,
    })
  }

  /**
   * Get the final decision log
   */
  getLog(): ProposalDecisionLog {
    this.log.processing_time_ms = Date.now() - this.startTime
    return this.log
  }

  /**
   * Get summary stats for database storage
   */
  getStats() {
    return {
      topics_proposed: this.log.topics_proposed,
      videos_found: this.log.searches.youtube.videos_found,
      tweets_found: this.log.searches.twitter.tweets_found,
      transcripts_fetched: this.log.analysis.transcripts_fetched.length,
      clusters_created: this.log.topics_selected.length + this.log.topics_rejected.length,
      clusters_rejected: this.log.topics_rejected.length,
      processing_time_ms: Date.now() - this.startTime,
    }
  }
}
