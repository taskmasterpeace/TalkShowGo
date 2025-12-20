/**
 * Individual Host API
 *
 * GET /api/hosts/[id] - Get a single host
 * PUT /api/hosts/[id] - Update a host
 * DELETE /api/hosts/[id] - Deactivate a host
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const { data: host, error } = await supabase
      .from('hosts')
      .select(`
        *,
        host_personality_traits(*),
        host_content_rules(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    if (!host) {
      return NextResponse.json(
        { error: 'Host not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(host)
  } catch (error) {
    console.error('Error fetching host:', error)
    return NextResponse.json(
      { error: 'Failed to fetch host' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      name,
      archetype,
      tagline,
      short_bio,
      full_bio,
      voice_style,
      voice_id,
      voice_settings,
      best_for,
      catchphrases,
      color_primary,
      color_secondary,
      gradient_bg,
      personality_traits,
    } = body

    // Update host basic info
    const { data: host, error: hostError } = await supabase
      .from('hosts')
      .update({
        name,
        archetype,
        tagline,
        short_bio,
        full_bio,
        voice_style,
        voice_id,
        voice_settings,
        best_for,
        catchphrases,
        color_primary,
        color_secondary,
        gradient_bg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (hostError) throw hostError

    // Update personality traits if provided
    if (personality_traits && personality_traits.length > 0) {
      // Delete existing traits
      await supabase
        .from('host_personality_traits')
        .delete()
        .eq('host_id', id)

      // Insert new traits
      const traitsToInsert = personality_traits.map((trait: any, index: number) => ({
        host_id: id,
        trait_name: trait.trait_name || trait.name,
        trait_category: trait.trait_category || trait.category || 'core',
        trait_value: trait.trait_value || trait.value,
        trait_description: trait.trait_description || trait.description,
        trait_icon: trait.trait_icon || trait.icon,
        display_order: index,
      }))

      const { error: traitsError } = await supabase
        .from('host_personality_traits')
        .insert(traitsToInsert)

      if (traitsError) {
        console.error('Error updating traits:', traitsError)
      }
    }

    // Fetch updated host with traits
    const { data: updatedHost } = await supabase
      .from('hosts')
      .select(`
        *,
        host_personality_traits(*)
      `)
      .eq('id', id)
      .single()

    return NextResponse.json(updatedHost)
  } catch (error) {
    console.error('Error updating host:', error)
    return NextResponse.json(
      { error: 'Failed to update host' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Soft delete - just deactivate
    const { error } = await supabase
      .from('hosts')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting host:', error)
    return NextResponse.json(
      { error: 'Failed to delete host' },
      { status: 500 }
    )
  }
}
