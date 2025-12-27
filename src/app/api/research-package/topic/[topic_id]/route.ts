import { NextRequest, NextResponse } from 'next/server'
import { loadPackagesForTopic } from '@/lib/research-package'
import { supabase } from '@/lib/db'

/**
 * GET /api/research-package/topic/[topic_id]
 *
 * Retrieve all research packages for a topic.
 *
 * Query params:
 * - limit: number (default: 10)
 * - summary: 'true' | 'false' (default: 'false') - return only metadata, not full packages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topic_id: string }> }
) {
  try {
    const { topic_id } = await params
    const searchParams = request.nextUrl.searchParams

    // Parse query params
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const summaryOnly = searchParams.get('summary') === 'true'

    // Verify topic exists
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id, name')
      .eq('id', topic_id)
      .single()

    if (topicError || !topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      )
    }

    if (summaryOnly) {
      // Return just metadata for quick listing
      const { data: packages, error } = await supabase
        .from('research_packages')
        .select('id, query, headline, story_type, stats, status, created_at')
        .eq('topic_id', topic_id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        topic: {
          id: topic.id,
          name: topic.name,
        },
        count: packages?.length || 0,
        packages: packages || [],
      })
    }

    // Return full packages
    const packages = await loadPackagesForTopic(topic_id, limit)

    return NextResponse.json({
      success: true,
      topic: {
        id: topic.id,
        name: topic.name,
      },
      count: packages.length,
      packages,
    })
  } catch (error) {
    console.error('[ResearchPackage] GET topic packages error:', error)
    return NextResponse.json(
      { error: 'Failed to load research packages' },
      { status: 500 }
    )
  }
}
