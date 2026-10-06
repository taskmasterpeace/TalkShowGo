/**
 * Knowledge Graph Client for Memgraph
 *
 * Provides entity relationship mapping for TalkShowGo:
 * - Who battled who (with dates, leagues, results)
 * - Who interviewed who (with platforms, dates)
 * - Affiliation networks (leagues, labels, crews)
 * - Influence analysis (most connected entities)
 * - Path finding (how are two entities connected?)
 */

import neo4j, { Driver, Session } from 'neo4j-driver'

// Memgraph connection config
const MEMGRAPH_URI = process.env.MEMGRAPH_URI || 'bolt://localhost:7687'
const MEMGRAPH_USER = process.env.MEMGRAPH_USER || 'memgraph'
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD || 'memgraph'

// Singleton driver instance
let driver: Driver | null = null

/**
 * Get or create Memgraph driver connection
 */
export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      MEMGRAPH_URI,
      neo4j.auth.basic(MEMGRAPH_USER, MEMGRAPH_PASSWORD),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
      }
    )
  }
  return driver
}

/**
 * Close the driver connection
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close()
    driver = null
  }
}

/**
 * Relationship types in the knowledge graph
 */
export enum RelationType {
  BATTLED = 'BATTLED',
  INTERVIEWED = 'INTERVIEWED',
  AFFILIATED_WITH = 'AFFILIATED_WITH',
  WORKS_FOR = 'WORKS_FOR',
  SIGNED_TO = 'SIGNED_TO',
  FEUDED_WITH = 'FEUDED_WITH',
  COLLABORATED_WITH = 'COLLABORATED_WITH',
  MENTORED = 'MENTORED',
}

/**
 * Entity node in the graph
 */
export interface GraphEntity {
  id: string
  name: string
  type: 'person' | 'organization' | 'event' | 'league'
  role?: string
  postgres_id?: string
  topic_id?: string  // Filter entities by niche/topic
}

/**
 * Relationship between entities
 */
export interface GraphRelationship {
  id?: string
  type: RelationType
  source_id: string
  target_id: string
  properties?: {
    date?: string
    league?: string
    platform?: string
    result?: string
    status?: string
    context?: string
    since?: string
    role?: string
    // Extraction metadata
    confidence?: string
    evidence?: string
    source_type?: string
    source_id?: string
  }
}

/**
 * Connection path between entities
 */
export interface ConnectionPath {
  nodes: GraphEntity[]
  relationships: Array<{
    type: string
    properties: Record<string, unknown>
  }>
  length: number
}

/**
 * Run a Cypher query against Memgraph
 */
export async function runQuery<T = unknown>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const driver = getDriver()
  const session: Session = driver.session()

  try {
    const result = await session.run(cypher, params)
    return result.records.map((record) => {
      const obj: Record<string, unknown> = {}
      const keys = record.keys as string[]
      keys.forEach((key: string) => {
        const value = record.get(key)
        // Convert Neo4j types to plain objects
        if (value && typeof value === 'object' && 'properties' in value) {
          obj[key] = { ...(value as { properties: Record<string, unknown> }).properties }
        } else {
          obj[key] = value
        }
      })
      return obj as T
    })
  } finally {
    await session.close()
  }
}

/**
 * Check if Memgraph is connected and healthy
 */
