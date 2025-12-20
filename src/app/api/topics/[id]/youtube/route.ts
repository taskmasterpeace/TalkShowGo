import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/topics/[id]/youtube - List YouTube channels for topic
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('topic_id', params.id)
      .order('credibility_score', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching YouTube channels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch YouTube channels' },
      { status: 500 }
    )
  }
}

// POST /api/topics/[id]/youtube - Add YouTube channel
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    if (!body.channel_name) {
      return NextResponse.json(
        { error: 'channel_name is required' },
        { status: 400 }
      )
    }

    // Generate a placeholder channel ID if not provided
    const channelId = body.channel_id || `UC_${body.channel_name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`

    const { data, error } = await supabase
      .from('youtube_channels')
      .insert({
        topic_id: params.id,
        channel_id: channelId,
        channel_name: body.channel_name,
        handle: body.handle || null,
        description: body.description || null,
        notes: body.notes || null,
        credibility_score: body.credibility_score || 0.7,
        status: body.status || 'trusted',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error adding YouTube channel:', error)
    return NextResponse.json(
      { error: 'Failed to add YouTube channel' },
      { status: 500 }
    )
  }
}

// DELETE /api/topics/[id]/youtube?channelId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId parameter is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('youtube_channels')
      .delete()
      .eq('id', channelId)
      .eq('topic_id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting YouTube channel:', error)
    return NextResponse.json(
      { error: 'Failed to delete YouTube channel' },
      { status: 500 }
    )
  }
}
