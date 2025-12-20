/**
 * Twitter Sentiment Integration
 *
 * Workflow:
 * 1. Extract event date from YouTube research (video publish dates)
 * 2. Search Twitter for reactions from that specific time window
 * 3. Analyze sentiment and extract key quotes
 *
 * Cost: ~$0.00015 per search call (~0.015 cents)
 * Strategy: Only call Twitter when we have a specific date range
 */

import { getTwitterClient, buildBattleRapSearchQuery, Tweet } from './twitter-api'
import { supabase } from './db'

// ============================================
// TYPES
// ============================================

export interface EventTimeframe {
  event_date: Date           // Best estimate of when it happened
  confidence: 'high' | 'medium' | 'low'
  source: 'video_publish_date' | 'transcript_mention' | 'inferred'
  notes?: string
}

export interface TwitterSentiment {
  timeframe: EventTimeframe
  search_query: string
  tweets_found: number
  sentiment: {
    positive: number
    negative: number
    neutral: number
  }
  top_reactions: TwitterReaction[]
  key_quotes: string[]
  cost_cents: number
}

export interface TwitterReaction {
  text: string
  author: string
  author_followers: number
  likes: number
  retweets: number
  created_at: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
}

export interface TwitterSentimentConfig {
  entities: string[]          // People/topics to search for
  event_timeframe: EventTimeframe
  max_tweets?: number         // Default 40 (2 API calls)
  min_likes?: number          // Minimum engagement
  include_replies?: boolean   // Include reply chains
  trusted_accounts?: string[] // Battle rap accounts to prioritize
}

// ============================================
// DATE EXTRACTION
// ============================================

/**
 * Extract event date from research results
 *
 * Logic:
 * 1. Look at video publish dates - earliest relevant video often posted right after event
 * 2. Cluster videos by publish date - spike in content = event date
 * 3. Look for date mentions in transcripts
 */
