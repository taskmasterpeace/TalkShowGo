# 🎬 Producer-Driven Content System

## The Game-Changer

This system revolutionizes content creation by using **AI Producer personalities** to autonomously analyze Twitter intelligence and generate broadcast-quality debate shows.

### What Makes This Special

**Traditional Approach:**
```
User picks topic → System generates generic content → Manual editing
```

**Our Approach (Game-Changing):**
```
Twitter Intelligence (PRIMARY SOURCE)
    ↓
Producer AI analyzes opportunities
    ↓
Selects optimal show format + hosts
    ↓
Generates professional content with context
    ↓
Quality gates ensure readiness
    ↓
Broadcast-ready show (minimal editing)
```

---

## 🧠 The Producer AI System

### 6 Producer Personalities

Each producer has unique attributes that affect how they gather info and what they produce:

#### 1. **The Drama Hunter** 🔥
- **Best For:** Debates, hot takes, controversial topics
- **Speed:** Fast
- **Accuracy:** Moderate
- **Engagement:** ⭐⭐⭐⭐⭐ Very High
- **Loves:** Conflict, controversy, viral moments
- **Creates:** Highly engaging, shareable content

#### 2. **The Fact Checker** 📊
- **Best For:** Investigations, news bulletins, rumor verification
- **Speed:** Slow
- **Accuracy:** ⭐⭐⭐⭐⭐ Very High
- **Engagement:** Moderate
- **Loves:** Verification, multiple sources, accuracy
- **Creates:** Trustworthy, thoroughly vetted content

#### 3. **The Deep Diver** 🔍
- **Best For:** Deep dives, narrative stories, interviews
- **Speed:** Very Slow
- **Accuracy:** High
- **Engagement:** High
- **Loves:** Rabbit holes, connections, hidden details
- **Creates:** Comprehensive, revealing content

#### 4. **The Speed Demon** ⚡
- **Best For:** Breaking news, quick reactions, hot takes
- **Speed:** ⚡⚡⚡ Very Fast
- **Accuracy:** Moderate
- **Engagement:** Moderate
- **Loves:** Being first, immediate reactions
- **Creates:** Timely, breaking content

#### 5. **The Storyteller** 📖
- **Best For:** Narrative stories, documentaries, interviews
- **Speed:** Moderate
- **Accuracy:** High
- **Engagement:** ⭐⭐⭐⭐⭐ Very High
- **Loves:** Dramatic arcs, human elements, compelling narratives
- **Creates:** Emotionally engaging stories

#### 6. **The Community Pulse** 🎤
- **Best For:** Panel discussions, recaps, predictions
- **Speed:** Moderate
- **Accuracy:** Moderate
- **Engagement:** High
- **Loves:** Community reactions, sentiment, what people think
- **Creates:** Voice-of-the-people content

---

## 🚀 Quick Start

### 1. API Usage (Recommended)

```bash
# Generate a show with a specific producer
curl -X POST http://localhost:3000/api/producer/generate-show \
  -H "Content-Type: application/json" \
  -d '{
    "producer_archetype": "drama_hunter",
    "topic_id": "your-topic-uuid",
    "topic": "Should battle rappers prioritize performance or lyrical complexity?",
    "target_duration_minutes": 15
  }'
```

**Response:**
```json
{
  "success": true,
  "show_run_id": "uuid",
  "producer": {
    "name": "The Drama Hunter",
    "archetype": "drama_hunter",
    "production_brief": "Full production brief with 5Ws, angle, sources..."
  },
  "format": {
    "type": "debate",
    "name": "Talk Show Debate",
    "duration": 15
  },
  "hosts": [
    {"id": "...", "name": "The Showman", "archetype": "performer"},
    {"id": "...", "name": "The Lyricist", "archetype": "purist"}
  ],
  "intelligence": {
    "tweets_analyzed": 87,
    "entities_tracked": 5,
    "claims_verified": 3
  },
  "quality": {
    "readiness_score": 0.85,
    "status": "ready_to_publish",
    "gates": {
      "hasEnoughSources": true,
      "hasConflict": true,
      "has5Ws": true,
      "isVerified": true
    }
  },
  "stats": {
    "total_turns": 20,
    "total_words": 1234,
    "estimated_duration_minutes": 9,
    "cost_usd": 0.0087
  }
}
```

