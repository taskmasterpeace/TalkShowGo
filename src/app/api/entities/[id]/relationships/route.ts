/**
 * Entity Relationships API
 *
 * GET /api/entities/[id]/relationships - Get all relationships for an entity
 * POST /api/entities/[id]/relationships - Create a new relationship
 * DELETE /api/entities/[id]/relationships - Delete a relationship
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getEntityRelationships,
  createRelationship,
  deleteRelationship,
  RelationType,
  getEntityBattles,
  getEntityInterviews,
  checkHealth,
} from '@/lib/knowledge-graph'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as RelationType | null
    const view = searchParams.get('view') // 'all', 'battles', 'interviews'

    // Check Memgraph connection
    const health = await checkHealth()
    if (!health.connected) {
      return NextResponse.json(
        { error: 'Knowledge graph not available', details: health.error },
        { status: 503 }
      )
    }

    let relationships

    if (view === 'battles') {
      relationships = await getEntityBattles(id)
      return NextResponse.json({ battles: relationships })
    }

    if (view === 'interviews') {
      relationships = await getEntityInterviews(id)
      return NextResponse.json({ interviews: relationships })
    }

    // Default: get all relationships
    relationships = await getEntityRelationships(id, type || undefined)

    // Group by relationship type for easier consumption
    const grouped = relationships.reduce((acc, rel) => {
      const type = rel.relationship.type
      if (!acc[type]) acc[type] = []
      acc[type].push(rel)
      return acc
    }, {} as Record<string, typeof relationships>)

    return NextResponse.json({
      entity_id: id,
      total: relationships.length,
      relationships,
      by_type: grouped,
    })
  } catch (error) {
    console.error('Error getting relationships:', error)
    return NextResponse.json(
      { error: 'Failed to get relationships', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params
    const body = await request.json()

    const { target_id, type, properties } = body

    if (!target_id) {
      return NextResponse.json(
        { error: 'target_id is required' },
        { status: 400 }
      )
    }

    if (!type || !Object.values(RelationType).includes(type)) {
      return NextResponse.json(
        { error: 'Invalid relationship type', valid_types: Object.values(RelationType) },
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

    const relationship = await createRelationship({
      type,
      source_id: sourceId,
      target_id,
      properties: properties || {},
    })

    return NextResponse.json({
      success: true,
      relationship,
    })
  } catch (error) {
    console.error('Error creating relationship:', error)
    return NextResponse.json(
      { error: 'Failed to create relationship', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params
    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('target_id')
    const type = searchParams.get('type') as RelationType | null

    if (!targetId || !type) {
      return NextResponse.json(
        { error: 'target_id and type are required' },
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

    await deleteRelationship(sourceId, targetId, type)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting relationship:', error)
    return NextResponse.json(
      { error: 'Failed to delete relationship', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
