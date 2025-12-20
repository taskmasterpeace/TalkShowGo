# Talk Show Go
## Product Requirements Document

---

## Executive Summary

**Talk Show Go** is an automated news intelligence and story generation platform that monitors social media, extracts entities and claims, verifies information through engagement-based credibility scoring, and produces publication-ready stories for any niche - from Battle Rap to small-town news to sports teams.

**Talk Show Expressions** is the interactive content layer that transforms Talk Show Go's intelligence into dynamic podcasts and talk shows using AI-driven interviews, personality profiles, and 11Labs voice synthesis.

---

## The Pipeline: OPERATIONS

Each phase has a codename. Together they form the **OPERATIONS** pipeline:

| Phase | Codename | Purpose |
|-------|----------|---------|
| 1 | **OUTPOST** | Source seeding - define topic + initial Twitter accounts |
| 2 | **PERIMETER** | Data sweep - collect tweets, threads, replies, engagement |
| 3 | **EXTRACTION** | Entity & claim extraction - people, places, things, events |
| 4 | **RELAY** | YouTube trusted channels - monitor known credible sources |
| 5 | **RECON** | YouTube search - topic-based discovery for context |
| 6 | **AUDIT** | Verification layer - engagement-weighted credibility scoring |
| 7 | **TRIBUNAL** | Source nomination - discover and vet new accounts |
| 8 | **INTEL** | Web/RSS sweep - optional verification against websites |
| 9 | **OVERRIDE** | Consensus & contention - determine fact vs. disputed |
| 10 | **NEXUS** | Story assembly - bucket and structure narratives |
| 11 | **SANCTION** | Editorial greenlight - human approval gate |
| 12 | **SIGNAL** | Export dispatch - send to Director's Palette + 11Labs |

---

## Phase 1: OUTPOST
### Source Seeding & Topic Definition

**Purpose:** Establish the intelligence perimeter - what topic and who to monitor.

**Inputs:**
- Topic name (e.g., "Battle Rap", "Philadelphia Eagles", "Smithville TX")
- Seed Twitter accounts (10-20 accounts that are pulse-setters in that niche)
- Optional: Account metadata notes (who they are, their angle, reliability notes)

**Outputs:**
- `topics` table entry
- `source_accounts` entries with status=active
- Topic-specific credibility weight configuration

**User Actions:**
- Create new topic
- Add Twitter handles with optional notes
- Set initial credibility thresholds (subscriber minimums, engagement floors)

**Data Model:**
```
topics
├── id (uuid)
├── name (string) - "Battle Rap"
├── description (text)
├── created_at (timestamp)
└── status (enum: active, paused, archived)

source_accounts
├── id (uuid)
├── topic_id (fk)
├── platform (enum: twitter, youtube, rss)
├── handle (string) - "@battlerap_news"
├── display_name (string)
├── description (text) - their bio
├── notes (text) - YOUR notes about them
├── credibility_score (float) - computed
├── status (enum: seed, nominated, verified, banned)
├── added_at (timestamp)
└── last_checked (timestamp)
```

---

## Phase 2: PERIMETER
### Data Collection Sweep

**Purpose:** Systematically collect content from all seeded sources.

**Process:**
1. For each active source account:
   - Fetch recent tweets (last 24h or since last check)
   - Fetch thread context (replies, quotes, retweets)
   - Capture engagement metrics (likes, retweets, replies, views)
   - Store raw payload for reprocessing

2. For each tweet:
   - Identify if it's original, reply, quote, or retweet
   - Build conversation graph (who replied to whom)
   - Flag high-engagement outliers

**Outputs:**
- `tweets_raw` entries
- `tweet_threads` relationship mappings
- Engagement snapshots for velocity tracking

