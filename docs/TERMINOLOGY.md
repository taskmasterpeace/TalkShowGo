# Talk Show Go: Terminology Reference

**Purpose:** Complete glossary of terms used throughout the Talk Show Go system

**For:** Producers, developers, stakeholders, and anyone working with the platform

---

## Core Concepts

### Talk Show Go
The overall system name. An intelligence-driven content generation operating system for personalized news platforms.

### Niche / Topic
A content domain (e.g., battle rap, sports, local news, politics). Each niche has its own configuration, sources, and entities. Stored in `topics` table.

### Research Workflow
The 8-step intelligence gathering process (`runResearchWorkflow()`). This is the core intellectual property - a standardized pipeline for researching any topic: Query Interpretation → YouTube Search → Filter → Transcripts → Documents → Interviews → Twitter → Package.

### Research Package
Complete research bundle (JSONB format) containing all sources, intelligence, producer materials, and host materials. Exportable as JSON or Markdown. Stored in `research_packages` table.

### Query Plan
Structured research strategy from the Query Interpreter. Contains primary/secondary queries, entity lookups, keywords, legal story flags, and routing logic.

### Entity Context
Rich metadata about people/organizations/events stored in `entities.metadata` JSONB column. Includes role, affiliations, platforms, credibility markers, enrichment status.

### Story Candidate
Auto-detected trending topic from source monitoring. Includes headline, evidence package, confidence score, engagement metrics. Stored in `story_candidates` table.

### Host Personality
AI voice + character profile. Defines tone, pace, energy, formality, catchphrases, personality traits. 7 pre-built hosts available (Maya Sterling, Marcus Blaze, etc.).

### Show Template
Reusable show format with intro/story/outro sections and placeholders (`{show_name}`, `{host_name}`, etc.). Stored in `show_templates` table.

### Daily Show Run
Generated show instance. Records which template, host, topics, and script were used. Includes audio file path and production metadata. Stored in `daily_show_runs` table.

---

## Data Structures

### EntityContext
JSONB metadata schema for entities. Fields: `role`, `sub_roles`, `gender`, `affiliations`, `content_types`, `platforms`, `is_primary_source`, `is_commentator`, `bias_indicators`, `enrichment_status`, `enrichment_locked_by`. Defined in `src/types/entity-context.ts`.

### QueryPlan
Structured query interpretation output. Fields: `original_query`, `interpreted_as`, `primary_queries`, `secondary_queries`, `entity_lookups`, `search_type`, `expected_content`, `entities`, `keywords_must_have`, `keywords_nice_to_have`, `exclude_patterns`, `involves_legal_allegations`, `document_search_recommended`, `real_name_search_needed`.

### ResearchPackage
7-section intelligence bundle:
1. **Metadata** - Package ID, stats, query context
2. **Raw Sources** - YouTube videos, tweets, comments, web documents
3. **Intelligence** - Entities, claims, event timeline, consensus summary
4. **Producer** - Story summary, key facts, quotes, warnings, suggested angles
5. **Host** - Script outline, talking points, pronunciation guide, entity glossary
6. **Interviews** - First-person accounts
7. **Twitter** - Community sentiment

Defined in `src/types/research-package.ts`.

### WorkflowResult
Output from `runResearchWorkflow()`. Contains selected videos, entities extracted, Twitter data, stats, errors, cost tracking, and the complete ResearchPackage.

### TwitterSentiment
Community reaction analysis. Fields: `timeframe`, `search_query`, `tweets_found`, `sentiment` (positive/negative/neutral percentages), `top_reactions`, `key_quotes`, `cost_cents`.

---

## Database Tables

### Core Tables

**topics**
Niche definitions. Fields: `name`, `slug`, `description`, `niche_settings` (JSONB), `intel_config` (JSONB), `created_at`.

**entities**
People, organizations, events. Fields: `canonical_name`, `entity_type`, `topic_id`, `metadata` (JSONB EntityContext), `mention_count`, `first_seen`.

**entity_aliases**
Name variations. Fields: `entity_id`, `alias`, `source` ('extracted' or 'manual').

