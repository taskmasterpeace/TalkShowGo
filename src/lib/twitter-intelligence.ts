/**
 * Twitter Intelligence Module
 *
 * Analyzes tweets_raw to extract trending discussions, entities, and claims.
 * Twitter is the PRIMARY intelligence source - tells us what's happening RIGHT NOW.
 *
 * Works for ANY niche (not just battle rap).
 */

import { getFreshIntelligence, FreshTweet } from './intelligence'
import { chatJSON, ChatMessage } from './presidium-ai'
import { supabase } from './db'
import type { QueryPlan } from './query-interpreter'

// ============================================
// TYPES
// ============================================

export interface TwitterActivity {
  // THE TWEETS (primary story content)
  trending_tweets: Array<{
    tweet_id: string
    text: string
    author_handle: string
    author_name: string
    engagement: number
    timestamp: Date
    context: string  // Why this tweet matters
  }>

  // WHAT'S BEING DISCUSSED (from tweet analysis)
  discussion_topics: Array<{
    topic: string
    tweet_count: number
    engagement_total: number
    key_quotes: string[]  // Direct tweet quotes
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  }>

  // ENTITIES MENTIONED (people, places, things)
  entities: Array<{
    name: string
    type: string
    mention_count: number
    engagement: number
    sample_tweets: string[]  // Actual tweet texts mentioning this entity
  }>

  // CLAIMS BEING MADE (extracted from tweet content)
  claims: Array<{
    claim_text: string
    type: string
    supporting_tweets: Array<{tweet_id: string, text: string}>
    engagement: number
  }>

  // GENERATED QUERIES (for YouTube research)
  youtube_queries: string[]

  // METADATA
  timeframe: {start: Date, end: Date}
  tweets_analyzed: number
  top_sources: string[]
  niche: string
}

