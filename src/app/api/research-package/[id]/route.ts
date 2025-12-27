import { NextRequest, NextResponse } from 'next/server'
import { loadResearchPackage } from '@/lib/research-package'
import { generateMarkdown } from '@/lib/research-package-markdown'
import type { ResearchPackage } from '@/types/research-package'

/**
 * GET /api/research-package/[id]
 *
 * Retrieve a research package by ID.
 *
 * Query params:
 * - format: 'json' | 'markdown' (default: 'json')
 * - sections: comma-separated list of sections to include
 * - include_transcripts: 'true' | 'false' (default: 'true')
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams

    // Parse query params
    const format = searchParams.get('format') || 'json'
    const sections = searchParams.get('sections')?.split(',').filter(Boolean)
    const includeTranscripts = searchParams.get('include_transcripts') !== 'false'

    // Load the package
    const pkg = await loadResearchPackage(id)

    if (!pkg) {
      return NextResponse.json(
        { error: 'Research package not found' },
        { status: 404 }
      )
    }

    // Filter sections if requested
    const filteredPkg = sections ? filterSections(pkg, sections) : pkg

    // Return based on format
    if (format === 'markdown') {
      const markdown = generateMarkdown(filteredPkg, {
        includeTranscripts,
        transcriptPreviewLength: 1000,
        includeRawSources: true,
        includeHostMaterials: true,
        collapsibleSections: true,
      })

      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="research-package-${id}.md"`,
        },
      })
    }

    // JSON format
    return NextResponse.json({
      success: true,
      package: filteredPkg,
    })
  } catch (error) {
    console.error('[ResearchPackage] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load research package' },
      { status: 500 }
    )
  }
}

/**
 * Filter package to include only requested sections
 */
function filterSections(
  pkg: ResearchPackage,
  sections: string[]
): ResearchPackage {
  const sectionSet = new Set(sections.map(s => s.toLowerCase()))

  return {
    metadata: pkg.metadata,
    raw_sources: sectionSet.has('raw') || sectionSet.has('sources') || sectionSet.has('raw_sources')
      ? pkg.raw_sources
      : { youtube_videos: [], tweets: [], comments: [], web_documents: [] },
    intelligence: sectionSet.has('intelligence') || sectionSet.has('entities') || sectionSet.has('claims')
      ? {
          entities: sectionSet.has('entities') || sectionSet.has('intelligence')
            ? pkg.intelligence.entities
            : [],
          claims: sectionSet.has('claims') || sectionSet.has('intelligence')
            ? pkg.intelligence.claims
            : [],
          event_timeline: pkg.intelligence.event_timeline,
          consensus_summary: pkg.intelligence.consensus_summary,
        }
      : { entities: [], claims: [] },
    producer: sectionSet.has('producer')
      ? pkg.producer
      : {
          story_summary: pkg.producer.story_summary,
          key_facts: [],
          quotes_to_use: [],
          warnings: [],
          suggested_angles: [],
          research_gaps: [],
        },
    host: sectionSet.has('host')
      ? pkg.host
      : {
          script_outline: { title: '', estimated_duration_minutes: 0, sections: [] },
          talking_points: [],
          pronunciation_guide: [],
          entity_glossary: '',
        },
    interviews: sectionSet.has('interviews')
      ? pkg.interviews
      : { interviews: [], total_interview_minutes: 0 },
    twitter: sectionSet.has('twitter')
      ? pkg.twitter
      : undefined,
    export_formats_available: pkg.export_formats_available,
  }
}
