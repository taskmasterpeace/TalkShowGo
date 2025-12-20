import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/topics/[id] - Get single topic
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('*, credibility_profiles(*)')
      .eq('id', params.id)
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching topic:', error)
    return NextResponse.json(
      { error: 'Failed to fetch topic' },
      { status: 500 }
    )
  }
}

// PATCH /api/topics/[id] - Update topic
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('topics')
      .update({
        name: body.name,
        description: body.description,
        status: body.status,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating topic:', error)
    return NextResponse.json(
      { error: 'Failed to update topic' },
      { status: 500 }
    )
  }
}

// DELETE /api/topics/[id] - Archive topic
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('topics')
      .update({ status: 'archived' })
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error archiving topic:', error)
    return NextResponse.json(
      { error: 'Failed to archive topic' },
      { status: 500 }
    )
  }
}
