# TalkShowGo Architecture

## Overview

TalkShowGo is an **AI-powered autonomous content generation system** that transforms social media intelligence into broadcast-ready debate shows. The system uses Twitter as its primary intelligence source and employs AI "producers" to analyze opportunities and generate professional content.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TALKSHOWGO PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   TWITTER    │     │   YOUTUBE    │     │     WEB      │                │
│  │   API.IO     │     │  (youtubei)  │     │  (SearXNG)   │                │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│         │                    │                    │                         │
│         └────────────────────┴────────────────────┘                         │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    INTELLIGENCE LAYER                                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │tweets_raw   │  │youtube_videos│  │entities     │  │claims       │  │ │
│  │  │(Twitter DB) │  │(Transcripts) │  │(People/Orgs)│  │(Verified)   │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    PRODUCER AI LAYER                                   │ │
│  │                                                                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │ │
│  │  │ DRAMA       │  │ FACT        │  │ STORY       │                   │ │
│  │  │ HUNTER      │  │ CHECKER     │  │ TELLER      │                   │ │
│  │  │ 🔥          │  │ 📊          │  │ 📖          │                   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │ │
│  │  │ SPEED       │  │ DEEP        │  │ COMMUNITY   │                   │ │
│  │  │ DEMON       │  │ DIVER       │  │ PULSE       │                   │ │
│  │  │ ⚡          │  │ 🔍          │  │ 🎤          │                   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │ │
│  │                                                                        │ │
│  │  Each producer has unique:                                            │ │
│  │  • Risk tolerance    • Verification rigor                             │ │
│  │  • Source limits     • Format preferences                             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    ORCHESTRATION LAYER                                 │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    HOST GENERATOR                                │  │ │
│  │  │  Creates AI personalities with distinct voices:                  │  │ │
│  │  │  • Opinion strength    • Aggression level                       │  │ │
│  │  │  • Humor quotient      • Analytical depth                       │  │ │
│  │  │  • Speaking speed      • Formality level                        │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                              │                                         │ │
│  │                              ▼                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    DEBATE ORCHESTRATOR                           │  │ │
│  │  │  Manages multi-turn conversations:                               │  │ │
│  │  │  1. Opening statements                                          │  │ │
│  │  │  2. Main discussion (turn-taking algorithm)                     │  │ │
│  │  │  3. Rebuttals and challenges                                    │  │ │
│  │  │  4. Closing statements                                          │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    OUTPUT LAYER                                        │ │
│  │                                                                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │ │
│  │  │ TEXT        │  │ AUDIO       │  │ VIDEO       │                   │ │
│  │  │ Script      │  │ (DIA TTS)   │  │ (Future)    │                   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Intelligence Layer

**Purpose:** Gather and store raw data from social media and web sources.

#### Twitter Intelligence (`src/lib/twitter-intelligence.ts`)
- **Primary data source** for real-time trends
- Connects to TwitterAPI.io (NOT official Twitter API)
- Extracts:
  - Trending tweets with engagement metrics
  - Discussion topics with sentiment analysis
  - Entities (people, organizations, events)
  - Claims being made in the community

```typescript
interface TwitterActivity {
  trending_tweets: TrendingTweet[]      // High-engagement tweets
  discussion_topics: DiscussionTopic[]  // What people are talking about
  entities: Entity[]                     // Who's being mentioned
  claims: Claim[]                        // What's being claimed
  youtube_queries: string[]              // Generated search queries
}
```

#### Database Schema
- `tweets_raw` - Raw tweet storage
- `youtube_videos` - Video metadata + transcripts
- `entities` - Extracted people/organizations
- `claims` - Verified/unverified claims
- `topics` - Content niches (battle rap, sports, etc.)

---

### 2. Producer AI Layer

**Purpose:** Analyze opportunities and decide what content to create.

#### 6 Producer Archetypes (`src/lib/producers/`)

| Producer | Personality | Best For | Speed | Accuracy | Engagement |
|----------|-------------|----------|-------|----------|------------|
| **Drama Hunter** 🔥 | Controversy-seeking | Debates, hot takes | Fast | Moderate | ⭐⭐⭐⭐⭐ |
| **Fact Checker** 📊 | Skeptical, thorough | Investigations | Slow | Very High | ⭐⭐⭐ |
| **Deep Diver** 🔍 | Obsessive researcher | Deep dives | Very Slow | High | ⭐⭐⭐⭐ |
| **Speed Demon** ⚡ | Breaking news focus | Quick reactions | Very Fast | Moderate | ⭐⭐⭐ |
| **Storyteller** 📖 | Narrative-driven | Documentaries | Moderate | High | ⭐⭐⭐⭐⭐ |
| **Community Pulse** 🎤 | Sentiment-aware | Panel discussions | Moderate | Moderate | ⭐⭐⭐⭐ |