export function extractEventTimeframe(
  videos: Array<{
    title: string
    published_at?: string
    channel?: string
    relevance_score?: number
  }>
): EventTimeframe | null {
  if (videos.length === 0) {
    return null
  }

  // Get videos with publish dates
  const videosWithDates = videos
    .filter(v => v.published_at)
    .map(v => ({
      ...v,
      date: new Date(v.published_at!)
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (videosWithDates.length === 0) {
    return null
  }

  // Strategy 1: Find date cluster (multiple videos within 3 days = event)
  const dateClusters = clusterByDate(videosWithDates.map(v => v.date), 3)

  if (dateClusters.length > 0) {
    // Largest cluster is likely the event
    const largestCluster = dateClusters.sort((a, b) => b.dates.length - a.dates.length)[0]

    return {
      event_date: largestCluster.dates[0], // First video in cluster
      confidence: largestCluster.dates.length >= 3 ? 'high' : 'medium',
      source: 'video_publish_date',
      notes: `${largestCluster.dates.length} videos published within 3 days`
    }
  }

  // Strategy 2: Earliest video from a news/reaction channel
  const reactionChannels = ['jayblac', 'angryfan', '15mofe', 'hhir', 'rapgrid', 'champion']
  const newsVideo = videosWithDates.find(v =>
    reactionChannels.some(ch => v.channel?.toLowerCase().includes(ch))
  )

  if (newsVideo) {
    return {
      event_date: newsVideo.date,
      confidence: 'medium',
      source: 'video_publish_date',
      notes: `From reaction channel: ${newsVideo.channel}`
    }
  }

  // Strategy 3: Fall back to earliest video
  return {
    event_date: videosWithDates[0].date,
    confidence: 'low',
    source: 'video_publish_date',
    notes: 'Using earliest video publish date'
  }
}

/**
 * Cluster dates that are within N days of each other
 */
function clusterByDate(dates: Date[], maxDaysDiff: number): Array<{ dates: Date[] }> {
  if (dates.length === 0) return []

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const clusters: Array<{ dates: Date[] }> = []
  let currentCluster: Date[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const daysDiff = (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24)

    if (daysDiff <= maxDaysDiff) {
      currentCluster.push(sorted[i])
    } else {
      if (currentCluster.length >= 2) {
        clusters.push({ dates: currentCluster })
      }
      currentCluster = [sorted[i]]
    }
  }

  if (currentCluster.length >= 2) {
    clusters.push({ dates: currentCluster })
  }

  return clusters
}

// ============================================
// TWITTER SEARCH
// ============================================

/**
 * Search Twitter for reactions around an event date
 */
export async function searchTwitterSentiment(
  config: TwitterSentimentConfig
): Promise<TwitterSentiment | null> {
  const {
    entities,
    event_timeframe,
    max_tweets = 40,
    min_likes = 5,
    trusted_accounts = []
  } = config

  // Check if Twitter API is configured
  if (!process.env.TWITTER_API_KEY) {
    console.log('[TwitterSentiment] No API key configured, skipping')
    return null
  }

  console.log(`[TwitterSentiment] Searching for reactions around ${event_timeframe.event_date.toISOString().split('T')[0]}`)

  const client = getTwitterClient()

  // Build date range: event date -1 day to +7 days (reactions come in over a week)
  const since = new Date(event_timeframe.event_date)
  since.setDate(since.getDate() - 1)

  const until = new Date(event_timeframe.event_date)
  until.setDate(until.getDate() + 7)

  // Build search query
  const query = buildBattleRapSearchQuery({
    entities,
    accounts: trusted_accounts.length > 0 ? trusted_accounts : undefined,
    excludeRetweets: true,
    since,
    until,
    minLikes: min_likes
  })

  console.log(`[TwitterSentiment] Query: ${query}`)

  let allTweets: Tweet[] = []
  let cursor: string | undefined
  let apiCalls = 0
  const maxCalls = Math.ceil(max_tweets / 20)  // ~20 tweets per call

  try {
    // Paginate through results
    while (apiCalls < maxCalls) {
      const result = await client.searchTweets(query, {
        queryType: 'Top',  // Get most engaged tweets
        cursor
      })

      apiCalls++
      allTweets = [...allTweets, ...result.tweets]

      if (!result.hasMore || allTweets.length >= max_tweets) {
        break
      }

      cursor = result.cursor

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log(`[TwitterSentiment] Found ${allTweets.length} tweets (${apiCalls} API calls)`)

    // Analyze sentiment and extract key reactions
    const reactions = analyzeTweets(allTweets)
    const sentiment = calculateSentiment(reactions)
    const keyQuotes = extractKeyQuotes(reactions)

    // Cost: ~$0.00015 per call = 0.015 cents
    const costCents = apiCalls * 0.015

    return {
      timeframe: event_timeframe,
      search_query: query,
      tweets_found: allTweets.length,
      sentiment,
      top_reactions: reactions.slice(0, 10),
      key_quotes: keyQuotes,
      cost_cents: costCents
    }

  } catch (error) {
    console.error('[TwitterSentiment] Search error:', error)
    return null
  }
}

/**
 * Analyze tweets and classify sentiment
 */
function analyzeTweets(tweets: Tweet[]): TwitterReaction[] {
  return tweets
    .map(tweet => ({
      text: tweet.text,
      author: tweet.author.userName,
      author_followers: tweet.author.followersCount,
      likes: tweet.likeCount,
      retweets: tweet.retweetCount,
      created_at: tweet.createdAt,
      sentiment: classifySentiment(tweet.text)
    }))
    // Sort by engagement (likes + retweets)
    .sort((a, b) => (b.likes + b.retweets) - (a.likes + a.retweets))
}

/**
 * Simple sentiment classification based on keywords
 * In production, could use LLM for better accuracy
 */
function classifySentiment(text: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
  const lowerText = text.toLowerCase()

  const positiveWords = [
    'fire', 'crazy', 'goat', 'bodied', 'killed', 'won', 'clear', 'legend',
    'respect', 'amazing', 'incredible', 'best', 'undeniable', '🔥', '💯', 'w '
  ]
  const negativeWords = [
    'trash', 'mid', 'lost', 'choked', 'weak', 'boring', 'washed', 'overrated',
    'terrible', 'worst', 'disappointed', 'l ', 'corny', 'cringe'
  ]

  const posCount = positiveWords.filter(w => lowerText.includes(w)).length
  const negCount = negativeWords.filter(w => lowerText.includes(w)).length

  if (posCount > 0 && negCount > 0) return 'mixed'
  if (posCount > negCount) return 'positive'
  if (negCount > posCount) return 'negative'
  return 'neutral'
}

/**
 * Calculate overall sentiment distribution
 */
function calculateSentiment(reactions: TwitterReaction[]): TwitterSentiment['sentiment'] {
  const total = reactions.length || 1

  const positive = reactions.filter(r => r.sentiment === 'positive').length
  const negative = reactions.filter(r => r.sentiment === 'negative').length
  const neutral = reactions.filter(r => r.sentiment === 'neutral' || r.sentiment === 'mixed').length

  return {
    positive: Math.round((positive / total) * 100),
    negative: Math.round((negative / total) * 100),
    neutral: Math.round((neutral / total) * 100)
  }
}

/**
 * Extract quotable reactions for the story
 */
function extractKeyQuotes(reactions: TwitterReaction[]): string[] {
  return reactions
    .filter(r => {
      // Filter out very short tweets or ones with just links
      if (r.text.length < 20) return false
      if (r.text.startsWith('http')) return false
      return true
    })
    .slice(0, 5)
    .map(r => {
      // Clean up text
      let text = r.text
        .replace(/https?:\/\/\S+/g, '')  // Remove URLs
        .replace(/\n+/g, ' ')            // Replace newlines
        .trim()

      return `"${text}" - @${r.author} (${r.likes} likes)`
    })
}

// ============================================
// INTEGRATION WITH RESEARCH
// ============================================

/**
 * Get Twitter sentiment for research results
 * Called after YouTube research when we have a date
 */
export async function enrichResearchWithTwitter(
  research: {
    sources: Array<{
      title: string
      published_at?: string
      channel?: string
      relevance_score?: number
    }>
    query_plan?: {
      entities: Array<{ name: string; type?: string }>
    }
  },
  options?: {
    enabled?: boolean
    min_confidence?: 'low' | 'medium' | 'high'
  }
): Promise<TwitterSentiment | null> {
  // Check if enabled
  if (options?.enabled === false) {
    return null
  }

  // Check if Twitter API is configured
  if (!process.env.TWITTER_API_KEY) {
    console.log('[TwitterSentiment] Skipping - no API key')
    return null
  }

  // Extract event timeframe from video publish dates
  const timeframe = extractEventTimeframe(research.sources)

  if (!timeframe) {
    console.log('[TwitterSentiment] Could not determine event date')
    return null
  }

  // Check confidence threshold
  const minConfidence = options?.min_confidence || 'medium'
  const confidenceOrder = { low: 0, medium: 1, high: 2 }

  if (confidenceOrder[timeframe.confidence] < confidenceOrder[minConfidence]) {
    console.log(`[TwitterSentiment] Skipping - confidence ${timeframe.confidence} below threshold ${minConfidence}`)
    return null
  }

  // Get entity names from query plan
  const entities = research.query_plan?.entities
    ?.filter(e => e.type !== 'league' && e.type !== 'organization')
    ?.map(e => e.name) || []

  if (entities.length === 0) {
    console.log('[TwitterSentiment] No entities to search for')
    return null
  }

  // Battle rap trusted accounts for reactions
  const trustedAccounts = [
    'uraborofficial', 'KingOfTheDot', 'raborofficial',
    'JayBlac1', '15MinOfFame', 'HipHopIsReal',
    'RapGridTV', 'ChampionBattle'
  ]

  return searchTwitterSentiment({
    entities,
    event_timeframe: timeframe,
    trusted_accounts: trustedAccounts,
    min_likes: 10,
    max_tweets: 40
  })
}

/**
 * Format Twitter sentiment for story prompt
 */
export function formatTwitterForPrompt(sentiment: TwitterSentiment): string {
  if (!sentiment || sentiment.tweets_found === 0) {
    return ''
  }

  const dateStr = sentiment.timeframe.event_date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  let text = `\n=== TWITTER REACTIONS (${dateStr}) ===\n`
  text += `Sentiment: ${sentiment.sentiment.positive}% positive, ${sentiment.sentiment.negative}% negative, ${sentiment.sentiment.neutral}% neutral\n\n`

  if (sentiment.key_quotes.length > 0) {
    text += 'Top reactions:\n'
    for (const quote of sentiment.key_quotes) {
      text += `- ${quote}\n`
    }
  }

  text += `\n=== END TWITTER ===`

  return text
}
