/**
 * Entity Context Resolver
 *
 * Resolves entity context for prompt injection to prevent LLM hallucinations.
 * When generating stories, this module:
 * 1. Extracts entity names from research data
 * 2. Looks up context from database (or web search fallback)
 * 3. Formats a glossary for injection into the story prompt
 *
 * This prevents errors like saying "Caps was connected to QOTR" when it was
 * actually Debo who owns QOTR.
 */

import { supabase } from './db'
import { EntityContext, EntityAffiliation, LeagueContext } from '@/types/entity-context'

// ============================================
// TYPES
// ============================================

export interface ResolvedEntity {
  name: string
  id?: string
  type: string  // 'person', 'organization', 'media', 'event'
  context: EntityContext
  aliases?: string[]
  source: 'database' | 'web_search' | 'cache' | 'fallback'
}

export interface EntityContextForPrompt {
  entity_glossary: string  // Formatted text for prompt injection
  entities: ResolvedEntity[]
  unknown_entities: string[]  // Entities we couldn't resolve
  stats: {
    total_requested: number
    resolved_from_db: number
    resolved_from_cache: number
    resolved_from_web: number
    unresolved: number
  }
}

// Research data structure (from research-workflow.ts)
interface ResearchSource {
  video_id: string
  title: string
  channel: string
  transcript?: string
}

interface ResearchQueryPlan {
  entities?: Array<{ name: string; type?: string }>
}

export interface ResearchResultForEntityExtraction {
  query: string
  query_plan?: ResearchQueryPlan
  sources: ResearchSource[]
}

// ============================================
// ENTITY EXTRACTION
// ============================================

/**
 * Extract entity names from research data
 * Sources:
 * 1. Query plan entities (from LLM interpretation)
 * 2. Frequently mentioned names in transcripts
 * 3. Names in video titles
 */
export async function extractEntityNames(
  research: {
    query: string
    query_plan?: { entities?: Array<{ name: string; type?: string }> }
    sources: Array<{ title: string; channel?: string; transcript?: string }>
  },
  topicId: string
): Promise<string[]> {
  const entityNames = new Set<string>()

  // 1. Get entities from query plan (most reliable)
  if (research.query_plan?.entities) {
    for (const entity of research.query_plan.entities) {
      if (entity.name && entity.name.length > 1) {
        entityNames.add(normalizeEntityName(entity.name))
      }
    }
  }

  // 2. Get known entities from database that might be mentioned
  const { data: knownEntities } = await supabase
    .from('entities')
    .select('canonical_name')
    .eq('topic_id', topicId)
    .limit(500)

  if (knownEntities) {
    const knownNames = new Set(knownEntities.map(e => e.canonical_name.toLowerCase()))

    // Search for known entities in transcripts
    for (const source of research.sources) {
      if (source.transcript) {
        for (const entity of knownEntities) {
          // Case-insensitive search
          if (source.transcript.toLowerCase().includes(entity.canonical_name.toLowerCase())) {
            entityNames.add(entity.canonical_name)
          }
        }
      }
    }
  }

  // 3. Extract from query itself
  const queryWords = research.query.split(/\s+/)
  for (const word of queryWords) {
    // Skip common words, look for capitalized or all-caps names
    if (word.length > 2 && (word === word.toUpperCase() || /^[A-Z]/.test(word))) {
      // Check if it might be a name (not a common word)
      const commonWords = ['THE', 'AND', 'FOR', 'WITH', 'FROM', 'ABOUT', 'WHAT', 'WHEN', 'WHERE', 'HOW', 'WHY']
      if (!commonWords.includes(word.toUpperCase())) {
        entityNames.add(word)
      }
    }
  }

  return Array.from(entityNames)
}

/**
 * Normalize entity name for matching
 */
function normalizeEntityName(name: string): string {
  return name.trim()
    .replace(/\s+/g, ' ')  // Normalize spaces
}

// ============================================
// CONTEXT RESOLUTION
// ============================================

/**
 * Resolve context for a list of entity names
 * Order of resolution:
 * 1. Check context cache (fastest)
 * 2. Check database entities table
 * 3. Fallback: return basic entry
 *
 * Web search enrichment is done separately via entity-youtube-enrichment.ts
 */