#### Producer Decision Flow

```
Opportunity Detected (Twitter Intelligence)
         │
         ▼
┌─────────────────────────┐
│ Producer Analyzes:      │
│ • Controversy level     │
│ • Source count          │
│ • Verification status   │
│ • Engagement potential  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Decision:               │
│ • shouldProduce: bool   │
│ • suggestedFormat       │
│ • confidence: 0-1       │
│ • reasoning: string     │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Production Goal:        │
│ • 5Ws (Who/What/etc)    │
│ • Angle & Tone          │
│ • Format structure      │
│ • Quality gates         │
└─────────────────────────┘
```

---

### 3. Orchestration Layer

**Purpose:** Generate multi-host conversations with distinct personalities.

#### Host Generator (`src/lib/debate/host-generator.ts`)

Creates AI host personalities with these attributes:
- **opinion_strength** (0-100): How strongly they hold views
- **aggression** (0-100): Confrontational vs diplomatic
- **humor** (0-100): Serious vs comedic
- **analytical_depth** (0-100): Surface vs deep analysis
- **empathy** (0-100): Combative vs understanding
- **speed** (0-100): Slow/methodical vs rapid-fire
- **formality** (0-100): Casual vs professional

#### Debate Orchestrator (`src/lib/debate/orchestrator.ts`)

**Turn-Taking Algorithm:**
```
For each turn:
  1. Calculate speaking probability for each host
  2. Consider:
     - Time since last spoke (fairness)
     - Personality traits (aggression = wants to speak more)
     - Conversation flow (rebuttal opportunities)
  3. Select next speaker
  4. Generate response with full conversation context
  5. Inject emotional beat guidance if specified
```

**Conversation Structure:**
1. **Opening Statements** - Each host presents their position
2. **Main Discussion** - Dynamic back-and-forth debate
3. **Rebuttals** - Direct challenges and responses
4. **Closing Statements** - Final summary of positions

---

### 4. Output Layer

**Purpose:** Transform generated conversations into publishable formats.

#### Text Output
- Full conversation transcript
- Speaker labels with timestamps
- Emotional/stage direction markers

#### Audio Output (DIA TTS)
- Multi-voice synthesis with [S1]/[S2] speaker tags
- Emotional markers: (laughs), (sighs), (gasps), etc.
- Consistent voices via seed parameter
- ~2x realtime generation on GPU

---

## Data Flow

### Daily Show Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DAILY AUTOMATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  8:00 AM ─────►  PERIMETER SWEEP                                           │
│                  • Fetch tweets from last 24 hours                         │
│                  • Store in tweets_raw table                               │
│                                                                             │
│  8:05 AM ─────►  TWITTER INTELLIGENCE                                      │
│                  • Analyze tweet content with LLM                          │
│                  • Extract topics, entities, claims                        │
│                  • Score opportunity potential                             │
│                                                                             │
│  8:10 AM ─────►  PRODUCER SELECTION                                        │
│                  • Match opportunity type to producer                      │
│                  • Controversy → Drama Hunter                              │
│                  • Breaking → Speed Demon                                  │
│                  • Developing → Storyteller                                │
│                                                                             │
│  8:15 AM ─────►  SHOW GENERATION                                           │
│                  • Producer creates production brief                       │
│                  • Auto-select optimal hosts                               │
│                  • Generate 15-20 minute conversation                      │
│                                                                             │
│  8:30 AM ─────►  QUALITY GATES                                             │
│                  • Check readiness score (0-100%)                          │
│                  • Verify sources, conflict, 5Ws                           │
│                  • Auto-publish if >70%, else flag for review             │
│                                                                             │
│  8:35 AM ─────►  NOTIFICATION                                              │
│                  • Email summary to producers                              │
│                  • Include stats, cost, quality metrics                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Producer API

```
POST /api/producer/generate-show
{
  "producer_archetype": "drama_hunter",
  "topic_id": "uuid",
  "topic": "Is Cassidy washed?",
  "target_duration_minutes": 15
}

Response:
{
  "success": true,
  "show_run_id": "uuid",
  "producer": { "name": "The Drama Hunter", ... },
  "hosts": [...],
  "quality": { "readiness_score": 0.85, "status": "ready_to_publish" },
  "stats": { "turns": 30, "words": 1500, "cost_usd": 0.02 }
}
```

