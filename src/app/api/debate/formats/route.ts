/**
 * API: /api/debate/formats
 *
 * GET - List all show formats
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    const { data: formats, error } = await supabase
      .from('show_formats')
      .select('*')
      .order('name')

    if (error) {
      console.error('[API] Error fetching formats:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch formats'
      }, { status: 500 })
    }

    // Group by format_type
    const grouped = (formats || []).reduce((acc, format) => {
      const type = format.format_type || 'other'
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(format)
      return acc
    }, {} as Record<string, any[]>)

    return NextResponse.json({
      success: true,
      formats: formats || [],
      grouped,
      count: formats?.length || 0
    })
  } catch (error) {
    console.error('[API] Error in formats endpoint:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
