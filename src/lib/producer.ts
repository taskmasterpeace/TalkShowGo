/**
 * PRODUCER - The Content Intelligence Brain
 *
 * The Producer analyzes incoming signals and determines:
 * 1. What type of content opportunity exists
 * 2. What production format to use (talk show, news, narrative)
 * 3. What additional research/perspectives are needed
 * 4. The overall editorial focus at any given time
 *
 * Think of it as the executive producer of a newsroom who decides
 * what stories to pursue and how to tell them.
 */

// ============================================
// CONTENT OPPORTUNITY TYPES
// ============================================

export type OpportunityType =
  | 'conflict'           // Two+ sources disagreeing → Talk Show debate
  | 'breaking'           // New information just dropped → News Bulletin
  | 'developing'         // Story evolving over time → News Coverage
  | 'controversy'        // Community divided → Hot Take show
  | 'rumor_spreading'    // Unconfirmed info viral → Investigation
  | 'single_perspective' // Only one POV → Need to find contrast
  | 'consensus'          // Everyone agrees → Summary/Recap
  | 'prediction'         // Future event speculation → Prediction show
  | 'milestone'          // Anniversary/achievement → Feature story
  | 'comeback'           // Someone returning → Narrative piece

export type ProductionFormat =
  | 'talk_show'          // Multiple personalities debating/discussing
  | 'news_bulletin'      // Quick breaking news report
  | 'news_coverage'      // In-depth news reporting
  | 'hot_take'           // Opinion/reaction content
  | 'investigation'      // Deep dive into claims/rumors
  | 'narrative_story'    // Storytelling with arc/drama
  | 'recap'              // Summary of events
  | 'prediction_panel'   // Speculation/prediction content

// ============================================
// PRODUCER INTENT
// ============================================

export interface ProducerIntent {
  id: string
  opportunity_type: OpportunityType
  production_format: ProductionFormat
  headline: string
  description: string
  confidence: number  // 0-1 how confident we are this is worth pursuing
  urgency: 'immediate' | 'today' | 'this_week' | 'background'
  signals: Signal[]
  missing_perspectives: string[]  // What POVs we're missing
  research_needed: ResearchTask[]
  created_at: Date
}

export interface Signal {
  source_type: 'tweet' | 'video' | 'claim' | 'entity_spike'
  source_id: string
  signal_type: 'conflict' | 'support' | 'contradiction' | 'breaking' | 'viral' | 'sentiment_shift'
  content_preview: string
  strength: number  // 0-1
}

export interface ResearchTask {
  type: 'find_contrast' | 'verify_claim' | 'get_reaction' | 'find_history' | 'search_mentions'
  description: string
  search_query?: string
  target_accounts?: string[]
  priority: number
}

// ============================================
// SIGNAL DETECTION PATTERNS
// ============================================

/**
 * Patterns that indicate content opportunities
 */
export const SIGNAL_PATTERNS = {
  // CONFLICT: Look for opposing stances on same claim
  conflict: {
    description: 'Multiple sources with opposing views on the same topic',
    indicators: [
      'Claim has both "supports" and "denies" stances',
      'High contention score (>0.5)',
      'Multiple entities mentioned with different sentiments',
    ],
    production_format: 'talk_show' as ProductionFormat,
  },

  // BREAKING: New claim with high engagement spike
  breaking: {
    description: 'New information spreading rapidly',
    indicators: [
      'Claim first_seen within last 6 hours',
      'High engagement velocity',
      'Multiple independent sources reporting',
    ],
    production_format: 'news_bulletin' as ProductionFormat,
  },

  // DEVELOPING: Story evolving with new claims
  developing: {
    description: 'Story with multiple sequential updates',
    indicators: [
      'Related claims appearing over time',
      'Same entities across multiple tweets',
      'Increasing mention count trend',
    ],
    production_format: 'news_coverage' as ProductionFormat,
  },

  // CONTROVERSY: High engagement, mixed sentiment
  controversy: {
    description: 'Topic generating heated debate',
    indicators: [
      'High reply-to-like ratio',
      'Mixed sentiment across tweets',
      'Quote tweets > retweets',
    ],
    production_format: 'hot_take' as ProductionFormat,
  },

  // SINGLE PERSPECTIVE: Only one side represented
  single_perspective: {
    description: 'Topic with missing viewpoints that should be represented',
    indicators: [
      'All tweets have same sentiment',
      'Only one source type reporting',
      'Missing expected entity reactions',
    ],
    production_format: 'investigation' as ProductionFormat,
    action: 'SEARCH_FOR_CONTRAST',
  },

  // RUMOR: Unverified claim spreading
  rumor_spreading: {
    description: 'Unconfirmed information going viral',
    indicators: [
      'Claim type is "rumor"',
      'High engagement but low credibility sources',
      'No official confirmation',
    ],
    production_format: 'investigation' as ProductionFormat,
  },

  // CONSENSUS: Everyone agrees
  consensus: {
    description: 'Community unified on opinion/fact',
    indicators: [
      'Consensus score > 0.8',
      'Low contention',
      'All sentiments positive/negative (not mixed)',
    ],
    production_format: 'recap' as ProductionFormat,
  },
}

