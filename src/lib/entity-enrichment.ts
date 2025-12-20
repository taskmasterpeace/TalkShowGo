/**
 * Entity Enrichment Library
 *
 * Uses web search + LLM to research entities and add context.
 * Determines what to search for based on entity type and existing context.
 */

import { searchWeb, searchEntity, WebSearchResult } from './web-search'
import { EntityContext, EntityAffiliation, LeagueContext } from '@/types/entity-context'
import { supabase } from './db'

// Patterns that indicate a female-focused league/organization
const FEMALE_LEAGUE_PATTERNS = [
  /qotr/i,
  /queen\s*(of)?\s*(the)?\s*ring/i,
  /women'?s/i,
  /female\s*(battle)?\s*league/i,
  /ladies/i,
  /wnba/i,
  /wpga/i
]

// Roles that suggest the person might be an operator, not participant
const OPERATOR_ROLES = ['owner', 'founder', 'ceo', 'president', 'promoter', 'executive', 'manager']

/**
 * Validate gender inference to prevent Debo-type errors
 * (e.g., male owner of female league being marked as female)
 */
function validateGenderInference(
  entityName: string,
  inferredGender: string,
  role: string | undefined,
  affiliations: EntityAffiliation[] | undefined,
  notes: string | undefined
): {
  gender: string
  needs_review: boolean
  review_reason?: string
  league_context?: LeagueContext
} {
  // Combine all text for pattern matching
  const allText = [
    role || '',
    notes || '',
    ...(affiliations?.map(a => `${a.name} ${a.type}`) || [])
  ].join(' ').toLowerCase()

  // Check if associated with female-focused organization
  const isAssociatedWithFemaleLeague = FEMALE_LEAGUE_PATTERNS.some(p => p.test(allText))

  // Check if role suggests operator (owner/founder) rather than participant
  const isOperatorRole = role && OPERATOR_ROLES.some(r => role.toLowerCase().includes(r))

  // Flag for review if: female league association + operator role + inferred as female
  if (isAssociatedWithFemaleLeague && isOperatorRole && inferredGender === 'female') {
    console.log(`[GenderValidation] Flagging ${entityName} for review: associated with female league but has operator role`)

    // Try to extract league context
    let leagueContext: LeagueContext | undefined
    const femaleLeague = affiliations?.find(a =>
      FEMALE_LEAGUE_PATTERNS.some(p => p.test(a.name))
    )
    if (femaleLeague) {
      leagueContext = {
        league_name: femaleLeague.name,
        league_gender_focus: 'female',
        person_role: role || 'unknown'
      }
    }

    return {
      gender: 'unknown',  // Don't assume - flag for manual review
      needs_review: true,
      review_reason: `${entityName} has ${role} role at ${femaleLeague?.name || 'female-focused organization'} - verify actual gender`,
      league_context: leagueContext
    }
  }

  return {
    gender: inferredGender,
    needs_review: false
  }
}

// Configuration
const LLM_ENDPOINT = process.env.DEEP_RESEARCH_LLM_ENDPOINT || process.env.PRESIDIUM_URL || 'http://localhost:11434'
const LLM_MODEL = process.env.DEEP_RESEARCH_MODEL || 'qwen3:14b'

export interface EnrichmentConfig {
  entity_id: string
  topic_id?: string
  force?: boolean      // Enrich even if already enriched
  niche_keywords?: string[]  // Context keywords for better search
}

export interface EnrichmentResult {
  entity_id: string
  entity_name: string
  entity_type: string
  previous_context: EntityContext
  new_context: EntityContext
  sources_used: string[]
  enrichment_summary: string
  was_enriched: boolean
  reason?: string  // Why not enriched (if applicable)
}

/**
 * Enrich a single entity with web search data
 */
