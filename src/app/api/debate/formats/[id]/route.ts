/**
 * API: /api/debate/formats/[id]
 *
 * GET - Get format details
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: format, error } = await supabase
      .from('show_formats')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !format) {
      return NextResponse.json({
        success: false,
        error: 'Format not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      format
    })
  } catch (error) {
    console.error('[API] Error fetching format:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
