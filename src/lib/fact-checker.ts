/**
 * Fact Checker - Verifies claims before they go into stories
 *
 * Prevents hallucinations by checking:
 * - Battle existence (Did X vs Y actually happen?)
 * - Affiliations (Is X really in Y league?)
 * - Quotes/statements (Did someone actually say this?)
 */

import { searchWeb } from './web-search'

export interface Claim {
  type: 'battle' | 'affiliation' | 'quote' | 'event'
  statement: string
  entities: string[]
  confidence?: number
  sources?: string[]
}

export interface VerificationResult {
  claim: Claim
  verified: boolean
  confidence: number
  evidence: {
    source: string
    snippet: string
    url?: string
  }[]
  verdict: 'confirmed' | 'unverified' | 'contradicted' | 'no_evidence'
  safe_to_use: boolean
}

/**
 * Verify a battle claim (e.g., "Chef Trez battled Tsu Surf")
 */
export async function verifyBattle(
  battler1: string,
  battler2: string,
  context?: { league?: string; year?: string; event?: string }
): Promise<VerificationResult> {
  const claim: Claim = {
    type: 'battle',
    statement: `${battler1} vs ${battler2}${context?.league ? ` at ${context.league}` : ''}`,
    entities: [battler1, battler2]
  }

  console.log(`[FactCheck] Verifying battle: ${claim.statement}`)

  // Search for the battle
  const searchQuery = `"${battler1}" vs "${battler2}" battle rap${context?.league ? ` ${context.league}` : ''}${context?.year ? ` ${context.year}` : ''}`

  const searchResults = await searchWeb(searchQuery, {
    max_results: 5
  })

  const evidence = searchResults.map(r => ({
    source: r.title,
    snippet: r.content,
    url: r.url
  }))

  // Analyze evidence
  const snippetText = searchResults.map(r => r.content).join(' ').toLowerCase()
  const titleText = searchResults.map(r => r.title).join(' ').toLowerCase()
  const fullText = snippetText + ' ' + titleText

  // Look for confirmation signals - MUST include both battler names together
  const battler1Lower = battler1.toLowerCase()
  const battler2Lower = battler2.toLowerCase()

  // Check if both battlers appear together in the same result
  const hasBothBattlers = searchResults.some(r => {
    const text = (r.title + ' ' + r.content).toLowerCase()
    return text.includes(battler1Lower) && text.includes(battler2Lower)
  })

  // Check for explicit vs/versus formatting
  const confirmationSignals = [
    `${battler1Lower} vs ${battler2Lower}`,
    `${battler1Lower} versus ${battler2Lower}`,
    `${battler2Lower} vs ${battler1Lower}`,
    `${battler2Lower} versus ${battler1Lower}`
  ]

  const hasExplicitVS = confirmationSignals.some(signal => fullText.includes(signal))

  // Require both conditions for confirmation
  const hasConfirmation = hasBothBattlers && hasExplicitVS

  // Look for contradiction signals
  const contradictionSignals = [
    'never happened',
    'didn\'t battle',
    'hasn\'t faced',
    'no battle',
    'rumored',
    'cancelled',
    'postponed',
    'fake'
  ]

  const hasContradiction = contradictionSignals.some(signal => fullText.includes(signal))

  // Look for video evidence (YouTube URLs are strong signals)
  const hasVideoEvidence = searchResults.some(r =>
    r.url?.includes('youtube.com') || r.url?.includes('youtu.be')
  )

  // Determine verdict
  let verdict: VerificationResult['verdict']
  let confidence = 0
  let verified = false

  if (hasContradiction) {
    verdict = 'contradicted'
    confidence = 0.1
    verified = false
  } else if (hasConfirmation && hasVideoEvidence) {
    verdict = 'confirmed'
    confidence = 0.9
    verified = true
  } else if (hasConfirmation) {
    verdict = 'confirmed'
    confidence = 0.7
    verified = true
  } else if (evidence.length === 0) {
    verdict = 'no_evidence'
    confidence = 0.0
    verified = false
  } else {
    verdict = 'unverified'
    confidence = 0.3
    verified = false
  }

  return {
    claim,
    verified,
    confidence,
    evidence,
    verdict,
    safe_to_use: verified && confidence >= 0.7
  }
}

/**
 * Verify an affiliation claim (e.g., "X is signed to URL")
 */
export async function verifyAffiliation(
  person: string,
  organization: string,
  relationship: string = 'affiliated with'
): Promise<VerificationResult> {
  const claim: Claim = {
    type: 'affiliation',
    statement: `${person} ${relationship} ${organization}`,
    entities: [person, organization]
  }

  console.log(`[FactCheck] Verifying affiliation: ${claim.statement}`)

  const searchQuery = `"${person}" "${organization}" battle rap ${relationship}`

  const searchResults = await searchWeb(searchQuery, {
    max_results: 5
  })

  const evidence = searchResults.map(r => ({
    source: r.title,
    snippet: r.content,
    url: r.url
  }))

  const snippetText = searchResults.map(r => r.content).join(' ').toLowerCase()
  const fullText = snippetText + searchResults.map(r => r.title).join(' ').toLowerCase()

  const confirmationSignals = [
    `${person.toLowerCase()}`,
    organization.toLowerCase(),
    'signed',
    'roster',
    'affiliated',
    'part of',
    'represents'
  ]

  const hasConfirmation = confirmationSignals.filter(signal => fullText.includes(signal)).length >= 3

  const contradictionSignals = [
    'left',
    'departed',
    'no longer',
    'former',
    'never was',
    'not affiliated'
  ]

  const hasContradiction = contradictionSignals.some(signal => fullText.includes(signal))

  let verdict: VerificationResult['verdict']
  let confidence = 0
  let verified = false

  if (hasContradiction) {
    verdict = 'contradicted'
    confidence = 0.1
    verified = false
  } else if (hasConfirmation) {
    verdict = 'confirmed'
    confidence = 0.7
    verified = true
  } else if (evidence.length === 0) {
    verdict = 'no_evidence'
    confidence = 0.0
    verified = false
  } else {
    verdict = 'unverified'
    confidence = 0.3
    verified = false
  }

  return {
    claim,
    verified,
    confidence,
    evidence,
    verdict,
    safe_to_use: verified && confidence >= 0.6
  }
}

