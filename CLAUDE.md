# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Talk Show Go - Intelligence-Driven Content Generation System

## Quick Start

### One-Click Start (Windows)
Double-click one of these files in the project root:
- **`start.bat`** - Command Prompt version
- **`start.ps1`** - PowerShell version (right-click > Run with PowerShell)

### Command Line Start
```bash
# Quick start - starts Docker + Next.js in one command
npm run go

# Stop everything
npm run stop
```

## Development Commands

```bash
# Quick start (Docker + Next.js)
npm run go

# Start all Docker services (Postgres, Redis, PostgREST, Kong, SearXNG)
npm run docker:up

# Start Next.js development server
npm run dev

# Start background worker (separate terminal)
npm run worker

# Build for production
npm run build

# Lint the codebase
npm run lint

# Run database migrations (apply a specific migration)
docker exec -i tsg-postgres psql -U postgres -d talkshowgo < supabase/migrations/XXX_name.sql

# Reset Docker (wipe data and restart)
npm run docker:reset

# Stop all services
npm run stop

# Check if database is ready
npm run check:db

# Check if LLM service is running
npm run check:ai

# Check if voice service is running
npm run check:voice

# UI Testing with Playwright
npx playwright test
npx playwright test tests/branding.spec.ts
```

---

## Branding

| Item | Value |
|------|-------|
| App Name | TalkShowGo |
| Database | talkshowgo |
| Container Prefix | tsg-* (tsg-postgres, tsg-redis, tsg-worker, etc.) |
| Logo | /public/logo.svg |
| User-Agent | TalkShowGo/1.0 |

---

## Common Search Patterns

```bash
# Find all database references
grep -r "talkshowgo" --include="*.ts" --include="*.tsx" --include="*.yml" --include="*.md"

# Find container references
grep -r "tsg-" --include="*.ts" --include="*.tsx" --include="*.yml" --include="*.md"

# Find API routes
ls src/app/api/**/route.ts

# Find all pages
ls src/app/**/page.tsx
```

---

## Topic Filtering Pattern

All pages that filter by topic MUST use TopicContext:

```typescript
import { useTopic } from '@/context/topic-context'

// In component:
const { selectedTopic, topics, selectTopic } = useTopic()

// Filter data by selected topic
useEffect(() => {
  if (selectedTopic) fetchData(selectedTopic.id)
}, [selectedTopic])
```

**Never** use local topic state or hardcoded topic IDs in pages.

---

## Key UI Components

| Component | Location |
|-----------|----------|
| TopicTabs | `src/components/topic-tabs.tsx` |
| AppShell | `src/components/layout/app-shell.tsx` |
| Sidebar | `src/components/layout/sidebar.tsx` |
| Topbar | `src/components/layout/topbar.tsx` |
| TopicContext | `src/context/topic-context.tsx` |

---

## Documentation Files

| Location | Contents |
|----------|----------|
| `docs/docker/*.md` | Docker service documentation |
| `docs/troubleshooting/*.md` | Issue fixes and solutions |
| `SCHEDULER-README.md` | Scheduler quick start guide |
| `TROUBLESHOOTING-SCHEDULER.md` | Scheduler troubleshooting |

---

## Anti-Patterns (Don't Do)

- **DON'T** hardcode topic IDs → use `useTopic()` from TopicContext
- **DON'T** use `ck-*` container names → use `tsg-*` prefix
- **DON'T** reference "Content Kingdom" → use "TalkShowGo"
- **DON'T** create local topic state in pages → use TopicContext
- **DON'T** use ElevenLabs for TTS → use Dia (see Dia section below)

---

## Vision

Talk Show Go is a **Content Generation Operating System** that:
1. Automatically gathers intelligence from trusted sources (YouTube channels, Twitter accounts)
2. Extracts entities with CONTEXT (roles, affiliations, credibility)
3. Finds consensus from engagement metrics (comment likes, cross-referencing sources)
4. Generates automated content using AI voices
5. Outputs multiple formats: news shows, documentary stories, daily briefings

