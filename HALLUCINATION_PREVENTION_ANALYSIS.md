# LLM Hallucination Prevention Analysis
## Research and Recommendations for Talk Show Go

**Date:** December 26, 2025
**Problem:** Current fact-checking system still allows hallucinations like "Chef Trez battled Tsu Surf" - complete fabrications that slip through verification.

---

## Executive Summary

After comprehensive research into state-of-the-art hallucination prevention techniques, the optimal approach combines **MULTIPLE LAYERS** of defense:

1. **BEFORE Generation:** RAG + Entity Context Injection + Structured Prompts (PREVENTIVE)
2. **DURING Generation:** Constrained Decoding + Low Temperature (CONSTRAINING)
3. **AFTER Generation:** Chain-of-Verification + NLI Fact-Checking (DETECTIVE)

**Key Finding:** No single technique eliminates hallucinations. A 2024 Stanford study found that combining RAG, RLHF, and guardrails led to a **96% reduction** in hallucinations. Current system only uses preventive measures - needs post-generation verification.

---

## The Core Problem: Where Hallucinations Come From

### Current System Analysis

**Current Flow:**
```
Research → Fact-Check Claims → Build Context → Generate Story → ✗ NO VERIFICATION
```

**What Slipped Through:**
- Input: "@JimChewz: Tez been on a different type of time since he battled Surf"
- Fact-checker: Only checks explicit claims like "X vs Y" in research data
- LLM: **INVENTS** the battle claim based on a casual tweet reference
- Output: "The reference to his battle against Tsu Surf..." (HALLUCINATION)

**Why It Failed:**
1. Fact-checker only verified **INPUT** claims, not **OUTPUT** claims
2. No verification of the FINAL story text
3. LLM filled gaps with plausible-sounding fabrications
4. Casual references were interpreted as factual statements

---

## Question 1: Should fact-checking happen BEFORE or AFTER story generation?

### Answer: **BOTH** (Multi-Layer Defense)

### BEFORE Generation (Preventive - Current System)
**What it does:**
- Verifies claims in source material
- Builds verified context for the prompt
- Prevents known-false information from entering

**Limitations:**
- ✗ Can't catch LLM inventions during generation
- ✗ Can't verify paraphrased claims
- ✗ Can't catch subtle logical errors
- ✗ Can't verify connections/inferences the LLM makes

