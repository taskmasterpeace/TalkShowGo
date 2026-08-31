/**
 * PRODUCER-ORCHESTRATOR INTEGRATION
 *
 * This is the game-changer: Connects the Producer AI system to the Debate Orchestrator
 * to create professional, context-rich, engagement-optimized shows.
 *
 * Flow:
 * 1. Producer analyzes Twitter intelligence
 * 2. Creates production brief with 5Ws, angle, research
 * 3. Selects optimal hosts based on topic + producer personality
 * 4. Generates professional prompts with full context
 * 5. Orchestrates debate with emotional beats and pacing
 * 6. Quality gates ensure readiness before publishing
 */

import { Producer, ProductionGoal, ProducerArchetype, createProducer, PRODUCER_ARCHETYPES } from '../producers'
import { generateDebateConversation, saveConversation } from './orchestrator'
import { generateHostsForTopic, getAllHosts } from './host-generator'
import { supabase } from '@/lib/db'
import type { DebateHost, ShowFormat, ConversationTurn, EmotionalBeat } from './types'
import { analyzeTwitterActivity, TwitterActivity } from '../twitter-intelligence'

// ============================================
// PRODUCER-DRIVEN SHOW GENERATION
// ============================================

export interface ProducerShowRequest {
  producer_archetype: ProducerArchetype
  topic_id: string
  topic: string

  // Optional overrides
  host_ids?: string[]  // If null, producer auto-selects
  show_format_id?: string  // If null, producer decides
  target_duration_minutes?: number

  // Context
  twitter_activity?: TwitterActivity
  research_package_id?: string

  // Producer guidance
  editorial_notes?: string
}

export interface ProducerShowResult {
  show_run_id: string
  producer_name: string
  producer_archetype: ProducerArchetype
  production_brief: string

  format: ShowFormat
  hosts: DebateHost[]
  conversation: ConversationTurn[]

  intelligence_used: {
    tweets_analyzed: number
    entities_tracked: number
    claims_verified: number
  }

  readiness_score: number
  quality_gates: {
    hasEnoughSources: boolean
    hasConflict: boolean
    has5Ws: boolean
    isVerified: boolean
  }

  stats: {
    total_turns: number
    total_words: number
    total_tokens: number
    estimated_duration_minutes: number
    cost_usd: number
  }
}

/**
 * GAME-CHANGER: Full producer-driven show generation
 *
 * This is the "magic" function that makes the system autonomous and intelligent.
 */