**entity_mentions**
Links entities to tweets. Fields: `entity_id`, `tweet_id`, `mention_type` ('subject', 'object', 'reference'), `sentiment`, `context_snippet`.

### Source Tables

**source_accounts**
Twitter sources. Fields: `topic_id`, `handle`, `account_type`, `follower_count`, `credibility_score`, `last_fetched`.

**youtube_channels**
YouTube sources. Fields: `topic_id`, `channel_name`, `channel_id`, `description`, `subscriber_count`, `last_checked`.

**youtube_videos**
Cached video data. Fields: `video_id`, `channel_id`, `title`, `description`, `published_at`, `duration_seconds`, `view_count`, `like_count`, `comment_count`, `transcript`, `processed`, `comments_fetched_at`.

**youtube_comments**
Comments with engagement. Fields: `comment_id`, `video_id`, `author_name`, `text`, `like_count`, `reply_count`, `is_reply`, `published_at`.

**tweets_raw**
Twitter data. Fields: `tweet_id`, `topic_id`, `text`, `author_handle`, `tweet_type`, `metrics_likes`, `metrics_retweets`, `metrics_views`, `tweet_created_at`, `raw_payload` (JSONB).

### Intelligence Tables

**story_candidates**
Auto-detected stories. Fields: `topic_id`, `bucket` ('breaking', 'developing', 'background', 'recurring', 'feature'), `headline`, `primary_entities`, `evidence_package` (JSONB), `confidence_score`, `engagement_total`, `status`.

**research_runs**
Workflow execution logs. Fields: `topic_id`, `query_plan` (JSONB), `queries_executed` (JSONB), `videos_found`, `filter_reasons` (JSONB), `errors` (JSONB), `duration_ms`, `cost_assemblyai_cents`.

**research_packages**
Saved research bundles. Fields: `id`, `topic_id`, `story_candidate_id`, `query`, `package_json` (JSONB ResearchPackage), `stats` (JSONB), `headline`, `markdown_path`, `json_path`, `created_at`.

**claim_verdicts**
Fact-checked claims. Fields: `claim_text`, `verdict` ('confirmed', 'likely', 'uncertain', 'disputed', 'debunked'), `reasoning`, `evidence_for` (JSONB), `evidence_against` (JSONB), `confidence_score`, `requires_editorial`.

### Show Production Tables

**hosts**
AI personalities. Fields: `name`, `archetype`, `tagline`, `bio`, `voice_style` (JSONB), `personality_traits` (JSONB), `catchphrases`, `best_for`, `tts_voice_id`, `tts_model`, `tts_speed`.

**show_templates**
Reusable formats. Fields: `name`, `type` ('Daily News', 'Narrative', 'Breaking'), `description`, `template_intro`, `template_story`, `template_outro`, `template_twitter_digest`, `settings` (JSONB), `include_twitter_digest`, `is_default`.

**daily_show_runs**
Generated shows. Fields: `template_id`, `host_id`, `selected_topics` (JSONB), `generated_script`, `audio_file_path`, `duration_seconds`, `cost_tts_cents`, `created_at`.

### Tracking Tables

**entity_enrichment_runs**
Auto-research history. Fields: `entity_id`, `search_query`, `videos_found`, `best_video_id`, `transcript_text`, `extracted_context` (JSONB), `cost_cents`, `error`.

**credibility_profiles**
Per-topic credibility thresholds. Fields: `topic_id`, `youtube_min_subscribers`, `youtube_min_views`, `twitter_min_followers`, `engagement_weight`, `recency_weight`.

**source_credibility_log**
Accuracy tracking. Fields: `source_id`, `period_start`, `period_end`, `claims_made`, `claims_verified`, `claims_disputed`, `credibility_delta`.

**consensus_scores**
Agreement tracking. Fields: `topic_id`, `claim_id`, `agreement_score` (-1 to +1), `sources_agree`, `sources_disagree`, `calculated_at`.

---

## API Endpoints

### Research & Intelligence

**POST /api/intelligence/research**
Run research workflow (quick or deep mode). Parameters: `topic_id`, `query`, `mode` ('quick' or 'deep'), `enable_twitter`, `enable_interviews`, `max_results`. Returns: `WorkflowResult` with ResearchPackage.