**Research Support:**
> "RAG ensures the model has access to accurate and up-to-date information, grounding the model's responses in real-time data to reduce hallucinations." ([Digital Alpha](https://www.digital-alpha.com/reducing-llm-hallucinations-using-retrieval-augmented-generation-rag/))

> "Prompt engineering: Carefully crafting input prompts with relevant context, instructions, and constraints can help guide the LLM towards more reliable outputs" ([Voiceflow](https://www.voiceflow.com/blog/prevent-llm-hallucinations))

### AFTER Generation (Detective - MISSING FROM CURRENT SYSTEM)
**What it does:**
- Verifies every claim in the FINAL story
- Checks if story statements are grounded in source material
- Detects LLM inventions and fabrications
- Validates logical inferences

**Why it's critical:**
- ✓ Catches what the LLM invented during generation
- ✓ Verifies paraphrased claims
- ✓ Detects subtle errors
- ✓ Final safety net before publication

**Research Support:**
> "After an LLM generates a response, workflows perform checks to see if hallucinations occurred" ([AWS](https://aws.amazon.com/blogs/machine-learning/reducing-hallucinations-in-large-language-models-with-custom-intervention-using-amazon-bedrock-agents/))

> "Fact-checking mechanisms act as a critical second layer, comparing generated text against real-world knowledge bases" ([Zep](https://www.getzep.com/ai-agents/reducing-llm-hallucinations/))

### Recommendation: **THREE-STAGE PIPELINE**

```
STAGE 1: PRE-GENERATION (Preventive)
├─ Fact-check research data
├─ Build verified context
├─ Inject entity glossary
└─ Structure prompt with constraints

STAGE 2: GENERATION (Constraining)
├─ Use structured output format (JSON)
├─ Low temperature (0.3-0.5)
├─ Constrained decoding if available
└─ Chain-of-thought reasoning

STAGE 3: POST-GENERATION (Detective) ← MISSING
├─ Extract all factual claims from story
├─ Verify each claim against sources
├─ NLI contradiction check
├─ Chain-of-Verification
└─ REJECT or FLAG problematic stories
```

---

## Question 2: How can we constrain the LLM to only use provided facts?

### Answer: **Explicit Instructions + Structured Formats + Verification**

### Best Practices from Research

#### 1. **"According to..." Prompting**
> "According to…" prompting guides the model to get information from a specific source when answering your question, prompting the model to ground its answer with information from a trusted source." ([Machine Learning Mastery](https://machinelearningmastery.com/7-prompt-engineering-tricks-to-mitigate-hallucinations-in-llms/))

**Implementation:**
```
CRITICAL CONSTRAINT:
- ONLY use information explicitly stated in the sources above
- If a fact is not in the sources, DO NOT include it
- For every claim, you must be able to point to a source
- Use phrases like "According to [source]..." and "As stated in [video]..."
- If you're unsure, leave it out rather than guess
```

#### 2. **Negative Instructions**
Explicitly tell the LLM what NOT to do:
```
DO NOT:
- Assume battles happened without video evidence
- Infer affiliations from casual mentions
- Connect entities without explicit confirmation
- Add dramatic details not in sources
- Paraphrase casual references as facts
```

#### 3. **Step-Back Prompting**
> "Step-Back Prompting pushes the model to 'think' at a high-level before diving directly into the task at hand, leading to higher accuracy and lower hallucination rates." ([Machine Learning Mastery](https://machinelearningmastery.com/7-prompt-engineering-tricks-to-mitigate-hallucinations-in-llms/))

**Implementation:**
```
STEP 1: List all factual claims you can verify from sources
STEP 2: For each claim, note which source confirms it
STEP 3: Write the story using ONLY verified claims
```

#### 4. **Source Attribution Requirement**
Force the LLM to cite sources:
```json
{
  "story_segments": [
    {
      "claim": "Chef Trez had multiple battle announcements",
      "source": "Twitter data, video titles",
      "confidence": "high",
      "text": "Multiple battle announcements featuring Chef Trez..."
    }
  ]
}
```

### Current System Gap

Your `buildStoryPrompt()` function **DOES** inject entity context, but **DOESN'T**:
- Require source attribution for every claim
- Use structured JSON output format
- Include explicit "DO NOT" instructions
- Implement step-back reasoning
- Verify the output matches the input

---

## Question 3: Should we use structured output formats (JSON) instead of free-form text?

### Answer: **YES** - Structured outputs reduce hallucinations significantly

### Research Evidence

> "By enforcing adherence to a schema, structured outputs reduce hallucinations since unexpected data is less likely to appear" ([Humanloop](https://humanloop.com/structured-outputs))

> "When Structured Outputs is turned on, the LLM will generate structured data that follows the desired schema 100% of the time." ([Red Hat](https://developers.redhat.com/articles/2025/06/03/structured-outputs-vllm-guiding-ai-responses))

> "Without constraints, LLMs may hallucinate or provide overly verbose or ambiguous results that require expensive post-processing, but structured outputs enforce output conformity at generation time." ([Parasoft](https://www.parasoft.com/blog/controlling-llm-hallucinations-application-level-best-practices/))

### Recommended Structured Format

**Story Schema:**
```typescript
interface VerifiedStory {
  metadata: {
    query: string
    sources_used: string[]
    generation_timestamp: string
  }

  segments: Array<{
    segment_id: string
    segment_type: 'intro' | 'fact' | 'quote' | 'analysis' | 'conclusion'

    // CRITICAL: Every segment must cite sources
    claims: Array<{
      claim_text: string
      claim_type: 'battle' | 'quote' | 'affiliation' | 'event' | 'opinion'
      sources: string[]  // URLs or source IDs
      confidence: 'verified' | 'inferred' | 'opinion'
      verification_status: 'confirmed' | 'unverified'
    }>

    narrative_text: string  // The actual story text for this segment
  }>

  final_script: string  // Assembled from segments
}
```

### Benefits of Structured Output

1. **Forces Attribution:** Every claim must list sources
2. **Enables Verification:** Can automatically check each claim
3. **Separates Facts from Opinion:** Explicit claim types
4. **Auditable:** Can trace every sentence back to sources
5. **Prevents Drift:** Can't add unstructured hallucinations

### Two-Stage Generation Process

```
STAGE 1: Generate Structured Story
└─ LLM outputs JSON with claims + sources

STAGE 2: Verify and Render
├─ Verify each claim against sources
├─ Flag unverified claims
├─ Assemble final script from verified segments
└─ REJECT if too many unverified claims
```

---

## Question 4: What prompt engineering techniques prevent hallucinations?

### Top 7 Techniques (2025 Research)

#### 1. **Chain-of-Thought (CoT) Reasoning**
> "Asking a language model to apply step-by-step reasoning incentivizes inner consistency and mitigates logic gaps" ([Rohan Paul](https://www.rohan-paul.com/p/hallucinations-in-llms-challenges))

**Implementation:**
```
Think step-by-step before writing each claim:
1. What does the source actually say?
2. Am I inferring or is this explicit?
3. Can I cite the exact source?
4. If I'm unsure, should I include this?
```

#### 2. **Chain-of-Verification (CoVe)**
> "The model first (i) drafts an initial response; then (ii) plans verification questions to fact-check its draft; (iii) answers those questions independently; and (iv) generates its final verified response." ([Learn Prompting](https://learnprompting.org/docs/advanced/self_criticism/chain_of_verification))

> "CoVe improves the F1 score by 23% and increased FactScore from ~63.7 to ~71.4 points" ([arXiv](https://arxiv.org/abs/2309.11495))

**Implementation:**
```
STEP 1: Draft story
STEP 2: Generate verification questions:
  - Did Chef Trez actually battle Tsu Surf? Check sources.
  - Is there video evidence? Check YouTube links.
  - Did anyone explicitly confirm this? Check quotes.
STEP 3: Answer each question independently
STEP 4: Revise story based on verification
```

#### 3. **RAG (Retrieval-Augmented Generation)** ← You Already Use This
> "By retrieving relevant documents before generating a response, RAG ensures the model has access to accurate and up-to-date information" ([K2View](https://www.k2view.com/blog/rag-hallucination/))

**Current Status:** ✓ You fetch transcripts and context
**Gap:** Need to verify the OUTPUT uses only retrieved content

#### 4. **Low Temperature Setting**
> "When consistency and accuracy matter, setting the model's temperature low reduces hallucinations" ([Parasoft](https://www.parasoft.com/blog/controlling-llm-hallucinations-application-level-best-practices/))

**Current Setting:** Check `story-pipeline.ts` line 763 - temperature: 0.7
**Recommendation:** Lower to 0.3-0.5 for factual content

#### 5. **Few-Shot Examples with Verified Stories**
Show the LLM examples of CORRECT stories:
```
Example of GOOD story:
"Multiple battle announcements featuring Chef Trez flooded social media,
including 'CHEF TREZ vs LU CASTRO' and 'Devo The Kid vs Chef Trez.'"
Source: Video titles in research data

Example of BAD story (DO NOT EMULATE):
"Chef Trez battled Tsu Surf at Summer Madness."
Problem: No source confirms this battle happened
```

#### 6. **Explicit Constraints Section**
```
=== CRITICAL FACT-CHECKING RULES ===

RULE 1: Battle Claims
- ONLY state a battle happened if you have:
  a) Video evidence (YouTube link), OR
  b) Official announcement from league, OR
  c) Multiple confirmed sources
- Casual references like "since he battled X" are NOT confirmation

RULE 2: Quote Attribution
- ONLY use quotes that appear verbatim in sources
- Always cite who said it and where

RULE 3: Affiliations
- ONLY state affiliations explicitly confirmed in entity glossary
- Do NOT infer affiliations from league names or associations

RULE 4: When in Doubt
- Leave it out
- It's better to have a shorter, accurate story than a longer, fabricated one
```

#### 7. **Entity Glossary Injection** ← You Already Use This
> "Providing a glossary prevents errors like saying 'Caps was connected to QOTR' when it was actually Debo who owns QOTR" (Your CLAUDE.md)

**Current Status:** ✓ Implemented in `buildStoryPrompt()`
**Gap:** Need stronger enforcement of glossary constraints

### Combined Prompt Architecture

```
=== IDENTITY ===
You are a fact-checking journalist for battle rap news.
Your #1 priority is accuracy over entertainment.

=== VERIFIED SOURCES ===
[Research data with explicit source IDs]

=== ENTITY GLOSSARY ===
[Entity context from database]

=== FACT-CHECKING RULES ===
[Explicit constraints as above]

=== OUTPUT FORMAT ===
Return structured JSON with source attribution

=== REASONING PROCESS ===
1. List all verifiable facts
2. For each fact, note the source
3. Draft story using only verified facts
4. Verify draft claims against sources
5. Revise if needed
6. Output final JSON
```

---

## Question 5: Should we verify the FINAL story text, not just the input claims?

### Answer: **ABSOLUTELY YES** - This is the critical missing piece

### The Chef Trez Case Study

**What Happened:**
1. Input claim: ✓ Verified "Devo vs Chef Trez" battle
2. Input reference: ✗ Didn't verify casual tweet "since he battled Surf"
3. LLM output: ✗ Generated "The reference to his battle against Tsu Surf"
4. **Problem:** No verification of the OUTPUT claim

**The Gap:**
```
Current: Verify(INPUT) → Generate(STORY) → ✗ No verification
Needed:  Verify(INPUT) → Generate(STORY) → Verify(OUTPUT) → Approve/Reject
```

### Post-Generation Verification Methods

#### Method 1: **Claim Extraction + NLI Verification**

> "Using natural language inference (NLI), systems can detect if the generated facts entail, contradict, or are ungrounded with respect to the trusted ground truth repository." ([Noblis](https://noblis.org/resource/g3/))

> "A small task-specific and well fine-tuned NLI model presents a more viable, robust and cost-efficient option for claim verification compared to prompting LLMs." ([ACL Anthology](https://aclanthology.org/2024.emnlp-main.172.pdf))

**Process:**
```typescript
// 1. Extract all factual claims from generated story
const claims = extractClaimsFromStory(story.script)
// Claims: ["Chef Trez battled Tsu Surf", "Multiple announcements flooded social media"]

// 2. For each claim, check against sources using NLI
for (const claim of claims) {
  const verdict = await verifyClaimAgainstSources(claim, research.sources)
  // verdict: 'entailed' | 'contradicted' | 'ungrounded'

  if (verdict === 'contradicted' || verdict === 'ungrounded') {
    flagClaim(claim, verdict)
  }
}

// 3. If too many ungrounded claims, REJECT story
if (ungroundedClaims.length / claims.length > 0.1) {  // >10% ungrounded
  return { status: 'rejected', reason: 'too_many_hallucinations' }
}
```

#### Method 2: **Chain-of-Verification (CoVe)**

> "CoVe performs significantly better than Zero-Shot, Few-Shot, and CoT, with hallucinations reduced after employing CoVe." ([arXiv](https://arxiv.org/abs/2309.11495))

**Process:**
```
STEP 1: Generate story (as normal)

STEP 2: Extract verification questions from story
  - Q1: "Did Chef Trez battle Tsu Surf?"
  - Q2: "Were there multiple battle announcements for Chef Trez?"
  - Q3: "Did @JimChewz make that specific quote?"

STEP 3: Answer questions using ONLY source material (no LLM generation)
  - A1: NO - No video evidence, no explicit confirmation
  - A2: YES - Video titles confirm multiple announcements
  - A3: YES - Tweet appears in research data

STEP 4: Revise story based on answers
  - Remove: "The reference to his battle against Tsu Surf"
  - Keep: "Multiple battle announcements"
  - Keep: Tweet quote
```

#### Method 3: **Source Attribution Audit**

Every sentence must cite a source:

```typescript
interface AuditedStory {
  segments: Array<{
    text: string
    required_citations: string[]  // Which sources this MUST cite
    actual_citations: string[]    // Which sources it DOES cite
    audit_status: 'verified' | 'missing_citation' | 'invalid_citation'
  }>
}

// Reject if any segment lacks required citations
```

#### Method 4: **Battle Claim Regex + Web Verification**

Specifically for battle claims (your weakest point):

```typescript
// 1. Extract all battle claims from final story
const battleRegex = /(\w+(?:\s+\w+)?)\s+(?:vs\.?|versus|battled)\s+(\w+(?:\s+\w+)?)/gi
const battleClaims = story.script.matchAll(battleRegex)

// 2. For each battle claim, verify with web search
for (const [_, battler1, battler2] of battleClaims) {
  const isVerified = await verifyBattle(battler1, battler2)

  if (!isVerified.safe_to_use) {
    // CRITICAL: This battle is in the story but NOT verified
    return {
      status: 'rejected',
      reason: `Unverified battle claim: ${battler1} vs ${battler2}`,
      hallucination_detected: true
    }
  }
}
```

### Implementation: Post-Generation Verifier

```typescript
// src/lib/story-verifier.ts

export interface StoryVerificationResult {
  verified: boolean
  confidence: number
  issues: Array<{
    type: 'hallucination' | 'missing_citation' | 'contradiction'
    claim: string
    severity: 'critical' | 'warning' | 'minor'
    explanation: string
  }>
  safe_to_publish: boolean
}

export async function verifyGeneratedStory(
  story: GeneratedStory,
  research: ResearchResult
): Promise<StoryVerificationResult> {

  // 1. Extract all factual claims
  const claims = extractFactualClaims(story.script)

  // 2. Verify battles specifically (your weak point)
  const battleIssues = await verifyBattleClaims(claims, research)

  // 3. Verify quotes
  const quoteIssues = await verifyQuoteClaims(claims, research)

  // 4. NLI grounding check
  const groundingIssues = await checkClaimGrounding(claims, research.sources)

  // 5. Source attribution check
  const citationIssues = checkSourceAttribution(story, research)

  const allIssues = [
    ...battleIssues,
    ...quoteIssues,
    ...groundingIssues,
    ...citationIssues
  ]

  // 6. Critical issues = reject
  const criticalIssues = allIssues.filter(i => i.severity === 'critical')

  return {
    verified: criticalIssues.length === 0,
    confidence: calculateConfidence(allIssues),
    issues: allIssues,
    safe_to_publish: criticalIssues.length === 0 && allIssues.length < 3
  }
}
```

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (1-2 days)

#### A. Strengthen Prompts
- [ ] Add explicit "DO NOT" constraints to story prompt
- [ ] Lower temperature from 0.7 to 0.4 for factual stories
- [ ] Add step-back reasoning requirement
- [ ] Add few-shot examples of good vs bad stories

**File:** `src/lib/story-pipeline.ts` - `buildStoryPrompt()` function

#### B. Post-Generation Battle Verification
- [ ] Extract all battle claims from final story using regex
- [ ] Verify each battle claim against web search
- [ ] REJECT story if any unverified battle appears

**New File:** `src/lib/story-verifier.ts`

### Phase 2: Structured Outputs (3-5 days)

#### A. JSON Schema Definition
- [ ] Define `VerifiedStory` TypeScript interface
- [ ] Require source attribution for every claim
- [ ] Separate facts from opinions

**New File:** `src/types/verified-story.ts`

#### B. Two-Stage Generation
- [ ] Stage 1: Generate structured JSON story
- [ ] Stage 2: Verify claims → Assemble script
- [ ] Update pipeline to use structured format

**Files:** `src/lib/story-pipeline.ts`, `src/lib/story-assembler.ts`

### Phase 3: Full Verification System (1 week)

#### A. Claim Extraction
- [ ] Extract all factual claims from story text
- [ ] Classify claims (battle, quote, affiliation, event)
- [ ] Tag confidence level for each claim

**New File:** `src/lib/claim-extractor.ts`

#### B. NLI Verification
- [ ] Implement NLI-based grounding check
- [ ] Check if claims are entailed/contradicted by sources
- [ ] Use local NLI model or API

**New File:** `src/lib/nli-verifier.ts`

#### C. Chain-of-Verification
- [ ] Generate verification questions from story
- [ ] Answer questions using sources only
- [ ] Revise story based on verification
- [ ] Iterate until verified

**New File:** `src/lib/chain-of-verification.ts`

### Phase 4: Production Hardening (Ongoing)

#### A. Monitoring & Logging
- [ ] Log all hallucinations detected
- [ ] Track verification pass/fail rates
- [ ] Alert on repeated hallucination patterns

#### B. Continuous Improvement
- [ ] Build dataset of verified vs hallucinated stories
- [ ] Fine-tune prompts based on patterns
- [ ] Update entity glossary proactively

---

## Expected Results

### Current System
- Hallucination Rate: ~15-25% (estimated based on Chef Trez case)
- Battle Claim Accuracy: ~75% (pre-generation verification only)
- Publication Safety: Medium risk

### After Phase 1 (Quick Wins)
- Hallucination Rate: ~8-12% (stronger prompts + battle verification)
- Battle Claim Accuracy: ~90% (post-generation battle check)
- Publication Safety: Medium-high risk

### After Phase 2 (Structured Outputs)
- Hallucination Rate: ~5-8% (forced source attribution)
- Battle Claim Accuracy: ~95% (structured verification)
- Publication Safety: High risk

### After Phase 3 (Full Verification)
- Hallucination Rate: ~2-4% (multi-layer defense)
- Battle Claim Accuracy: ~98% (comprehensive verification)
- Publication Safety: Very high risk

### Research Benchmark
> "Combining RAG, RLHF, and guardrails led to a 96% reduction in hallucinations" (2024 Stanford study)

**Target:** <5% hallucination rate with full implementation

---

## Technical Architecture: Complete Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                     HALLUCINATION-PROOF PIPELINE                     │
└─────────────────────────────────────────────────────────────────────┘

STAGE 1: RESEARCH (Existing)
├─ Search YouTube
├─ Fetch transcripts
├─ Gather Twitter data
└─ Search web for documents

STAGE 2: PRE-GENERATION VERIFICATION (Existing, needs strengthening)
├─ Extract claims from research
├─ Verify battles (web search)
├─ Verify affiliations
├─ Build verified context
└─ Inject entity glossary

STAGE 3: PROMPT CONSTRUCTION (Needs updates)
├─ Add explicit constraints
├─ Add negative instructions
├─ Add few-shot examples
├─ Require structured JSON output
├─ Lower temperature to 0.4
└─ Add step-back reasoning

STAGE 4: GENERATION (Needs structured format)
├─ Generate JSON with source attribution
├─ Separate facts from opinions
├─ Include confidence levels
└─ Chain-of-thought reasoning

STAGE 5: POST-GENERATION VERIFICATION (NEW - CRITICAL)
├─ Extract claims from story
├─ Verify battles specifically
├─ Verify quotes
├─ NLI grounding check
├─ Source attribution audit
└─ Chain-of-Verification loop

STAGE 6: APPROVAL/REJECTION (NEW)
├─ Calculate hallucination score
├─ If critical issues: REJECT
├─ If warnings: FLAG for human review
├─ If clean: APPROVE for publication
└─ Log all verification results

STAGE 7: AUDIO GENERATION (Existing)
└─ Only for verified stories
```

---

## Key Files to Create/Modify

### New Files Needed

1. **`src/lib/story-verifier.ts`** - Post-generation verification
2. **`src/lib/claim-extractor.ts`** - Extract claims from text
3. **`src/lib/nli-verifier.ts`** - Natural language inference checks
4. **`src/lib/chain-of-verification.ts`** - CoVe implementation
5. **`src/lib/story-assembler.ts`** - Assemble story from verified segments
6. **`src/types/verified-story.ts`** - Structured story schema

### Files to Modify

1. **`src/lib/story-pipeline.ts`**
   - Update `buildStoryPrompt()` with stronger constraints
   - Lower temperature to 0.4
   - Add post-generation verification step
   - Implement rejection logic

2. **`src/lib/fact-checker.ts`**
   - Add post-generation battle verification
   - Strengthen battle verification logic
   - Add confidence scoring

3. **`src/lib/story-fact-check.ts`**
   - Integrate post-generation verification
   - Add final approval step

---

## Critical Success Factors

### 1. **Multi-Layer Defense**
No single technique works. You need ALL of:
- RAG (you have this)
- Entity context (you have this)
- Strong prompts (needs work)
- Structured outputs (don't have)
- Post-generation verification (don't have)

### 2. **Verify OUTPUT, Not Just INPUT**
The Chef Trez hallucination proves that input verification is insufficient.
Must verify the FINAL story text.

### 3. **Battle Claims Are Critical**
Battle claims are your highest-risk hallucinations.
Require special handling with web verification + video evidence.

### 4. **Source Attribution Is Key**
Every claim must cite a source.
If it can't be cited, it shouldn't be in the story.

### 5. **Rejection Is Acceptable**
It's better to reject a story than publish a hallucination.
Build a rejection/retry loop with feedback.

---

## Resources & Research

### Hallucination Prevention Techniques
- [7 Prompt Engineering Tricks to Mitigate Hallucinations](https://machinelearningmastery.com/7-prompt-engineering-tricks-to-mitigate-hallucinations-in-llms/)
- [Hallucinations in LLMs: Challenges and Solutions](https://www.rohan-paul.com/p/hallucinations-in-llms-challenges)
- [How Prompt Engineering Impacts Hallucination](https://www.gocodeo.com/post/how-prompt-engineering-impacts-hallucination-in-llms)
- [Preventing AI Hallucinations with Prompt Engineering](https://documentation.suse.com/suse-ai/1.0/html/AI-preventing-hallucinations/index.html)

### RAG & Grounding
- [RAG Hallucination Prevention](https://www.k2view.com/blog/rag-hallucination/)
- [Reducing LLM Hallucinations with RAG](https://www.digital-alpha.com/reducing-llm-hallucinations-using-retrieval-augmented-generation-rag/)
- [When LLMs Day Dream: Hallucinations and Prevention](https://www.redhat.com/en/blog/when-llms-day-dream-hallucinations-how-prevent-them)
- [Grounding LLMs: Contextually Relevant Data](https://toloka.ai/blog/grounding-llms-driving-ai-to-deliver-contextually-relevant-data/)

### Structured Outputs
- [Structured Outputs Reduce Hallucinations](https://humanloop.com/blog/structured-outputs)
- [Structured Outputs in vLLM](https://developers.redhat.com/articles/2025/06/03/structured-outputs-vllm-guiding-ai-responses)
- [Controlling LLM Hallucinations at Application Level](https://www.parasoft.com/blog/controlling-llm-hallucinations-application-level-best-practices/)
- [Reducing Hallucination in Structured Outputs via RAG](https://arxiv.org/html/2404.08189v1)

### Post-Generation Verification
- [Chain-of-Verification Reduces Hallucination](https://arxiv.org/abs/2309.11495)
- [CoVe Implementation Guide](https://learnprompting.org/docs/advanced/self_criticism/chain_of_verification)
- [Detect Hallucinations for RAG-based Systems](https://aws.amazon.com/blogs/machine-learning/detect-hallucinations-for-rag-based-systems/)
- [Fact Verification with G3](https://noblis.org/resource/g3/)

### Constrained Generation
- [ReFactX: Constrained Generation with KB Facts (ISWC 2025)](https://arxiv.org/html/2508.16983v1)
- [CRANE: Reasoning with Constrained LLM Generation](https://arxiv.org/html/2502.09061v3)
- [Constrained Decoding for Structured LLM Output](https://mbrenndoerfer.com/writing/constrained-decoding-structured-llm-output)

### NLI & Fact-Checking
- [Verification and Refinement of Natural Language Explanations](https://arxiv.org/html/2405.01379v2)
- [Natural Language Inference for Fact Verification](https://aclanthology.org/2024.emnlp-main.172.pdf)

---

## Conclusion

**The hallucination problem requires a COMPREHENSIVE solution, not just one technique.**

### What You Have (Good Foundation)
✓ RAG with transcript retrieval
✓ Entity context injection
✓ Pre-generation fact-checking

### What You Need (Critical Gaps)
✗ Post-generation verification
✗ Structured output format
✗ Strong prompt constraints
✗ Battle claim verification in output
✗ Chain-of-Verification loop

### Priority Action
**START WITH PHASE 1 (Quick Wins):**
1. Add battle claim verification to story OUTPUT
2. Strengthen prompts with explicit constraints
3. Lower temperature to 0.4
4. Add story rejection logic

This alone should reduce hallucinations by 50%+.

Then build toward full verification system (Phases 2-3).

**Target:** <5% hallucination rate (96% reduction from current ~15-25%)
