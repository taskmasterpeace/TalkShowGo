/**
 * Producers API
 *
 * GET /api/producers - List all producers
 * POST /api/producers - Create a producer
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const archetype = searchParams.get('archetype')
    const format = searchParams.get('format')
    const opportunityType = searchParams.get('opportunityType')

    let query = supabase
      .from('producers')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (archetype) {
      query = query.eq('archetype', archetype)
    }

    const { data, error } = await query

    if (error) throw error

    // Filter by format or opportunity type if specified
    let producers = data || []

    if (format && producers.length > 0) {
      producers = producers.filter(p => p.best_for_formats?.includes(format))
    }

    if (opportunityType && producers.length > 0) {
      producers = producers.filter(p => p.trigger_opportunity_types?.includes(opportunityType))
    }

    return NextResponse.json(producers)
  } catch (error) {
    console.error('Error fetching producers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch producers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('producers')
      .insert(body)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating producer:', error)
    return NextResponse.json(
      { error: 'Failed to create producer' },
      { status: 500 }
    )
  }
}
