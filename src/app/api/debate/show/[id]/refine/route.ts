/**
 * API: /api/debate/show/[id]/refine
 *
 * POST - Apply production strategies to refine script
 */

import { NextRequest, NextResponse } from 'next/server'
import { refineScript } from '@/lib/debate/script-refiner'
import type { AppliedStrategy } from '@/lib/debate/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: { strategies: AppliedStrategy[] } = await request.json()

    if (!body.strategies || body.strategies.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No strategies provided'
      }, { status: 400 })
    }

    console.log(`[API] Refining script for show ${params.id}`)
    console.log(`[API] Applying ${body.strategies.length} strategies`)

    const result = await refineScript(params.id, body.strategies)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('[API] Error refining script:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
