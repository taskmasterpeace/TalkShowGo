# Talk Show Go: System Architecture

**Version:** 1.0
**Last Updated:** 2025-12-26
**Purpose:** Comprehensive system documentation for producers, developers, and stakeholders

---

## Table of Contents

1. [System Overview](#1-system-overview---talk-show-go)
2. [The Research Workflow](#2-the-research-workflow---core-intellectual-property)
3. [Query Interpreter](#3-query-interpreter---the-intelligence-router)
4. [Twitter Intelligence](#4-twitter-intelligence---sentiment--event-detection)
5. [YouTube Intelligence](#5-youtube-intelligence---interview-prioritization--comment-consensus)
6. [Entity Database](#6-entity-database---rich-contextual-metadata)
7. [Research Packages](#7-research-packages---complete-intelligence-bundles)
8. [Fact-Checking Layer](#8-fact-checking-layer---multi-level-verification)
9. [Daily Show System](#9-daily-show-system---producer-driven-ui)
10. [Host Personalities](#10-host-personalities---voice--character-system)
11. [Show Templates](#11-show-templates---customizable-format-system)
12. [Niche Configuration](#12-niche-configuration---multi-domain-framework)
13. [Data Storage Architecture](#13-data-storage-architecture---postgresql--jsonb)
14. [Temporal Context](#14-temporal-context---research-history--tracking)
15. [Source Credibility System](#15-source-credibility-system---quality-control)
16. [Web Search Integration](#16-web-search-integration---searxng--deep-research)
17. [API Architecture](#17-api-architecture---rest--postgrest)
18. [Cost Tracking & Performance](#18-cost-tracking--performance---production-economics)
19. [The Vision](#19-the-vision---personalized-news-platform-framework)
20. [Current Gaps & Next Steps](#20-current-gaps--next-steps)

---

## 1. System Overview - "Talk Show Go"

**Talk Show Go** is an **intelligence-driven content generation operating system** designed to replace traditional news networks with AI-powered, highly personalized news platforms. The system automatically gathers intelligence from trusted sources (YouTube channels, Twitter accounts, RSS feeds, web searches), extracts entities with rich contextual metadata, identifies trending stories through consensus detection, and generates automated audio content using cloned voices and distinct host personalities. The first operational niche is **Battle Rap**, with the goal of being "the CNN of battle rap" by producing daily automated coverage using a cloned voice called "Battlerap Algorithm" (ElevenLabs voice ID: ZJ7BlVZrxZKBDMTIK5c9). The system is designed to be **multi-niche**, meaning the same framework can be deployed for sports, local news, politics, or any domain where consistent content generation is needed.

## 2. The Research Workflow - Core Intellectual Property

The heart of the system is **`runResearchWorkflow()`**, a standardized 8-step research pipeline located in `src/lib/research-workflow.ts` (1,420 lines). This workflow is the intellectual property that enables consistent, fact-checked content generation across any niche. The steps are: **(1) Query Interpretation** - An LLM analyzes the user's query and creates a structured `QueryPlan` with primary/secondary search terms, entity lookups, must-have/nice-to-have keywords, and auto-detection of legal stories; **(2) Multi-Query YouTube Search** - Searches YouTube using both primary and secondary queries, then deduplicates results; **(3) Filter & Prioritize** - Applies duration filters (60s min, 120min max), calculates relevance scores with bonuses for interviews (30+ min gets +40), interview keywords (+30), and known platforms (+20); **(4) Transcript Acquisition** - Fetches transcripts from YouTube captions (free) or AssemblyAI ($0.006/min) with intelligent caching; **(4.5) Document Search** - If legal story detected (keywords: snitch, court, arrest, etc.), searches web for court records and real names; **(5) Interview Lookup** - Searches for long-form content featuring identified entities; **(6) Twitter Sentiment** - Analyzes community reactions; **(7) Documentation** - Generates structured output; **(8) Research Package** - Bundles everything into exportable format.

## 3. Query Interpreter - The Intelligence Router

The **Query Interpreter** (`src/lib/query-interpreter.ts`, 300+ lines) is the first step that transforms natural language into structured research plans. When you ask "Bad Newz snitching allegations," it outputs a **`QueryPlan`** object containing: `original_query`, `interpreted_as` (human-readable), `primary_queries` (["Bad Newz paperwork", "Bad Newz court case"]), `secondary_queries` (fallbacks), `entity_lookups` (web searches for context), `search_type` (youtube_only/youtube_and_web/deep_research), `expected_content` (interviews/reactions/news), `entities` array with name/type/role_hint/needs_context, `keywords_must_have`, `keywords_nice_to_have`, `exclude_patterns`, and **legal story flags** (`involves_legal_allegations`, `document_search_recommended`, `real_name_search_needed`). This routing intelligence ensures the system knows HOW to research each topic - whether it needs court documents, which platforms to prioritize, what content type to expect - all automatically inferred from the query.

## 4. Twitter Intelligence - Sentiment & Event Detection

The **Twitter Intelligence Layer** (`src/lib/twitter-sentiment.ts`, 455 lines) provides community sentiment analysis and event timeline detection. It does NOT use the official Twitter API - instead it uses `twitterapi.io` client which costs ~$0.015 per search call. The workflow: **(1) Extract Event Date** - Analyzes video publish dates using clustering logic (when 3+ videos posted within 3 days, that's likely the event date); **(2) Search Twitter** - Queries tweets from event date -1 day to +7 days to capture pre-event hype and post-event reactions; **(3) Sentiment Classification** - Uses keyword analysis with positive words (fire, crazy, goat, bodied, 🔥), negative words (trash, mid, lost, weak), and calculates distribution; **(4) Extract Key Quotes** - Pulls tweet text for storytelling; **(5) Calculate Engagement** - Aggregates likes, retweets, replies. Results are stored in the workflow output as `twitter: { timeframe, search_query, tweets_found, sentiment: {positive%, negative%, neutral%}, top_reactions, key_quotes, cost_cents }`. This data is stored in the `tweets_raw` database table with fields: `tweet_id`, `text`, `author_handle`, `metrics_likes`, `metrics_retweets`, `metrics_views`, `tweet_created_at`, `raw_payload` (JSONB).

## 5. YouTube Intelligence - Interview Prioritization & Comment Consensus

The **YouTube Intelligence Layer** combines search, filtering, transcript acquisition, and comment analysis. YouTube access uses **youtubei.js** (free, no API key needed) instead of the official API. The search strategy: **(1) Multi-query search** across primary + secondary terms; **(2) Duration-based scoring** where longer content gets priority (30+ min: +40 bonus, 20+ min: +25, 10+ min: +10) because interviews provide deeper insight than reaction clips; **(3) Interview keyword detection** ("interview", "sits down", "exclusive" add +30); **(4) Platform bonuses** for known interview shows (Hip Hop Is Real, VladTV, No Jumper get +20); **(5) Relevance filtering** by must-have keywords. **Comment Consensus Detection** is critical - the system fetches YouTube comments with `like_count` and `reply_count` fields, then identifies high-engagement comments as indicators of community opinion. Comments are stored in `youtube_comments` table with fields: `comment_id`, `author_name`, `text`, `like_count`, `reply_count`, `published_at`. When multiple channels discuss the same topic AND comments across those channels show similar sentiment, that's confirmed consensus.

## 6. Entity Database - Rich Contextual Metadata

The **Entity System** is the most sophisticated part of the data model. Entities (people, organizations, events) are stored in the `entities` table with a `metadata` JSONB column that contains **`EntityContext`** - a flexible, niche-specific schema defined in `src/types/entity-context.ts` (101 lines). For battle rap, an entity like "Cassidy" might have: `role: "battler"`, `sub_roles: ["battler", "rapper", "podcast host"]`, `gender: "male"`, `affiliations: [{name: "Philly", type: "city", status: "current"}]`, `content_types: ["battles", "freestyles"]`, `platforms: {youtube_channel_id, twitter_handle}`, `is_primary_source: false`, `is_commentator: false`, `bias_indicators: ["anti-URL"]`. This context enables intelligent routing - if Cassidy is NOT a commentator, we know he's being discussed BY others, not discussing others. For a blogger like "Chris Unbias," `is_commentator: true` and `covers_topics: ["all leagues"]` tells us he's a source OF commentary. The `enrichment_status` field tracks whether this entity has been auto-researched with web searches, and `enrichment_locked_by` prevents overwriting producer-curated data.

## 7. Research Packages - Complete Intelligence Bundles

A **Research Package** (`src/types/research-package.ts`) is a comprehensive bundle of ALL research data for a story, designed for consumption by AI systems, human producers, and external tools (like Director's Palette video editing). The package structure has 7 main sections: **(1) Metadata** - package ID, topic/story IDs, query context, stats (sources_count, entities_count, claims_count); **(2) Raw Sources** - complete youtube_videos with transcripts, tweets with engagement metrics, comments, web_documents (court records, articles); **(3) Intelligence** - extracted entities with full context, claims with verdicts/evidence, event timeline, consensus summary; **(4) Producer Materials** - story_summary (headline, one-liner, full summary, story type), key_facts (sourced bullets), quotes_to_use, warnings (legal risks, unverified claims), suggested_angles, research_gaps; **(5) Host Materials** - script_outline, talking_points, pronunciation_guide, entity_glossary; **(6) Interviews** - extracted first-person accounts; **(7) Twitter** - community sentiment breakdown. Packages are saved to `research_packages` table as JSONB and can be exported as JSON (for APIs) or Markdown (for human review).

## 8. Fact-Checking Layer - Multi-Level Verification

The **Fact-Checking System** prevents hallucinations through multi-level verification before content generation. **(1) Web Search Verification** (`src/lib/fact-checker.ts`) - For battle claims, it searches the web requiring BOTH battler names together + explicit "vs" signal + ideally video evidence; confidence scores range from 0.9 (confirmed with video) to 0.1 (contradicted); only claims with 0.7+ confidence are marked `safe_to_use`. **(2) Claim Verdicts** - Stored in `claim_verdicts` table with verdict ('confirmed', 'likely', 'uncertain', 'disputed', 'debunked'), reasoning, evidence_for/against, and `requires_editorial` flag. **(3) Producer Warnings** - Research packages include warnings array with type (unverified_claim, legal_risk, bias_detected, outdated_info, gender_unverified), severity (high/medium/low), message, and recommendation. **(4) Consensus Detection** - High-liked YouTube comments + cross-referencing multiple sources = verified story. This system successfully caught a hallucination where the LLM invented "Chef Trez vs Tsu Surf" battle that never happened - the fact-checker marked it 30% confidence and excluded it from the final story.

## 9. Daily Show System - Producer-Driven UI

The **Daily Show System** (`/studio/daily-show`) is a 100% UI-driven 5-step wizard requiring zero coding after initial setup. **Step 1: Template Selection** - Choose from daily news, narrative, breaking news templates; each configures story count, hours lookback, Twitter inclusion, style/tone. **Step 2: Host Selection** - Choose from 7 pre-built personalities: Maya Sterling (investigative anchor), Marcus Blaze (hot take king), Devon Sharp (satirist), Tasha Raw (unfiltered), James Noble (documentary narrator), DJ Momentum (hype), King Knowledge (street analyst); select production format (talk show, news bulletin, investigation, etc.); optional channel style checkbox for "Algorithm Institute" documentary style. **Step 3: Topic Selection** - Click "Scan Sources" to detect 3-5 trending topics with source breakdown, engagement scores, keywords, sentiment; checkboxes to select which stories to include; Twitter digest preview shows trending topics + top reactions. **Step 4: Preview & Edit** - Full script shown with word count + duration estimate; free text editing before generation; regenerate button if needed. **Step 5: Generate Audio** - One-click TTS generation with ElevenLabs; in-page audio player; download MP3 option. The entire flow is producer-friendly with full transparency and control at every step.

## 10. Host Personalities - Voice & Character System

The **Host System** (`/studio/hosts`) defines 7 distinct AI personalities with voice styles, personality traits, catchphrases, and use cases. Each host is stored in the `hosts` table with fields: `name`, `archetype` (Investigative Anchor, Hot Take King, Satirist, etc.), `tagline`, `bio`, `voice_style` (JSONB with tone/pace/energy/formality), `personality_traits` (JSONB with categories like Core, Style, Approach with 0-100 values), `catchphrases` (array), `best_for` (content types), `tts_voice_id` (ElevenLabs voice), `tts_model`, `tts_speed`. Producers can: **(1) Test voices** with custom scripts in-app; **(2) Edit personalities** via 3-tab modal (Basic Info, Personality sliders, Voice settings); **(3) Build new hosts** using AI prompt ("Describe your ideal host...") which generates complete personality profile. The host's personality_traits inject into the script generation prompt to ensure Maya Sterling's investigative style differs from Marcus Blaze's hot take energy.

## 11. Show Templates - Customizable Format System

The **Template System** (`/studio/templates`) allows producers to create reusable show formats. Templates are stored in `show_templates` table with: `name`, `type` (Daily News, Narrative, Breaking), `description`, `template_intro`, `template_story`, `template_outro`, `template_twitter_digest`, `settings` (JSONB with default_story_count, default_hours_lookback, default_style_tone), `include_twitter_digest`, `is_default`. Templates use placeholders like `{show_name}`, `{date}`, `{host_name}`, `{host_opening}`, `{host_closing}`, `{topic_count}`, `{headline}`, `{story_body}`, `{transition}`, `{twitter_trending}`, `{twitter_reaction}`. The template_story section repeats for each story selected. When a producer creates a daily show, they select a template which auto-populates all settings, then the selected topics fill in the story sections, and the host personality injects opening/closing/transition phrases. This enables consistent show structure across episodes while allowing per-show customization.

## 12. Niche Configuration - Multi-Domain Framework

The system is designed as a **multi-niche framework** where each niche (topic) stores custom configuration in `topics.niche_settings` JSONB column. Niche settings include: **(1) Research Settings** - interview_search_suffix, max_interview_lookups, prefer_longest_interviews, min/max_interview_duration, default_lookback_hours (0=unlimited historical, 24=news only), deep_research_max_rounds, interview_lookup_enabled, twitter_enabled; **(2) Story Settings** - opening_template, default_length, chapter_structure; **(3) Audio Settings** - voice_id, model_id, style, speakers (for multi-host shows). Example: Battle Rap uses historical content (0 hours lookback), prefers long interviews (20+ min), no Twitter, documentary style. Hood History Club uses unlimited lookback, 7-18 min stories, historical focus. Local News (Orangeburg, SC) uses 24-hour news cycle, short stories, Twitter enabled, urgent tone. This enables the same codebase to power vastly different content strategies.

## 13. Data Storage Architecture - PostgreSQL + JSONB

The database uses **PostgreSQL with pgvector extension** running in Docker (`tsg-postgres` container). Core tables: **(1) topics** - Niche definitions with `niche_settings` JSONB; **(2) source_accounts** - Twitter sources with follower counts, credibility scores; **(3) youtube_channels** - 15 battle rap commentary channels; **(4) youtube_videos** - Cached video metadata, transcripts (~50KB limit), `processed` flag, `comments_fetched_at`; **(5) youtube_comments** - Comments with `like_count` (consensus signal); **(6) tweets_raw** - Tweets with `metrics_likes`, `metrics_retweets`, `metrics_views`, `raw_payload` JSONB; **(7) entities** - `canonical_name`, `entity_type`, `metadata` JSONB (EntityContext); **(8) entity_aliases** - Name variations; **(9) entity_mentions** - Links entities to tweets with `mention_type`, `sentiment`, `context_snippet`; **(10) story_candidates** - Auto-detected stories with `bucket`, `headline`, `evidence_package` JSONB, `confidence_score`, `status`; **(11) research_packages** - Complete research bundles as JSONB; **(12) hosts** - Host personalities; **(13) show_templates** - Reusable formats; **(14) daily_show_runs** - Generated show history. JSONB columns enable flexible schemas that adapt to each niche without schema migrations.

## 14. Temporal Context - Research History & Tracking

The system tracks **what has been covered** and **when** through multiple mechanisms: **(1) Story Candidates** - `detected_stories` table with `first_seen`, `last_activity` timestamps tracks when topics emerged and when they were last active; **(2) Research Runs** - `research_runs` table logs each workflow execution with `query_plan`, `queries_executed`, `videos_found`, `filter_reasons`, `errors`, `duration_ms`, `cost_assemblyai_cents`; this creates full audit trail of how stories were researched. **(3) Interview Caching** - YouTube videos marked `is_interview=true` prevent re-downloading; `transcript_source` field tracks whether transcript came from youtube_captions, assemblyai, or database cache. **(4) Entity Enrichment** - `entity_enrichment_runs` table tracks when entities were auto-researched with `search_query`, `videos_found`, `extracted_context`, `cost_cents`, enabling producers to see enrichment history. **(5) Research Packages** - Stored with `created_at` timestamp enable producers to see "what did we know on Dec 15 vs Dec 26?" This temporal awareness prevents repetitive coverage and builds narrative continuity.

## 15. Source Credibility System - Quality Control

The **Credibility System** ensures only reliable sources influence content. **(1) Credibility Profiles** (`credibility_profiles` table) - Per-topic thresholds for `youtube_min_subscribers` (10k default), `youtube_min_views`, `twitter_min_followers`, plus bonuses for verified accounts; weights for engagement (0.5) and recency (0.3). **(2) Source Credibility Log** (`source_credibility_log` table) - Tracks accuracy over time with `period_start/end`, `claims_made`, `claims_verified`, `claims_disputed`, `engagement_generated`, `credibility_delta` (score changes). **(3) Entity-Level Credibility** - `is_primary_source` flag distinguishes official sources (e.g., URL posting their own battles) from commentators (e.g., bloggers discussing others); `bias_indicators` array flags known biases ("pro-URL", "anti-mainstream"). **(4) Consensus Scoring** (`consensus_scores` table) - Tracks agreement level (-1 to +1) when multiple sources discuss same topic; high consensus = verified story. This multi-layer credibility system ensures hallucinations are caught and unreliable sources are downweighted.

## 16. Web Search Integration - SearXNG + Deep Research

The **Web Search Layer** uses **SearXNG** (self-hosted meta-search engine at `http://localhost:8888`) running in Docker. SearXNG aggregates results from Google, Bing, DuckDuckGo, Wikipedia with configurable categories (general, news, social media, images, videos) and time ranges (day, week, month, year). The system uses web search for: **(1) Document Search** - When legal stories detected, searches for court records, arrest records, paperwork using entity names + real names; **(2) Entity Enrichment** - General web context about people/organizations via `/api/entities/{id}/enrich` endpoint; **(3) Real Name Discovery** - Searches for government names to find court records (battlers often use stage names); **(4) Deep Research** (`/api/intelligence/deep-research`) - Iterative research with SearXNG + LLM analysis, configurable depth (1-5 rounds) and breadth (results per query). Web search results are stored in research packages under `raw_sources.web_documents` with URL, title, content, source, relevance score.

## 17. API Architecture - REST + PostgREST

The system exposes **REST APIs** for both internal (Next.js pages calling APIs) and external (Director's Palette, custom tools) use. API stack: **(1) Next.js API Routes** (`src/app/api/*`) - Custom endpoints for complex logic; **(2) PostgREST** (port 3000 via Kong gateway) - Auto-generated REST API from PostgreSQL schema; **(3) Kong** - API gateway with rate limiting, auth. Key endpoints: `POST /api/intelligence/research` (quick or deep research), `POST /api/intelligence/monitor` (scan sources, detect stories), `GET /api/research-package/{id}` (get saved package as JSON/Markdown), `POST /api/stories/daily-show/propose` (detect trending topics), `POST /api/stories/daily-show` (generate show with audio), `GET /api/templates`, `GET /api/hosts`, `POST /api/entities/{id}/enrich` (auto-research entity). All APIs return structured JSON with error handling, cost tracking, and performance metrics.

## 18. Cost Tracking & Performance - Production Economics

The system tracks **production economics** to enable cost-effective scaling. Costs tracked: **(1) AssemblyAI Transcription** - ~$0.006/minute of audio; tracked per video in `research_runs.cost_assemblyai_cents` and aggregated in research package stats; interview caching prevents duplicate transcription costs. **(2) Twitter API** - twitterapi.io charges ~$0.015 per search call; tracked in `twitter.cost_cents`. **(3) ElevenLabs TTS** - Varies by model; v1 model cheaper than turbo_v2.5; cost tracked in `daily_show_runs`. **(4) LLM Calls** - Uses Requesty.ai router with Claude Sonnet 4; costs tracked per workflow execution. Performance metrics: `duration_ms` for each research run, `transcripts_from_youtube` vs `transcripts_from_assemblyai` (free vs paid), `interviews_from_cache` (cache hit rate), `videos_filtered` (search efficiency). This cost awareness enables producers to optimize: prefer YouTube captions over AssemblyAI when available, cache aggressively, tune search parameters to reduce API calls.

## 19. The Vision - Personalized News Platform Framework

The user's vision is to build a **standardized framework** that can replace CNN-style centralized news with decentralized, personalized news platforms. Key requirements: **(1) Multi-Niche** - Same workflow powers battle rap, sports, local news, politics; niche-specific configuration stored in database, no code changes needed. **(2) Multi-Host** - Different personalities (investigative, hot take, satirical, etc.) deliver same story with different tones; hosts are swappable via UI. **(3) Multi-Format** - Daily news, narrative documentaries, breaking alerts, prediction panels - all driven by templates; producers choose format per show. **(4) Multi-Frequency** - Daily shows, weekly roundups, real-time alerts - configurable per niche. **(5) Producer Control** - 100% UI-driven after setup; no coding required for daily operations; full transparency into sources, verification status, costs. **(6) Intellectual Property** - The research workflow itself is the IP; standardized 8-step process with quality gates; fact-checking layer prevents hallucinations; entity context system enables continuity. The framework enables anyone to "become CNN for their niche" - monitor sources, detect stories, verify facts, generate content, publish at scale.

## 20. Current Gaps & Next Steps

**What Exists:** Research workflow (Twitter → YouTube → Web → Package), Daily show wizard (5 steps), Host personalities (7 built), Show templates (editable), Entity database (rich context), Fact-checking (multi-level), Research packages (exportable), Cost tracking, Source credibility system.

**What Needs Work:**

1. **UI Connections** - Not all backend capabilities exposed in UI; entity enrichment exists in API but not in UI; research package exports work but not linked from daily show flow; fact-checking warnings not surfaced in preview step.
2. **Frequency Management** - No "recurring show" scheduler; daily shows are one-off; need cron-style scheduler for "every morning at 6am, generate battle rap news."
3. **RSS Feed Integration** - Planned but not implemented; need `rss_feeds` table + ingestion worker.
4. **Interview Search** - Code exists for interview prioritization but not accessible from UI; producers can't manually trigger "find me the best Cassidy interview."
5. **Entity UI** - Basic entity list exists at `/studio/entities` but missing: enrichment button per entity, manual context editing, relationship visualization.
6. **Story Continuity** - Temporal tracking exists but not surfaced; need "what have we covered about Cassidy this month?" view.
7. **Multi-Host Shows** - Skeleton exists but not production-ready; need dialogue generation between hosts.
8. **Web Source Config** - letstalkbattlerap.com planned but not in database; need `web_sources` table.

**Priority Next Steps:** Connect existing backend to UI, add frequency scheduler, build entity management UI, implement RSS feeds, surface fact-checking warnings in preview.

---

## Appendix: File Reference

**Key Implementation Files:**
- `src/lib/research-workflow.ts` - Main workflow orchestrator (1,420 lines)
- `src/lib/query-interpreter.ts` - Query understanding (300+ lines)
- `src/lib/twitter-sentiment.ts` - Twitter analysis (455 lines)
- `src/lib/research-package.ts` - Package assembly (200+ lines)
- `src/types/entity-context.ts` - Entity metadata schema (101 lines)
- `src/types/research-package.ts` - Package structure definitions
- `src/lib/fact-checker.ts` - Verification system

**UI Pages:**
- `/studio/daily-show` - 5-step show creation wizard
- `/studio/hosts` - Host personality management
- `/studio/templates` - Show template editor
- `/studio/entities` - Entity context browser

**Database Container:** `tsg-postgres` (PostgreSQL 15 + pgvector)
**Web Search:** SearXNG at `http://localhost:8888`
