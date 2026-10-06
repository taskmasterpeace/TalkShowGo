/**
 * Relationship Extractor
 *
 * Extracts entity relationships from research content:
 * - Video titles (BATTLED from "X vs Y")
 * - Transcripts (all relationship types via LLM)
 * - Interview metadata (INTERVIEWED)
 *
 * Relationships are synced to Memgraph for knowledge graph building.
 */

import { callOpenRouter } from './openrouter'
import { RelationType } from './knowledge-graph'

// ============================================
// TYPES
// ============================================

export interface ExtractedRelationship {
  from_entity: string
  to_entity: string
  relationship_type: RelationType
  confidence: number  // 0-1
  evidence: string    // Quote or source that proves this
  source_type: 'title' | 'transcript' | 'interview' | 'tweet'
  source_id?: string  // video_id, tweet_id, etc.
  metadata?: {
    date?: string
    location?: string
    league?: string
    platform?: string
    result?: string   // For battles: "3-0", "debatable", "classic"
    context?: string  // Additional context
  }
}

export interface ExtractionResult {
  relationships: ExtractedRelationship[]
  entities_found: string[]
  processing_time_ms: number
  stats: {
    from_titles: number
    from_interviews: number
    from_transcripts: number
  }
}

// ============================================
// TITLE PARSING (Fast, Pattern-Based)
// ============================================