**POST /api/intelligence/monitor**
Scan sources and detect trending stories. Parameters: `topic_id`, `hours_back`. Returns: Array of StoryCandidate.

**POST /api/intelligence/deep-research**
Iterative research with SearXNG + LLM. Parameters: `topic_id`, `query`, `depth` (1-5 rounds), `breadth` (results per query). Returns: Multi-round research results.

**POST /api/intelligence/web-search**
Search web via SearXNG. Parameters: `query`, `category`, `time_range`, `max_results`. Returns: Array of search results.

### Research Packages

**GET /api/research-package/{id}**
Get saved package. Query params: `format` ('json' or 'markdown'), `sections` (filter which sections), `include_transcripts`. Returns: Complete ResearchPackage or Markdown text.

**GET /api/research-package/topic/{topic_id}**
List all packages for a topic. Query param: `summary=true` for overview only. Returns: Array of package summaries.

**POST /api/research-package/generate**
Generate new package from query. Parameters: `query`, `topic_id`, `options` (enable_interviews, enable_twitter, enable_documents), `generate_producer_materials`, `generate_host_materials`. Returns: Saved package ID and URLs.

### Daily Shows

**POST /api/stories/daily-show/propose**
Detect trending topics. Parameters: `topic_id`, `hours_back`, `target_date`, `include_twitter`, `max_topics`. Returns: Array of trending topics + Twitter digest.

**POST /api/stories/daily-show**
Generate show with audio. Parameters: `template_id`, `host_id`, `selected_topics`, `custom_script`, `generate_audio`. Returns: Generated show with audio file path.

### Show Management

**GET /api/templates**
List show templates. Returns: Array of templates.

**POST /api/templates**
Create template. Parameters: Template fields. Returns: Created template.

**PUT /api/templates/{id}**
Update template. Parameters: Template fields. Returns: Updated template.

**GET /api/hosts**
List host personalities. Returns: Array of hosts.

**GET /api/hosts/{id}/preview**
Test host voice. Parameters: `test_script`. Returns: Audio URL.

### Entity Management

**POST /api/entities/{id}/enrich**
Auto-research entity. Parameters: `force` (overwrite existing), `niche_keywords`. Returns: Enriched EntityContext.

**GET /api/entities/{id}/enrich**
Get enrichment status. Returns: Enrichment history and status.

**POST /api/entities/{id}/enrich/lock**
Lock entity (prevent auto-enrichment). Returns: Updated entity.

**POST /api/entities/{id}/enrich/unlock**
Unlock entity (allow auto-enrichment). Returns: Updated entity.

---

## UI Pages

### /studio/daily-show
5-step show creation wizard:
1. Template selection
2. Host selection + production format
3. Topic selection (scan sources, checkboxes)
4. Preview & edit script
5. Generate audio

### /studio/hosts
Host personality management:
- Grid view of all hosts
- Edit personality traits, voice settings
- Test voices with custom scripts
- Build new hosts via AI prompt

### /studio/templates
Show template editor:
- Create/edit templates
- Configure placeholders
- Set default settings (story count, hours lookback, style/tone)
- Mark default template

### /studio/entities
Entity context browser:
- List all entities for topic
- View entity details and metadata
- (Future: Enrichment buttons, manual editing, relationship visualization)

### /studio/setup
Onboarding wizard for new niches:
- Create topic
- Discover YouTube sources
- Configure intelligence settings
- Test monitor/research

---

## Key Files

### Workflow Implementation

**src/lib/research-workflow.ts** (1,420 lines)
Main workflow orchestrator. Exports `runResearchWorkflow()`.

**src/lib/query-interpreter.ts** (300+ lines)
Query understanding. Exports `interpretQuery()` → QueryPlan.

**src/lib/twitter-sentiment.ts** (455 lines)
Twitter analysis. Exports `analyzeTwitterSentiment()`.

**src/lib/youtube-api.ts**
YouTube client (youtubei.js wrapper). Exports `getYouTubeClient()`.

**src/lib/transcript-fetcher.ts**
Transcript acquisition (YouTube captions + AssemblyAI).

