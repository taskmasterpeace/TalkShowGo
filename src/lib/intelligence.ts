/**
 * INTELLIGENCE MODULE
 *
 * Fresh, recency-first intelligence queries.
 * Battle rap moves fast - 48 hours is already old news.
 */

import { supabase } from '@/lib/db'

export interface FreshTweet {
  id: string
  tweet_id: string
  text: string
  author_handle: string
  author_name: string
  tweet_type: 'original' | 'reply' | 'quote' | 'retweet'
  metrics_likes: number
  metrics_retweets: number
  metrics_replies: number
  metrics_views: number
  tweet_created_at: string
  fetched_at: string
}

export interface IntelligenceOptions {
  hoursBack?: number      // default 48
  minEngagement?: number  // default 5 likes
  limit?: number          // default 50
  excludeRetweets?: boolean // default true
}

/**
 * Get fresh intelligence - ONLY recent, high-engagement content
 */
export async function getFreshIntelligence(
  topicId: string,
  options: IntelligenceOptions = {}
): Promise<FreshTweet[]> {
  const {
    hoursBack = 48,
    minEngagement = 5,
    limit = 50,
    excludeRetweets = true,
  } = options

  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

  let query = supabase
    .from('tweets_raw')
    .select('*')
    .eq('topic_id', topicId)
    .gte('tweet_created_at', cutoff.toISOString())
    .gte('metrics_likes', minEngagement)
    .order('tweet_created_at', { ascending: false })
    .limit(limit)

  if (excludeRetweets) {
    query = query.neq('tweet_type', 'retweet')
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching fresh intelligence:', error)
    return []
  }

  return data || []
}

/**
 * Get trending topics from recent tweets
 * Extracts frequently mentioned entities/keywords
 */
export async function getTrendingTopics(
  topicId: string,
  hoursBack = 24
): Promise<{ keyword: string; count: number; totalEngagement: number }[]> {
  const tweets = await getFreshIntelligence(topicId, {
    hoursBack,
    minEngagement: 1,
    limit: 200,
    excludeRetweets: true,
  })

  // Simple keyword extraction (can be enhanced with NLP)
  const keywords = new Map<string, { count: number; engagement: number }>()

  // Battle rap specific terms to look for
  const battleRapTerms = [
    // Leagues
    'URL', 'URLTV', 'KOTD', 'RBE', 'TBL', 'Rare Breed',
    // Current hot topics
    'Eazy', 'Twork', 'Cassidy', 'Geechi', 'Surf', 'Hitman',
    'Summer Madness', 'Nome', 'Illadelphia',
  ]

  for (const tweet of tweets) {
    const text = tweet.text.toUpperCase()
    const engagement = tweet.metrics_likes + tweet.metrics_retweets * 2

    for (const term of battleRapTerms) {
      if (text.includes(term.toUpperCase())) {
        const existing = keywords.get(term) || { count: 0, engagement: 0 }
        keywords.set(term, {
          count: existing.count + 1,
          engagement: existing.engagement + engagement,
        })
      }
    }

    // Also extract @mentions
    const mentions = tweet.text.match(/@\w+/g) || []
    for (const mention of mentions) {
      const existing = keywords.get(mention) || { count: 0, engagement: 0 }
      keywords.set(mention, {
        count: existing.count + 1,
        engagement: existing.engagement + engagement,
      })
    }
  }

  // Sort by engagement (velocity proxy)
  return Array.from(keywords.entries())
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      totalEngagement: data.engagement,
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 20)
}

/**
 * Get intelligence summary formatted for display
 */
export async function getIntelligenceSummary(topicId: string): Promise<{
  freshTweets: FreshTweet[]
  trendingTopics: { keyword: string; count: number; totalEngagement: number }[]
  stats: {
    totalFresh: number
    oldestTweet: string | null
    newestTweet: string | null
    topSource: string | null
  }
}> {
  const freshTweets = await getFreshIntelligence(topicId, {
    hoursBack: 48,
    minEngagement: 5,
    limit: 100,
  })

  const trendingTopics = await getTrendingTopics(topicId, 24)

  // Calculate stats
  const sourceCounts = new Map<string, number>()
  for (const tweet of freshTweets) {
    const count = sourceCounts.get(tweet.author_handle) || 0
    sourceCounts.set(tweet.author_handle, count + 1)
  }

  const topSource = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null

  return {
    freshTweets,
    trendingTopics,
    stats: {
      totalFresh: freshTweets.length,
      oldestTweet: freshTweets[freshTweets.length - 1]?.tweet_created_at || null,
      newestTweet: freshTweets[0]?.tweet_created_at || null,
      topSource,
    },
  }
}
