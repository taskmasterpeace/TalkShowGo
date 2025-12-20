# Talk Show Go - Data Flow & Architecture

## Overview

Talk Show Go transforms raw social media content into polished talk shows and news content. Everything flows through the database - there's no complex orchestration system, just tables that track state.

## The Pipeline

```
PERIMETER → EXTRACTION → AUDIT → NEXUS → SANCTION → SIGNAL
    ↓           ↓          ↓        ↓         ↓         ↓
 tweets_raw  entities   consensus  story_   stories  productions
 youtube_     claims    _scores   candidates
 videos
```

## Data Flow in Detail

### 1. PERIMETER - Raw Intelligence

**What happens:**
- Twitter API fetches tweets from monitored accounts
- YouTube API fetches videos from tracked channels
- RSS feeds pull articles

**Database tables:**
- `tweets_raw` - All fetched tweets
- `youtube_videos` - All fetched videos
- `source_accounts` - Monitored Twitter/YouTube accounts

**Workflow runs every:** 15-60 minutes

**LLM needed:** No (just API calls)

---

### 2. EXTRACTION - Entity & Claim Discovery

**What happens:**
- LLM analyzes raw content
- Extracts entities (people, events, orgs)
- Identifies claims (statements people make)
- Tags sentiment (positive/negative/neutral)

**Database tables:**
- `entities` - Discovered people, events, etc.
- `entity_mentions` - Links entities to tweets with sentiment
- `claims` - Statements extracted from content
- `claim_mentions` - Links claims to tweets with stance

**Workflow runs every:** 30 minutes

**LLM needed:** YES - This is where local LLM saves money!

**Example prompt:**
```
Analyze this tweet and extract:
1. Entities mentioned (people, events, organizations)
2. Claims being made (factual statements, opinions, predictions)
3. Sentiment toward each entity
4. Stance on each claim (supports, denies, questions)

Tweet: "Geechi Gotti 3-0'd Surf at Summer Madness, that was a body! URL needs to stop booking these mismatches 😤"
```

---

### 3. AUDIT - Consensus Scoring

**What happens:**
- For each claim, counts how many sources support vs deny
- Calculates consensus (how much agreement)
- Calculates contention (how divisive)
- Updates source credibility based on accuracy

**Database tables:**
- `consensus_scores` - Consensus/contention for each claim
- `claim_verdicts` - Final verdict (confirmed, disputed, etc.)
- `source_credibility_log` - Track source accuracy over time

**Workflow runs every:** 60 minutes

**LLM needed:** Optional - Can use rules-based calculation

---

### 4. NEXUS - Story Threading

**What happens:**
- Groups related claims into story threads
- Identifies story opportunities (breaking, developing, controversial)
- Suggests format (news, debate, narrative)
- Assigns priority

**Database tables:**
- `story_candidates` - Potential stories
- Links to entities and claims

**Workflow runs every:** 2 hours

**LLM needed:** YES - For intelligent grouping

---

### 5. SANCTION - Story Approval

**What happens:**
- Human reviews story candidates
- Assigns Producer (who gathers more info)
- Assigns Host(s) (who presents)
- Approves for production

**Database tables:**
- `stories` - Approved stories
- `productions` - Active productions with assigned team

---

### 6. SIGNAL - Final Output

**What happens:**
- Producer gathers sources into production brief
- Host personality generates script
- TTS generates audio
- Content is published

**Database tables:**
- `productions` - Full production details
- `production_sources` - All sources used
- `export_packages` - Final export payloads

---

## The Team: Producers & Hosts

### Producers (The Gatherers)

Producers research and curate. Each has different priorities:

| Producer | Verification | Speed | Controversy | Best For |
|----------|-------------|-------|-------------|----------|
| Drama Hunter | 30% | 70% | 95% | Debate, Hot Take |
| Fact Checker | 95% | 20% | 20% | News, Deep Dive |
| Speed Demon | 30% | 95% | 50% | Breaking News |
| Storyteller | 60% | 30% | 50% | Narrative, Interview |
| Deep Diver | 70% | 10% | 40% | Documentary |
| Community Pulse | 50% | 50% | 60% | Panel, Recap |

