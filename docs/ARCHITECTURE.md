# Talk Show Go Architecture

## System Overview

Talk Show Go is an **intelligence-driven content generation system** that:

1. **Monitors sources** (Twitter, YouTube, web) for signals
2. **Extracts entities** and claims with rich context
3. **Assembles stories** from cross-referenced signals
4. **Generates audio content** with AI voices

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTENT KINGDOM                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  SOURCES                      PROCESSING                   OUTPUT       │
│  ─────────                    ───────────                  ──────       │
│  Twitter (twitterapi.io)  →   Entity Extraction     →    News Shows    │
│  YouTube Channels         →   Transcript Analysis   →    Documentaries │
│  Web Search (SearXNG)     →   Consensus Detection   →    Daily Audio   │
│  Perplexity Sonar         →   Story Assembly        →    Podcasts      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Content Pipeline

Content flows through **8 phases**, each with a military-inspired codename for memorable identification.

### Phase 1: OUTPOST (Setup)

**Purpose:** Define what you're tracking and where to look.

**Location:** `/outpost`

**What happens:**
- Create and configure topics (niches)
- Add Twitter accounts as sources
- Add YouTube channels for monitoring
- Configure known entities and story patterns

**Key files:**
- `src/app/outpost/page.tsx` - Main UI
- `src/app/api/topics/route.ts` - Topic CRUD
- `src/lib/topic-config.ts` - Configuration handling

---

### Phase 2: PERIMETER (Monitoring)

**Purpose:** Scan the perimeter for new signals from configured sources.

**Location:** `/perimeter`

**What happens:**
- Fetch tweets from source accounts (last 48 hours)
- Check YouTube channels for new videos
- Fetch video transcripts automatically
- Detect potential stories from signal overlap

**Key files:**
- `src/app/perimeter/page.tsx` - Signal monitor UI
- `src/lib/twitter-api.ts` - Twitter fetching
- `src/lib/youtube-api.ts` - YouTube fetching
- `src/app/api/intelligence/monitor/route.ts` - Monitor API

---

### Phase 3: EXTRACTION (Analysis)

**Purpose:** Extract entities and claims from raw content.

**Location:** `/extraction`

**What happens:**
- NLP entity recognition (people, orgs, events)
- Claim extraction from statements
- Relationship mapping between entities
- Context inference (roles, affiliations)

**Key files:**
- `src/app/extraction/page.tsx` - Entity map UI
- `src/lib/entity-extraction.ts` - Extraction logic
- `src/workers/jobs/extraction-run.ts` - Background job

---

### Phase 4: AUDIT (Verification)

**Purpose:** Score credibility and evaluate sources.

**Location:** `/audit`

**What happens:**
- Cross-reference claims across sources
- Score source reliability
- Track verification history
- Flag disputed information

**Key files:**
- `src/app/audit/page.tsx` - Credibility ledger UI
- `src/lib/credibility-scoring.ts` - Scoring logic

---

### Phase 5: TRIBUNAL (Decisions)

**Purpose:** Community nominations and verification votes.

**Location:** `/tribunal`

**What happens:**
- Submit nominations for new entities
- Vote on entity corrections
- Approve or reject nominations
- Merge duplicate entities

**Key files:**
- `src/app/tribunal/page.tsx` - Nominations UI
- `src/app/api/nominations/route.ts` - Nomination API

---

### Phase 6: NEXUS (Assembly)

**Purpose:** Assemble signals into coherent stories.

**Location:** `/nexus`

**What happens:**
- Group related signals by entity/time/topic
- Create story buckets (trending, breaking, feature)
- Rank stories by relevance and engagement
- Present story proposals with evidence

**Key files:**
- `src/app/nexus/page.tsx` - Story desk UI
- `src/lib/story-assembly.ts` - Assembly logic
- `src/app/api/stories/route.ts` - Stories API

---

### Phase 7: SANCTION (Production)