### Intelligence API

```
GET /api/twitter/digest?topic_id=xxx
POST /api/intelligence/monitor
POST /api/intelligence/research
```

---

## Technology Stack

### Core Services (Docker)
| Service | Purpose | Port |
|---------|---------|------|
| PostgreSQL (pgvector) | Main database | 5432 |
| PostgREST | REST API for PostgreSQL | 3001 |
| Kong | API Gateway | 8000 |
| Redis | Job queue (BullMQ) | 6379 |
| Qdrant | Vector database for RAG | 6333 |
| SearXNG | Self-hosted web search | 8888 |
| DIA TTS | Multi-voice synthesis | 8765 |

### External APIs
| API | Purpose |
|-----|---------|
| TwitterAPI.io | Twitter data (NOT official API) |
| Requesty | LLM access (OpenRouter-compatible) |
| Perplexity | Real-time web search |

### Key Libraries
- **Next.js 14** - Web framework
- **BullMQ** - Job queue
- **youtubei.js** - Free YouTube client
- **DeepSeek** - Primary LLM model

---

## Quality Assurance

### Readiness Scoring

Every show is scored on 4 dimensions:

| Gate | Weight | Description |
|------|--------|-------------|
| **Enough Sources** | 25% | Min sources based on producer rigor |
| **Has Conflict** | 25% | Opposing viewpoints present |
| **Has 5Ws** | 25% | Who, What, Where, When, Why |
| **Is Verified** | 25% | Source credibility check |

**Score Calculation:**
```
readiness = 0.25 * hasEnoughSources +
            0.25 * hasConflict +
            0.25 * has5Ws +
            0.25 * isVerified
```

**Thresholds:**
- **>70%**: Auto-publish
- **50-70%**: Review recommended
- **<50%**: Do not publish

---

## Cost Analysis

### Per-Show Costs (DeepSeek Model)

| Component | Tokens | Cost |
|-----------|--------|------|
| Host preparation | ~500 | $0.007 |
| Opening statements (2x) | ~400 | $0.006 |
| Main discussion (30 turns) | ~15,000 | $0.21 |
| Closing statements (2x) | ~400 | $0.006 |
| **Total** | ~16,300 | **~$0.02** |

### Daily Operations
- 3 shows/day × $0.02 = **$0.06/day**
- 90 shows/month = **$1.80/month**

---

## File Structure

```
src/
├── lib/
│   ├── debate/
│   │   ├── orchestrator.ts         # Conversation generation
│   │   ├── host-generator.ts       # Host personality creation
│   │   ├── producer-orchestrator.ts # Producer + debate integration
│   │   └── types.ts                # TypeScript interfaces
│   ├── producers/
│   │   ├── index.ts                # Producer class
│   │   └── types.ts                # Producer archetypes
│   ├── twitter-intelligence.ts     # Twitter analysis
│   ├── openrouter.ts              # LLM API client
│   └── dia.ts                      # Multi-voice TTS
├── app/api/
│   ├── producer/generate-show/     # Main generation endpoint
│   ├── debate/show/generate/       # Direct debate generation
│   └── intelligence/               # Twitter/research APIs
└── workers/
    └── jobs/                       # Background job processors

Scripts:
├── daily-producer-run.ts           # Automated daily pipeline
├── generate-battlerap-show.ts      # Manual show generation
├── iterate-shows.ts                # Iteration testing
└── show-twitter-trends.ts          # Quick Twitter analysis
```

---

## Future Enhancements

### Planned Features
- [ ] Multi-producer collaboration (Drama Hunter finds, Fact Checker verifies)
- [ ] Custom producer archetypes
- [ ] Producer vs Producer meta-debates
- [ ] Real-time producer dashboard
- [ ] A/B testing different producers
- [ ] Video output with avatars
- [ ] Audience interaction integration

### Scaling Considerations
- Horizontal scaling via Kubernetes
- Rate limiting for API endpoints
- Caching layer for repeated queries
- Webhook notifications for external integrations

---

## Summary

TalkShowGo transforms social media noise into professional broadcast content through:

1. **Intelligence Gathering** - Twitter-first approach to real-time trends
2. **Producer AI** - Autonomous decision-making with distinct personalities
3. **Dynamic Orchestration** - Multi-host conversations with natural flow
4. **Quality Assurance** - Automated scoring prevents low-quality output
5. **Cost Efficiency** - ~$0.02 per 15-minute show

The system is designed to run autonomously, generating daily content with minimal human intervention while maintaining broadcast-quality standards.
