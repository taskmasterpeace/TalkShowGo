/**
 * EXTRACTION RUN
 *
 * Processes raw tweets/videos to extract entities and claims.
 * Uses Presidium AI (local Ollama models) for intelligent extraction.
 *
 * NO CLOUD DEPENDENCIES - runs entirely on local infrastructure.
 */

import { supabase } from '@/lib/db'
import { chatJSON, PRESIDIUM_CONFIG } from '@/lib/presidium-ai'

interface ExtractionRunData {
  job_run_id: string
  topic_id: string
}

interface ExtractedEntity {
  name: string
  type: 'person' | 'organization' | 'place' | 'event' | 'product' | 'league' | 'battle'
  description?: string
  mentions?: number
  aliases?: string[]
}

interface ExtractedClaim {
  text: string
  type: 'factual' | 'opinion' | 'prediction' | 'rumor' | 'announcement'
  sentiment?: 'positive' | 'negative' | 'neutral'
  confidence?: number
}

export async function extractionRun(data: ExtractionRunData) {
  const { job_run_id, topic_id } = data
  let itemsProcessed = 0
  let entitiesExtracted = 0
  let claimsExtracted = 0
  const errors: any[] = []
  const startTime = Date.now()

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get unprocessed tweets
    const { data: tweets, error: tweetsError } = await supabase
      .from('tweets_raw')
      .select('*')
      .eq('topic_id', topic_id)
      .eq('processed', false)
      .order('tweet_created_at', { ascending: false })
      .limit(100)

    if (tweetsError) throw tweetsError

    console.log(`[EXTRACTION] Processing ${tweets?.length || 0} unprocessed tweets`)

    // Batch tweets for efficient LLM processing
    const batchSize = 5 // Smaller batches for better accuracy
    for (let i = 0; i < (tweets || []).length; i += batchSize) {
      const batch = tweets?.slice(i, i + batchSize) || []

      try {
        console.log(`[EXTRACTION] Processing batch ${Math.floor(i / batchSize) + 1}...`)

        // Extract entities and claims using local Presidium AI
        const extraction = await extractFromBatch(batch)

        // Store entities
        for (const entity of extraction.entities) {
          // Check if entity exists (case-insensitive)
          const { data: existing } = await supabase
            .from('entities')
            .select('id, mention_count')
            .eq('topic_id', topic_id)
            .ilike('canonical_name', entity.name)
            .single()

          if (existing) {
            // Update mention count
            await supabase
              .from('entities')
              .update({
                mention_count: (existing.mention_count || 0) + (entity.mentions || 1),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          } else {
            // Create new entity
            const { error: insertError } = await supabase.from('entities').insert({
              topic_id,
              canonical_name: entity.name,
              entity_type: entity.type,
              description: entity.description,
              aliases: entity.aliases || [],
              mention_count: entity.mentions || 1,
            })
            if (!insertError) entitiesExtracted++
          }
        }

        // Store claims
        for (const claim of extraction.claims) {
          const { error: claimError } = await supabase.from('claims').insert({
            topic_id,
            claim_text: claim.text,
            claim_type: claim.type,
            sentiment: claim.sentiment,
            confidence_score: claim.confidence || 0.7,
          })
          if (!claimError) claimsExtracted++
        }

        // Mark tweets as processed
        const tweetIds = batch.map((t) => t.id)
        await supabase
          .from('tweets_raw')
          .update({ processed: true })
          .in('id', tweetIds)

        itemsProcessed += batch.length
        console.log(`[EXTRACTION] Batch done: ${extraction.entities.length} entities, ${extraction.claims.length} claims`)
      } catch (err) {
        console.error(`[EXTRACTION] Batch error:`, err)
        errors.push({
          batch_start: i,
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
          entities_extracted: entitiesExtracted,
          claims_extracted: claimsExtracted,
          model_used: PRESIDIUM_CONFIG.ollama.models.default,
        },
      })
      .eq('id', job_run_id)

    console.log(`[EXTRACTION] Complete: ${itemsProcessed} tweets, ${entitiesExtracted} entities, ${claimsExtracted} claims`)
    return { itemsProcessed, entitiesExtracted, claimsExtracted, errors }
  } catch (error) {
    console.error(`[EXTRACTION] Fatal error:`, error)
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

/**
 * Extract entities and claims from a batch of tweets using Presidium AI
 */
async function extractFromBatch(tweets: any[]): Promise<{
  entities: ExtractedEntity[]
  claims: ExtractedClaim[]
}> {
  const tweetTexts = tweets
    .map((t, i) => `[${i + 1}] @${t.author_handle}: ${t.text}`)
    .join('\n\n')

  const systemPrompt = `You are an entity and claim extraction system for battle rap content.

EXTRACT FROM THE TWEETS:

1. ENTITIES - People, organizations, events, battles mentioned:
   - Battlers (rappers who battle)
   - Leagues (URL, KOTD, RBE, etc.)
   - Events/battles (Summer Madness, Nome, etc.)
   - Media/podcasts (LTBR, 15MOFE, etc.)
   - Venues

2. CLAIMS - Key statements being made:
   - Announcements (battles, events)
   - Opinions (who won, predictions)
   - Rumors/speculation
   - Factual statements

Return ONLY valid JSON in this exact format:
{
  "entities": [
    {"name": "Entity Name", "type": "person|organization|event|league|battle", "description": "brief description"}
  ],
  "claims": [
    {"text": "Normalized claim statement", "type": "factual|opinion|prediction|rumor|announcement", "sentiment": "positive|negative|neutral"}
  ]
}

Be specific with battle rap terminology. Extract ALL mentioned entities and notable claims.`

  try {
    const result = await chatJSON<{
      entities: ExtractedEntity[]
      claims: ExtractedClaim[]
    }>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract entities and claims from these battle rap tweets:\n\n${tweetTexts}` },
      ],
      {
        model: PRESIDIUM_CONFIG.ollama.models.default, // deepseek-coder-v2:16b
        temperature: 0.3, // Lower for more consistent extraction
      }
    )

    return {
      entities: result.entities || [],
      claims: result.claims || [],
    }
  } catch (error) {
    console.error('[EXTRACTION] LLM extraction failed:', error)
    return { entities: [], claims: [] }
  }
}
