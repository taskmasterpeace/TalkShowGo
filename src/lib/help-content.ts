/**
 * Help Content Library
 *
 * Contextual help content for all pages in Talk Show Go.
 * Used by the HelpPanel component to provide guidance to users.
 */

export interface PageHelp {
  title: string
  description: string
  steps?: string[]
  tips?: string[]
  quickActions?: {
    label: string
    href: string
    description: string
  }[]
}

export const helpContent: Record<string, PageHelp> = {
  '/': {
    title: 'Command Center',
    description: 'Your dashboard for monitoring the content intelligence pipeline. See real-time stats, recent activity, and quick access to all features.',
    steps: [
      'Check your pipeline status at a glance',
      'View recent activity from all sources',
      'Run the full pipeline to update content',
      'Use quick actions to navigate to key features'
    ],
    tips: [
      'Run the pipeline daily to stay current',
      'Watch for disputed claims that need review',
      'Stories Ready shows content waiting for production'
    ],
    quickActions: [
      { label: 'Create Daily Show', href: '/studio/daily-show', description: 'Generate a new show' },
      { label: 'Add Sources', href: '/outpost', description: 'Add Twitter/YouTube sources' },
      { label: 'View Stories', href: '/nexus', description: 'Review story candidates' }
    ]
  },

  '/studio/daily-show': {
    title: 'Daily Show Generator',
    description: 'Create automated news shows with AI hosts. Select a template, choose a host, pick topics, and generate audio in minutes.',
    steps: [
      'Select a template (defines show structure and segments)',
      'Choose a host (defines voice personality and style)',
      'Pick trending topics (system suggests based on your sources)',
      'Review and edit the generated script',
      'Generate audio with one click'
    ],
    tips: [
      'Use "Specific Date" to create shows for past events',
      'Edit the script before generating audio for best results',
      'James Noble is best for documentary-style content',
      'Marcus Blaze works great for hot takes and controversy'
    ],
    quickActions: [
      { label: 'Manage Templates', href: '/studio/templates', description: 'Create/edit show templates' },
      { label: 'View Hosts', href: '/studio/hosts', description: 'See all available hosts' }
    ]
  },

  '/studio/hosts': {
    title: 'Host Management',
    description: 'Create and customize AI host personalities. Each host has unique voice characteristics, delivery style, and content preferences.',
    steps: [
      'Browse existing hosts and their personality traits',
      'Click a host card to see full personality profile',
      'Use "Build a Host" to create new hosts with AI assistance',
      'Test host voices with sample scripts before using'
    ],
    tips: [
      'Match host personality to your content style',
      'Hot Take hosts work best for controversial topics',
      'Smooth Narrator hosts are ideal for documentaries',
      'Consider voice pace when choosing - fast for news, slow for deep dives'
    ]
  },

  '/studio/templates': {
    title: 'Show Templates',
    description: 'Templates define the structure of your shows. Create templates for different show types like daily news, deep dives, or weekly recaps.',
    steps: [
      'Browse existing templates to understand structure',
      'Click a template to edit its sections',
      'Use placeholders like {headline} and {story_body}',
      'Test templates with the Daily Show generator'
    ],
    tips: [
      'Keep intros short - 2-3 sentences max',
      'Use {transition} between stories for natural flow',
      'Include {twitter_trending} for social engagement',
      'End with a strong {host_closing} for brand recall'
    ]
  },

  '/studio': {
    title: 'Studio Overview',
    description: 'Manage all creative assets: hosts, producers, and workflows. This is your control center for content generation.',
    steps: [
      'Hosts tab: Manage AI personalities that deliver your content',
      'Producers tab: Configure AI research and story selection behavior',
      'Workflows tab: Set up automated pipelines and schedules'
    ],
    tips: [
      'Start with the built-in hosts before creating custom ones',
      'Producers affect what stories get selected, not how they sound',
      'Workflows can run automatically on schedules'
    ]
  },

  '/onboarding': {
    title: 'Create a New Niche',
    description: 'Set up a new content vertical from scratch. Add sources, configure settings, and get your pipeline ready.',
    steps: [
      'Name your niche (e.g., "Battle Rap", "Sports News")',
      'Add Twitter accounts to monitor for news and reactions',
      'Add YouTube channels to track for content',
      'Choose a default host for your shows',
      'Select a template for your show format'
    ],
    tips: [
      'Add at least 10 Twitter sources for best topic detection',
      'Include both news accounts and commentators',
      'Mix official sources with community voices',
      'You can always add more sources later'
    ]
  },

  '/studio/topics': {
    title: 'Topic Management',
    description: 'Manage your content niches. Edit settings, view health, and configure sources for each topic.',
    steps: [
      'View all your topics with health indicators',
      'Click a topic to see details and sources',
      'Edit topic settings like hours_back and entity patterns',
      'Add or remove sources to refine your pipeline'
    ],
    tips: [
      'Green health = active, collecting content',
      'Yellow health = some issues, check sources',
      'Red health = needs attention, sources may be inactive',
      'Higher hours_back means more historical content'
    ]
  },

  '/outpost': {
    title: 'Source Management',
    description: 'Add and manage your Twitter accounts and YouTube channels. These are the sources that feed your intelligence pipeline.',
    steps: [
      'Add Twitter accounts by handle (@username)',
      'Add YouTube channels by name or URL',
      'Set source priority (higher = more important)',
      'Mark sources as official or community'
    ],
    tips: [
      'Official sources are weighted more heavily',
      'Community sources help detect sentiment',
      'Check source health regularly',
      'Remove inactive sources to improve quality'
    ]
  },

  '/nexus': {
    title: 'Story Desk',
    description: 'Review and manage story candidates. This is where detected stories wait for your editorial decisions.',
    steps: [
      'Review auto-detected story candidates',
      'Approve or reject stories for production',
      'Edit story angles and headlines',
      'Send approved stories to the Daily Show'
    ],
    tips: [
      'Stories with higher confidence are usually better',
      'Check the source count - more sources = more reliable',
      'Edit headlines to match your voice',
      'Rejected stories help train the system'
    ]
  },

  '/perimeter': {
    title: 'Source Monitor',
    description: 'Monitor the status and health of all your intelligence sources in real-time.',
    steps: [
      'View source collection status',
      'Check last successful fetch time',
      'Identify sources with errors',
      'Trigger manual source refresh'
    ],
    tips: [
      'Green checkmarks mean healthy sources',
      'Red X means source needs attention',
      'Click refresh to manually update a source',
      'Check rate limits if sources fail repeatedly'
    ]
  }
}

/**
 * Get help content for a specific path
 */
export function getHelpForPath(pathname: string): PageHelp | null {
  // Try exact match first
  if (helpContent[pathname]) {
    return helpContent[pathname]
  }

  // Try parent path
  const parentPath = pathname.split('/').slice(0, -1).join('/')
  if (parentPath && helpContent[parentPath]) {
    return helpContent[parentPath]
  }

  return null
}

/**
 * Get all help topics for search/browse
 */
export function getAllHelpTopics(): { path: string; help: PageHelp }[] {
  return Object.entries(helpContent).map(([path, help]) => ({
    path,
    help
  }))
}
