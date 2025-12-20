import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { analyzeClaimsForOpportunities, ProducerIntent } from '@/lib/producer'

/**
 * GET /api/topics/[id]/producer
 *
 * Analyze content for production opportunities
 * The Producer brain that determines what content to create
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get all claims with their consensus scores and stance counts
    const { data: claims, error: claimsError } = await supabase
      .from('claims')
      .select(`
        id,
        claim_text,
        claim_type,
        mention_count,
        status,
        first_seen,
        consensus_scores (
          consensus,
          contention,
          confidence,
          source_count
        )
      `)
      .eq('topic_id', params.id)
      .in('status', ['emerging', 'active'])
      .order('mention_count', { ascending: false })
      .limit(50)

    if (claimsError) throw claimsError

    // Get stance counts for each claim
    const claimsWithStances = await Promise.all(
      (claims || []).map(async (claim) => {
        const { data: mentions } = await supabase
          .from('claim_mentions')
          .select('stance')
          .eq('claim_id', claim.id)

        const stances = {
          supports: 0,
          denies: 0,
          neutral: 0,
          questions: 0,
        }

        for (const mention of mentions || []) {
          if (mention.stance in stances) {
            stances[mention.stance as keyof typeof stances]++
          }
        }

        return {
          ...claim,
          consensus_scores: claim.consensus_scores?.[0] || null,
          stances,
        }
      })
    )

    // Run the Producer analysis
    const opportunities = analyzeClaimsForOpportunities(claimsWithStances as any)

    // Group by urgency for easier consumption
    const grouped = {
      immediate: opportunities.filter(o => o.urgency === 'immediate'),
      today: opportunities.filter(o => o.urgency === 'today'),
      this_week: opportunities.filter(o => o.urgency === 'this_week'),
      background: opportunities.filter(o => o.urgency === 'background'),
    }

    // Summary stats
    const summary = {
      total_opportunities: opportunities.length,
      by_type: opportunities.reduce((acc, o) => {
        acc[o.opportunity_type] = (acc[o.opportunity_type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      by_format: opportunities.reduce((acc, o) => {
        acc[o.production_format] = (acc[o.production_format] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      needs_research: opportunities.filter(o => o.research_needed.length > 0).length,
      missing_perspectives: opportunities.filter(o => o.missing_perspectives.length > 0).length,
    }

    return NextResponse.json({
      opportunities: grouped,
      all: opportunities,
      summary,
      analyzed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Producer analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze content' },
      { status: 500 }
    )
  }
}
