/**
 * Graph Sync - Migrate entities from PostgreSQL to Memgraph
 *
 * Syncs entities and their relationships to the knowledge graph:
 * - Entity nodes from the entities table
 * - Affiliation relationships from entity metadata
 * - Battle relationships (when detected in entity context)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  upsertEntity,
  createRelationship,
  RelationType,
  GraphEntity,
  checkHealth,
  getGraphStats,
  runQuery,
} from './knowledge-graph'
import { ExtractedRelationship } from './relationship-extractor'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getSupabase(): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey)
}

// Entity metadata structure from PostgreSQL
interface EntityMetadata {
  role?: string
  sub_roles?: string[]
  gender?: string
  affiliations?: Array<{
    name: string
    type: string
    status?: 'current' | 'former' | 'rumored'
  }>
  platforms?: {
    youtube_channel_id?: string
    twitter_handle?: string
  }
  is_primary_source?: boolean
  is_commentator?: boolean
  notes?: string
  tags?: string[]
}

interface PostgresEntity {
  id: string
  canonical_name: string
  entity_type: string
  metadata: EntityMetadata | null
  topic_id: string
}

/**
 * Sync all entities from a topic to Memgraph
 */
export async function syncTopicEntities(topicId: string): Promise<{
  entities_synced: number
  relationships_created: number
  errors: string[]
}> {
  const supabase = getSupabase()
  const errors: string[] = []
  let entities_synced = 0
  let relationships_created = 0

  // Check Memgraph connection
  const health = await checkHealth()
  if (!health.connected) {
    throw new Error(`Memgraph not connected: ${health.error}`)
  }

  // Fetch entities from PostgreSQL
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, canonical_name, entity_type, metadata')
    .eq('topic_id', topicId)

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`)
  }

  if (!entities || entities.length === 0) {
    return { entities_synced: 0, relationships_created: 0, errors: [] }
  }

  console.log(`Syncing ${entities.length} entities from topic ${topicId}...`)

  // First pass: Create all entity nodes
  const entityMap = new Map<string, GraphEntity>()

  for (const entity of entities as PostgresEntity[]) {
    try {
      const metadata = entity.metadata || {}
      const graphEntity: GraphEntity = {
        id: entity.id,
        name: entity.canonical_name,
        type: mapEntityType(entity.entity_type),
        role: metadata.role,
        postgres_id: entity.id,
      }

      await upsertEntity(graphEntity)
      entityMap.set(entity.id, graphEntity)
      entities_synced++
    } catch (err) {
      errors.push(`Entity ${entity.canonical_name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Second pass: Create relationships from affiliations
  for (const entity of entities as PostgresEntity[]) {
    const metadata = entity.metadata
    if (!metadata?.affiliations) continue

    for (const affiliation of metadata.affiliations) {
      // Skip if affiliation name is missing
      if (!affiliation.name) continue

      try {
        // Find or create the affiliated entity
        const affiliatedEntity = findEntityByName(entities as PostgresEntity[], affiliation.name)

        if (affiliatedEntity) {
          // Create relationship to existing entity
          await createRelationship({
            type: mapAffiliationType(affiliation.type),
            source_id: entity.id,
            target_id: affiliatedEntity.id,
            properties: {
              status: affiliation.status || 'current',
            },
          })
          relationships_created++
        } else {
          // Create the affiliated entity if it doesn't exist
          const orgEntity: GraphEntity = {
            id: `org_${affiliation.name.toLowerCase().replace(/\s+/g, '_')}`,
            name: affiliation.name,
            type: mapOrgType(affiliation.type),
          }
          await upsertEntity(orgEntity)

          await createRelationship({
            type: mapAffiliationType(affiliation.type),
            source_id: entity.id,
            target_id: orgEntity.id,
            properties: {
              status: affiliation.status || 'current',
            },
          })
          relationships_created++
        }
      } catch (err) {
        errors.push(
          `Affiliation ${entity.canonical_name}->${affiliation.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      }
    }
  }

  console.log(`Sync complete: ${entities_synced} entities, ${relationships_created} relationships`)

  return { entities_synced, relationships_created, errors }
}

/**
 * Sync a single entity to Memgraph
 */
export async function syncSingleEntity(entityId: string): Promise<void> {
  const supabase = getSupabase()

  const { data: entity, error } = await supabase
    .from('entities')
    .select('id, canonical_name, entity_type, metadata')
    .eq('id', entityId)
    .single()

  if (error || !entity) {
    throw new Error(`Entity not found: ${entityId}`)
  }

  const metadata = (entity as PostgresEntity).metadata || {}
  const graphEntity: GraphEntity = {
    id: entity.id,
    name: entity.canonical_name,
    type: mapEntityType(entity.entity_type),
    role: metadata.role,
    postgres_id: entity.id,
  }

  await upsertEntity(graphEntity)

  // Sync affiliations
  if (metadata.affiliations) {
    for (const affiliation of metadata.affiliations) {
      const orgEntity: GraphEntity = {
        id: `org_${affiliation.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: affiliation.name,
        type: mapOrgType(affiliation.type),
      }
      await upsertEntity(orgEntity)

      await createRelationship({
        type: mapAffiliationType(affiliation.type),
        source_id: entity.id,
        target_id: orgEntity.id,
        properties: {
          status: affiliation.status || 'current',
        },
      })
    }
  }
}

/**
 * Clear all data from the graph
 */
export async function clearGraph(): Promise<void> {
  await runQuery('MATCH (n) DETACH DELETE n')
}

/**
 * Full sync: Clear and rebuild the entire graph
 */
export async function fullSync(topicId: string): Promise<{
  entities_synced: number
  relationships_created: number
  errors: string[]
}> {
  console.log('Clearing existing graph data...')
  await clearGraph()

  console.log('Starting full sync...')
  return syncTopicEntities(topicId)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapEntityType(
  pgType: string
): 'person' | 'organization' | 'event' | 'league' {
  const typeMap: Record<string, 'person' | 'organization' | 'event' | 'league'> = {
    person: 'person',
    organization: 'organization',
    event: 'event',
    league: 'league',
    company: 'organization',
    group: 'organization',
  }
  return typeMap[pgType.toLowerCase()] || 'person'
}

function mapOrgType(
  affiliationType: string
): 'person' | 'organization' | 'event' | 'league' {
  const typeMap: Record<string, 'organization' | 'league'> = {
    league: 'league',
    label: 'organization',
    crew: 'organization',
    media: 'organization',
    company: 'organization',
  }
  return typeMap[affiliationType.toLowerCase()] || 'organization'
}

function mapAffiliationType(affiliationType: string): RelationType {
  const typeMap: Record<string, RelationType> = {
    league: RelationType.AFFILIATED_WITH,
    label: RelationType.SIGNED_TO,
    crew: RelationType.AFFILIATED_WITH,
    media: RelationType.WORKS_FOR,
    employer: RelationType.WORKS_FOR,
    company: RelationType.WORKS_FOR,
  }
  return typeMap[affiliationType.toLowerCase()] || RelationType.AFFILIATED_WITH
}

function findEntityByName(
  entities: PostgresEntity[],
  name: string
): PostgresEntity | undefined {
  const lowerName = name.toLowerCase()
  return entities.find(
    e => e.canonical_name.toLowerCase() === lowerName ||
         e.canonical_name.toLowerCase().includes(lowerName) ||
         lowerName.includes(e.canonical_name.toLowerCase())
  )
}

// ============================================
// RELATIONSHIP SYNC (From Extraction)
// ============================================

/**
 * Sync extracted relationships to Memgraph
 * Creates entity nodes if they don't exist, then creates relationships
 */
export async function syncRelationshipsToGraph(
  relationships: ExtractedRelationship[],
  options: { minConfidence?: number; topicId?: string } = {}
): Promise<{
  relationships_created: number
  entities_created: number
  errors: string[]
}> {
  const { minConfidence = 0.5, topicId } = options
  const errors: string[] = []
  let relationships_created = 0
  let entities_created = 0

  // Filter by confidence
  const filteredRels = relationships.filter(r => r.confidence >= minConfidence)

  if (filteredRels.length === 0) {
    console.log('[GraphSync] No relationships above confidence threshold')
    return { relationships_created: 0, entities_created: 0, errors: [] }
  }

  console.log(`[GraphSync] Syncing ${filteredRels.length} relationships (min confidence: ${minConfidence})`)

  // Collect all unique entities
  const entityNames = new Set<string>()
  for (const rel of filteredRels) {
    entityNames.add(rel.from_entity)
    entityNames.add(rel.to_entity)
  }

  // Create entity nodes for each unique entity
  const entityIdMap = new Map<string, string>()

  for (const name of Array.from(entityNames)) {
    try {
      // Generate a stable ID from the name
      const entityId = `entity_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

      // Guess entity type from context
      const entityType = guessEntityType(name)

      const graphEntity: GraphEntity = {
        id: entityId,
        name: name,
        type: entityType,
        topic_id: topicId,  // Link entity to topic/niche
      }

      await upsertEntity(graphEntity)
      entityIdMap.set(name, entityId)
      entities_created++
    } catch (err) {
      errors.push(`Entity ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Create relationships
  for (const rel of filteredRels) {
    try {
      const sourceId = entityIdMap.get(rel.from_entity)
      const targetId = entityIdMap.get(rel.to_entity)

      if (!sourceId || !targetId) {
        errors.push(`Missing entity ID for relationship: ${rel.from_entity} -> ${rel.to_entity}`)
        continue
      }

      console.log(`[GraphSync] Creating relationship: ${rel.from_entity} (${sourceId}) -[${rel.relationship_type}]-> ${rel.to_entity} (${targetId})`)

      await createRelationship({
        type: rel.relationship_type,
        source_id: sourceId,
        target_id: targetId,
        properties: {
          date: rel.metadata?.date,
          league: rel.metadata?.league,
          platform: rel.metadata?.platform,
          result: rel.metadata?.result,
          context: rel.metadata?.context,
          confidence: String(rel.confidence),
          evidence: rel.evidence?.slice(0, 200),  // Truncate evidence
          source_type: rel.source_type,
          source_id: rel.source_id,
        },
      })
      relationships_created++
      console.log(`[GraphSync] Relationship created successfully`)
    } catch (err) {
      console.error(`[GraphSync] Failed to create relationship:`, err)
      errors.push(`Relationship ${rel.from_entity}->${rel.to_entity}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  console.log(`[GraphSync] Created ${entities_created} entities, ${relationships_created} relationships`)

  return { relationships_created, entities_created, errors }
}

/**
 * Guess entity type from name patterns
 */
function guessEntityType(name: string): 'person' | 'organization' | 'event' | 'league' {
  const lowerName = name.toLowerCase()

  // League patterns
  if (['url', 'kotd', 'rbe', 'qotr', 'gotg', 'chrome 23', 'ultimate rap league', 'king of the dot', 'rare breed'].some(l => lowerName.includes(l))) {
    return 'league'
  }

  // Platform/media patterns
  if (['hhir', 'vladtv', 'no jumper', 'drink champs', 'million dollaz', 'breakfast club', 'podcast', 'tv', 'radio'].some(p => lowerName.includes(p))) {
    return 'organization'
  }

  // Event patterns
  if (['summer madness', 'nome', 'battle of the year', 'banned', 'blackout', 'mass', 'volume'].some(e => lowerName.includes(e))) {
    return 'event'
  }

  // Default to person
  return 'person'
}

// ============================================
// CLI SUPPORT
// ============================================

// Allow running from command line: npx ts-node src/lib/graph-sync.ts <topic_id>
if (require.main === module) {
  const topicId = process.argv[2]

  if (!topicId) {
    console.error('Usage: npx ts-node src/lib/graph-sync.ts <topic_id>')
    console.error('Example: npx ts-node src/lib/graph-sync.ts 864dbcf4-e1f7-4b1a-86ed-c18007439ad5')
    process.exit(1)
  }

  fullSync(topicId)
    .then(result => {
      console.log('\n=== Sync Complete ===')
      console.log(`Entities synced: ${result.entities_synced}`)
      console.log(`Relationships created: ${result.relationships_created}`)
      if (result.errors.length > 0) {
        console.log(`Errors: ${result.errors.length}`)
        result.errors.forEach(e => console.log(`  - ${e}`))
      }

      return getGraphStats()
    })
    .then(stats => {
      console.log('\n=== Graph Statistics ===')
      console.log(`Total entities: ${stats.total_entities}`)
      console.log(`Total relationships: ${stats.total_relationships}`)
      console.log('Entity types:', stats.entity_type_counts)
      console.log('Relationship types:', stats.relationship_counts)
      process.exit(0)
    })
    .catch(err => {
      console.error('Sync failed:', err)
      process.exit(1)
    })
}
