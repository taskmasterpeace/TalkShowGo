# What "Build a Show" Means — The Freshness Doctrine
*Robert's question, 2026-09-05: sports data goes stale fast, so we chase new stories — but not always. Here are the edge cases and the rules.*

## The core rule
A show is built from a **time window**, not just a topic. Every beat already carries `show.timespan_hours`
(THE HUDDLE: 24-48h). "Build a show" = *"the best contestable stories **inside this window**, argued with the
freshest evidence available — unless the format says otherwise."*

## The stringer already has the gears (use them deliberately)
| mode | what it does | when |
|---|---|---|
| `current` | recent uploads first | game-week sports, breaking news — **the default for daily shows** |
| `context` | pure relevance | explainers, "who is this guy" segments |
| `legacy` | relevance, all-time | history/retrospective shows, anniversary episodes |
| `dual` | fresh pass + relevance pass, merged | the safe default when you don't know |

The Miami build now passes `mode: current`. **Queued fix:** the beat should declare its default mode
(`sports → current+dual`) so every build inherits it instead of relying on the caller to remember.

## The edge cases (each with its rule)

1. **Game just happened** → the window shrinks. A 45-6 blowout from last night IS the show; a take recorded
   before kickoff is already stale. Rule: post-game, prefer `current` + last-24h and let the report's
   freshness histogram prove the dossier is actually fresh.

2. **Off-season / bye week** → the window widens and EVERGREEN debates are legitimate ("is Tony the best in
   the country," "greatest Canes team ever"). Staleness isn't failure here — it's the format. Rule: the
   producer picks window-or-evergreen per episode; evergreen uses `context`/`legacy` on purpose.

3. **MIXED-ERA CONTAMINATION — the dangerous one, and it already bit us.** Our own QB dossiers blended
   last-year's Penix injury coverage with this-camp coverage, so one build said "out for the season" and the
   next said "camp sharp." Same search, different eras, parsed as one truth. Rules:
   - every source keeps its `published_at`; the report shows the freshness histogram (done);
   - **queued:** the parser gets an as-of discipline — when two claims about the same fact disagree, prefer
     the newer source and flag the conflict ("conflicting by date") instead of keeping both silently;
   - the floor's question should carry the as-of framing when it matters ("as of this week...").

4. **Breaking news mid-build** → a dossier is a snapshot. Rule: stamp the dossier's `as_of` (exists) into the
   episode's cold open when the story is volatile ("as of tonight, no starter has been named"), and rebuilding
   is cheap now (~minutes) — rebuild rather than patch.

5. **History/documentary shows** → staleness is the point. `legacy` mode, no freshness gate, the validation
   contract swaps the freshness check for a depth check.

6. **Rumor lifecycle** → a fresh rumor can be *newer* than its own debunk if windows are sloppy. Rule: the
   attributed-claim system already labels rumor vs fact; recency ordering must apply WITHIN the claim's
   thread (the debunk beats the rumor it debunks, whatever the timestamps).

7. **Channels decay** → a channel validated in September can be dead by January. Rule: topic validation isn't
   one-time — re-run `bootstrap_topic` validation on a cadence (monthly, or pre-season) and before any big
   relaunch; the report's recency column shows decay instantly.

8. **Slow news day** → nothing meets the window. Rule: the build should say so honestly (the validation
   pattern: "0 stories inside 24h — widen to 72h or go evergreen?") rather than stretching a stale story as
   if it were tonight's news.

9. **Mixed episodes** → one hot segment + one evergreen segment is a GOOD show shape (tonight's game + a
   big-picture debate). The stitcher already handles per-segment topics; freshness is per-SEGMENT, not
   per-episode.

## What's already true vs queued
- ✅ per-source dates, `as_of` stamps, `timespan_hours`, four search modes + dual, freshness histogram in
  every dossier report, cheap rebuilds
- 🔜 beat-declared default mode · parser era-conflict flagging ("newer source wins, conflict flagged") ·
  slow-news-day honesty check in the show build · re-validation cadence for channels