**Purpose:** Approve stories and generate content.

**Location:** `/sanction` and `/studio`

**What happens:**
- Select stories for production
- Choose host personality
- Generate scripts with AI
- Review and edit before audio

**Key files:**
- `src/app/sanction/page.tsx` - Story workbench
- `src/app/studio/daily-show/page.tsx` - Show wizard
- `src/lib/story-pipeline.ts` - Script generation
- `src/lib/hosts/index.ts` - Host personalities

---

### Phase 8: SIGNAL (Distribution)

**Purpose:** Export and distribute finished content.

**Location:** `/signal`

**What happens:**
- Generate audio with ElevenLabs TTS
- Concatenate multi-voice segments
- Export to various formats (MP3, WAV)
- Prepare for distribution

**Key files:**
- `src/app/signal/page.tsx` - Export center
- `src/lib/elevenlabs.ts` - TTS integration
- `src/app/api/exports/route.ts` - Export API

---

## Research Sources

| Source | Provider | Cost | Best For |
|--------|----------|------|----------|
| **Twitter** | twitterapi.io | $0.15/1K tweets | Real-time reactions, trending |
| **YouTube** | youtubei.js | FREE | Videos, transcripts, comments |
| **YouTube** | Official API | 10K units/day | Fallback when free fails |
| **Web Search** | SearXNG | FREE (self-hosted) | General research, documents |
| **Perplexity** | Sonar API | 5 credits/month | AI-synthesized answers |
| **Deep Research** | LLM + Web | LLM costs | Historical deep dives |

### Source Details

#### Twitter (twitterapi.io)
- **NOT** the official Twitter API
- Cost-effective for volume fetching
- Endpoints: user_timeline, search, user_info
- Rate limits apply per API key

#### YouTube (youtubei.js)
- Free, no API key required
- Unofficial client that mimics browser
- Can fetch transcripts, comments, video lists
- Fallback to official API if needed

#### SearXNG
- Self-hosted meta-search engine
- Runs at `http://localhost:8888`
- Aggregates results from multiple engines
- No tracking, completely free

#### Perplexity Sonar
- AI-powered search with citations
- 5 free searches per month (tracked in database)
- Best for complex research questions
- **RSS Discovery**: Automatically find RSS feeds for any niche
- **Structured Output**: Returns JSON data via schema validation
- **Entity Research**: Research people and organizations
- Configure via `PERPLEXITY_API_KEY` or Settings > API Keys UI
- Models: `sonar` (fast, ~$0.006/query), `sonar-pro` (deeper retrieval)

**Key Features:**
```typescript
// Search with structured JSON output
const { data } = await perplexity.searchStructured<MyType>({
  query: "Find RSS feeds for battle rap",
  schema: { name: 'feeds', schema: {...} }
})

// Discover RSS feeds for a niche
const result = await perplexity.discoverRSSFeeds("battle rap", ["URL", "KOTD"])
// Returns: { feeds: [...], notes: "...", sources_checked: [...] }

// Research an entity
const info = await perplexity.researchEntity("Geechi Gotti", "battle rap")
```

---

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library
- **Lucide** - Icon library

### Backend
- **Next.js API Routes** - REST endpoints
- **PostgreSQL** - Main database (with pgvector)
- **Redis** - Job queue (BullMQ)
- **Qdrant** - Vector database for RAG

### External Services
- **ElevenLabs** - Text-to-speech
- **twitterapi.io** - Twitter data
- **Anthropic/OpenAI** - LLM for analysis

### Docker Services
```
ck-postgres     - PostgreSQL database
ck-redis        - Redis for job queue
ck-postgrest    - REST API for database
ck-kong         - API gateway
ck-qdrant       - Vector database
ck-worker       - Background job processor
ck-searxng      - Self-hosted web search
```

---

## Naming Conventions

### Military Codenames

We use military terminology to make phases memorable and distinct:

