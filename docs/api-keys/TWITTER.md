# Twitter API Setup Guide

Talk Show Go uses twitterapi.io (NOT the official Twitter API) for social media monitoring.

---

## About twitterapi.io

- **Website:** https://twitterapi.io
- **Pricing:** Pay-as-you-go
- **Rate:** ~$0.15 per 1,000 tweets

This is NOT the official Twitter/X API. It's a third-party service that provides easier access to Twitter data.

---

## Sign Up

1. Go to https://twitterapi.io/dashboard
2. Create an account
3. Add payment method (pay-as-you-go)
4. Generate an API key

---

## Get API Key

1. Log in to twitterapi.io
2. Go to Dashboard
3. Find your API key
4. Copy the key

---

## Add to Talk Show Go

Edit `.env.local`:

```env
TWITTER_API_KEY=your_api_key_here
```

Restart the development server:
```bash
npm run dev
```

---

## Verify Setup

1. Visit http://localhost:3000/studio/system-status
2. Look for "Twitter" under Content Sources
3. Should show "Connected"

Or test directly:
```bash
curl "http://localhost:3000/api/twitter/search?q=battle%20rap"
```

---

## Features Used

| Feature | Endpoint | Cost |
|---------|----------|------|
| Search tweets | `/twitter/search` | ~$0.15/1K |
| User info | `/twitter/user/info` | ~$0.18/1K |
| User timeline | `/twitter/user/tweets` | ~$0.15/1K |

---

## Rate Limits

twitterapi.io has generous rate limits:
- 100 requests per minute
- No daily limit (pay-as-you-go)

Talk Show Go tracks rate limits and shows warnings on the System Status page.

---

## Usage in Talk Show Go

Twitter is used for:
- Monitoring configured accounts
- Searching for trending topics
- Getting sentiment on news stories
- Finding real-time reactions

### Configure Sources

Add Twitter accounts to monitor:
1. Go to Studio > Topics
2. Select your topic
3. Add Twitter accounts as sources

---

## Troubleshooting

### "API key invalid"
- Verify key in twitterapi.io dashboard
- Check for spaces in `.env.local`

### "Rate limited"
- Wait a few minutes
- Check usage in dashboard

### No results
- Verify search query
- Check account privacy settings

---

## Alternatives

If you don't want to use Twitter:
- Talk Show Go works without Twitter
- YouTube and News APIs are more important
- Twitter is optional but recommended

---

## Next Steps

- [Back to Deployment Guide](../DEPLOYMENT.md)
- [News APIs Setup](./NEWS-APIS.md)
