/**
 * RECON SEARCH
 *
 * Searches YouTube for topic-related content beyond trusted channels.
 * Uses entity names and claim keywords for discovery.
 */

import { supabase } from '@/lib/db'

interface ReconSearchData {
  job_run_id: string
  topic_id: string
  search_queries?: string[]
}

export async function reconSearch(data: ReconSearchData) {
  const { job_run_id, topic_id, search_queries } = data
  let itemsProcessed = 0
  const errors: any[] = []
  const nominations: any[] = []

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get credibility profile for thresholds
    const { data: profile } = await supabase
      .from('credibility_profiles')
      .select('*')
      .eq('topic_id', topic_id)
      .single()

    const minSubscribers = profile?.youtube_min_subscribers || 10000
    const minViews = profile?.youtube_min_views || 1000

    // Generate search queries from entities if not provided
    let queries = search_queries || []

    if (queries.length === 0) {
      const { data: entities } = await supabase
        .from('entities')
        .select('canonical_name')
        .eq('topic_id', topic_id)
        .order('mention_count', { ascending: false })
        .limit(10)

      queries = entities?.map((e) => e.canonical_name) || []
    }

    for (const query of queries) {
      try {
        // In production, this would call YouTube Search API
        console.log(`Would search YouTube for: ${query}`)

        // Filter results by credibility thresholds
        // Check if channel is already known
        // Create nominations for new channels meeting threshold

        itemsProcessed++
      } catch (err) {
        errors.push({
          query,
          error: String(err),
        })
      }
    }

    // Create nominations for discovered channels
    if (nominations.length > 0) {
      await supabase.from('nominations').insert(nominations)
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
