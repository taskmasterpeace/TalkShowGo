# Producer Workflow Guide

## The Content Pipeline

```
SOURCES → FETCH → EXTRACT → AUDIT → STORY → REVIEW → PUBLISH
```

---

## PHASE 1: TWITTER SOURCES

### How It Works
1. You add Twitter accounts to monitor (battlers, bloggers, leagues)
2. The PERIMETER SWEEP job fetches their recent tweets
3. Tweets are stored in `tweets_raw` table for processing

### Add Twitter Sources

**Via API:**
```bash
# Add a Twitter source
curl -X POST http://localhost:3000/api/topics/864dbcf4-e1f7-4b1a-86ed-c18007439ad5/sources \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "uraboratv",
    "platform": "twitter",
    "source_type": "league",
    "status": "seed"
  }'
```

**Via UI:**
- Go to `/studio/sources`
- Click "Add Source"
- Enter handle, select type (battler, blogger, league, media)

### Source Types
- `battler` - Individual battlers (e.g., @GeechiGotti)
- `blogger` - Commentary/media (e.g., @JayBlac1615)
- `league` - Organizations (e.g., @uraboratv, @KingOfTheDot)
- `media` - News outlets (e.g., @HipHopIsReal)
- `fan` - Community voices

### Test Twitter Connection
```bash
# Test fetching a user's timeline
curl http://localhost:3000/api/twitter/timeline?username=uraboratv
```

### Run Perimeter Sweep (Fetch Tweets)
```bash
# Trigger the job
curl -X POST http://localhost:3000/api/jobs/perimeter_sweep/trigger \
  -H "Content-Type: application/json" \
  -d '{"topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5"}'
```

---

## PHASE 2: YOUTUBE CHANNELS

### How It Works
1. You add YouTube channels to monitor
2. The RELAY FETCH job gets recent videos
3. RECON SEARCH finds relevant content
4. Transcripts are fetched for analysis

### Add YouTube Channels

**Via API:**
```bash
# Add a YouTube channel
curl -X POST http://localhost:3000/api/topics/864dbcf4-e1f7-4b1a-86ed-c18007439ad5/youtube \
  -H "Content-Type: application/json" \
  -d '{
    "channel_name": "URLTV",
    "channel_id": "UCjPVlsv6IYlw6Y3a5qL9TsQ"
  }'
```

### Run YouTube Fetch
```bash
# Fetch from trusted channels
curl -X POST http://localhost:3000/api/jobs/relay_fetch/trigger \
  -H "Content-Type: application/json" \
  -d '{"topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5"}'
```

---

## PHASE 3: EXTRACTION (Entities & Claims)

### How It Works
1. EXTRACTION RUN processes tweets and transcripts
2. Extracts entities (people, orgs, events)
3. Extracts claims (who said what)
4. Detects sentiment and relationships

### Run Extraction
```bash
curl -X POST http://localhost:3000/api/jobs/extraction_run/trigger \
  -H "Content-Type: application/json" \
  -d '{"topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5"}'
```

### View Extracted Entities
- Go to `/studio/entities`
- See all people, organizations, events
- Enrich entities with web search for context

---

## PHASE 4: STORY GENERATION

### Quick Story (One Command)
```bash
# Generate a story about a topic
curl -X POST http://localhost:3000/api/stories/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Geechi Gotti vs Rum Nitty battle",
    "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5",
    "use_enhanced_workflow": true,
    "length": "medium",
    "generate_audio": true,
    "enable_interview_lookup": true
  }'
```

### For Legal/Allegation Stories
```bash
# Story about snitching/paperwork (auto-searches for documents)
curl -X POST http://localhost:3000/api/stories/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Bad Newz snitching allegations paperwork",
    "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5",
    "use_enhanced_workflow": true,
    "enable_document_search": true
  }'
```

---

## PHASE 5: REVIEW & PUBLISH

### Review Stories
- Go to `/nexus` - See story candidates
- Click a story to open `/sanction?story={id}`
- Review sources, entities, claims
- Edit the draft if needed
- Click GREENLIGHT to approve

### Export to Production
- Go to `/signal` - See export queue
- Stories get packaged with audio
- Download or send to production

---

## DAILY PRODUCER CHECKLIST

### Morning Sweep
1. Check `/jobs` - Make sure overnight jobs completed
2. Check `/perimeter` - See what Twitter picked up
3. Check `/extraction` - Review new entities

### Story Production
1. Go to `/nexus` - Pick a story candidate
2. Open in `/sanction` - Review and edit
3. Greenlight or kill
4. Check `/signal` - Confirm export

### Monitoring
- `/health` - System health status
- `/jobs` - Job success/failure
- `/studio/entities` - Entity accuracy

---

## TROUBLESHOOTING

### Twitter Not Fetching
```bash
# Check if API key is working
curl http://localhost:3000/api/twitter/test
```

### YouTube Not Finding Content
```bash
# Test YouTube search
curl "http://localhost:3000/api/youtube/search?q=battle%20rap"
```

### Job Failed
- Go to `/jobs`
- Find the failed job
- Check error message
- Click "Run Now" to retry (after fixing issue)

---

## KEY APIS

| Endpoint | Purpose |
|----------|---------|
| `POST /api/jobs/{type}/trigger` | Run a job manually |
| `GET /api/twitter/timeline?username=X` | Test Twitter fetch |
| `GET /api/youtube/search?q=X` | Test YouTube search |
| `POST /api/stories/pipeline` | Generate a story |
| `GET /api/topics/{id}/entities` | List entities |
| `POST /api/entities/{id}/enrich` | Enrich an entity |

---

## CURRENT BATTLE RAP SOURCES

### Twitter (Already Configured)
- @uraboratv (URL)
- @KingOfTheDot (KOTD)
- @RBE_studios (RBE)
- @JayBlac1615 (Blogger)
- @ABORATALIFE (AyeVerb)

### YouTube (Already Configured)
- URLTV
- King Of The Dot Entertainment
- Rare Breed Entertainment
- Jayblac1615
- No Studio'N Network

---

## NEXT: Add These Sources

### Bloggers to Add (Twitter)
- @15MOFE
- @HipHopIsReal
- @champduane
- @AngryFan007

### Interview Channels (YouTube)
- HHIR Hip Hop Is Real
- VladTV
- No Jumper (when battle rap content)
