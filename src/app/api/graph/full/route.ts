/**
 * Full Graph API
 *
 * GET /api/graph/full - Get all nodes and edges for visualization
 *
 * Query Parameters:
 *   - topic_id: Filter by topic/niche (required for topic-specific views)
 *   - limit: Maximum nodes to return (default: 500)
 *   - entity_type: Filter by entity type (person, organization, league, event)
 *   - relationship_type: Filter by relationship type (BATTLED, INTERVIEWED, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFullGraph, checkHealth, getGraphStats } from '@/lib/knowledge-graph'

export async function GET(request: NextRequest) {
  try {
    // Check Memgraph connection
    const health = await checkHealth()
    if (!health.connected) {
      return NextResponse.json(
        { error: 'Knowledge graph not available', details: health.error },
        { status: 503 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id') || undefined
    const limit = parseInt(searchParams.get('limit') || '500', 10)
    const entityType = searchParams.get('entity_type') || undefined
    const relationshipType = searchParams.get('relationship_type') || undefined

    // Get full graph data (filtered by topic if provided)
    const [graphData, stats] = await Promise.all([
      getFullGraph({ limit, entityType, relationshipType, topicId }),
      getGraphStats(),
    ])

    return NextResponse.json({
      success: true,
      nodes: graphData.nodes,
      edges: graphData.edges,
      stats: {
        total_entities: stats.total_entities,
        total_relationships: stats.total_relationships,
        entity_type_counts: stats.entity_type_counts,
        relationship_counts: stats.relationship_counts,
        nodes_returned: graphData.nodes.length,
        edges_returned: graphData.edges.length,
      },
      filters: {
        topic_id: topicId || null,
        limit,
        entity_type: entityType || null,
        relationship_type: relationshipType || null,
      },
    })
  } catch (error) {
    console.error('[GraphFullAPI] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get graph data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
