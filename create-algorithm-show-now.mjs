/**
 * Generate Algorithm Institute Show from Collected Research
 * Uses algorithm-content-report.json data
 */

import fs from 'fs/promises'
import fetch from 'node-fetch'

// Load research data
const report = JSON.parse(
  await fs.readFile('algorithm-content-report.json', 'utf-8')
)

console.log('=== ALGORITHM INSTITUTE: Generating Show ===\n')

// Build research context for story generation
const twitterContext = report.twitter_data.sample_tweets
  .map(t => `@${t.author}: ${t.text}`)
  .join('\n\n')

const youtubeContext = report.youtube_data.videos
  .map(v => `[${v.channel}] ${v.title}`)
  .join('\n')

// Top topics from Twitter
const topMentions = report.twitter_data.top_mentions
  .slice(0, 5)
  .map(([handle, count]) => `@${handle} (${count} mentions)`)
  .join(', ')

const topKeywords = report.twitter_data.top_keywords
  .slice(0, 5)
  .map(([keyword, count]) => `${keyword} (${count})`)
  .join(', ')

// Generate story using API
console.log('[1/2] Generating story with Algorithm Institute style...\n')

const storyRequest = {
  query: 'Battle rap news from last 48 hours',
  topic_id: '864dbcf4-e1f7-4b1a-86ed-c18007439ad5',
  host_name: 'Algorithm Institute of Battle Rap',
  style: 'documentary',
  tone: 'dramatic',
  length: 'long',
  channel_style_file: 'algorithm-institute-of-battle-rap',
  research_summary: `
TWITTER ACTIVITY (${report.twitter_data.tweets_analyzed} tweets analyzed):
Top Mentions: ${topMentions}
Top Keywords: ${topKeywords}

RECENT TWEETS:
${twitterContext}

YOUTUBE VIDEOS FOUND (${report.youtube_data.videos_found} videos):
${youtubeContext}

KEY STORYLINES:
1. GOAT Debates - T-Rex claiming he beat Mook and Lux
2. Arsonal Drama - Explosion after Jaz battle
3. Cassidy Return - "Anyone Can Get It" freestyle released
4. Chef Trez battles and new matchups
5. Missing battles causing community frustration
`
}

try {
  // Call story generation API
  const response = await fetch('http://localhost:3000/api/stories/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(storyRequest)
  })

  if (!response.ok) {
    console.error('API Error:', response.status, await response.text())
    process.exit(1)
  }

  const result = await response.json()

  console.log('✓ Story generated:', result.word_count, 'words')
  console.log('✓ Estimated duration:', Math.ceil(result.estimated_duration_seconds / 60), 'minutes\n')

  // Save script
  await fs.writeFile('algorithm-show-script.txt', result.script)
  console.log('✓ Script saved to: algorithm-show-script.txt\n')

  // Generate audio with ElevenLabs v1
  console.log('[2/2] Generating audio with ElevenLabs v1...\n')

  const audioResponse = await fetch('http://localhost:3000/api/audio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: result.script,
      voice_id: 'ZJ7BlVZrxZKBDMTIK5c9',
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.8,
        style: 0.15,
        use_speaker_boost: true
      }
    })
  })

  if (!audioResponse.ok) {
    console.error('Audio API Error:', audioResponse.status, await audioResponse.text())
    process.exit(1)
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
  await fs.writeFile('algorithm-show-audio.mp3', audioBuffer)

  console.log('✓ Audio saved to: algorithm-show-audio.mp3\n')

  console.log('=== COMPLETE ===')
  console.log('\n📊 Summary:')
  console.log(`   Twitter Accounts: ${report.twitter_data.tweets_analyzed} tweets`)
  console.log(`   YouTube Videos: ${report.youtube_data.videos_found}`)
  console.log(`   Word Count: ${result.word_count}`)
  console.log(`   Duration: ~${Math.ceil(result.estimated_duration_seconds / 60)} minutes`)
  console.log('\n🎤 Audio Model: ElevenLabs English v1')
  console.log('📝 Script: algorithm-show-script.txt')
  console.log('🎵 Audio: algorithm-show-audio.mp3')

} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
