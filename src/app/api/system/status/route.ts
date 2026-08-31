/**
 * System Status API
 *
 * GET /api/system/status - Get health status of all services
 *
 * Shows what's connected, working, and missing.
 * Use this to diagnose configuration issues.
 */

import { NextResponse } from 'next/server'
import {
  getSystemHealth,
  getHealthSummary,
  type SystemHealthReport,
} from '@/lib/system-health'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/system/status
 *
 * Query params:
 * - summary=true: Return only a quick summary
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const summaryOnly = searchParams.get('summary') === 'true'

    if (summaryOnly) {
      const summary = await getHealthSummary()
      return NextResponse.json({
        success: true,
        ...summary,
      })
    }

    const report = await getSystemHealth()

    // Count services by status
    const allServices = Object.values(report.services).flat()
    const statusCounts = {
      connected: allServices.filter(s => s.status === 'connected').length,
      error: allServices.filter(s => s.status === 'error').length,
      missing: allServices.filter(s => s.status === 'missing').length,
      rate_limited: allServices.filter(s => s.status === 'rate_limited').length,
      warning: allServices.filter(s => s.status === 'warning').length,
    }

    return NextResponse.json({
      success: true,
      timestamp: report.timestamp,
      overall: report.overall,
      statusCounts,
      services: report.services,
      // Include environment info for debugging
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasTheNewsAPI: !!process.env.THENEWSAPI_KEY,
        hasNewsDataIO: !!process.env.NEWSDATA_API_KEY,
        hasDiaTTS: true,  // Dia is local, no API key needed
        hasTwitterAPI: !!process.env.TWITTER_API_KEY,
        hasAnthropicAPI: !!process.env.ANTHROPIC_API_KEY,
        ollamaHost: process.env.OLLAMA_HOST || process.env.PRESIDIUM_LLM_URL || 'default',
        searxngUrl: process.env.SEARXNG_URL || 'default',
      },
    })
  } catch (error) {
    console.error('[System Status] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'System health check failed',
      },
      { status: 500 }
    )
  }
}
