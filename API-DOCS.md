# Talk Show Go API Documentation

Complete API reference for Talk Show Go - the intelligence-driven content generation platform.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently no authentication required for local development.

---

## Topics

### GET /api/topics
List all topics/niches.

**Response:**
```json
[
  {
    "id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5",
    "name": "Battle Rap",
    "description": "Coverage of battle rap leagues and events",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

### POST /api/topics
Create a new topic.

**Body:**
```json
{
  "name": "Battle Rap",
  "description": "Coverage of battle rap leagues and events"
}
```

### GET /api/topics/[id]
Get topic by ID with credibility profile.

### PATCH /api/topics/[id]
Update topic fields.

**Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "active"
}
```

### DELETE /api/topics/[id]
Archive topic (soft delete).

---

## Topic Configuration

### GET /api/topics/[id]/config
Get topic intelligence configuration.

**Response:**
```json
{
  "topic_id": "...",
  "name": "Battle Rap",
  "config": {
    "hours_back": 48,
    "min_sources": 2,
    "known_entities": ["Cassidy", "Eazy"],
    "story_patterns": ["vs", "responds", "beef"]
  }
}
```

### PUT /api/topics/[id]/config
Replace entire config.

### PATCH /api/topics/[id]/config
Partial config update (add/remove entities and patterns).

**Body:**
```json
{
  "add_entities": ["New Entity"],
  "remove_entities": ["Old Entity"],
  "add_patterns": ["new pattern"],
  "remove_patterns": ["old pattern"]
}
```

---

## Topic Sources

### GET /api/topics/[id]/youtube
List YouTube channels for topic.

### POST /api/topics/[id]/youtube
Add YouTube channel to topic.

**Body:**
```json
{
  "channel_name": "URLTV",
  "channel_id": "UC...",
  "description": "Ultimate Rap League official channel",
  "credibility_score": 0.9
}
```

### DELETE /api/topics/[id]/youtube?channelId=xxx
Remove YouTube channel.

### GET /api/topics/[id]/sources
List all sources (Twitter + YouTube + RSS).

### POST /api/topics/[id]/rss
Add RSS feed to topic.

---

## Topic Data

### GET /api/topics/[id]/entities
Get entities for a topic.

**Query Params:**
- `type` - Filter by entity type
- `withContext` - Include sentiment and mentions (true/false)

### POST /api/topics/[id]/entities
Add new entity to topic.

**Body:**
```json
{
  "name": "Cassidy",
  "type": "battler",
  "description": "Philadelphia battle rap legend",
  "aliases": ["Cass", "The Bar God"]
}
```

### GET /api/topics/[id]/tweets
Get tweets for topic.

### GET /api/topics/[id]/claims
Get extracted claims for topic.

### GET /api/topics/[id]/stories
Get stories for topic.

### GET /api/topics/[id]/stats
Get statistics for topic.

### GET /api/topics/[id]/health
Check topic health/readiness.

---

## Entities

### GET /api/entities/[id]/context
Get entity context metadata (role, affiliations, etc).

**Response:**
```json
{
  "entity_id": "...",
  "name": "Cassidy",
  "type": "battler",
  "context": {
    "role": "battler",
    "gender": "male",
    "affiliations": [{"name": "Philly", "type": "city", "status": "current"}],
    "is_primary_source": false,
    "is_commentator": false
  }
}
```

### PUT /api/entities/[id]/context
Replace entity context (full replacement).

### PATCH /api/entities/[id]/context
Partial update entity context (merge).

### GET /api/entities/[id]/knowledge
Get all accumulated knowledge about entity.

**Response:**
```json
{
  "entity": {...},
  "facts": [...],
  "facts_by_type": {...},
  "relationships": [...],
  "activity": {...},
  "total_mentions": 42,
  "summary": "..."
}
```

### POST /api/entities/[id]/knowledge
Add new fact/knowledge about entity.

**Body:**
```json
{
  "fact_type": "biographical",
  "fact_text": "Cassidy is from Philadelphia",
  "source_type": "youtube",
  "confidence": 0.9
}
```

---

## Entity Enrichment

### GET /api/entities/[id]/enrich
Get enrichment status for entity.

**Response:**
```json
{
  "entity_id": "...",
  "entity_name": "Cassidy",
  "enrichment_status": "pending",
  "enrichment_last_run": null,
  "is_locked": false
}
```

### POST /api/entities/[id]/enrich
Enrich entity with web search + LLM analysis.

**Body:**
```json
{
  "force": false,
  "niche_keywords": ["battle rap"]
}
```

### POST /api/entities/[id]/enrich/lock
Lock entity to prevent automatic enrichment.

### POST /api/entities/[id]/enrich/unlock
Unlock entity to allow enrichment.

