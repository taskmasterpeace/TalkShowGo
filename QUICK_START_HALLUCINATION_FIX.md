# Quick Start: Fix Hallucinations in 2 Hours

This is the **FASTEST path** to significantly reduce hallucinations like "Chef Trez battled Tsu Surf."

---

## Problem Statement

**Current Flow:**
```
Research → Verify INPUT claims → Generate story → ✗ No verification of OUTPUT
```

**Result:** LLM invents facts during generation that weren't in the input.

**Example Hallucination:**
- Input: Tweet says "Tez been on time since he battled Surf" (casual reference)
- Output: "The reference to his battle against Tsu Surf..." (stated as fact)
- Reality: Chef Trez vs Tsu Surf battle NEVER HAPPENED

---

## Solution: Post-Generation Battle Verification

**New Flow:**
```
Research → Generate story → VERIFY OUTPUT battles → Reject if fabricated
```

---

## Step 1: Create Story Verifier (30 mins)

Create file: `src/lib/story-verifier.ts`

```typescript
/**
 * Story Verifier - Catches hallucinations in generated stories
 *
 * Specifically designed to catch battle claims that the LLM invented
 * during generation, even if they weren't in the input.
 */

import { verifyBattle, VerificationResult } from './fact-checker'

export interface StoryVerificationIssue {
  type: 'unverified_battle' | 'missing_citation' | 'fabricated_claim'
  claim: string
  severity: 'critical' | 'warning'
  explanation: string
  line_number?: number
}

export interface StoryVerificationResult {
  verified: boolean
  safe_to_publish: boolean
  issues: StoryVerificationIssue[]
  hallucination_detected: boolean
  confidence_score: number  // 0-1, how confident we are this is accurate
}

/**
 * Verify all battle claims in the generated story
 * This catches LLM hallucinations like "Chef Trez battled Tsu Surf"
 */
export async function verifyGeneratedStory(
  storyScript: string
): Promise<StoryVerificationResult> {

  console.log('[StoryVerifier] Checking generated story for hallucinations...')

  const issues: StoryVerificationIssue[] = []

  // ============================================
  // 1. EXTRACT ALL BATTLE CLAIMS
  // ============================================

  // Patterns that indicate a battle claim
  const battlePatterns = [
    // "X vs Y" or "X versus Y"
    /(\w+(?:\s+\w+)?)\s+(?:vs\.?|versus)\s+(\w+(?:\s+\w+)?)/gi,

    // "X battled Y"
    /(\w+(?:\s+\w+)?)\s+battled\s+(\w+(?:\s+\w+)?)/gi,

    // "his/her battle against Y"
    /(?:his|her|their)\s+battle\s+(?:against|with)\s+(\w+(?:\s+\w+)?)/gi,

    // "the X vs Y battle"
    /the\s+(\w+(?:\s+\w+)?)\s+vs\.?\s+(\w+(?:\s+\w+)?)\s+battle/gi,

    // "faced off against Y"
    /(\w+(?:\s+\w+)?)\s+faced\s+(?:off\s+)?against\s+(\w+(?:\s+\w+)?)/gi
  ]

  const battleClaims: Array<{
    battler1: string
    battler2: string
    fullMatch: string
    lineNumber: number
  }> = []

  // Split into lines for line number tracking
  const lines = storyScript.split('\n')

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]

    for (const pattern of battlePatterns) {
      const matches = Array.from(line.matchAll(pattern))

      for (const match of matches) {
        let battler1, battler2

        // Handle different capture group patterns
        if (match.length === 3) {
          // Standard "X vs Y" pattern
          battler1 = match[1]
          battler2 = match[2]
        } else if (match.length === 2) {
          // "his battle against Y" pattern - we can't verify without knowing X
          // Skip these for now (TODO: extract subject from context)
          continue
        }

        if (battler1 && battler2) {
          battleClaims.push({
            battler1: battler1.trim(),
            battler2: battler2.trim(),
            fullMatch: match[0],
            lineNumber: lineNum + 1
          })
        }
      }
    }
  }

  console.log(`[StoryVerifier] Found ${battleClaims.length} battle claims to verify`)

  // ============================================
  // 2. VERIFY EACH BATTLE CLAIM
  // ============================================

  let criticalIssues = 0

  for (const claim of battleClaims) {
    console.log(`[StoryVerifier] Verifying: ${claim.battler1} vs ${claim.battler2}`)

    try {
      // Use existing fact-checker to verify the battle
      const verification = await verifyBattle(claim.battler1, claim.battler2)

      if (!verification.safe_to_use) {
        // HALLUCINATION DETECTED
        const issue: StoryVerificationIssue = {
          type: 'unverified_battle',
          claim: `${claim.battler1} vs ${claim.battler2}`,
          severity: 'critical',
          explanation: `Battle claim in story but ${verification.verdict}: ${verification.evidence.length > 0 ? verification.evidence[0].snippet : 'No evidence found'}`,
          line_number: claim.lineNumber
        }

        issues.push(issue)
        criticalIssues++

        console.log(`  ✗ HALLUCINATION: "${claim.fullMatch}" (line ${claim.lineNumber})`)
        console.log(`    Verdict: ${verification.verdict}`)
        console.log(`    Confidence: ${(verification.confidence * 100).toFixed(0)}%`)
      } else {
        console.log(`  ✓ VERIFIED: ${claim.battler1} vs ${claim.battler2}`)
      }

    } catch (error) {
      console.error(`[StoryVerifier] Error verifying battle:`, error)

      // If verification fails, treat as warning (not critical)
      issues.push({
        type: 'unverified_battle',
        claim: `${claim.battler1} vs ${claim.battler2}`,
        severity: 'warning',
        explanation: `Could not verify battle claim (verification error)`,
        line_number: claim.lineNumber
      })
    }
  }

  // ============================================
  // 3. CALCULATE VERIFICATION SCORE
  // ============================================

  const totalClaims = battleClaims.length
  const verifiedClaims = totalClaims - criticalIssues

  const confidenceScore = totalClaims > 0
    ? verifiedClaims / totalClaims
    : 1.0  // No claims = no risk

  const verified = criticalIssues === 0
  const hallucination_detected = criticalIssues > 0

  // Safe to publish if:
  // - No critical issues, OR
  // - <10% of claims are unverified
  const safe_to_publish = verified || (confidenceScore >= 0.9)

  console.log(`\n[StoryVerifier] Verification Complete:`)
  console.log(`  Total battle claims: ${totalClaims}`)
  console.log(`  Verified: ${verifiedClaims}`)
  console.log(`  Critical issues: ${criticalIssues}`)
  console.log(`  Confidence: ${(confidenceScore * 100).toFixed(1)}%`)
  console.log(`  Safe to publish: ${safe_to_publish ? 'YES' : 'NO'}`)

  return {
    verified,
    safe_to_publish,
    issues,
    hallucination_detected,
    confidence_score: confidenceScore
  }
}

/**
 * Generate a human-readable verification report
 */
export function generateVerificationReport(result: StoryVerificationResult): string {
  let report = '=== STORY VERIFICATION REPORT ===\n\n'

  report += `Status: ${result.safe_to_publish ? '✓ APPROVED' : '✗ REJECTED'}\n`
  report += `Confidence: ${(result.confidence_score * 100).toFixed(1)}%\n`
  report += `Hallucinations Detected: ${result.hallucination_detected ? 'YES' : 'NO'}\n\n`

  if (result.issues.length > 0) {
    const critical = result.issues.filter(i => i.severity === 'critical')
    const warnings = result.issues.filter(i => i.severity === 'warning')

    if (critical.length > 0) {
      report += `🚨 CRITICAL ISSUES (${critical.length}):\n`
      critical.forEach(issue => {
        report += `  Line ${issue.line_number}: ${issue.claim}\n`
        report += `    ${issue.explanation}\n`
      })
      report += '\n'
    }

    if (warnings.length > 0) {
      report += `⚠️  WARNINGS (${warnings.length}):\n`
      warnings.forEach(issue => {
        report += `  Line ${issue.line_number}: ${issue.claim}\n`
        report += `    ${issue.explanation}\n`
      })
      report += '\n'
    }
  } else {
    report += '✓ No issues found. Story is fact-checked and ready.\n'
  }

  return report
}
```

