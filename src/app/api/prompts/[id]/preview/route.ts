/**
 * POST /api/prompts/[id]/preview
 *
 * Preview a filled prompt with test variables
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPromptById, fillPromptTemplate } from '@/lib/prompt-registry'
import { getCustomPrompt } from '@/lib/prompt-loader'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promptId = params.id
    const body = await request.json()

    const { variables, use_custom, topic_id } = body

    if (!variables || typeof variables !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Variables object is required' },
        { status: 400 }
      )
    }

    // Get default prompt
    const defaultPrompt = getPromptById(promptId)
    if (!defaultPrompt) {
      return NextResponse.json(
        { success: false, error: `Prompt ${promptId} not found` },
        { status: 404 }
      )
    }

    // Get custom if requested
    let customPrompt = null
    if (use_custom) {
      customPrompt = await getCustomPrompt(promptId, topic_id)
    }

    // Fill default
    let defaultFilled = ''
    let defaultMissing: string[] = []
    try {
      defaultFilled = fillPromptTemplate(defaultPrompt, variables)
    } catch (error) {
      defaultMissing = [String(error)]
    }

    // Fill custom if exists
    let customFilled = ''
    let customMissing: string[] = []
    if (customPrompt) {
      try {
        // Create a temporary PromptDefinition for custom template
        const tempPrompt = {
          ...defaultPrompt,
          template: customPrompt.template,
        }
        customFilled = fillPromptTemplate(tempPrompt, variables)
      } catch (error) {
        customMissing = [String(error)]
      }
    }

    return NextResponse.json({
      success: true,
      default: {
        filled: defaultFilled,
        missing_variables: defaultMissing,
      },
      custom: customPrompt
        ? {
            filled: customFilled,
            missing_variables: customMissing,
            version: customPrompt.version,
          }
        : null,
    })
  } catch (error) {
    console.error(`[POST /api/prompts/${params.id}/preview] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
