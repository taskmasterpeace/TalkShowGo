/**
 * USER MANUAL
 *
 * Complete documentation for Talk Show Go organized into chapters.
 * This content is rendered in the /guide/manual page and used by the
 * help assistant for answering questions.
 */

// ============================================
// TYPES
// ============================================

export interface ManualSection {
  id: string
  title: string
  content: string
}

export interface ManualChapter {
  id: string
  title: string
  description: string
  icon: string
  sections: ManualSection[]
}

// ============================================
// MANUAL CONTENT
// ============================================

export const USER_MANUAL: ManualChapter[] = [
  // ============================================
  // CHAPTER 1: GETTING STARTED
  // ============================================
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Introduction to Talk Show Go and initial setup',
    icon: '🚀',
    sections: [
      {
        id: 'what-is-ck',
        title: 'What is Talk Show Go?',
        content: `
# What is Talk Show Go?

Talk Show Go is an **intelligence-driven content generation system** that automates the process of monitoring sources, extracting information, and creating audio content.

## Core Capabilities

- **Monitor sources** - Track Twitter accounts, YouTube channels, and web content
- **Extract entities** - Automatically identify people, organizations, and topics
- **Detect stories** - Find trending topics by cross-referencing multiple sources
- **Generate content** - Create scripts and audio using AI voices

## The Content Pipeline

Content flows through 8 phases, each with a military-inspired codename:

1. **OUTPOST** - Topic setup and source configuration
2. **PERIMETER** - Signal monitoring (scanning sources)
3. **EXTRACTION** - Entity detection from content
4. **AUDIT** - Credibility scoring and verification
5. **TRIBUNAL** - Community nominations and voting
6. **NEXUS** - Story assembly from signals
7. **SANCTION** - Script generation and approval
8. **SIGNAL** - Export and distribution

## Key Concepts

- **Topic** - A niche you're covering (e.g., "Battle Rap")
- **Entity** - A person, organization, or concept you're tracking
- **Signal** - A piece of content that might be newsworthy
- **Story** - A narrative assembled from multiple signals
        `,
      },
      {
        id: 'first-topic',
        title: 'Creating Your First Topic',
        content: `
# Creating Your First Topic

A **Topic** represents a niche or subject area you want to cover. For example, "Battle Rap" or "Tech News".

## Steps to Create a Topic

1. **Go to Onboarding** (/onboarding) or **OUTPOST** (/outpost)
2. Click **"Create New Topic"**
3. Enter a name and description
4. Add initial entities you want to track
5. Add story patterns to detect

## Topic Configuration

Each topic has an **Intel Config** that controls:

- **hours_back** - How far back to look for content (default: 48 hours)
- **min_sources** - Minimum sources needed to confirm a story (default: 2)
- **known_entities** - People, organizations, and terms to track
- **story_patterns** - Phrases that indicate news (e.g., "vs", "announces", "responds")

## Example: Battle Rap Topic

\`\`\`json
{
  "name": "Battle Rap",
  "hours_back": 48,
  "min_sources": 2,
  "known_entities": ["URL", "KOTD", "Cassidy", "Loaded Lux"],
  "story_patterns": ["vs", "battle", "announces", "retirement"]
}
\`\`\`
        `,
      },
      {
        id: 'adding-sources',
        title: 'Adding Sources',
        content: `
# Adding Sources

Sources are where Talk Show Go looks for signals. There are two main types:

## Twitter Sources

Twitter accounts are monitored for tweets, replies, and engagement.

**To add a Twitter source:**
1. Go to **OUTPOST** > Your Topic > **Twitter** tab
2. Click **"Add Account"**
3. Enter the Twitter handle (e.g., @urltv)
4. Set the account type (league, blogger, personality)

**Account Types:**
- **League** - Official accounts (URL, KOTD, RBE)
- **Blogger** - Commentary channels (JayBlac, HHIR)
- **Personality** - Individual figures in your niche

## YouTube Channels

YouTube channels are monitored for new videos and transcripts.

**To add a YouTube channel:**
1. Go to **OUTPOST** > Your Topic > **YouTube** tab
2. Click **"Add Channel"**
3. Paste the channel URL or ID
4. The channel name will be auto-detected

**What gets monitored:**
- New video uploads
- Video transcripts (auto-fetched)
- Video comments (for sentiment)
        `,
      },
    ],
  },

  // ============================================
  // CHAPTER 2: THE CONTENT PIPELINE
  // ============================================
  {
    id: 'the-pipeline',
    title: 'The Content Pipeline',
    description: 'Understanding the 8 phases of content creation',
    icon: '⚙️',
    sections: [
      {
        id: 'outpost',
        title: 'OUTPOST - Topic Setup',
        content: `
# OUTPOST - Topic Setup

**Purpose:** Define what you're tracking and where to look.

## What Happens Here

OUTPOST is your command center for topic configuration:

- Create and manage topics
- Add Twitter and YouTube sources
- Configure known entities
- Set story detection patterns

## Key Actions

| Action | Description |
|--------|-------------|
| Create Topic | Start tracking a new niche |
| Add Sources | Connect Twitter accounts and YouTube channels |
| Configure Entities | Define who/what to track |
| Set Patterns | Define what makes something newsworthy |

## Navigation

Access OUTPOST from the sidebar or go to **/outpost**.

Each topic has tabs for:
- **Overview** - Topic stats and configuration
- **Twitter** - Manage Twitter sources
- **YouTube** - Manage YouTube channels
- **Entities** - View detected entities
        `,
      },
      {
        id: 'perimeter',
        title: 'PERIMETER - Signal Monitoring',
        content: `
# PERIMETER - Signal Monitoring

**Purpose:** Scan the perimeter for new signals from your configured sources.

## What Happens Here

PERIMETER continuously monitors:

1. **Twitter Scanning**
   - Fetches tweets from source accounts
   - Checks for mentions of known entities
   - Tracks engagement metrics

2. **YouTube Scanning**
   - Checks for new video uploads
   - Fetches video transcripts
   - Monitors comment activity

3. **Signal Detection**
   - Cross-references sources
   - Identifies trending topics
   - Flags potential stories

## Configuration

Control monitoring via Intel Config:

- **hours_back**: How far to look (default: 48 hours)
- **min_sources**: Confirmations needed (default: 2)

## Trigger Monitoring

You can manually trigger a monitor sweep:
- Go to **/perimeter**
- Click **"Trigger Monitor"**
- Or use the API: \`POST /api/intelligence/monitor\`
        `,
      },
      {
        id: 'extraction',
        title: 'EXTRACTION - Entity Detection',
        content: `
# EXTRACTION - Entity Detection

**Purpose:** Extract entities and claims from raw content.

## What Gets Extracted

From tweets and video transcripts, EXTRACTION identifies:

- **People** - Battlers, bloggers, promoters
- **Organizations** - Leagues, media companies
- **Events** - Battles, announcements, controversies
- **Claims** - Statements and assertions

## Entity Context

Each entity has rich context:

\`\`\`typescript
{
  role: "battler",
  affiliations: [{ name: "URL", type: "league", status: "current" }],
  platforms: { twitter_handle: "@cassidy_larsiny" },
  is_primary_source: false,
  is_commentator: false
}
\`\`\`

## Entity Enrichment

Entities can be automatically enriched with web search:
- Go to **/studio/entities**
- Click **"Enrich"** on any entity
- System searches the web and fills in context

Lock entities you've manually verified to prevent auto-updates.
        `,
      },
      {
        id: 'audit',
        title: 'AUDIT - Credibility Scoring',
        content: `
# AUDIT - Credibility Scoring

**Purpose:** Score source credibility and evaluate claims.

## How Scoring Works

Sources are scored based on:

- **Accuracy** - How often their claims are verified
- **Consistency** - Reliability over time
- **Reach** - Audience size and engagement
- **Bias Indicators** - Known biases or agendas

## Credibility Ledger

The AUDIT page shows:

- Source credibility scores
- Claim verification history
- Cross-reference analysis

## Verification Status

Claims can be:
- **Verified** - Confirmed by multiple sources
- **Unverified** - Only one source
- **Disputed** - Conflicting information
- **False** - Debunked
        `,
      },
      {
        id: 'tribunal',
        title: 'TRIBUNAL - Verification',
        content: `
# TRIBUNAL - Community Verification

**Purpose:** Community nominations and verification votes.

## How It Works

1. **Nominations** - Suggest new entities or corrections
2. **Voting** - Community votes on nominations
3. **Approval** - Approved nominations update the system

## Creating Nominations

Go to **/tribunal** and:
- Click **"New Nomination"**
- Select nomination type (new entity, correction, merge)
- Provide evidence and reasoning
- Submit for review
        `,
      },
      {
        id: 'nexus',
        title: 'NEXUS - Story Assembly',
        content: `
# NEXUS - Story Assembly

**Purpose:** Assemble signals into coherent stories.

## Story Detection

The system groups related signals based on:

- **Entity overlap** - Same people/orgs mentioned
- **Temporal proximity** - Happening around same time
- **Semantic similarity** - Similar topics/themes

## Story Buckets

Stories are organized into buckets:

- **Trending** - High engagement, multiple sources
- **Breaking** - Just happened, urgent
- **Developing** - Ongoing situation
- **Feature** - Good for deep-dive content

## Story Desk

The NEXUS page (**/nexus**) shows:
- Proposed stories with source evidence
- Why each story was flagged
- Options to approve, edit, or dismiss
        `,
      },
      {
        id: 'sanction',
        title: 'SANCTION - Script Generation',
        content: `
# SANCTION - Script Generation

**Purpose:** Approve stories and generate content.

## The Studio Workflow

1. **Select Stories** - Choose which stories to cover
2. **Choose Host** - Pick a host personality
3. **Generate Script** - AI creates the script
4. **Review/Edit** - Make any changes
5. **Approve** - Ready for audio

## Host Personalities

7 different hosts with unique styles:

| Host | Style |
|------|-------|
| James Noble | Documentary narrator |
| Maya Sterling | Investigative anchor |
| Marcus Blaze | Hot take king |
| Devon Sharp | Witty satirist |
| Tasha Raw | Unfiltered real talk |
| DJ Momentum | High energy hype |
| King Knowledge | Street analyst |

## Script Templates

Use templates for consistent formatting:
- Daily Show
- Documentary
- Breaking News
- Interview Breakdown
        `,
      },
      {
        id: 'signal-export',
        title: 'SIGNAL - Export & Distribution',
        content: `
# SIGNAL - Export & Distribution

**Purpose:** Export and distribute finished content.

## Audio Generation

After script approval:
1. **Generate Audio** - Dia TTS converts text to speech
2. **Multi-Voice** - [S1]/[S2] speaker tags for different hosts
3. **Review** - Listen to the final product
4. **Export** - Download or publish

## Export Formats

- **MP3** - Standard audio file
- **WAV** - High quality audio
- **Transcript** - Text version

## Distribution

Future integrations planned:
- Podcast platforms
- Social media
- RSS feeds
        `,
      },
    ],
  },

  // ============================================
  // CHAPTER 3: THE STUDIO
  // ============================================
  {
    id: 'studio',
    title: 'The Studio',
    description: 'Creating shows and managing hosts',
    icon: '🎬',
    sections: [
      {
        id: 'hosts',
        title: 'Choosing a Host Personality',
        content: `
# Choosing a Host Personality

Each host has a unique voice and style that affects how content is delivered.

## Available Hosts

### James Noble
**Style:** Documentary narrator
**Voice:** Calm, authoritative, thoughtful
**Best for:** Deep dives, historical pieces
**Signature:** "In the world of battle rap..."

### Maya Sterling
**Style:** Investigative anchor
**Voice:** Professional, incisive, persistent
**Best for:** Breaking news, exposés
**Signature:** "Let's get to the bottom of this..."

### Marcus Blaze
**Style:** Hot take king
**Voice:** Bold, energetic, opinionated
**Best for:** Reactions, controversy
**Signature:** "Let me tell you something!"

### Devon Sharp
**Style:** Witty satirist
**Voice:** Clever, sarcastic, entertaining
**Best for:** Commentary, light pieces

### Tasha Raw
**Style:** Unfiltered real talk
**Voice:** Direct, street-smart, authentic
**Best for:** Community stories, interviews

### DJ Momentum
**Style:** High energy hype
**Voice:** Exciting, pump-up, energetic
**Best for:** Event coverage, announcements

### King Knowledge
**Style:** Street analyst
**Voice:** Wise, analytical, strategic
**Best for:** Predictions, breakdowns
        `,
      },
      {
        id: 'templates',
        title: 'Show Templates',
        content: `
# Show Templates

Templates define the structure and flow of your shows.

## Built-in Templates

### Daily Show
- **Duration:** ~8 minutes
- **Stories:** 3-5 trending topics
- **Structure:** Intro > Stories > Outro
- **Style:** Energetic, quick-hit coverage

### Documentary
- **Duration:** ~15 minutes
- **Stories:** 1 deep dive
- **Structure:** Intro > Background > Main > Conclusion
- **Style:** Cinematic, thorough

### Breaking News
- **Duration:** ~3 minutes
- **Stories:** 1 urgent story
- **Structure:** Alert > Story > Developing
- **Style:** Urgent, fast-paced

### Interview Breakdown
- **Duration:** ~10 minutes
- **Stories:** 1 interview analysis
- **Structure:** Intro > Clips > Analysis > Outro
- **Style:** Conversational, reactive

## Creating Custom Templates

Go to **/studio/templates** to:
- View existing templates
- Duplicate and modify
- Create from scratch
        `,
      },
      {
        id: 'daily-show',
        title: 'Creating a Daily Show',
        content: `
# Creating a Daily Show

The Daily Show wizard walks you through creating a show in 5 steps.

## Step 1: Select Template
Choose a template that matches your content type.

## Step 2: Select Host
Pick the host personality for your show. You can assign different hosts to different segments.

## Step 3: Choose Topics
The system proposes trending stories. Check the ones you want to include.

You can also:
- Add custom stories
- Edit story details
- Reorder stories

## Step 4: Preview Script
Review the generated script. Each segment shows:
- The text that will be spoken
- The host assigned
- Edit/regenerate options

## Step 5: Generate Audio
Click to generate the final audio. Progress is shown per segment.

## Multi-Voice Shows

To use multiple voices:
1. Go to Host selection
2. Click "Assign by Segment"
3. Choose different hosts for Intro, Stories, Outro
        `,
      },
      {
        id: 'voices',
        title: 'Voice Settings (Dia TTS)',
        content: `
# Voice Settings

Audio is generated using Dia TTS - a local multi-voice text-to-speech service.

## Key Features

- **Multi-Voice** - [S1]/[S2] speaker tags for natural dialogue
- **Emotional Markers** - (laughs), (whispers), (sighs), (gasps), etc.
- **Consistent Voices** - Same seed = same voices every time
- **Free** - Fully local, no API keys or costs

## Voice Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| Seed | Voice consistency (same seed = same voice) | 42 |
| Temperature | Expressiveness | 1.8 |
| Guidance Scale | Adherence to prompt | 3.0 |

## Host Voice Mapping

Each host uses a different seed value to produce distinct voice characteristics.

## Cost

Dia TTS is self-hosted and free. No per-character charges.
        `,
      },
    ],
  },

  // ============================================
  // CHAPTER 4: RESEARCH & SOURCES
  // ============================================
  {
    id: 'research',
    title: 'Research & Sources',
    description: 'Using different research sources',
    icon: '🔍',
    sections: [
      {
        id: 'twitter',
        title: 'Twitter Integration',
        content: `
# Twitter Integration

Twitter is a primary source for real-time signals.

## Provider

Talk Show Go uses **twitterapi.io** (not the official Twitter API).

**Cost:** $0.15 per 1,000 tweets fetched

## What Gets Fetched

- User timelines
- Tweet details
- Replies and quotes
- Engagement metrics

## Configuration

Add Twitter sources at **OUTPOST** > Your Topic > **Twitter**.

Set account types:
- **League** - Official accounts
- **Blogger** - Commentary
- **Personality** - Individual figures
        `,
      },
      {
        id: 'youtube',
        title: 'YouTube Channels',
        content: `
# YouTube Channels

YouTube channels are monitored for new content and transcripts.

## Provider

Talk Show Go uses **youtubei.js** - a free YouTube client that doesn't require an API key.

**Cost:** FREE

## What Gets Fetched

- Channel info and video lists
- Video transcripts (auto-generated or manual)
- Video metadata (views, likes, comments)
- Top comments for sentiment

## Adding Channels

1. Go to **OUTPOST** > Your Topic > **YouTube**
2. Click **"Add Channel"**
3. Paste the channel URL
4. Channel details are auto-detected
        `,
      },
      {
        id: 'web-search',
        title: 'Web Search (SearXNG)',
        content: `
# Web Search (SearXNG)

SearXNG is a self-hosted meta-search engine for general web research.

## About SearXNG

SearXNG aggregates results from multiple search engines without tracking.

**URL:** http://localhost:8888
**Cost:** FREE (self-hosted)

## Use Cases

- Finding court documents
- Researching entity backgrounds
- Discovering source materials
- General fact-checking

## How to Use

Web search is used automatically during:
- Entity enrichment
- Deep research mode
- Story verification

You can also access it directly via the Research page.
        `,
      },
      {
        id: 'perplexity',
        title: 'Perplexity Sonar',
        content: `
# Perplexity Sonar

Perplexity is an AI-powered search engine that provides grounded answers with citations.

## Free Tier

You get **5 free searches per month** with Perplexity Sonar.

Credits reset on the 1st of each month.

## When to Use

Use Perplexity for:
- Complex research questions
- When you need AI-synthesized answers
- Getting multiple source citations quickly

## Checking Credits

View your Perplexity credits at **/settings/usage**.

The system will warn you if you're running low on credits.

## API Configuration

Set your API key in environment:
\`\`\`
PERPLEXITY_API_KEY=your_key_here
\`\`\`
        `,
      },
      {
        id: 'deep-research',
        title: 'Deep Research Mode',
        content: `
# Deep Research Mode

Deep Research is an iterative process that combines web search with LLM analysis.

## How It Works

1. **Initial Query** - Start with a research question
2. **Web Search** - Search for relevant content
3. **Analysis** - LLM analyzes results
4. **Follow-up** - Generate follow-up queries
5. **Iterate** - Repeat until comprehensive

## Configuration

- **Depth** - How many iterations (default: 3)
- **Breadth** - Queries per iteration (default: 3)

## Use Cases

- Historical deep dives
- Biography research
- Comprehensive story background
- Court record investigations

## Triggering Deep Research

\`\`\`bash
POST /api/intelligence/research
{
  "topic_id": "...",
  "query": "Your research question",
  "mode": "deep",
  "depth": 3,
  "breadth": 3
}
\`\`\`
        `,
      },
    ],
  },

  // ============================================
  // CHAPTER 5: ENTITY MANAGEMENT
  // ============================================
  {
    id: 'entities',
    title: 'Entity Management',
    description: 'Managing entities and their context',
    icon: '👤',
    sections: [
      {
        id: 'what-are-entities',
        title: 'What are Entities?',
        content: `
# What are Entities?

Entities are the people, organizations, and concepts you track within a topic.

## Types of Entities

- **Person** - Battlers, bloggers, promoters, personalities
- **Organization** - Leagues, media companies, collectives
- **Event** - Battles, tournaments, controversies
- **Concept** - Recurring themes or topics

## Why Entities Matter

Entities enable:
- **Smart Monitoring** - Track mentions across all sources
- **Cross-Referencing** - Connect related stories
- **Context** - Understand who's who
- **Credibility** - Know primary sources from commentators
        `,
      },
      {
        id: 'entity-context',
        title: 'Entity Context & Roles',
        content: `
# Entity Context & Roles

Each entity has rich context that helps the system understand their role.

## Context Fields

\`\`\`typescript
{
  role: "battler",              // Primary role
  sub_roles: ["league owner"],  // Additional roles
  gender: "male",
  affiliations: [
    { name: "URL", type: "league", status: "current" }
  ],
  platforms: {
    twitter_handle: "@cassidy_larsiny",
    youtube_channel_id: "UC..."
  },
  is_primary_source: false,     // Creates original content
  is_commentator: true,         // Comments on others
  bias_indicators: ["Known to have beef with X"],
  notes: "Free text notes",
  tags: ["philly", "legend"]
}
\`\`\`

## Role Categories

| Role | Description |
|------|-------------|
| battler | Participates in battles |
| blogger | Creates commentary content |
| league_owner | Runs a battle league |
| promoter | Organizes events |
| media | Covers the scene |
        `,
      },
      {
        id: 'enrichment',
        title: 'Auto-Enrichment',
        content: `
# Auto-Enrichment

Entities can be automatically enriched with web search and AI analysis.

## How It Works

1. System searches for entity name + niche keywords
2. Analyzes search results with LLM
3. Extracts role, affiliations, and other context
4. Updates entity with new information

## Triggering Enrichment

**Via UI:**
1. Go to **/studio/entities**
2. Find the entity
3. Click **"Enrich"**

**Via API:**
\`\`\`bash
POST /api/entities/{id}/enrich
{
  "force": false,
  "niche_keywords": ["battle rap"]
}
\`\`\`

## Enrichment Status

- **pending** - Not yet enriched
- **enriched** - Has been auto-enriched
- **locked** - Manually verified, won't auto-update
        `,
      },
      {
        id: 'locking',
        title: 'Locking Entities',
        content: `
# Locking Entities

Lock entities you've manually verified to prevent automatic updates.

## Why Lock?

- Preserve manually-entered information
- Prevent incorrect auto-enrichment
- Mark entities as "verified"

## How to Lock

**Via UI:**
1. Go to **/studio/entities**
2. Edit the entity
3. Toggle **"Lock Entity"**

**Via API:**
\`\`\`bash
POST /api/entities/{id}/enrich/lock
\`\`\`

## Unlocking

To allow enrichment again:
\`\`\`bash
POST /api/entities/{id}/enrich/unlock
\`\`\`
        `,
      },
    ],
  },

  // ============================================
  // CHAPTER 6: GLOSSARY
  // ============================================
  {
    id: 'glossary',
    title: 'Glossary',
    description: 'Terms and definitions',
    icon: '📖',
    sections: [
      {
        id: 'terms',
        title: 'Terms & Definitions',
        content: `
# Terms & Definitions

## Core Terms

| Term | Definition |
|------|------------|
| **Topic** | A niche or subject area you're covering |
| **Entity** | A person, organization, or concept being tracked |
| **Signal** | A piece of content that might be newsworthy |
| **Story** | A narrative assembled from multiple signals |
| **Source** | A Twitter account or YouTube channel |

## Pipeline Terms

| Term | Definition |
|------|------------|
| **Monitor** | Scan sources for new content |
| **Extraction** | Pull entities and claims from content |
| **Enrichment** | Add context to entities via web search |
| **Story Bucket** | A collection of related signals |

## Content Terms

| Term | Definition |
|------|------------|
| **Host** | The AI personality that narrates content |
| **Template** | A structure for shows (daily, documentary, etc.) |
| **Script** | The text that will be converted to audio |
| **Segment** | A portion of a show (intro, story, outro) |

## Status Terms

| Term | Definition |
|------|------------|
| **Greenlight** | Approved for tracking or production |
| **Verified** | Confirmed by multiple sources |
| **Locked** | Protected from automatic updates |
        `,
      },
      {
        id: 'codenames',
        title: 'Phase Codenames Explained',
        content: `
# Phase Codenames Explained

Talk Show Go uses military-inspired codenames for each phase. Here's why:

## OUTPOST
**Military meaning:** A forward observation post
**In CK:** Where you set up and monitor your territory (topic configuration)

## PERIMETER
**Military meaning:** The boundary of a secured area
**In CK:** Where you patrol for incoming signals (source monitoring)

## EXTRACTION
**Military meaning:** A rescue or retrieval operation
**In CK:** Where you pull out valuable entities from content

## AUDIT
**Military meaning:** An official inspection
**In CK:** Where you verify and score source credibility

## TRIBUNAL
**Military meaning:** A military court
**In CK:** Where the community judges nominations and claims

## NEXUS
**Military meaning:** A connection point
**In CK:** Where signals connect to form stories

## SANCTION
**Military meaning:** Official approval or authorization
**In CK:** Where stories get approved for production

## SIGNAL
**Military meaning:** A communication transmission
**In CK:** Where content is transmitted/distributed
        `,
      },
    ],
  },
]

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a specific chapter by ID
 */
