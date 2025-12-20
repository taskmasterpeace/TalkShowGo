/**
 * PRODUCER SYSTEM
 *
 * Producers are intelligent agents that:
 * 1. Analyze content opportunities
 * 2. Gather information based on their personality
 * 3. Determine the best show format
 * 4. Create production briefs for content creation
 */

import {
  ProducerProfile,
  ProducerArchetype,
  ShowFormat,
  ShowFormatConfig,
  PRODUCER_ARCHETYPES,
  SHOW_FORMATS,
  BATTLE_RAP_RESOURCES,
} from './types'

export * from './types'

// ============================================
// PRODUCTION GOAL - What the Producer is creating
// ============================================

export interface ProductionGoal {
  id: string
  format: ShowFormat
  formatConfig: ShowFormatConfig
  topic: string
  headline: string
  angle: string  // The specific angle/hook
  tone: string
  targetDurationMinutes: number

  // The Who, What, Where, When, Why
  story5Ws: {
    who: string[]      // Key people/entities involved
    what: string       // What happened/is happening
    where: string      // Location/context
    when: string       // Timeline
    why: string        // Why it matters / significance
  }

  // Evidence gathered
  sources: ProductionSource[]

  // For debate/panel shows
  perspectives?: {
    sideA: { position: string; supporters: string[]; evidence: string[] }
    sideB: { position: string; supporters: string[]; evidence: string[] }
  }

  // Research tasks still needed
  pendingResearch: ResearchTask[]

  // Production readiness
  readiness: {
    hasEnoughSources: boolean
    hasConflict: boolean  // If format requires it
    has5Ws: boolean
    isVerified: boolean
    score: number  // 0-1 overall readiness
  }
}

export interface ProductionSource {
  type: 'tweet' | 'video' | 'article' | 'comment' | 'official'
  url?: string
  content: string
  author: string
  credibility: number
  timestamp: Date
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed'
  stance?: 'supports' | 'denies' | 'neutral' | 'questions'
}

export interface ResearchTask {
  type: 'verify' | 'find_contrast' | 'get_reaction' | 'check_history' | 'search_web' | 'check_comments'
  description: string
  query?: string
  targetSources?: string[]
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

// ============================================
// PRODUCER CLASS
// ============================================

export class Producer {
  profile: ProducerProfile
  currentGoal: ProductionGoal | null = null

  constructor(archetype: ProducerArchetype) {
    this.profile = PRODUCER_ARCHETYPES[archetype]
  }

  /**
   * Analyze an opportunity and decide what to produce
   */
  analyzeOpportunity(opportunity: {
    headline: string
    description: string
    type: string
    signals: any[]
    confidence: number
  }): { shouldProduce: boolean; suggestedFormat: ShowFormat; reasoning: string } {
    const { attributes } = this.profile

    // Drama Hunter loves controversy
    if (this.profile.archetype === 'drama_hunter' && opportunity.type === 'conflict') {
      return {
        shouldProduce: true,
        suggestedFormat: 'talk_show_debate',
        reasoning: 'High conflict detected - perfect for debate format',
      }
    }

    // Speed Demon jumps on breaking news
    if (this.profile.archetype === 'speed_demon' && opportunity.type === 'breaking') {
      return {
        shouldProduce: true,
        suggestedFormat: 'news_bulletin',
        reasoning: 'Breaking news - need to get this out fast',
      }
    }

    // Storyteller loves developing stories
    if (this.profile.archetype === 'storyteller' && opportunity.type === 'developing') {
      return {
        shouldProduce: true,
        suggestedFormat: 'narrative_story',
        reasoning: 'Developing story with arc potential',
      }
    }

    // Fact Checker wants to investigate rumors
    if (this.profile.archetype === 'fact_checker' && opportunity.type === 'rumor_spreading') {
      return {
        shouldProduce: true,
        suggestedFormat: 'deep_dive',
        reasoning: 'Rumor needs verification - deep investigation required',
      }
    }

    // Community Pulse monitors consensus/controversy
    if (this.profile.archetype === 'community_pulse') {
      if (opportunity.type === 'controversy') {
        return {
          shouldProduce: true,
          suggestedFormat: 'talk_show_panel',
          reasoning: 'Community divided - need panel to discuss',
        }
      }
    }

    // Default: use best format for this producer
    const bestFormat = this.profile.bestForFormats[0]
    return {
      shouldProduce: opportunity.confidence > 0.5,
      suggestedFormat: bestFormat,
      reasoning: `Default format for ${this.profile.name}`,
    }
  }

