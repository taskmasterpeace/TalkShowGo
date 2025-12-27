/**
 * GET /api/prompts
 *
 * List all prompts from registry with override status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEnrichedPromptList, getAllCustomPrompts } from '@/lib/prompt-loader'
import { PROMPT_REGISTRY, getPromptsByRole, PromptRole } from '@/lib/prompt-registry'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Filters
    const role = searchParams.get('role') as PromptRole | null
    const customizedOnly = searchParams.get('customized_only') === 'true'
    const topicId = searchParams.get('topic_id') || undefined

    // Get enriched prompt list
    let prompts = await getEnrichedPromptList(topicId)

    // Apply filters
    if (role) {
      prompts = prompts.filter(p => p.role === role)
    }

    if (customizedOnly) {
      prompts = prompts.filter(p => p.has_override)
    }

    // Stats
    const stats = {
      total: prompts.length,
      customized: prompts.filter(p => p.has_override).length,
      by_role: {
        studio: prompts.filter(p => p.role === 'studio').length,
        producer: prompts.filter(p => p.role === 'producer').length,
        host: prompts.filter(p => p.role === 'host').length,
        editor: prompts.filter(p => p.role === 'editor').length,
      },
    }

    return NextResponse.json({
      success: true,
      prompts,
      stats,
    })
  } catch (error) {
    console.error('[GET /api/prompts] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
