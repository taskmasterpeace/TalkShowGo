/**
 * Hosts API
 *
 * GET /api/hosts - List all hosts with personality traits
 * POST /api/hosts - Create a host
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const archetype = searchParams.get('archetype')
    const format = searchParams.get('format')
    const includeTraits = searchParams.get('includeTraits') !== 'false'

    let query = supabase
      .from('hosts')
      .select(includeTraits ? `
        *,
        host_personality_traits(*)
      ` : '*')
      .eq('is_active', true)
      .order('name')

    if (archetype) {
      query = query.eq('archetype', archetype)
    }

    const { data, error } = await query

    if (error) throw error

    // Filter by format if specified (array contains)
    let hosts: any[] = data || []
    if (format && hosts.length > 0) {
      hosts = hosts.filter(h => h.best_for_formats?.includes(format))
    }

    return NextResponse.json(hosts)
  } catch (error) {
    console.error('Error fetching hosts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hosts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      name,
      archetype,
      tagline,
      short_bio,
      full_bio,
      voice_style,
      voice_id,
      best_for,
      catchphrases,
      color_primary,
      color_secondary,
      gradient_bg,
      personality_traits,
    } = body

    if (!name || !archetype) {
      return NextResponse.json(
        { error: 'Name and archetype are required' },
        { status: 400 }
      )
    }

    // Insert host
    const { data: host, error: hostError } = await supabase
      .from('hosts')
      .insert({
        name,
        archetype,
        tagline,
        short_bio,
        full_bio,
        voice_style,
        voice_id,
        best_for: best_for || [],
        catchphrases: catchphrases || [],
        color_primary: color_primary || '#6366f1',
        color_secondary: color_secondary || '#818cf8',
        gradient_bg: gradient_bg || 'from-indigo-500/20 to-purple-500/20',
      })
      .select()
      .single()

    if (hostError) throw hostError

    // Insert personality traits if provided
    if (personality_traits && personality_traits.length > 0) {
      const traitsToInsert = personality_traits.map((trait: any, index: number) => ({
        host_id: host.id,
        trait_name: trait.name,
        trait_category: trait.category || 'core',
        trait_value: trait.value,
        trait_description: trait.description,
        trait_icon: trait.icon,
        display_order: index,
      }))

      const { error: traitsError } = await supabase
        .from('host_personality_traits')
        .insert(traitsToInsert)

      if (traitsError) {
        console.error('Error inserting traits:', traitsError)
      }
    }

    return NextResponse.json(host, { status: 201 })
  } catch (error) {
    console.error('Error creating host:', error)
    return NextResponse.json(
      { error: 'Failed to create host' },
      { status: 500 }
    )
  }
}