---

## Step 2: Integrate into Story Pipeline (15 mins)

Edit file: `src/lib/story-pipeline.ts`

Find the `generateStory()` function (around line 461) and add verification AFTER generation:

```typescript
export async function generateStory(
  research: ResearchResult,
  config: StoryConfig = {}
): Promise<GeneratedStory> {
  // ... existing code ...

  console.log(`[Story] Generating ${style} story with Claude...`)

  // Call Claude API
  const story = await callClaudeAPI(prompt)

  // ============================================
  // NEW: POST-GENERATION VERIFICATION
  // ============================================
  console.log(`[Story] Verifying generated story for hallucinations...`)

  const { verifyGeneratedStory, generateVerificationReport } = await import('./story-verifier')
  const verification = await verifyGeneratedStory(story)

  console.log(generateVerificationReport(verification))

  // REJECT story if hallucinations detected
  if (!verification.safe_to_publish) {
    throw new Error(
      `Story generation FAILED verification (${verification.issues.length} issues). ` +
      `Hallucination detected: ${verification.hallucination_detected}. ` +
      `Confidence: ${(verification.confidence_score * 100).toFixed(1)}%. ` +
      `Issues: ${verification.issues.map(i => i.claim).join(', ')}`
    )
  }

  console.log(`✓ Story verified - safe to publish`)
  // ============================================

  // Parse the response
  const wordCount = story.split(/\s+/).length
  const estimatedDuration = Math.ceil(wordCount / 150 * 60)

  return {
    title: extractTitle(story, research.query) || `${research.query} - Full Story`,
    script: story,
    word_count: wordCount,
    estimated_duration_seconds: estimatedDuration,
    sources_cited: research.sources.map(s => s.url)
  }
}
```