**How assignment works:**
1. Story type is identified (conflict, breaking, developing)
2. Best producer for that type is assigned
3. Producer gathers sources based on their personality
4. Production brief is created

### Hosts (The Presenters)

Hosts have distinct voices and styles:

| Host | Style | Energy | Best For |
|------|-------|--------|----------|
| Maya Sterling | Investigative | Moderate | Deep Dive, News |
| Marcus Blaze | Hot Take | Explosive | Debate, Prediction |
| Devon Sharp | Satirical | Moderate | News Commentary |
| Tasha Raw | Unfiltered | High | Hot Take, Recap |
| James Noble | Narrator | Calm | Narrative, Documentary |
| DJ Momentum | Hype | Explosive | Recap, Prediction |
| King Knowledge | Street Analyst | Moderate | Interview, Panel |

**How assignment works:**
1. Format is chosen (debate, news, narrative)
2. Hosts suited for that format are selected
3. For debates, contrasting styles are paired
4. Script is generated using host's catchphrases and style

---

## LLM Strategy

### Local LLM (Free)
Use for:
- Entity extraction
- Claim identification
- Sentiment analysis
- Script drafts
- Research queries

### Paid API (When needed)
Use for:
- Complex reasoning
- Final script polish
- Fact verification against web
- When local LLM fails

### RAG System
- Index all tweets, claims, entities
- Query before asking LLM questions
- "What do we already know about Geechi Gotti?"
- Reduces duplicate API calls

---

## Workflow Scheduling

Workflows define WHEN pipeline phases run:

```
workflows table:
- name: "Perimeter Sweep - Twitter"
- pipeline_phase: "perimeter"
- schedule_type: "interval"
- schedule_interval_minutes: 15
- use_local_llm: false
```

Schedule types:
- `interval` - Every N minutes
- `cron` - Cron expression
- `manual` - Only when triggered
- `trigger` - On specific event (new_tweet, claim_threshold)

---

## Production Flow Example

**Input:** Tweet "Breaking: Loaded Lux vs Geechi confirmed for SM2025! 🔥"

1. **PERIMETER** stores tweet in `tweets_raw`

2. **EXTRACTION** (local LLM):
   - Entities: Loaded Lux (person), Geechi (person), SM2025 (event)
   - Claim: "Lux vs Geechi confirmed for SM2025"
   - Sentiment: Positive toward all entities

3. **AUDIT**:
   - Check other tweets about this claim
   - 15 support, 2 question → High consensus
   - Verdict: "likely confirmed"

4. **NEXUS**:
   - Groups with other SM2025 tweets
   - Story: "Summer Madness 2025 Lineup Taking Shape"
   - Suggests format: "news_bulletin"

5. **SANCTION**:
   - Human approves story
   - Assigns: Speed Demon (producer), Maya Sterling (host)

6. **SIGNAL**:
   - Producer creates brief with 5Ws
   - Host generates script in her style
   - TTS creates audio
   - Published!

---

## Database Tables Summary

### Core Data
- `topics` - Niches (Battle Rap, etc.)
- `source_accounts` - Monitored accounts
- `tweets_raw` - Raw tweets
- `youtube_videos` - Raw videos
- `entities` - Extracted entities
- `claims` - Extracted claims

### Processing
- `entity_mentions` - Entity-tweet links
- `claim_mentions` - Claim-tweet links
- `consensus_scores` - Claim consensus
- `claim_verdicts` - Final verdicts

### Production
- `story_candidates` - Potential stories
- `stories` - Approved stories
- `productions` - Active productions
- `production_sources` - Sources per production

### System
- `hosts` - Host personalities
- `producers` - Producer archetypes
- `workflows` - Scheduled tasks
- `workflow_runs` - Run history
- `llm_providers` - LLM configuration
- `llm_usage_log` - Token tracking
- `rag_collections` - RAG indexes
- `rag_documents` - Indexed documents