**Data Model:**
```
tweets_raw
├── id (uuid)
├── tweet_id (string) - Twitter's ID
├── topic_id (fk)
├── source_account_id (fk)
├── text (text)
├── author_handle (string)
├── author_name (string)
├── tweet_type (enum: original, reply, quote, retweet)
├── reply_to_tweet_id (string, nullable)
├── quote_of_tweet_id (string, nullable)
├── metrics_likes (int)
├── metrics_retweets (int)
├── metrics_replies (int)
├── metrics_views (int)
├── media_urls (jsonb)
├── links (jsonb)
├── created_at (timestamp) - tweet timestamp
├── fetched_at (timestamp)
└── raw_payload (jsonb)

tweet_threads
├── id (uuid)
├── root_tweet_id (fk)
├── tweet_id (fk)
├── thread_position (int)
└── relationship (enum: reply, quote, retweet)
```

**Worker Job:** `perimeter_sweep`
- Runs: Every 4 hours (configurable per topic)
- Rate limit aware: Backs off on 429, tracks quota
- Incremental: Only fetches since last checkpoint

---

## Phase 3: EXTRACTION
### Entity & Claim Extraction

**Purpose:** Transform raw social content into structured intelligence - who, what, where, when.

**Process:**
1. Batch tweets by time window
2. LLM extraction pass:
   - **Entities:** People, organizations, places, events, products
   - **Claims:** Assertions being made (X said Y, X happened, X is true)
   - **Sentiment:** How the author feels about the entities/claims
   - **Topics:** What categories this touches

3. Deduplicate and canonicalize:
   - "Loaded Lux" = "@LoadedLux" = "Lux" = same entity
   - Build entity aliases table

4. Link mentions back to source tweets

**Outputs:**
- `entities` - canonical entity records
- `entity_aliases` - variant names/handles
- `entity_mentions` - entity <-> tweet links
- `claims` - normalized claim statements
- `claim_mentions` - claim <-> tweet links

**Data Model:**
```
entities
├── id (uuid)
├── topic_id (fk)
├── canonical_name (string) - "Loaded Lux"
├── entity_type (enum: person, org, place, event, product, other)
├── description (text) - auto-generated summary
├── notes (text) - YOUR manual notes
├── first_seen (timestamp)
├── mention_count (int) - computed
└── metadata (jsonb)

entity_aliases
├── id (uuid)
├── entity_id (fk)
├── alias (string) - "@LoadedLux", "Lux", "Loaded"
└── source (enum: extracted, manual)

entity_mentions
├── id (uuid)
├── entity_id (fk)
├── tweet_id (fk)
├── mention_type (enum: subject, object, reference)
├── sentiment (enum: positive, negative, neutral, mixed)
└── context_snippet (text)

claims
├── id (uuid)
├── topic_id (fk)
├── claim_text (text) - normalized statement
├── claim_type (enum: factual, opinion, prediction, rumor)
├── cluster_id (uuid, nullable) - groups same claims
├── first_seen (timestamp)
├── mention_count (int)
└── status (enum: emerging, active, stale)

claim_mentions
├── id (uuid)
├── claim_id (fk)
├── tweet_id (fk)
├── stance (enum: supports, denies, neutral, questions)
└── extracted_at (timestamp)
```

**LLM Prompts (versioned in DB):**
```
prompt_templates
├── id (uuid)
├── name (string) - "entity_extraction_v2"
├── template (text)
├── model (string) - "gpt-4o"
├── version (int)
├── active (bool)
└── created_at (timestamp)
```

---

## Phase 4: RELAY
### YouTube Trusted Channels

**Purpose:** Monitor known credible YouTube channels for the topic to gather deeper context.

**Process:**
1. For each trusted channel:
   - Fetch recent videos (last 7 days)
   - Extract title, description, tags
   - Get view count, like count, comment count
   - Optionally fetch transcript (for deeper analysis)

2. Match videos to entities/claims from EXTRACTION:
   - Does this video mention entities we're tracking?
   - Does it address claims we've identified?

**Outputs:**
- `youtube_channels` - trusted channel registry
- `youtube_videos` - video metadata
- `video_entity_links` - connections to our entities

