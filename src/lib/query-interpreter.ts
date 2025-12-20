/**
 * Query Interpreter
 *
 * Takes a raw query and uses LLM to:
 * 1. Understand what the user is looking for
 * 2. Expand into multiple search queries
 * 3. Identify entities that need context
 * 4. Determine search strategy
 */

const REQUESTY_API_KEY = process.env.REQUESTY_API_KEY
const REQUESTY_URL = 'https://router.requesty.ai/v1/chat/completions'

export interface QueryPlan {
  original_query: string
  interpreted_as: string          // Human-readable interpretation

  // Search queries
  primary_queries: string[]       // Main search terms to try
  secondary_queries: string[]     // Fallback/supplementary searches
  entity_lookups: string[]        // Web searches for entity context

  // Search strategy
  search_type: 'youtube_only' | 'youtube_and_web' | 'deep_research'
  expected_content: 'interviews' | 'reactions' | 'news' | 'documentary' | 'mixed'

  // Entities detected
  entities: {
    name: string
    type: 'person' | 'organization' | 'event' | 'unknown'
    role_hint?: string           // "battler", "blogger", "league"
    needs_context: boolean       // Should we web search for more info?
  }[]

  // Filtering hints
  keywords_must_have: string[]   // Video must mention at least one
  keywords_nice_to_have: string[] // Helps with relevance scoring
  exclude_patterns: string[]     // Skip videos matching these

  // Legal/allegation story detection (auto-detected)
  involves_legal_allegations: boolean    // Story involves snitching, court cases, paperwork
  document_search_recommended: boolean   // Should search web for court docs
  real_name_search_needed: boolean       // Need to find government name for court records
}

// Keywords that indicate legal/allegation stories
const ALLEGATION_KEYWORDS = [
  'snitch', 'snitching', 'snitched', 'rat', 'ratted',
  'paperwork', 'court', 'arrest', 'arrested', 'charges',
  'allegations', 'accused', 'indicted', 'trial', 'testimony',
  'witness', 'cooperating', 'informant', 'told on', 'telling',
  'police', 'feds', 'case', 'conviction', 'sentenced'
]

/**
 * Detect if a query involves legal allegations
 */
function detectLegalAllegations(query: string): {
  involves_legal_allegations: boolean
  document_search_recommended: boolean
  real_name_search_needed: boolean
} {
  const queryLower = query.toLowerCase()
  const matchedKeywords = ALLEGATION_KEYWORDS.filter(kw => queryLower.includes(kw))

  const involves_legal_allegations = matchedKeywords.length > 0
  const document_search_recommended = involves_legal_allegations
  const real_name_search_needed = involves_legal_allegations &&
    (queryLower.includes('court') || queryLower.includes('arrest') ||
     queryLower.includes('paperwork') || queryLower.includes('charges'))

  if (involves_legal_allegations) {
    console.log(`[QueryInterpreter] Detected legal/allegation story. Keywords: ${matchedKeywords.join(', ')}`)
  }

  return {
    involves_legal_allegations,
    document_search_recommended,
    real_name_search_needed
  }
}

export interface EntityContext {
  name: string
  description: string
  role: string
  affiliations: string[]
  source: string                 // Where we got this info
}

export interface InterpretQueryOptions {
  topic_context?: string       // e.g., "battle rap"
  known_entities?: string[]    // Entities we already know about
  depth?: 'quick' | 'thorough' // How much to expand
}

/**
 * Get the LLM prompt for query interpretation
 */
function getQueryInterpretationPrompt(query: string, options?: InterpretQueryOptions): string {
  const topicContext = options?.topic_context || 'battle rap'
  const knownEntities = options?.known_entities?.join(', ') || 'none provided'
  const depth = options?.depth || 'thorough'

  return `You are a research assistant specializing in ${topicContext}. Analyze this search query and create a comprehensive search plan.

Query: "${query}"

Known entities in this niche: ${knownEntities}

Your task:
1. Understand what information the user is looking for
2. Identify all entities mentioned (people, organizations, events)
3. Generate search queries that will find relevant content
4. Consider different perspectives (if it's an incident, both sides' interviews)

Respond with valid JSON only (no markdown, no explanation):
{
  "interpreted_as": "What the user is looking for in plain English",
  "primary_queries": ["main search terms - 2-4 queries"],
  "secondary_queries": ["supplementary searches - names + interview/reaction/speaks on - 3-6 queries"],
  "entity_lookups": ["web searches to understand who entities are - only if needed"],
  "search_type": "youtube_only",
  "expected_content": "interviews | reactions | news | documentary | mixed",
  "entities": [
    {
      "name": "entity name",
      "type": "person | organization | event | unknown",
      "role_hint": "battler | blogger | league | media | event",
      "needs_context": true
    }
  ],
  "keywords_must_have": ["at least one must be in title/description"],
  "keywords_nice_to_have": ["helps rank relevance"],
  "exclude_patterns": ["terms that indicate wrong content"]
}

Guidelines for ${topicContext} queries:
- Battler names often have variations (nicknames, government names)
- Add "interview", "reaction", "speaks on", "responds to" as secondary queries
- For incidents/conflicts, search for each person's perspective separately
- Consider blog channels: Chris Unbias, Angry Fan, JayBlac, etc.
- Entity types: battler, blogger, league (URL, KOTD, RBE), media outlet, event
- Exclude patterns help filter out: video games, unrelated "caps", etc.

${depth === 'thorough' ? 'Generate comprehensive search plan with many query variations.' : 'Generate focused search plan with essential queries only.'}`
}

