import { NextResponse } from 'next/server'
import { perplexity, type RSSDiscoveryResult } from '@/lib/perplexity'
import { getPerplexityCreditsRemaining, PERPLEXITY_MONTHLY_CREDITS } from '@/lib/api-usage'

/**
 * POST /api/rss/discover
 * Discover RSS feeds for a niche using Perplexity Sonar
 *
 * Body: {
 *   niche: string,           // e.g., "battle rap", "tech news"
 *   keywords?: string[],     // Additional keywords to focus the search
 *   existingSources?: string[] // Already tracking these - find different ones
 * }
 *
 * Returns: RSSDiscoveryResult
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { niche, keywords = [], existingSources = [] } = body

    // Validate input
    if (!niche || typeof niche !== 'string') {
      return NextResponse.json(
        { error: 'Niche is required', success: false },
        { status: 400 }
      )
    }

    // Check if Perplexity is configured
    const isConfigured = await perplexity.isConfiguredAsync()
    if (!isConfigured) {
      return NextResponse.json(
        {
          error: 'Perplexity API key not configured. Go to Settings > API Keys to add your key.',
          success: false,
          configured: false,
        },
        { status: 400 }
      )
    }

    // Check credits
    const creditsRemaining = await getPerplexityCreditsRemaining()
    if (creditsRemaining <= 0) {
      return NextResponse.json(
        {
          error: `No Perplexity credits remaining this month (0/${PERPLEXITY_MONTHLY_CREDITS}).`,
          success: false,
          credits_remaining: 0,
        },
        { status: 429 }
      )
    }

    // Discover RSS feeds
    const result = await perplexity.discoverRSSFeeds(niche, keywords, existingSources)

    // Return results with credits info
    const newCreditsRemaining = await getPerplexityCreditsRemaining()

    return NextResponse.json({
      success: true,
      ...result,
      credits_remaining: newCreditsRemaining,
      credits_used: 1,
    })
  } catch (error) {
    console.error('RSS discovery error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discover RSS feeds',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/rss/discover
 * Get status of RSS discovery service
 */
export async function GET() {
  try {
    const isConfigured = await perplexity.isConfiguredAsync()
    const creditsRemaining = await getPerplexityCreditsRemaining()

    return NextResponse.json({
      success: true,
      configured: isConfigured,
      credits_remaining: creditsRemaining,
      credits_total: PERPLEXITY_MONTHLY_CREDITS,
      available: isConfigured && creditsRemaining > 0,
      message: !isConfigured
        ? 'Perplexity API key not configured'
        : creditsRemaining <= 0
          ? 'No credits remaining this month'
          : `Ready (${creditsRemaining}/${PERPLEXITY_MONTHLY_CREDITS} credits)`,
    })
  } catch (error) {
    console.error('Error checking RSS discovery status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