### 2. Daily Automation

```bash
# Run daily production pipeline
npx tsx --env-file=.env daily-producer-run.ts
```

**What it does:**
1. Analyzes Twitter intelligence from last 24 hours
2. Scores opportunities by engagement + controversy
3. Selects top 3 opportunities
4. Auto-generates shows with optimal producers
5. Quality checks all output
6. Publishes ready shows, flags others for review

**Schedule with cron:**
```bash
# Every day at 8am
0 8 * * * cd /path/to/talkshowgo && npx tsx --env-file=.env daily-producer-run.ts
```

---

## 📊 How Producer Selection Works

### Automatic Selection

The system auto-selects producers based on opportunity type:

| Opportunity Type | Producer Selected | Why |
|-----------------|------------------|-----|
| **Conflict** | Drama Hunter | Maximizes engagement through controversy |
| **Breaking News** | Speed Demon | Fast turnaround for timely content |
| **Rumor Spreading** | Fact Checker | Verifies before publishing |
| **Developing Story** | Storyteller | Crafts narrative arc |
| **Single Perspective** | Deep Diver | Finds missing viewpoints |
| **Community Consensus** | Community Pulse | Represents collective voice |

### Manual Override

You can always specify a producer manually:

```json
{
  "producer_archetype": "storyteller",  // Force storyteller
  "topic_id": "...",
  "topic": "..."
}
```

---

## 🎯 Quality Gates

Every show is scored on 4 dimensions:

### 1. **Enough Sources** ✅
- Minimum sources based on producer's `maxSourcesBeforeDecision`
- Drama Hunter: needs 3+ sources
- Fact Checker: needs 8+ sources

### 2. **Has Conflict** (for debate formats) ⚖️
- Requires opposing viewpoints
- Checks for both "supports" and "denies" stances
- Drama Hunter prioritizes this

### 3. **Has 5Ws** 📰
- Who, What, Where, When, Why
- Core journalism requirements
- Fact Checker enforces strictly

### 4. **Is Verified** ✓
- Based on producer's `verificationRigor`
- Speed Demon: 40% verified sources
- Fact Checker: 95% verified sources

### Readiness Score

```
score = 0.25 * hasEnoughSources +
        0.25 * hasConflict +
        0.25 * has5Ws +
        0.25 * isVerified
```

**Thresholds:**
- Speed Demon: 0.5 (50%)
- Most producers: 0.7 (70%)
- Fact Checker: 0.9 (90%)

---

## 🔧 Advanced Configuration

### Host Selection

**Auto-select (default):**
```json
{
  "producer_archetype": "drama_hunter"
  // Producer picks hosts automatically
}
```

**Manual selection:**
```json
{
  "producer_archetype": "drama_hunter",
  "host_ids": ["host-1-uuid", "host-2-uuid"]
}
```

**Hybrid (producer suggests, you override):**
1. Call API without `host_ids`
2. Review suggested hosts in production brief
3. Re-call with `host_ids` if you want different hosts

### Show Format

**Auto-select (default):**
- Producer decides based on opportunity type
- Conflict → Talk Show Debate
- Breaking → News Bulletin
- Developing → Narrative Story

**Manual override:**
```json
{
  "producer_archetype": "storyteller",
  "show_format_id": "your-format-uuid"
}
```

### Duration

**Default:** Producer decides based on format
- News Bulletin: 3-5 min
- Debate: 10-15 min
- Deep Dive: 20-30 min

**Manual override:**
```json
{
  "target_duration_minutes": 20
}
```

---

## 📁 File Structure

