/**
 * Graph Search API
 *
 * GET /api/graph/search - Search entities and relationships
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  searchEntities,
  findMutualConnections,
  checkHealth,
} from '@/lib/knowledge-graph'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const entityId1 = searchParams.get('entity1')
    const entityId2 = searchParams.get('entity2')
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Check Memgraph connection
    const health = await checkHealth()
    if (!health.connected) {
      return NextResponse.json(
        { error: 'Knowledge graph not available', details: health.error },
        { status: 503 }
      )
    }

    // Find mutual connections between two entities
    if (entityId1 && entityId2) {
      const mutualConnections = await findMutualConnections(entityId1, entityId2)
      return NextResponse.json({
        type: 'mutual_connections',
        entity1: entityId1,
        entity2: entityId2,
        connections: mutualConnections,
        count: mutualConnections.length,
      })
    }

    // Search by name pattern
    if (query) {
      const entities = await searchEntities(query, limit)
      return NextResponse.json({
        type: 'search',
        query,
        entities,
        count: entities.length,
      })
    }

    return NextResponse.json(
      { error: 'Provide either q (search query) or entity1+entity2 (mutual connections)' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error searching graph:', error)
    return NextResponse.json(
      { error: 'Failed to search graph', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
