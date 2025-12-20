/**
 * Templates API
 *
 * GET /api/templates - List all templates
 * POST /api/templates - Create a new template
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import type { ShowTemplate } from '@/lib/template-engine'

// GET - List all templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const templateType = searchParams.get('type')
    const activeOnly = searchParams.get('active') !== 'false'

    let query = supabase
      .from('show_templates')
      .select('*')
      .order('name', { ascending: true })

    if (topicId) {
      query = query.eq('topic_id', topicId)
    }

    if (templateType) {
      query = query.eq('template_type', templateType)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('[Templates API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates', details: String(error) },
      { status: 500 }
    )
  }
}

// POST - Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      name,
      slug,
      description,
      template_type = 'daily',
      intro_template,
      story_template,
      outro_template,
      twitter_digest_template,
      default_story_count = 3,
      default_hours_back = 24,
      max_duration_minutes = 15,
      style_tone = 'engaging',
      include_twitter_digest = true,
      include_cta = true,
      preferred_host_slug,
      topic_id,
      is_active = true,
      is_default = false
    } = body

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!intro_template?.trim()) {
      return NextResponse.json({ error: 'Intro template is required' }, { status: 400 })
    }
    if (!story_template?.trim()) {
      return NextResponse.json({ error: 'Story template is required' }, { status: 400 })
    }
    if (!outro_template?.trim()) {
      return NextResponse.json({ error: 'Outro template is required' }, { status: 400 })
    }

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    // Check for duplicate slug
    const { data: existing } = await supabase
      .from('show_templates')
      .select('id')
      .eq('slug', finalSlug)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'A template with this slug already exists' },
        { status: 409 }
      )
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('show_templates')
        .update({ is_default: false })
        .eq('template_type', template_type)
    }

    // Create template
    const { data, error } = await supabase
      .from('show_templates')
      .insert({
        name,
        slug: finalSlug,
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
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[Templates API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create template', details: String(error) },
      { status: 500 }
    )
  }
}
