/**
 * Template Engine
 *
 * Handles placeholder interpolation for show templates.
 * Templates use {placeholder_name} syntax for variable substitution.
 */

import { HOSTS, type HostPersonality } from './hosts/types'

// ============================================
// TYPES
// ============================================

export interface ShowTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  template_type: 'daily' | 'narrative' | 'breaking'
  intro_template: string
  story_template: string
  outro_template: string
  twitter_digest_template: string | null
  default_story_count: number
  default_hours_back: number
  max_duration_minutes: number
  style_tone: string
  include_twitter_digest: boolean
  include_cta: boolean
  preferred_host_slug: string | null
  topic_id: string | null
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface TopicSummary {
  id: string
  headline: string
  summary: string
  source_count: number
  engagement_score: number
  twitter_mentions?: number
}

export interface TwitterDigest {
  trending_topics: { topic: string; mentions: number; sentiment: string }[]
  top_tweets: { author: string; text: string; likes: number }[]
  sentiment_overview: string
  formatted_summary: string
}

export interface TemplateContext {
  show_name: string
  date: string
  host: HostPersonality
  topics: TopicSummary[]
  stories: StoryContent[]
  twitter_digest?: TwitterDigest
}

export interface StoryContent {
  headline: string
  body: string
  twitter_reaction?: string
  call_to_action?: string
}

export interface RenderedShow {
  intro: string
  stories: string[]
  outro: string
  full_script: string
}

// ============================================
// PLACEHOLDER REGISTRY
// ============================================

export const PLACEHOLDERS = {
  // Show info
  show_name: 'Name of the show (e.g., "Battle Rap Daily")',
  date: 'Formatted date (e.g., "December 19th, 2025")',
  topic_count: 'Number of topics/stories in the show',

  // Host info
  host_name: 'Name of the selected host',
  host_opening: 'Host-specific opening phrase',
  host_closing: 'Host-specific closing/sign-off',

  // Story content
  headline: 'Story headline',
  story_body: 'Main story content',
  transition: 'Transition phrase to next segment',
  quote: 'Key quote from the story',

  // Narrative format
  dramatic_hook: 'Dramatic opening hook for narrative stories',
  chapter_title: 'Chapter/section title',
  narrative_content: 'Long-form narrative content',
  conclusion: 'Story conclusion',

  // Twitter
  twitter_trending: 'Trending topics section',
  twitter_reaction: 'Twitter reactions to the story',
  trending_summary: 'Summary of what\'s trending',
  top_tweets: 'Top tweets formatted for reading',

  // Call to action
  call_to_action: 'Prompt to check a source or follow'
} as const

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format date for show scripts
 */
export function formatShowDate(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  return date.toLocaleDateString('en-US', options)
}

/**
 * Get a host by slug
 */
export function getHostBySlug(slug: string): HostPersonality | null {
  return HOSTS[slug] || null
}

/**
 * Get default host (Algorithm Institute style)
 */
export function getDefaultHost(): HostPersonality {
  // Find James Noble (documentary narrator) or fall back to first host
  return HOSTS['james_noble'] || Object.values(HOSTS)[0]
}

/**
 * Generate host-specific opening
 */
export function generateHostOpening(host: HostPersonality): string {
  return host.delivery.openingStyle
}

/**
 * Generate host-specific closing
 */
export function generateHostClosing(host: HostPersonality): string {
  return host.delivery.closingStyle
}

/**
 * Get a random transition phrase for the host
 */
export function getHostTransition(host: HostPersonality): string {
  const transitions = host.delivery.transitionPhrases
  return transitions[Math.floor(Math.random() * transitions.length)]
}

/**
 * Get a random catchphrase for the host
 */
export function getHostCatchphrase(host: HostPersonality): string {
  const catchphrases = host.delivery.catchphrases
  return catchphrases[Math.floor(Math.random() * catchphrases.length)]
}

// ============================================
// TEMPLATE INTERPOLATION
// ============================================

/**
 * Interpolate placeholders in a template string
 *
 * @param template - Template string with {placeholder} syntax
 * @param variables - Object with placeholder values
 * @returns Interpolated string
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key]
    if (value === undefined) {
      // Leave unmatched placeholders as-is (for debugging)
      console.warn(`[TemplateEngine] Unmatched placeholder: ${key}`)
      return ''
    }
    return String(value)
  })
}

/**
 * Build context variables from template context
 */
