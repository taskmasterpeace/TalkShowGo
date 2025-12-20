/**
 * Topic Proposer
 *
 * Scans configured sources (Twitter + YouTube) to find trending topics
 * and proposes 3-5 newsworthy topics for the daily show.
 */

import { supabase } from './db'

// ============================================
// TYPES
// ============================================

export interface ProposedTopic {
  id: string
  headline: string
  summary: string
  source_count: number
  engagement_score: number
  twitter_mentions: number
  youtube_videos: number
  suggested_priority: number
  sources: TopicSource[]
  keywords: string[]
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
}

export interface TopicSource {
  type: 'tweet' | 'youtube'
  title: string
  url: string
  engagement: number
  author: string
  published_at: string
}

export interface TopicCluster {
  keywords: string[]
  tweets: TweetData[]
  videos: VideoData[]
  totalEngagement: number
}

interface TweetData {
  id: string
  text: string
  author: string
  likes: number
  retweets: number
  replies: number
  created_at: string
}

interface VideoData {
  id: string
  title: string
  channel: string
  views: number
  published_at: string
  url: string
}

// Date range configuration for targeting specific days
export interface DateRangeConfig {
  startDate: Date
  endDate: Date
}

export interface TopicProposerOptions {
  hoursBack?: number
  startDate?: Date
  endDate?: Date
  targetDate?: string  // YYYY-MM-DD format - convenience for full day
}

// ============================================
// BATTLE RAP KEYWORDS
// ============================================

const BATTLE_RAP_ENTITIES = [
  // Leagues
  'URL', 'KOTD', 'RBE', 'TBL', 'QOTR', 'Ultimate Rap League', 'King Of The Dot',
  'Rare Breed', 'Gates Of The Garden', 'Chrome 23',

  // Major battlers
  'Cassidy', 'Eazy', 'Eazy The Block Captain', 'Tsu Surf', 'Loaded Lux', 'Murda Mook',
  'Geechi Gotti', 'Rum Nitty', 'Ave', 'Twork', 'Nu Jerzey Twork', 'Hitman Holla',
  'Hollow Da Don', 'Charlie Clips', 'Goodz', 'T-Rex', 'Arsonal', 'Daylyt',
  'DNA', 'K-Shine', 'Chess', 'Bill Collector', 'Calicoe', 'Conceited',
  'Math Hoffa', 'Dizaster', 'Pat Stay', 'Rone', 'Charron', 'Bigg K',
  'Chilla Jones', 'JC', 'Ill Will', 'Real Sikh', 'A Ward', 'Lu Castro',
  'Jey The Nitewing', 'Danny Myers', 'B Dot', 'EK', 'Mike P', 'Aye Verb',

  // Events
  'NOME', 'Summer Madness', 'SM', 'Volume', 'Banned',

  // Media personalities
  'JayBlac', 'Chris Unbias', 'Angry Fan', 'ARP', '15MOFE', 'Vada Fly',
  'Champion', 'Champagne Duane'
]

// Keywords that indicate newsworthy content
const NEWS_INDICATORS = [
  'announced', 'announcement', 'breaking', 'just in', 'confirmed',
  'vs', 'versus', 'battle', 'fight', 'beef', 'responds', 'speaks on',
  'exposed', 'allegations', 'drama', 'controversy', 'trending',
  'official', 'exclusive', 'leaked', 'preview', 'recap', 'reaction',
  'winner', 'won', 'lost', 'bodied', 'clear', '30', '3-0'
]

// ============================================
// DATABASE QUERIES
// ============================================

/**
 * Fetch recent tweets from the database
 */
async function fetchRecentTweets(
  topicId: string,
  dateRange: DateRangeConfig
): Promise<TweetData[]> {
  const { data, error } = await supabase
    .from('tweets_raw')
    .select('tweet_id, text, author_name, author_handle, metrics_likes, metrics_retweets, metrics_replies, tweet_created_at')
    .eq('topic_id', topicId)
    .gte('tweet_created_at', dateRange.startDate.toISOString())
    .lte('tweet_created_at', dateRange.endDate.toISOString())
    .order('metrics_likes', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[TopicProposer] Error fetching tweets:', error)
    return []
  }

  return (data || []).map(t => ({
    id: t.tweet_id,
    text: t.text,
    author: t.author_handle || t.author_name,
    likes: t.metrics_likes || 0,
    retweets: t.metrics_retweets || 0,
    replies: t.metrics_replies || 0,
    created_at: t.tweet_created_at
  }))
}

/**
 * Fetch recent YouTube videos from the database
 */
