/**
 * NEXUS BUCKET
 *
 * Assembles story candidates from claims and entities.
 * Categorizes into buckets: breaking, developing, recurring, feature, background.
 *
 * Uses Presidium AI (local Ollama - qwen3:30b for better reasoning)
 */

import { supabase } from '@/lib/db'
import { chatJSON, PRESIDIUM_CONFIG } from '@/lib/presidium-ai'

interface NexusBucketData {
  job_run_id: string
  topic_id: string
}

export async function nexusBucket(data: NexusBucketData) {
  const { job_run_id, topic_id } = data
  let itemsProcessed = 0
  let storiesCreated = 0
  const errors: any[] = []
  const startTime = Date.now()

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get recent claims with verdicts and consensus
    const { data: claims } = await supabase
      .from('claims')
      .select('*, consensus_scores(*), claim_verdicts(*)')
      .eq('topic_id', topic_id)
      .eq('status', 'active')

    // Get entities for context
    const { data: entities } = await supabase
      .from('entities')
      .select('*')
      .eq('topic_id', topic_id)
      .order('mention_count', { ascending: false })
      .limit(50)

    console.log(`[NEXUS] Processing ${claims?.length || 0} claims, ${entities?.length || 0} entities`)

    // Group claims by related entities/themes
    const claimGroups = groupClaimsByTheme(claims || [], entities || [])

    for (const group of claimGroups) {
      try {
        // Determine bucket type
        const bucket = determineBucket(group)

        // Generate headline and summary using local LLM
        const { headline, summary } = await generateStoryContent(group, entities || [])

        // Calculate confidence and engagement
        const confidence = group.claims.reduce(
          (acc: number, c: any) => acc + (c.consensus_scores?.confidence || 0.5),
          0
        ) / group.claims.length

        const engagement = group.claims.reduce(
          (acc: number, c: any) => acc + (c.consensus_scores?.engagement_total || 0),
          0
        )

        // Create story candidate
        const { error: insertError } = await supabase.from('story_candidates').insert({
          topic_id,
          bucket,
          headline,
          summary,
          primary_entities: group.entities.map((e: any) => e.id),
          primary_claims: group.claims.map((c: any) => c.id),
          evidence_package: {
            claims: group.claims.map((c: any) => ({
              id: c.id,
              text: c.claim_text,
              verdict: c.claim_verdicts?.verdict,
            })),
          },
          confidence_score: confidence,
          engagement_total: engagement,
          status: 'candidate',
        })

        if (!insertError) storiesCreated++
        itemsProcessed++
        console.log(`[NEXUS] Created story: "${headline}" (${bucket})`)
      } catch (err) {
        console.error(`[NEXUS] Error processing group:`, err)
        errors.push({
          group_id: group.id,
          error: String(err),
        })
      }
    }

    await supabase
      .from('job_runs')
      .update({
        status: errors.length > 0 && itemsProcessed === 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        items_processed: itemsProcessed,
        errors,
        metadata: {
          stories_created: storiesCreated,
          model_used: PRESIDIUM_CONFIG.ollama.models.reasoning,
        },
      })
      .eq('id', job_run_id)

    console.log(`[NEXUS] Complete: ${storiesCreated} stories created`)
    return { itemsProcessed, storiesCreated, errors }
  } catch (error) {
    console.error(`[NEXUS] Fatal error:`, error)
    await supabase
      .from('job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        errors: [{ error: String(error) }],
      })
      .eq('id', job_run_id)

    throw error
  }
}

function groupClaimsByTheme(claims: any[], entities: any[]) {
  const groups: any[] = []
  const usedClaims = new Set()

  for (const claim of claims) {
    if (usedClaims.has(claim.id)) continue

    const group: { id: string; claims: any[]; entities: any[] } = {
      id: claim.id,
      claims: [claim],
      entities: [],
    }

    // Find related claims (share keywords, similar timing)
    for (const other of claims) {
      if (other.id === claim.id || usedClaims.has(other.id)) continue

      const similarity = calculateSimilarity(claim.claim_text, other.claim_text)
      if (similarity > 0.5) {
        group.claims.push(other)
        usedClaims.add(other.id)
      }
    }

    // Find related entities
    const claimText = group.claims.map((c: any) => c.claim_text).join(' ')
    group.entities = entities.filter((e) =>
      claimText.toLowerCase().includes(e.canonical_name.toLowerCase())
    )

    usedClaims.add(claim.id)
    groups.push(group)
  }

  return groups
}

function calculateSimilarity(text1: string, text2: string) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/))
  const words2 = new Set(text2.toLowerCase().split(/\s+/))
  const intersection = Array.from(words1).filter((w) => words2.has(w))
  return intersection.length / Math.max(words1.size, words2.size)
}

function determineBucket(group: any) {
  const avgConfidence =
    group.claims.reduce((acc: number, c: any) => acc + (c.consensus_scores?.confidence || 0.5), 0) /
    group.claims.length

  const maxEngagement = Math.max(
    ...group.claims.map((c: any) => c.consensus_scores?.engagement_total || 0),
    0
  )

  const hasDisputed = group.claims.some(
    (c: any) => c.claim_verdicts?.verdict === 'disputed'
  )

  const mostRecent = group.claims.reduce((latest: Date, c: any) => {
    const date = new Date(c.first_seen || c.created_at)
    return date > latest ? date : latest
  }, new Date(0))

  const hoursSinceRecent = (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60)

  if (hoursSinceRecent < 24 && maxEngagement > 10000) return 'breaking'
  if (hoursSinceRecent < 72 && maxEngagement > 5000) return 'developing'
  if (hasDisputed) return 'feature'
  if (group.entities.length > 3) return 'feature'
  return 'background'
}

/**
 * Generate story headline and summary using Presidium AI
 */
async function generateStoryContent(group: any, entities: any[]) {
  const claimsText = group.claims.map((c: any) => `- ${c.claim_text}`).join('\n')
  const entitiesText = group.entities.map((e: any) => e.canonical_name).join(', ')

  const systemPrompt = `You are a battle rap news editor. Generate a compelling headline and brief summary for a story.

The headline should be attention-grabbing but accurate.
The summary should be 2-3 sentences explaining the key points.

Return ONLY valid JSON in this exact format:
{"headline": "Your headline here", "summary": "Your 2-3 sentence summary here"}`

  try {
    const result = await chatJSON<{ headline: string; summary: string }>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write a headline and summary for this story.\n\nClaims:\n${claimsText}\n\nKey entities: ${entitiesText || 'None identified'}` },
      ],
      {
        model: PRESIDIUM_CONFIG.ollama.models.reasoning, // qwen3:30b for better reasoning
        temperature: 0.7,
      }
    )

    return {
      headline: result.headline || 'Breaking News',
      summary: result.summary || claimsText.slice(0, 200),
    }
  } catch (error) {
    console.error('[NEXUS] LLM generation failed:', error)
    // Fallback: use first claim as headline
    const firstClaim = group.claims[0]?.claim_text || 'Breaking News'
    return {
      headline: firstClaim.slice(0, 100),
      summary: claimsText.slice(0, 300),
    }
  }
}