// ============================================
// PRODUCER ANALYSIS FUNCTIONS
// ============================================

interface ClaimWithContext {
  id: string
  claim_text: string
  claim_type: string
  mention_count: number
  status: string
  consensus_scores?: {
    consensus: number
    contention: number
    confidence: number
    source_count: number
  }
  stances: { supports: number; denies: number; neutral: number; questions: number }
  first_seen: Date
}

interface TweetWithContext {
  id: string
  text: string
  author_handle: string
  metrics_likes: number
  metrics_retweets: number
  metrics_replies: number
  metrics_views: number
  tweet_created_at: Date
  sentiment?: string
  entities_mentioned: string[]
}

/**
 * Analyze claims for content opportunities
 */
export function analyzeClaimsForOpportunities(claims: ClaimWithContext[]): ProducerIntent[] {
  const intents: ProducerIntent[] = []

  for (const claim of claims) {
    // Check for CONFLICT
    if (claim.stances.supports > 0 && claim.stances.denies > 0) {
      const conflictRatio = Math.min(claim.stances.supports, claim.stances.denies) /
        Math.max(claim.stances.supports, claim.stances.denies)

      if (conflictRatio > 0.3) { // At least 30% disagree
        intents.push({
          id: `conflict-${claim.id}`,
          opportunity_type: 'conflict',
          production_format: 'talk_show',
          headline: `Debate: ${claim.claim_text}`,
          description: `Community divided on this claim. ${claim.stances.supports} support, ${claim.stances.denies} deny.`,
          confidence: conflictRatio,
          urgency: claim.status === 'emerging' ? 'today' : 'this_week',
          signals: [{
            source_type: 'claim',
            source_id: claim.id,
            signal_type: 'conflict',
            content_preview: claim.claim_text,
            strength: conflictRatio,
          }],
          missing_perspectives: [],
          research_needed: [{
            type: 'get_reaction',
            description: 'Get direct quotes from both sides',
            priority: 1,
          }],
          created_at: new Date(),
        })
      }
    }

    // Check for HIGH CONTENTION
    if (claim.consensus_scores && claim.consensus_scores.contention > 0.5) {
      intents.push({
        id: `controversy-${claim.id}`,
        opportunity_type: 'controversy',
        production_format: 'hot_take',
        headline: `Hot Topic: ${claim.claim_text}`,
        description: `High contention (${(claim.consensus_scores.contention * 100).toFixed(0)}%) on this claim.`,
        confidence: claim.consensus_scores.contention,
        urgency: 'today',
        signals: [{
          source_type: 'claim',
          source_id: claim.id,
          signal_type: 'conflict',
          content_preview: claim.claim_text,
          strength: claim.consensus_scores.contention,
        }],
        missing_perspectives: [],
        research_needed: [],
        created_at: new Date(),
      })
    }

    // Check for SINGLE PERSPECTIVE (needs contrast)
    if (claim.stances.supports > 2 && claim.stances.denies === 0 && claim.stances.questions === 0) {
      intents.push({
        id: `single-pov-${claim.id}`,
        opportunity_type: 'single_perspective',
        production_format: 'investigation',
        headline: `One-Sided: ${claim.claim_text}`,
        description: `Only supporting voices found. Need to search for contrasting perspective.`,
        confidence: 0.6,
        urgency: 'this_week',
        signals: [{
          source_type: 'claim',
          source_id: claim.id,
          signal_type: 'support',
          content_preview: claim.claim_text,
          strength: 0.8,
        }],
        missing_perspectives: ['Opposing view', 'Neutral analysis'],
        research_needed: [{
          type: 'find_contrast',
          description: 'Search for accounts/sources that might disagree',
          search_query: claim.claim_text + ' -agree -yes',
          priority: 2,
        }],
        created_at: new Date(),
      })
    }

    // Check for RUMOR
    if (claim.claim_type === 'rumor' && claim.mention_count > 3) {
      intents.push({
        id: `rumor-${claim.id}`,
        opportunity_type: 'rumor_spreading',
        production_format: 'investigation',
        headline: `Rumor Check: ${claim.claim_text}`,
        description: `Unconfirmed claim gaining traction. Needs verification.`,
        confidence: 0.7,
        urgency: claim.mention_count > 10 ? 'today' : 'this_week',
        signals: [{
          source_type: 'claim',
          source_id: claim.id,
          signal_type: 'viral',
          content_preview: claim.claim_text,
          strength: Math.min(claim.mention_count / 20, 1),
        }],
        missing_perspectives: ['Official source', 'Primary source'],
        research_needed: [
          {
            type: 'verify_claim',
            description: 'Search for official confirmation or denial',
            priority: 1,
          },
          {
            type: 'find_history',
            description: 'Check if similar rumors have been true/false before',
            priority: 3,
          },
        ],
        created_at: new Date(),
      })
    }

    // Check for BREAKING (recent + high velocity)
    const hoursSinceFirstSeen = (Date.now() - new Date(claim.first_seen).getTime()) / (1000 * 60 * 60)
    if (hoursSinceFirstSeen < 6 && claim.mention_count > 5) {
      intents.push({
        id: `breaking-${claim.id}`,
        opportunity_type: 'breaking',
        production_format: 'news_bulletin',
        headline: `BREAKING: ${claim.claim_text}`,
        description: `New information spreading rapidly. ${claim.mention_count} mentions in ${hoursSinceFirstSeen.toFixed(1)} hours.`,
        confidence: Math.min(claim.mention_count / 10, 1),
        urgency: 'immediate',
        signals: [{
          source_type: 'claim',
          source_id: claim.id,
          signal_type: 'breaking',
          content_preview: claim.claim_text,
          strength: 0.9,
        }],
        missing_perspectives: [],
        research_needed: [{
          type: 'get_reaction',
          description: 'Get reactions from key entities mentioned',
          priority: 1,
        }],
        created_at: new Date(),
      })
    }
  }

  // Sort by urgency and confidence
  const urgencyOrder = { immediate: 0, today: 1, this_week: 2, background: 3 }
  intents.sort((a, b) => {
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (urgencyDiff !== 0) return urgencyDiff
    return b.confidence - a.confidence
  })

  return intents
}