**Data Model:**
```
youtube_channels
├── id (uuid)
├── topic_id (fk)
├── channel_id (string) - YouTube channel ID
├── channel_name (string)
├── handle (string) - @handle
├── subscriber_count (int)
├── description (text)
├── notes (text) - YOUR notes ("Battle rap journalist, reliable")
├── credibility_score (float)
├── status (enum: trusted, monitoring, banned)
└── last_checked (timestamp)

youtube_videos
├── id (uuid)
├── channel_id (fk)
├── video_id (string) - YouTube video ID
├── title (string)
├── description (text)
├── tags (jsonb)
├── published_at (timestamp)
├── duration_seconds (int)
├── view_count (int)
├── like_count (int)
├── comment_count (int)
├── transcript (text, nullable)
├── fetched_at (timestamp)
└── processed (bool)

video_entity_links
├── id (uuid)
├── video_id (fk)
├── entity_id (fk)
├── relevance_score (float)
└── context_snippet (text)
```

**Trusted Channels per Topic (examples):**
- Battle Rap: @BattleRapTrap, @ChrisHBias, @AngryFan
- Each gets notes explaining their angle/bias/specialty

---

## Phase 5: RECON
### YouTube Topic Search

**Purpose:** Search YouTube broadly for topic-related content beyond trusted channels.

**Process:**
1. Generate search queries from:
   - Entity names (especially people)
   - Claim keywords
   - Topic + timeframe ("battle rap news December 2024")

2. Execute searches and filter results:
   - Check against credibility thresholds
   - Subscriber count minimum (configurable slider)
   - View velocity (views relative to age)
   - Channel verification status

3. Flag new channels for TRIBUNAL review

**Credibility Thresholds (per topic):**
```
credibility_profiles
├── id (uuid)
├── topic_id (fk)
├── youtube_min_subscribers (int) - default 10000
├── youtube_min_views (int) - default 1000
├── youtube_verified_bonus (float) - +0.2
├── twitter_min_followers (int) - default 1000
├── twitter_verified_bonus (float) - +0.1
├── engagement_weight (float) - how much engagement matters
└── recency_weight (float) - how much freshness matters
```

**Decision Logic:**
```
IF video.channel.subscribers < threshold THEN
  SKIP (low credibility)
ELSE IF video.channel IN banned_list THEN
  SKIP (known bad actor)
ELSE IF video.channel NOT IN trusted_list THEN
  FLAG for TRIBUNAL nomination
ELSE
  PROCESS normally
```

---

## Phase 6: AUDIT
### Verification & Credibility Scoring

**Purpose:** Establish what's credible through engagement analysis and cross-reference.

**Process:**

**A) Engagement Scoring:**
For each claim, calculate engagement-weighted consensus:
```
claim_score = SUM(
  tweet.engagement_score * author.credibility_score * stance_weight
) / total_mentions

WHERE:
  engagement_score = (likes * 1) + (retweets * 2) + (replies * 1.5) + (views * 0.01)
  stance_weight = +1 (supports), -1 (denies), 0 (neutral)
```

**B) Cross-Source Verification:**
- Same claim from multiple sources = higher confidence
- Conflicting claims = flag as contentious
- Single source = flag as unverified

**C) Comment Analysis:**
For high-engagement tweets:
1. Fetch top comments/replies
2. Analyze sentiment and stance
3. Look for corrections, additions, or contradictions
4. Identify commenters worth nominating (TRIBUNAL)

**Outputs:**
```
consensus_scores
├── id (uuid)
├── claim_id (fk)
├── consensus (float) - -1 to +1 (denied to confirmed)
├── contention (float) - 0 to 1 (agreement to controversy)
├── confidence (float) - 0 to 1 (evidence strength)
├── source_count (int)
├── engagement_total (int)
├── computed_at (timestamp)
└── evidence_summary (text) - LLM summary of evidence
```

**Credibility Ledger:**
```
source_credibility_log
├── id (uuid)
├── source_account_id (fk)
├── topic_id (fk)
├── period_start (timestamp)
├── period_end (timestamp)
├── claims_made (int)
├── claims_verified (int)
├── claims_disputed (int)
├── engagement_generated (int)
└── credibility_delta (float) - change in score
```

---

## Phase 7: TRIBUNAL
### Source Nomination & Vetting

**Purpose:** Discover and evaluate new sources found in comments, links, or searches.

