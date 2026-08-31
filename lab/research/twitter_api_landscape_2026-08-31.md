# Twitter/X Programmatic Data Access — Landscape as of 2026-08-31

Researched 2026-08-31 via live docs + search. All URLs verified accessible on this date unless noted.
Workload assumed: 40 trusted public accounts polled 3x/day (~50 tweets/acct/day fetched = 60K tweets/mo) + ~30 keyword searches/day (900/mo). Read-only.

---

## 1. twitterapi.io — ALIVE, healthy, still the price leader

**Status:** Operating normally as of Aug 2026. No rebrand, no outage drama found. Trustpilot 4.6/5 across 30 reviews (97% five-star); 2026 reviews praise 24/7 support and price; two dings: a Feb 2026 review noting occasional latency spikes + missed repost events, one Dec 2025 one-star (unreliable extraction) ([Trustpilot](https://uk.trustpilot.com/review/twitterapi.io), fetched 2026-08-31). Marketing claims 99.99% uptime, ~700-800ms avg response, 1B+ calls served ([twitterapi.io](https://twitterapi.io/), [docs intro](https://docs.twitterapi.io/introduction), fetched 2026-08-31).

**Base URL:** `https://api.twitterapi.io`
**Auth:** single header `X-API-Key: <key>` (no OAuth). ([docs](https://docs.twitterapi.io/introduction))

**Key endpoints (all GET, all verified 2026-08-31 from docs):**
| Purpose | Endpoint | Params | Page size |
|---|---|---|---|
| (a) User's recent tweets | `/twitter/user/last_tweets` | `userId` (preferred) or `userName`, `cursor` (`""` first page), `includeReplies` (default false) | 20/page |
| (b) Advanced/keyword search | `/twitter/tweet/advanced_search` | `query` (required), `queryType` = `Latest` or `Top`, `cursor` | up to 20/page |
| (c) User info | `/twitter/user/info` | `userName` | 1 |
| (c') Batch user info | `/twitter/user/batch_info_by_ids` (per llms.txt index) | userIds | n |
| (d) List timeline | `/twitter/list/tweets_timeline` | `listId`, `cursor` | page |
| Bonus: real-time monitor | POST `/oapi/tweet_filter/add_rule` | `tag`, `value` (e.g. `from:a OR from:b`, max 255 chars), `interval_seconds` (0.05-86400) → webhook/websocket delivery | push |

Full endpoint index: https://docs.twitterapi.io/llms.txt · Endpoint docs: https://docs.twitterapi.io/api-reference/endpoint/get_user_last_tweets , .../tweet_advanced_search , .../get_user_by_username , .../list_timeline.md , .../add_webhook_rule.md

**Pricing (credits; 1 USD = 100,000 credits)** ([pricing page](https://twitterapi.io/pricing), fetched 2026-08-31):
- Tweets: **$0.15 / 1,000** (15 credits each). User profiles: $0.18/1K. Followers: $0.01-0.03/1K tiered.
- Minimum charge: $0.00015 (15 credits)/call — **rising to $0.0015 (150 credits)/call for "list functions" effective Oct 1** (their pricing page, presumably Oct 1, 2026). Raises the floor on empty polls.
- Filter-rule monitoring: $0.00015/tweet delivered; **$0.00012 per empty check** ([webhook blog](https://twitterapi.io/blog/using-webhooks-for-real-time-twitter-data)).
- Pay-as-you-go, no monthly minimum. Recharged credits never expire; subscription bonus credits expire in 30 days (prefer plain recharges).
- Rate limit: up to 200 QPS per client (docs intro) / "1,000+ QPS" in marketing — either way, far beyond our needs. Billed per response size, no fixed-window 429 caps.

**ToS/risk:** Unofficial (scraping-backed) — violates X ToS by definition; the risk is provider shutdown, not our account (no X account/auth involved for reads). See risk section below re: X's Aug 2026 Nitter enforcement.

---

## 2. Official X API — pay-per-use era; 25-30x our unofficial cost

Primary source: [docs.x.com pricing](https://docs.x.com/x-api/getting-started/pricing) + [about page](https://docs.x.com/x-api/getting-started/about-x-api) (fetched 2026-08-31).

**Timeline of changes** ([Postproxy 2026 guide](https://postproxy.dev/blog/x-api-pricing-2026/), corroborated by [SocialCrawl](https://www.socialcrawl.dev/blog/x-twitter-x-api-2026) and [xautodm](https://xautodm.com/blog/x-api-pricing-explained-2026-cheaper-alternatives)):
- Oct 2024: Basic $100→$200/mo.
- Aug 2025: free tier loses like/follow endpoints.
- **Feb 2026: pay-per-use launched as default; free tier discontinued** ($10 one-time voucher to free users); Basic ($200) and Pro ($5,000) closed to new signups (legacy-only); some sources report remaining subscribers being auto-migrated since ~June 2026.
- **Apr 20, 2026: writes raised to $0.015/post; $0.20 surcharge for posts containing links.**

**Current pay-per-use prices** (docs.x.com, primary): reads **$0.005/post**, $0.010/user, $0.005/list resource; writes $0.015/post ($0.20 w/ link). Same resource re-requested within a 24h UTC window charged once. Cap: **3M post reads/mo** per docs.x.com (secondary blogs say 2M — trust docs.x.com). Enterprise ~$42K+/mo.

**Sane for our workload?** Technically yes, financially no: 60K timeline reads + ~18K search reads ≈ 78K × $0.005 ≈ **$390/mo** (24h dedup might trim to ~$270-330). That's ~25-30x twitterapi.io for identical data. Verdict: keep as the "legal bunker" option only — if the unofficial ecosystem gets nuked, cutting to 1 poll/day gets official down to ~$100-130/mo.

---

## 3. Alternatives

### socialdata.tools — ALIVE, best drop-in fallback
- 30+ read-only endpoints (posts, profiles, search, followers, mentions, lists, Spaces). Per-item billing: **$0.0002/tweet or profile delivered** ($0.20/1K, 5x for bios); failed requests unbilled; small free allowance. ([docs pricing](https://docs.socialdata.tools/monitoring/pricing/), fetched 2026-08-31; [SocialCrawl comparison](https://www.socialcrawl.dev/blog/best-twitter-x-data-apis-2026))
- Separate Monitoring API (webhook push): user monitors ~$4.49/mo each at 11-100 monitors → ~$180/mo for 40 accounts — overkill for 3x/day cadence; their search monitors bill $0.0002/tweet delivered + $0.0002/empty execution.
- Our workload on plain endpoints: ~78K items ≈ **$15.60/mo**. Same unofficial-category risk as twitterapi.io.

### Apify actors — viable tertiary, more ops friction
- apidojo "Tweet Scraper V2": **~$0.40/1K tweets**; alternatives: kaitoeasyapi $0.25/1K, epctex $0.18/1K, xquik $0.15/1K ([apify.com/apidojo/tweet-scraper](https://apify.com/apidojo/tweet-scraper), [Use Apify roundup](https://use-apify.com/docs/best-apify-actors/best-twitter-scrapers), searched 2026-08-31). Our load ≈ $19-31/mo + platform overhead. Actor start latency, breakage churn ("why every scraper breaks" is a whole genre now: [BrowserAct](https://www.browseract.com/blog/twitter-scraping-2026)). Use only if both primaries die.

### Nitter — DEAD as of last week. Do not build on it.
- **Aug 24, 2026: X Corp sent cease-and-desist letters** (citing the Texas Harmful Access by Computer Act + Lanham Act) demanding shutdown of all instances and repo removal by Aug 25 5pm EST. nitter.net went offline; other instances got the same letters; dev (Zedeus) halted development pending legal advice. ([TechCrunch, 2026-08-25](https://techcrunch.com/2026/08/25/x-sends-cease-and-desist-to-open-source-project-nitter-over-alleged-scraping/))
- **Repo archived read-only Aug 26, 2026** ([github.com/zedeus/nitter](https://github.com/zedeus/nitter/wiki/Instances); instance health tracker: [status.d420.de](https://status.d420.de/)). Self-hosting is now legally radioactive, not just flaky. Nonviable.

### RSS-Bridge / RSS options — nonviable as primary
- RSS-Bridge's TwitterV2 bridge requires **your own official API bearer token** (i.e., official pay-per-use money) and scraping-mode bridges suffer chronic breakage/blocks ([TwitterV2 bridge doc](https://rss-bridge.github.io/rss-bridge/Bridge_Specific/TwitterV2.html), [Stepper 2026 guide](https://stepper.io/blog/rss-for-twitter-feed)). Post-Nitter C&D, any public scraping-front is on borrowed time. Skip.

---

## 4. RECOMMENDATION

**Primary: twitterapi.io** (already have a working key).
- Poll `/twitter/user/last_tweets` by **userId** 3x/day per account; `advanced_search` with `queryType=Latest` for the 30 daily keyword queries.
- Cost math: 60K timeline tweets × $0.00015 = $9.00 · ~3,600-4,300 poll calls/mo (min-charge floor after Oct 1 ≈ $5-6 but per-tweet cost dominates when pages carry 10+ tweets) · search: 900 queries × ~20 results = ~18K tweets ≈ $2.70. **Total ≈ $12-16/mo.**
- If we ever want faster than a few polls/day, switch accounts to their tweet-filter rules (batch ~8-10 `from:` handles per rule under the 255-char limit; ~5 rules at 1-4h intervals ≈ same money, push delivery, $0.00012/empty check).

**Fallback: socialdata.tools** (~$15.60/mo for identical load). Keep a funded key on standby; build a thin provider adapter (fetchUserTweets / searchTweets / getUser) so swapping is a config change, since the entire unofficial category shares the platform-enforcement risk X just demonstrated on Nitter.

**Bunker: official X pay-per-use** (~$390/mo full load; ~$100-130/mo at 1 poll/day) — only if the unofficial ecosystem is wiped out. Not sane otherwise.

**Do not touch:** Nitter (C&D'd Aug 2026), public RSS bridges, Apify (tertiary only).

---

## 5. Gotchas (things that break naive polling)

1. **20 tweets/page everywhere** on twitterapi.io; cursor pagination: first page `cursor=""`, then follow `next_cursor` while `has_next_page`. There is **no since_id param** — dedupe client-side: keep last-seen tweet ID per account, stop paginating on first already-seen ID.
2. **Search date operators:** `since:`/`until:` datetime strings are explicitly NOT supported on advanced_search — use `since_time:`/`until_time:` with **unix timestamps** (endpoint doc, fetched 2026-08-31).
3. **Use userId, not userName**, for polling — handles get renamed; userId is stable (docs recommend userId).
4. Pages can return **fewer than 20** — they filter ads/non-tweets server-side; don't treat short pages as end-of-data, trust `has_next_page`.
5. **Oct 1 minimum-charge increase** (15 → 150 credits/call on list functions) makes empty polls 10x pricier — don't poll accounts far more often than they tweet; consider a single X List of all 40 accounts + `/twitter/list/tweets_timeline` (1 call sweeps everyone) or filter rules.
6. twitterapi.io's own docs warn last_tweets is the expensive way to watch one account at high frequency — at 3x/day we're fine; at sub-hourly, use filter rules.
7. `includeReplies` defaults false on last_tweets — decide explicitly whether replies matter per account.
8. Reported data-quality edge: occasional **missed retweet/repost events** and latency spikes (Feb 2026 Trustpilot review) — don't build anything that assumes 100% repost capture.
9. Rate limit 200 QPS/client — irrelevant at our volume, but batch politely with small concurrency + retry-with-backoff on 5xx anyway.
10. On official X (if ever used): 24h UTC dedup means re-reads same-day are free once, but each new day re-bills — since_id discipline matters there for cost, not just correctness.
11. **Platform risk is the real gotcha:** X's Aug 24-26, 2026 Nitter kill demonstrates active legal enforcement against unofficial access. twitterapi.io/socialdata absorb that risk for us, but either could vanish with little notice — the provider-adapter + funded-fallback-key pattern is the mitigation, plus archiving every fetched tweet locally on ingest.

## Source index (all fetched/searched 2026-08-31)
- https://docs.twitterapi.io/introduction · https://twitterapi.io/pricing · https://docs.twitterapi.io/llms.txt
- https://docs.twitterapi.io/api-reference/endpoint/get_user_last_tweets · .../tweet_advanced_search · .../get_user_by_username · .../list_timeline.md · .../add_webhook_rule.md
- https://twitterapi.io/blog/using-webhooks-for-real-time-twitter-data
- https://uk.trustpilot.com/review/twitterapi.io
- https://docs.x.com/x-api/getting-started/pricing · https://docs.x.com/x-api/getting-started/about-x-api
- https://postproxy.dev/blog/x-api-pricing-2026/ · https://www.socialcrawl.dev/blog/best-twitter-x-data-apis-2026 · https://xautodm.com/blog/x-api-pricing-explained-2026-cheaper-alternatives
- https://docs.socialdata.tools/monitoring/pricing/
- https://techcrunch.com/2026/08/25/x-sends-cease-and-desist-to-open-source-project-nitter-over-alleged-scraping/ · https://status.d420.de/ · https://github.com/zedeus/nitter/wiki/Instances
- https://apify.com/apidojo/tweet-scraper · https://use-apify.com/docs/best-apify-actors/best-twitter-scrapers · https://www.browseract.com/blog/twitter-scraping-2026
- https://rss-bridge.github.io/rss-bridge/Bridge_Specific/TwitterV2.html · https://stepper.io/blog/rss-for-twitter-feed