interface TweetAnalysisResult {
  discussion_topics: Array<{
    topic: string
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
    key_quotes: string[]
  }>
  entities: Array<{
    name: string
    type: string
    mentions: number
  }>
  claims: Array<{
    claim: string
    type: string
    supporting_tweet_ids: string[]
  }>
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Analyze Twitter activity from tweets_raw table
 * This is the PRIMARY intelligence source for story generation
 */
export async function analyzeTwitterActivity(
  topicId: string,
  options?: {
    hoursBack?: number
    minEngagement?: number
    maxTweets?: number
  }
): Promise<TwitterActivity> {
  const hoursBack = options?.hoursBack || 72
  const minEngagement = options?.minEngagement || 10
  const maxTweets = options?.maxTweets || 200

  console.log(`[TwitterActivity] Analyzing tweets for topic_id=${topicId} (last ${hoursBack} hours)`)

  // STEP 1: Get fresh tweets from tweets_raw
  const tweets = await getFreshIntelligence(topicId, {
    hoursBack,
    minEngagement,
    limit: maxTweets,
    excludeRetweets: true
  })

  if (tweets.length === 0) {
    throw new Error('NO_TWEETS_FOUND')
  }

  console.log(`[TwitterActivity] Found ${tweets.length} tweets to analyze`)

  // STEP 2: Analyze tweets with LLM (in batches)
  const analysisResult = await analyzeTweetsWithLLM(tweets)

  // Validate analysis results
  if (analysisResult.discussion_topics.length === 0 && analysisResult.entities.length === 0) {
    throw new Error('NO_TOPICS_OR_ENTITIES_EXTRACTED')
  }

  // STEP 3: Enrich with database entities if available
  const enrichedEntities = await enrichEntitiesFromDatabase(
    analysisResult.entities,
    topicId
  )

  // STEP 4: Build trending tweets list (top by engagement)
  const trendingTweets = tweets
    .map(t => ({
      tweet_id: t.tweet_id,
      text: t.text,
      author_handle: t.author_handle,
      author_name: t.author_name,
      engagement: t.metrics_likes + (t.metrics_retweets * 2),
      timestamp: new Date(t.tweet_created_at),
      context: determineTwitterContext(t, analysisResult)
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 20)

  // STEP 5: Build discussion topics with engagement totals
  const discussionTopics = buildDiscussionTopics(
    analysisResult.discussion_topics,
    tweets
  )

  // STEP 6: Build claims with supporting tweets
  const claims = buildClaimsWithTweets(
    analysisResult.claims,
    tweets
  )

  // STEP 7: Generate YouTube queries from entities and topics
  const youtubeQueries = generateYouTubeQueries(
    enrichedEntities,
    discussionTopics
  )

  if (youtubeQueries.length === 0) {
    console.warn('[TwitterActivity] No YouTube queries generated, may need fallback')
  }

  // STEP 8: Calculate timeframe
  const timestamps = tweets.map(t => new Date(t.tweet_created_at).getTime())
  const timeframe = {
    start: new Date(Math.min(...timestamps)),
    end: new Date(Math.max(...timestamps))
  }

  // STEP 9: Get top sources
  const sourceCounts = new Map<string, number>()
  tweets.forEach(t => {
    const count = sourceCounts.get(t.author_handle) || 0
    sourceCounts.set(t.author_handle, count + 1)
  })
  const topSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([handle]) => handle)

  // STEP 10: Get niche from database
  const { data: topicData } = await supabase
    .from('topics')
    .select('name')
    .eq('id', topicId)
    .single()

  const niche = topicData?.name || 'general'

  return {
    trending_tweets: trendingTweets,
    discussion_topics: discussionTopics,
    entities: enrichedEntities,
    claims,
    youtube_queries: youtubeQueries,
    timeframe,
    tweets_analyzed: tweets.length,
    top_sources: topSources,
    niche
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Analyze tweets using LLM to extract topics, entities, and claims
 */
async function analyzeTweetsWithLLM(
  tweets: FreshTweet[]
): Promise<TweetAnalysisResult> {
  const BATCH_SIZE = 25
  const allTopics: Map<string, {sentiment: string, quotes: Set<string>}> = new Map()
  const allEntities: Map<string, {type: string, count: number}> = new Map()
  const allClaims: Array<{claim: string, type: string, tweetIds: Set<string>}> = []

  // Process tweets in batches
  for (let i = 0; i < tweets.length; i += BATCH_SIZE) {
    const batch = tweets.slice(i, i + BATCH_SIZE)
    console.log(`[TwitterActivity] Analyzing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tweets.length / BATCH_SIZE)}`)

    try {
      const result = await analyzeTweetBatch(batch)

      // Merge topics
      for (const topic of result.topics) {
        const existing = allTopics.get(topic.name) || {sentiment: 'neutral', quotes: new Set()}
        topic.quotes.forEach(q => existing.quotes.add(q))
        // Use most negative sentiment if mixed
        if (topic.sentiment === 'negative' || existing.sentiment === 'negative') {
          existing.sentiment = 'negative'
        } else if (topic.sentiment === 'positive' && existing.sentiment !== 'negative') {
          existing.sentiment = 'positive'
        }
        allTopics.set(topic.name, existing)
      }

      // Merge entities
      for (const entity of result.entities) {
        const existing = allEntities.get(entity.name) || {type: entity.type, count: 0}
        existing.count += entity.mentions
        allEntities.set(entity.name, existing)
      }

      // Merge claims
      for (const claim of result.claims) {
        const existingClaim = allClaims.find(c => c.claim.toLowerCase() === claim.text.toLowerCase())
        if (existingClaim) {
          claim.tweet_ids.forEach(id => existingClaim.tweetIds.add(id))
        } else {
          allClaims.push({
            claim: claim.text,
            type: claim.type,
            tweetIds: new Set(claim.tweet_ids)
          })
        }
      }
    } catch (error) {
      console.error(`[TwitterActivity] Batch analysis error:`, error)
      // Continue with other batches
    }
  }

  // Convert to final format
  return {
    discussion_topics: Array.from(allTopics.entries()).map(([topic, data]) => ({
      topic,
      sentiment: data.sentiment as any,
      key_quotes: Array.from(data.quotes).slice(0, 5)
    })),
    entities: Array.from(allEntities.entries()).map(([name, data]) => ({
      name,
      type: data.type,
      mentions: data.count
    })),
    claims: allClaims.map(c => ({
      claim: c.claim,
      type: c.type,
      supporting_tweet_ids: Array.from(c.tweetIds)
    }))
  }
}

/**
 * Analyze a single batch of tweets with LLM
 */
async function analyzeTweetBatch(tweets: FreshTweet[]): Promise<{
  topics: Array<{name: string, sentiment: string, quotes: string[]}>
  entities: Array<{name: string, type: string, mentions: number}>
  claims: Array<{text: string, type: string, tweet_ids: string[]}>
}> {
  const tweetTexts = tweets.map((t, i) =>
    `[${i}] @${t.author_handle}: ${t.text}`
  ).join('\n\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are analyzing tweets to extract trending topics, entities, and claims.
Focus on what people are DISCUSSING right now, not just extracting entities.

Return JSON with:
- topics: [{name, sentiment, quotes}] - What discussions are happening
- entities: [{name, type, mentions}] - People, organizations, events mentioned
- claims: [{text, type, tweet_ids}] - Claims being made (factual/opinion/rumor)

Be thorough but concise. Focus on high-engagement content.`
    },
    {
      role: 'user',
      content: `Analyze these tweets:\n\n${tweetTexts}\n\nExtract topics, entities, and claims.`
    }
  ]

  return await chatJSON(messages, {
    model: 'deepseek-coder-v2:16b',
    temperature: 0.3
  })
}

/**
 * Enrich entities with database data
 */
async function enrichEntitiesFromDatabase(
  entities: Array<{name: string, type: string, mentions: number}>,
  topicId: string
): Promise<TwitterActivity['entities']> {
  if (entities.length === 0) return []

  // Query database for known entities
  // Sanitize names to prevent SQL injection from LLM-generated entity names
  const names = entities.map(e => e.name.replace(/[^a-zA-Z0-9\s\-']/g, '')).filter(n => n.length > 0)
  if (names.length === 0) return []
  const { data: dbEntities } = await supabase
    .from('entities')
    .select('canonical_name, entity_type, metadata')
    .eq('topic_id', topicId)
    .or(names.map(n => `canonical_name.ilike.%${n}%`).join(','))

  // Match and enrich
  return entities.map(entity => {
    const dbMatch = dbEntities?.find(db =>
      db.canonical_name.toLowerCase().includes(entity.name.toLowerCase()) ||
      entity.name.toLowerCase().includes(db.canonical_name.toLowerCase())
    )

    return {
      name: dbMatch?.canonical_name || entity.name,
      type: dbMatch?.entity_type || entity.type,
      mention_count: entity.mentions,
      engagement: entity.mentions * 10,  // Approximate
      sample_tweets: []  // Will be filled later if needed
    }
  })
}

/**
 * Build discussion topics with engagement totals
 */
function buildDiscussionTopics(
  topics: Array<{topic: string, sentiment: string, key_quotes: string[]}>,
  tweets: FreshTweet[]
): TwitterActivity['discussion_topics'] {
  return topics.map(topic => {
    // Find tweets discussing this topic
    const relatedTweets = tweets.filter(t =>
      t.text.toLowerCase().includes(topic.topic.toLowerCase())
    )

    const engagementTotal = relatedTweets.reduce((sum, t) =>
      sum + t.metrics_likes + (t.metrics_retweets * 2), 0
    )

    return {
      topic: topic.topic,
      tweet_count: relatedTweets.length,
      engagement_total: engagementTotal,
      key_quotes: topic.key_quotes,
      sentiment: topic.sentiment as any
    }
  })
}

/**
 * Build claims with supporting tweet references
 */
function buildClaimsWithTweets(
  claims: Array<{claim: string, type: string, supporting_tweet_ids: string[]}>,
  tweets: FreshTweet[]
): TwitterActivity['claims'] {
  return claims.map(claim => {
    const supportingTweets = tweets
      .filter(t => claim.supporting_tweet_ids.includes(t.tweet_id))
      .map(t => ({tweet_id: t.tweet_id, text: t.text}))

    const engagement = supportingTweets.reduce((sum, t) => {
      const tweet = tweets.find(tw => tw.tweet_id === t.tweet_id)
      return sum + (tweet ? tweet.metrics_likes + (tweet.metrics_retweets * 2) : 0)
    }, 0)

    return {
      claim_text: claim.claim,
      type: claim.type,
      supporting_tweets: supportingTweets,
      engagement
    }
  })
}

/**
 * Generate YouTube search queries from entities and topics
 */
function generateYouTubeQueries(
  entities: TwitterActivity['entities'],
  topics: TwitterActivity['discussion_topics']
): string[] {
  const queries: string[] = []

  // Sort entities by mention count
  const topEntities = entities
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 5)

  // Generate entity pair queries (overlaps)
  for (let i = 0; i < Math.min(3, topEntities.length); i++) {
    for (let j = i + 1; j < Math.min(4, topEntities.length); j++) {
      queries.push(`${topEntities[i].name} ${topEntities[j].name}`)
    }
  }

  // Generate interview queries for people
  topEntities
    .filter(e => e.type === 'person' || e.type === 'battler' || e.type === 'rapper')
    .slice(0, 3)
    .forEach(entity => {
      queries.push(`${entity.name} interview`)
    })

  // Generate topic + entity queries
  const topTopics = topics
    .sort((a, b) => b.engagement_total - a.engagement_total)
    .slice(0, 2)

  for (const topic of topTopics) {
    for (const entity of topEntities.slice(0, 2)) {
      queries.push(`${entity.name} ${topic.topic}`)
    }
  }

  // Deduplicate and limit
  return Array.from(new Set(queries)).slice(0, 12)
}

/**
 * Determine why a tweet is important (context)
 */
function determineTwitterContext(
  tweet: FreshTweet,
  analysis: TweetAnalysisResult
): string {
  // Check if tweet is about a discussion topic
  for (const topic of analysis.discussion_topics) {
    if (tweet.text.toLowerCase().includes(topic.topic.toLowerCase())) {
      return `Discusses ${topic.topic}`
    }
  }

  // Check if tweet mentions entities
  for (const entity of analysis.entities) {
    if (tweet.text.toLowerCase().includes(entity.name.toLowerCase())) {
      return `Mentions ${entity.name}`
    }
  }

  // Check if tweet contains a claim
  for (const claim of analysis.claims) {
    if (claim.supporting_tweet_ids.includes(tweet.tweet_id)) {
      return `Makes claim: ${claim.claim.substring(0, 50)}...`
    }
  }

  return 'High engagement'
}

// ============================================
// QUERY PLAN CONVERSION
// ============================================

/**
 * Convert TwitterActivity to QueryPlan format for compatibility
 */
export function convertTwitterActivityToQueryPlan(
  activity: TwitterActivity,
  fallbackQuery: string
): QueryPlan {
  const topEntities = activity.entities
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5)

  const topTopics = activity.discussion_topics
    .sort((a, b) => b.engagement_total - a.engagement_total)
    .slice(0, 3)

  // Fallback queries if youtube_queries is empty
  let primaryQueries = activity.youtube_queries.slice(0, 3)
  let secondaryQueries = activity.youtube_queries.slice(3, 6)

  if (primaryQueries.length === 0) {
    // Generate basic queries from entities/topics
    if (topEntities.length > 0 && topTopics.length > 0) {
      primaryQueries = [
        `${topEntities[0].name} ${topTopics[0].topic}`,
        fallbackQuery
      ]
    } else if (topEntities.length > 0) {
      primaryQueries = topEntities.slice(0, 3).map(e => e.name)
    } else {
      primaryQueries = [fallbackQuery]
    }
  }

  return {
    original_query: fallbackQuery,
    interpreted_as: `Trending on Twitter: ${topTopics.map(t => t.topic).join(', ')}`,
    primary_queries: primaryQueries,
    secondary_queries: secondaryQueries,
    entity_lookups: topEntities.map(e => e.name),
    search_type: 'youtube_only',
    expected_content: 'mixed',
    entities: topEntities.map(e => ({
      name: e.name,
      type: (e.type === 'person' || e.type === 'organization' || e.type === 'event' ? e.type : 'unknown') as 'person' | 'organization' | 'event' | 'unknown',
      needs_context: true
    })),
    keywords_must_have: topTopics.map(t => t.topic),
    keywords_nice_to_have: activity.discussion_topics.slice(3, 8).map(t => t.topic),
    exclude_patterns: [],
    involves_legal_allegations: activity.claims.some(c =>
      c.claim_text.toLowerCase().includes('arrest') ||
      c.claim_text.toLowerCase().includes('court') ||
      c.claim_text.toLowerCase().includes('snitch')
    ),
    document_search_recommended: false,
    real_name_search_needed: false
  }
}
