/**
 * Graph Sync API
 *
 * POST /api/graph/sync - Sync entities from PostgreSQL to Memgraph
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncTopicEntities, fullSync, syncSingleEntity, clearGraph } from '@/lib/graph-sync'
import { checkHealth, getGraphStats } from '@/lib/knowledge-graph'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic_id, entity_id, mode } = body

    // Check Memgraph connection
    const health = await checkHealth()
    if (!health.connected) {
      return NextResponse.json(
        { error: 'Knowledge graph not available', details: health.error },
        { status: 503 }
      )
    }

    // Sync single entity
    if (entity_id) {
      await syncSingleEntity(entity_id)
      return NextResponse.json({
        success: true,
        mode: 'single',
        entity_id,
      })
    }

    // Sync topic entities
    if (!topic_id) {
      return NextResponse.json(
        { error: 'topic_id or entity_id is required' },
        { status: 400 }
      )
    }

    let result

    if (mode === 'full') {
      // Full sync: clear graph and rebuild
      result = await fullSync(topic_id)
    } else {
      // Incremental sync: add/update without clearing
      result = await syncTopicEntities(topic_id)
    }

    // Get updated stats
    const stats = await getGraphStats()

    return NextResponse.json({
      success: true,
      mode: mode || 'incremental',
      topic_id,
      ...result,
      graph_stats: stats,
    })
  } catch (error) {
    console.error('Error syncing graph:', error)
    return NextResponse.json(
      { error: 'Failed to sync graph', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Check Memgraph connection
    const health = await checkHealth()
    if (!health.connected) {
      return NextResponse.json(
        { error: 'Knowledge graph not available', details: health.error },
        { status: 503 }
      )
    }

    await clearGraph()

    return NextResponse.json({
      success: true,
      message: 'Graph cleared',
    })
  } catch (error) {
    console.error('Error clearing graph:', error)
    return NextResponse.json(
      { error: 'Failed to clear graph', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
