/**
 * Workflows API
 *
 * GET /api/workflows - List all workflows
 * POST /api/workflows - Create a workflow
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topicId')
    const phase = searchParams.get('phase')
    const activeOnly = searchParams.get('active') !== 'false'

    let query = supabase
      .from('workflows')
      .select(`
        *,
        topics (id, name)
      `)
      .order('pipeline_phase')
      .order('name')

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (topicId) {
      query = query.or(`topic_id.eq.${topicId},topic_id.is.null`)
    }

    if (phase) {
      query = query.eq('pipeline_phase', phase)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Calculate next_run_at based on schedule
    let next_run_at = null
    if (body.schedule_type === 'interval' && body.schedule_interval_minutes) {
      next_run_at = new Date(Date.now() + body.schedule_interval_minutes * 60 * 1000)
    }

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        ...body,
        next_run_at,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating workflow:', error)
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    // Recalculate next_run_at if schedule changed
    if (updates.schedule_type === 'interval' && updates.schedule_interval_minutes) {
      updates.next_run_at = new Date(Date.now() + updates.schedule_interval_minutes * 60 * 1000)
    }

    const { data, error } = await supabase
      .from('workflows')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating workflow:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    )
  }
}