// Battle indicators in titles
const BATTLE_PATTERNS = [
  /^(.+?)\s+vs\.?\s+(.+?)(?:\s*[-–|]|\s+full\b|\s+battle\b|\s+rap\b|$)/i,  // "X vs Y", stop at common suffixes
  /^(.+?)\s+versus\s+(.+?)(?:\s*[-–|]|\s+full\b|$)/i,           // "X versus Y"
  /^(.+?)\s+battles?\s+([A-Za-z\s']+?)(?:\s+in\b|\s+at\b|\s+on\b|\s+\d|\s*[-–|]|$)/i,  // "X battles Y" (stop at prepositions/numbers)
  /^(.+?)\s+against\s+(.+?)(?:\s*[-–|]|$)/i,         // "X against Y"
  /battle\s*(?:rap)?:\s*(.+?)\s+vs\.?\s+(.+?)(?:\s*[-–|]|$)/i,  // "Battle Rap: X vs Y"
]

// Interview indicators
const INTERVIEW_PATTERNS = [
  /^(.+?)\s+(?:full\s+)?interview(?:\s*[-–|]|$)/i,   // "X FULL INTERVIEW" or "X Interview"
  /interview\s+with\s+(.+?)(?:\s*[-–|]|$)/i,         // "Interview with X"
  /(.+?)\s+(?:sits down|speaks|talks)(?:\s+with)?/i, // "X sits down with"
  /(.+?)\s+(?:on|at)\s+(HHIR|VladTV|No Jumper|Drink Champs|Million Dollaz|Hip Hop Is Real)/i,  // "X on HHIR"
  /exclusive(?:ly)?:?\s+(.+?)(?:\s*[-–|]|$)/i,       // "Exclusive: X"
  /the\s+(.+?)\s+(?:podcast|show):\s*(.+?)(?:\s+episode)?/i,  // "The X Podcast: Y Episode"
]

// Feud indicators
const FEUD_PATTERNS = [
  /(.+?)\s+(?:beef|drama|responds to|calls out|disses)\s+(.+)/i,
  /(.+?)\s+(?:and|vs\.?)\s+(.+?)\s+(?:beef|drama|feud)/i,
]

/**
 * Extract relationships from a video title (fast, no LLM)
 */
export function extractRelationshipsFromTitle(
  title: string,
  channel: string,
  videoId?: string,
  publishedAt?: string
): ExtractedRelationship[] {
  const relationships: ExtractedRelationship[] = []
  const cleanTitle = title.replace(/[[\]()]/g, '').trim()

  // Check for battle patterns
  for (const pattern of BATTLE_PATTERNS) {
    const match = cleanTitle.match(pattern)
    if (match && match[1] && match[2]) {
      const entity1 = cleanName(match[1])
      const entity2 = cleanName(match[2])

      if (entity1 && entity2 && entity1 !== entity2) {
        relationships.push({
          from_entity: entity1,
          to_entity: entity2,
          relationship_type: RelationType.BATTLED,
          confidence: 0.85,
          evidence: title,
          source_type: 'title',
          source_id: videoId,
          metadata: {
            date: publishedAt,
            league: detectLeague(channel, title),
          }
        })
        break  // Only one battle per title
      }
    }
  }

  // Check for interview patterns
  for (const pattern of INTERVIEW_PATTERNS) {
    const match = cleanTitle.match(pattern)
    if (match && match[1]) {
      const interviewee = cleanName(match[1])
      const platform = match[2] || channel

      if (interviewee) {
        relationships.push({
          from_entity: interviewee,
          to_entity: platform,
          relationship_type: RelationType.INTERVIEWED,
          confidence: 0.90,
          evidence: title,
          source_type: 'title',
          source_id: videoId,
          metadata: {
            date: publishedAt,
            platform: platform,
          }
        })
        break
      }
    }
  }

  // Check for feud patterns
  for (const pattern of FEUD_PATTERNS) {
    const match = cleanTitle.match(pattern)
    if (match && match[1] && match[2]) {
      const entity1 = cleanName(match[1])
      const entity2 = cleanName(match[2])

      if (entity1 && entity2 && entity1 !== entity2) {
        relationships.push({
          from_entity: entity1,
          to_entity: entity2,
          relationship_type: RelationType.FEUDED_WITH,
          confidence: 0.70,
          evidence: title,
          source_type: 'title',
          source_id: videoId,
          metadata: {
            date: publishedAt,
            context: 'Detected from title pattern',
          }
        })
        break
      }
    }
  }

  return relationships
}

/**
 * Clean entity name from title parsing
 */
function cleanName(name: string): string {
  return name
    .replace(/['"].*['"]/, '')  // Remove quoted text
    .replace(/\s*[-–|:].*/g, '') // Remove after dash/pipe
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)  // Limit length
}

/**
 * Detect league from channel name or title
 */
function detectLeague(channel: string, title: string): string | undefined {
  const combined = `${channel} ${title}`.toLowerCase()

  if (combined.includes('url') || combined.includes('ultimate rap league')) return 'URL'
  if (combined.includes('kotd') || combined.includes('king of the dot')) return 'KOTD'
  if (combined.includes('rbe') || combined.includes('rare breed')) return 'RBE'
  if (combined.includes('gates of the garden') || combined.includes('gotg')) return 'GOTG'
  if (combined.includes('chrome 23')) return 'Chrome 23'
  if (combined.includes('qotr') || combined.includes('queen of the ring')) return 'QOTR'

  return undefined
}

// ============================================
// LLM-POWERED EXTRACTION (Accurate, Deeper)
// ============================================

const EXTRACTION_PROMPT = `You are a relationship extraction AI for a battle rap knowledge graph.

Analyze the following content and extract relationships between entities (people, organizations, events).

RELATIONSHIP TYPES:
- BATTLED: Two people had a rap battle
- INTERVIEWED: Person was interviewed by/on a platform
- FEUDED_WITH: Ongoing beef, drama, or conflict
- AFFILIATED_WITH: Member of a league, crew, or organization
- COLLABORATED_WITH: Worked together on a project
- SIGNED_TO: Signed to a label or league
- MENTORED: Mentored or trained another person

KNOWN ENTITIES IN THIS NICHE:
{known_entities}

CONTENT TO ANALYZE:
{content}

Return a JSON array of relationships found. Each relationship should have:
- from_entity: The subject entity name
- to_entity: The object entity name
- relationship_type: One of the types above
- confidence: 0.0-1.0 (how confident are you?)
- evidence: A direct quote or summary proving this relationship
- metadata: { date?, league?, platform?, result?, context? }

Only extract relationships you're CONFIDENT about. Quality over quantity.
If no clear relationships are found, return an empty array: []

Return ONLY valid JSON, no explanation.`

/**
 * Extract relationships from transcript using LLM
 */
export async function extractRelationshipsFromTranscript(
  transcript: string,
  knownEntities: string[],
  sourceId?: string,
  sourceType: 'transcript' | 'tweet' = 'transcript'
): Promise<ExtractedRelationship[]> {
  // Limit transcript length to avoid token limits
  const truncatedTranscript = transcript.slice(0, 8000)

  const prompt = EXTRACTION_PROMPT
    .replace('{known_entities}', knownEntities.slice(0, 50).join(', ') || 'None provided')
    .replace('{content}', truncatedTranscript)

  try {
    const response = await callOpenRouter({
      model: 'deepseek/deepseek-chat',  // Fast and cheap
      messages: [
        { role: 'system', content: 'You are a JSON-only extraction AI. Return only valid JSON arrays.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.3,  // Low temperature for consistency
    })

    // Parse JSON response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('[RelationshipExtractor] No JSON array found in response')
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Map to our type and add source info
    return parsed.map((r: Record<string, unknown>) => ({
      from_entity: String(r.from_entity || ''),
      to_entity: String(r.to_entity || ''),
      relationship_type: mapRelationType(String(r.relationship_type || '')),
      confidence: Number(r.confidence) || 0.5,
      evidence: String(r.evidence || ''),
      source_type: sourceType,
      source_id: sourceId,
      metadata: r.metadata as ExtractedRelationship['metadata'],
    })).filter((r: ExtractedRelationship) => r.from_entity && r.to_entity)

  } catch (error) {
    console.error('[RelationshipExtractor] LLM extraction failed:', error)
    return []
  }
}

/**
 * Map string to RelationType enum
 */
function mapRelationType(type: string): RelationType {
  const normalized = type.toUpperCase().replace(/\s+/g, '_')

  switch (normalized) {
    case 'BATTLED': return RelationType.BATTLED
    case 'INTERVIEWED': return RelationType.INTERVIEWED
    case 'FEUDED_WITH': return RelationType.FEUDED_WITH
    case 'AFFILIATED_WITH': return RelationType.AFFILIATED_WITH
    case 'COLLABORATED_WITH': return RelationType.COLLABORATED_WITH
    case 'SIGNED_TO': return RelationType.SIGNED_TO
    case 'MENTORED': return RelationType.MENTORED
    case 'WORKS_FOR': return RelationType.WORKS_FOR
    default: return RelationType.AFFILIATED_WITH  // Default fallback
  }
}

// ============================================
// INTERVIEW EXTRACTION (From Interview Lookup)
// ============================================

export interface InterviewSource {
  entity_name: string
  entity_id?: string
  entity_type: string
  video_id: string
  title: string
  channel: string
  transcript?: string
  duration_seconds: number
  published_at?: string
}

/**
 * Convert interview lookup results to INTERVIEWED relationships
 */
export function extractRelationshipsFromInterviews(
  interviews: InterviewSource[]
): ExtractedRelationship[] {
  return interviews.map(interview => ({
    from_entity: interview.entity_name,
    to_entity: interview.channel,
    relationship_type: RelationType.INTERVIEWED,
    confidence: 0.95,  // Very high - we know they were interviewed
    evidence: interview.title,
    source_type: 'interview' as const,
    source_id: interview.video_id,
    metadata: {
      date: interview.published_at,
      platform: interview.channel,
      context: `${Math.round(interview.duration_seconds / 60)} minute interview`,
    }
  }))
}

// ============================================
// BATCH EXTRACTION
// ============================================

export interface ResearchSource {
  video_id: string
  title: string
  channel: string
  transcript?: string
  published_at?: string
}

/**
 * Extract relationships from all research sources
 * Combines title parsing (fast) with LLM analysis (deep)
 */
export async function extractRelationshipsFromSources(
  sources: ResearchSource[],
  interviews: InterviewSource[],
  knownEntities: string[],
  options: { useLLM?: boolean } = { useLLM: true }
): Promise<ExtractionResult> {
  const startTime = Date.now()
  const allRelationships: ExtractedRelationship[] = []
  const entitiesFound = new Set<string>()

  // Track stats
  let fromTitles = 0
  let fromInterviews = 0
  let fromTranscripts = 0

  // 1. Extract from video titles (fast, no LLM)
  for (const source of sources) {
    const titleRels = extractRelationshipsFromTitle(
      source.title,
      source.channel,
      source.video_id,
      source.published_at
    )
    allRelationships.push(...titleRels)
    fromTitles += titleRels.length

    titleRels.forEach(r => {
      entitiesFound.add(r.from_entity)
      entitiesFound.add(r.to_entity)
    })
  }

  console.log(`[RelationshipExtractor] Extracted ${fromTitles} relationships from ${sources.length} titles`)

  // 2. Extract from interviews (quick win)
  const interviewRels = extractRelationshipsFromInterviews(interviews)
  allRelationships.push(...interviewRels)
  fromInterviews = interviewRels.length

  interviewRels.forEach(r => {
    entitiesFound.add(r.from_entity)
    entitiesFound.add(r.to_entity)
  })

  console.log(`[RelationshipExtractor] Added ${fromInterviews} INTERVIEWED relationships`)

  // 3. LLM analysis of transcripts (deep, optional)
  if (options.useLLM) {
    const transcriptsWithContent = sources.filter(s => s.transcript && s.transcript.length > 100)

    // Limit to top 5 transcripts to control costs
    const topTranscripts = transcriptsWithContent.slice(0, 5)

    for (const source of topTranscripts) {
      const transcriptRels = await extractRelationshipsFromTranscript(
        source.transcript!,
        [...knownEntities, ...Array.from(entitiesFound)],
        source.video_id,
        'transcript'
      )
      allRelationships.push(...transcriptRels)
      fromTranscripts += transcriptRels.length

      transcriptRels.forEach(r => {
        entitiesFound.add(r.from_entity)
        entitiesFound.add(r.to_entity)
      })
    }

    console.log(`[RelationshipExtractor] LLM analyzed ${topTranscripts.length} transcripts`)
  }

  // Deduplicate relationships
  const deduped = deduplicateRelationships(allRelationships)

  return {
    relationships: deduped,
    entities_found: Array.from(entitiesFound),
    processing_time_ms: Date.now() - startTime,
    stats: {
      from_titles: fromTitles,
      from_interviews: fromInterviews,
      from_transcripts: fromTranscripts,
    }
  }
}

/**
 * Deduplicate relationships (same entities + type = same relationship)
 * Keep the one with highest confidence
 */
function deduplicateRelationships(relationships: ExtractedRelationship[]): ExtractedRelationship[] {
  const seen = new Map<string, ExtractedRelationship>()

  for (const rel of relationships) {
    // Create key (normalize entity order for symmetric relationships)
    const entities = [rel.from_entity.toLowerCase(), rel.to_entity.toLowerCase()].sort()
    const key = `${entities[0]}|${entities[1]}|${rel.relationship_type}`

    const existing = seen.get(key)
    if (!existing || rel.confidence > existing.confidence) {
      seen.set(key, rel)
    }
  }

  return Array.from(seen.values())
}