```
src/
├── lib/
│   ├── debate/
│   │   ├── producer-orchestrator.ts  # 🎯 THE GAME-CHANGER
│   │   ├── orchestrator.ts           # Conversation generation
│   │   ├── host-generator.ts         # Host creation/selection
│   │   └── types.ts
│   ├── producers/
│   │   ├── index.ts                  # Producer class
│   │   └── types.ts                  # Producer profiles
│   ├── twitter-intelligence.ts       # Twitter analysis
│   └── producer.ts                   # Opportunity detection
├── app/api/producer/generate-show/
│   └── route.ts                      # API endpoint
daily-producer-run.ts                 # Automation script
```

---

## 🎪 Example Use Cases

### Use Case 1: Daily Show Generation

**Goal:** Generate 3 shows every morning based on yesterday's Twitter activity

**Solution:**
```bash
# Set up cron job
0 8 * * * npx tsx daily-producer-run.ts

# Script will:
# 1. Analyze all active topics
# 2. Score opportunities
# 3. Generate top 3 shows
# 4. Email summary report
```

**Output:**
- 3 ready-to-publish shows
- Production briefs for review
- Quality scores and recommendations

### Use Case 2: Breaking News Response

**Goal:** Immediately create content when something breaks

**Solution:**
```typescript
// Webhook handler
app.post('/webhook/breaking-news', async (req) => {
  const { topic, topic_id } = req.body

  const result = await fetch('/api/producer/generate-show', {
    method: 'POST',
    body: JSON.stringify({
      producer_archetype: 'speed_demon',  // Fast turnaround
      topic_id,
      topic,
      target_duration_minutes: 5  // Quick 5-min bulletin
    })
  })

  if (result.quality.readiness_score > 0.6) {
    // Auto-publish
    await publishShow(result.show_run_id)
  }
})
```

### Use Case 3: Editorial Workflow

**Goal:** Producer suggests shows, editor approves/edits

**Solution:**
```bash
# 1. Generate with Drama Hunter
curl -X POST /api/producer/generate-show \
  -d '{"producer_archetype": "drama_hunter", ...}'

# 2. Review production brief
# 3. If hosts aren't right, regenerate with different hosts
curl -X POST /api/producer/generate-show \
  -d '{
    "producer_archetype": "drama_hunter",
    "host_ids": ["better-host-1", "better-host-2"],
    ...
  }'

# 4. Approve and publish
```

---

## 🚨 Error Handling

### NO_TWEETS_FOUND
**Cause:** Topic has no recent tweets matching criteria
**Solution:** Check if `topic_id` is correct or lower `minEngagement` threshold

### NO_TOPICS_OR_ENTITIES_EXTRACTED
**Cause:** LLM couldn't extract meaningful content
**Solution:** Content may be too sparse. Need more tweets or different topic.

### Producer declined to produce
**Cause:** Producer's confidence threshold not met
**Solution:** Try different producer archetype or topic with more engagement

---

## 💡 Pro Tips

### 1. **Match Producer to Content Type**
- Controversy? → Drama Hunter
- Complex topic? → Deep Diver
- Time-sensitive? → Speed Demon

### 2. **Let Producers Auto-Select Hosts**
- Producers know which host personalities create best dynamics
- Drama Hunter picks high-aggression + high-analytical for maximum conflict
- Storyteller picks hosts with good narrative arcs

### 3. **Use Quality Scores**
- Below 0.6: Don't publish, needs work
- 0.6-0.7: Review before publishing
- Above 0.7: Safe to auto-publish

### 4. **Monitor Costs**
- Drama Hunter: Low cost (few sources, fast)
- Fact Checker: High cost (many sources, thorough)
- Balance based on budget

---

## 🔮 Future Enhancements

- [ ] Multi-producer collaboration (Drama Hunter finds topic, Fact Checker verifies)
- [ ] Learning from user feedback (adjust producer weights)
- [ ] Custom producer archetypes (create your own)
- [ ] Producer vs Producer debates (meta!)
- [ ] Real-time producer dashboard
- [ ] A/B testing different producers on same topic

---

## 📞 Support

Questions? Issues?
- Check API: `GET /api/producer/generate-show`
- Run with debug: `DEBUG=* npx tsx daily-producer-run.ts`
- Review production briefs for detailed reasoning

**The system is designed to be autonomous but transparent.** Every decision is logged and explainable.
