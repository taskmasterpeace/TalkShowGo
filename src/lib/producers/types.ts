/**
 * PRODUCER TYPES & SHOW FORMATS
 *
 * Producers are AI personalities with different approaches to content creation.
 * Each has unique attributes that affect how they gather info and what they produce.
 */

// ============================================
// SHOW FORMATS - The End Product
// ============================================

export type ShowFormat =
  | 'news_bulletin'      // Single host, just facts, no opinion, quick
  | 'news_with_opinion'  // Single host, facts + their take
  | 'talk_show_debate'   // Multiple hosts debating opposing views
  | 'talk_show_panel'    // Multiple hosts discussing (not debating)
  | 'interview'          // Host + Guest Q&A
  | 'narrative_story'    // Compelling storytelling with arc
  | 'deep_dive'          // Long-form investigation
  | 'hot_take'           // Quick opinion piece, controversial
  | 'recap'              // Summary of events
  | 'prediction'         // Speculation about future

export interface ShowFormatConfig {
  id: ShowFormat
  name: string
  description: string
  hostCount: number | 'variable'
  requiresOpinion: boolean
  requiresConflict: boolean
  minDurationMinutes: number
  maxDurationMinutes: number
  structure: string[]  // Segments/beats of the show
  toneOptions: string[]
}

export const SHOW_FORMATS: Record<ShowFormat, ShowFormatConfig> = {
  news_bulletin: {
    id: 'news_bulletin',
    name: 'News Bulletin',
    description: 'Quick, factual news delivery. No opinion, just the facts.',
    hostCount: 1,
    requiresOpinion: false,
    requiresConflict: false,
    minDurationMinutes: 1,
    maxDurationMinutes: 5,
    structure: ['headline', 'key_facts', 'sources', 'whats_next'],
    toneOptions: ['professional', 'urgent', 'casual'],
  },

  news_with_opinion: {
    id: 'news_with_opinion',
    name: 'News & Opinion',
    description: 'News delivery followed by host analysis and take.',
    hostCount: 1,
    requiresOpinion: true,
    requiresConflict: false,
    minDurationMinutes: 3,
    maxDurationMinutes: 10,
    structure: ['headline', 'key_facts', 'context', 'host_take', 'conclusion'],
    toneOptions: ['analytical', 'passionate', 'skeptical', 'excited'],
  },

  talk_show_debate: {
    id: 'talk_show_debate',
    name: 'Talk Show Debate',
    description: 'Multiple hosts with opposing views debate the topic.',
    hostCount: 'variable',  // 2-4 hosts
    requiresOpinion: true,
    requiresConflict: true,  // NEEDS conflicting viewpoints
    minDurationMinutes: 10,
    maxDurationMinutes: 45,
    structure: ['intro', 'topic_setup', 'side_a_argument', 'side_b_argument', 'rebuttal', 'audience_perspective', 'conclusion'],
    toneOptions: ['heated', 'respectful', 'comedic', 'intense'],
  },

  talk_show_panel: {
    id: 'talk_show_panel',
    name: 'Panel Discussion',
    description: 'Multiple hosts discuss and share perspectives (not debating).',
    hostCount: 'variable',
    requiresOpinion: true,
    requiresConflict: false,
    minDurationMinutes: 15,
    maxDurationMinutes: 60,
    structure: ['intro', 'topic_overview', 'round_robin_takes', 'deep_discussion', 'predictions', 'wrap_up'],
    toneOptions: ['casual', 'analytical', 'fun', 'serious'],
  },

  interview: {
    id: 'interview',
    name: 'Interview',
    description: 'Host interviews a guest with prepared questions.',
    hostCount: 2,  // Host + Guest
    requiresOpinion: false,
    requiresConflict: false,
    minDurationMinutes: 10,
    maxDurationMinutes: 60,
    structure: ['intro_guest', 'background', 'main_topic', 'rapid_fire', 'closing'],
    toneOptions: ['conversational', 'probing', 'friendly', 'challenging'],
  },

  narrative_story: {
    id: 'narrative_story',
    name: 'Narrative Story',
    description: 'Compelling storytelling with dramatic arc. Our DEFAULT for Battle Rap.',
    hostCount: 1,
    requiresOpinion: false,
    requiresConflict: false,
    minDurationMinutes: 5,
    maxDurationMinutes: 20,
    structure: ['hook', 'setup', 'rising_action', 'climax', 'resolution', 'whats_next'],
    toneOptions: ['dramatic', 'suspenseful', 'inspirational', 'documentary'],
  },

  deep_dive: {
    id: 'deep_dive',
    name: 'Deep Dive Investigation',
    description: 'Long-form investigative piece that explores all angles.',
    hostCount: 1,
    requiresOpinion: false,
    requiresConflict: false,
    minDurationMinutes: 15,
    maxDurationMinutes: 45,
    structure: ['teaser', 'background', 'investigation', 'evidence', 'analysis', 'conclusion', 'implications'],
    toneOptions: ['investigative', 'serious', 'revelatory'],
  },

  hot_take: {
    id: 'hot_take',
    name: 'Hot Take',
    description: 'Quick, spicy opinion piece. Controversial and engaging.',
    hostCount: 1,
    requiresOpinion: true,
    requiresConflict: false,
    minDurationMinutes: 1,
    maxDurationMinutes: 5,
    structure: ['bold_statement', 'reasoning', 'evidence', 'challenge_to_audience'],
    toneOptions: ['provocative', 'confident', 'controversial'],
  },

  recap: {
    id: 'recap',
    name: 'Recap',
    description: 'Summary of recent events. Catch-up content.',
    hostCount: 1,
    requiresOpinion: false,
    requiresConflict: false,
    minDurationMinutes: 3,
    maxDurationMinutes: 15,
    structure: ['overview', 'event_1', 'event_2', 'event_n', 'whats_coming'],
    toneOptions: ['informative', 'energetic', 'comprehensive'],
  },

  prediction: {
    id: 'prediction',
    name: 'Prediction Show',
    description: 'Speculation and predictions about upcoming events.',
    hostCount: 'variable',
    requiresOpinion: true,
    requiresConflict: false,
    minDurationMinutes: 5,
    maxDurationMinutes: 30,
    structure: ['event_preview', 'breakdown', 'prediction', 'reasoning', 'bold_call'],
    toneOptions: ['analytical', 'fun', 'confident'],
  },
}

