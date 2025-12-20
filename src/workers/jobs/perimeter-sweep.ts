/**
 * PERIMETER SWEEP
 *
 * Fetches tweets from all seed/verified Twitter sources for a topic.
 * Stores raw tweets and builds thread relationships.
 *
 * Uses TwitterAPI.io - pay-as-you-go pricing:
 * - $0.15 per 1K tweets fetched
 */

import { supabase } from '@/lib/db'
import { getTwitterClient, Tweet } from '@/lib/twitter-api'

interface PerimeterSweepData {
  job_run_id: string
  topic_id: string
}

export async function perimeterSweep(data: PerimeterSweepData) {
  const { job_run_id, topic_id } = data
  let itemsProcessed = 0
  let tweetsStored = 0
  const errors: any[] = []
  const startTime = Date.now()

  try {
    // Update job status to running
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get Twitter client
    const twitter = getTwitterClient()

    // Get all active Twitter sources for this topic
    const { data: sources, error: sourcesError } = await supabase
      .from('source_accounts')
      .select('*')
      .eq('topic_id', topic_id)
      .eq('platform', 'twitter')
      .in('status', ['seed', 'verified'])

    if (sourcesError) throw sourcesError

    // Rate limit: twitterapi.io free tier allows 1 request per 5 seconds
    const RATE_LIMIT_DELAY = 5500 // 5.5 seconds to be safe

    // Freshness filter: Only store tweets from last 48 hours
    const FRESHNESS_HOURS = 48
    const freshnessCutoff = new Date(Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000)
    let tweetsSkipped = 0

    // For each source, fetch recent tweets
    for (const source of sources || []) {
      try {
        console.log(`Fetching tweets from ${source.handle}...`)

        // Fetch user timeline (first page = ~20 tweets)
        const timeline = await twitter.getUserTimeline(source.handle)

        // Wait for rate limit before next request
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))

        // Also update user profile info
        const userInfo = await twitter.getUserByUsername(source.handle)
        if (userInfo) {
          await supabase
            .from('source_accounts')
            .update({
              display_name: userInfo.name,
              follower_count: userInfo.followersCount,
              profile_image_url: userInfo.profilePicture,
              metadata: {
                ...source.metadata,
                is_verified: userInfo.isVerified,
                is_blue_verified: userInfo.isBlueVerified,
                following_count: userInfo.followingCount,
              },
            })
            .eq('id', source.id)
        }

        // Store each tweet (only if fresh)
        let sourceTweetsStored = 0
        for (const tweet of timeline.tweets) {
          // Skip old tweets - battle rap moves fast, we only want fresh content
          const tweetDate = new Date(tweet.createdAt)
          if (tweetDate < freshnessCutoff) {
            tweetsSkipped++
            continue
          }
          const stored = await storeTweet(tweet, topic_id, source.id)
          if (stored) {
            tweetsStored++
            sourceTweetsStored++
          }
        }

        // Update last_checked timestamp
        await supabase
          .from('source_accounts')
          .update({ last_checked: new Date().toISOString() })
          .eq('id', source.id)

        itemsProcessed++
        console.log(`  ✓ ${source.handle}: ${sourceTweetsStored} fresh tweets (${timeline.tweets.length - sourceTweetsStored} old skipped)`)

        // Wait before next source to respect rate limit
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      } catch (err) {
        console.error(`  ✗ ${source.handle}: ${err}`)
        errors.push({
          source_id: source.id,
          handle: source.handle,
          error: String(err),
        })
      }
    }

    // Update job status to completed
    await supabase
      .from('job_runs')
      .update({
        status: errors.length > 0 && itemsProcessed === 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        items_processed: itemsProcessed,
        errors,
        metadata: {
          tweets_stored: tweetsStored,
          tweets_skipped_old: tweetsSkipped,
          sources_processed: itemsProcessed,
          freshness_hours: FRESHNESS_HOURS,
        },
      })
      .eq('id', job_run_id)

    return { itemsProcessed, tweetsStored, errors }
  } catch (error) {
    // Update job status to failed
    await supabase
      .from('job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        errors: [{ error: String(error) }],
      })
      .eq('id', job_run_id)

    throw error
  }
}

/**
 * Store a tweet in the database
 * Returns true if stored (new), false if already exists
 */
async function storeTweet(
  tweet: Tweet,
  topic_id: string,
  source_account_id: string
): Promise<boolean> {
  // Determine tweet type
  let tweetType: 'original' | 'reply' | 'quote' | 'retweet' = 'original'
  if (tweet.isRetweet) tweetType = 'retweet'
  else if (tweet.isQuote) tweetType = 'quote'
  else if (tweet.isReply) tweetType = 'reply'

  const { error } = await supabase.from('tweets_raw').upsert(
    {
      tweet_id: tweet.id,
      topic_id,
      source_account_id,
      text: tweet.text,
      author_handle: tweet.author.userName,
      author_name: tweet.author.name,
      author_profile_image: tweet.author.profilePicture,
      tweet_type: tweetType,
      reply_to_tweet_id: tweet.inReplyToId || null,
      quote_of_tweet_id: tweet.quotedTweetId || null,
      metrics_likes: tweet.likeCount,
      metrics_retweets: tweet.retweetCount,
      metrics_replies: tweet.replyCount,
      metrics_views: tweet.viewCount,
      media_urls: tweet.media?.map(m => m.url) || [],
      links: tweet.urls || [],
      tweet_created_at: tweet.createdAt,
      fetched_at: new Date().toISOString(),
      processed: false,
      raw_payload: tweet,
    },
    {
      onConflict: 'tweet_id',
      ignoreDuplicates: true,
    }
  )

  return !error
}