  /**
   * Create a production goal from an opportunity
   */
  createProductionGoal(
    opportunity: any,
    format: ShowFormat
  ): ProductionGoal {
    const formatConfig = SHOW_FORMATS[format]

    const goal: ProductionGoal = {
      id: `goal_${Date.now()}`,
      format,
      formatConfig,
      topic: opportunity.headline,
      headline: opportunity.headline,
      angle: this.determineAngle(opportunity, format),
      tone: this.selectTone(formatConfig),
      targetDurationMinutes: Math.round(
        (formatConfig.minDurationMinutes + formatConfig.maxDurationMinutes) / 2
      ),
      story5Ws: {
        who: [],
        what: opportunity.description,
        where: '',
        when: '',
        why: '',
      },
      sources: [],
      pendingResearch: this.generateResearchTasks(opportunity, format),
      readiness: {
        hasEnoughSources: false,
        hasConflict: false,
        has5Ws: false,
        isVerified: false,
        score: 0,
      },
    }

    // If debate format, set up perspectives
    if (format === 'talk_show_debate') {
      goal.perspectives = {
        sideA: { position: '', supporters: [], evidence: [] },
        sideB: { position: '', supporters: [], evidence: [] },
      }
    }

    this.currentGoal = goal
    return goal
  }

  /**
   * Determine the angle based on producer personality
   */
  private determineAngle(opportunity: any, format: ShowFormat): string {
    switch (this.profile.archetype) {
      case 'drama_hunter':
        return 'The controversy and what people are REALLY saying'
      case 'fact_checker':
        return 'What we KNOW vs what we THINK we know'
      case 'deep_diver':
        return 'The full story and hidden connections'
      case 'speed_demon':
        return 'Breaking: What just happened'
      case 'storyteller':
        return 'The journey and what it means'
      case 'community_pulse':
        return 'What the culture is saying'
      default:
        return 'The complete picture'
    }
  }

  /**
   * Select tone based on format and producer personality
   */
  private selectTone(formatConfig: ShowFormatConfig): string {
    const tones = formatConfig.toneOptions

    // Producer personality influences tone selection
    if (this.profile.archetype === 'drama_hunter') {
      return tones.includes('heated') ? 'heated' : tones.includes('provocative') ? 'provocative' : tones[0]
    }
    if (this.profile.archetype === 'fact_checker') {
      return tones.includes('serious') ? 'serious' : tones.includes('investigative') ? 'investigative' : tones[0]
    }
    if (this.profile.archetype === 'storyteller') {
      return tones.includes('dramatic') ? 'dramatic' : tones.includes('suspenseful') ? 'suspenseful' : tones[0]
    }

    return tones[0]
  }

  /**
   * Generate research tasks based on producer personality
   */
  private generateResearchTasks(opportunity: any, format: ShowFormat): ResearchTask[] {
    const tasks: ResearchTask[] = []
    const { searchBehavior } = this.profile

    // All producers should identify the 5Ws
    tasks.push({
      type: 'search_web',
      description: 'Identify Who, What, Where, When, Why',
      priority: 'high',
      completed: false,
    })

    if (searchBehavior.alwaysCheckWeb) {
      tasks.push({
        type: 'search_web',
        description: 'Search web for additional context and verification',
        query: opportunity.headline,
        targetSources: Object.values(BATTLE_RAP_RESOURCES.websites).map(w => w.url),
        priority: 'high',
        completed: false,
      })
    }

    if (searchBehavior.verifyWithOfficialSources) {
      tasks.push({
        type: 'verify',
        description: 'Check official sources for confirmation',
        targetSources: BATTLE_RAP_RESOURCES.officialAccounts.twitter,
        priority: 'high',
        completed: false,
      })
    }

    if (searchBehavior.checkComments) {
      tasks.push({
        type: 'check_comments',
        description: 'Analyze comments for sentiment and additional info',
        priority: 'medium',
        completed: false,
      })
    }

    if (searchBehavior.lookForContrast) {
      tasks.push({
        type: 'find_contrast',
        description: 'Find opposing viewpoints or alternative perspectives',
        priority: format === 'talk_show_debate' ? 'high' : 'medium',
        completed: false,
      })
    }

    if (searchBehavior.crossReferenceTwitter) {
      tasks.push({
        type: 'search_web',
        description: 'Cross-reference on Twitter for additional sources',
        query: opportunity.headline,
        priority: 'medium',
        completed: false,
      })
    }

    return tasks
  }

  /**
   * Add a source to the current production
   */
  addSource(source: ProductionSource): void {
    if (!this.currentGoal) return
    this.currentGoal.sources.push(source)
    this.updateReadiness()
  }

  /**
   * Update the 5Ws
   */
  update5Ws(updates: Partial<ProductionGoal['story5Ws']>): void {
    if (!this.currentGoal) return
    this.currentGoal.story5Ws = { ...this.currentGoal.story5Ws, ...updates }
    this.updateReadiness()
  }

