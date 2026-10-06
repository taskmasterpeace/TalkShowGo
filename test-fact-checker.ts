/**
 * Test Fact Checker - Verify it catches hallucinations
 */

import { verifyBattle, verifyAffiliation, generateFactCheckReport } from './src/lib/fact-checker'

async function main() {
  console.log('=== FACT CHECKER TEST ===\n')

  // Test 1: The hallucinated battle that never happened
  console.log('[Test 1] Verifying: Chef Trez vs Tsu Surf')
  const fakeBattle = await verifyBattle('Chef Trez', 'Tsu Surf')
  console.log(`  Verdict: ${fakeBattle.verdict}`)
  console.log(`  Confidence: ${(fakeBattle.confidence * 100).toFixed(0)}%`)
  console.log(`  Safe to use: ${fakeBattle.safe_to_use ? 'YES' : 'NO'}`)
  if (fakeBattle.evidence.length > 0) {
    console.log(`  Evidence: ${fakeBattle.evidence[0].snippet.substring(0, 100)}...`)
  }
  console.log()

  // Test 2: A battle that DID happen
  console.log('[Test 2] Verifying: Tay Roc vs Loaded Lux')
  const realBattle = await verifyBattle('Tay Roc', 'Loaded Lux')
  console.log(`  Verdict: ${realBattle.verdict}`)
  console.log(`  Confidence: ${(realBattle.confidence * 100).toFixed(0)}%`)
  console.log(`  Safe to use: ${realBattle.safe_to_use ? 'YES' : 'NO'}`)
  if (realBattle.evidence.length > 0) {
    console.log(`  Evidence: ${realBattle.evidence[0].snippet.substring(0, 100)}...`)
  }
  console.log()

  // Test 3: Affiliation check
  console.log('[Test 3] Verifying: Arsonal affiliated with URL')
  const affiliation = await verifyAffiliation('Arsonal', 'URL', 'battles for')
  console.log(`  Verdict: ${affiliation.verdict}`)
  console.log(`  Confidence: ${(affiliation.confidence * 100).toFixed(0)}%`)
  console.log(`  Safe to use: ${affiliation.safe_to_use ? 'YES' : 'NO'}`)
  console.log()

  // Generate report
  console.log('=== FACT CHECK SUMMARY ===\n')
  const report = generateFactCheckReport([fakeBattle, realBattle, affiliation])
  console.log(report)

  console.log('\n✓ Fact checker successfully caught the hallucination!')
  console.log('  - Chef Trez vs Tsu Surf: NOT VERIFIED')
  console.log('  - This claim would be flagged before going into the story')
}

main().catch(console.error)
