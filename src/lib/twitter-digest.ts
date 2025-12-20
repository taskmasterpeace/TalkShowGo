/**
 * Twitter Digest Builder
 *
 * Formats Twitter trending data and reactions into script-ready format
 * for the Battle Rap Daily show.
 */

import { supabase } from './db'

// ============================================
// TYPES
// ============================================

export interface TwitterDigest {
  period_start: Date
  period_end: Date
  trending_topics: TrendingTopic[]
  sentiment: SentimentOverview
  top_tweets: HighlightTweet[]
  accounts_mentioned: AccountMention[]
  formatted_script: string
}

export interface TrendingTopic {
  topic: string
  mentions: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  sample_tweet?: string
  top_account?: string
}

export interface SentimentOverview {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed'
  positive_pct: number
  negative_pct: number
  neutral_pct: number
  description: string
}

export interface HighlightTweet {
  id: string
  author: string
  author_handle: string
  text: string
  likes: number
  retweets: number
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface AccountMention {
  handle: string
  name: string
  mentions: number
  context: string
}

export interface TwitterDigestOptions {
  hoursBack?: number
  startDate?: Date
  endDate?: Date
  targetDate?: string  // YYYY-MM-DD format
}

// ============================================
// SENTIMENT ANALYSIS
// ============================================

const POSITIVE_WORDS = [
  'fire', 'crazy', 'goat', 'bodied', 'killed', 'won', 'clear', 'legend',
  'respect', 'dope', 'hard', 'bars', 'classic', 'heat', 'insane'
]

const NEGATIVE_WORDS = [
  'trash', 'mid', 'lost', 'choked', 'weak', 'boring', 'washed', 'overrated',
  'corny', 'cringe', 'ass', 'terrible', 'awful', 'disappointed'
]

function classifySentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase()
  let positiveScore = 0
  let negativeScore = 0

  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) positiveScore++
  }
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) negativeScore++
  }

  if (positiveScore > negativeScore) return 'positive'
  if (negativeScore > positiveScore) return 'negative'
  return 'neutral'
}

function calculateOverallSentiment(tweets: { sentiment: string }[]): SentimentOverview {
  const total = tweets.length
  if (total === 0) {
    return {
      overall: 'neutral',
      positive_pct: 0,
      negative_pct: 0,
      neutral_pct: 100,
      description: 'No tweets to analyze'
    }
  }

  const positive = tweets.filter(t => t.sentiment === 'positive').length
  const negative = tweets.filter(t => t.sentiment === 'negative').length
  const neutral = total - positive - negative

  const positive_pct = Math.round((positive / total) * 100)
  const negative_pct = Math.round((negative / total) * 100)
  const neutral_pct = 100 - positive_pct - negative_pct

  let overall: 'positive' | 'negative' | 'neutral' | 'mixed'
  let description: string

  if (positive_pct > 50) {
    overall = 'positive'
    description = 'The community is feeling good about this'
  } else if (negative_pct > 50) {
    overall = 'negative'
    description = 'There\'s some criticism out there'
  } else if (positive_pct > 30 && negative_pct > 30) {
    overall = 'mixed'
    description = 'Opinions are divided on this one'
  } else {
    overall = 'neutral'
    description = 'The streets are watching but not saying much yet'
  }

  return { overall, positive_pct, negative_pct, neutral_pct, description }
}

// ============================================
// TOPIC EXTRACTION
// ============================================

const BATTLE_RAP_TOPICS = [
  'Cassidy', 'Eazy', 'URL', 'KOTD', 'RBE', 'TBL', 'Geechi', 'Rum Nitty',
  'Ave', 'Twork', 'Surf', 'Lux', 'Mook', 'Hitman', 'Hollow', 'Clips',
  'Arsonal', 'Viixen', 'QOTR', 'NOME', 'Summer Madness', 'JayBlac',
  'Chris Unbias', 'ARP', 'Math Hoffa', 'Daylyt'
]

