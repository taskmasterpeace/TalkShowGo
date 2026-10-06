/**
 * Graph Path API
 *
 * GET /api/graph/path - Find connection path between two entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { findConnectionPath, checkHealth } from '@/lib/knowledge-graph'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const maxHops = parseInt(searchParams.get('max_hops') || '5', 10)

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Both from and to entity IDs are required' },
        { status: 400 }
      )
    }

    // Check Memgraph connection
    const health = await checkHealth()
    if (!health.connected) {
      return NextResponse.json(
        { error: 'Knowledge graph not available', details: health.error },
        { status: 503 }
      )
    }

    const path = await findConnectionPath(from, to, maxHops)

    if (!path) {
      return NextResponse.json({
        connected: false,
        message: `No connection found between entities within ${maxHops} hops`,
        from,
        to,
      })
    }

    return NextResponse.json({
      connected: true,
      from,
      to,
      path,
      degrees_of_separation: path.length,
    })
  } catch (error) {
    console.error('Error finding path:', error)
    return NextResponse.json(
      { error: 'Failed to find connection path', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
