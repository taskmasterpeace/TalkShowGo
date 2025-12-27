/**
 * API: /api/debate/hosts
 *
 * GET - List all hosts
 * POST - Create a new host
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllHosts, createHost } from '@/lib/debate/host-generator'
import type { CreateHostRequest } from '@/lib/debate/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const archetype = searchParams.get('archetype') || undefined
    const tagsParam = searchParams.get('tags')
    const tags = tagsParam ? tagsParam.split(',') : undefined
    const active_only = searchParams.get('active_only') === 'true'

    const hosts = await getAllHosts({ archetype, tags, active_only })

    return NextResponse.json({
      success: true,
      hosts,
      count: hosts.length
    })
  } catch (error) {
    console.error('[API] Error fetching hosts:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateHostRequest = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({
        success: false,
        error: 'Name is required'
      }, { status: 400 })
    }

    const host = await createHost(body)

    return NextResponse.json({
      success: true,
      host
    })
  } catch (error) {
    console.error('[API] Error creating host:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