export async function resolveEntityContext(
  entityNames: string[],
  topicId: string
): Promise<EntityContextForPrompt> {
  const resolved: ResolvedEntity[] = []
  const unknown: string[] = []
  const stats = {
    total_requested: entityNames.length,
    resolved_from_db: 0,
    resolved_from_cache: 0,
    resolved_from_web: 0,
    unresolved: 0
  }

  if (entityNames.length === 0) {
    return {
      entity_glossary: '',
      entities: [],
      unknown_entities: [],
      stats
    }
  }

  // 1. Try to get from context cache first
  const { data: cached } = await supabase
    .from('entity_context_cache')
    .select('*')
    .eq('topic_id', topicId)
    .in('entity_id', await getEntityIds(entityNames, topicId))

  const cachedMap = new Map(cached?.map(c => [c.entity_id, c]) || [])

  // 2. Get entities from database
  const { data: entities } = await supabase
    .from('entities')
    .select(`
      id,
      canonical_name,
      entity_type,
      metadata,
      entity_aliases (alias)
    `)
    .eq('topic_id', topicId)
    .or(entityNames.map(n => `canonical_name.ilike.${n}`).join(','))

  // Build a map of found entities
  type EntityRow = { id: any; canonical_name: any; entity_type: any; metadata: any; entity_aliases: { alias: any }[] }
  const foundEntities = new Map<string, EntityRow>()
  if (entities) {
    for (const entity of entities) {
      foundEntities.set(entity.canonical_name.toLowerCase(), entity)
      // Also map by aliases
      if (entity.entity_aliases) {
        for (const alias of entity.entity_aliases) {
          foundEntities.set(alias.alias.toLowerCase(), entity)
        }
      }
    }
  }

  // 3. Resolve each requested entity
  for (const name of entityNames) {
    const normalizedName = name.toLowerCase()
    const entity = foundEntities.get(normalizedName)

    if (entity) {
      // Check if we have cached context
      const cachedContext = cachedMap.get(entity.id)

      if (cachedContext && cachedContext.expires_at && new Date(cachedContext.expires_at) > new Date()) {
        // Use cached
        resolved.push({
          name: entity.canonical_name,
          id: entity.id,
          type: entity.entity_type || 'unknown',
          context: cachedContext.resolved_context as EntityContext,
          aliases: entity.entity_aliases?.map(a => a.alias),
          source: 'cache'
        })
        stats.resolved_from_cache++
      } else {
        // Use database metadata
        resolved.push({
          name: entity.canonical_name,
          id: entity.id,
          type: entity.entity_type || 'unknown',
          context: (entity.metadata || {}) as EntityContext,
          aliases: entity.entity_aliases?.map(a => a.alias),
          source: 'database'
        })
        stats.resolved_from_db++
      }
    } else {
      // Unknown entity
      unknown.push(name)
      stats.unresolved++
    }
  }

  // 4. Format glossary
  const glossary = formatEntityGlossary(resolved)

  return {
    entity_glossary: glossary,
    entities: resolved,
    unknown_entities: unknown,
    stats
  }
}

/**
 * Get entity IDs from names
 */
async function getEntityIds(names: string[], topicId: string): Promise<string[]> {
  const { data } = await supabase
    .from('entities')
    .select('id')
    .eq('topic_id', topicId)
    .or(names.map(n => `canonical_name.ilike.${n}`).join(','))

  return data?.map(e => e.id) || []
}

// ============================================
// GLOSSARY FORMATTING
// ============================================

/**
 * Format resolved entities into a glossary for prompt injection
 */
export function formatEntityGlossary(entities: ResolvedEntity[]): string {
  if (entities.length === 0) {
    return ''
  }

  // Group by type
  const people: ResolvedEntity[] = []
  const organizations: ResolvedEntity[] = []
  const media: ResolvedEntity[] = []
  const other: ResolvedEntity[] = []

  for (const entity of entities) {
    const type = entity.type.toLowerCase()
    if (['person', 'battler', 'blogger', 'host', 'producer'].includes(type)) {
      people.push(entity)
    } else if (['organization', 'league', 'company', 'brand'].includes(type)) {
      organizations.push(entity)
    } else if (['media', 'channel', 'show', 'podcast'].includes(type)) {
      media.push(entity)
    } else {
      other.push(entity)
    }
  }

  const sections: string[] = []

  if (people.length > 0) {
    sections.push('PEOPLE:')
    for (const entity of people) {
      sections.push(`- ${formatEntityEntry(entity)}`)
    }
  }

  if (organizations.length > 0) {
    sections.push('\nORGANIZATIONS:')
    for (const entity of organizations) {
      sections.push(`- ${formatEntityEntry(entity)}`)
    }
  }

  if (media.length > 0) {
    sections.push('\nMEDIA:')
    for (const entity of media) {
      sections.push(`- ${formatEntityEntry(entity)}`)
    }
  }

  if (other.length > 0) {
    sections.push('\nOTHER:')
    for (const entity of other) {
      sections.push(`- ${formatEntityEntry(entity)}`)
    }
  }

  return `=== ENTITY GLOSSARY ===
Use this to correctly identify people and organizations.
DO NOT assume roles or affiliations not listed here.

${sections.join('\n')}
=== END GLOSSARY ===`
}

/**
 * Format a single entity entry for the glossary
 */