/**
 * Detect when we need to search for contrasting perspectives
 */
export function detectMissingPerspectives(
  tweets: TweetWithContext[],
  entityName: string
): ResearchTask | null {
  const sentiments = tweets.map(t => t.sentiment).filter(Boolean)

  const positiveCount = sentiments.filter(s => s === 'positive').length
  const negativeCount = sentiments.filter(s => s === 'negative').length
  const totalWithSentiment = positiveCount + negativeCount

  if (totalWithSentiment < 3) return null

  // If sentiment is heavily one-sided
  const ratio = Math.min(positiveCount, negativeCount) / Math.max(positiveCount, negativeCount)
  if (ratio < 0.2) { // Less than 20% of the minority sentiment
    const missing = positiveCount > negativeCount ? 'negative' : 'positive'
    return {
      type: 'find_contrast',
      description: `Only ${missing === 'negative' ? 'positive' : 'negative'} sentiment found for ${entityName}. Search for ${missing} perspectives.`,
      search_query: `${entityName} ${missing === 'negative' ? 'problem OR issue OR bad' : 'good OR great OR best'}`,
      priority: 2,
    }
  }

  return null
}

/**
 * Map opportunity type to production format
 */
export function getProductionFormat(opportunityType: OpportunityType): ProductionFormat {
  const mapping: Record<OpportunityType, ProductionFormat> = {
    conflict: 'talk_show',
    breaking: 'news_bulletin',
    developing: 'news_coverage',
    controversy: 'hot_take',
    rumor_spreading: 'investigation',
    single_perspective: 'investigation',
    consensus: 'recap',
    prediction: 'prediction_panel',
    milestone: 'narrative_story',
    comeback: 'narrative_story',
  }
  return mapping[opportunityType]
}

/**
 * Generate a production brief for the content team
 */
export function generateProductionBrief(intent: ProducerIntent): string {
  const lines = [
    `# Production Brief: ${intent.headline}`,
    '',
    `**Format:** ${intent.production_format.replace('_', ' ').toUpperCase()}`,
    `**Urgency:** ${intent.urgency.toUpperCase()}`,
    `**Confidence:** ${(intent.confidence * 100).toFixed(0)}%`,
    '',
    `## Description`,
    intent.description,
    '',
  ]

  if (intent.signals.length > 0) {
    lines.push('## Signals Detected')
    for (const signal of intent.signals) {
      lines.push(`- [${signal.signal_type}] ${signal.content_preview.slice(0, 100)}...`)
    }
    lines.push('')
  }

  if (intent.missing_perspectives.length > 0) {
    lines.push('## Missing Perspectives')
    for (const perspective of intent.missing_perspectives) {
      lines.push(`- ${perspective}`)
    }
    lines.push('')
  }

  if (intent.research_needed.length > 0) {
    lines.push('## Research Tasks')
    for (const task of intent.research_needed) {
      lines.push(`- [P${task.priority}] ${task.description}`)
      if (task.search_query) {
        lines.push(`  Search: "${task.search_query}"`)
      }
    }
  }

  return lines.join('\n')
}