  /**
   * Update readiness assessment
   */
  private updateReadiness(): void {
    if (!this.currentGoal) return

    const goal = this.currentGoal
    const { attributes, searchBehavior } = this.profile

    // Check if we have enough sources
    const minSources = searchBehavior.maxSourcesBeforeDecision * 0.5
    goal.readiness.hasEnoughSources = goal.sources.length >= minSources

    // Check if we have conflict (for debate formats)
    if (goal.formatConfig.requiresConflict) {
      const hasSupport = goal.sources.some(s => s.stance === 'supports')
      const hasDeny = goal.sources.some(s => s.stance === 'denies')
      goal.readiness.hasConflict = hasSupport && hasDeny
    } else {
      goal.readiness.hasConflict = true  // Not required
    }

    // Check 5Ws
    const { who, what, where, when, why } = goal.story5Ws
    goal.readiness.has5Ws = (
      who.length > 0 &&
      what.length > 0 &&
      (where.length > 0 || true) &&  // Where is optional
      when.length > 0 &&
      why.length > 0
    )

    // Check verification (based on producer's rigor)
    const verifiedSources = goal.sources.filter(s => s.credibility > 0.7).length
    goal.readiness.isVerified = verifiedSources / Math.max(goal.sources.length, 1) >= attributes.verificationRigor

    // Calculate overall score
    let score = 0
    if (goal.readiness.hasEnoughSources) score += 0.25
    if (goal.readiness.hasConflict) score += 0.25
    if (goal.readiness.has5Ws) score += 0.25
    if (goal.readiness.isVerified) score += 0.25

    goal.readiness.score = score
  }

  /**
   * Check if production is ready
   */
  isReadyToPublish(): boolean {
    if (!this.currentGoal) return false

    // Different thresholds based on producer type
    const threshold = this.profile.archetype === 'speed_demon' ? 0.5 :
      this.profile.archetype === 'fact_checker' ? 0.9 :
        0.7

    return this.currentGoal.readiness.score >= threshold
  }

  /**
   * Generate the final production brief
   */
  generateBrief(): string {
    if (!this.currentGoal) return 'No production goal set'

    const goal = this.currentGoal
    const lines: string[] = [
      `# PRODUCTION BRIEF`,
      ``,
      `**Producer:** ${this.profile.name} (${this.profile.archetype})`,
      `**Format:** ${goal.formatConfig.name}`,
      `**Tone:** ${goal.tone}`,
      `**Duration:** ~${goal.targetDurationMinutes} minutes`,
      ``,
      `## HEADLINE`,
      goal.headline,
      ``,
      `## ANGLE`,
      goal.angle,
      ``,
      `## THE 5Ws`,
      `- **WHO:** ${goal.story5Ws.who.join(', ') || 'TBD'}`,
      `- **WHAT:** ${goal.story5Ws.what || 'TBD'}`,
      `- **WHERE:** ${goal.story5Ws.where || 'TBD'}`,
      `- **WHEN:** ${goal.story5Ws.when || 'TBD'}`,
      `- **WHY:** ${goal.story5Ws.why || 'TBD'}`,
      ``,
      `## SHOW STRUCTURE`,
      ...goal.formatConfig.structure.map((segment, i) => `${i + 1}. ${segment.replace('_', ' ').toUpperCase()}`),
      ``,
      `## SOURCES (${goal.sources.length})`,
    ]

    for (const source of goal.sources.slice(0, 10)) {
      lines.push(`- [${source.type}] ${source.author}: "${source.content.slice(0, 100)}..."`)
    }

    if (goal.perspectives) {
      lines.push(``, `## DEBATE POSITIONS`)
      lines.push(`**SIDE A:** ${goal.perspectives.sideA.position || 'TBD'}`)
      lines.push(`**SIDE B:** ${goal.perspectives.sideB.position || 'TBD'}`)
    }

    lines.push(``, `## READINESS: ${(goal.readiness.score * 100).toFixed(0)}%`)
    lines.push(`- Sources: ${goal.readiness.hasEnoughSources ? '✓' : '✗'}`)
    lines.push(`- Conflict: ${goal.readiness.hasConflict ? '✓' : '✗'}`)
    lines.push(`- 5Ws: ${goal.readiness.has5Ws ? '✓' : '✗'}`)
    lines.push(`- Verified: ${goal.readiness.isVerified ? '✓' : '✗'}`)

    return lines.join('\n')
  }
}

// ============================================
// PRODUCER FACTORY
// ============================================

export function createProducer(archetype: ProducerArchetype): Producer {
  return new Producer(archetype)
}

/**
 * Select the best producer for an opportunity
 */
export function selectBestProducer(opportunityType: string): ProducerArchetype {
  switch (opportunityType) {
    case 'conflict':
    case 'controversy':
      return 'drama_hunter'
    case 'breaking':
      return 'speed_demon'
    case 'rumor_spreading':
      return 'fact_checker'
    case 'developing':
    case 'milestone':
    case 'comeback':
      return 'storyteller'
    case 'single_perspective':
      return 'deep_diver'
    case 'consensus':
      return 'community_pulse'
    default:
      return 'storyteller'  // Default to narrative
  }
}