export async function generateProducerShow(
  request: ProducerShowRequest
): Promise<ProducerShowResult> {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🎬 PRODUCER-DRIVEN SHOW GENERATION`)
  console.log(`Producer: ${request.producer_archetype}`)
  console.log(`Topic: ${request.topic}`)
  console.log('='.repeat(80))

  // STEP 1: Initialize Producer
  const producer = createProducer(request.producer_archetype)
  console.log(`\n[Producer] ${producer.profile.name} is analyzing the opportunity...`)

  // STEP 2: Get Twitter Intelligence (PRIMARY SOURCE)
  let twitterActivity: TwitterActivity
  if (request.twitter_activity) {
    twitterActivity = request.twitter_activity
  } else {
    console.log(`[Producer] Fetching Twitter intelligence for topic_id: ${request.topic_id}`)
    twitterActivity = await analyzeTwitterActivity(request.topic_id, {
      hoursBack: 72,
      minEngagement: 10,
      maxTweets: 200
    })
  }

  console.log(`[Producer] Analyzed ${twitterActivity.tweets_analyzed} tweets`)
  console.log(`[Producer] Found ${twitterActivity.discussion_topics.length} discussion topics`)
  console.log(`[Producer] Identified ${twitterActivity.entities.length} key entities`)

  // STEP 3: Producer analyzes opportunity and creates production goal
  const opportunity = {
    headline: request.topic,
    description: twitterActivity.discussion_topics[0]?.topic || request.topic,
    type: detectOpportunityType(twitterActivity),
    signals: twitterActivity.trending_tweets.map(t => ({
      source_type: 'tweet' as const,
      source_id: t.tweet_id,
      signal_type: 'viral' as const,
      content_preview: t.text,
      strength: t.engagement / 1000
    })),
    confidence: calculateConfidence(twitterActivity)
  }

  console.log(`[Producer] Opportunity type: ${opportunity.type}`)

  const decision = producer.analyzeOpportunity(opportunity)
  console.log(`[Producer] Decision: ${decision.shouldProduce ? '✅ PRODUCE' : '❌ SKIP'}`)
  console.log(`[Producer] Format: ${decision.suggestedFormat}`)
  console.log(`[Producer] Reasoning: ${decision.reasoning}`)

  if (!decision.shouldProduce) {
    throw new Error(`Producer ${producer.profile.name} declined to produce: ${decision.reasoning}`)
  }

  // STEP 4: Create production goal
  const productionGoal = producer.createProductionGoal(opportunity, decision.suggestedFormat)

  // Add Twitter sources to production goal
  for (const tweet of twitterActivity.trending_tweets.slice(0, 10)) {
    producer.addSource({
      type: 'tweet',
      content: tweet.text,
      author: `@${tweet.author_handle}`,
      credibility: tweet.engagement > 100 ? 0.8 : 0.6,
      timestamp: tweet.timestamp,
      sentiment: undefined,
      stance: undefined
    })
  }

  // Update 5Ws from Twitter intelligence
  producer.update5Ws({
    who: twitterActivity.entities.slice(0, 5).map(e => e.name),
    what: twitterActivity.discussion_topics[0]?.topic || request.topic,
    when: 'Last 72 hours',
    why: `High engagement topic with ${twitterActivity.tweets_analyzed} tweets discussing this`
  })

  console.log(`\n[Producer] Production Brief Generated:`)
  console.log(producer.generateBrief())

  // STEP 5: Select or generate hosts
  let hosts: DebateHost[]

  if (request.host_ids && request.host_ids.length > 0) {
    // User specified hosts
    console.log(`\n[Producer] Using user-specified hosts: ${request.host_ids.join(', ')}`)
    const hostPromises = request.host_ids.map(id =>
      supabase.from('debate_hosts').select('*').eq('id', id).single()
    )
    const results = await Promise.all(hostPromises)
    hosts = results.map(r => r.data).filter(Boolean) as DebateHost[]
  } else {
    // Producer auto-selects hosts based on intelligence
    console.log(`\n[Producer] Auto-selecting hosts for debate...`)

    // Check if we have existing hosts that match this topic
    const existingHosts = await getAllHosts({
      tags: [twitterActivity.niche],
      active_only: true
    })

    if (existingHosts.length >= 2) {
      console.log(`[Producer] Found ${existingHosts.length} existing hosts for this niche`)
      hosts = selectOptimalHosts(existingHosts, twitterActivity, producer, 2)
    } else {
      console.log(`[Producer] Generating new hosts for this topic...`)
      hosts = await generateHostsForTopic({
        topic: request.topic,
        num_hosts: productionGoal.formatConfig.hostCount === 'variable' ? 2 : productionGoal.formatConfig.hostCount,
        topic_context: {
          twitter_sentiment: twitterActivity.discussion_topics[0]?.sentiment,
          key_quotes: twitterActivity.discussion_topics[0]?.key_quotes,
          engagement: twitterActivity.tweets_analyzed
        }
      })
    }
  }

  console.log(`\n[Producer] Selected ${hosts.length} hosts:`)
  hosts.forEach((host, i) => {
    console.log(`  ${i + 1}. ${host.name} (${host.archetype})`)
    console.log(`     Bio: ${host.bio}`)
  })

  // STEP 6: Get or create show format
  let showFormat: ShowFormat

  if (request.show_format_id) {
    const { data, error } = await supabase
      .from('show_formats')
      .select('*')
      .eq('id', request.show_format_id)
      .single()
    if (error || !data) {
      throw new Error(`Show format not found: ${request.show_format_id}`)
    }
    showFormat = data
  } else {
    // Create format based on producer's decision
    const formatData = mapProducerFormatToShowFormat(decision.suggestedFormat)
    const { data, error } = await supabase
      .from('show_formats')
      .insert(formatData)
      .select()
      .single()
    if (error || !data) {
      throw new Error(`Failed to create show format: ${error?.message}`)
    }
    showFormat = data
  }

  // STEP 7: Create show run record with producer context
  const { data: showRun } = await supabase
    .from('debate_show_runs')
    .insert({
      topic_id: request.topic_id,
      topic: request.topic,
      show_format_id: showFormat.id,
      host_ids: hosts.map(h => h.id),
      research_package_id: request.research_package_id,
      producer_instructions: buildProducerInstructions(producer, productionGoal, twitterActivity),
      emotional_beats: generateEmotionalBeats(twitterActivity, productionGoal),
      status: 'prep_running',
      metadata: {
        producer_archetype: request.producer_archetype,
        producer_name: producer.profile.name,
        opportunity_type: opportunity.type,
        twitter_intelligence: {
          tweets_analyzed: twitterActivity.tweets_analyzed,
          entities_count: twitterActivity.entities.length,
          discussion_topics: twitterActivity.discussion_topics.length
        }
      }
    })
    .select()
    .single()

  if (!showRun) {
    throw new Error('Failed to create show run record')
  }

  console.log(`\n[Producer] Created show run: ${showRun.id}`)

  // STEP 8: Generate professional prompts with full context
  const preparationResults = hosts.map(host => ({
    host_id: host.id,
    stance: buildHostStance(host, twitterActivity, productionGoal),
    talking_points: buildTalkingPoints(host, twitterActivity, productionGoal),
    questions_for_opponents: buildQuestions(host, twitterActivity),
    research_requests: [],
    model_used: host.preferred_model,
    tokens_used: 0
  }))

  // STEP 9: Generate conversation with producer context
  console.log(`\n[Producer] Generating debate conversation...`)

  await supabase
    .from('debate_show_runs')
    .update({ status: 'debate_running' })
    .eq('id', showRun.id)

  const conversation = await generateDebateConversation({
    format: showFormat,
    hosts,
    preparationResults,
    topic: request.topic,
    targetDurationMinutes: request.target_duration_minutes || productionGoal.targetDurationMinutes,
    emotionalBeats: productionGoal.formatConfig.structure.map((segment, i) => ({
      type: mapSegmentToEmotionalBeatType(segment),
      percent: Math.floor((i / productionGoal.formatConfig.structure.length) * 100),
      description: segment.replace('_', ' ')
    })),
    // INJECT PRODUCER CONTEXT
    producerContext: {
      production_brief: producer.generateBrief(),
      angle: productionGoal.angle,
      tone: productionGoal.tone,
      twitter_intelligence: twitterActivity,
      key_quotes: twitterActivity.trending_tweets.slice(0, 5).map(t => t.text)
    }
  })

  // STEP 10: Save conversation
  await saveConversation(showRun.id, conversation)

  // STEP 11: Calculate stats and quality metrics
  const totalWords = conversation.reduce((sum, turn) => sum + turn.text.split(' ').length, 0)
  const totalTokens = conversation.reduce((sum, turn) => sum + (turn.tokens_used || 0), 0)
  const estimatedMinutes = Math.ceil(totalWords / 150)
  const costUsd = totalTokens * 0.000014 // DeepSeek pricing

  // Check readiness
  const isReady = producer.isReadyToPublish()
  const readinessScore = productionGoal.readiness.score

  await supabase
    .from('debate_show_runs')
    .update({
      status: isReady ? 'completed' : 'needs_review',
      total_tokens_used: totalTokens,
      cost_usd: costUsd,
      completed_at: new Date().toISOString(),
      metadata: {
        ...showRun.metadata,
        readiness_score: readinessScore,
        quality_gates: productionGoal.readiness
      }
    })
    .eq('id', showRun.id)

  console.log(`\n✅ Producer show generation complete!`)
  console.log(`   Readiness: ${(readinessScore * 100).toFixed(0)}%`)
  console.log(`   Status: ${isReady ? '✅ READY TO PUBLISH' : '⚠️  NEEDS REVIEW'}`)
  console.log(`   Turns: ${conversation.length}`)
  console.log(`   Words: ${totalWords}`)
  console.log(`   Duration: ~${estimatedMinutes} min`)
  console.log(`   Cost: $${costUsd.toFixed(4)}`)

  return {
    show_run_id: showRun.id,
    producer_name: producer.profile.name,
    producer_archetype: request.producer_archetype,
    production_brief: producer.generateBrief(),

    format: showFormat,
    hosts,
    conversation,

    intelligence_used: {
      tweets_analyzed: twitterActivity.tweets_analyzed,
      entities_tracked: twitterActivity.entities.length,
      claims_verified: twitterActivity.claims.length
    },

    readiness_score: readinessScore,
    quality_gates: productionGoal.readiness,

    stats: {
      total_turns: conversation.length,
      total_words: totalWords,
      total_tokens: totalTokens,
      estimated_duration_minutes: estimatedMinutes,
      cost_usd: costUsd
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function detectOpportunityType(twitter: TwitterActivity): string {
  // Detect if there's conflict in sentiment
  const hasMixedSentiment = twitter.discussion_topics.some(t => t.sentiment === 'mixed')
  const hasHighEngagement = twitter.tweets_analyzed > 50

  if (hasMixedSentiment && hasHighEngagement) return 'controversy'
  if (hasHighEngagement) return 'breaking'
  return 'developing'
}

function calculateConfidence(twitter: TwitterActivity): number {
  // Confidence based on data quality
  const tweetScore = Math.min(twitter.tweets_analyzed / 100, 1)
  const topicScore = Math.min(twitter.discussion_topics.length / 3, 1)
  const entityScore = Math.min(twitter.entities.length / 5, 1)

  return (tweetScore + topicScore + entityScore) / 3
}

function selectOptimalHosts(
  availableHosts: DebateHost[],
  twitter: TwitterActivity,
  producer: Producer,
  count: number
): DebateHost[] {
  // Select hosts with contrasting personalities for drama
  // Producer personality influences selection

  if (producer.profile.archetype === 'drama_hunter') {
    // Want maximum conflict
    const aggressive = availableHosts.filter(h => h.aggression > 70)
    const analytical = availableHosts.filter(h => h.analytical_depth > 70)
    return [...aggressive.slice(0, 1), ...analytical.slice(0, 1)]
  }

  // Default: pick diverse personalities
  const sorted = [...availableHosts].sort((a, b) => {
    const diversityA = Math.abs(a.aggression - 50) + Math.abs(a.humor - 50)
    const diversityB = Math.abs(b.aggression - 50) + Math.abs(b.humor - 50)
    return diversityB - diversityA
  })

  return sorted.slice(0, count)
}

function buildProducerInstructions(
  producer: Producer,
  goal: ProductionGoal,
  twitter: TwitterActivity
): string {
  return `
PRODUCER: ${producer.profile.name} (${producer.profile.archetype})
PRODUCTION ANGLE: ${goal.angle}
TONE: ${goal.tone}

CONTEXT FROM TWITTER:
- ${twitter.tweets_analyzed} tweets analyzed
- Top discussion: ${twitter.discussion_topics[0]?.topic}
- Sentiment: ${twitter.discussion_topics[0]?.sentiment}
- Key entities: ${twitter.entities.slice(0, 5).map(e => e.name).join(', ')}

SHOW STRUCTURE:
${goal.formatConfig.structure.map((s, i) => `${i + 1}. ${s.replace('_', ' ').toUpperCase()}`).join('\n')}

PRODUCER GUIDANCE:
${producer.profile.description}
`
}

function generateEmotionalBeats(
  twitter: TwitterActivity,
  goal: ProductionGoal
): EmotionalBeat[] {
  const beats: EmotionalBeat[] = []
  const structure = goal.formatConfig.structure

  structure.forEach((segment, index) => {
    beats.push({
      type: mapSegmentToEmotionalBeatType(segment),
      percent: Math.floor((index / structure.length) * 100),
      description: `${segment.replace('_', ' ')} - ${getSegmentGuidance(segment, twitter)}`
    })
  })

  return beats
}

function mapSegmentToEmotionalBeatType(segment: string): EmotionalBeat['type'] {
  if (segment.includes('rebuttal') || segment.includes('challenge')) return 'tension'
  if (segment.includes('conclusion') || segment.includes('wrap')) return 'resolution'
  if (segment.includes('intro') || segment.includes('setup')) return 'investigation'
  if (segment.includes('climax') || segment.includes('reveal')) return 'revelation'
  return 'outrage'
}

function getSegmentGuidance(segment: string, twitter: TwitterActivity): string {
  if (segment.includes('intro')) {
    return `Set up the controversy around: ${twitter.discussion_topics[0]?.topic}`
  }
  if (segment.includes('rebuttal')) {
    return `Reference actual tweets: "${twitter.trending_tweets[0]?.text.slice(0, 50)}..."`
  }
  return 'Maintain energy and engagement'
}

function buildHostStance(
  host: DebateHost,
  twitter: TwitterActivity,
  goal: ProductionGoal
): string {
  const topic = twitter.discussion_topics[0]
  if (!topic) return `I believe ${host.bio}`

  // Assign stance based on host personality
  if (host.opinion_strength > 70) {
    return `I STRONGLY believe ${topic.key_quotes[0] || topic.topic}`
  }

  return `I think ${topic.topic} because ${host.bio}`
}

function buildTalkingPoints(
  host: DebateHost,
  twitter: TwitterActivity,
  goal: ProductionGoal
): string[] {
  const points: string[] = []
  const topic = twitter.discussion_topics[0]

  if (topic) {
    // Use actual quotes from Twitter
    topic.key_quotes.slice(0, 3).forEach((quote, i) => {
      points.push(`Point ${i + 1}: "${quote}" - this proves my stance`)
    })
  }

  // Add entity mentions
  if (twitter.entities.length > 0) {
    points.push(`Evidence: Look at ${twitter.entities[0].name} - ${twitter.entities[0].mention_count} mentions`)
  }

  return points
}

function buildQuestions(host: DebateHost, twitter: TwitterActivity): string[] {
  return [
    `How do you explain ${twitter.trending_tweets[0]?.text.slice(0, 50)}?`,
    `What about ${twitter.entities[0]?.name}?`
  ]
}

function mapProducerFormatToShowFormat(format: string): any {
  return {
    format_type: format === 'talk_show' ? 'debate' : 'panel',
    name: format.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    target_duration_minutes: 15,
    turn_taking_style: 'balanced',
    allow_interruptions: format === 'talk_show'
  }
}
