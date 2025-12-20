import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { EntityContext, mergeEntityContext } from '@/types/entity-context'

// GET /api/entities/[id]/context - Get entity context
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params

    const { data: entity, error } = await supabase
      .from('entities')
      .select('id, canonical_name, entity_type, metadata')
      .eq('id', entityId)
      .single()

    if (error) throw error
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    return NextResponse.json({
      entity_id: entity.id,
      name: entity.canonical_name,
      type: entity.entity_type,
      context: (entity.metadata as EntityContext) || {},
    })
  } catch (error) {
    console.error('Error fetching entity context:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entity context' },
      { status: 500 }
    )
  }
}

// PUT /api/entities/[id]/context - Replace entity context
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params
    const body: EntityContext = await request.json()

    // Add update metadata
    const context: EntityContext = {
      ...body,
      context_updated_at: new Date().toISOString(),
      context_updated_by: body.context_updated_by || 'producer_manual',
    }

    const { data: entity, error } = await supabase
      .from('entities')
      .update({ metadata: context })
      .eq('id', entityId)
      .select('id, canonical_name, entity_type, metadata')
      .single()

    if (error) throw error
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    return NextResponse.json({
      entity_id: entity.id,
      name: entity.canonical_name,
      type: entity.entity_type,
      context: entity.metadata as EntityContext,
    })
  } catch (error) {
    console.error('Error updating entity context:', error)
    return NextResponse.json(
      { error: 'Failed to update entity context' },
      { status: 500 }
    )
  }
}

// PATCH /api/entities/[id]/context - Partial update entity context
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params
    const updates: Partial<EntityContext> = await request.json()

    // Get existing context
    const { data: existing, error: fetchError } = await supabase
      .from('entities')
      .select('metadata')
      .eq('id', entityId)
      .single()

    if (fetchError) throw fetchError
    if (!existing) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    // Merge context
    const existingContext = (existing.metadata as EntityContext) || {}
    const mergedContext = mergeEntityContext(existingContext, {
      ...updates,
      context_updated_by: updates.context_updated_by || 'producer_manual',
    })

    // Update
    const { data: entity, error: updateError } = await supabase
      .from('entities')
      .update({ metadata: mergedContext })
      .eq('id', entityId)
      .select('id, canonical_name, entity_type, metadata')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      entity_id: entity.id,
      name: entity.canonical_name,
      type: entity.entity_type,
      context: entity.metadata as EntityContext,
    })
  } catch (error) {
    console.error('Error patching entity context:', error)
    return NextResponse.json(
      { error: 'Failed to patch entity context' },
      { status: 500 }
    )
  }
}
