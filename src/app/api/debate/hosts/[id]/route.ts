/**
 * API: /api/debate/hosts/[id]
 *
 * GET - Get host by ID
 * PUT - Update host
 * DELETE - Delete host
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHostById, updateHost, deleteHost } from '@/lib/debate/host-generator'
import type { CreateHostRequest } from '@/lib/debate/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const host = await getHostById(params.id)

    if (!host) {
      return NextResponse.json({
        success: false,
        error: 'Host not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      host
    })
  } catch (error) {
    console.error('[API] Error fetching host:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: Partial<CreateHostRequest> = await request.json()

    const host = await updateHost(params.id, body)

    return NextResponse.json({
      success: true,
      host
    })
  } catch (error) {
    console.error('[API] Error updating host:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteHost(params.id)

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('[API] Error deleting host:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
