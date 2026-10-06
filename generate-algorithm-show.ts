/**
 * Generate Algorithm Institute Battle Rap News
 * Last 48 Hours Coverage
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { runResearchWorkflow } from './src/lib/research-workflow'
import { generateStory } from './src/lib/story-pipeline'
import { generateSpeech } from './src/lib/elevenlabs'
import * as fs from 'fs/promises'

const TOPIC_ID = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5' // Battle Rap topic
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9' // Battlerap Algorithm

async function main() {
  console.log('=== ALGORITHM INSTITUTE: Last 48 Hours in Battle Rap ===\n')

  // Run research workflow
  console.log('[1/4] Researching battle rap news from last 48 hours...')
  const research = await runResearchWorkflow({
    query: 'battle rap news last 48 hours',
    topic_id: TOPIC_ID,
    enable_youtube: true,
    enable_twitter: true,
    enable_interviews: true,
    enable_documents: false,
    youtube_search_options: {
      max_results: 15,
      hours_back: 48,
      use_free_api: true // Use youtubei.js (innertube)
    },
    twitter_search_options: {
      max_results: 50,
      hours_back: 48
    }
  })

  console.log('\n[RESEARCH RESULTS]')
  console.log(`✓ Found ${research.sources.length} YouTube videos`)
  console.log(`✓ Found ${research.twitter_data?.tweets?.length || 0} tweets`)
  console.log(`✓ Found ${research.interviews?.length || 0} interviews`)

  console.log('\n[YOUTUBE SOURCES]')
  research.sources.forEach((source, i) => {
    console.log(`  ${i + 1}. [${source.channel}] ${source.title}`)
    console.log(`     Transcript: ${source.transcript ? 'YES' : 'NO'}`)
  })

  console.log('\n[TWITTER ACCOUNTS SEEN]')
  const twitterAccounts = new Set<string>()
  if (research.twitter_data?.tweets) {
    research.twitter_data.tweets.forEach(tweet => {
      twitterAccounts.add(tweet.author)
    })
    Array.from(twitterAccounts).forEach(account => {
      console.log(`  @${account}`)
    })
  }

  // Generate story with Algorithm Institute style
  console.log('\n[2/4] Generating story in Algorithm Institute style...')
  const story = await generateStory(research, {
    style: 'documentary',
    tone: 'dramatic',
    length: 'long', // 2500 words, ~17 minutes
    host_name: 'Algorithm Institute of Battle Rap',
    topic_id: TOPIC_ID,
    channel_style_file: 'algorithm-institute-of-battle-rap'
  })

  console.log(`\n✓ Story generated: ${story.word_count} words`)
  console.log(`✓ Estimated duration: ${Math.ceil(story.estimated_duration_seconds / 60)} minutes`)

  // Save script
  console.log('\n[3/4] Saving script...')
  await fs.writeFile('algorithm-48hrs-script.txt', story.script)
  console.log('✓ Saved to: algorithm-48hrs-script.txt')

  // Generate audio with ElevenLabs v1
  console.log('\n[4/4] Generating audio with ElevenLabs v1...')
  const audioBuffer = await generateSpeech(story.script, {
    voice_id: VOICE_ID,
    model_id: 'eleven_monolingual_v1',
    voice_settings: {
      stability: 0.75,
      similarity_boost: 0.8,
      style: 0.15,
      use_speaker_boost: true
    }
  })

  await fs.writeFile('algorithm-48hrs-audio.mp3', Buffer.from(audioBuffer))
  console.log('✓ Saved to: algorithm-48hrs-audio.mp3')

  console.log('\n=== COMPLETE ===')
  console.log(`\n📊 Summary:`)
  console.log(`   YouTube Videos: ${research.sources.length}`)
  console.log(`   Tweets: ${research.twitter_data?.tweets?.length || 0}`)
  console.log(`   Word Count: ${story.word_count}`)
  console.log(`   Duration: ~${Math.ceil(story.estimated_duration_seconds / 60)} minutes`)
  console.log(`\n🎤 Audio Model: ElevenLabs English v1`)
  console.log(`📝 Script: algorithm-48hrs-script.txt`)
  console.log(`🎵 Audio: algorithm-48hrs-audio.mp3`)
}

main().catch(console.error)
