/**
 * Niche Settings Loader
 *
 * Loads and applies niche-specific settings from the database.
 * Falls back to defaults if not configured.
 */

import { supabase } from './db'
import {
  NicheSettings,
  DEFAULT_NICHE_SETTINGS,
  BATTLE_RAP_SETTINGS,
  HOOD_HISTORY_SETTINGS
} from '@/types/niche-settings'

// Cache settings to avoid repeated database calls
const settingsCache = new Map<string, NicheSettings>()
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

interface CacheEntry {
  settings: NicheSettings
  cachedAt: number
}

/**
 * Get niche settings for a topic
 * Checks cache first, then database, then falls back to defaults
 */
export async function getNicheSettings(topicId: string): Promise<NicheSettings> {
  // Check cache
  const cached = settingsCache.get(topicId) as CacheEntry | undefined
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.settings
  }

  // Load from database
  const { data, error } = await supabase
    .from('topics')
    .select('slug, niche_settings')
    .eq('id', topicId)
    .single()

  if (error || !data) {
    console.warn(`[NicheSettings] Could not load settings for topic ${topicId}, using defaults`)
    return DEFAULT_NICHE_SETTINGS
  }

  // If niche_settings is null or empty, use hardcoded settings based on slug
  let settings: NicheSettings

  if (data.niche_settings && Object.keys(data.niche_settings).length > 0) {
    // Merge with defaults to ensure all fields are present
    settings = mergeWithDefaults(data.niche_settings as Partial<NicheSettings>)
  } else {
    // Use hardcoded settings based on slug
    settings = getSettingsBySlug(data.slug)
  }

  // Cache the result
  settingsCache.set(topicId, { settings, cachedAt: Date.now() } as any)

  return settings
}

/**
 * Get settings by topic slug
 */
export function getSettingsBySlug(slug: string): NicheSettings {
  switch (slug) {
    case 'battle-rap':
      return BATTLE_RAP_SETTINGS
    case 'hood-history-club':
      return HOOD_HISTORY_SETTINGS
    default:
      return DEFAULT_NICHE_SETTINGS
  }
}

/**
 * Merge partial settings with defaults
 */
function mergeWithDefaults(partial: Partial<NicheSettings>): NicheSettings {
  return {
    name: partial.name || DEFAULT_NICHE_SETTINGS.name,
    slug: partial.slug || DEFAULT_NICHE_SETTINGS.slug,
    entity_types: partial.entity_types || DEFAULT_NICHE_SETTINGS.entity_types,
    research_settings: {
      ...DEFAULT_NICHE_SETTINGS.research_settings,
      ...partial.research_settings
    },
    story_settings: {
      ...DEFAULT_NICHE_SETTINGS.story_settings,
      ...partial.story_settings
    },
    audio_settings: {
      ...DEFAULT_NICHE_SETTINGS.audio_settings,
      ...partial.audio_settings
    }
  }
}

/**
 * Invalidate cached settings for a topic
 */
export function invalidateNicheSettingsCache(topicId: string): void {
  settingsCache.delete(topicId)
}

/**
 * Get interview search configuration from niche settings
 */
export function getInterviewSearchConfig(settings: NicheSettings) {
  return {
    search_suffix: settings.research_settings.interview_search_suffix,
    max_lookups: settings.research_settings.max_interview_lookups,
    prefer_longest: settings.research_settings.prefer_longest_interviews,
    min_duration_minutes: settings.research_settings.min_interview_duration_minutes,
    max_duration_minutes: settings.research_settings.max_interview_duration_minutes
  }
}

/**
 * Get story configuration from niche settings
 */
export function getStoryConfig(settings: NicheSettings, length: 'short' | 'medium' | 'long' = 'medium') {
  const chapters = length === 'long' && settings.story_settings.long_chapter_structure
    ? settings.story_settings.long_chapter_structure
    : settings.story_settings.chapter_structure

  return {
    opening_template: settings.story_settings.opening_template,
    default_length: settings.story_settings.default_length,
    chapters
  }
}

/**
 * Get audio configuration from niche settings
 */
export function getAudioConfig(settings: NicheSettings) {
  return {
    voice_id: settings.audio_settings.voice_id,
    model_id: settings.audio_settings.model_id,
    style: settings.audio_settings.style
  }
}
