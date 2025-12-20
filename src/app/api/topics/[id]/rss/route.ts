import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/topics/[id]/rss - List RSS feeds for topic
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('topic_id', params.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching RSS feeds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RSS feeds' },
      { status: 500 }
    )
  }
}

// POST /api/topics/[id]/rss - Add RSS feed
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    if (!body.feed_url) {
      return NextResponse.json(
        { error: 'feed_url is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('rss_feeds')
      .insert({
        topic_id: params.id,
        feed_url: body.feed_url,
        name: body.name || new URL(body.feed_url).hostname,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error adding RSS feed:', error)
    return NextResponse.json(
      { error: 'Failed to add RSS feed' },
      { status: 500 }
    )
  }
}

// DELETE /api/topics/[id]/rss?feedId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const feedId = searchParams.get('feedId')

    if (!feedId) {
      return NextResponse.json(
        { error: 'feedId parameter is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('rss_feeds')
      .delete()
      .eq('id', feedId)
      .eq('topic_id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting RSS feed:', error)
    return NextResponse.json(
      { error: 'Failed to delete RSS feed' },
      { status: 500 }
    )
  }
}
