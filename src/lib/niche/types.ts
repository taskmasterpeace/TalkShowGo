/**
 * NICHE ONBOARDING & HEALTH SYSTEM
 *
 * Each niche (topic) needs certain things to function:
 * - Sources (Twitter, YouTube, RSS)
 * - Entities (people, events, orgs)
 * - Web resources for research
 * - API keys configured
 *
 * This system tracks what's working and what's missing.
 */

export interface NicheRequirement {
  id: string
  name: string
  description: string
  category: 'sources' | 'data' | 'api' | 'config'
  required: boolean  // Is this mandatory?
  status: 'healthy' | 'degraded' | 'failing' | 'missing'
  lastChecked?: Date
  details?: string
}

export interface NicheHealth {
  topicId: string
  topicName: string
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'not_configured'
  score: number  // 0-100
  requirements: NicheRequirement[]
  lastFullCheck: Date
}

export interface LayerHealth {
  layer: string
  name: string
  status: 'online' | 'degraded' | 'offline' | 'not_configured'
  lastSuccess?: Date
  lastError?: string
  metrics: {
    successRate: number  // 0-1
    avgResponseTime: number  // ms
    itemsProcessed: number
  }
}

// ============================================
// NICHE REQUIREMENTS TEMPLATE
// ============================================

export const NICHE_REQUIREMENTS: Omit<NicheRequirement, 'status' | 'lastChecked'>[] = [
  // SOURCES
  {
    id: 'twitter_sources',
    name: 'Twitter Sources',
    description: 'At least 5 seed Twitter accounts to monitor',
    category: 'sources',
    required: true,
  },
  {
    id: 'youtube_channels',
    name: 'YouTube Channels',
    description: 'At least 3 trusted YouTube channels',
    category: 'sources',
    required: true,
  },
  {
    id: 'rss_feeds',
    name: 'RSS Feeds',
    description: 'At least 1 RSS feed for web content',
    category: 'sources',
    required: false,
  },
  {
    id: 'official_accounts',
    name: 'Official Accounts',
    description: 'At least 1 verified/official account for the niche',
    category: 'sources',
    required: true,
  },

  // DATA
  {
    id: 'entities_seeded',
    name: 'Entities Seeded',
    description: 'At least 10 known entities (people, events, orgs)',
    category: 'data',
    required: true,
  },
  {
    id: 'credibility_profile',
    name: 'Credibility Profile',
    description: 'Thresholds set for source credibility',
    category: 'data',
    required: true,
  },
  {
    id: 'web_resources',
    name: 'Web Resources',
    description: 'Known websites for research (e.g., RapGrid, VerseTracker)',
    category: 'data',
    required: false,
  },

  // API KEYS
  {
    id: 'twitter_api',
    name: 'Twitter API',
    description: 'TwitterAPI.io key configured and working',
    category: 'api',
    required: true,
  },
  {
    id: 'youtube_api',
    name: 'YouTube API',
    description: 'YouTube Data API key configured',
    category: 'api',
    required: true,
  },
  {
    id: 'openai_api',
    name: 'OpenAI API',
    description: 'OpenAI API key for extraction/analysis',
    category: 'api',
    required: true,
  },

  // CONFIG
  {
    id: 'database_connected',
    name: 'Database',
    description: 'PostgreSQL database is connected',
    category: 'config',
    required: true,
  },
]

// ============================================
// LAYER DEFINITIONS
// ============================================

export const PIPELINE_LAYERS = [
  {
    id: 'twitter',
    name: 'Twitter Layer',
    description: 'Fetches tweets from TwitterAPI.io',
    phase: 'PERIMETER',
  },
  {
    id: 'youtube',
    name: 'YouTube Layer',
    description: 'Fetches videos from YouTube API',
    phase: 'RELAY/RECON',
  },
  {
    id: 'extraction',
    name: 'Extraction Layer',
    description: 'Extracts entities and claims using AI',
    phase: 'EXTRACTION',
  },
  {
    id: 'audit',
    name: 'Audit Layer',
    description: 'Calculates consensus and credibility',
    phase: 'AUDIT',
  },
  {
    id: 'web',
    name: 'Web Research Layer',
    description: 'Searches web for verification',
    phase: 'INTEL',
  },
  {
    id: 'database',
    name: 'Database Layer',
    description: 'PostgreSQL/Supabase connection',
    phase: 'ALL',
  },
]

// ============================================
// HELPER FUNCTIONS
// ============================================

export function calculateOverallHealth(requirements: NicheRequirement[]): {
  status: NicheHealth['overallStatus']
  score: number
} {
  const required = requirements.filter(r => r.required)
  const optional = requirements.filter(r => !r.required)

  const requiredHealthy = required.filter(r => r.status === 'healthy').length
  const requiredDegraded = required.filter(r => r.status === 'degraded').length
  const requiredFailing = required.filter(r => r.status === 'failing' || r.status === 'missing').length

  const optionalHealthy = optional.filter(r => r.status === 'healthy').length

  // Score calculation
  // Required: 80% of score
  // Optional: 20% of score
  const requiredScore = (requiredHealthy / required.length) * 80
  const optionalScore = optional.length > 0
    ? (optionalHealthy / optional.length) * 20
    : 20  // Full optional score if none defined

  const score = Math.round(requiredScore + optionalScore)

  // Status determination
  let status: NicheHealth['overallStatus']
  if (requiredFailing === required.length) {
    status = 'not_configured'
  } else if (requiredFailing > 0) {
    status = 'critical'
  } else if (requiredDegraded > 0) {
    status = 'degraded'
  } else {
    status = 'healthy'
  }

  return { status, score }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
    case 'online':
      return 'success'
    case 'degraded':
      return 'warning'
    case 'failing':
    case 'offline':
    case 'critical':
      return 'destructive'
    case 'missing':
    case 'not_configured':
      return 'secondary'
    default:
      return 'secondary'
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'healthy':
    case 'online':
      return '✓'
    case 'degraded':
      return '!'
    case 'failing':
    case 'offline':
    case 'critical':
      return '✗'
    case 'missing':
    case 'not_configured':
      return '?'
    default:
      return '?'
  }
}
