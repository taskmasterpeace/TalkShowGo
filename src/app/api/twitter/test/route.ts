import { NextResponse } from 'next/server'
import { getTwitterClient } from '@/lib/twitter-api'

/**
 * GET /api/twitter/test
 *
 * Test TwitterAPI.io connection
 * Uses minimal credits to verify API key works
 */
export async function GET() {
  try {
    const twitter = getTwitterClient()

    // Test with a well-known account
    const user = await twitter.getUserByUsername('urltv')

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch test user',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'TwitterAPI.io connection successful!',
      testUser: {
        name: user.name,
        handle: user.userName,
        followers: user.followersCount,
        verified: user.isVerified || user.isBlueVerified,
      },
      pricing: {
        tweets: '$0.15 per 1K',
        profiles: '$0.18 per 1K',
        followers: '$0.15 per 1K',
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      hint: 'Make sure TWITTER_API_KEY is set in your .env file',
    }, { status: 500 })
  }
}
