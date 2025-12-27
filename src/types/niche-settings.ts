/**
 * Niche Settings Type Definitions
 *
 * Each topic (niche) has customizable settings for:
 * - Research behavior (interview lookup, lookback window)
 * - Story generation (length, chapters, opening style)
 * - Audio output (voice, style)
 */

export interface NicheResearchSettings {
  interview_search_suffix: string  // "interview" or "documentary OR interview"
  max_interview_lookups: number    // Max entities to look up interviews for
  prefer_longest_interviews: boolean
  min_interview_duration_minutes: number
  max_interview_duration_minutes: number
  default_lookback_hours: number   // 0 = unlimited (historical), 24 = news
  deep_research_max_rounds: number
  interview_lookup_enabled: boolean
  twitter_enabled: boolean
}

export interface NicheStorySettings {
  opening_template: string         // "In the world of battle rap..."
  default_length: 'short' | 'medium' | 'long'
  chapter_structure: string[]      // Default chapters for medium length
  long_chapter_structure?: string[] // Chapters for long stories
}

export interface NicheAudioSettings {
  voice_id: string
  model_id: string
  style: number  // 0-1, documentary style vs conversational
  speakers?: Array<{
    name: string
    personality: string
    voice_id: string
    archetype: string  // 'anchor', 'analyst', 'narrator', 'hype', etc.
  }>
}

export interface NicheSettings {
  name: string
  slug: string
  entity_types: string[]

  research_settings: NicheResearchSettings
  story_settings: NicheStorySettings
  audio_settings: NicheAudioSettings
}

// Default settings for topics without niche_settings configured
export const DEFAULT_NICHE_SETTINGS: NicheSettings = {
  name: 'Default',
  slug: 'default',
  entity_types: ['person', 'organization', 'event'],

  research_settings: {
    interview_search_suffix: 'interview',
    max_interview_lookups: 3,
    prefer_longest_interviews: true,
    min_interview_duration_minutes: 5,
    max_interview_duration_minutes: 60,
    default_lookback_hours: 24,
    deep_research_max_rounds: 3,
    interview_lookup_enabled: true,
    twitter_enabled: false
  },

  story_settings: {
    opening_template: 'In the world of {topic}...',
    default_length: 'medium',
    chapter_structure: ['Hook', 'Background', 'The Event', 'Aftermath', 'Conclusion']
  },

  audio_settings: {
    voice_id: 'ZJ7BlVZrxZKBDMTIK5c9',
    model_id: 'eleven_turbo_v2_5',
    style: 0.15
  }
}

// Battle Rap niche settings
export const BATTLE_RAP_SETTINGS: NicheSettings = {
  name: 'Battle Rap',
  slug: 'battle-rap',
  entity_types: ['battler', 'blogger', 'league', 'media', 'host', 'commentator', 'producer'],

  research_settings: {
    interview_search_suffix: 'interview',
    max_interview_lookups: 3,
    prefer_longest_interviews: true,
    min_interview_duration_minutes: 5,
    max_interview_duration_minutes: 60,
    default_lookback_hours: 24,
    deep_research_max_rounds: 3,
    interview_lookup_enabled: true,
    twitter_enabled: false
  },

  story_settings: {
    opening_template: 'In the world of battle rap...',
    default_length: 'medium',
    chapter_structure: ['Hook', 'Background', 'The Event', 'Aftermath', 'Conclusion'],
    long_chapter_structure: ['Hook', 'Background', 'Build-up', 'The Event', 'Aftermath', 'Reactions', 'Conclusion']
  },

  audio_settings: {
    voice_id: 'ZJ7BlVZrxZKBDMTIK5c9',
    model_id: 'eleven_turbo_v2_5',
    style: 0.15,
    speakers: [
      {
        name: 'host1',
        personality: 'Hip-hop culture expert, animated storyteller, knows every battler and league',
        voice_id: 'ZJ7BlVZrxZKBDMTIK5c9',
        archetype: 'narrator'
      },
      {
        name: 'analyst',
        personality: 'Battle rap analyst with deep knowledge of bars, wordplay, and battle history',
        voice_id: 'TxGEqnHWrfWFTfGW9XjX',
        archetype: 'analyst'
      }
    ]
  }
}

// Hood History Club niche settings
export const HOOD_HISTORY_SETTINGS: NicheSettings = {
  name: 'Hood History Club',
  slug: 'hood-history-club',
  entity_types: ['person', 'gang', 'neighborhood', 'event', 'victim', 'perpetrator'],

  research_settings: {
    interview_search_suffix: 'documentary OR interview OR story',
    max_interview_lookups: 5,
    prefer_longest_interviews: true,
    min_interview_duration_minutes: 10,
    max_interview_duration_minutes: 120,
    default_lookback_hours: 0,  // Unlimited - historical content
    deep_research_max_rounds: 4,
    interview_lookup_enabled: true,
    twitter_enabled: false
  },

  story_settings: {
    opening_template: 'This is a story from the streets...',
    default_length: 'long',
    chapter_structure: ['Hook', 'The Scene', 'The Players', 'What Happened', 'The Fallout', 'Legacy'],
    long_chapter_structure: ['Hook', 'The Scene', 'The Players', 'Build-up', 'What Happened', 'The Fallout', 'Community Impact', 'Legacy']
  },

  audio_settings: {
    voice_id: 'ZJ7BlVZrxZKBDMTIK5c9',
    model_id: 'eleven_turbo_v2_5',
    style: 0.2
  }
}

// Orangeburg, SC local news settings
export const ORANGEBURG_SC_SETTINGS: NicheSettings = {
  name: 'Orangeburg, SC',
  slug: 'orangeburg-sc',
  entity_types: [
    'politician',
    'law_enforcement',
    'government_official',
    'city_employee',
    'university_official',
    'business_owner',
    'community_leader',
    'nonprofit_leader',
    'victim',
    'suspect',
    'witness',
    'student',
    'athlete',
    'coach',
    'emergency_responder',
    'news_reporter',
    'location',
    'business',
    'school',
    'government_agency'
  ],

  research_settings: {
    interview_search_suffix: 'press conference OR statement OR interview',
    max_interview_lookups: 2,
    prefer_longest_interviews: false,
    min_interview_duration_minutes: 2,
    max_interview_duration_minutes: 30,
    default_lookback_hours: 24,
    deep_research_max_rounds: 2,
    interview_lookup_enabled: false,
    twitter_enabled: true
  },

  story_settings: {
    opening_template: 'In Orangeburg, South Carolina...',
    default_length: 'short',
    chapter_structure: ['Breaking', 'What Happened', 'Response', 'What\'s Next'],
    long_chapter_structure: ['Breaking', 'Background', 'What Happened', 'Official Response', 'Community Impact', 'What\'s Next']
  },

  audio_settings: {
    voice_id: 'ZJ7BlVZrxZKBDMTIK5c9',
    model_id: 'eleven_turbo_v2_5',
    style: 0.05,  // Neutral news anchor (vs 0.15 documentary)
    speakers: [
      {
        name: 'sarah',
        personality: 'Warm, community-focused news anchor, cares about local residents',
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        archetype: 'anchor'
      },
      {
        name: 'marcus',
        personality: 'Analytical, fact-focused co-host, keeps things organized',
        voice_id: 'TxGEqnHWrfWFTfGW9XjX',
        archetype: 'analyst'
      }
    ]
  }
}