// ============================================
// PRODUCER ARCHETYPES
// ============================================

export type ProducerArchetype =
  | 'drama_hunter'       // Finds the messy, controversial stuff
  | 'fact_checker'       // Verifies everything, skeptical
  | 'deep_diver'         // Goes down rabbit holes, thorough
  | 'speed_demon'        // Quick turnaround, breaking news
  | 'storyteller'        // Focuses on narrative and engagement
  | 'community_pulse'    // Monitors sentiment, what people think

export interface ProducerProfile {
  id: string
  archetype: ProducerArchetype
  name: string
  description: string

  // Behavioral attributes (0-1 scale)
  attributes: {
    verificationRigor: number      // How much they fact-check (0=trusts sources, 1=verifies everything)
    rabbitHoleDepth: number        // How deep they go (0=surface, 1=exhaustive)
    speedVsThoroughness: number    // Trade-off (0=fast, 1=thorough)
    controversyAffinity: number    // Attraction to drama (0=avoids, 1=seeks)
    opinionInclusion: number       // How much opinion they add (0=just facts, 1=heavy opinion)
    sourceVariety: number          // How many sources they use (0=few, 1=many)
    webResearchIntensity: number   // How much they use web (0=minimal, 1=extensive)
    commentAnalysis: number        // How much they look at comments/replies (0=never, 1=always)
  }

  // Preferred tools
  preferredTools: string[]

  // Show formats this producer is good at
  bestForFormats: ShowFormat[]

  // Default search behaviors
  searchBehavior: {
    alwaysCheckWeb: boolean
    checkComments: boolean
    crossReferenceTwitter: boolean
    verifyWithOfficialSources: boolean
    lookForContrast: boolean
    maxSourcesBeforeDecision: number
  }
}

