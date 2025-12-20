/**
 * Onboarding Status API
 *
 * GET /api/onboarding/status?topic_id=xxx
 *
 * Returns the onboarding status for a topic - which steps are complete
 * and what to do next.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

interface OnboardingStep {
  step: string
  label: string
  complete: boolean
  count?: number
  details?: string
}

export async function GET(request: NextRequest) {
  const topic_id = request.nextUrl.searchParams.get('topic_id')

  if (!topic_id) {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }

  try {
    // Get topic info
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id, name, description, intel_config')
      .eq('id', topic_id)
      .single()

    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Get counts for various items
    const [
      { count: youtubeCount },
      { count: twitterCount },
      { count: monitorRuns },
      { count: researchRuns }
    ] = await Promise.all([
      supabase.from('youtube_channels').select('*', { count: 'exact', head: true }).eq('topic_id', topic_id),
      supabase.from('source_accounts').select('*', { count: 'exact', head: true }).eq('topic_id', topic_id),
      supabase.from('intelligence_runs').select('*', { count: 'exact', head: true }).eq('topic_id', topic_id).eq('run_type', 'monitor').eq('status', 'completed'),
      supabase.from('intelligence_runs').select('*', { count: 'exact', head: true }).eq('topic_id', topic_id).eq('run_type', 'research').eq('status', 'completed')
    ])

    const config = topic.intel_config || {}
    const entitiesCount = config.known_entities?.length || 0
    const patternsCount = config.story_patterns?.length || 0

    // Build steps
    const steps: OnboardingStep[] = [
      {
        step: 'create_topic',
        label: 'Create Topic',
        complete: true,  // If we got here, topic exists
        details: topic.name
      },
      {
        step: 'add_youtube_sources',
        label: 'Add YouTube Channels',
        complete: (youtubeCount || 0) > 0,
        count: youtubeCount || 0,
        details: (youtubeCount || 0) > 0 ? `${youtubeCount} channels added` : 'No channels yet'
      },
      {
        step: 'add_twitter_sources',
        label: 'Add Twitter Sources',
        complete: (twitterCount || 0) > 0,
        count: twitterCount || 0,
        details: (twitterCount || 0) > 0 ? `${twitterCount} accounts added` : 'No accounts yet (optional)'
      },
      {
        step: 'configure_entities',
        label: 'Configure Known Entities',
        complete: entitiesCount > 0,
        count: entitiesCount,
        details: entitiesCount > 0 ? `${entitiesCount} entities configured` : 'No entities yet'
      },
      {
        step: 'configure_patterns',
        label: 'Configure Story Patterns',
        complete: patternsCount > 0,
        count: patternsCount,
        details: patternsCount > 0 ? `${patternsCount} patterns configured` : 'Using defaults'
      },
      {
        step: 'test_monitor',
        label: 'Test Monitor Mode',
        complete: (monitorRuns || 0) > 0,
        count: monitorRuns || 0,
        details: (monitorRuns || 0) > 0 ? `${monitorRuns} successful runs` : 'Not tested yet'
      },
      {
        step: 'test_research',
        label: 'Test Research Mode',
        complete: (researchRuns || 0) > 0,
        count: researchRuns || 0,
        details: (researchRuns || 0) > 0 ? `${researchRuns} successful runs` : 'Not tested yet'
      }
    ]

    // Find next incomplete step
    const nextStep = steps.find(s => !s.complete)
    const completedSteps = steps.filter(s => s.complete).length
    const totalSteps = steps.length
    const ready = completedSteps >= 5  // At minimum: topic, youtube, entities, monitor test

    return NextResponse.json({
      topic_id,
      topic_name: topic.name,
      steps,
      progress: {
        completed: completedSteps,
        total: totalSteps,
        percentage: Math.round((completedSteps / totalSteps) * 100)
      },
      ready,
      next_step: nextStep?.step || null,
      next_step_label: nextStep?.label || 'All steps complete!'
    })
  } catch (error) {
    console.error('Onboarding status error:', error)
    return NextResponse.json({
      error: 'Failed to get onboarding status',
      details: String(error)
    }, { status: 500 })
  }
}
