# Talk Show Go - Test Guide

## System Status

The application is running at: **http://localhost:3008**

### Available Data

| Date | Tweets | Notes |
|------|--------|-------|
| Dec 16, 2025 | 19 tweets | Best data for testing |
| Dec 17, 2025 | 14 tweets | Good data |
| Dec 18, 2025 | 3 tweets | Limited data |

---

## Quick Test: Generate a Daily Show

### Step 1: Open the Daily Show Studio

Go to: **http://localhost:3008/studio/daily-show**

### Step 2: Select a Template

Click on "Battle Rap Daily" or any available template.

### Step 3: Select a Host

Choose from:
- **James Noble** - Documentary narrator (recommended)
- **Marcus Blaze** - Hot takes, high energy
- **Maya Sterling** - Investigative journalist style
- **Devon Sharp** - Witty and satirical
- **Tasha Raw** - Unfiltered street commentary
- **DJ Momentum** - Hype announcer
- **King Knowledge** - Wise analyst

### Step 4: Choose Topics (Date Selection)

1. Click **"Specific Date"** mode
2. Click **"Day Before"** to select December 17, 2025 (best data)
3. Click **"Scan Sources"**

Expected result: You should see 1+ proposed topics based on Twitter activity.

### Step 5: Select Topics for Your Show

Check the boxes next to topics you want to include.

### Step 6: Generate Script

Click "Generate Script" to create the show content.

### Step 7: Generate Audio (Optional)

If you have ElevenLabs configured, click "Generate Audio" to create the MP3.

---

## API Test Commands

### Test Topic Proposal (Dec 17)

```bash
curl "http://localhost:3008/api/stories/daily-show/propose?topic_id=864dbcf4-e1f7-4b1a-86ed-c18007439ad5&target_date=2025-12-17&max_topics=5"
```

### Test Topic Proposal (Dec 16)

```bash
curl "http://localhost:3008/api/stories/daily-show/propose?topic_id=864dbcf4-e1f7-4b1a-86ed-c18007439ad5&target_date=2025-12-16&max_topics=5"
```

### Generate a Show via API

```bash
curl -X POST "http://localhost:3008/api/stories/daily-show" \
  -H "Content-Type: application/json" \
  -d '{
    "topic_id": "864dbcf4-e1f7-4b1a-86ed-c18007439ad5",
    "show_name": "Battle Rap Daily",
    "host_slug": "james_noble",
    "hours_back": 48,
    "generate_audio": false
  }'
```

---

## Key Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | http://localhost:3008 | Dashboard |
| Daily Show Studio | http://localhost:3008/studio/daily-show | Create shows |
| Templates | http://localhost:3008/studio/templates | Edit templates |
| Entities | http://localhost:3008/studio/entities | View/edit entities |

---

## Troubleshooting

### "No trending topics found"

- Make sure you're selecting a date with data (Dec 16 or 17 work best)
- Check that the topic_id is correct: `864dbcf4-e1f7-4b1a-86ed-c18007439ad5`

### Server not responding

```bash
# Check if Docker is running
docker ps

# Restart services
docker-compose up -d

# Check Next.js logs
npm run dev
```

### No audio generated

- Verify ElevenLabs API key is set in `.env.local`
- Check the voice ID: `ZJ7BlVZrxZKBDMTIK5c9`

---

## Data Notes

**YouTube Videos**: The 90 videos in the database don't have `published_at` dates, so they won't appear in date-filtered queries. This needs to be fixed by re-fetching video metadata.

**Twitter Data**: Active from Dec 16-18, 2025. For best results, target Dec 16 or Dec 17.

---

## Next Steps

1. Test the Daily Show wizard at `/studio/daily-show`
2. Generate a show for December 17
3. Review the script and audio output
4. Try different hosts to hear voice variations