---

## Stories

### GET /api/stories
List story candidates.

**Query Params:**
- `topic_id` - Filter by topic
- `bucket` - Filter by bucket
- `status` - Filter by status

### GET /api/stories/[id]
Get single story with related data.

### PATCH /api/stories/[id]
Update story status or content.

### POST /api/stories/[id]/greenlight
Approve story for production.

**Body:**
```json
{
  "draft_content": "...",
  "angle": "news",
  "tone": "dramatic",
  "length": "medium"
}
```

### POST /api/stories/[id]/regenerate
Re-run story pipeline with updated parameters.

**Body:**
```json
{
  "query": "Updated query",
  "style": "documentary",
  "generate_audio": true
}
```

### POST /api/stories/pipeline
Run full story pipeline.

**Body:**
```json
{
  "query": "Cassidy vs Eazy full story",
  "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5",
  "generate_audio": true
}
```

---

## Daily Show

### GET /api/stories/daily-show/propose
Propose trending topics for daily show.

**Query Params:**
- `topic_id` (required) - Topic UUID
- `hours_back` - Hours to look back (default: 24)
- `target_date` - Specific date in YYYY-MM-DD format (overrides hours_back)
- `start_date` - Start of date range (ISO string)
- `end_date` - End of date range (ISO string)
- `max_topics` - Max topics to return (default: 5)
- `include_twitter` - Include Twitter digest (default: true)

**Example:**
```
/api/stories/daily-show/propose?topic_id=864dbcf4-e1f7-4b1a-86ed-c18007439ad5&target_date=2025-12-18
```

**Response:**
```json
{
  "success": true,
  "topic_id": "...",
  "date_range": {
    "target_date": "2025-12-18",
    "hours_back": null
  },
  "topics": [
    {
      "id": "topic_...",
      "headline": "Cassidy vs Eazy: Community Reacts",
      "summary": "5 videos and 12 tweets discussing...",
      "engagement_score": 15000,
      "sentiment": "mixed"
    }
  ],
  "twitter_digest": {
    "trending": [...],
    "sentiment": {...},
    "formatted_script": "..."
  }
}
```

### POST /api/stories/daily-show
Generate a daily news show with audio.

**Body:**
```json
{
  "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5",
  "show_name": "Battle Rap Daily",
  "host_slug": "james_noble",
  "template_id": "...",
  "hours_back": 24,
  "generate_audio": true,
  "selected_topics": [...],
  "custom_script": "..."
}
```

**Response:**
```json
{
  "success": true,
  "show": {
    "date": "2025-12-19",
    "name": "Battle Rap Daily",
    "duration": 180
  },
  "segments": [...],
  "full_script": "...",
  "audio_url": "/audio/show_2025-12-19.mp3",
  "host": {...}
}
```

---

## Templates

### GET /api/templates
List all show templates.

**Query Params:**
- `topic_id` - Filter by topic
- `type` - Filter by type (daily, narrative, breaking)
- `active` - Filter by active status (default: true)

### POST /api/templates
Create new template.

**Body:**
```json
{
  "name": "Battle Rap Daily",
  "slug": "battle-rap-daily",
  "template_type": "daily",
  "intro_template": "Welcome to {show_name}...",
  "story_template": "Our next story: {headline}...",
  "outro_template": "That's all for today...",
  "default_story_count": 3,
  "include_twitter_digest": true,
  "preferred_host_slug": "james_noble"
}
```

### GET /api/templates/[id]
Get single template.

### PUT /api/templates/[id]
Update template.

### DELETE /api/templates/[id]
Delete template.

---

## Hosts

### GET /api/hosts
List all host personalities.

**Query Params:**
- `archetype` - Filter by archetype
- `format` - Filter by best format
- `includeTraits` - Include personality traits (default: true)

**Response:**
```json
[
  {
    "id": "james_noble",
    "name": "James Noble",
    "archetype": "smooth_narrator",
    "tagline": "This is the story of...",
    "voice_style": "authoritative, calm, dramatic",
    "best_for": ["narrative_story", "deep_dive"]
  }
]
```

### GET /api/hosts/[id]
Get single host with all details.

### POST /api/hosts
Create new host.

### PUT /api/hosts/[id]
Update host.

### DELETE /api/hosts/[id]
Deactivate host (soft delete).

---

## Intelligence

### POST /api/intelligence/monitor
Sweep all sources for topic, detect trending stories.

**Body:**
```json
{
  "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5",
  "hours_back": 48,
  "min_sources": 2
}
```

### POST /api/intelligence/research
Research specific topic/story.

**Body:**
```json
{
  "topic_id": "...",
  "query": "Bad Newz complete history",
  "mode": "deep",
  "depth": 3,
  "breadth": 3
}
```