export async function checkHealth(): Promise<{ connected: boolean; error?: string }> {
  try {
    await runQuery('RETURN 1 as test')
    return { connected: true }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================
// ENTITY OPERATIONS
// ============================================

/**
 * Create or update an entity node
 */
export async function upsertEntity(entity: GraphEntity): Promise<GraphEntity> {
  const cypher = `
    MERGE (e:Entity {id: $id})
    SET e.name = $name,
        e.type = $type,
        e.role = $role,
        e.postgres_id = $postgres_id,
        e.topic_id = $topic_id,
        e.updated_at = timestamp()
    RETURN e
  `
  const results = await runQuery<{ e: GraphEntity }>(cypher, {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    role: entity.role || null,
    postgres_id: entity.postgres_id || entity.id,
    topic_id: entity.topic_id || null,
  })
  return results[0]?.e || entity
}

/**
 * Get an entity by ID
 */
export async function getEntity(id: string): Promise<GraphEntity | null> {
  const cypher = `
    MATCH (e:Entity {id: $id})
    RETURN e
  `
  const results = await runQuery<{ e: GraphEntity }>(cypher, { id })
  return results[0]?.e || null
}

/**
 * Delete an entity and all its relationships
 */
export async function deleteEntity(id: string): Promise<void> {
  const cypher = `
    MATCH (e:Entity {id: $id})
    DETACH DELETE e
  `
  await runQuery(cypher, { id })
}

// ============================================
// RELATIONSHIP OPERATIONS
// ============================================

/**
 * Create a relationship between two entities
 */
export async function createRelationship(
  relationship: GraphRelationship
): Promise<GraphRelationship> {
  const { type, source_id, target_id, properties = {} } = relationship

  // Build dynamic property string
  const propEntries = Object.entries(properties).filter(([_, v]) => v !== undefined)
  const propString = propEntries.length > 0
    ? ', ' + propEntries.map(([k]) => `r.${k} = $${k}`).join(', ')
    : ''

  const cypher = `
    MATCH (source:Entity {id: $source_id})
    MATCH (target:Entity {id: $target_id})
    MERGE (source)-[r:${type}]->(target)
    SET r.created_at = timestamp()${propString}
    RETURN r, source, target
  `

  await runQuery(cypher, {
    source_id,
    target_id,
    ...properties,
  })

  return relationship
}

/**
 * Get all relationships for an entity
 */
export async function getEntityRelationships(
  entityId: string,
  relationshipType?: RelationType
): Promise<Array<{
  relationship: { type: string; properties: Record<string, unknown> }
  connected_entity: GraphEntity
  direction: 'outgoing' | 'incoming'
}>> {
  const typeFilter = relationshipType ? `:${relationshipType}` : ''

  const cypher = `
    MATCH (e:Entity {id: $entityId})-[r${typeFilter}]-(other:Entity)
    RETURN
      type(r) as rel_type,
      properties(r) as rel_props,
      other,
      CASE WHEN startNode(r) = e THEN 'outgoing' ELSE 'incoming' END as direction
  `

  const results = await runQuery<{
    rel_type: string
    rel_props: Record<string, unknown>
    other: GraphEntity
    direction: 'outgoing' | 'incoming'
  }>(cypher, { entityId })

  return results.map(r => ({
    relationship: {
      type: r.rel_type,
      properties: r.rel_props || {},
    },
    connected_entity: r.other,
    direction: r.direction,
  }))
}

/**
 * Delete a specific relationship between two entities
 */
export async function deleteRelationship(
  sourceId: string,
  targetId: string,
  type: RelationType
): Promise<void> {
  const cypher = `
    MATCH (source:Entity {id: $sourceId})-[r:${type}]-(target:Entity {id: $targetId})
    DELETE r
  `
  await runQuery(cypher, { sourceId, targetId })
}

// ============================================
// QUERY OPERATIONS
// ============================================

/**
 * Find the shortest path between two entities
 */
export async function findConnectionPath(
  entityId1: string,
  entityId2: string,
  maxHops: number = 5
): Promise<ConnectionPath | null> {
  const cypher = `
    MATCH path = shortestPath(
      (a:Entity {id: $entityId1})-[*..${maxHops}]-(b:Entity {id: $entityId2})
    )
    RETURN
      [n IN nodes(path) | properties(n)] as nodes,
      [r IN relationships(path) | {type: type(r), properties: properties(r)}] as relationships,
      length(path) as path_length
  `

  const results = await runQuery<{
    nodes: GraphEntity[]
    relationships: Array<{ type: string; properties: Record<string, unknown> }>
    path_length: number
  }>(cypher, { entityId1, entityId2 })

  if (results.length === 0) return null

  return {
    nodes: results[0].nodes,
    relationships: results[0].relationships,
    length: results[0].path_length,
  }
}

/**
 * Get most connected entities (influence analysis)
 */
export async function getMostConnected(
  limit: number = 20,
  entityType?: string
): Promise<Array<{ entity: GraphEntity; connection_count: number }>> {
  const typeFilter = entityType ? `WHERE e.type = $entityType` : ''

  const cypher = `
    MATCH (e:Entity)
    ${typeFilter}
    OPTIONAL MATCH (e)-[r]-()
    RETURN e, count(r) as connections
    ORDER BY connections DESC
    LIMIT $limit
  `

  const results = await runQuery<{ e: GraphEntity; connections: number }>(
    cypher,
    { limit: neo4j.int(limit), entityType }
  )

  return results.map(r => ({
    entity: r.e,
    connection_count: typeof r.connections === 'object'
      ? Number((r.connections as { low: number }).low)
      : r.connections,
  }))
}

/**
 * Find mutual connections between two entities
 */
export async function findMutualConnections(
  entityId1: string,
  entityId2: string
): Promise<GraphEntity[]> {
  const cypher = `
    MATCH (a:Entity {id: $entityId1})-[]-(mutual:Entity)-[]-(b:Entity {id: $entityId2})
    WHERE a <> b AND mutual <> a AND mutual <> b
    RETURN DISTINCT mutual
  `

  const results = await runQuery<{ mutual: GraphEntity }>(cypher, {
    entityId1,
    entityId2,
  })

  return results.map(r => r.mutual)
}

/**
 * Get all battles for an entity
 */
export async function getEntityBattles(
  entityId: string
): Promise<Array<{
  opponent: GraphEntity
  date?: string
  league?: string
  result?: string
}>> {
  const cypher = `
    MATCH (e:Entity {id: $entityId})-[r:BATTLED]-(opponent:Entity)
    RETURN opponent, r.date as date, r.league as league, r.result as result
    ORDER BY r.date DESC
  `

  const results = await runQuery<{
    opponent: GraphEntity
    date?: string
    league?: string
    result?: string
  }>(cypher, { entityId })

  return results
}

/**
 * Get all interviews for an entity
 */
export async function getEntityInterviews(
  entityId: string
): Promise<Array<{
  other_party: GraphEntity
  date?: string
  platform?: string
  role: 'interviewer' | 'interviewee'
}>> {
  const cypher = `
    MATCH (e:Entity {id: $entityId})-[r:INTERVIEWED]-(other:Entity)
    RETURN
      other as other_party,
      r.date as date,
      r.platform as platform,
      CASE WHEN startNode(r) = e THEN 'interviewer' ELSE 'interviewee' END as role
    ORDER BY r.date DESC
  `

  const results = await runQuery<{
    other_party: GraphEntity
    date?: string
    platform?: string
    role: 'interviewer' | 'interviewee'
  }>(cypher, { entityId })

  return results
}

/**
 * Search entities by name pattern
 */
export async function searchEntities(
  namePattern: string,
  limit: number = 10
): Promise<GraphEntity[]> {
  const cypher = `
    MATCH (e:Entity)
    WHERE toLower(e.name) CONTAINS toLower($pattern)
    RETURN e
    LIMIT $limit
  `

  const results = await runQuery<{ e: GraphEntity }>(cypher, {
    pattern: namePattern,
    limit: neo4j.int(limit),
  })

  return results.map(r => r.e)
}

/**
 * Get relationship statistics for the graph
 */
export async function getGraphStats(): Promise<{
  total_entities: number
  total_relationships: number
  relationship_counts: Record<string, number>
  entity_type_counts: Record<string, number>
}> {
  const entityCountCypher = `
    MATCH (e:Entity)
    RETURN count(e) as total, e.type as type
  `

  const relCountCypher = `
    MATCH ()-[r]->()
    RETURN count(r) as total, type(r) as type
  `

  const [entityResults, relResults] = await Promise.all([
    runQuery<{ total: number | { low: number }; type: string }>(entityCountCypher),
    runQuery<{ total: number | { low: number }; type: string }>(relCountCypher),
  ])

  const entity_type_counts: Record<string, number> = {}
  let total_entities = 0
  for (const r of entityResults) {
    const count = typeof r.total === 'object' ? r.total.low : r.total
    if (r.type) {
      entity_type_counts[r.type] = count
    }
    total_entities += count
  }

  const relationship_counts: Record<string, number> = {}
  let total_relationships = 0
  for (const r of relResults) {
    const count = typeof r.total === 'object' ? r.total.low : r.total
    if (r.type) {
      relationship_counts[r.type] = count
    }
    total_relationships += count
  }

  return {
    total_entities,
    total_relationships,
    relationship_counts,
    entity_type_counts,
  }
}

/**
 * Get full graph data for visualization
 * Returns all nodes and edges for rendering in Sigma.js
 */
export async function getFullGraph(options: {
  limit?: number
  entityType?: string
  relationshipType?: string
  topicId?: string  // Filter by topic/niche
} = {}): Promise<{
  nodes: Array<{
    id: string
    name: string
    type: string
    role?: string
    topic_id?: string
    connection_count: number
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    type: string
    properties: Record<string, unknown>
  }>
}> {
  const { limit = 500, entityType, relationshipType, topicId } = options

  // Build node filter conditions
  const conditions: string[] = []
  if (entityType) conditions.push('e.type = $entityType')
  if (topicId) conditions.push('e.topic_id = $topicId')
  const nodeWhereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const nodeCypher = `
    MATCH (e:Entity)
    ${nodeWhereClause}
    OPTIONAL MATCH (e)-[r]-()
    WITH e, count(r) as connections
    RETURN e, connections
    ORDER BY connections DESC
    LIMIT $limit
  `

  const nodeResults = await runQuery<{
    e: GraphEntity & { id: string }
    connections: number | { low: number }
  }>(nodeCypher, { limit: neo4j.int(limit), entityType, topicId })

  const nodes = nodeResults.map(r => ({
    id: r.e.id,
    name: r.e.name || 'Unknown',
    type: r.e.type || 'person',
    role: r.e.role,
    topic_id: r.e.topic_id,
    connection_count: typeof r.connections === 'object' ? r.connections.low : r.connections,
  }))

  // Get all node IDs for filtering edges
  const nodeIds = new Set(nodes.map(n => n.id))

  // Get edges between these nodes
  const relTypeFilter = relationshipType ? `:${relationshipType}` : ''
  const edgeCypher = `
    MATCH (source:Entity)-[r${relTypeFilter}]->(target:Entity)
    WHERE source.id IN $nodeIds AND target.id IN $nodeIds
    RETURN
      id(r) as rel_id,
      source.id as source_id,
      target.id as target_id,
      type(r) as rel_type,
      properties(r) as rel_props
    LIMIT $limit
  `

  const edgeResults = await runQuery<{
    rel_id: number | { low: number }
    source_id: string
    target_id: string
    rel_type: string
    rel_props: Record<string, unknown>
  }>(edgeCypher, { nodeIds: Array.from(nodeIds), limit: neo4j.int(limit * 2) })

  const edges = edgeResults.map(r => ({
    id: `edge_${typeof r.rel_id === 'object' ? r.rel_id.low : r.rel_id}`,
    source: r.source_id,
    target: r.target_id,
    type: r.rel_type,
    properties: r.rel_props || {},
  }))

  return { nodes, edges }
}