/**
 * Call Claude via Requesty for query interpretation
 */
async function callLLM(prompt: string): Promise<string> {
  if (!REQUESTY_API_KEY) {
    throw new Error('REQUESTY_API_KEY is not configured')
  }

  const response = await fetch(REQUESTY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${REQUESTY_API_KEY}`
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3  // Lower temperature for more consistent JSON output
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

/**
 * Parse LLM response into QueryPlan
 */
function parseLLMResponse(response: string, originalQuery: string): QueryPlan {
  try {
    // Try to extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Detect legal/allegation content
    const legalFlags = detectLegalAllegations(originalQuery)

    // Validate required fields and provide defaults
    return {
      original_query: originalQuery,
      interpreted_as: parsed.interpreted_as || originalQuery,
      primary_queries: parsed.primary_queries || [originalQuery],
      secondary_queries: parsed.secondary_queries || [],
      entity_lookups: parsed.entity_lookups || [],
      search_type: parsed.search_type || 'youtube_only',
      expected_content: parsed.expected_content || 'mixed',
      entities: parsed.entities || [],
      keywords_must_have: parsed.keywords_must_have || [],
      keywords_nice_to_have: parsed.keywords_nice_to_have || [],
      exclude_patterns: parsed.exclude_patterns || [],
      // Legal/allegation detection
      ...legalFlags
    }
  } catch (error) {
    console.error('[QueryInterpreter] Failed to parse LLM response:', error)
    // Return fallback plan
    return createFallbackPlan(originalQuery)
  }
}

/**
 * Create a fallback plan when LLM fails
 */
function createFallbackPlan(query: string): QueryPlan {
  // Simple extraction of potential entities (capitalized words)
  const words = query.split(/\s+/)
  const potentialEntities = words.filter(w =>
    w.length > 2 && w[0] === w[0].toUpperCase() && w !== w.toUpperCase()
  )

  // Detect legal/allegation content
  const legalFlags = detectLegalAllegations(query)

  return {
    original_query: query,
    interpreted_as: `Search for information about: ${query}`,
    primary_queries: [query],
    secondary_queries: potentialEntities.map(e => `${e} interview`),
    entity_lookups: [],
    search_type: 'youtube_only',
    expected_content: 'mixed',
    entities: potentialEntities.map(name => ({
      name,
      type: 'unknown' as const,
      needs_context: false
    })),
    keywords_must_have: potentialEntities.length > 0 ? potentialEntities : words.slice(0, 2),
    keywords_nice_to_have: ['interview', 'speaks', 'reaction'],
    exclude_patterns: [],
    // Legal/allegation detection
    ...legalFlags
  }
}

/**
 * Main function - takes raw query, returns search plan
 */
export async function interpretQuery(
  query: string,
  options?: InterpretQueryOptions
): Promise<QueryPlan> {
  console.log(`[QueryInterpreter] Interpreting query: "${query}"`)

  try {
    const prompt = getQueryInterpretationPrompt(query, options)
    const response = await callLLM(prompt)
    const plan = parseLLMResponse(response, query)

    console.log(`[QueryInterpreter] Generated plan with ${plan.primary_queries.length} primary queries, ${plan.secondary_queries.length} secondary queries`)
    console.log(`[QueryInterpreter] Detected ${plan.entities.length} entities`)

    return plan
  } catch (error) {
    console.error('[QueryInterpreter] Error interpreting query:', error)
    console.log('[QueryInterpreter] Using fallback plan')
    return createFallbackPlan(query)
  }
}

/**
 * Get context for entities via web search (placeholder - needs SearXNG integration)
 */
export async function getEntityContext(
  entityLookups: string[]
): Promise<EntityContext[]> {
  // TODO: Integrate with SearXNG for web search
  // For now, return empty array
  console.log(`[QueryInterpreter] Entity context lookup for: ${entityLookups.join(', ')}`)
  console.log('[QueryInterpreter] Web search not yet implemented - skipping entity context')

  return []
}

/**
 * Utility to check if query interpretation is available
 */
export function isQueryInterpreterConfigured(): boolean {
  return !!REQUESTY_API_KEY
}

/**
 * Score a video's relevance based on QueryPlan
 */
export function scoreVideoRelevance(
  title: string,
  description: string,
  plan: QueryPlan
): number {
  const text = `${title} ${description}`.toLowerCase()
  let score = 0

  // Must-have keywords (any one present = base score)
  const hasMustHave = plan.keywords_must_have.some(kw =>
    text.includes(kw.toLowerCase())
  )
  if (hasMustHave) {
    score += 50
  } else {
    // If no must-have keywords, heavily penalize
    score -= 30
  }

  // Nice-to-have keywords (each adds to score)
  for (const kw of plan.keywords_nice_to_have) {
    if (text.includes(kw.toLowerCase())) {
      score += 10
    }
  }

  // Exclude patterns (each present reduces score significantly)
  for (const pattern of plan.exclude_patterns) {
    if (text.includes(pattern.toLowerCase())) {
      score -= 40
    }
  }

  // Entity mentions
  for (const entity of plan.entities) {
    if (text.includes(entity.name.toLowerCase())) {
      score += 15
    }
  }

  return score
}
