/**
 * GET /api/prompts/[id]/history
 *
 * Get change history for a prompt
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPromptHistory } from '@/lib/prompt-loader'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promptId = params.id
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id') || undefined

    const history = await getPromptHistory(promptId, topicId)

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    })
  } catch (error) {
    console.error(`[GET /api/prompts/${params.id}/history] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