---

## Step 3: Strengthen the Prompt (30 mins)

Edit file: `src/lib/story-pipeline.ts`

Find the `buildStoryPrompt()` function (around line 520) and add these critical constraints:

```typescript
async function buildStoryPrompt(
  research: ResearchResult,
  config: StoryConfig & { chapter_structure?: string[] }
): Promise<string> {

  // ... existing code for entity context, transcripts, etc. ...

  // ============================================
  // NEW: CRITICAL FACT-CHECKING CONSTRAINTS
  // ============================================

  const factCheckingRules = `
=== CRITICAL FACT-CHECKING RULES (READ CAREFULLY) ===

Your #1 priority is ACCURACY. Follow these rules EXACTLY:

RULE 1: BATTLE CLAIMS
❌ DO NOT state a battle happened unless you have:
   a) Video evidence (YouTube link with both names), OR
   b) Official announcement from league, OR
   c) Multiple independent confirmations

❌ DO NOT treat casual references as confirmations
   - "since he battled X" ← NOT confirmation (just a reference)
   - "after his battle with X" ← NOT confirmation (could be rumor)
   - Tweet mentions ← NOT confirmation (verify independently)

✓ DO ONLY include battles with explicit evidence:
   - Video title: "X vs Y - Full Battle"
   - YouTube video showing the battle
   - Official league announcement

RULE 2: QUOTE ATTRIBUTION
❌ DO NOT paraphrase or summarize quotes
✓ DO use exact quotes from sources
✓ DO cite who said it and where (video, tweet, etc.)

RULE 3: AFFILIATIONS & ROLES
❌ DO NOT infer affiliations from league names or associations
✓ DO ONLY use affiliations stated in the ENTITY GLOSSARY
✓ DO check the glossary before stating any affiliation

RULE 4: WHEN IN DOUBT, LEAVE IT OUT
If you cannot verify a fact from the sources, DO NOT include it.
A shorter, accurate story is better than a longer, fabricated one.

RULE 5: SOURCE EVERY CLAIM
For every factual claim you make, ask yourself:
"Which source confirms this? Can I point to it?"
If you can't answer, don't include the claim.

=== EXAMPLES ===

❌ BAD (Hallucination):
"The reference to his battle against Tsu Surf showed Chef Trez had arrived."
Problem: No video evidence of Chef Trez vs Tsu Surf battle

✓ GOOD (Verified):
"Multiple battle announcements featuring Chef Trez appeared, including
'CHEF TREZ vs LU CASTRO' and 'Devo The Kid vs Chef Trez.'"
Evidence: Video titles in research data confirm these battles

❌ BAD (Inference):
"As a URL battler, Chef Trez represented the league well."
Problem: No evidence Chef Trez is affiliated with URL

✓ GOOD (Factual):
"Chef Trez had multiple upcoming battles announced across different leagues."
Evidence: Video titles show battles at various leagues
`

  // ============================================
  // UPDATE FINAL PROMPT ASSEMBLY
  // ============================================

  // Load prompt with new constraints
  const { loadPrompt } = await import('./prompt-loader')
  const loaded = await loadPrompt({
    prompt_id: 'story_generation',
    variables: {
      // ... existing variables ...

      // NEW: Add fact-checking rules
      fact_checking_rules: factCheckingRules,

      // ... rest of variables ...
    },
  })

  return loaded.filled
}
```

Then update your prompt template to include the rules. If using database prompts, add:

```sql
-- Update the story_generation prompt
UPDATE prompts
SET prompt_template = prompt_template || E'\n\n{fact_checking_rules}'
WHERE prompt_id = 'story_generation';
```

Or if using file-based prompts, add `{fact_checking_rules}` to your template.

---

## Step 4: Lower Temperature (5 mins)

Edit file: `src/lib/story-pipeline.ts`

Find the `callClaudeAPI()` function (around line 703) and change temperature:

```typescript
async function callClaudeAPI(prompt: string): Promise<string> {
  // ... existing code ...

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.4,  // ← CHANGED from 0.7 to 0.4 (more factual, less creative)
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  // ... rest of code ...
}
```

Also update `callLocalLLM()` function (around line 752):