export async function enrichEntity(config: EnrichmentConfig): Promise<EnrichmentResult> {
  const { entity_id, topic_id, force = false, niche_keywords = [] } = config

  // Fetch entity
  const { data: entity, error } = await supabase
    .from('entities')
    .select('id, canonical_name, entity_type, topic_id, metadata')
    .eq('id', entity_id)
    .single()

  if (error || !entity) {
    throw new Error(`Entity not found: ${entity_id}`)
  }

  const existingContext = (entity.metadata as EntityContext) || {}

  // Check if locked
  if (existingContext.enrichment_status === 'locked' && !force) {
    return {
      entity_id,
      entity_name: entity.canonical_name,
      entity_type: entity.entity_type,
      previous_context: existingContext,
      new_context: existingContext,
      sources_used: [],
      enrichment_summary: 'Entity is locked and cannot be enriched',
      was_enriched: false,
      reason: 'locked'
    }
  }

  // Check if already enriched recently
  if (existingContext.enrichment_status === 'enriched' && !force) {
    const lastRun = existingContext.enrichment_last_run
    if (lastRun) {
      const hoursSinceEnrich = (Date.now() - new Date(lastRun).getTime()) / (1000 * 60 * 60)
      if (hoursSinceEnrich < 24) {
        return {
          entity_id,
          entity_name: entity.canonical_name,
          entity_type: entity.entity_type,
          previous_context: existingContext,
          new_context: existingContext,
          sources_used: [],
          enrichment_summary: 'Entity was recently enriched. Use force=true to re-enrich.',
          was_enriched: false,
          reason: 'recently_enriched'
        }
      }
    }
  }

  // Get topic info for niche context
  let nicheContext: string[] = [...niche_keywords]
  if (topic_id || entity.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('name, description')
      .eq('id', topic_id || entity.topic_id)
      .single()

    if (topic) {
      nicheContext.push(topic.name)
      if (topic.description) {
        nicheContext.push(topic.description)
      }
    }
  }

  // Determine search strategy based on entity type and existing context
  const searchQueries = generateSearchQueries(
    entity.canonical_name,
    entity.entity_type,
    existingContext,
    nicheContext
  )

  // Execute searches
  const allResults: WebSearchResult[] = []
  const sourcesUsed: string[] = []

  for (const query of searchQueries) {
    try {
      const results = await searchWeb(query, { max_results: 5 })
      allResults.push(...results)
      sourcesUsed.push(...results.map(r => r.url))
    } catch (error) {
      console.error(`Search failed for "${query}":`, error)
    }
  }

  // Extract enrichment from search results using LLM
  const enrichment = await extractEnrichmentFromResults(
    entity.canonical_name,
    entity.entity_type,
    existingContext,
    allResults,
    nicheContext
  )

  // Merge with existing context
  const newContext: EntityContext = {
    ...existingContext,
    ...enrichment.context,
    enrichment_status: 'enriched',
    enrichment_last_run: new Date().toISOString(),
    enrichment_sources: Array.from(new Set([
      ...(existingContext.enrichment_sources || []),
      ...sourcesUsed
    ])).slice(0, 20), // Keep last 20 sources
    context_updated_at: new Date().toISOString(),
    context_updated_by: 'ai_enrichment'
  }

  // Update entity in database
  await supabase
    .from('entities')
    .update({ metadata: newContext })
    .eq('id', entity_id)

  return {
    entity_id,
    entity_name: entity.canonical_name,
    entity_type: entity.entity_type,
    previous_context: existingContext,
    new_context: newContext,
    sources_used: sourcesUsed,
    enrichment_summary: enrichment.summary,
    was_enriched: true
  }
}

/**
 * Generate search queries based on entity type and context
 */
function generateSearchQueries(
  name: string,
  type: string,
  existingContext: EntityContext,
  nicheKeywords: string[]
): string[] {
  const queries: string[] = []
  const nicheStr = nicheKeywords.length > 0 ? nicheKeywords[0] : ''

  // Base query
  queries.push(`${name} ${nicheStr}`.trim())

  // Type-specific queries
  switch (type) {
    case 'person':
      if (existingContext.role === 'battler' || nicheStr.toLowerCase().includes('battle rap')) {
        queries.push(`${name} battle rapper record`)
        queries.push(`${name} vs battle`)
      } else if (existingContext.role === 'blogger' || existingContext.is_commentator) {
        queries.push(`${name} YouTube channel`)
        queries.push(`${name} podcast host`)
      } else {
        queries.push(`${name} biography`)
        queries.push(`${name} career`)
      }
      break

    case 'organization':
      queries.push(`${name} company about`)
      queries.push(`${name} founded history`)
      break

    case 'event':
      queries.push(`${name} event date location`)
      queries.push(`${name} participants results`)
      break

    case 'place':
      queries.push(`${name} location information`)
      break

    default:
      queries.push(`${name} information`)
  }

  // Add Wikipedia query for all types
  queries.push(`${name} wikipedia`)

  return queries.slice(0, 5) // Limit to 5 queries
}

