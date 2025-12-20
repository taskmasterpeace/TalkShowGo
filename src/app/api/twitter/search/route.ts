import { NextRequest, NextResponse } from 'next/server'
import { getTwitterClient, buildBattleRapSearchQuery } from '@/lib/twitter-api'

/**
 * POST /api/twitter/search
 *
 * Search Twitter using TwitterAPI.io
 * Cost: ~$0.15 per 1K tweets
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, queryType = 'Latest', cursor, entities, accounts } = body

    // Build query from entities/accounts if provided
    let searchQuery = query
    if (!query && (entities || accounts)) {
      searchQuery = buildBattleRapSearchQuery({
        entities,
        accounts,
        excludeRetweets: body.excludeRetweets,
        since: body.since ? new Date(body.since) : undefined,
        minLikes: body.minLikes,
      })
    }

    if (!searchQuery) {
      return NextResponse.json(
        { error: 'Query or entities/accounts are required' },
        { status: 400 }
      )
    }

    const twitter = getTwitterClient()
    const results = await twitter.searchTweets(searchQuery, { queryType, cursor })

    return NextResponse.json({
      query: searchQuery,
      tweets: results.tweets,
      cursor: results.cursor,
      hasMore: results.hasMore,
      count: results.tweets.length,
    })
  } catch (error) {
    console.error('Twitter search error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
