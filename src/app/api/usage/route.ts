/**
 * API Usage Tracking Endpoint
 *
 * GET /api/usage - Get usage summary and history
 * GET /api/usage?topicId=xxx - Get usage for specific topic
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiUsage, getPerplexityCreditsRemaining } from '@/lib/api-usage'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const topicId = searchParams.get('topicId') || undefined

  try {
    const [summary, recentActivity, perplexityCreditsRemaining] = await Promise.all([
      apiUsage.getSummary(topicId),
      apiUsage.getRecentActivity(50),
      getPerplexityCreditsRemaining(),
    ])

    return NextResponse.json({
      summary,
      recentActivity,
      perplexityCreditsRemaining,
    })
  } catch (error) {
    console.error('Usage fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    )
  }
}