**src/lib/web-search.ts** (192 lines)
SearXNG client. Exports `searchWeb()`.

**src/lib/deep-research.ts**
Iterative research. Exports `deepResearch()`.

**src/lib/fact-checker.ts**
Verification system. Exports `verifyBattle()`, `verifyAffiliation()`.

**src/lib/research-package.ts** (200+ lines)
Package assembly. Exports `assembleResearchPackage()`.

**src/lib/research-package-markdown.ts**
Markdown export. Exports `generateMarkdown()`.

### Type Definitions

**src/types/entity-context.ts** (101 lines)
EntityContext schema.

**src/types/research-package.ts**
ResearchPackage structure (7 sections).

**src/types/niche-settings.ts**
NicheSettings schema (research/story/audio settings).

### UI Implementation

**src/app/studio/daily-show/page.tsx**
5-step show wizard.

**src/app/studio/hosts/page.tsx**
Host management UI.

**src/app/studio/templates/page.tsx**
Template editor.

**src/app/studio/entities/page.tsx**
Entity browser.

---

## Docker Services

**tsg-postgres** - PostgreSQL 15 + pgvector
Database server. Port 5432.

**tsg-postgrest** - PostgREST
Auto-generated REST API from PostgreSQL schema. Port 3000 (via Kong).

**tsg-kong** - Kong API Gateway
Rate limiting, authentication. Port 8000.

**tsg-redis** - Redis
Job queue (BullMQ). Port 6379.

**tsg-searxng** - SearXNG
Self-hosted meta-search engine. Port 8888.

**tsg-qdrant** - Qdrant
Vector database for RAG (future use). Port 6333.

---

## Environment Variables

**NEXT_PUBLIC_SUPABASE_URL**
PostgREST endpoint URL (http://localhost:8000).

**SUPABASE_SERVICE_KEY**
Service role key for database access.

**YOUTUBE_API_KEY**
Official YouTube Data API key (optional, falls back to youtubei.js).

**ELEVENLABS_API_KEY**
ElevenLabs text-to-speech API key.

**TWITTER_API_KEY** / **TWITTER_API_SECRET**
twitterapi.io credentials (NOT official Twitter API).

**ASSEMBLY_AI_KEY**
AssemblyAI transcription API key (~$0.006/min).

**REQUESTY_API_KEY**
Requesty.ai router for Claude Sonnet 4 LLM calls.

**PERPLEXITY_API_KEY**
Perplexity Sonar for web search + RSS discovery (optional).

---

## Production Workflow Terms

### Source Monitoring
Scanning configured YouTube channels and Twitter accounts for new content.

### Story Detection
Identifying trending topics by analyzing engagement metrics and cross-referencing multiple sources.

### Entity Extraction
Pulling people, organizations, events from transcripts and tweets.

### Fact-Checking
Verifying claims through web search before including in stories.

### Consensus Detection
Identifying community agreement via high-engagement comments across multiple channels.

### Interview Prioritization
Ranking videos by duration and interview keywords to find long-form content.

### Enrichment
Auto-researching entities with web searches and LLM analysis.

### Research Package Assembly
Bundling all sources, intelligence, and materials into exportable format.

### Script Generation
Creating show scripts from templates + research packages + host personalities.

### Audio Generation
Text-to-speech conversion using ElevenLabs voices.

---

## Frequently Used Abbreviations

**HHIR** - Hip Hop Is Real (YouTube channel)
**15 MOFE** - 15 Minutes of Fame (YouTube channel)
**URL** - Ultimate Rap League (battle rap league)
**KOTD** - King Of The Dot (battle rap league)
**RBE** - Rare Breed Ent (battle rap league)
**TTS** - Text-to-speech
**LLM** - Large Language Model
**RAG** - Retrieval-Augmented Generation
**JSONB** - JSON Binary (PostgreSQL data type)

---

**For more details, see:**
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Complete system explanation
- [API_REFERENCE.md](./API_REFERENCE.md) - Detailed API documentation (coming soon)
- [UI_WORKFLOW.md](./UI_WORKFLOW.md) - Producer workflows (coming soon)
