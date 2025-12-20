import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/exports - List export records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')

    let query = supabase
      .from('exports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      // Table might not exist yet - return empty array
      console.log('Exports table may not exist yet:', error.message)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching exports:', error)
    return NextResponse.json([])
  }
}

// POST /api/exports - Create new export record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { story_id, story_headline, destination, status } = body

    const { data, error } = await supabase
      .from('exports')
      .insert({
        story_id,
        story_headline,
        destination: destination || 'directors_palette',
        status: status || 'pending',
        version: 1,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating export:', error)
    return NextResponse.json(
      { error: 'Failed to create export' },
      { status: 500 }
    )
  }
}