| Codename | Military Meaning | In Talk Show Go |
|----------|------------------|-------------------|
| **OUTPOST** | Forward observation post | Topic setup and monitoring |
| **PERIMETER** | Defense boundary | Source scanning |
| **EXTRACTION** | Rescue operation | Pulling entities from content |
| **AUDIT** | Official inspection | Credibility verification |
| **TRIBUNAL** | Military court | Community decisions |
| **NEXUS** | Connection point | Story assembly |
| **SANCTION** | Official approval | Production authorization |
| **SIGNAL** | Communication transmission | Content distribution |

### Entity Terminology

| Term | Definition |
|------|------------|
| **Entity** | A person, organization, or concept being tracked |
| **Mention** | Where an entity appears in content |
| **Context** | Metadata about an entity (role, affiliations) |
| **Greenlight** | Approved for tracking or production |
| **Signal** | A piece of content that might be newsworthy |
| **Story Bucket** | A collection of related signals forming a story |

### Content Terminology

| Term | Definition |
|------|------------|
| **Host** | AI personality that narrates content |
| **Template** | Show structure (daily, documentary, etc.) |
| **Script** | Text for audio generation |
| **Segment** | Portion of a show (intro, story, outro) |

---

## Database Schema

### Core Tables

```sql
topics          - Content niches (battle rap, sports, etc.)
source_accounts - Twitter sources
youtube_channels - YouTube sources
youtube_videos   - Video metadata + transcripts
entities         - Extracted people, organizations, events
entity_aliases   - Name variations
entity_mentions  - Where entities appear
tweets_raw       - Raw tweet data
claims           - Extracted claims from content
stories          - Assembled narratives
api_usage        - API cost tracking
```

### Entity Context (JSONB)

```typescript
interface EntityContext {
  role?: string              // "battler", "blogger", "league_owner"
  sub_roles?: string[]       // Multiple roles
  gender?: 'male' | 'female' | 'other' | 'unknown'
  affiliations?: {
    name: string             // "URL", "KOTD"
    type: string             // "league", "media"
    status: 'current' | 'former' | 'rumored'
  }[]
  platforms?: {
    youtube_channel_id?: string
    twitter_handle?: string
  }
  is_primary_source?: boolean
  is_commentator?: boolean
  enrichment_status?: 'pending' | 'enriched' | 'locked'
}
```

---

## API Structure

### Topic APIs
- `GET /api/topics` - List all topics
- `POST /api/topics` - Create topic
- `GET /api/topics/[id]` - Get topic details
- `GET /api/topics/[id]/config` - Get intel config
- `PUT /api/topics/[id]/config` - Update intel config

### Entity APIs
- `GET /api/entities/[id]/context` - Get entity context
- `PATCH /api/entities/[id]/context` - Update context
- `POST /api/entities/[id]/enrich` - Trigger enrichment
- `POST /api/entities/[id]/enrich/lock` - Lock entity

### Intelligence APIs
- `POST /api/intelligence/monitor` - Trigger source scan
- `POST /api/intelligence/research` - Research a topic
- `GET /api/intelligence/stories` - Get proposed stories

### Search APIs
- `POST /api/search/perplexity` - Perplexity search
- `GET /api/search/perplexity` - Check credits

### RSS Discovery APIs
- `POST /api/rss/discover` - Discover RSS feeds for a niche using Perplexity
- `GET /api/rss/discover` - Check RSS discovery service status

### API Key Management APIs
- `GET /api/settings/api-keys` - Get status of all API keys
- `POST /api/settings/api-keys` - Save an API key
- `PUT /api/settings/api-keys` - Verify an API key without saving
- `DELETE /api/settings/api-keys` - Delete an API key

### Usage APIs
- `GET /api/usage` - Get usage summary

---

## Job System

Background jobs are processed via BullMQ with Redis.

### Queues

