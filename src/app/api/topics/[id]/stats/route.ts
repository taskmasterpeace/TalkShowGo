import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/topics/[id]/stats
 *
 * Get aggregate stats for a topic
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get tweet counts
    const { count: tweetCount } = await supabase
      .from('tweets_raw')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', params.id)

    // Get today's tweets
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: todayTweetCount } = await supabase
      .from('tweets_raw')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', params.id)
      .gte('tweet_created_at', today.toISOString())

    // Get unique authors today
    const { data: todayAuthors } = await supabase
      .from('tweets_raw')
      .select('author_handle')
      .eq('topic_id', params.id)
      .gte('tweet_created_at', today.toISOString())

    const uniqueAuthorsToday = new Set(todayAuthors?.map(t => t.author_handle)).size

    // Get total engagement today
    const { data: todayEngagement } = await supabase
      .from('tweets_raw')
      .select('metrics_likes, metrics_retweets, metrics_replies')
      .eq('topic_id', params.id)
      .gte('tweet_created_at', today.toISOString())

    const totalEngagement = (todayEngagement || []).reduce((sum, t) => {
      return sum + (t.metrics_likes || 0) + (t.metrics_retweets || 0) + (t.metrics_replies || 0)
    }, 0)

    // Get entity count
    const { count: entityCount } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', params.id)

    // Get claim count
    const { count: claimCount } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', params.id)

    // Get trending entities (most mentioned)
    const { data: trendingEntities } = await supabase
      .from('entities')
      .select('canonical_name, mention_count, entity_type')
      .eq('topic_id', params.id)
      .order('mention_count', { ascending: false })
      .limit(5)

    // Get source count
    const { count: sourceCount } = await supabase
      .from('source_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', params.id)

    // Get story candidates count by bucket
    const { data: storyBuckets } = await supabase
      .from('story_candidates')
      .select('bucket')
      .eq('topic_id', params.id)
      .eq('status', 'candidate')

    const bucketCounts = (storyBuckets || []).reduce((acc, s) => {
      acc[s.bucket] = (acc[s.bucket] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      tweets: {
        total: tweetCount || 0,
        today: todayTweetCount || 0,
        uniqueAuthorsToday,
        totalEngagementToday: totalEngagement,
      },
      entities: entityCount || 0,
      claims: claimCount || 0,
      sources: sourceCount || 0,
      trending: trendingEntities || [],
      storyBuckets: bucketCounts,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
