# TalkShowGo Code Audit Plan

## Grading Categories

Each file is graded A-F on these categories:

| Category | What It Measures | A Grade Means |
|----------|-----------------|---------------|
| **Correctness** | Does it work? Bugs, broken imports, dead references | Zero bugs, all imports resolve, no dead references |
| **Type Safety** | TypeScript strictness, proper types, no `any` | Full type coverage, no implicit `any`, proper interfaces |
| **Error Handling** | Try/catch, edge cases, graceful failures | All async ops wrapped, meaningful errors, no silent failures |
| **Dead Code** | Unused imports, unreachable code, stale references | Zero unused imports/vars, no commented-out code blocks |
| **API Contract** | Request validation, response shape, status codes | Validates all inputs, consistent response shape, correct HTTP codes |
| **Security** | Input sanitization, secrets handling, injection risk | No hardcoded secrets, sanitized inputs, no injection vectors |
| **Simplicity** | Over-engineering, unnecessary abstractions, clarity | Minimal code for the job, clear naming, no premature abstraction |

## Grading Scale
- **A**: Production-ready, no issues
- **B**: Minor issues, works but could be cleaner
- **C**: Significant issues that should be fixed
- **D**: Broken or dangerous, must fix
- **F**: Non-functional or security risk

## Audit Scope

### Core Pipeline (MUST audit)
- `src/lib/story-pipeline.ts`
- `src/lib/research-workflow.ts`
- `src/lib/openrouter.ts`
- `src/lib/dia.ts`
- `src/lib/prompt-registry.ts`
- `src/lib/web-search.ts`
- `src/lib/entity-enrichment.ts`
- `src/lib/twitter-intelligence.ts`
- `src/lib/debate/producer-orchestrator.ts`
- `src/lib/debate/audio.ts`
- `src/lib/debate/host-generator.ts`

### API Routes (MUST audit)
- `src/app/api/stories/pipeline/route.ts`
- `src/app/api/producer/generate-show/route.ts`
- `src/app/api/stories/daily-show/route.ts`
- `src/app/api/intelligence/*/route.ts`
- `src/app/api/topics/*/route.ts`
- `src/app/api/entities/*/route.ts`

### Support Libraries
- `src/lib/db.ts`
- `src/lib/queue.ts`
- `src/lib/perplexity.ts`
- `src/lib/deep-research.ts`
- `src/lib/twitter-sentiment.ts`
- `src/lib/research-package.ts`

## Testing Methods

| Fix Type | Test Method |
|----------|-------------|
| TypeScript errors | `npx tsc --noEmit` must pass |
| Broken imports | `npx tsc --noEmit` + grep for import targets |
| Dead code | `npx tsc --noEmit` with `noUnusedLocals` |
| API contracts | Manual curl test or build verification |
| Error handling | Code review — verify try/catch on all async |
| Security | grep for hardcoded keys, unsanitized inputs |

## Execution Plan

The Ralph loop will:
1. Audit files in batches (3-5 at a time)
2. Grade each file on all 7 categories
3. Log grades to `docs/audit-results.md`
4. Fix anything below A
5. Run `npx tsc --noEmit` after each batch of fixes
6. Continue until all files are A-grade
7. Final verification: full `npx tsc --noEmit` + `npm run build`
