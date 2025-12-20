import { NextRequest, NextResponse } from 'next/server'
import { getTwitterClient } from '@/lib/twitter-api'

/**
 * GET /api/twitter/user?username=xxx
 *
 * Get Twitter user profile
 * Cost: ~$0.18 per 1K users
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    const twitter = getTwitterClient()
    const user = await twitter.getUserByUsername(username)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Twitter user lookup error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
