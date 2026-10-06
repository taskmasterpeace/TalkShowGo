/**
 * Topic Proposal API
 *
 * GET /api/stories/daily-show/propose
 * Scans sources and proposes 3-5 trending topics for the daily show
 *
 * Query Parameters:
 *   - topic_id (required): The topic/niche UUID
 *   - hours_back: How many hours to look back (default: 24)
 *   - target_date: Specific date in YYYY-MM-DD format (overrides hours_back)
 *   - start_date: Start of date range (ISO string or YYYY-MM-DD)
 *   - end_date: End of date range (ISO string or YYYY-MM-DD)
 *   - max_topics: Maximum topics to return (default: 5)
 *   - include_twitter: Include Twitter digest (default: true)
 *   - include_decision_log: Include decision log for auditing (default: true)
 */

import { NextRequest, NextResponse } from 'next/server'
import { proposeTopicsForShow, TopicProposerOptions } from '@/lib/topic-proposer'
import { buildTwitterDigest, TwitterDigestOptions } from '@/lib/twitter-digest'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const hoursBack = parseInt(searchParams.get('hours_back') || '24', 10)
    const maxTopics = parseInt(searchParams.get('max_topics') || '5', 10)
    const includeTwitter = searchParams.get('include_twitter') !== 'false'
    const includeDecisionLog = searchParams.get('include_decision_log') !== 'false'

    // Date parameters - these override hours_back
    const targetDate = searchParams.get('target_date')  // YYYY-MM-DD
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    if (!topicId) {
      return NextResponse.json(
        { error: 'topic_id is required' },
        { status: 400 }
      )
    }

    // Build options for date range
    let dateOptions: TopicProposerOptions = {
      hoursBack,
      includeDecisionLog
    }
    let dateDescription = `${hoursBack}h back`

    if (targetDate) {
      // Convenience: target_date gives full 24 hours of that day
      dateOptions = { targetDate, includeDecisionLog }
      dateDescription = targetDate
    } else if (startDateParam && endDateParam) {
      // Explicit date range
      dateOptions = {
        startDate: new Date(startDateParam),
        endDate: new Date(endDateParam),
        includeDecisionLog
      }
      dateDescription = `${startDateParam} to ${endDateParam}`
    }

    console.log(`[ProposeAPI] Proposing topics for ${topicId} (${dateDescription}, max ${maxTopics})`)

    // Propose topics from sources
    const proposalResult = await proposeTopicsForShow(topicId, dateOptions, maxTopics)
    const { topics: proposedTopics, decisionLog } = proposalResult

    // Save decision log to database if present
    if (decisionLog) {
      const stats = {
        topics_proposed: decisionLog.topics_proposed,
        videos_found: decisionLog.searches.youtube.videos_found,
        tweets_found: decisionLog.searches.twitter.tweets_found,
        transcripts_fetched: decisionLog.analysis.transcripts_fetched.length,
        clusters_created: decisionLog.topics_selected.length + decisionLog.topics_rejected.length,
        clusters_rejected: decisionLog.topics_rejected.length,
        processing_time_ms: decisionLog.processing_time_ms
      }

      const { data: savedData, error: saveError } = await supabase
        .from('proposal_decision_logs')
        .insert({
          topic_id: topicId,
          decision_log: decisionLog,
          ...stats
        })
        .select()

      if (saveError) {
        console.error('[ProposeAPI] Failed to save decision log:', JSON.stringify(saveError, null, 2))
        console.error('[ProposeAPI] Error details - code:', saveError.code, 'message:', saveError.message, 'hint:', saveError.hint)
      } else {
        console.log('[ProposeAPI] Decision log saved to database, id:', savedData?.[0]?.id)
      }
    }

    // Optionally include Twitter digest (use same date options)
    let twitterDigest = null
    if (includeTwitter) {
      const twitterOptions: TwitterDigestOptions = targetDate
        ? { targetDate }
        : startDateParam && endDateParam
          ? { startDate: new Date(startDateParam), endDate: new Date(endDateParam) }
          : { hoursBack }
      twitterDigest = await buildTwitterDigest(topicId, twitterOptions)
    }

    return NextResponse.json({
      success: true,
      topic_id: topicId,
      date_range: {
        target_date: targetDate || null,
        start_date: dateOptions.startDate?.toISOString() || null,
        end_date: dateOptions.endDate?.toISOString() || null,
        hours_back: !targetDate && !startDateParam ? hoursBack : null
      },
      proposed_at: new Date().toISOString(),
      topics: proposedTopics,
      topic_count: proposedTopics.length,
      twitter_digest: twitterDigest ? {
        trending: twitterDigest.trending_topics,
        sentiment: twitterDigest.sentiment,
        top_tweets: twitterDigest.top_tweets.slice(0, 3),
        formatted_script: twitterDigest.formatted_script
      } : null,
      decision_log: decisionLog || null,
      message: proposedTopics.length > 0
        ? `Found ${proposedTopics.length} topics to discuss`
        : 'No trending topics found. Try a different date or check your sources.'
    })
  } catch (error) {
    console.error('[ProposeAPI] Error:', error)
    return NextResponse.json(
      { error: 'Failed to propose topics', details: String(error) },
      { status: 500 }
    )
  }
}