function extractTopics(tweets: { text: string; likes: number }[]): TrendingTopic[] {
  const topicCounts = new Map<string, { count: number; tweets: string[]; topLikes: number; topTweet: string }>()

  for (const tweet of tweets) {
    const lower = tweet.text.toLowerCase()
    for (const topic of BATTLE_RAP_TOPICS) {
      if (lower.includes(topic.toLowerCase())) {
        const current = topicCounts.get(topic) || { count: 0, tweets: [], topLikes: 0, topTweet: '' }
        current.count++
        current.tweets.push(tweet.text)
        if (tweet.likes > current.topLikes) {
          current.topLikes = tweet.likes
          current.topTweet = tweet.text
        }
        topicCounts.set(topic, current)
      }
    }
  }

  return Array.from(topicCounts.entries())
    .map(([topic, data]) => {
      const sentiments = data.tweets.map(t => classifySentiment(t))
      const posCount = sentiments.filter(s => s === 'positive').length
      const negCount = sentiments.filter(s => s === 'negative').length

      let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
      if (posCount > negCount * 2) sentiment = 'positive'
      else if (negCount > posCount * 2) sentiment = 'negative'
      else if (posCount > 0 && negCount > 0) sentiment = 'mixed'
      else sentiment = 'neutral'

      return {
        topic,
        mentions: data.count,
        sentiment,
        sample_tweet: data.topTweet.slice(0, 200)
      }
    })
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10)
}

// ============================================
// SCRIPT FORMATTING
// ============================================

/**
 * Format the digest into a script section
 */
function formatDigestForScript(
  trending: TrendingTopic[],
  topTweets: HighlightTweet[],
  sentiment: SentimentOverview
): string {
  const lines: string[] = []

  // Intro
  lines.push('Before we get into the stories, let\'s see what\'s popping on Twitter.')
  lines.push('')

  // Top trending topics
  if (trending.length > 0) {
    const top3 = trending.slice(0, 3)
    for (const topic of top3) {
      const sentimentText = topic.sentiment === 'positive' ? 'The love is real'
        : topic.sentiment === 'negative' ? 'There\'s some heat'
        : topic.sentiment === 'mixed' ? 'Opinions are split'
        : 'People are watching'

      lines.push(`${topic.topic} is getting a lot of attention right now. ${sentimentText}.`)
    }
    lines.push('')
  }

  // Featured tweet
  if (topTweets.length > 0) {
    const featured = topTweets[0]
    lines.push(`@${featured.author_handle} said: "${featured.text}"`)
    lines.push(`That tweet got ${featured.likes.toLocaleString()} likes.`)
    lines.push('')
  }

  // Overall sentiment
  lines.push(sentiment.description)

  return lines.join('\n')
}

/**
 * Format a single tweet reaction for a story
 */
