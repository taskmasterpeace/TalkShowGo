/**
 * TRIBUNAL DISCOVER
 *
 * Discovers new sources from high-engagement commenters,
 * frequently mentioned accounts, and cross-references.
 */

import { supabase } from '@/lib/db'

interface TribunalDiscoverData {
  job_run_id: string
  topic_id: string
}

export async function tribunalDiscover(data: TribunalDiscoverData) {
  const { job_run_id, topic_id } = data
  let itemsProcessed = 0
  const errors: any[] = []
  const nominations: any[] = []

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get credibility thresholds
    const { data: profile } = await supabase
      .from('credibility_profiles')
      .select('*')
      .eq('topic_id', topic_id)
      .single()

    const minFollowers = profile?.twitter_min_followers || 1000

    // Get all existing source handles to avoid duplicates
    const { data: existingSources } = await supabase
      .from('source_accounts')
      .select('handle')
      .eq('topic_id', topic_id)
      .eq('platform', 'twitter')

    const existingHandles = new Set(existingSources?.map((s) => s.handle.toLowerCase()) || [])

    // Get all existing nominations
    const { data: existingNominations } = await supabase
      .from('nominations')
      .select('identifier')
      .eq('topic_id', topic_id)

    const nominatedHandles = new Set(existingNominations?.map((n) => n.identifier.toLowerCase()) || [])

    // Find high-engagement commenters
    // In production, this would analyze reply threads
    const { data: tweets } = await supabase
      .from('tweets_raw')
      .select('author_handle, metrics_likes, metrics_replies')
      .eq('topic_id', topic_id)
      .eq('tweet_type', 'reply')

    // Aggregate engagement by author
    const authorEngagement: Record<string, { total: number; count: number }> = {}

    for (const tweet of tweets || []) {
      const handle = tweet.author_handle.toLowerCase()

      if (existingHandles.has(handle) || nominatedHandles.has(handle)) continue

      if (!authorEngagement[handle]) {
        authorEngagement[handle] = { total: 0, count: 0 }
      }

      authorEngagement[handle].total += (tweet.metrics_likes || 0) + (tweet.metrics_replies || 0)
      authorEngagement[handle].count++
    }

    // Create nominations for high-engagement commenters
    for (const [handle, stats] of Object.entries(authorEngagement)) {
      if (stats.count >= 3 && stats.total >= 100) {
        // Calculate preliminary score
        const avgEngagement = stats.total / stats.count
        const preliminaryScore = Math.min(avgEngagement / 500, 1) * 0.5 + 0.3 // 0.3 to 0.8

        nominations.push({
          topic_id,
          platform: 'twitter',
          identifier: `@${handle}`,
          discovered_via: 'High engagement commenter',
          discovery_context: `${stats.count} replies with ${stats.total} total engagement`,
          preliminary_score: preliminaryScore,
          status: 'pending',
        })

        itemsProcessed++
      }
    }

    // Insert nominations
    if (nominations.length > 0) {
      const { error: insertError } = await supabase
        .from('nominations')
        .insert(nominations)

      if (insertError) throw insertError
    }

    await supabase
      .from('job_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        items_processed: itemsProcessed,
        errors,
        metadata: { nominations_created: nominations.length },
      })
      .eq('id', job_run_id)

    return { itemsProcessed, errors, nominations: nominations.length }
  } catch (error) {
    await supabase
      .from('job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [{ error: String(error) }],
      })
      .eq('id', job_run_id)

    throw error
  }
}