- **ingestion** - Source fetching jobs
- **processing** - Analysis jobs
- **editorial** - Content generation jobs

### Job Types

```typescript
// Ingestion
'perimeter_sweep'  - Discover new sources
'relay_fetch'      - Fetch from YouTube channels
'transcript_fetch' - Get video transcripts

// Processing
'extraction_run'   - Extract entities
'audit_score'      - Score credibility

// Editorial
'nexus_bucket'     - Assemble stories
'signal_export'    - Generate exports
```

---

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
SUPABASE_SERVICE_ROLE_KEY=...

# Twitter
TWITTER_API_KEY=...  # for twitterapi.io

# ElevenLabs
ELEVENLABS_API_KEY=...

# LLM
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Perplexity
PERPLEXITY_API_KEY=...

# Services
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
SEARXNG_URL=http://localhost:8888
```

### Intel Config (per topic)

```json
{
  "hours_back": 48,
  "min_sources": 2,
  "known_entities": ["URL", "KOTD", "Cassidy"],
  "story_patterns": ["vs", "battle", "announces"]
}
```

### API Key Management

API keys can be configured in two ways:

1. **Environment Variables** (recommended for production)
   - Set keys in `.env.local` or system environment
   - Read-only in the UI

2. **Settings UI** (recommended for development)
   - Navigate to Settings > API Keys
   - Enter keys for each service
   - Keys are stored in the `api_keys` database table
   - Keys are verified before saving

**Supported Services:**
| Service | Env Variable | Description |
|---------|--------------|-------------|
| Perplexity | `PERPLEXITY_API_KEY` | AI-powered search, RSS discovery |
| Twitter | `TWITTER_API_KEY` | twitterapi.io access |
| ElevenLabs | `ELEVENLABS_API_KEY` | Text-to-speech |
| OpenAI | `OPENAI_API_KEY` | GPT models |
| Anthropic | `ANTHROPIC_API_KEY` | Claude models |

**Key Priority:**
1. Database keys (from Settings UI)
2. Environment variables

---

## Development

### Running Locally

```bash
# Start all services
docker-compose up -d

# Start Next.js dev server
npm run dev

# Start worker (separate terminal)
npm run worker
```

### Migrations

```bash
# Run a migration
docker exec -i ck-postgres psql -U postgres -d talkshowgo < supabase/migrations/xxx.sql
```

### Testing APIs

```bash
# Trigger a monitor sweep
curl -X POST http://localhost:3000/api/intelligence/monitor \
  -H "Content-Type: application/json" \
  -d '{"topic_id": "your-topic-id"}'
```

---

## File Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── rss/discover/  # RSS feed discovery (Perplexity)
│   │   └── settings/api-keys/  # API key management
│   ├── outpost/           # Topic setup (with RSS discovery)
│   ├── perimeter/         # Signal monitoring
│   ├── extraction/        # Entity map
│   ├── audit/             # Credibility
│   ├── tribunal/          # Nominations
│   ├── nexus/             # Story desk
│   ├── sanction/          # Workbench
│   ├── signal/            # Export
│   ├── studio/            # Content studio
│   ├── settings/          # Settings pages
│   │   ├── usage/         # API usage dashboard
│   │   └── api-keys/      # API key management UI
│   └── guide/             # Documentation
├── components/
│   ├── layout/            # App shell, sidebar
│   └── ui/                # shadcn components
├── lib/
│   ├── twitter-api.ts     # Twitter client
│   ├── youtube-api.ts     # YouTube client
│   ├── elevenlabs.ts      # TTS client
│   ├── perplexity.ts      # Perplexity client (search, RSS, entities)
│   ├── api-usage.ts       # Cost tracking
│   ├── api-keys.ts        # API key management
│   ├── user-manual.ts     # Manual content
│   └── hosts/             # Host personalities
└── workers/
    ├── index.ts           # Worker entry
    └── jobs/              # Job handlers
```