export const PRODUCER_ARCHETYPES: Record<ProducerArchetype, ProducerProfile> = {
  drama_hunter: {
    id: 'drama_hunter',
    archetype: 'drama_hunter',
    name: 'The Drama Hunter',
    description: 'Lives for the messy stuff. Finds conflict, beef, and controversy. Great for engagement but needs oversight for accuracy.',

    attributes: {
      verificationRigor: 0.3,        // Doesn't verify much
      rabbitHoleDepth: 0.6,          // Moderate depth
      speedVsThoroughness: 0.3,      // Prefers speed
      controversyAffinity: 0.95,     // LOVES drama
      opinionInclusion: 0.7,         // Heavy on takes
      sourceVariety: 0.4,            // Fewer sources
      webResearchIntensity: 0.5,     // Moderate web use
      commentAnalysis: 0.8,          // Loves reading comments
    },

    preferredTools: ['twitter_search', 'twitter_comments', 'youtube_comments'],
    bestForFormats: ['talk_show_debate', 'hot_take', 'news_with_opinion'],

    searchBehavior: {
      alwaysCheckWeb: false,
      checkComments: true,
      crossReferenceTwitter: true,
      verifyWithOfficialSources: false,
      lookForContrast: true,  // Wants the other side for drama
      maxSourcesBeforeDecision: 3,
    },
  },

  fact_checker: {
    id: 'fact_checker',
    archetype: 'fact_checker',
    name: 'The Fact Checker',
    description: 'Skeptical and thorough. Verifies everything before reporting. Slower but highly accurate.',

    attributes: {
      verificationRigor: 0.95,       // Verifies EVERYTHING
      rabbitHoleDepth: 0.7,          // Goes deep for verification
      speedVsThoroughness: 0.9,      // Very thorough
      controversyAffinity: 0.2,      // Avoids unverified drama
      opinionInclusion: 0.1,         // Sticks to facts
      sourceVariety: 0.9,            // Uses many sources
      webResearchIntensity: 0.9,     // Heavy web research
      commentAnalysis: 0.3,          // Light on comments
    },

    preferredTools: ['web_search', 'official_sources', 'rap_grid', 'verse_tracker'],
    bestForFormats: ['news_bulletin', 'deep_dive', 'narrative_story'],

    searchBehavior: {
      alwaysCheckWeb: true,
      checkComments: false,
      crossReferenceTwitter: true,
      verifyWithOfficialSources: true,
      lookForContrast: true,  // For balanced reporting
      maxSourcesBeforeDecision: 8,
    },
  },

  deep_diver: {
    id: 'deep_diver',
    archetype: 'deep_diver',
    name: 'The Deep Diver',
    description: 'Goes down every rabbit hole. Finds connections others miss. Can get lost but finds gold.',

    attributes: {
      verificationRigor: 0.6,        // Moderate verification
      rabbitHoleDepth: 0.95,         // MAXIMUM DEPTH
      speedVsThoroughness: 0.95,     // Very slow, very thorough
      controversyAffinity: 0.5,      // Neutral on drama
      opinionInclusion: 0.4,         // Some analysis
      sourceVariety: 0.95,           // Uses everything
      webResearchIntensity: 0.9,     // Heavy web
      commentAnalysis: 0.9,          // Deep in comments
    },

    preferredTools: ['twitter_threads', 'twitter_comments', 'youtube_comments', 'web_search', 'verse_tracker'],
    bestForFormats: ['deep_dive', 'narrative_story', 'interview'],

    searchBehavior: {
      alwaysCheckWeb: true,
      checkComments: true,
      crossReferenceTwitter: true,
      verifyWithOfficialSources: true,
      lookForContrast: true,
      maxSourcesBeforeDecision: 15,  // Won't stop
    },
  },

  speed_demon: {
    id: 'speed_demon',
    archetype: 'speed_demon',
    name: 'The Speed Demon',
    description: 'Breaking news specialist. Gets it out fast. Trades some accuracy for speed.',

    attributes: {
      verificationRigor: 0.4,        // Quick verification
      rabbitHoleDepth: 0.2,          // Surface level
      speedVsThoroughness: 0.1,      // FAST
      controversyAffinity: 0.6,      // Breaking news often controversial
      opinionInclusion: 0.2,         // Mostly facts
      sourceVariety: 0.3,            // First credible source wins
      webResearchIntensity: 0.3,     // Quick web check
      commentAnalysis: 0.1,          // No time for comments
    },

    preferredTools: ['twitter_search', 'rap_grid'],
    bestForFormats: ['news_bulletin', 'hot_take'],

    searchBehavior: {
      alwaysCheckWeb: false,
      checkComments: false,
      crossReferenceTwitter: false,
      verifyWithOfficialSources: false,  // One good source enough
      lookForContrast: false,
      maxSourcesBeforeDecision: 2,
    },
  },

  storyteller: {
    id: 'storyteller',
    archetype: 'storyteller',
    name: 'The Storyteller',
    description: 'Crafts compelling narratives. Focuses on the arc, the drama, the human element.',

    attributes: {
      verificationRigor: 0.6,        // Decent verification
      rabbitHoleDepth: 0.7,          // Goes deep for story
      speedVsThoroughness: 0.7,      // Takes time
      controversyAffinity: 0.6,      // Drama is good for story
      opinionInclusion: 0.5,         // Narrative voice
      sourceVariety: 0.6,            // Multiple perspectives
      webResearchIntensity: 0.7,     // Background research
      commentAnalysis: 0.5,          // Checks for reactions
    },

    preferredTools: ['web_search', 'verse_tracker', 'youtube_search', 'twitter_search'],
    bestForFormats: ['narrative_story', 'deep_dive', 'interview'],

    searchBehavior: {
      alwaysCheckWeb: true,
      checkComments: true,
      crossReferenceTwitter: true,
      verifyWithOfficialSources: true,
      lookForContrast: true,  // Multiple sides = better story
      maxSourcesBeforeDecision: 6,
    },
  },

  community_pulse: {
    id: 'community_pulse',
    archetype: 'community_pulse',
    name: 'The Community Pulse',
    description: 'Monitors what the community thinks. Expert at sentiment analysis and fan reactions.',

    attributes: {
      verificationRigor: 0.4,        // Trusts community consensus
      rabbitHoleDepth: 0.6,          // Moderate depth
      speedVsThoroughness: 0.5,      // Balanced
      controversyAffinity: 0.7,      // Controversial = engagement
      opinionInclusion: 0.6,         // Reports community opinion
      sourceVariety: 0.8,            // Many voices
      webResearchIntensity: 0.4,     // Less web, more social
      commentAnalysis: 0.95,         // LIVES in comments
    },

    preferredTools: ['twitter_comments', 'youtube_comments', 'twitter_search', 'twitter_polls'],
    bestForFormats: ['talk_show_panel', 'recap', 'prediction', 'hot_take'],

    searchBehavior: {
      alwaysCheckWeb: false,
      checkComments: true,
      crossReferenceTwitter: true,
      verifyWithOfficialSources: false,
      lookForContrast: true,  // Wants all opinions
      maxSourcesBeforeDecision: 10,
    },
  },
}

// ============================================
// BATTLE RAP SPECIFIC RESOURCES
// ============================================

export const BATTLE_RAP_RESOURCES = {
  // Quick-access websites for this niche
  websites: {
    lets_talk_battle_rap: {
      url: 'https://www.letstalkbattlerap.com',
      purpose: 'News, articles, interviews',
      searchable: true,
    },
    rap_grid: {
      url: 'https://www.rapgrid.com',
      purpose: 'Battle history, PPV info, event archives',
      searchable: true,
    },
    verse_tracker: {
      url: 'https://versetracker.com',
      purpose: 'Battler profiles, battle history, who vs who',
      searchable: true,
    },
  },

  // Official accounts to always check
  officialAccounts: {
    twitter: ['@urltv', '@TheRealSMACK'],
    youtube: ['URLtv'],
  },

  // Key entities to track
  majorLeagues: ['URL', 'KOTD', 'RBE'],
  majorEvents: ['Summer Madness', 'NOME', 'Volume', 'Born Legacy'],
}