export function getChapter(chapterId: string): ManualChapter | undefined {
  return USER_MANUAL.find(c => c.id === chapterId)
}

/**
 * Get a specific section by chapter and section ID
 */
export function getSection(chapterId: string, sectionId: string): ManualSection | undefined {
  const chapter = getChapter(chapterId)
  return chapter?.sections.find(s => s.id === sectionId)
}

/**
 * Search the manual for content matching a query
 */
export function searchManual(query: string): { chapter: ManualChapter; section: ManualSection; snippet: string }[] {
  const results: { chapter: ManualChapter; section: ManualSection; snippet: string }[] = []
  const queryLower = query.toLowerCase()

  for (const chapter of USER_MANUAL) {
    for (const section of chapter.sections) {
      const contentLower = section.content.toLowerCase()
      if (contentLower.includes(queryLower) || section.title.toLowerCase().includes(queryLower)) {
        // Extract a snippet around the match
        const index = contentLower.indexOf(queryLower)
        const start = Math.max(0, index - 50)
        const end = Math.min(section.content.length, index + query.length + 100)
        let snippet = section.content.slice(start, end).trim()
        if (start > 0) snippet = '...' + snippet
        if (end < section.content.length) snippet = snippet + '...'

        results.push({ chapter, section, snippet })
      }
    }
  }

  return results
}

/**
 * Get all section IDs for navigation
 */
export function getAllSectionIds(): { chapterId: string; sectionId: string; title: string }[] {
  const ids: { chapterId: string; sectionId: string; title: string }[] = []

  for (const chapter of USER_MANUAL) {
    for (const section of chapter.sections) {
      ids.push({
        chapterId: chapter.id,
        sectionId: section.id,
        title: `${chapter.title} > ${section.title}`,
      })
    }
  }

  return ids
}
