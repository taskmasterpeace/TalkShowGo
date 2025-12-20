/**
 * FORCE PULL API
 *
 * POST /api/pull - Manually trigger a data pull
 *
 * Body:
 * - type: 'twitter_timeline' | 'twitter_search' | 'youtube_channel' | 'youtube_search'
 * - topicId?: string - Optional topic to scope the pull
 * - target?: string - Username/channel/query to pull from
 * - options?: object - Additional options
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTwitterClient } from '@/lib/twitter-api'
import { getFreeYouTubeClient } from '@/lib/youtube-api'
import { trackTwitterCall, trackYouTubeCall } from '@/lib/api-usage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { type, topicId, target, options = {} } = body

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 })
    }

    // Create pull history record
    const { data: pullRecord, error: pullError } = await supabase
      .from('pull_history')
      .insert({
        pull_type: type,
        topic_id: topicId || null,
        triggered_by: 'manual',
        status: 'running',
        metadata: { target, options },
      })
      .select('id')
      .single()

    const pullId = pullRecord?.id

    let result: any = { items: [], newItems: 0, apiCalls: 0, cost: 0 }

    try {
      switch (type) {
        case 'twitter_timeline':
          result = await pullTwitterTimeline(target, topicId, options)
          break

        case 'twitter_search':
          result = await pullTwitterSearch(target, topicId, options)
          break

        case 'youtube_channel':
          result = await pullYouTubeChannel(target, topicId, options)
          break

        case 'youtube_search':
          result = await pullYouTubeSearch(target, topicId, options)
          break

        case 'all_sources':
          result = await pullAllSources(topicId)
          break

        default:
          throw new Error(`Unknown pull type: ${type}`)
      }

      // Update pull history with success
      if (pullId) {
        await supabase
          .from('pull_history')
          .update({
            status: 'completed',
            items_found: result.items?.length || 0,
            new_items: result.newItems || 0,
            api_calls: result.apiCalls || 0,
            estimated_cost: result.cost || 0,
            completed_at: new Date().toISOString(),
          })
          .eq('id', pullId)
      }

      return NextResponse.json({
        success: true,
        type,
        target,
        pullId,
        itemsFound: result.items?.length || 0,
        newItems: result.newItems || 0,
        apiCalls: result.apiCalls || 0,
        estimatedCost: result.cost || 0,
        durationMs: Date.now() - startTime,
        items: result.items?.slice(0, 10), // Return first 10 as preview
      })
    } catch (error) {
      // Update pull history with failure
      if (pullId) {
        await supabase
          .from('pull_history')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', pullId)
      }
      throw error
    }
  } catch (error) {
    console.error('Pull error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// ============================================
// TWITTER PULLS
// ============================================

async function pullTwitterTimeline(username: string, topicId?: string, options: any = {}) {
  if (!username) throw new Error('username is required for twitter_timeline')

  const twitter = getTwitterClient()
  const result = await twitter.getUserTimeline(username)

  trackTwitterCall('user_timeline', result.tweets.length, topicId)

  // Store tweets in database
  let newItems = 0
  for (const tweet of result.tweets) {
    const { error } = await supabase
      .from('tweets_raw')
      .upsert({
        tweet_id: tweet.id,
        author_id: tweet.author.id,
        author_username: tweet.author.userName,
        author_display_name: tweet.author.name,
        text: tweet.text,
        created_at: tweet.createdAt,
        metrics: {
          like_count: tweet.likeCount,
          retweet_count: tweet.retweetCount,
          reply_count: tweet.replyCount,
          view_count: tweet.viewCount,
        },
        is_retweet: tweet.isRetweet,
        is_quote: tweet.isQuote,
        is_reply: tweet.isReply,
        media: tweet.media,
        hashtags: tweet.hashtags,
        mentions: tweet.mentions,
      }, { onConflict: 'tweet_id' })

    if (!error) newItems++
  }

  return {
    items: result.tweets,
    newItems,
    apiCalls: 1,
    cost: (result.tweets.length / 1000) * 0.15,
  }
}

async function pullTwitterSearch(query: string, topicId?: string, options: any = {}) {
  if (!query) throw new Error('query is required for twitter_search')

  const twitter = getTwitterClient()
  const result = await twitter.searchTweets(query, {
    queryType: options.queryType || 'Latest',
  })

  trackTwitterCall('search', result.tweets.length, topicId)

  // Store tweets
  let newItems = 0
  for (const tweet of result.tweets) {
    const { error } = await supabase
      .from('tweets_raw')
      .upsert({
        tweet_id: tweet.id,
        author_id: tweet.author.id,
        author_username: tweet.author.userName,
        author_display_name: tweet.author.name,
        text: tweet.text,
        created_at: tweet.createdAt,
        metrics: {
          like_count: tweet.likeCount,
          retweet_count: tweet.retweetCount,
          reply_count: tweet.replyCount,
          view_count: tweet.viewCount,
        },
        is_retweet: tweet.isRetweet,
        is_quote: tweet.isQuote,
        is_reply: tweet.isReply,
        media: tweet.media,
        hashtags: tweet.hashtags,
        mentions: tweet.mentions,
        search_query: query,
      }, { onConflict: 'tweet_id' })

    if (!error) newItems++
  }

  return {
    items: result.tweets,
    newItems,
    apiCalls: 1,
    cost: (result.tweets.length / 1000) * 0.15,
  }
}

// ============================================
// YOUTUBE PULLS
// ============================================

async function pullYouTubeChannel(handle: string, topicId?: string, options: any = {}) {
  if (!handle) throw new Error('handle is required for youtube_channel')

  const youtube = getFreeYouTubeClient()

  // Get channel info
  const channel = await youtube.getChannel(handle)
  if (!channel) throw new Error(`Channel not found: ${handle}`)

  // Get recent videos
  const videos = await youtube.getChannelVideos(handle, options.limit || 20)

  // Store videos
  let newItems = 0
  for (const video of videos) {
    const { error } = await supabase
      .from('youtube_videos')
      .upsert({
        video_id: video.id,
        channel_id: channel.id,
        channel_name: channel.title,
        title: video.title,
        description: video.description,
        published_at: video.publishedAt,
        thumbnail_url: video.thumbnailUrl,
        view_count: video.viewCount,
        like_count: video.likeCount,
        duration: video.duration,
      }, { onConflict: 'video_id' })

    if (!error) newItems++
  }

  return {
    items: videos,
    channel,
    newItems,
    apiCalls: 2, // Channel + videos
    cost: 0, // FREE!
  }
}

async function pullYouTubeSearch(query: string, topicId?: string, options: any = {}) {
  if (!query) throw new Error('query is required for youtube_search')

  const youtube = getFreeYouTubeClient()
  const videos = await youtube.search(query, options.limit || 20)

  // Store videos
  let newItems = 0
  for (const video of videos) {
    const { error } = await supabase
      .from('youtube_videos')
      .upsert({
        video_id: video.id,
        channel_id: video.channelId,
        channel_name: video.channelTitle,
        title: video.title,
        description: video.description,
        published_at: video.publishedAt,
        thumbnail_url: video.thumbnailUrl,
        view_count: video.viewCount,
        duration: video.duration,
        search_query: query,
      }, { onConflict: 'video_id' })

    if (!error) newItems++
  }

  return {
    items: videos,
    newItems,
    apiCalls: 1,
    cost: 0, // FREE!
  }
}

// ============================================
// PULL ALL SOURCES FOR A TOPIC
// ============================================

async function pullAllSources(topicId?: string) {
  if (!topicId) throw new Error('topicId is required for all_sources pull')

  // Get all source accounts for this topic
  const { data: sources } = await supabase
    .from('source_accounts')
    .select('*')
    .eq('topic_id', topicId)
    .eq('is_active', true)

  if (!sources || sources.length === 0) {
    return { items: [], newItems: 0, apiCalls: 0, cost: 0 }
  }

  let totalItems: any[] = []
  let totalNew = 0
  let totalCalls = 0
  let totalCost = 0

  for (const source of sources) {
    try {
      if (source.platform === 'twitter') {
        const result = await pullTwitterTimeline(source.username, topicId)
        totalItems = totalItems.concat(result.items)
        totalNew += result.newItems
        totalCalls += result.apiCalls
        totalCost += result.cost
      } else if (source.platform === 'youtube') {
        const result = await pullYouTubeChannel(source.username, topicId)
        totalItems = totalItems.concat(result.items)
        totalNew += result.newItems
        totalCalls += result.apiCalls
        totalCost += result.cost
      }
    } catch (error) {
      console.error(`Error pulling from ${source.platform}/${source.username}:`, error)
    }
  }

  return {
    items: totalItems,
    newItems: totalNew,
    apiCalls: totalCalls,
    cost: totalCost,
    sourcesProcessed: sources.length,
  }
}

// ============================================
// GET - Get pull history
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const topicId = searchParams.get('topicId')
  const limit = parseInt(searchParams.get('limit') || '20')

  let query = supabase
    .from('pull_history')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pulls: data })
}