**Discovery Sources:**
1. High-engagement commenters on tracked tweets
2. Accounts frequently mentioned by tracked sources
3. Channels found in RECON search
4. Links shared in tracked content

**Nomination Process:**
```
nominations
├── id (uuid)
├── topic_id (fk)
├── platform (enum: twitter, youtube, website)
├── identifier (string) - handle, channel_id, or URL
├── discovered_via (string) - "comment on tweet X", "mentioned by @Y"
├── discovery_context (text)
├── preliminary_score (float) - auto-calculated
├── status (enum: pending, approved, rejected, deferred)
├── reviewed_by (string, nullable)
├── reviewed_at (timestamp, nullable)
├── rejection_reason (text, nullable)
└── created_at (timestamp)
```

**Auto-Scoring for Nominations:**
```
preliminary_score = (
  follower_count_normalized * 0.3 +
  engagement_rate * 0.3 +
  mention_frequency * 0.2 +
  topic_relevance * 0.2
)
```

**User Actions:**
- Review nomination inbox
- Approve (adds to source_accounts with status=verified)
- Reject (with reason)
- Defer (need more data)

---

## Phase 8: INTEL
### Web & RSS Verification

**Purpose:** Cross-reference claims against web sources and RSS feeds.

**Process:**
1. For claims that need verification:
   - Generate search queries
   - Check known news sites relevant to topic
   - Fetch and extract article content

2. RSS monitoring:
   - Subscribe to relevant feeds
   - Match new articles to tracked entities/claims

**Threshold Logic:**
```
IF claim.type == "factual" AND claim.confidence < 0.7 THEN
  SEARCH web for corroboration
  IF found on credible site THEN
    BOOST confidence
  ELSE IF contradicted THEN
    FLAG as disputed
  ELSE
    MARK as web_unverified
```

**Data Model:**
```
web_sources
├── id (uuid)
├── topic_id (fk)
├── url (string)
├── domain (string)
├── title (string)
├── content_extract (text)
├── published_at (timestamp, nullable)
├── fetched_at (timestamp)
└── linked_claim_ids (uuid[])

rss_feeds
├── id (uuid)
├── topic_id (fk)
├── feed_url (string)
├── name (string)
├── last_fetched (timestamp)
└── status (enum: active, paused, error)
```

---

## Phase 9: OVERRIDE
### Consensus & Contention Resolution

**Purpose:** Determine final fact/fiction/disputed status for each claim.

**Classification:**
```
claim_verdicts
├── id (uuid)
├── claim_id (fk)
├── verdict (enum: confirmed, likely, uncertain, disputed, debunked)
├── reasoning (text) - LLM explanation
├── evidence_for (jsonb) - supporting sources
├── evidence_against (jsonb) - contradicting sources
├── requires_editorial (bool) - needs human review
└── computed_at (timestamp)
```

**Verdict Logic:**
```
IF consensus > 0.7 AND contention < 0.3 AND confidence > 0.6 THEN
  verdict = "confirmed"
ELSE IF consensus > 0.5 AND confidence > 0.4 THEN
  verdict = "likely"
ELSE IF contention > 0.6 THEN
  verdict = "disputed"
ELSE IF consensus < -0.5 AND confidence > 0.5 THEN
  verdict = "debunked"
ELSE
  verdict = "uncertain"
```

---

## Phase 10: NEXUS
### Story Assembly

**Purpose:** Bundle related entities, claims, and evidence into coherent story packages.

**Story Bucketing:**
```
story_buckets (enum):
- breaking: High velocity, just emerged, time-sensitive
- developing: Active story, new information coming in
- background: Context/history relevant to current events
- recurring: Ongoing saga, periodic updates
- feature: Deep dive opportunity, not time-sensitive
```

**Auto-Bucketing Logic:**
```
IF claim.first_seen < 24h AND engagement_velocity > threshold THEN
  bucket = "breaking"
ELSE IF claim.mention_count_delta > threshold THEN
  bucket = "developing"
ELSE IF claim.relates_to_previous_story THEN
  bucket = "recurring"
ELSE IF claim.entity_depth > threshold THEN
  bucket = "feature"
ELSE
  bucket = "background"
```

