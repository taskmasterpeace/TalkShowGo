/**
 * Entity Context Schema
 *
 * Niche-agnostic metadata structure for storing entity information.
 * Designed to work across any content domain (battle rap, sports, politics, etc.)
 */

export interface EntityAffiliation {
  name: string              // "URL", "Dallas Cowboys", "CNN"
  type: string              // "league", "team", "network", "company"
  status: 'current' | 'former' | 'rumored'
  since?: string            // Date or description
}

/**
 * League context - distinguishes person's gender from league's focus
 * Prevents errors like marking Debo (male) as female because he runs QOTR (female league)
 */
export interface LeagueContext {
  league_name: string                     // "QOTR", "URL", "KOTD"
  league_gender_focus: 'male' | 'female' | 'mixed'  // Who participates in the league
  person_role: string                     // "owner", "founder", "participant", "host"
}

export interface EntityPlatforms {
  youtube_channel_id?: string
  twitter_handle?: string
  instagram_handle?: string
  website?: string
}

export interface EntityContext {
  // IDENTITY
  role?: string                    // Free-form: "battler", "blogger", "news anchor", "athlete"
  sub_roles?: string[]             // Multiple roles: ["battler", "podcast host"]
  gender?: 'male' | 'female' | 'other' | 'unknown'

  // AFFILIATIONS (flexible for any domain)
  affiliations?: EntityAffiliation[]

  // LEAGUE CONTEXT (prevents gender confusion - e.g., male owner of female league)
  league_context?: LeagueContext
  gender_needs_review?: boolean      // Flag when gender might be incorrectly inferred
  gender_review_reason?: string      // Why it was flagged

  // CONTENT PROFILE
  content_types?: string[]         // ["battles", "vlogs", "reactions", "news", "interviews"]
  platforms?: EntityPlatforms

  // INTELLIGENCE (for smart routing)
  is_primary_source?: boolean      // Official source vs commentator
  is_commentator?: boolean         // Reacts to/discusses others
  covers_topics?: string[]         // What topics they talk about

  // CREDIBILITY
  bias_indicators?: string[]       // ["pro-URL", "anti-mainstream"]
  reliability_notes?: string       // "Good for breaking news, sometimes speculates"

  // PRODUCER NOTES
  notes?: string                   // Free-form notes from producer
  tags?: string[]                  // Custom tags for filtering

  // EXTRACTION META (auto-populated)
  totalViews?: number              // From YouTube extraction
  source?: string                  // "youtube_extraction", "manual", etc.

  // META
  context_updated_at?: string
  context_updated_by?: string      // "ai_extraction" or "producer_manual"

  // ENRICHMENT STATUS
  enrichment_status?: 'pending' | 'enriched' | 'locked'
  enrichment_last_run?: string     // ISO timestamp of last enrichment
  enrichment_sources?: string[]    // URLs used for enrichment
  enrichment_locked_by?: string    // Who locked it (username or "producer")
  enrichment_locked_at?: string    // When it was locked
}

/**
 * Merge entity context (partial update)
 * Arrays are replaced, not merged
 */
export function mergeEntityContext(
  existing: EntityContext | null,
  updates: Partial<EntityContext>
): EntityContext {
  const result: EntityContext = { ...(existing || {}) }

  // Iterate through updates and apply them
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value
    }
  }

  // Always update the timestamp
  result.context_updated_at = new Date().toISOString()

  return result
}
