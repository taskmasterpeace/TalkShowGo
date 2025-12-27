/**
 * API: /api/debate/hosts/generate
 *
 * POST - Generate host from celebrity/figure name using AI
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateHostFromTemplate, createHost } from '@/lib/debate/host-generator'
import type { GenerateHostFromTemplateRequest } from '@/lib/debate/types'

export async function POST(request: NextRequest) {
  try {
    const body: GenerateHostFromTemplateRequest = await request.json()

    if (!body.template_name) {
      return NextResponse.json({
        success: false,
        error: 'template_name is required'
      }, { status: 400 })
    }

    // Generate profile from template
    const { profile, template_id } = await generateHostFromTemplate(
      body.template_name,
      body.category
    )

    // If edit_before_saving is true, return profile for review
    if (body.edit_before_saving) {
      return NextResponse.json({
        success: true,
        profile,
        template_id,
        saved: false
      })
    }

    // Otherwise create the host immediately
    const host = await createHost(profile)

    return NextResponse.json({
      success: true,
      host,
      template_id,
      saved: true
    })
  } catch (error) {
    console.error('[API] Error generating host:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
