/**
 * /api/prompts/[id] endpoints
 *
 * GET - Fetch prompt with default + custom override
 * PUT - Save custom override
 * DELETE - Reset to default
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPromptById } from '@/lib/prompt-registry'
import {
  getCustomPrompt,
  saveCustomPrompt,
  resetToDefault,
} from '@/lib/prompt-loader'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promptId = params.id
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id') || undefined

    // Get default from registry
    const defaultPrompt = getPromptById(promptId)
    if (!defaultPrompt) {
      return NextResponse.json(
        { success: false, error: `Prompt ${promptId} not found` },
        { status: 404 }
      )
    }

    // Get custom override if exists
    const customOverride = await getCustomPrompt(promptId, topicId)

    return NextResponse.json({
      success: true,
      default: defaultPrompt,
      custom: customOverride,
      active_source: customOverride ? 'custom' : 'default',
    })
  } catch (error) {
    console.error(`[GET /api/prompts/${params.id}] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promptId = params.id
    const body = await request.json()

    const { template, topic_id, notes } = body

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template is required' },
        { status: 400 }
      )
    }

    // Save custom prompt
    const result = await saveCustomPrompt(promptId, template, topic_id, notes)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      version: result.version,
      message: `Custom prompt saved successfully (version ${result.version})`,
    })
  } catch (error) {
    console.error(`[PUT /api/prompts/${params.id}] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promptId = params.id
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id') || undefined

    // Reset to default
    const result = await resetToDefault(promptId, topicId)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Prompt reset to default successfully',
    })
  } catch (error) {
    console.error(`[DELETE /api/prompts/${params.id}] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
