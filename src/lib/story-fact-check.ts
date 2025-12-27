/**
 * Story Fact-Checking Integration
 *
 * Automatically verifies claims before they go into generated stories
 */

import { verifyBattle, verifyAffiliation, verifyQuote, generateFactCheckReport, type VerificationResult } from './fact-checker'

export interface StoryClaimExtraction {
  battles: Array<{ battler1: string; battler2: string; context?: string }>
  affiliations: Array<{ person: string; org: string; relationship: string }>
  quotes: Array<{ person: string; quote: string }>
}

/**
 * Extract potential claims from research data before story generation
 */
export function extractClaimsFromResearch(
  youtubeVideos: Array<{ title: string; channel: string }>,
  tweets: Array<{ text: string; author: string }>
): StoryClaimExtraction {
  const battles: StoryClaimExtraction['battles'] = []
  const affiliations: StoryClaimExtraction['affiliations'] = []
  const quotes: StoryClaimExtraction['quotes'] = []

  // Extract battles from video titles and tweets
  const battlePatterns = [
    /(\w+(?:\s+\w+)?)\s+vs\s+(\w+(?:\s+\w+)?)/gi,
    /(\w+(?:\s+\w+)?)\s+versus\s+(\w+(?:\s+\w+)?)/gi,
    /(\w+(?:\s+\w+)?)\s+battled\s+(\w+(?:\s+\w+)?)/gi
  ]

  const allText = [
    ...youtubeVideos.map(v => v.title),
    ...tweets.map(t => t.text)
  ]

  for (const text of allText) {
    for (const pattern of battlePatterns) {
      const matches = Array.from(text.matchAll(pattern))
      for (const match of matches) {
        const [_, battler1, battler2] = match
        if (battler1 && battler2) {
          battles.push({
            battler1: battler1.trim(),
            battler2: battler2.trim(),
            context: text
          })
        }
      }
    }
  }

  // Remove duplicates
  const uniqueBattles = battles.filter((b, i, arr) =>
    arr.findIndex(x =>
      (x.battler1 === b.battler1 && x.battler2 === b.battler2) ||
      (x.battler1 === b.battler2 && x.battler2 === b.battler1)
    ) === i
  )

  return {
    battles: uniqueBattles,
    affiliations,
    quotes
  }
}

/**
 * Verify all extracted claims
 */
export async function verifyStoryClaims(
  claims: StoryClaimExtraction
): Promise<{
  verifiedBattles: VerificationResult[]
  verifiedAffiliations: VerificationResult[]
  verifiedQuotes: VerificationResult[]
  report: string
}> {
  console.log(`[StoryFactCheck] Verifying ${claims.battles.length} battle claims...`)

  const verifiedBattles: VerificationResult[] = []

  // Verify battles
  for (const battle of claims.battles) {
    try {
      const result = await verifyBattle(battle.battler1, battle.battler2)
      verifiedBattles.push(result)

      if (!result.safe_to_use) {
        console.log(`  ⚠️  REJECTED: ${battle.battler1} vs ${battle.battler2} (${result.verdict})`)
      } else {
        console.log(`  ✓ VERIFIED: ${battle.battler1} vs ${battle.battler2}`)
      }
    } catch (error) {
      console.error(`  ✗ ERROR checking ${battle.battler1} vs ${battle.battler2}:`, error)
    }
  }

  // Verify affiliations
  const verifiedAffiliations: VerificationResult[] = []
  for (const aff of claims.affiliations) {
    try {
      const result = await verifyAffiliation(aff.person, aff.org, aff.relationship)
      verifiedAffiliations.push(result)
    } catch (error) {
      console.error(`  ✗ ERROR checking affiliation:`, error)
    }
  }

  // Verify quotes
  const verifiedQuotes: VerificationResult[] = []
  for (const quote of claims.quotes) {
    try {
      const result = await verifyQuote(quote.person, quote.quote)
      verifiedQuotes.push(result)
    } catch (error) {
      console.error(`  ✗ ERROR checking quote:`, error)
    }
  }

  const report = generateFactCheckReport([
    ...verifiedBattles,
    ...verifiedAffiliations,
    ...verifiedQuotes
  ])

  return {
    verifiedBattles,
    verifiedAffiliations,
    verifiedQuotes,
    report
  }
}

/**
 * Build safe context for story generation
 * Only includes verified claims
 */
export function buildVerifiedContext(
  verifiedBattles: VerificationResult[],
  youtubeVideos: Array<{ title: string; channel: string }>,
  tweets: Array<{ text: string; author: string }>
): string {
  let context = ''

  // Add verified battles
  const safeBattles = verifiedBattles.filter(b => b.safe_to_use)
  if (safeBattles.length > 0) {
    context += '=== VERIFIED BATTLES ===\n'
    safeBattles.forEach(b => {
      context += `✓ ${b.claim.statement} (confidence: ${(b.confidence * 100).toFixed(0)}%)\n`
      if (b.evidence[0]) {
        context += `  Source: ${b.evidence[0].source}\n`
      }
    })
    context += '\n'
  }

  // Add unverified claims with warning
  const unverifiedBattles = verifiedBattles.filter(b => !b.safe_to_use)
  if (unverifiedBattles.length > 0) {
    context += '=== UNVERIFIED CLAIMS (DO NOT INCLUDE) ===\n'
    unverifiedBattles.forEach(b => {
      context += `✗ ${b.claim.statement} - ${b.verdict}\n`
    })
    context += '\n'
  }

  // Add YouTube videos
  context += '=== YOUTUBE VIDEOS (FOCUS ON COMMENTS) ===\n'
  youtubeVideos.slice(0, 15).forEach(v => {
    context += `[${v.channel}] ${v.title}\n`
  })
  context += '\n'

  // Add tweets
  context += '=== TWITTER ACTIVITY ===\n'
  tweets.slice(0, 15).forEach(t => {
    context += `@${t.author}: ${t.text}\n`
  })

  return context
}

/**
 * Main workflow: Extract, verify, and build safe context
 */
export async function factCheckStoryResearch(
  youtubeVideos: Array<{ title: string; channel: string }>,
  tweets: Array<{ text: string; author: string }>
): Promise<{
  safeContext: string
  report: string
  rejectedClaims: string[]
}> {
  console.log('\n=== FACT-CHECKING RESEARCH DATA ===\n')

  // Extract claims
  const claims = extractClaimsFromResearch(youtubeVideos, tweets)
  console.log(`Found ${claims.battles.length} battle claims to verify\n`)

  // Verify claims
  const verification = await verifyStoryClaims(claims)

  // Build safe context
  const safeContext = buildVerifiedContext(
    verification.verifiedBattles,
    youtubeVideos,
    tweets
  )

  // Get rejected claims
  const rejectedClaims = verification.verifiedBattles
    .filter(b => !b.safe_to_use)
    .map(b => b.claim.statement)

  return {
    safeContext,
    report: verification.report,
    rejectedClaims
  }
}
