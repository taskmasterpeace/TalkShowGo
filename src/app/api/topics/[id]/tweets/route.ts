import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/topics/[id]/tweets
 *
 * Fetch tweets for a topic with filtering and sorting
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const sortBy = searchParams.get('sortBy') || 'recent'
    const filterType = searchParams.get('type') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('tweets_raw')
      .select(`
        *,
        source_accounts (
          handle,
          display_name,
          profile_image_url,
          credibility_score
        )
      `)
      .eq('topic_id', params.id)

    // Filter by tweet type
    if (filterType !== 'all') {
      query = query.eq('tweet_type', filterType)
    }

    // Sort
    switch (sortBy) {
      case 'engagement':
        query = query.order('metrics_likes', { ascending: false })
        break
      case 'trending':
        query = query.order('metrics_views', { ascending: false })
        break
      case 'recent':
      default:
        query = query.order('tweet_created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Calculate engagement score for each tweet
    const tweetsWithScore = (data || []).map(tweet => ({
      ...tweet,
      engagement_score: calculateEngagementScore(tweet),
    }))

    return NextResponse.json({
      tweets: tweetsWithScore,
      count: tweetsWithScore.length,
      offset,
      limit,
    })
  } catch (error) {
    console.error('Error fetching tweets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tweets' },
      { status: 500 }
    )
  }
}

function calculateEngagementScore(tweet: any): number {
  const likes = tweet.metrics_likes || 0
  const retweets = tweet.metrics_retweets || 0
  const replies = tweet.metrics_replies || 0
  const views = tweet.metrics_views || 1

  // Engagement rate calculation
  const totalEngagement = likes + (retweets * 2) + (replies * 3)
  const engagementRate = (totalEngagement / views) * 100

  // Scale to 0-100
  const score = Math.min(100, Math.round(engagementRate * 10 + 50))
  return score
}
