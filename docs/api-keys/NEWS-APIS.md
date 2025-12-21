# News APIs Setup Guide

Talk Show Go uses a dual-API pattern for news aggregation with automatic failover.

---

## Overview

| API | Role | Free Tier |
|-----|------|-----------|
| **TheNewsAPI** | Primary | 100 requests/day |
| **NewsData.io** | Backup | 200 credits/day |
| **RSS Feeds** | Fallback | Unlimited |

When TheNewsAPI hits rate limit, system automatically switches to NewsData.io.
If both are unavailable, RSS feeds provide free backup.

---

## TheNewsAPI Setup

### Sign Up

1. Go to https://www.thenewsapi.com
2. Click "Get Started"
3. Create account

### Get API Key

1. Log in to dashboard
2. Copy your API token
3. Add to `.env.local`:

```env
THENEWSAPI_KEY=your_key_here
```

### Pricing

| Plan | Price | Requests/Day |
|------|-------|--------------|
| Free | $0 | 100 |
| Basic | $19/mo | 2,500 |
| Standard | $49/mo | 10,000 |
| Pro | $79/mo | 25,000 |

---

## NewsData.io Setup

### Sign Up

1. Go to https://newsdata.io
2. Click "Register"
3. Create account

### Get API Key

1. Log in to dashboard
2. Go to API Keys section
3. Copy your API key
4. Add to `.env.local`:

```env
NEWSDATA_API_KEY=your_key_here
```

### Pricing

| Plan | Price | Credits/Day |
|------|-------|-------------|
| Free | $0 | 200 |
| Basic | $199/mo | 20,000/month |
| Professional | $399/mo | 50,000/month |

**Note:** Free tier has 12-hour delay on articles.

---

## Verify Setup

1. Visit http://localhost:3000/studio/system-status
2. Check "News Sources" section
3. Both should show "Connected"

Or test the aggregator:
```bash
# Check status
curl "http://localhost:3000/api/intelligence/news?status=true"

# Search news
curl "http://localhost:3000/api/intelligence/news?q=technology&limit=5"
```

---

## How Failover Works

```
1. Request arrives
2. Try TheNewsAPI
   ├── Success → Return results
   └── Rate limited (429) → Mark as limited
3. Try NewsData.io
   ├── Success → Return results
   └── Rate limited → Mark as limited
4. Try RSS feeds
   └── Always available (free)
5. Return results from whichever worked
```

Rate limit cooldowns:
- TheNewsAPI: 1 hour
- NewsData.io: 15 minutes

---

## RSS Feeds (Free Backup)

RSS feeds are always available as backup. Pre-configured feeds include:

**Global News:**
- BBC World News
- CNN Top Stories
- NPR News
- AP News

**Tech:**
- TechCrunch
- Ars Technica
- The Verge

**Entertainment:**
- Variety
- Billboard

See `src/lib/rss-feeds-config.ts` to customize feeds.

---

## Usage

### API Endpoints

```bash
# Search news
GET /api/intelligence/news?q=query&limit=10

# Get headlines
GET /api/intelligence/news?headlines=true

# Force RSS only
GET /api/intelligence/news?source=rss&q=query

# Check aggregator status
GET /api/intelligence/news?status=true
```

### In Research Pipeline

News is automatically included in research:
1. YouTube search
2. Twitter search
3. Web search (SearXNG)
4. **News search (aggregator)**

---

## Troubleshooting

### "Missing API key"
- Check `.env.local` has the key
- Restart dev server after changes

### Always using backup
- TheNewsAPI may be rate limited
- Check status page for cooldown time
- Free tier allows 100 requests/day

### No results
- Try broader search terms
- Check if services are configured
- Use RSS as fallback

---

## Recommendations

**For Development:**
- Use both free tiers
- 300 requests/day combined is plenty

**For Production:**
- TheNewsAPI Basic ($19/mo)
- NewsData.io Free (backup)
- RSS feeds (unlimited fallback)

---

## Next Steps

- [Back to Deployment Guide](../DEPLOYMENT.md)
- [Optional APIs](./OPTIONAL.md)