**Data Model:**
```
story_candidates
├── id (uuid)
├── topic_id (fk)
├── bucket (enum)
├── headline (string) - auto-generated
├── summary (text) - auto-generated
├── primary_entities (uuid[])
├── primary_claims (uuid[])
├── evidence_package (jsonb)
├── confidence_score (float)
├── engagement_total (int)
├── created_at (timestamp)
├── status (enum: candidate, reviewing, greenlit, killed)
└── priority_rank (int)

story_entity_links
├── story_candidate_id (fk)
├── entity_id (fk)
├── role (enum: subject, related, background)
└── importance (float)

story_claim_links
├── story_candidate_id (fk)
├── claim_id (fk)
├── centrality (float) - how central to the story
└── verdict_at_assembly (string)
```

---

## Phase 11: SANCTION
### Editorial Greenlight

**Purpose:** Human decision gate - approve stories for production.

**Story Workbench Features:**

**A) Story Card View:**
- Headline + summary
- Key entities (clickable to drill down)
- Key claims with verdicts
- Source count and credibility breakdown
- Engagement metrics
- Bucket classification

**B) Integrity Panel:**
Risk flags to check before greenlight:
- [ ] Unverified claims present
- [ ] Single-source claims
- [ ] Missing counterpoint (contention detected but not represented)
- [ ] Entity with no context (mentioned but we know nothing)
- [ ] Credibility concerns (low-cred sources dominant)

**C) Editorial Controls:**
```
story_drafts
├── id (uuid)
├── story_candidate_id (fk)
├── angle (string) - "news", "explainer", "debate", "documentary"
├── tone (string) - "serious", "casual", "dramatic", "humorous"
├── length (enum: short, medium, long)
├── format (string) - custom format instructions
├── draft_content (text)
├── revision_number (int)
├── created_at (timestamp)
└── status (enum: draft, approved, sent)
```

**D) Greenlight Action:**
```
stories (greenlit only)
├── id (uuid)
├── story_candidate_id (fk)
├── final_headline (string)
├── final_content (text)
├── greenlit_by (string)
├── greenlit_at (timestamp)
├── integrity_checklist (jsonb) - signed off items
└── production_status (enum: pending, in_production, published)
```

---

## Phase 12: SIGNAL
### Export to Production

**Purpose:** Package and dispatch approved stories to Director's Palette and 11Labs.

**Export Package Structure:**
```json
{
  "story_id": "uuid",
  "headline": "...",
  "content": "...",
  "entities": [
    {
      "name": "Loaded Lux",
      "type": "person",
      "role": "subject",
      "visual_description": "...",
      "notes": "..."
    }
  ],
  "locations": [
    {
      "name": "URL TV Studio",
      "type": "venue",
      "visual_description": "..."
    }
  ],
  "scenes": [
    {
      "scene_number": 1,
      "description": "...",
      "narration": "...",
      "visual_instruction": "...",
      "duration_seconds": 15,
      "entities_present": ["Loaded Lux"]
    }
  ],
  "narration": {
    "full_script": "...",
    "voice_profile": "news_anchor_male",
    "pacing": "moderate"
  },
  "metadata": {
    "topic": "Battle Rap",
    "bucket": "breaking",
    "sources_count": 12,
    "confidence": 0.85
  }
}
```

**Data Model:**
```
export_packages
├── id (uuid)
├── story_id (fk)
├── package_json (jsonb)
├── destination (enum: directors_palette, 11labs, both)
├── sent_at (timestamp)
├── status (enum: pending, sent, acknowledged, failed)
├── response (jsonb, nullable)
└── version (int)
```

---

## Talk Show Expressions Integration

### Overview

Talk Show Expressions transforms Talk Show Go intelligence into interactive audio/video content through AI-driven interviews and personality-based show generation.

### Personality Prints