function formatEntityEntry(entity: ResolvedEntity): string {
  const parts: string[] = [entity.name]

  // Add aliases
  if (entity.aliases && entity.aliases.length > 0) {
    parts[0] += ` (${entity.aliases.slice(0, 2).join(', ')})`
  }

  // Add colon separator
  parts[0] += ':'

  // Add gender
  if (entity.context.gender && entity.context.gender !== 'unknown') {
    parts.push(capitalize(entity.context.gender) + '.')
  }

  // Add gender warning if needs review (prevents Debo-type errors)
  if (entity.context.gender_needs_review) {
    const reason = entity.context.gender_review_reason || 'associated with gendered league'
    parts.push(`[GENDER UNVERIFIED - ${reason}]`)
    console.warn(`[EntityContext] ${entity.name} gender may need verification - ${reason}`)
  }

  // Add league context warning (e.g., male owner of female league)
  if (entity.context.league_context) {
    const lc = entity.context.league_context
    if (lc.person_role && lc.league_gender_focus) {
      parts.push(`${capitalize(lc.person_role)} of ${lc.league_name} (${lc.league_gender_focus} league).`)
    }
  }

  // Add role
  if (entity.context.role) {
    parts.push(capitalize(entity.context.role) + '.')
  }

  // Add sub-roles
  if (entity.context.sub_roles && entity.context.sub_roles.length > 0) {
    parts.push(`Also: ${entity.context.sub_roles.join(', ')}.`)
  }

  // Add affiliations
  if (entity.context.affiliations && entity.context.affiliations.length > 0) {
    const affiliationStrs = entity.context.affiliations
      .map(a => formatAffiliation(a))
      .filter(Boolean)
    if (affiliationStrs.length > 0) {
      parts.push(affiliationStrs.join(' '))
    }
  }

  // Add commentator flag
  if (entity.context.is_commentator) {
    parts.push('Commentator/analyst.')
  }

  // Add primary source flag
  if (entity.context.is_primary_source) {
    parts.push('Primary source.')
  }

  // Add bias indicators
  if (entity.context.bias_indicators && entity.context.bias_indicators.length > 0) {
    parts.push(`Known bias: ${entity.context.bias_indicators.join(', ')}.`)
  }

  // Add notes (truncated)
  if (entity.context.notes) {
    const truncatedNotes = entity.context.notes.substring(0, 100)
    parts.push(truncatedNotes + (entity.context.notes.length > 100 ? '...' : ''))
  }

  return parts.join(' ')
}

/**
 * Format an affiliation for display
 */
function formatAffiliation(aff: EntityAffiliation): string {
  if (!aff.name) return ''

  let str = ''

  if (aff.status === 'former') {
    str = `Former ${aff.type || 'member'} of ${aff.name}.`
  } else if (aff.status === 'rumored') {
    str = `Rumored ${aff.type || 'connection'} with ${aff.name}.`
  } else {
    str = `${aff.type ? capitalize(aff.type) + ' at' : 'Affiliated with'} ${aff.name}.`
  }

  return str
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Cache resolved entity context
 */
export async function cacheEntityContext(
  entityId: string,
  topicId: string,
  context: EntityContext,
  source: 'database' | 'web_search' | 'enrichment' | 'manual',
  expiresInHours: number = 24 * 7  // Default 1 week
): Promise<void> {
  const glossaryEntry = formatEntityEntry({
    name: '', // Will be filled from entity table
    type: 'unknown',
    context,
    source: 'cache'
  })

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + expiresInHours)

  await supabase
    .from('entity_context_cache')
    .upsert({
      entity_id: entityId,
      topic_id: topicId,
      resolved_context: context,
      source,
      glossary_entry: glossaryEntry,
      resolved_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    }, {
      onConflict: 'entity_id,topic_id'
    })
}

/**
 * Invalidate cached context for an entity
 */
export async function invalidateEntityCache(
  entityId: string,
  topicId?: string
): Promise<void> {
  let query = supabase
    .from('entity_context_cache')
    .delete()
    .eq('entity_id', entityId)

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  await query
}

// ============================================
// QUICK LOOKUP
// ============================================

/**
 * Quick lookup for a single entity by name
 */
export async function lookupEntity(
  name: string,
  topicId: string
): Promise<ResolvedEntity | null> {
  const result = await resolveEntityContext([name], topicId)
  return result.entities[0] || null
}

/**
 * Get all entities for a topic with context
 */
export async function getAllEntitiesWithContext(
  topicId: string,
  limit: number = 100
): Promise<ResolvedEntity[]> {
  const { data: entities } = await supabase
    .from('entities')
    .select(`
      id,
      canonical_name,
      entity_type,
      metadata,
      entity_aliases (alias)
    `)
    .eq('topic_id', topicId)
    .limit(limit)

  if (!entities) return []

  return entities.map(entity => ({
    name: entity.canonical_name,
    id: entity.id,
    type: entity.entity_type || 'unknown',
    context: (entity.metadata || {}) as EntityContext,
    aliases: entity.entity_aliases?.map(a => a.alias),
    source: 'database' as const
  }))
}