export function formatTweetReaction(tweet: HighlightTweet): string {
  return `The streets is talking. @${tweet.author_handle} said: "${tweet.text}" - that got ${tweet.likes.toLocaleString()} likes.`
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Build date range from options
 */
function buildDateRange(options: TwitterDigestOptions): { period_start: Date; period_end: Date } {
  // If targetDate provided (YYYY-MM-DD), use full day
  if (options.targetDate) {
    return {
      period_start: new Date(options.targetDate + 'T00:00:00'),
      period_end: new Date(options.targetDate + 'T23:59:59.999')
    }
  }

  // If explicit date range provided
  if (options.startDate && options.endDate) {
    return {
      period_start: options.startDate,
      period_end: options.endDate
    }
  }

  // Default: use hoursBack from now
  const hoursBack = options.hoursBack || 24
  const period_end = new Date()
  const period_start = new Date()
  period_start.setHours(period_start.getHours() - hoursBack)

  return { period_start, period_end }
}

/**
 * Build a Twitter digest for a topic
 *
 * @param topicId - The topic/niche ID
 * @param options - Date range options (hoursBack, targetDate, or startDate/endDate)
 * @returns Twitter digest with formatted script
 */
export async function buildTwitterDigest(
  topicId: string,
  options: TwitterDigestOptions | number = 24
): Promise<TwitterDigest> {
  // Support legacy call signature (topicId, hoursBack)
  const opts: TwitterDigestOptions = typeof options === 'number'
    ? { hoursBack: options }
    : options

  const { period_start, period_end } = buildDateRange(opts)

  // Log what we're scanning
  if (opts.targetDate) {
    console.log(`[TwitterDigest] Building digest for ${opts.targetDate}...`)
  } else if (opts.startDate && opts.endDate) {
    console.log(`[TwitterDigest] Building digest from ${opts.startDate.toISOString()} to ${opts.endDate.toISOString()}...`)
  } else {
    console.log(`[TwitterDigest] Building digest for last ${opts.hoursBack || 24} hours...`)
  }

  // Fetch tweets from database
  const { data: tweets, error } = await supabase
    .from('tweets_raw')
    .select('tweet_id, text, author_name, author_handle, metrics_likes, metrics_retweets, metrics_replies, tweet_created_at')
    .eq('topic_id', topicId)
    .gte('tweet_created_at', period_start.toISOString())
    .lte('tweet_created_at', period_end.toISOString())
    .order('metrics_likes', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[TwitterDigest] Error fetching tweets:', error)
    return {
      period_start,
      period_end,
      trending_topics: [],
      sentiment: { overall: 'neutral', positive_pct: 0, negative_pct: 0, neutral_pct: 100, description: 'No data available' },
      top_tweets: [],
      accounts_mentioned: [],
      formatted_script: 'Twitter data not available at this time.'
    }
  }

  console.log(`[TwitterDigest] Found ${tweets?.length || 0} tweets`)

  if (!tweets || tweets.length === 0) {
    return {
      period_start,
      period_end,
      trending_topics: [],
      sentiment: { overall: 'neutral', positive_pct: 0, negative_pct: 0, neutral_pct: 100, description: 'No tweets in this time period' },
      top_tweets: [],
      accounts_mentioned: [],
      formatted_script: 'Not much happening on Twitter right now. Let\'s get into the stories.'
    }
  }

  // Process tweets
  const processedTweets = tweets.map(t => ({
    id: t.tweet_id,
    author: t.author_name,
    author_handle: t.author_handle || t.author_name.replace(/\s/g, ''),
    text: t.text,
    likes: t.metrics_likes || 0,
    retweets: t.metrics_retweets || 0,
    sentiment: classifySentiment(t.text)
  }))

  // Extract trending topics
  const trending_topics = extractTopics(tweets.map(t => ({ text: t.text, likes: t.metrics_likes || 0 })))

  // Calculate overall sentiment
  const sentiment = calculateOverallSentiment(processedTweets)

  // Get top tweets by engagement
  const top_tweets = processedTweets
    .sort((a, b) => (b.likes + b.retweets * 2) - (a.likes + a.retweets * 2))
    .slice(0, 5)

  // Extract account mentions
  const accountMap = new Map<string, number>()
  for (const tweet of processedTweets) {
    const mentions = tweet.text.match(/@(\w+)/g) || []
    for (const mention of mentions) {
      const handle = mention.replace('@', '')
      accountMap.set(handle, (accountMap.get(handle) || 0) + 1)
    }
  }

  const accounts_mentioned = Array.from(accountMap.entries())
    .map(([handle, mentions]) => ({
      handle,
      name: handle,
      mentions,
      context: 'Mentioned in discussion'
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10)

  // Format script
  const formatted_script = formatDigestForScript(trending_topics, top_tweets, sentiment)

  return {
    period_start,
    period_end,
    trending_topics,
    sentiment,
    top_tweets,
    accounts_mentioned,
    formatted_script
  }
}

/**
 * Get Twitter reactions for a specific topic/story
 */
export async function getTwitterReactionsForTopic(
  topicId: string,
  keywords: string[],
  hoursBack: number = 48
): Promise<HighlightTweet[]> {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - hoursBack)

  // Search for tweets mentioning the keywords
  const searchPattern = keywords.map(k => `%${k}%`).join('|')

  const { data, error } = await supabase
    .from('tweets_raw')
    .select('tweet_id, text, author_name, author_handle, likes, retweets')
    .eq('topic_id', topicId)
    .gte('tweet_created_at', cutoff.toISOString())
    .gte('likes', 5) // Minimum engagement
    .order('likes', { ascending: false })
    .limit(20)

  if (error || !data) return []

  // Filter by keywords
  const filtered = data.filter(t => {
    const lower = t.text.toLowerCase()
    return keywords.some(k => lower.includes(k.toLowerCase()))
  })

  return filtered.slice(0, 5).map(t => ({
    id: t.tweet_id,
    author: t.author_name,
    author_handle: t.author_handle || t.author_name,
    text: t.text,
    likes: t.likes || 0,
    retweets: t.retweets || 0,
    sentiment: classifySentiment(t.text)
  }))
}