```
personality_prints
├── id (uuid)
├── user_id (fk) - the human this represents
├── name (string)
├── voice_profile_id (string) - 11Labs voice ID
├── communication_style (jsonb)
│   ├── tone (string) - "casual", "formal", "passionate"
│   ├── vocabulary_level (string)
│   ├── humor_style (string)
│   └── debate_style (string) - "aggressive", "measured", "socratic"
├── interests (string[])
├── hot_takes (jsonb) - known opinions on topics
├── interview_history (jsonb) - previous responses
└── created_at (timestamp)
```

### Show Formats

```
show_formats
├── id (uuid)
├── name (string) - "Point/Counterpoint", "Deep Dive", "Hot Takes"
├── description (text)
├── participant_count (int)
├── structure (jsonb)
│   ├── segments (array of segment types)
│   ├── intro_style (string)
│   ├── transition_style (string)
│   └── outro_style (string)
├── question_templates (jsonb)
└── duration_target_minutes (int)
```

### Interview Sessions (11Labs Calls)

```
interview_sessions
├── id (uuid)
├── personality_print_id (fk)
├── show_id (fk, nullable)
├── topic_id (fk)
├── interviewer_voice_id (string) - 11Labs voice for the "producer"
├── questions_asked (jsonb)
├── responses (jsonb)
├── audio_recording_url (string, nullable)
├── transcript (text)
├── extracted_opinions (jsonb)
├── call_duration_seconds (int)
├── status (enum: scheduled, in_progress, completed, failed)
└── created_at (timestamp)
```

### Show Assembly

```
shows
├── id (uuid)
├── topic_id (fk)
├── format_id (fk)
├── title (string)
├── participants (uuid[]) - personality_print_ids
├── source_stories (uuid[]) - story_ids used
├── script (text) - generated show script
├── audio_url (string, nullable)
├── video_url (string, nullable)
├── status (enum: drafting, recording, editing, published)
└── created_at (timestamp)
```

### Interactive Pre-Show Mode

Future feature: Users can interrupt and interact with the show during a "rehearsal" phase before final generation.

---

## User Interface Requirements

### Screen 1: Command Center (Dashboard)
- Topic selector
- Pipeline status (which phases running)
- Recent activity feed
- Quick stats (stories pending, sources active, claims tracked)

### Screen 2: OUTPOST - Source Management
- Add/edit topics
- Add/edit Twitter accounts with notes
- Add/edit YouTube channels with notes
- Credibility slider configuration
- Source status management (active/paused/banned)

### Screen 3: PERIMETER - Signal Monitor
- Real-time tweet feed from sources
- Engagement heat indicators
- Thread expansion view
- Filter by source, time, engagement

### Screen 4: EXTRACTION - Entity Map
**Spider web / network graph visualization:**
- Entities as nodes
- Connections based on co-mention
- Node size = mention frequency
- Click to drill down into entity detail

**Entity Detail Panel:**
- All mentions
- Related claims
- Source breakdown
- Your notes

### Screen 5: AUDIT - Credibility Ledger
- All sources ranked by credibility
- Score breakdown (why this score?)
- Historical credibility trend
- Nomination inbox

### Screen 6: NEXUS - Story Desk
**Kanban-style buckets:**
- Breaking | Developing | Background | Recurring | Feature

**Story Cards show:**
- Headline
- Top entities (badges)
- Top claim
- Consensus/confidence meters
- Source count
- Engagement total

### Screen 7: SANCTION - Story Workbench
- Full story preview
- Entity sidebar (all entities, clickable)
- Claim sidebar (all claims with verdicts)
- Evidence panel (expandable sources)
- Integrity checklist
- Editorial controls (angle, tone, length, format)
- GREENLIGHT button

### Screen 8: SIGNAL - Export Center
- Export history
- Package preview
- Status tracking
- Re-export options

### Screen 9: Notes & Memory
- Entity notes (your annotations)
- Source notes
- Story lineage ("this connects to story X from last week")
- Search across all notes

### Screen 10: TRIBUNAL - Nominations
- Pending nominations
- Auto-score display
- Context (how discovered)
- Approve / Reject / Defer actions

---

## Component Library (RetroUI + Floating UI)

### Required Components

