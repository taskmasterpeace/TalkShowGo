/**
 * AUDIT SCORE
 *
 * Calculates credibility scores and consensus for claims.
 * Uses engagement-weighted analysis.
 */

import { supabase } from '@/lib/db'

interface AuditScoreData {
  job_run_id: string
  topic_id: string
}

export async function auditScore(data: AuditScoreData) {
  const { job_run_id, topic_id } = data
  let itemsProcessed = 0
  const errors: any[] = []

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get all claims for topic
    const { data: claims, error: claimsError } = await supabase
      .from('claims')
      .select('*, claim_mentions(*)')
      .eq('topic_id', topic_id)

    if (claimsError) throw claimsError

    for (const claim of claims || []) {
      try {
        // Get all tweets that mention this claim
        const mentionTweetIds = claim.claim_mentions?.map((m: any) => m.tweet_id) || []

        if (mentionTweetIds.length === 0) continue

        const { data: tweets } = await supabase
          .from('tweets_raw')
          .select('*, source_accounts(credibility_score)')
          .in('id', mentionTweetIds)

        // Calculate engagement-weighted consensus
        let supportWeight = 0
        let denyWeight = 0
        let totalEngagement = 0
        let sourceCount = new Set()

        for (const tweet of tweets || []) {
          const engagement =
            (tweet.metrics_likes || 0) +
            (tweet.metrics_retweets || 0) * 2 +
            (tweet.metrics_replies || 0) * 1.5

          const credibility = tweet.source_accounts?.credibility_score || 0.5
          const mention = claim.claim_mentions?.find((m: any) => m.tweet_id === tweet.id)
          const stance = mention?.stance || 'neutral'

          const weight = engagement * credibility

          if (stance === 'supports') supportWeight += weight
          else if (stance === 'denies') denyWeight += weight

          totalEngagement += engagement
          sourceCount.add(tweet.author_handle)
        }

        const totalWeight = supportWeight + denyWeight || 1
        const consensus = (supportWeight - denyWeight) / totalWeight // -1 to 1
        const contention = Math.min(supportWeight, denyWeight) / totalWeight // 0 to 0.5, normalized to 0-1
        const confidence = Math.min(sourceCount.size / 5, 1) * (totalEngagement / 10000)

        // Determine verdict
        let verdict = 'uncertain'
        if (consensus > 0.7 && contention < 0.3 && confidence > 0.6) verdict = 'confirmed'
        else if (consensus > 0.5 && confidence > 0.4) verdict = 'likely'
        else if (contention > 0.6) verdict = 'disputed'
        else if (consensus < -0.5 && confidence > 0.5) verdict = 'debunked'

        // Update or insert consensus score
        await supabase
          .from('consensus_scores')
          .upsert({
            claim_id: claim.id,
            consensus,
            contention: contention * 2, // normalize to 0-1
            confidence: Math.min(confidence, 1),
            source_count: sourceCount.size,
            engagement_total: Math.round(totalEngagement),
            computed_at: new Date().toISOString(),
          })

        // Update or insert verdict
        await supabase
          .from('claim_verdicts')
          .upsert({
            claim_id: claim.id,
            verdict,
            computed_at: new Date().toISOString(),
          })

        itemsProcessed++
      } catch (err) {
        errors.push({
          claim_id: claim.id,
          error: String(err),
        })
      }
    }

    // Update source credibility scores based on claim verification
    await updateSourceCredibility(topic_id)

    await supabase
      .from('job_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        items_processed: itemsProcessed,
        errors,
      })
      .eq('id', job_run_id)

    return { itemsProcessed, errors }
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

async function updateSourceCredibility(topicId: string) {
  // Get all sources with their claim verification record
  const { data: sources } = await supabase
    .from('source_accounts')
    .select('id')
    .eq('topic_id', topicId)

  for (const source of sources || []) {
    // Calculate new credibility based on claim accuracy
    // This would aggregate the verified vs disputed claims from this source
    // For now, placeholder logic
  }
}