/**
 * Verify a quote claim (e.g., "X said Y")
 */
export async function verifyQuote(
  person: string,
  quote: string,
  context?: { platform?: string; date?: string }
): Promise<VerificationResult> {
  const claim: Claim = {
    type: 'quote',
    statement: `${person} said: "${quote.substring(0, 100)}..."`,
    entities: [person]
  }

  console.log(`[FactCheck] Verifying quote: ${claim.statement}`)

  // Search for the exact quote
  const searchQuery = `"${person}" "${quote.substring(0, 60)}"${context?.platform ? ` ${context.platform}` : ''}`

  const searchResults = await searchWeb(searchQuery, {
    max_results: 5
  })

  const evidence = searchResults.map(r => ({
    source: r.title,
    snippet: r.content,
    url: r.url
  }))

  const snippetText = searchResults.map(r => r.content).join(' ').toLowerCase()

  // Look for quote in results
  const quoteWords = quote.toLowerCase().split(' ').slice(0, 5)
  const hasQuoteMatch = quoteWords.every(word => snippetText.includes(word))

  let verdict: VerificationResult['verdict']
  let confidence = 0
  let verified = false

  if (hasQuoteMatch && evidence.length > 0) {
    verdict = 'confirmed'
    confidence = 0.8
    verified = true
  } else if (evidence.length === 0) {
    verdict = 'no_evidence'
    confidence = 0.0
    verified = false
  } else {
    verdict = 'unverified'
    confidence = 0.2
    verified = false
  }

  return {
    claim,
    verified,
    confidence,
    evidence,
    verdict,
    safe_to_use: verified && confidence >= 0.7
  }
}

/**
 * Batch verify multiple claims
 */
export async function verifyClaimsFromText(
  text: string,
  claimPatterns: {
    battles?: RegExp[]
    affiliations?: RegExp[]
    quotes?: RegExp[]
  } = {}
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = []

  // Default battle patterns
  const battlePatterns = claimPatterns.battles || [
    /(\w+(?:\s+\w+)?)\s+(?:vs|versus|battled)\s+(\w+(?:\s+\w+)?)/gi,
    /battle\s+(?:between|with)\s+(\w+(?:\s+\w+)?)\s+(?:and|&)\s+(\w+(?:\s+\w+)?)/gi
  ]

  // Extract and verify battles
  for (const pattern of battlePatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const [_, battler1, battler2] = match
      if (battler1 && battler2) {
        const result = await verifyBattle(battler1.trim(), battler2.trim())
        results.push(result)
      }
    }
  }

  return results
}

/**
 * Generate a fact-check report for a story
 */
export function generateFactCheckReport(results: VerificationResult[]): string {
  let report = '=== FACT CHECK REPORT ===\n\n'

  const confirmed = results.filter(r => r.verdict === 'confirmed')
  const unverified = results.filter(r => r.verdict === 'unverified')
  const contradicted = results.filter(r => r.verdict === 'contradicted')
  const noEvidence = results.filter(r => r.verdict === 'no_evidence')

  report += `Total Claims Checked: ${results.length}\n`
  report += `✓ Confirmed: ${confirmed.length}\n`
  report += `? Unverified: ${unverified.length}\n`
  report += `✗ Contradicted: ${contradicted.length}\n`
  report += `∅ No Evidence: ${noEvidence.length}\n\n`

  if (contradicted.length > 0) {
    report += '⚠️  CONTRADICTED CLAIMS (DO NOT USE):\n'
    contradicted.forEach(r => {
      report += `  - ${r.claim.statement}\n`
      if (r.evidence.length > 0) {
        report += `    Evidence: ${r.evidence[0].snippet.substring(0, 100)}...\n`
      }
    })
    report += '\n'
  }

  if (noEvidence.length > 0) {
    report += '⚠️  NO EVIDENCE FOUND (LIKELY FALSE):\n'
    noEvidence.forEach(r => {
      report += `  - ${r.claim.statement}\n`
    })
    report += '\n'
  }

  if (unverified.length > 0) {
    report += '⚠️  UNVERIFIED (USE WITH CAUTION):\n'
    unverified.forEach(r => {
      report += `  - ${r.claim.statement} (confidence: ${(r.confidence * 100).toFixed(0)}%)\n`
    })
    report += '\n'
  }

  if (confirmed.length > 0) {
    report += '✓ CONFIRMED (SAFE TO USE):\n'
    confirmed.forEach(r => {
      report += `  - ${r.claim.statement} (confidence: ${(r.confidence * 100).toFixed(0)}%)\n`
    })
  }

  return report
}
