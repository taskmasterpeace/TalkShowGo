/**
 * Unlock Entity Enrichment API
 *
 * POST /api/entities/[id]/enrich/unlock
 * Unlock entity to allow future enrichment
 */

import { NextRequest, NextResponse } from 'next/server'
import { unlockEntity } from '@/lib/entity-enrichment'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params

    await unlockEntity(entityId)

    return NextResponse.json({
      success: true,
      message: 'Entity unlocked - enrichment can now occur',
      entity_id: entityId
    })
  } catch (error) {
    console.error('Unlock entity error:', error)
    return NextResponse.json(
      { error: 'Failed to unlock entity', details: String(error) },
      { status: 500 }
    )
  }
}
