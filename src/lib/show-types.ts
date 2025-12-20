/**
 * SHOW TYPES
 *
 * Defines different show formats available in Talk Show Go.
 * Each show type has its own structure, requirements, and default settings.
 */

// ============================================
// TYPES
// ============================================

export interface ShowSegment {
  id: string
  name: string
  description: string
  defaultDurationSeconds: number
  required: boolean
  hostAssignable: boolean  // Can assign different host to this segment
}

export interface ShowType {
  id: string
  name: string
  description: string
  icon: string
  color: string

  // Content settings
  defaultDurationMinutes: number
  storyCount: { min: number; max: number }
  requiresResearch: boolean
  introStyle: 'energetic' | 'cinematic' | 'urgent' | 'conversational'

  // Structure
  segments: ShowSegment[]

  // Default hosts (by preference)
  recommendedHosts: string[]  // Host IDs

  // Formatting
  chapterStructure: string[]  // For story generation
  openingTemplate?: string

  // Feature flags
  supportsMultiVoice: boolean
  supportsTwitter: boolean
  supportsDocuments: boolean
  isEnabled: boolean
}

// ============================================
// SHOW TYPE DEFINITIONS
// ============================================

export const SHOW_TYPES: Record<string, ShowType> = {
  daily: {
    id: 'daily',
    name: 'Daily Show',
    description: 'Quick news roundup covering 3-5 trending stories from the past 24-48 hours',
    icon: '📰',
    color: 'blue',

    defaultDurationMinutes: 8,
    storyCount: { min: 3, max: 5 },
    requiresResearch: true,
    introStyle: 'energetic',

    segments: [
      {
        id: 'intro',
        name: 'Intro',
        description: 'Energetic show opening that teases all stories',
        defaultDurationSeconds: 30,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'story_1',
        name: 'Story 1',
        description: 'First story - typically the biggest news',
        defaultDurationSeconds: 120,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'story_2',
        name: 'Story 2',
        description: 'Second story',
        defaultDurationSeconds: 100,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'story_3',
        name: 'Story 3',
        description: 'Third story',
        defaultDurationSeconds: 100,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'story_4',
        name: 'Story 4',
        description: 'Fourth story (optional)',
        defaultDurationSeconds: 80,
        required: false,
        hostAssignable: true,
      },
      {
        id: 'story_5',
        name: 'Story 5',
        description: 'Fifth story (optional)',
        defaultDurationSeconds: 60,
        required: false,
        hostAssignable: true,
      },
      {
        id: 'outro',
        name: 'Outro',
        description: 'Show closing with call to action',
        defaultDurationSeconds: 20,
        required: true,
        hostAssignable: true,
      },
    ],

    recommendedHosts: ['dj_momentum', 'marcus_blaze', 'tasha_raw'],
    chapterStructure: ['Hook', 'Main Story', 'Conclusion'],
    openingTemplate: undefined,  // Uses host's default

    supportsMultiVoice: true,
    supportsTwitter: true,
    supportsDocuments: false,
    isEnabled: true,
  },

  documentary: {
    id: 'documentary',
    name: 'Documentary',
    description: 'Deep dive into a single topic with thorough background, analysis, and narrative',
    icon: '🎬',
    color: 'purple',

    defaultDurationMinutes: 15,
    storyCount: { min: 1, max: 1 },
    requiresResearch: true,
    introStyle: 'cinematic',

    segments: [
      {
        id: 'intro',
        name: 'Intro',
        description: 'Cinematic scene-setting introduction',
        defaultDurationSeconds: 45,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'background',
        name: 'Background',
        description: 'Historical context and key players',
        defaultDurationSeconds: 180,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'buildup',
        name: 'Build-up',
        description: 'Events leading to the main story',
        defaultDurationSeconds: 180,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'main_event',
        name: 'The Event',
        description: 'The core story in detail',
        defaultDurationSeconds: 240,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'aftermath',
        name: 'Aftermath',
        description: 'Reactions and consequences',
        defaultDurationSeconds: 120,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'conclusion',
        name: 'Conclusion',
        description: 'Lasting impact and where things stand',
        defaultDurationSeconds: 90,
        required: true,
        hostAssignable: true,
      },
    ],

    recommendedHosts: ['james_noble', 'maya_sterling', 'king_knowledge'],
    chapterStructure: ['Hook', 'Background', 'Build-up', 'The Event', 'Aftermath', 'Conclusion'],
    openingTemplate: 'In the world of {topic_context}...',

    supportsMultiVoice: false,  // Documentary typically uses one narrator
    supportsTwitter: true,
    supportsDocuments: true,
    isEnabled: true,
  },

  breaking: {
    id: 'breaking',
    name: 'Breaking News',
    description: 'Urgent single-story coverage for developing situations',
    icon: '🚨',
    color: 'red',

    defaultDurationMinutes: 3,
    storyCount: { min: 1, max: 1 },
    requiresResearch: false,  // Producer provides the story directly
    introStyle: 'urgent',

    segments: [
      {
        id: 'alert',
        name: 'Breaking Alert',
        description: 'Urgent attention-grabbing opening',
        defaultDurationSeconds: 15,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'story',
        name: 'The Story',
        description: 'What we know so far',
        defaultDurationSeconds: 120,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'developing',
        name: 'Developing',
        description: 'What to watch for, more updates coming',
        defaultDurationSeconds: 30,
        required: true,
        hostAssignable: true,
      },
    ],

    recommendedHosts: ['maya_sterling', 'marcus_blaze'],
    chapterStructure: ['Alert', 'What We Know', 'Developing'],
    openingTemplate: 'BREAKING NEWS: {headline}',

    supportsMultiVoice: false,
    supportsTwitter: false,  // Too fast for Twitter research
    supportsDocuments: false,
    isEnabled: true,
  },

  interview: {
    id: 'interview',
    name: 'Interview Breakdown',
    description: 'React to and analyze an interview, with clips and commentary',
    icon: '🎙️',
    color: 'green',

    defaultDurationMinutes: 10,
    storyCount: { min: 1, max: 1 },
    requiresResearch: true,
    introStyle: 'conversational',

    segments: [
      {
        id: 'intro',
        name: 'Intro',
        description: 'Set up the interview context',
        defaultDurationSeconds: 45,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'clip_1',
        name: 'First Clip',
        description: 'Most important clip from the interview',
        defaultDurationSeconds: 60,
        required: true,
        hostAssignable: false,  // This is the interview audio
      },
      {
        id: 'analysis_1',
        name: 'Analysis 1',
        description: 'Host reaction to first clip',
        defaultDurationSeconds: 90,
        required: true,
        hostAssignable: true,
      },
      {
        id: 'clip_2',
        name: 'Second Clip',
        description: 'Another notable moment',
        defaultDurationSeconds: 60,
        required: false,
        hostAssignable: false,
      },
      {
        id: 'analysis_2',
        name: 'Analysis 2',
        description: 'Host reaction to second clip',
        defaultDurationSeconds: 90,
        required: false,
        hostAssignable: true,
      },
      {
        id: 'conclusion',
        name: 'Final Thoughts',
        description: 'Overall take on the interview',
        defaultDurationSeconds: 60,
        required: true,
        hostAssignable: true,
      },
    ],

    recommendedHosts: ['king_knowledge', 'devon_sharp', 'tasha_raw'],
    chapterStructure: ['Setup', 'Key Moments', 'Analysis', 'Conclusion'],
    openingTemplate: '{entity_name} just sat down for an interview, and what they said has everyone talking...',

    supportsMultiVoice: true,  // Host + guest clips
    supportsTwitter: true,
    supportsDocuments: false,
    isEnabled: true,
  },
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all enabled show types
 */
export function getEnabledShowTypes(): ShowType[] {
  return Object.values(SHOW_TYPES).filter(st => st.isEnabled)
}

/**
 * Get a show type by ID
 */
export function getShowTypeById(id: string): ShowType | undefined {
  return SHOW_TYPES[id]
}

/**
 * Get required segments for a show type
 */
export function getRequiredSegments(showTypeId: string): ShowSegment[] {
  const showType = SHOW_TYPES[showTypeId]
  if (!showType) return []
  return showType.segments.filter(s => s.required)
}

/**
 * Get segments that can have different hosts assigned
 */
export function getHostAssignableSegments(showTypeId: string): ShowSegment[] {
  const showType = SHOW_TYPES[showTypeId]
  if (!showType) return []
  return showType.segments.filter(s => s.hostAssignable)
}

/**
 * Calculate total duration for a show
 */
export function calculateShowDuration(
  showTypeId: string,
  segmentOverrides?: Record<string, number>
): number {
  const showType = SHOW_TYPES[showTypeId]
  if (!showType) return 0

  return showType.segments.reduce((total, segment) => {
    if (!segment.required && !segmentOverrides?.[segment.id]) {
      return total
    }
    const duration = segmentOverrides?.[segment.id] || segment.defaultDurationSeconds
    return total + duration
  }, 0)
}

/**
 * Get the best host for a show type
 */
export function getDefaultHostForShowType(showTypeId: string): string {
  const showType = SHOW_TYPES[showTypeId]
  if (!showType || showType.recommendedHosts.length === 0) {
    return 'james_noble'  // Fallback
  }
  return showType.recommendedHosts[0]
}

/**
 * Check if a show type supports a feature
 */
export function showTypeSupportsFeature(
  showTypeId: string,
  feature: 'multiVoice' | 'twitter' | 'documents'
): boolean {
  const showType = SHOW_TYPES[showTypeId]
  if (!showType) return false

  switch (feature) {
    case 'multiVoice':
      return showType.supportsMultiVoice
    case 'twitter':
      return showType.supportsTwitter
    case 'documents':
      return showType.supportsDocuments
    default:
      return false
  }
}

/**
 * Get show type colors for UI
 */
export const SHOW_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  daily: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
  },
  documentary: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-500',
    border: 'border-purple-500/20',
  },
  breaking: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/20',
  },
  interview: {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    border: 'border-green-500/20',
  },
}