/**
 * Extract enrichment context from search results using LLM
 */
async function extractEnrichmentFromResults(
  entityName: string,
  entityType: string,
  existingContext: EntityContext,
  results: WebSearchResult[],
  nicheKeywords: string[]
): Promise<{ context: Partial<EntityContext>; summary: string }> {
  if (results.length === 0) {
    return {
      context: {},
      summary: 'No search results found for enrichment'
    }
  }

  // Prepare search result text
  const resultsText = results
    .slice(0, 10)
    .map(r => `Title: ${r.title}\nSnippet: ${r.content}\nURL: ${r.url}`)
    .join('\n\n---\n\n')

  const prompt = `You are researching information about "${entityName}" (type: ${entityType}).

Niche/Context: ${nicheKeywords.join(', ') || 'General'}

Existing information we have:
${JSON.stringify(existingContext, null, 2)}

Search results:
${resultsText}

Based on these search results, extract any NEW information about this entity. Focus on:
- Role/occupation (what do they do?)
- Gender (male/female - ONLY if explicitly mentioned or clearly evident)
- Affiliations (organizations, teams, leagues they're part of)
- Platforms (YouTube, Twitter, etc.)
- Whether they are a primary source or commentator
- Any notable facts or background

IMPORTANT for gender:
- Only include gender if it's explicitly stated or clearly evident from pronouns/context
- If the person RUNS or OWNS a gender-specific organization (like a women's league), that does NOT mean they are that gender
- When uncertain, omit the gender field entirely

Respond in JSON format:
{
  "role": "their primary role/occupation if found",
  "sub_roles": ["other roles they have"],
  "gender": "male or female ONLY if certain",
  "affiliations": [{"name": "org name", "type": "type", "status": "current/former"}],
  "platforms": {"youtube_channel_id": "...", "twitter_handle": "..."},
  "is_primary_source": true/false,
  "is_commentator": true/false,
  "notes": "Any other notable information",
  "summary": "One sentence summary of what was learned"
}

Only include fields where you found actual information. Do not make up data.`

  try {
    const response = await callLLM(prompt)
    const parsed = JSON.parse(response)

    // Build context object from parsed response
    const context: Partial<EntityContext> = {}

    if (parsed.role && !existingContext.role) {
      context.role = parsed.role
    }
    if (parsed.sub_roles && parsed.sub_roles.length > 0) {
      context.sub_roles = parsed.sub_roles
    }
    if (parsed.affiliations && parsed.affiliations.length > 0) {
      context.affiliations = parsed.affiliations as EntityAffiliation[]
    }
    if (parsed.platforms) {
      context.platforms = {
        ...existingContext.platforms,
        ...parsed.platforms
      }
    }
    if (parsed.is_primary_source !== undefined && existingContext.is_primary_source === undefined) {
      context.is_primary_source = parsed.is_primary_source
    }
    if (parsed.is_commentator !== undefined && existingContext.is_commentator === undefined) {
      context.is_commentator = parsed.is_commentator
    }
    if (parsed.notes && !existingContext.notes) {
      context.notes = parsed.notes
    }

    // GENDER VALIDATION - prevent Debo-type errors
    if (parsed.gender && !existingContext.gender) {
      const genderValidation = validateGenderInference(
        entityName,
        parsed.gender,
        parsed.role || existingContext.role,
        parsed.affiliations || existingContext.affiliations,
        parsed.notes || existingContext.notes
      )

      context.gender = genderValidation.gender as 'male' | 'female' | 'other' | 'unknown'

      if (genderValidation.needs_review) {
        context.gender_needs_review = true
        context.gender_review_reason = genderValidation.review_reason
        if (genderValidation.league_context) {
          context.league_context = genderValidation.league_context
        }
        console.log(`[Enrichment] Gender flagged for review: ${genderValidation.review_reason}`)
      }
    }

    return {
      context,
      summary: parsed.summary || 'Enrichment completed'
    }
  } catch (error) {
    console.error('LLM enrichment extraction failed:', error)
    return {
      context: {},
      summary: 'Failed to extract enrichment from search results'
    }
  }
}

