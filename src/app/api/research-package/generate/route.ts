import { NextRequest, NextResponse } from 'next/server'
import { assembleResearchPackage, saveResearchPackage } from '@/lib/research-package'
import { generateMarkdown } from '@/lib/research-package-markdown'
import { runResearchWorkflow } from '@/lib/research-workflow'
import type { GeneratePackageRequest, ResearchPackageResponse } from '@/types/research-package'

/**
 * POST /api/research-package/generate
 *
 * Generate a new research package from a query.
 * This runs the full research workflow and assembles the package.
 *
 * Request body:
 * {
 *   query: string
 *   topic_id?: string
 *   options?: {
 *     enable_interviews?: boolean
 *     enable_twitter?: boolean
 *     enable_documents?: boolean
 *     max_videos?: number
 *     max_tweets?: number
 *   }
 *   generate_producer_materials?: boolean
 *   generate_host_materials?: boolean
 * }
 *
 * Query params:
 * - format: 'json' | 'markdown' | 'both' (default: 'json')
 * - save: 'true' | 'false' (default: 'true')
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GeneratePackageRequest
    const searchParams = request.nextUrl.searchParams

    // Validate request
    if (!body.query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const format = searchParams.get('format') || 'json'
    const shouldSave = searchParams.get('save') !== 'false'

    // Build workflow options
    const workflowOptions = {
      query: body.query,
      topic_id: body.topic_id,
      enable_interview_lookup: body.options?.enable_interviews ?? true,
      enable_twitter_sentiment: body.options?.enable_twitter ?? true,
      enable_document_search: body.options?.enable_documents ?? false,
      max_videos: body.options?.max_videos ?? 10,
    }

    console.log('[ResearchPackage] Generating package for:', body.query)

    // Run the research workflow
    const workflowResult = await runResearchWorkflow(workflowOptions)

    // Check if workflow produced any sources
    if (workflowResult.sources.length === 0 && workflowResult.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Research workflow failed - no sources found',
          details: workflowResult.errors.map(e => e.message).join('; ')
        },
        { status: 500 }
      )
    }

    // Assemble the research package
    const pkg = await assembleResearchPackage(workflowResult, {
      topic_id: body.topic_id,
      include_transcripts: true,
      transcript_limit: 10000,
      generate_producer_materials: body.generate_producer_materials ?? true,
      generate_host_materials: body.generate_host_materials ?? true,
    })

    // Save to database if requested
    if (shouldSave) {
      const saveResult = await saveResearchPackage(pkg)
      if (!saveResult.success) {
        console.warn('[ResearchPackage] Save failed:', saveResult.error)
      }
    }

    // Generate response based on format
    const response: ResearchPackageResponse = {
      success: true,
      package: pkg,
    }

    if (format === 'markdown' || format === 'both') {
      response.markdown = generateMarkdown(pkg, {
        includeTranscripts: true,
        transcriptPreviewLength: 1000,
        includeRawSources: true,
        includeHostMaterials: true,
        collapsibleSections: true,
      })
    }

    if (format === 'markdown') {
      // Return just markdown
      return new NextResponse(response.markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="research-package-${pkg.metadata.package_id}.md"`,
        },
      })
    }

    // Add export URLs
    response.export_urls = {
      json: `/api/research-package/${pkg.metadata.package_id}?format=json`,
      markdown: `/api/research-package/${pkg.metadata.package_id}?format=markdown`,
      json_full: `/api/research-package/${pkg.metadata.package_id}?format=json&include_transcripts=true`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[ResearchPackage] Generate error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate research package',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
