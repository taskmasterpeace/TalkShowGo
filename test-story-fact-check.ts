/**
 * Test Story Fact-Checking with Algorithm Institute Data
 * Shows how hallucinations would be caught before story generation
 */

import * as fs from 'fs/promises'
import { factCheckStoryResearch } from './src/lib/story-fact-check'

async function main() {
  console.log('=== ALGORITHM INSTITUTE FACT-CHECK TEST ===\n')

  // Load research data
  const report = JSON.parse(await fs.readFile('algorithm-content-report.json', 'utf-8'))

  // Prepare data
  const youtubeVideos = report.youtube_data.videos.map((v: any) => ({
    title: v.title,
    channel: v.channel
  }))

  const tweets = report.twitter_data.sample_tweets.map((t: any) => ({
    text: t.text,
    author: t.author
  }))

  console.log(`Research Data:`)
  console.log(`  - ${youtubeVideos.length} YouTube videos`)
  console.log(`  - ${tweets.length} tweets\n`)

  // Run fact-checking
  const result = await factCheckStoryResearch(youtubeVideos, tweets)

  // Show results
  console.log('\n=== FACT-CHECK RESULTS ===\n')
  console.log(result.report)

  if (result.rejectedClaims.length > 0) {
    console.log('\n🚨 REJECTED CLAIMS (Would not appear in story):')
    result.rejectedClaims.forEach(claim => {
      console.log(`  ✗ ${claim}`)
    })
  }

  // Save safe context
  await fs.writeFile('algorithm-verified-context.txt', result.safeContext)
  console.log('\n✓ Safe context saved to: algorithm-verified-context.txt')
  console.log('  This context is fact-checked and ready for story generation')

  // Show what would be different
  console.log('\n=== HOW THIS PREVENTS HALLUCINATIONS ===')
  console.log('Before: Story generator could make up "Chef Trez battled Tsu Surf"')
  console.log('After: Fact-checker verifies claims and marks unverified ones')
  console.log('Result: Only verified battles appear in the final story')
}

main().catch(console.error)