### GET /api/intelligence/stories
Get detected stories for topic.

**Query Params:**
- `topic_id` (required)
- `status` - Filter by status (default: 'active')
- `limit` - Max results (default: 20)

### POST /api/intelligence/web-search
Search web using SearXNG.

**Body:**
```json
{
  "query": "Cassidy battle rap",
  "max_results": 10,
  "search_type": "web"
}
```

### POST /api/intelligence/deep-research
Run iterative deep research.

**Body:**
```json
{
  "query": "Bad Newz snitching allegations",
  "depth": 3,
  "breadth": 3
}
```

### GET /api/intelligence/deep-research
Check deep research service status.

---

## Twitter

### POST /api/twitter/search
Search Twitter using twitterapi.io.

**Body:**
```json
{
  "query": "battle rap",
  "queryType": "Latest",
  "entities": ["Cassidy", "Eazy"],
  "since": "2025-12-17",
  "minLikes": 10
}
```

### GET /api/twitter/user?username=xxx
Get Twitter user profile.

### GET /api/twitter/timeline?username=xxx
Get user's Twitter timeline.

### GET /api/twitter/digest
Get formatted Twitter digest for show scripts.

**Query Params:**
- `topic_id` (required)
- `hours_back` (default: 24)
- `keywords` - Comma-separated keywords

---

## YouTube

### GET /api/youtube/search?q=xxx&max=10
Search YouTube videos.

### POST /api/youtube/search
Full YouTube search with detailed info.

**Body:**
```json
{
  "query": "Cassidy vs Eazy",
  "type": "video",
  "maxResults": 10,
  "recentDays": 7
}
```

---

## Jobs

### GET /api/jobs
List recent job runs.

**Query Params:**
- `limit` (default: 50)
- `status` - Filter by status

### POST /api/jobs/[type]/trigger
Manually trigger a background job.

**Job Types:**
- `perimeter_sweep` - Collect tweets/posts
- `relay_fetch` - Fetch from YouTube channels
- `extraction_run` - Extract entities
- `transcript_fetch` - Fetch video transcripts
- `audit_score` - Score credibility
- `nexus_bucket` - Assemble stories

**Body:**
```json
{
  "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5"
}
```

### POST /api/jobs/runs/[id]/retry
Retry a failed job run.

---

## Onboarding

### GET /api/onboarding/status?topic_id=xxx
Get onboarding progress for topic.

**Response:**
```json
{
  "topic_id": "...",
  "steps": [...],
  "progress": {
    "completed": 4,
    "total": 7,
    "percentage": 57
  },
  "ready": false,
  "next_step": "add_youtube_sources"
}
```

### POST /api/onboarding/quickstart
Create topic with full configuration in one call.

**Body:**
```json
{
  "name": "Hood Content",
  "description": "Street news and culture",
  "initial_entities": ["CHICAGO", "ATLANTA"],
  "initial_patterns": ["shot", "arrested", "beef"],
  "hours_back": 72
}
```

### POST /api/onboarding/discover-sources
Find YouTube channels for a niche.

**Body:**
```json
{
  "search_terms": ["battle rap commentary", "battle rap reactions"],
  "platform": "youtube",
  "max_results": 10
}
```

### POST /api/onboarding/test
Test intelligence components.

**Body:**
```json
{
  "topic_id": "...",
  "mode": "monitor"
}
```

---

## RAG (Retrieval Augmented Generation)

### POST /api/rag/chat
Chat with your data using RAG.

**Body:**
```json
{
  "message": "Who is Cassidy in battle rap?",
  "mode": "entity"
}
```

### POST /api/rag/index
Index content into vector database.

### GET /api/rag/status
Check RAG service status.

---

## Research Runs

### GET /api/research/runs
List research runs with transparency stats.

**Query Params:**
- `topic_id` - Filter by topic
- `status` - Filter by status
- `limit` (default: 20)

### GET /api/research/runs/[id]
Get research run details.

---

## Voice & Audio

### GET /api/voices
List available ElevenLabs voices.

### GET /api/voice
Get voice configuration.

### GET /api/llm/status
Check LLM service status.

---

## Other Endpoints

### GET /api/claims
List extracted claims.

### POST /api/exports
Export content.

### GET /api/producers
List producers.

### GET /api/workflows
List workflows.

### POST /api/pull
Pull latest content from sources.

### GET /api/usage
Get API usage statistics.

### POST /api/style/analyze
Analyze content style.

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

**Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing/invalid params)
- `404` - Not Found
- `500` - Server Error

---

## Rate Limits

No rate limits for local development. Production deployments should implement appropriate limits.