The first niche is **Battle Rap**, with the goal of being "the CNN of battle rap" - producing daily automated coverage using a cloned voice (Algorithm Institute).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TALKSHOWGO                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  SOURCES                      PROCESSING                   OUTPUT       │
│  ─────────                    ───────────                  ──────       │
│  Twitter (twitterapi.io)  →   Entity Extraction     →    News Shows    │
│  YouTube Channels         →   Transcript Analysis   →    Documentaries │
│  YouTube Comments         →   Consensus Detection   →    Daily Audio   │
│  RSS Feeds                →   Story Assembly        →    Podcasts      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Current Battle Rap Setup

### Topic ID
```
864dbcf4-e1f7-4b1a-86ed-c18007439ad5
```

### Twitter Sources (16)
Major leagues: URL, KOTD, RBE, TBL
Media outlets: JayBlac, 15MOFE, HHIR, Rap Grid
Personalities: Aye Verb, Champagne Duane

### YouTube Channels (6)
- URLTV (Ultimate Rap League)
- King Of The Dot Entertainment
- Rare Breed Entertainment
- No Studio'N Network
- Jayblac1615
- Algorithm Institute of Battle Rap (user's channel)

### ElevenLabs Voice
- Voice Name: "Battlerap Algorithm"
- Voice ID: `ZJ7BlVZrxZKBDMTIK5c9`
- Style: Documentary narrator ("In the world of battle rap...")

## Tech Stack

### Core Services (Docker)
- **PostgreSQL** (pgvector) - Main database
- **PostgREST** - REST API for PostgreSQL (Supabase-compatible)
- **Kong** - API Gateway
- **Redis** - Job queue (BullMQ)
- **Qdrant** - Vector database for RAG
- **Worker** - Background job processor
- **SearXNG** - Self-hosted web search (port 8888)
- **Dia** - Multi-voice TTS (PRIMARY) - Port 8765

### Voice Services
- **Dia TTS** (PRIMARY) - Multi-voice dialogue generation
  - Port: 8765
  - Features: [S1]/[S2] speaker tags, emotional markers
  - Emotions: (laughs), (whispers), (sighs), (gasps), etc.
  - Performance: ~2x realtime on GPU
  - No API keys required
- **ElevenLabs** (DEPRECATED) - Use Dia instead
  - Legacy voice: "Battlerap Algorithm" (ID: ZJ7BlVZrxZKBDMTIK5c9)

### External APIs
- **twitterapi.io** - Twitter data (NOT official Twitter API)
- **youtubei.js** - Free YouTube client (no API key)
- **youtube-transcript** - Transcript fetching
- **Presidium/Ollama** - Local AI for entity extraction

### Key Libraries
- Next.js 14 - Web framework
- BullMQ - Job queue
- Supabase JS - Database client
- youtubei.js - YouTube client

## Dia Multi-Voice TTS (PRIMARY)

### Overview
Dia is our primary TTS service for multi-voice dialogue generation. It **REPLACES** ElevenLabs completely.

**Key Features:**
- [S1]/[S2] speaker tags for natural multi-voice conversations
- Emotional markers: (laughs), (whispers), (sighs), (gasps), (coughs), (groans), (claps), (screams), etc.
- Consistent voices via seed parameter
- ~2x realtime generation on GPU
- Fully local - no API keys, no usage limits, no costs

### Quick Start

```bash
# Start Dia service
npm run dia:up

# Check if running
npm run check:voice

# Test it
npm run dia:test
```

### TypeScript Usage

```typescript
import { generateDialogue, Emotion } from './src/lib/dia'

// Generate 2-voice conversation
const audio = await generateDialogue({
  segments: [
    { speaker: 1, text: `Welcome to the show! ${Emotion.laughs}` },
    { speaker: 2, text: `Thanks for having me. ${Emotion.chuckle}` }
  ],
  seed: 42  // Same seed = same voices every time
})

await fs.writeFile('show.mp3', audio)
```

### 3-Speaker Shows

Dia supports 2 voices per generation. For 3 speakers, use different seeds:

```typescript
// Maya (S1) + Marcus (S2) - Seed 100
await generateDialogue({
  segments: [
    { speaker: 1, text: "Maya speaking" },
    { speaker: 2, text: "Marcus responding" }
  ],
  seed: 100
})

// Maya (S1) + Sarah (S2) - Seed 200
await generateDialogue({
  segments: [
    { speaker: 1, text: "Maya speaking" },
    { speaker: 2, text: "Sarah responding" }
  ],
  seed: 200
})
```

This creates 3 distinct voices:
- S1 with seed 100 = Maya's voice
- S2 with seed 100 = Marcus's voice
- S2 with seed 200 = Sarah's voice

### Emotional Markers

```typescript
import { Emotion } from './src/lib/dia'

const text = `
  Hey there! ${Emotion.laughs}
  This is incredible! ${Emotion.gasps}
  I can't believe it. ${Emotion.whispers}
  ${Emotion.applause}
`
```

**Available emotions:**
- `Emotion.laughs`, `Emotion.chuckle` - Laughter
- `Emotion.whispers` - Whispering
- `Emotion.sighs`, `Emotion.gasps` - Breathing effects
- `Emotion.coughs`, `Emotion.groans` - Vocal effects
- `Emotion.claps`, `Emotion.applause` - Audience sounds
- `Emotion.screams` - Screaming
- `Emotion.inhales`, `Emotion.exhales` - Breath control
- `Emotion.humming`, `Emotion.whistles` - Musical sounds
- `Emotion.sneezes`, `Emotion.burps` - Natural sounds

### API Endpoints

**Base URL:** `http://localhost:8765`

#### POST /generate
Generate multi-voice speech

```bash
curl -X POST http://localhost:8765/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "[S1] Hey! (laughs) [S2] Hi! (chuckle)",
    "seed": 42
  }' \
  --output output.mp3
```

#### GET /health
Check service status

```bash
curl http://localhost:8765/health
```

### Migration from ElevenLabs

**DO NOT use ElevenLabs anymore.** Use Dia instead.

❌ **Old (DEPRECATED):**
```typescript
import { textToSpeech } from './src/lib/elevenlabs'
const audio = await textToSpeech({
  text: "...",
  voice_id: 'EXAVITQu4vr4xnSDxMaL'
})
```

✅ **New (USE THIS):**
```typescript
import { generateDialogue } from './src/lib/dia'
const audio = await generateDialogue({
  segments: [{ speaker: 1, text: "..." }],
  seed: 42
})
```

### Files
- `src/lib/dia.ts` - TypeScript client (USE THIS)
- `docker/dia/Dockerfile` - Dia service Docker image
- `docker/dia/dia-api.py` - FastAPI wrapper
- `docker/dia/README.md` - Service documentation
- `docs/DIA-MIGRATION.md` - Complete migration guide
- `test-dia.ts` - Test suite
- `generate-orangeburg-3host-dia.ts` - 3-host example

## Database Schema

### Core Tables
- `topics` - Content niches (battle rap, sports, etc.)
- `source_accounts` - Twitter sources
- `youtube_channels` - YouTube channel sources
- `youtube_videos` - Video metadata + transcripts
- `youtube_comments` - Comments with engagement metrics
- `entities` - Extracted people, organizations, events
- `entity_aliases` - Name variations
- `entity_mentions` - Where entities appear
- `tweets_raw` - Raw tweet data
- `claims` - Extracted claims from content
- `stories` - Assembled narratives
- `job_runs` - Background job tracking
- `research_packages` - Complete research bundles (JSONB package_json)

### Entity Context (metadata JSONB)
```typescript
interface EntityContext {
  role?: string              // "battler", "blogger", "league owner"
  sub_roles?: string[]       // Multiple roles
  gender?: 'male' | 'female' | 'other' | 'unknown'
  affiliations?: {
    name: string             // "URL", "KOTD"
    type: string             // "league", "media"
    status: 'current' | 'former' | 'rumored'
  }[]
  content_types?: string[]   // ["battles", "reactions", "interviews"]
  platforms?: {
    youtube_channel_id?: string
    twitter_handle?: string
  }
  is_primary_source?: boolean
  is_commentator?: boolean
  bias_indicators?: string[]
  notes?: string
  tags?: string[]

  // Enrichment tracking
  enrichment_status?: 'pending' | 'enriched' | 'locked'
  enrichment_last_run?: string
  enrichment_sources?: string[]
  enrichment_locked_by?: string
  enrichment_locked_at?: string
}
```

## Worker Jobs

### Ingestion Queue
- `perimeter_sweep` - Discover new sources
- `relay_fetch` - Fetch from trusted YouTube channels
- `recon_search` - Search for content

### Processing Queue
- `extraction_run` - Extract entities from content
- `audit_score` - Score source credibility
- `tribunal_discover` - Verify claims
- `transcript_fetch` - Fetch video transcripts + comments

### Editorial Queue
- `nexus_bucket` - Assemble stories
- `signal_export` - Export content

## API Endpoints

### Topics
- `GET /api/topics` - List topics
- `POST /api/topics` - Create topic
- `GET /api/topics/[id]` - Get topic
- `GET /api/topics/[id]/entities` - Get entities
- `GET /api/topics/[id]/stats` - Get statistics

### Entities
- `GET /api/entities/[id]/context` - Get entity context
- `PUT /api/entities/[id]/context` - Replace context
- `PATCH /api/entities/[id]/context` - Partial update

### Entity Enrichment
- `POST /api/entities/[id]/enrich` - Enrich entity with web search + LLM
- `GET /api/entities/[id]/enrich` - Get enrichment status
- `POST /api/entities/[id]/enrich/lock` - Lock entity (prevent enrichment)
- `POST /api/entities/[id]/enrich/unlock` - Unlock entity (allow enrichment)

### Jobs
- `POST /api/jobs/[type]/trigger` - Trigger a job
- `GET /api/jobs` - List job runs

### YouTube
- `GET /api/youtube/search` - Search YouTube

### Twitter
- `GET /api/twitter/search` - Search tweets
- `GET /api/twitter/user` - Get user info
- `GET /api/twitter/timeline` - Get timeline

### Intelligence Framework
- `POST /api/intelligence/monitor` - Sweep all sources, detect stories
- `POST /api/intelligence/research` - Search YouTube (quick mode) or deep research
- `GET /api/intelligence/stories` - Get detected stories
- `GET/PUT/PATCH /api/topics/[id]/config` - Topic intel configuration

### Web Search & Deep Research
- `POST /api/intelligence/web-search` - Search web via SearXNG
- `POST /api/intelligence/deep-research` - Iterative deep research
- `GET /api/intelligence/deep-research` - Check service status

### Onboarding
- `GET /api/onboarding/status?topic_id=xxx` - Get onboarding progress
- `POST /api/onboarding/quickstart` - Create topic with config in one call
- `POST /api/onboarding/discover-sources` - Find YouTube channels for a niche
- `POST /api/onboarding/test` - Test monitor/research/web_search/deep_research

### RSS Discovery (Perplexity-Powered)
- `POST /api/rss/discover` - Discover RSS feeds for a niche using AI
- `GET /api/rss/discover` - Check RSS discovery service status

### API Key Management
- `GET /api/settings/api-keys` - Get status of all API keys
- `POST /api/settings/api-keys` - Save an API key (verifies before saving)
- `PUT /api/settings/api-keys` - Verify an API key without saving
- `DELETE /api/settings/api-keys` - Delete an API key from database

## Intelligence Flow

### 1. Source Monitoring
YouTube bloggers (Chris Unbias, Angry Fan, Vada Fly, etc.) are intelligence sources - they discuss battles, news, and drama. Their videos and comments provide signals about what's happening.

### 2. Entity Context
Every entity (battler, blogger, league) has context:
- Cassidy: battler, former Philly battle legend, not affiliated with URL
- Chris Unbias: blogger, is_commentator=true, covers all leagues
- URL: organization, primary_source=true for their battles

### 2.5 Entity Enrichment
Entities can be automatically enriched with web search + LLM analysis:
```bash
# Enrich a single entity
curl -X POST http://localhost:3000/api/entities/{id}/enrich \
  -H "Content-Type: application/json" \
  -d '{"force": false, "niche_keywords": ["battle rap"]}'

# Lock entity to prevent future enrichment
curl -X POST http://localhost:3000/api/entities/{id}/enrich/lock

# Unlock entity to allow enrichment again
curl -X POST http://localhost:3000/api/entities/{id}/enrich/unlock
```

Enrichment Status:
- `pending` - Not yet enriched
- `enriched` - Has been enriched with web data
- `locked` - Producer has locked this entity (no automatic enrichment)

UI: Visit `/studio/entities` to view, enrich, and edit entity context.

### 3. Consensus Detection
High-liked comments indicate community opinion. Cross-referencing multiple bloggers talking about the same topic confirms stories.

### 4. Content Generation
Stories are assembled from multiple signals, then a script is generated using the Algorithm Institute style, and audio is produced with the cloned voice.

## Daily Show System

The Daily Show system creates automated news shows with two operating modes:

### Mode 1: Producer-Driven (Narrative Stories)
- Producer chooses the subject/topic via the UI
- System researches that specific topic in depth
- Used for documentary-style content, deep dives
- Example: "I want a story about Bad Newz snitching allegations"

### Mode 2: System-Driven (Daily Briefing)
- System scans configured sources (Twitter + YouTube)
- System proposes 3-5 trending topics
- Producer picks which topics to include via checkboxes
- Used for daily news shows
- Example: System finds "Cassidy vs Eazy fallout" is trending

### Key Features
- **100% UI-driven** - No Claude Code needed to operate
- Editable templates via `/studio/templates`
- Host selection dropdown (7 host personalities)
- Topic selection with checkboxes
- Twitter integration for trending/sentiment
- Progress visible in UI during generation
- Script preview/edit before audio generation

### UI Pages
- `/studio/templates` - Create and edit show templates
- `/studio/daily-show` - 5-step wizard to create shows:
  1. Select template
  2. Select host
  3. Choose topics (from system proposals)
  4. Preview/edit script
  5. Generate audio

### API Endpoints
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET/PUT/DELETE /api/templates/[id]` - Single template CRUD
- `GET /api/stories/daily-show/propose` - Propose trending topics
- `GET /api/twitter/digest` - Get Twitter digest
- `POST /api/stories/daily-show` - Generate show with audio

### Host Personalities (7 available)
1. **Maya Sterling** - Investigative anchor (Rachel Maddow style)
2. **Marcus Blaze** - Hot take king (Stephen A Smith style)
3. **Devon Sharp** - Witty satirist (Jon Stewart style)
4. **Tasha Raw** - Unfiltered real talk
5. **James Noble** - Smooth documentary narrator
6. **DJ Momentum** - High energy hype
7. **King Knowledge** - Street analyst

### Template Placeholders
| Placeholder | Description |
|-------------|-------------|
| `{show_name}` | "Battle Rap Daily" |
| `{date}` | "December 19th, 2025" |
| `{host_name}` | Selected host name |
| `{host_opening}` | Host-specific intro style |
| `{host_closing}` | Host-specific sign-off |
| `{topic_count}` | Number of stories |
| `{headline}` | Story headline |
| `{story_body}` | Story content |
| `{transition}` | Host transition phrase |
| `{twitter_trending}` | Trending topics section |
| `{twitter_reaction}` | Tweet quotes for story |

### Database Tables
- `show_templates` - Editable templates with intro/story/outro sections
- `daily_show_runs` - Track generated shows and their settings

## Research Package System

The Research Package system bundles ALL research data for a story/topic into a well-organized, exportable format for:
- **AI/LLM systems** - JSON API for automated content generation
- **Human producers** - Markdown export for review and editing
- **External tools** - Director's Palette integration

### Package Structure

```
ResearchPackage
├── metadata          # Package ID, stats, query context
├── raw_sources       # Complete source data
│   ├── youtube_videos (with transcripts)
│   ├── tweets
│   ├── comments
│   └── web_documents (court records, articles)
├── intelligence      # Processed data
│   ├── entities (with context, roles, affiliations)
│   ├── claims (with verdicts, evidence)
│   ├── event_timeline
│   └── consensus_summary
├── producer          # Editorial materials
│   ├── story_summary
│   ├── key_facts
│   ├── quotes_to_use
│   ├── warnings (unverified claims, legal risks)
│   └── suggested_angles
├── host              # Script-ready materials
│   ├── script_outline
│   ├── talking_points
│   ├── pronunciation_guide
│   └── entity_glossary
├── interviews        # First-person accounts
└── twitter           # Community sentiment
```

### Research Package API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/research-package/{id}` | GET | Get package by ID |
| `/api/research-package/topic/{topic_id}` | GET | All packages for a topic |
| `/api/research-package/generate` | POST | Generate new package from query |

**GET Query Parameters:**
- `format=json|markdown` - Output format (default: json)
- `sections=raw,entities,claims,producer,host` - Filter sections
- `include_transcripts=true|false` - Include full transcripts

**POST Generate Request:**
```json
{
  "query": "Cassidy vs Hitman battle",
  "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5",
  "options": {
    "enable_interviews": true,
    "enable_twitter": true,
    "enable_documents": false
  },
  "generate_producer_materials": true,
  "generate_host_materials": true
}
```

### Usage Examples

```bash
# Generate a new research package
curl -X POST http://localhost:3000/api/research-package/generate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Bad Newz snitching allegations",
    "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5"
  }'

# Get package as JSON
curl http://localhost:3000/api/research-package/{id}?format=json

# Get package as Markdown (downloadable)
curl http://localhost:3000/api/research-package/{id}?format=markdown

# Get all packages for a topic (summary mode)
curl http://localhost:3000/api/research-package/topic/{topic_id}?summary=true

# Get specific sections only
curl http://localhost:3000/api/research-package/{id}?sections=producer,host
```

### Workflow Integration

Research packages can be generated automatically during workflows:

```typescript
// In research workflow (auto-save to database)
await runResearchWorkflow({
  query: "Bad Newz snitching allegations",
  topic_id: "...",
  generate_package: true  // Saves package to DB
})

// In story pipeline (returns package URLs)
const result = await runStoryPipeline({
  query: "...",
  generate_package: true
})
// result.research_package_id
// result.research_package_urls.json
// result.research_package_urls.markdown
```

### Director's Palette Export

When exporting stories to Director's Palette, the research package is automatically included:
- Full package JSON for AI systems
- Package URLs for on-demand access
- Enriched context for video production

### Database Table

```sql
CREATE TABLE research_packages (
    id UUID PRIMARY KEY,
    topic_id UUID REFERENCES topics(id),
    story_candidate_id UUID REFERENCES story_candidates(id),
    query TEXT NOT NULL,
    package_json JSONB NOT NULL,  -- Full ResearchPackage
    stats JSONB,                   -- Quick access stats
    headline VARCHAR(500),
    markdown_path TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Apply Migration

```bash
docker exec -i tsg-postgres psql -U postgres -d talkshowgo < supabase/migrations/018_research_packages.sql
```

### Key Files

| File | Purpose |
|------|---------|
| `src/types/research-package.ts` | TypeScript interfaces |
| `src/lib/research-package.ts` | Package assembly logic |
| `src/lib/research-package-markdown.ts` | Markdown export |
| `src/app/api/research-package/[id]/route.ts` | GET package endpoint |
| `src/app/api/research-package/topic/[topic_id]/route.ts` | GET by topic |
| `src/app/api/research-package/generate/route.ts` | POST generate |

## Key Files

### Workers
- `src/workers/index.ts` - Worker entry point
- `src/workers/jobs/transcript-fetch.ts` - Fetch transcripts/comments
- `src/workers/jobs/extraction-run.ts` - Entity extraction

### API
- `src/lib/queue.ts` - Queue client for API
- `src/lib/youtube-api.ts` - YouTube client (free + official)
- `src/app/api/entities/[id]/context/route.ts` - Entity context API
- `src/lib/entity-enrichment.ts` - Entity enrichment with web search + LLM
- `src/lib/web-search.ts` - SearXNG web search client
- `src/lib/deep-research.ts` - Iterative deep research
- `src/lib/perplexity.ts` - Perplexity Sonar client (search, RSS discovery, entity research)
- `src/lib/api-keys.ts` - API key management (DB + env vars)
- `src/app/api/rss/discover/route.ts` - RSS feed discovery API
- `src/app/api/settings/api-keys/route.ts` - API key management API
- `src/app/settings/api-keys/page.tsx` - API key management UI

### Research Package
- `src/types/research-package.ts` - Complete TypeScript interfaces for package schema
- `src/lib/research-package.ts` - Package assembly from WorkflowResult
- `src/lib/research-package-markdown.ts` - Markdown export generator
- `src/app/api/research-package/[id]/route.ts` - GET package by ID
- `src/app/api/research-package/topic/[topic_id]/route.ts` - GET packages by topic
- `src/app/api/research-package/generate/route.ts` - POST generate new package

### Types
- `src/types/entity-context.ts` - Entity context schema

### Config
- `docker-compose.yml` - All services
- `tsconfig.worker.json` - Worker TypeScript config

## Setting Up a New Niche (Onboarding)

### Quick Setup
```bash
# 1. Create topic with config in one call
curl -X POST http://localhost:3000/api/onboarding/quickstart \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hood Content",
    "description": "Street news and culture",
    "initial_entities": ["CHICAGO", "ATLANTA", "DRILL"],
    "initial_patterns": ["shot", "arrested", "beef", "speaks on"],
    "hours_back": 72,
    "min_sources": 2
  }'
