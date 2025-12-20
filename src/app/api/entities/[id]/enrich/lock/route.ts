/**
 * Lock Entity Enrichment API
 *
 * POST /api/entities/[id]/enrich/lock
 * Lock entity to prevent future enrichment
 */

import { NextRequest, NextResponse } from 'next/server'
import { lockEntity } from '@/lib/entity-enrichment'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params
    const body = await request.json().catch(() => ({}))

    await lockEntity(entityId, body.locked_by || 'producer')

    return NextResponse.json({
      success: true,
      message: 'Entity locked - no further enrichment will occur',
      entity_id: entityId
    })
  } catch (error) {
    console.error('Lock entity error:', error)
    return NextResponse.json(
      { error: 'Failed to lock entity', details: String(error) },
      { status: 500 }
    )
  }
}