async function fetchRecentVideos(
  topicId: string,
  dateRange: DateRangeConfig
): Promise<VideoData[]> {
  const { data, error } = await supabase
    .from('youtube_videos')
    .select('video_id, title, channel_title, view_count, published_at')
    .eq('topic_id', topicId)
    .gte('published_at', dateRange.startDate.toISOString())
    .lte('published_at', dateRange.endDate.toISOString())
    .order('view_count', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[TopicProposer] Error fetching videos:', error)
    return []
  }

  return (data || []).map(v => ({
    id: v.video_id,
    title: v.title,
    channel: v.channel_title || 'Unknown Channel',
    views: v.view_count || 0,
    published_at: v.published_at,
    url: `https://www.youtube.com/watch?v=${v.video_id}`
  }))
}

// ============================================
// TOPIC DETECTION
// ============================================

/**
 * Extract entities mentioned in text
 */
function extractEntities(text: string): string[] {
  const found: string[] = []
  const lowerText = text.toLowerCase()

  for (const entity of BATTLE_RAP_ENTITIES) {
    if (lowerText.includes(entity.toLowerCase())) {
      found.push(entity)
    }
  }

  return found
}

/**
 * Check if text contains news indicators
 */
function hasNewsIndicators(text: string): boolean {
  const lowerText = text.toLowerCase()
  return NEWS_INDICATORS.some(indicator => lowerText.includes(indicator))
}

/**
 * Calculate engagement score
 */
function calculateEngagement(
  likes: number,
  retweets: number = 0,
  replies: number = 0,
  views: number = 0
): number {
  return likes + (retweets * 2) + (replies * 3) + (views * 0.001)
}

/**
 * Cluster content by shared entities/keywords
 */
function clusterByTopic(
  tweets: TweetData[],
  videos: VideoData[]
): Map<string, TopicCluster> {
  const clusters = new Map<string, TopicCluster>()

  // Process tweets
  for (const tweet of tweets) {
    const entities = extractEntities(tweet.text)
    if (entities.length === 0) continue

    // Create a cluster key from primary entities
    const key = entities.slice(0, 2).sort().join('|')

    if (!clusters.has(key)) {
      clusters.set(key, {
        keywords: entities,
        tweets: [],
        videos: [],
        totalEngagement: 0
      })
    }

    const cluster = clusters.get(key)!
    cluster.tweets.push(tweet)
    cluster.totalEngagement += calculateEngagement(tweet.likes, tweet.retweets, tweet.replies)
  }

  // Process videos
  for (const video of videos) {
    const entities = extractEntities(video.title)
    if (entities.length === 0) continue

    const key = entities.slice(0, 2).sort().join('|')

    if (!clusters.has(key)) {
      clusters.set(key, {
        keywords: entities,
        tweets: [],
        videos: [],
        totalEngagement: 0
      })
    }

    const cluster = clusters.get(key)!
    cluster.videos.push(video)
    cluster.totalEngagement += video.views
  }

  return clusters
}

/**
 * Determine sentiment from content
 */
function analyzeSentiment(texts: string[]): 'positive' | 'negative' | 'neutral' | 'mixed' {
  const positiveWords = ['fire', 'goat', 'bodied', 'won', 'clear', 'crazy', 'legend', 'respect']
  const negativeWords = ['trash', 'lost', 'choked', 'mid', 'washed', 'overrated', 'boring']

  let positive = 0
  let negative = 0

  for (const text of texts) {
    const lower = text.toLowerCase()
    if (positiveWords.some(w => lower.includes(w))) positive++
    if (negativeWords.some(w => lower.includes(w))) negative++
  }

  if (positive > negative * 2) return 'positive'
  if (negative > positive * 2) return 'negative'
  if (positive > 0 && negative > 0) return 'mixed'
  return 'neutral'
}

/**
 * Generate a headline from cluster data
 */
function generateHeadline(cluster: TopicCluster): string {
  // If there are videos, use the most viewed video title as base
  if (cluster.videos.length > 0) {
    const topVideo = cluster.videos.sort((a, b) => b.views - a.views)[0]
    // Clean up the title
    return topVideo.title
      .replace(/\|.*$/, '') // Remove channel suffixes
      .replace(/\[.*?\]/g, '') // Remove brackets
      .trim()
  }

  // Otherwise, summarize from tweets
  const keywords = cluster.keywords.slice(0, 2)
  return `${keywords.join(' and ')}: What's Being Said`
}

/**
 * Generate a summary from cluster data
 */
