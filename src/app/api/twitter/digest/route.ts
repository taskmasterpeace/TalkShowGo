/**
 * Twitter Digest API
 *
 * GET /api/twitter/digest
 * Returns formatted Twitter digest for show scripts
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildTwitterDigest, getTwitterReactionsForTopic } from '@/lib/twitter-digest'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const hoursBack = parseInt(searchParams.get('hours_back') || '24', 10)
    const keywords = searchParams.get('keywords')?.split(',').filter(Boolean)

    if (!topicId) {
      return NextResponse.json(
        { error: 'topic_id is required' },
        { status: 400 }
      )
    }

    console.log(`[TwitterDigest API] Building digest for ${topicId} (${hoursBack}h back)`)

    // If keywords provided, get reactions for specific topic
    if (keywords && keywords.length > 0) {
      const reactions = await getTwitterReactionsForTopic(topicId, keywords, hoursBack)
      return NextResponse.json({
        success: true,
        type: 'reactions',
        keywords,
        reactions,
        reaction_count: reactions.length
      })
    }

    // Otherwise, build full digest
    const digest = await buildTwitterDigest(topicId, hoursBack)

    return NextResponse.json({
      success: true,
      type: 'full_digest',
      topic_id: topicId,
      hours_back: hoursBack,
      period: {
        start: digest.period_start.toISOString(),
        end: digest.period_end.toISOString()
      },
      trending_topics: digest.trending_topics,
      sentiment: digest.sentiment,
      top_tweets: digest.top_tweets,
      accounts_mentioned: digest.accounts_mentioned,
      formatted_script: digest.formatted_script
    })
  } catch (error) {
    console.error('[TwitterDigest API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to build Twitter digest', details: String(error) },
      { status: 500 }
    )
  }
}
