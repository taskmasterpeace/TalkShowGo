import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/topics/[id]/claims
 *
 * Fetch claims for a topic with consensus scores
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('claims')
      .select(`
        *,
        consensus_scores (
          consensus,
          contention,
          confidence,
          source_count,
          engagement_total
        ),
        claim_verdicts (
          verdict,
          reasoning
        )
      `)
      .eq('topic_id', params.id)
      .order('mention_count', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('claim_type', type)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/topics/[id]/claims
 *
 * Create a new claim manually
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('claims')
      .insert({
        topic_id: params.id,
        claim_text: body.claim_text,
        claim_type: body.claim_type || 'factual',
        status: 'emerging',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating claim:', error)
    return NextResponse.json(
      { error: 'Failed to create claim' },
      { status: 500 }
    )
  }
}