function generateSummary(cluster: TopicCluster): string {
  const sourceCount = cluster.tweets.length + cluster.videos.length
  const engagement = cluster.totalEngagement

  if (cluster.videos.length > 0) {
    return `${cluster.videos.length} videos and ${cluster.tweets.length} tweets discussing this topic with ${Math.round(engagement).toLocaleString()} total engagement.`
  }

  return `${cluster.tweets.length} tweets discussing this topic with ${Math.round(engagement).toLocaleString()} total engagement.`
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Build date range from options
 */
function buildDateRange(options: TopicProposerOptions): DateRangeConfig {
  // If targetDate provided (YYYY-MM-DD), use full day
  if (options.targetDate) {
    const date = new Date(options.targetDate + 'T00:00:00')
    return {
      startDate: new Date(date.setHours(0, 0, 0, 0)),
      endDate: new Date(new Date(options.targetDate + 'T23:59:59').setMilliseconds(999))
    }
  }

  // If explicit date range provided
  if (options.startDate && options.endDate) {
    return {
      startDate: options.startDate,
      endDate: options.endDate
    }
  }

  // Default: use hoursBack from now
  const hoursBack = options.hoursBack || 24
  const endDate = new Date()
  const startDate = new Date()
  startDate.setHours(startDate.getHours() - hoursBack)

  return { startDate, endDate }
}

/**
 * Propose topics for a daily show
 *
 * @param topicId - The topic/niche ID
 * @param options - Date range options (hoursBack, targetDate, or startDate/endDate)
 * @param maxTopics - Maximum number of topics to propose
 * @returns Array of proposed topics ranked by priority
 */
export async function proposeTopicsForShow(
  topicId: string,
  options: TopicProposerOptions | number = 24,
  maxTopics: number = 5
): Promise<ProposedTopic[]> {
  // Support legacy call signature (topicId, hoursBack, maxTopics)
  const opts: TopicProposerOptions = typeof options === 'number'
    ? { hoursBack: options }
    : options

  const dateRange = buildDateRange(opts)

  // Log what we're scanning
  if (opts.targetDate) {
    console.log(`[TopicProposer] Scanning sources for ${opts.targetDate}...`)
  } else if (opts.startDate && opts.endDate) {
    console.log(`[TopicProposer] Scanning sources from ${opts.startDate.toISOString()} to ${opts.endDate.toISOString()}...`)
  } else {
    console.log(`[TopicProposer] Scanning sources for last ${opts.hoursBack || 24} hours...`)
  }

  // Fetch recent content
  const [tweets, videos] = await Promise.all([
    fetchRecentTweets(topicId, dateRange),
    fetchRecentVideos(topicId, dateRange)
  ])

  console.log(`[TopicProposer] Found ${tweets.length} tweets and ${videos.length} videos`)

  if (tweets.length === 0 && videos.length === 0) {
    console.log('[TopicProposer] No recent content found')
    return []
  }

  // Cluster by topic
  const clusters = clusterByTopic(tweets, videos)
  console.log(`[TopicProposer] Identified ${clusters.size} topic clusters`)

  // Convert clusters to proposed topics
  const proposedTopics: ProposedTopic[] = []
  let priority = 1

  for (const [key, cluster] of Array.from(clusters.entries())) {
    // Skip clusters with minimal engagement
    if (cluster.totalEngagement < 50) continue

    // Calculate source count
    const sourceCount = cluster.tweets.length + cluster.videos.length

    // Build sources list
    const sources: TopicSource[] = [
      ...cluster.tweets.slice(0, 3).map(t => ({
        type: 'tweet' as const,
        title: t.text.slice(0, 100),
        url: `https://twitter.com/${t.author}/status/${t.id}`,
        engagement: calculateEngagement(t.likes, t.retweets, t.replies),
        author: t.author,
        published_at: t.created_at
      })),
      ...cluster.videos.slice(0, 3).map(v => ({
        type: 'youtube' as const,
        title: v.title,
        url: v.url,
        engagement: v.views,
        author: v.channel,
        published_at: v.published_at
      }))
    ]

    // Analyze sentiment
    const allTexts = [
      ...cluster.tweets.map(t => t.text),
      ...cluster.videos.map(v => v.title)
    ]
    const sentiment = analyzeSentiment(allTexts)

    proposedTopics.push({
      id: `topic_${Date.now()}_${priority}`,
      headline: generateHeadline(cluster),
      summary: generateSummary(cluster),
      source_count: sourceCount,
      engagement_score: cluster.totalEngagement,
      twitter_mentions: cluster.tweets.length,
      youtube_videos: cluster.videos.length,
      suggested_priority: priority++,
      sources,
      keywords: cluster.keywords,
      sentiment
    })
  }

  // Sort by engagement and return top N
  const ranked = proposedTopics
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, maxTopics)

  // Re-assign priorities after sorting
  ranked.forEach((topic, index) => {
    topic.suggested_priority = index + 1
  })

  console.log(`[TopicProposer] Proposing ${ranked.length} topics`)
  return ranked
}

/**
 * Get topics with enhanced research for selected items
 */
export async function getTopicDetails(topicId: string, topicKey: string): Promise<{
  headline: string
  body: string
  twitter_reaction?: string
}> {
  // This would fetch more details and potentially run additional research
  // For now, return placeholder
  return {
    headline: `Story about ${topicKey}`,
    body: 'Detailed content would be generated here based on the topic.',
    twitter_reaction: undefined
  }
}
