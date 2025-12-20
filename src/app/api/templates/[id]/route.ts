/**
 * Single Template API
 *
 * GET /api/templates/[id] - Get template by ID
 * PUT /api/templates/[id] - Update template
 * DELETE /api/templates/[id] - Delete template
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET - Get template by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabase
      .from('show_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Templates API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template', details: String(error) },
      { status: 500 }
    )
  }
}

// PUT - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      name,
      description,
      template_type,
      intro_template,
      story_template,
      outro_template,
      twitter_digest_template,
      default_story_count,
      default_hours_back,
      max_duration_minutes,
      style_tone,
      include_twitter_digest,
      include_cta,
      preferred_host_slug,
      topic_id,
      is_active,
      is_default
    } = body

    // Build update object (only include provided fields)
    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (template_type !== undefined) updates.template_type = template_type
    if (intro_template !== undefined) updates.intro_template = intro_template
    if (story_template !== undefined) updates.story_template = story_template
    if (outro_template !== undefined) updates.outro_template = outro_template
    if (twitter_digest_template !== undefined) updates.twitter_digest_template = twitter_digest_template
    if (default_story_count !== undefined) updates.default_story_count = default_story_count
    if (default_hours_back !== undefined) updates.default_hours_back = default_hours_back
    if (max_duration_minutes !== undefined) updates.max_duration_minutes = max_duration_minutes
    if (style_tone !== undefined) updates.style_tone = style_tone
    if (include_twitter_digest !== undefined) updates.include_twitter_digest = include_twitter_digest
    if (include_cta !== undefined) updates.include_cta = include_cta
    if (preferred_host_slug !== undefined) updates.preferred_host_slug = preferred_host_slug
    if (topic_id !== undefined) updates.topic_id = topic_id
    if (is_active !== undefined) updates.is_active = is_active

    // Handle is_default specially
    if (is_default === true) {
      // Get the template type first
      const { data: current } = await supabase
        .from('show_templates')
        .select('template_type')
        .eq('id', id)
        .single()

      if (current) {
        // Unset other defaults of same type
        await supabase
          .from('show_templates')
          .update({ is_default: false })
          .eq('template_type', current.template_type)
          .neq('id', id)
      }
      updates.is_default = true
    } else if (is_default === false) {
      updates.is_default = false
    }

    // Update template
    const { data, error } = await supabase
      .from('show_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Templates API] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update template', details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabase
      .from('show_templates')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Template deleted' })
  } catch (error) {
    console.error('[Templates API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete template', details: String(error) },
      { status: 500 }
    )
  }
}