```typescript
async function callLocalLLM(prompt: string): Promise<string> {
  // ... existing code ...

  const response = await fetch(`${LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You are a professional scriptwriter. Write compelling, factual scripts.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,  // ← CHANGED from 0.7 to 0.4
      max_tokens: 4096
    })
  })

  // ... rest of code ...
}
```

---

## Step 5: Test It (10 mins)

Create test file: `test-story-verifier.ts`

```typescript
import { runStoryPipeline } from './src/lib/story-pipeline'

async function test() {
  console.log('=== TESTING HALLUCINATION PREVENTION ===\n')

  try {
    // This should PASS (Chef Trez had real battles)
    console.log('TEST 1: Real battles (should PASS)')
    const result1 = await runStoryPipeline({
      query: 'Chef Trez battles Lu Castro and Los Premee',
      topic_id: '864dbcf4-e1f7-4b1a-86ed-c18007439ad5',
      generate_audio: false
    })
    console.log('✓ Test 1 PASSED\n')

  } catch (error) {
    console.log('✗ Test 1 FAILED (unexpected)\n')
    console.error(error)
  }

  try {
    // This should FAIL (Chef Trez vs Tsu Surf never happened)
    console.log('TEST 2: Fake battle (should FAIL)')
    const result2 = await runStoryPipeline({
      query: 'Chef Trez battled Tsu Surf at Summer Madness',
      topic_id: '864dbcf4-e1f7-4b1a-86ed-c18007439ad5',
      generate_audio: false
    })
    console.log('✗ Test 2 FAILED (should have been rejected)\n')

  } catch (error: any) {
    if (error.message.includes('FAILED verification')) {
      console.log('✓ Test 2 PASSED (correctly rejected hallucination)\n')
    } else {
      console.log('✗ Test 2 FAILED (wrong error)\n')
      console.error(error)
    }
  }
}

test()
```

Run it:
```bash
npx tsx test-story-verifier.ts
```

---

## Expected Results

### Before (Current System)
```
Input: "Tez been on time since he battled Surf"
Output: "The reference to his battle against Tsu Surf..."
Result: ✗ HALLUCINATION (Chef Trez never battled Tsu Surf)
```

### After (With Verification)
```
Input: "Tez been on time since he battled Surf"
LLM generates: "The reference to his battle against Tsu Surf..."
Verifier extracts: "battle against Tsu Surf"
Verifier checks: Chef Trez vs Tsu Surf → unverified
Result: ✗ REJECTED - Story generation failed
Error: "Story FAILED verification - Hallucination detected: Chef Trez vs Tsu Surf"
```

---

## Next Steps (After This Works)

Once you've confirmed this catches hallucinations:

1. **Add retry logic** - Regenerate story with explicit "DO NOT include X vs Y" instruction
2. **Save verification logs** - Track which hallucinations are most common
3. **Implement structured outputs** - Force source attribution in JSON format
4. **Add Chain-of-Verification** - Make LLM verify its own claims
5. **Build approval workflow** - Human review for flagged stories

---

## Monitoring

Add to your pipeline result:

```typescript
export interface StoryPipelineResult {
  // ... existing fields ...

  // New verification fields
  verification?: {
    verified: boolean
    safe_to_publish: boolean
    confidence_score: number
    issues_found: number
    hallucinations_detected: boolean
  }
}
```

Then you can track:
- How many stories get rejected
- What types of hallucinations are most common
- Confidence scores over time

---

## Success Metrics

Track these in your logs:

- **Rejection Rate:** % of stories rejected for hallucinations
- **Battle Claim Accuracy:** % of battle claims that verify
- **False Positives:** Stories rejected that shouldn't have been
- **False Negatives:** Hallucinations that slipped through

Target after implementation:
- 90%+ battle claim accuracy
- <5% hallucination rate
- <10% rejection rate (most stories should be factual)

---

## Troubleshooting

### "Too many stories getting rejected"
- Check if verifyBattle() is too strict
- Lower the confidence threshold in fact-checker
- Add more sources to research phase

### "Hallucinations still slipping through"
- Check if battle patterns are comprehensive
- Add more regex patterns for battle claims
- Verify the web search is working

### "Stories are too short now"
- LLM is being too cautious
- Add more source material to research
- Adjust prompt to encourage verified claims

---

## Time Investment

- **Step 1:** 30 mins - Create verifier
- **Step 2:** 15 mins - Integrate into pipeline
- **Step 3:** 30 mins - Strengthen prompts
- **Step 4:** 5 mins - Lower temperature
- **Step 5:** 10 mins - Test

**Total:** ~90 minutes

**Expected reduction in hallucinations:** 50-70%

Then build out full system (structured outputs, CoVe, etc.) for 90%+ reduction.
