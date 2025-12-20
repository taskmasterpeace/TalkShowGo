/**
 * HOSTS MODULE
 *
 * Export all host-related functionality
 */

export * from './types'

import {
  HostPersonality,
  HOSTS,
  selectHostForFormat,
  selectHostsForDebate,
  selectHostsForPanel,
} from './types'

/**
 * Get a host by their slug/ID
 */
export function getHostBySlug(slug: string): HostPersonality | null {
  return HOSTS[slug] || null
}

/**
 * Get all hosts as an array
 */
export function getAllHosts(): HostPersonality[] {
  return Object.values(HOSTS)
}

// ============================================
// HOST ASSIGNMENT FOR SHOW FORMATS
// ============================================

export interface ShowCast {
  format: string
  hosts: HostPersonality[]
  roles: Record<string, string>  // hostId -> role description
}

/**
 * Assign hosts to a show based on format
 */
export function assignHostsToShow(format: string, options?: {
  preferredTone?: string
  hostCount?: number
}): ShowCast {
  switch (format) {
    case 'news_bulletin':
    case 'news_with_opinion':
      return {
        format,
        hosts: [selectHostForFormat(format, options?.preferredTone)],
        roles: { [selectHostForFormat(format).id]: 'Anchor' },
      }

    case 'talk_show_debate':
      const [host1, host2] = selectHostsForDebate()
      return {
        format,
        hosts: [host1, host2],
        roles: {
          [host1.id]: 'Side A Advocate',
          [host2.id]: 'Side B Advocate',
        },
      }

    case 'talk_show_panel':
      const panelHosts = selectHostsForPanel(options?.hostCount || 3)
      const panelRoles: Record<string, string> = {}
      panelHosts.forEach((host, i) => {
        panelRoles[host.id] = i === 0 ? 'Moderator' : `Panelist ${i}`
      })
      return {
        format,
        hosts: panelHosts,
        roles: panelRoles,
      }

    case 'interview':
      return {
        format,
        hosts: [HOSTS.maya_sterling],  // Good interviewer
        roles: { [HOSTS.maya_sterling.id]: 'Interviewer' },
      }

    case 'narrative_story':
    case 'deep_dive':
      return {
        format,
        hosts: [HOSTS.james_noble],  // Documentary narrator
        roles: { [HOSTS.james_noble.id]: 'Narrator' },
      }

    case 'hot_take':
      return {
        format,
        hosts: [HOSTS.marcus_blaze],
        roles: { [HOSTS.marcus_blaze.id]: 'Host' },
      }

    case 'recap':
      return {
        format,
        hosts: [HOSTS.dj_momentum],
        roles: { [HOSTS.dj_momentum.id]: 'Host' },
      }

    case 'prediction':
      return {
        format,
        hosts: [HOSTS.marcus_blaze, HOSTS.king_knowledge],
        roles: {
          [HOSTS.marcus_blaze.id]: 'Bold Predictor',
          [HOSTS.king_knowledge.id]: 'Analysis',
        },
      }

    default:
      return {
        format,
        hosts: [HOSTS.king_knowledge],
        roles: { [HOSTS.king_knowledge.id]: 'Host' },
      }
  }
}

/**
 * Generate opening script based on host personality
 */
export function generateHostOpening(host: HostPersonality, topic: string): string {
  const openers: Record<string, string[]> = {
    maya_sterling: [
      `Let me walk you through what's happening with ${topic}. And trust me, you're going to want to pay attention to this one.`,
      `I've been following ${topic} for a while now, and here's what we know so far...`,
    ],
    marcus_blaze: [
      `Y'all not ready for this conversation about ${topic}! HOWEVER, we're gonna have it anyway!`,
      `Let me be very clear about something regarding ${topic} - I'M HEATED!`,
    ],
    devon_sharp: [
      `So apparently, ${topic} is a thing. *shuffles papers* Let me explain why you should care.`,
      `Wait, wait, wait... we need to talk about ${topic}. And honestly? I'm not even sure where to start.`,
    ],
    tasha_raw: [
      `Alright, let's get into this mess with ${topic}. Y'all been in my comments asking, so here we go!`,
      `${topic}?! The streets is TALKING, and I'm about to break this down for y'all.`,
    ],
    james_noble: [
      `This is the story of ${topic}. A tale that would reshape everything we thought we knew.`,
      `In the world of battle rap, few moments have sparked as much conversation as ${topic}.`,
    ],
    dj_momentum: [
      `Let's GOOOO! We're talking about ${topic} today and it's about to get CRAZY!`,
      `Y'all ready?! We got a LOT to cover with ${topic}!`,
    ],
    king_knowledge: [
      `Now see, when we talk about ${topic}, we gotta understand the history first. If you know, you know.`,
      `${topic}. Real recognize real, and I'm about to give y'all the breakdown.`,
    ],
  }

  const hostOpeners = openers[host.id] || [
    `Let's talk about ${topic}.`,
    `Today we're covering ${topic}.`,
  ]

  return hostOpeners[Math.floor(Math.random() * hostOpeners.length)]
}

/**
 * Generate transition phrase for host
 */
export function generateHostTransition(host: HostPersonality): string {
  const phrases = host.delivery.transitionPhrases
  return phrases[Math.floor(Math.random() * phrases.length)]
}

/**
 * Generate closing for host
 */
export function generateHostClosing(host: HostPersonality, topic: string): string {
  const closings: Record<string, string[]> = {
    maya_sterling: [
      `That's what we know so far about ${topic}. Watch this space - there's more to come.`,
      `Keep your eyes on ${topic}. This story is far from over.`,
    ],
    marcus_blaze: [
      `And I said what I said about ${topic}! Don't @ me!`,
      `That's my take on ${topic}. If you disagree, you're WRONG!`,
    ],
    devon_sharp: [
      `And that's ${topic}. *looks at camera* What a time to be alive.`,
      `So yeah, that's ${topic}. Make of that what you will.`,
    ],
    tasha_raw: [
      `That's the word on ${topic}. I don't got time for the bullsh*t, so that's my take. Periodt.`,
      `Y'all heard it here first about ${topic}. The streets is watching.`,
    ],
    james_noble: [
      `And so, the story of ${topic} continues to unfold. Only time will tell what comes next.`,
      `${topic}. A moment that will be remembered for years to come.`,
    ],
    dj_momentum: [
      `That's what's happening with ${topic}! Stay tuned, we not done yet!`,
      `${topic} - you already KNOW! We'll be back with more!`,
    ],
    king_knowledge: [
      `That's game right there about ${topic}. The culture don't forget.`,
      `${topic}. Real recognize real. Now you know what it is.`,
    ],
  }

  const hostClosings = closings[host.id] || [
    `That's all on ${topic} for now.`,
    `Thanks for joining us for ${topic}.`,
  ]

  return hostClosings[Math.floor(Math.random() * hostClosings.length)]
}