export function buildVariables(context: TemplateContext): Record<string, string> {
  const { host, topics, stories, twitter_digest } = context

  return {
    // Show info
    show_name: context.show_name,
    date: context.date,
    topic_count: String(topics.length),

    // Host info
    host_name: host.name,
    host_opening: generateHostOpening(host),
    host_closing: generateHostClosing(host),

    // Twitter (if available)
    twitter_trending: twitter_digest?.formatted_summary || '',
    trending_summary: twitter_digest?.trending_topics
      .slice(0, 3)
      .map(t => `${t.topic} (${t.sentiment})`)
      .join(', ') || '',
    top_tweets: twitter_digest?.top_tweets
      .slice(0, 3)
      .map(t => `@${t.author} said: "${t.text}" (${t.likes} likes)`)
      .join('\n') || '',

    // Defaults for story-specific (overridden per story)
    headline: '',
    story_body: '',
    transition: getHostTransition(host),
    twitter_reaction: '',
    call_to_action: '',
    quote: '',
    dramatic_hook: '',
    chapter_title: '',
    narrative_content: '',
    conclusion: ''
  }
}

// ============================================
// MAIN RENDER FUNCTION
// ============================================

/**
 * Render a complete show from a template and context
 */
export function renderTemplate(
  template: ShowTemplate,
  context: TemplateContext
): RenderedShow {
  const baseVariables = buildVariables(context)

  // Render intro
  const intro = interpolateTemplate(template.intro_template, baseVariables)

  // Render each story
  const stories = context.stories.map((story, index) => {
    const storyVariables = {
      ...baseVariables,
      headline: story.headline,
      story_body: story.body,
      transition: getHostTransition(context.host),
      twitter_reaction: story.twitter_reaction || '',
      call_to_action: story.call_to_action || '',
      // For narrative format
      chapter_title: `Part ${index + 1}`,
      narrative_content: story.body,
      quote: story.twitter_reaction || ''
    }
    return interpolateTemplate(template.story_template, storyVariables)
  })

  // Render outro
  const outro = interpolateTemplate(template.outro_template, {
    ...baseVariables,
    conclusion: context.stories.length > 0
      ? `That wraps up our coverage of ${context.stories[0].headline}.`
      : 'That wraps up today\'s show.'
  })

  // Combine into full script
  const full_script = [
    intro,
    '',
    ...stories.flatMap(s => [s, '']),
    outro
  ].join('\n')

  return {
    intro,
    stories,
    outro,
    full_script
  }
}

// ============================================
// PREVIEW FUNCTIONS
// ============================================

/**
 * Generate a preview of a template with sample data
 */
export function previewTemplate(template: ShowTemplate): RenderedShow {
  const sampleHost = getDefaultHost()
  const sampleContext: TemplateContext = {
    show_name: 'Battle Rap Daily',
    date: formatShowDate(),
    host: sampleHost,
    topics: [
      { id: '1', headline: 'Sample Story', summary: 'This is a sample', source_count: 3, engagement_score: 100 }
    ],
    stories: [
      {
        headline: 'Sample Story: What Happened This Week',
        body: 'This is sample content for previewing the template. The actual story content will appear here when you generate a real show.',
        twitter_reaction: '@SampleUser said: "This is fire!" (500 likes)',
        call_to_action: 'Check out @SampleAccount for more details.'
      }
    ],
    twitter_digest: {
      trending_topics: [
        { topic: 'Sample Topic', mentions: 50, sentiment: 'positive' }
      ],
      top_tweets: [
        { author: 'SampleUser', text: 'This is a sample tweet', likes: 100 }
      ],
      sentiment_overview: 'mostly positive',
      formatted_summary: 'People are talking about Sample Topic today.'
    }
  }

  return renderTemplate(template, sampleContext)
}

/**
 * Validate a template has all required placeholders
 */
export function validateTemplate(template: Partial<ShowTemplate>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!template.intro_template?.trim()) {
    errors.push('Intro template is required')
  }
  if (!template.story_template?.trim()) {
    errors.push('Story template is required')
  }
  if (!template.outro_template?.trim()) {
    errors.push('Outro template is required')
  }

  // Check for common placeholders
  const introPlaceholders: string[] = template.intro_template?.match(/\{(\w+)\}/g) || []
  if (!introPlaceholders.includes('{show_name}')) {
    errors.push('Intro should include {show_name} placeholder')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