/**
 * Lock an entity to prevent further enrichment
 */
export async function lockEntity(
  entityId: string,
  lockedBy: string = 'producer'
): Promise<void> {
  const { data: entity, error } = await supabase
    .from('entities')
    .select('metadata')
    .eq('id', entityId)
    .single()

  if (error || !entity) {
    throw new Error(`Entity not found: ${entityId}`)
  }

  const context = (entity.metadata as EntityContext) || {}
  const updatedContext: EntityContext = {
    ...context,
    enrichment_status: 'locked',
    enrichment_locked_by: lockedBy,
    enrichment_locked_at: new Date().toISOString(),
    context_updated_at: new Date().toISOString(),
    context_updated_by: 'producer_manual'
  }

  await supabase
    .from('entities')
    .update({ metadata: updatedContext })
    .eq('id', entityId)
}

/**
 * Unlock an entity to allow enrichment
 */
export async function unlockEntity(entityId: string): Promise<void> {
  const { data: entity, error } = await supabase
    .from('entities')
    .select('metadata')
    .eq('id', entityId)
    .single()

  if (error || !entity) {
    throw new Error(`Entity not found: ${entityId}`)
  }

  const context = (entity.metadata as EntityContext) || {}
  const updatedContext: EntityContext = {
    ...context,
    enrichment_status: 'enriched',
    enrichment_locked_by: undefined,
    enrichment_locked_at: undefined,
    context_updated_at: new Date().toISOString(),
    context_updated_by: 'producer_manual'
  }

  await supabase
    .from('entities')
    .update({ metadata: updatedContext })
    .eq('id', entityId)
}

/**
 * Batch enrich multiple entities
 */
export async function batchEnrichEntities(
  entityIds: string[],
  config: Omit<EnrichmentConfig, 'entity_id'>
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = []

  for (const entityId of entityIds) {
    try {
      const result = await enrichEntity({
        ...config,
        entity_id: entityId
      })
      results.push(result)
    } catch (error) {
      console.error(`Failed to enrich entity ${entityId}:`, error)
      results.push({
        entity_id: entityId,
        entity_name: 'Unknown',
        entity_type: 'unknown',
        previous_context: {},
        new_context: {},
        sources_used: [],
        enrichment_summary: `Error: ${String(error)}`,
        was_enriched: false,
        reason: 'error'
      })
    }
  }

  return results
}

/**
 * Get entities that need enrichment for a topic
 */
export async function getEntitiesNeedingEnrichment(
  topicId: string,
  limit: number = 10
): Promise<Array<{ id: string; name: string; type: string; mention_count: number }>> {
  // Get entities that are not locked and either pending or never enriched
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, canonical_name, entity_type, mention_count, metadata')
    .eq('topic_id', topicId)
    .order('mention_count', { ascending: false })
    .limit(limit * 2) // Get more to filter

  if (error || !entities) {
    return []
  }

  return entities
    .filter(e => {
      const ctx = (e.metadata as EntityContext) || {}
      return ctx.enrichment_status !== 'locked' && ctx.enrichment_status !== 'enriched'
    })
    .slice(0, limit)
    .map(e => ({
      id: e.id,
      name: e.canonical_name,
      type: e.entity_type,
      mention_count: e.mention_count
    }))
}

/**
 * Call local LLM (Presidium/Ollama)
 */
async function callLLM(prompt: string): Promise<string> {
  const response = await fetch(`${LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant. Respond in the exact JSON format requested. Be concise and factual. Only include information you found in the search results.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 2048
    })
  })

  if (!response.ok) {
    throw new Error(`LLM error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  // Try to extract JSON from the response if wrapped in markdown
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    return jsonMatch[1].trim()
  }

  return content.trim()
}
