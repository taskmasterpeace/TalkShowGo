# TalkShowGo Code Audit Results
**Date:** 2026-03-11
**Baseline:** 47 TS errors → 0 TS errors. Build passes.

## Grade Summary

| File | Correct | Types | Errors | Dead | API | Security | Simple | Lowest |
|------|---------|-------|--------|------|-----|----------|--------|--------|
| dia.ts | A | A | A | A | A | A | A | **A** |
| openrouter.ts | A | A | A | B | A | A | A | **B** |
| db.ts | A | A | A | A | A | B | A | **B** |
| prompt-registry.ts | A | A | A | C | A | A | A | **C** |
| intelligence/monitor/route.ts | A | A | A | A | A | A | A | **A** |
| intelligence/research/route.ts | A | A | A | A | A | A | A | **A** |
| pipeline/route.ts | A | B | A | A | A | A | B | **B** |
| producer/generate-show/route.ts | A | A | B | A | A | A | A | **B** |
| stories/daily-show/route.ts | B | B | A | A | A | A | B | **B** |
| web-search.ts | B | B | A | A | B | A | A | **B** |
| perplexity.ts | A | A | B | A | A | A | A | **B** |
| twitter-sentiment.ts | B | B | B | A | A | A | B | **B** |
| transcript-fetcher.ts | B | A | A | A | A | B | A | **B** |
| entity-enrichment.ts | B | B | C | A | A | A | B | **C** |
| debate/audio.ts | B | B | B | A | B | A | B | **B** |
| debate/host-generator.ts | B | C | B | A | B | A | B | **C** |
| debate/orchestrator.ts | B | B | A | A | B | A | C | **C** |
| debate/preparation.ts | B | B | B | A | A | A | A | **B** |
| story-pipeline.ts | B | C | B | B | A | A | C | **C** |
| research-workflow.ts | B | B | B | B | B | A | D | **D** |
| producer-orchestrator.ts | C | C | B | B | B | A | C | **C** |
| deep-research.ts | B | C | B | A | C | B | C | **C** |
| twitter-intelligence.ts | C | C | B | A | B | C | B | **C** |

## Files at A (no fixes needed): 3
- dia.ts
- intelligence/monitor/route.ts
- intelligence/research/route.ts

## Files at B (minor fixes): 10
- openrouter.ts, db.ts, pipeline/route.ts, producer/generate-show/route.ts
- daily-show/route.ts, web-search.ts, perplexity.ts, twitter-sentiment.ts
- transcript-fetcher.ts, debate/audio.ts, debate/preparation.ts

## Files at C (significant fixes): 6
- prompt-registry.ts, entity-enrichment.ts, debate/host-generator.ts
- debate/orchestrator.ts, story-pipeline.ts, producer-orchestrator.ts, deep-research.ts

## Files at D (major fixes): 1
- research-workflow.ts

---

## Fix Plan (Priority Order)

### Priority 1: Security Fixes
1. **twitter-intelligence.ts line 345**: SQL injection via `.or()` with unsanitized entities
   - Fix: Sanitize entity names before building query
   - Test: `npx tsc --noEmit` + grep for `.or()` patterns

### Priority 2: Silent Failures → Meaningful Errors
2. **entity-enrichment.ts line 361**: JSON.parse silently returns empty on failure
   - Fix: Log warning, set `was_enriched: false` with `reason` field
   - Test: `npx tsc --noEmit`
3. **deep-research.ts line 258**: JSON.parse without validation
   - Fix: Add try/catch with meaningful error, validate required fields
   - Test: `npx tsc --noEmit`
4. **twitter-sentiment.ts line 261**: Silent null return
   - Fix: Return `{ error: string }` union type or throw
   - Test: `npx tsc --noEmit`

### Priority 3: Type Safety (`any` elimination)
5. **story-pipeline.ts**: 5+ `as any` casts (lines 553, 683, 692, 1047)
   - Fix: Define proper interfaces for research result variants
   - Test: `npx tsc --noEmit`
6. **host-generator.ts**: `any[]` types (lines 410, 446)
   - Fix: Add proper Host/HostData interfaces
   - Test: `npx tsc --noEmit`
7. **deep-research.ts**: `any[]` returns, untyped callbacks
   - Fix: Define DeepResearchResult interface
   - Test: `npx tsc --noEmit`
8. **web-search.ts line 84**: `(result: any)` in map callback
   - Fix: Define SearXNGResult interface
   - Test: `npx tsc --noEmit`

### Priority 4: Dead Code Removal
9. **producer-orchestrator.ts**: Unused `mapSegmentToEmotion()` function
   - Fix: Delete it
   - Test: `npx tsc --noEmit`
10. **prompt-registry.ts**: Unused `PROMPT_ROLES` emoji constant
    - Fix: Remove if not imported anywhere
    - Test: grep for references

### Priority 5: Null Safety
11. **Multiple files**: `.single()` Supabase calls without null checks
    - Files: producer-orchestrator.ts, host-generator.ts, transcript-fetcher.ts
    - Fix: Add `if (!data)` checks after `.single()` calls
    - Test: `npx tsc --noEmit`
