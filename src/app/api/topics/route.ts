import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { CreateTopicRequest } from '@/lib/types'

// GET /api/topics - List all topics
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching topics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch topics' },
      { status: 500 }
    )
  }
}

// POST /api/topics - Create new topic
export async function POST(request: NextRequest) {
  try {
    const body: CreateTopicRequest = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('topics')
      .insert({
        name: body.name,
        description: body.description,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error

    // Also create default credibility profile
    await supabase.from('credibility_profiles').insert({
      topic_id: data.id,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating topic:', error)
    return NextResponse.json(
      { error: 'Failed to create topic' },
      { status: 500 }
    )
  }
}
