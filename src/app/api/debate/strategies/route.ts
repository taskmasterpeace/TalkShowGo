/**
 * API: /api/debate/strategies
 *
 * GET - List all available production strategies
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllStrategies } from '@/lib/debate/script-refiner'

export async function GET(request: NextRequest) {
  try {
    const strategies = await getAllStrategies()

    // Group by category
    const grouped = strategies.reduce((acc, strategy) => {
      const category = strategy.category || 'other'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(strategy)
      return acc
    }, {} as Record<string, any[]>)

    return NextResponse.json({
      success: true,
      strategies,
      grouped,
      count: strategies.length
    })
  } catch (error) {
    console.error('[API] Error fetching strategies:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