| Component | Use Case |
|-----------|----------|
| **Card** | Story cards, entity cards, source cards |
| **Badge** | Bucket type, verdict, credibility tier, status |
| **Button** | All actions (greenlight, approve, export) |
| **Input** | Search, add handles, notes |
| **Textarea** | Notes, editorial instructions |
| **Select** | Topic picker, angle/tone selectors |
| **Dialog** | Confirmations, detail views |
| **Table** | Source ledger, export history |
| **Accordion** | Expandable evidence, thread views |
| **Tooltip** | Credibility explanations, score breakdowns |
| **Popover** | Quick entity preview, claim detail |
| **Switch** | Toggle settings |
| **Checkbox** | Integrity checklist |
| **Avatar** | Source profile pics |
| **Slider** | Credibility thresholds |

### Custom Components Needed

| Component | Description |
|-----------|-------------|
| **NetworkGraph** | Entity relationship spider web |
| **CredibilityMeter** | Visual score display |
| **ConsensusMeter** | -1 to +1 gauge |
| **EngagementHeat** | Heat map or flame indicator |
| **ThreadViewer** | Nested tweet display |
| **KanbanBoard** | Story bucket columns |
| **TimelineView** | Chronological event display |

### Floating UI Applications

- Entity hover cards (useHover + useFloating)
- Claim evidence popovers
- Source credibility tooltips
- Thread expansion dropdowns
- Action menus (approve/reject/defer)

---

## Technical Architecture

### Stack

```
Frontend:
├── Next.js 14 (App Router)
├── RetroUI components
├── Floating UI for positioning
├── TailwindCSS
└── TypeScript

Backend:
├── Node.js/TypeScript API
├── Supabase (local Docker)
│   ├── PostgreSQL + pgvector
│   ├── Auth (Phase 2)
│   └── Storage
├── Redis + BullMQ (job queue)
└── LLM Gateway (OpenAI abstraction)

Integrations:
├── Twitter/X API
├── YouTube Data API
├── 11Labs API
└── Director's Palette API
```

### Docker Compose Services

```yaml
services:
  supabase-db:
    # PostgreSQL with pgvector
  supabase-studio:
    # Admin UI
  redis:
    # Job queue backend
  api:
    # Main application API
  worker:
    # Background job processor
  web:
    # Next.js frontend
```

### Job Queue Structure

```
Queues:
├── ingestion
│   ├── perimeter_sweep (Twitter fetch)
│   ├── relay_fetch (YouTube channels)
│   └── recon_search (YouTube search)
├── processing
│   ├── extraction_run (Entity/claim extraction)
│   ├── audit_score (Credibility scoring)
│   └── override_verdict (Consensus resolution)
├── editorial
│   ├── nexus_bucket (Story assembly)
│   └── signal_export (Package dispatch)
└── interviews (Talk Show Expressions)
    ├── schedule_call
    ├── process_recording
    └── assemble_show
```

---

## API Endpoints

### Topics
- `GET /api/topics` - List all topics
- `POST /api/topics` - Create topic
- `GET /api/topics/:id` - Get topic detail
- `PATCH /api/topics/:id` - Update topic
- `DELETE /api/topics/:id` - Archive topic

### Sources
- `GET /api/topics/:id/sources` - List sources for topic
- `POST /api/topics/:id/sources` - Add source
- `PATCH /api/sources/:id` - Update source
- `DELETE /api/sources/:id` - Remove source

### Entities
- `GET /api/topics/:id/entities` - List entities
- `GET /api/entities/:id` - Entity detail with mentions
- `PATCH /api/entities/:id` - Update notes
- `POST /api/entities/:id/merge` - Merge duplicate entities

### Claims
- `GET /api/topics/:id/claims` - List claims
- `GET /api/claims/:id` - Claim detail with evidence
- `GET /api/claims/:id/evidence` - All evidence for claim

### Stories
- `GET /api/topics/:id/stories` - List story candidates
- `GET /api/stories/:id` - Story detail
- `POST /api/stories/:id/greenlight` - Approve story
- `POST /api/stories/:id/kill` - Reject story
- `POST /api/stories/:id/export` - Send to production

