/**
 * Graph Statistics API
 *
 * GET /api/graph/stats - Get knowledge graph statistics
 */

import { NextResponse } from 'next/server'
import { getGraphStats, getMostConnected, checkHealth } from '@/lib/knowledge-graph'

export async function GET() {
  try {
    // Check Memgraph connection
    const health = await checkHealth()
    if (!health.connected) {
      return NextResponse.json(
        { error: 'Knowledge graph not available', details: health.error },
        { status: 503 }
      )
    }

    const [stats, topConnected] = await Promise.all([
      getGraphStats(),
      getMostConnected(10),
    ])

    return NextResponse.json({
      ...stats,
      top_connected: topConnected,
    })
  } catch (error) {
    console.error('Error getting graph stats:', error)
    return NextResponse.json(
      { error: 'Failed to get graph statistics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
