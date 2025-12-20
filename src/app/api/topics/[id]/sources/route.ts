import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

interface AddSourceRequest {
  platform: 'twitter' | 'youtube' | 'rss'
  handle: string
  display_name?: string
  description?: string
  notes?: string
  metadata?: Record<string, unknown>
}

// GET /api/topics/[id]/sources - List sources for topic
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    let query = supabase
      .from('source_accounts')
      .select('*')
      .eq('topic_id', params.id)
      .order('credibility_score', { ascending: false })

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sources' },
      { status: 500 }
    )
  }
}

// POST /api/topics/[id]/sources - Add source to topic
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: AddSourceRequest = await request.json()

    if (!body.platform || !body.handle) {
      return NextResponse.json(
        { error: 'Platform and handle are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('source_accounts')
      .insert({
        topic_id: params.id,
        platform: body.platform,
        handle: body.handle,
        display_name: body.display_name || body.handle.replace('@', ''),
        description: body.description || null,
        notes: body.notes || null,
        metadata: body.metadata || {},
        status: 'seed',
        credibility_score: 0.7,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error adding source:', error)
    return NextResponse.json(
      { error: 'Failed to add source' },
      { status: 500 }
    )
  }
}

// DELETE /api/topics/[id]/sources?sourceId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')

    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId parameter is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('source_accounts')
      .delete()
      .eq('id', sourceId)
      .eq('topic_id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting source:', error)
    return NextResponse.json(
      { error: 'Failed to delete source' },
      { status: 500 }
    )
  }
}

// PATCH /api/topics/[id]/sources - Update source
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    if (!body.sourceId) {
      return NextResponse.json(
        { error: 'sourceId is required' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {}
    if (body.display_name) updates.display_name = body.display_name
    if (body.description) updates.description = body.description
    if (body.notes) updates.notes = body.notes
    if (body.status) updates.status = body.status
    if (body.metadata) updates.metadata = body.metadata

    const { data, error } = await supabase
      .from('source_accounts')
      .update(updates)
      .eq('id', body.sourceId)
      .eq('topic_id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating source:', error)
    return NextResponse.json(
      { error: 'Failed to update source' },
      { status: 500 }
    )
  }
}