### Nominations
- `GET /api/topics/:id/nominations` - Pending nominations
- `POST /api/nominations/:id/approve` - Approve
- `POST /api/nominations/:id/reject` - Reject

### Jobs
- `GET /api/jobs` - List recent job runs
- `POST /api/jobs/:type/trigger` - Manually trigger job
- `GET /api/jobs/:id/status` - Job status

---

## Security & Reliability

### API Keys Management
- Twitter API credentials (encrypted in env)
- YouTube API key (quota tracked)
- 11Labs API key
- OpenAI API key

### Rate Limiting
```
rate_limits
├── platform (string)
├── endpoint (string)
├── requests_remaining (int)
├── reset_at (timestamp)
└── last_updated (timestamp)
```

### Audit Logging
```
audit_log
├── id (uuid)
├── actor (string) - user or "system"
├── action (string) - "greenlight_story", "approve_nomination"
├── target_type (string) - "story", "source"
├── target_id (uuid)
├── details (jsonb)
└── created_at (timestamp)
```

### Job Monitoring
```
job_runs
├── id (uuid)
├── job_type (string)
├── topic_id (fk, nullable)
├── status (enum: queued, running, completed, failed)
├── started_at (timestamp)
├── completed_at (timestamp, nullable)
├── duration_ms (int, nullable)
├── items_processed (int)
├── errors (jsonb)
└── metadata (jsonb)
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Docker Compose setup
- [ ] Database schema (all tables)
- [ ] Basic API scaffold
- [ ] Topic + Source CRUD
- [ ] UI shell with navigation

### Phase 2: Ingestion
- [ ] Twitter API integration
- [ ] PERIMETER sweep job
- [ ] Tweet storage and threading
- [ ] Basic UI for viewing tweets

### Phase 3: Intelligence
- [ ] LLM gateway module
- [ ] EXTRACTION job (entities + claims)
- [ ] Entity/claim storage
- [ ] Entity map visualization

### Phase 4: YouTube
- [ ] YouTube API integration
- [ ] RELAY job (trusted channels)
- [ ] RECON job (search)
- [ ] Video-entity linking

### Phase 5: Verification
- [ ] AUDIT scoring system
- [ ] TRIBUNAL nomination flow
- [ ] Credibility ledger UI

### Phase 6: Editorial
- [ ] NEXUS story assembly
- [ ] OVERRIDE verdict logic
- [ ] Story workbench UI
- [ ] SANCTION greenlight flow

### Phase 7: Production
- [ ] SIGNAL export packaging
- [ ] Director's Palette integration
- [ ] Export center UI

### Phase 8: Talk Show Expressions
- [ ] 11Labs interview integration
- [ ] Personality prints
- [ ] Show format system
- [ ] Show assembly

---

## Glossary

| Term | Definition |
|------|------------|
| **OUTPOST** | Initial source seeding phase |
| **PERIMETER** | Twitter data collection sweep |
| **EXTRACTION** | Entity and claim identification |
| **RELAY** | YouTube trusted channel monitoring |
| **RECON** | YouTube topic search |
| **AUDIT** | Credibility and verification scoring |
| **TRIBUNAL** | Source nomination and vetting |
| **INTEL** | Web/RSS cross-reference |
| **OVERRIDE** | Consensus and verdict determination |
| **NEXUS** | Story assembly and bucketing |
| **SANCTION** | Editorial approval gate |
| **SIGNAL** | Export to production systems |
| **Personality Print** | AI representation of a human's communication style |
| **Greenlight** | Approve a story for production |

---

## Open Questions

1. **Historical context**: How far back should YouTube searches go for background?
2. **Cross-topic entities**: Should entities be shared across topics or siloed?
3. **Automated greenlight**: Any stories auto-approved based on confidence?
4. **Interview scheduling**: How do users schedule 11Labs calls?
5. **Multi-user**: When do we add proper auth and permissions?

---

*Document Version: 1.0*
*Created: December 2024*
*Project: Talk Show Go / Talk Show Expressions*