```

### Step-by-Step Setup
```
1. CREATE TOPIC
   POST /api/topics
   { "name": "Your Niche", "description": "..." }

2. CONFIGURE INTELLIGENCE
   PUT /api/topics/{id}/config
   {
     "hours_back": 48,
     "min_sources": 2,
     "known_entities": ["ENTITY1", "ENTITY2"],
     "story_patterns": ["vs", "responds", "beef"]
   }

3. DISCOVER YOUTUBE SOURCES
   POST /api/onboarding/discover-sources
   { "search_terms": ["your niche commentary", "your niche news"] }

4. ADD YOUTUBE CHANNELS
   POST /api/topics/{id}/youtube
   { "channel_name": "...", "channel_id": "UC..." }

5. TEST MONITOR
   POST /api/onboarding/test
   { "topic_id": "...", "mode": "monitor" }

6. TEST RESEARCH
   POST /api/onboarding/test
   { "topic_id": "...", "mode": "research", "query": "test story" }

7. CHECK STATUS
   GET /api/onboarding/status?topic_id=...
```

### Deep Research
For comprehensive historical research:
```bash
POST /api/intelligence/research
{
  "topic_id": "...",
  "query": "Old Red battle rap complete history",
  "mode": "deep",
  "depth": 3,
  "breadth": 3
}
```

## Future Enhancements

1. **Smart Signal Detection** - Entity-aware search and cross-referencing
2. **Script Generator** - AI script generation with host personality
3. **Audio Pipeline** - Automated audio generation with ElevenLabs
4. **Producer UI** - Entity context editing interface
5. **Multi-Niche** - Expand beyond battle rap (sports, politics, local news)
6. **n8n Integration** - Workflow automation triggers

## Story Types & Special Handling

### Legal/Allegation Stories
For stories involving court documents, snitching, paperwork, allegations:

**Automatic Detection:**
The query interpreter auto-detects legal stories by scanning for keywords:
- snitch, snitching, rat, paperwork, court, arrest, charges
- allegations, accused, indicted, trial, testimony, witness, informant

When detected:
- `involves_legal_allegations: true` - Story involves legal matters
- `document_search_recommended: true` - Should search for court documents
- `real_name_search_needed: true` - Need to find government name for court records

**Document Search:**
The research workflow automatically searches the web for:
- Court records using entity names
- Arrest records and official documents
- Real/government names (for court record lookups)

Documents are included in the story prompt under `=== OFFICIAL DOCUMENTS & RECORDS ===`

**Example query:**
```json
{
  "query": "Bad Newz snitching allegations paperwork confession",
  "enable_document_search": true,
  "document_types": ["paperwork", "court records", "arrest"]
}
```

### Entity Gender Verification
When enriching entities, the system validates gender inferences to prevent errors like:
- Male owner of female league being marked as female
- Gender inferred from league type instead of person's actual gender

**Patterns that trigger review:**
- Entity associated with female league (QOTR, Queen of the Ring)
- Entity has owner/founder role at a gendered league
- Keywords like "women's", "female division" in context

**League Context:**
Entities now have a `league_context` field that distinguishes:
```typescript
{
  league_name: "QOTR",
  league_gender_focus: "female",  // Who participates
  person_role: "owner"            // Person's role
}
```

**Review Flags:**
- `gender_needs_review: true` - Gender may be incorrectly inferred
- `gender_review_reason: string` - Why it was flagged

In the story prompt, flagged entities show: `[GENDER UNVERIFIED - reason]`

### Story Title Generation
Titles are automatically generated based on story type:
- Battle stories: "Name1 vs Name2: The Full Story"
- Allegation stories: "Name: The Allegations Explained"
- Interview stories: "Name Speaks: Exclusive Breakdown"

### Interview Prioritization
The research workflow prioritizes longer content (interviews) over short reactions:

**Duration Scoring:**
- 30+ minutes: +40 bonus (long-form interviews)
- 20+ minutes: +25 bonus (medium interviews)
- 10+ minutes: +10 bonus (decent length)
- Under 10 min: No bonus (likely reactions/clips)

**Interview Indicators:**
- Title contains "interview", "sits down", "exclusive": +30 bonus
- Known platforms (HHIR, VladTV, No Jumper): +20 bonus

**Interview Platform Search:**
The system specifically searches for entities on interview platforms:
- `"Bad Newz HHIR"`, `"Bad Newz hip hop is real"`
- `"Debo interview"`, `"Debo vladtv"`

This ensures we find the actual person's interview (where they tell their story) rather than just blogger reactions.

## Notes for Claude

- Always use `twitterapi.io` endpoints, NOT official Twitter API
- YouTube uses `youtubei.js` - no API key needed
- Entity context is stored in `entities.metadata` JSONB field
- Jobs are queued via BullMQ through Redis

### Voice/TTS Guidelines
- **PRIMARY TTS**: Use Dia (`src/lib/dia.ts`) for ALL audio generation
- **DO NOT use ElevenLabs** - It's deprecated and replaced by Dia
- Dia supports multi-voice dialogue with [S1]/[S2] tags and emotional markers
- For consistent voices, use the same `seed` parameter
- For 3-speaker shows, use different seeds for different voice pairs
- Legacy voice: "Battlerap Algorithm" (ElevenLabs ID: ZJ7BlVZrxZKBDMTIK5c9) - DEPRECATED

### Content Generation
- The host personality is "Algorithm Institute" - documentary narrator style
- Always consider entity context when processing content (is this a battler being discussed, or a blogger discussing others?)

### New Services
- **SearXNG** runs at `http://localhost:8888` for web search
- **Presidium/Ollama** runs at `http://192.168.1.211:11434` for LLM (deep research)
- Per-topic intel config is stored in `topics.intel_config` JSONB field
- Use `mode: deep` in research endpoint for comprehensive historical research
- Onboarding APIs help set up new niches programmatically
