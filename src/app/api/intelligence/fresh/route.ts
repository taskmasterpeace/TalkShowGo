/**
 * Fresh Intelligence API
 *
 * GET /api/intelligence/fresh
 *
 * Returns current intelligence summary - what's happening NOW.
 * Designed for n8n to call to get content for daily shows.
 *
 * Query params:
 * - topic_id: string (required) - The topic to get intelligence for
 * - hours_back: number (default 48) - How far back to look
 * - min_engagement: number (default 5) - Minimum likes to include
 * - include_youtube: boolean (default true) - Include YouTube data
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const topic_id = searchParams.get('topic_id')
  const hours_back = parseInt(searchParams.get('hours_back') || '48')
  const min_engagement = parseInt(searchParams.get('min_engagement') || '5')
  const include_youtube = searchParams.get('include_youtube') !== 'false'

  if (!topic_id) {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }

  try {
    const cutoff = new Date(Date.now() - hours_back * 60 * 60 * 1000)

    // Get fresh tweets (non-retweets, with engagement)
    const { data: tweets } = await supabase
      .from('tweets_raw')
      .select('*')
      .eq('topic_id', topic_id)
      .neq('tweet_type', 'retweet')
      .gte('tweet_created_at', cutoff.toISOString())
      .gte('metrics_likes', min_engagement)
      .order('tweet_created_at', { ascending: false })
      .limit(50)

    // Get fresh YouTube videos (if enabled and we have analyzed ones)
    let youtube_videos: any[] = []
    if (include_youtube) {
      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('topic_id', topic_id)
        .gte('published_at', cutoff.toISOString())
        .order('published_at', { ascending: false })
        .limit(20)

      youtube_videos = videos || []
    }

    // Get recently active entities
    const { data: activeEntities } = await supabase
      .from('entities')
      .select('id, canonical_name, entity_type, mention_count, last_seen')
      .eq('topic_id', topic_id)
      .gte('last_seen', cutoff.toISOString())
      .order('mention_count', { ascending: false })
      .limit(20)

    // Extract trending topics from tweets
    const topicCounts = new Map<string, { count: number; engagement: number }>()
    const battleRapTerms = [
      'URL', 'URLTV', 'KOTD', 'RBE', 'TBL', 'Rare Breed', 'NOME', 'Summer Madness',
      'Eazy', 'Twork', 'Cassidy', 'Geechi', 'Surf', 'Hitman', 'Loaded Lux',
      'Tay Roc', 'Rum Nitty', 'Chess', 'Danny Myers', 'Ill Will', 'JC',
      'K Shine', 'DNA', 'Charlie Clips', 'Conceited', 'Arsonal', 'Math Hoffa'
    ]

    for (const tweet of tweets || []) {
      const text = tweet.text?.toUpperCase() || ''
      const engagement = (tweet.metrics_likes || 0) + (tweet.metrics_retweets || 0) * 2

      for (const term of battleRapTerms) {
        if (text.includes(term.toUpperCase())) {
          const existing = topicCounts.get(term) || { count: 0, engagement: 0 }
          topicCounts.set(term, {
            count: existing.count + 1,
            engagement: existing.engagement + engagement
          })
        }
      }
    }

    // Sort trending topics by engagement
    const trendingTopics = Array.from(topicCounts.entries())
      .map(([topic, data]) => ({
        topic,
        mention_count: data.count,
        total_engagement: data.engagement,
        engagement_per_mention: Math.round(data.engagement / data.count)
      }))
      .sort((a, b) => b.total_engagement - a.total_engagement)
      .slice(0, 10)

    // Determine if there's breaking news (high engagement in last 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const recentHighEngagement = (tweets || []).filter(t =>
      new Date(t.tweet_created_at) > sixHoursAgo &&
      (t.metrics_likes || 0) > 50
    )

    const hasBreakingNews = recentHighEngagement.length > 0

    // Build stories from tweets (group by topic)
    const stories = trendingTopics.slice(0, 5).map(topic => {
      const relatedTweets = (tweets || []).filter(t =>
        t.text?.toUpperCase().includes(topic.topic.toUpperCase())
      )

      return {
        topic: topic.topic,
        tweet_count: relatedTweets.length,
        total_engagement: topic.total_engagement,
        top_tweets: relatedTweets.slice(0, 3).map(t => ({
          text: t.text,
          author: t.author_handle,
          likes: t.metrics_likes,
          created_at: t.tweet_created_at
        })),
        is_breaking: relatedTweets.some(t =>
          new Date(t.tweet_created_at) > sixHoursAgo &&
          (t.metrics_likes || 0) > 50
        )
      }
    })

    return NextResponse.json({
      topic_id,
      generated_at: new Date().toISOString(),
      time_window: {
        hours_back,
        cutoff: cutoff.toISOString()
      },
      summary: {
        total_tweets: tweets?.length || 0,
        total_videos: youtube_videos.length,
        active_entities: activeEntities?.length || 0,
        has_breaking_news: hasBreakingNews,
        trending_topic: trendingTopics[0]?.topic || null
      },
      trending_topics: trendingTopics,
      stories,
      recent_high_engagement: recentHighEngagement.slice(0, 5).map(t => ({
        text: t.text,
        author: t.author_handle,
        likes: t.metrics_likes,
        created_at: t.tweet_created_at
      })),
      active_entities: activeEntities,
      youtube_videos: youtube_videos.slice(0, 10).map(v => ({
        video_id: v.video_id,
        title: v.title,
        channel_name: v.channel_name,
        published_at: v.published_at,
        view_count: v.view_count,
        has_analysis: !!v.analysis_results
      }))
    })
  } catch (error) {
    console.error('Error fetching fresh intelligence:', error)
    return NextResponse.json({
      error: 'Failed to fetch intelligence',
      details: String(error)
    }, { status: 500 })
  }
}
