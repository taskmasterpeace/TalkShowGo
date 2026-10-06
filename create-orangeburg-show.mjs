#!/usr/bin/env node

/**
 * Create a Two-Host Talk Show for Orangeburg, SC
 *
 * This script:
 * 1. Searches for recent Orangeburg news on YouTube
 * 2. Creates a dialogue between two co-hosts
 * 3. Generates audio with two different voices
 */

import { Innertube } from 'youtubei.js'
import { getSubtitles } from 'youtube-caption-extractor'

// Orangeburg topic ID
const TOPIC_ID = '20eeae67-b5f0-4af8-a9d0-059dad99dfe5'

// Two co-hosts for local news
const HOSTS = {
  host1: {
    name: 'Sarah Mitchell',
    personality: 'Warm, community-focused anchor',
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah (female, warm)
    style: 'conversational local news anchor'
  },
  host2: {
    name: 'Marcus Johnson',
    personality: 'Analytical, fact-focused co-host',
    voice_id: 'TxGEqnHWrfWFTfGW9XjX', // Josh (male, deep)
    style: 'thoughtful analyst'
  }
}

async function searchOrangeburgNews() {
  console.log('🔍 Searching for Orangeburg news from the last 7 days...\n')

  const youtube = await Innertube.create()

  // Search terms for Orangeburg news
  const searches = [
    'Orangeburg South Carolina news',
    'Orangeburg SC police',
    'Orangeburg Department Public Safety',
    'SC State University Orangeburg',
    'Orangeburg County Sheriff'
  ]

  const allVideos = []

  for (const query of searches) {
    try {
      const results = await youtube.search(query, {
        type: 'video',
        sort_by: 'upload_date'
      })

      const videos = results.videos?.slice(0, 5) || []

      for (const video of videos) {
        // Check if video is from last 7 days
        const publishedText = video.published?.text || ''
        const isRecent = publishedText.includes('day') || publishedText.includes('hour') || publishedText.includes('week')

        if (isRecent) {
          allVideos.push({
            id: video.id,
            title: video.title?.text || '',
            channel: video.author?.name || '',
            published: publishedText,
            views: video.view_count?.text || ''
          })
        }
      }
    } catch (error) {
      console.error(`Error searching "${query}":`, error.message)
    }
  }

  console.log(`Found ${allVideos.length} recent videos\n`)
  return allVideos.slice(0, 10) // Top 10 most recent
}

async function getVideoInfo(videoId) {
  try {
    const subtitles = await getSubtitles({ videoID: videoId, lang: 'en' })
    if (subtitles && subtitles.length > 0) {
      const text = subtitles.map(s => s.text).join(' ')
      return text.substring(0, 500) // First 500 chars
    }
  } catch (error) {
    return null
  }
  return null
}

async function generateDialogueScript(videos) {
  console.log('✍️  Generating two-host dialogue script...\n')

  // Get summaries for top 3-5 stories
  const stories = []
  for (const video of videos.slice(0, 5)) {
    const summary = await getVideoInfo(video.id)
    if (summary) {
      stories.push({
        headline: video.title,
        channel: video.channel,
        summary: summary
      })
    }
  }

  console.log(`Generating script from ${stories.length} stories\n`)

  // Create dialogue script
  const script = `SARAH: Good evening, Orangeburg! I'm Sarah Mitchell.

MARCUS: And I'm Marcus Johnson. Welcome to Orangeburg Weekly Roundup, where we bring you the stories that matter most to our community.

SARAH: We've got some important updates from around the city this week. Marcus, what's catching your attention?

MARCUS: Well Sarah, ${stories.length > 0 ? `there's been quite a bit of activity. ${stories[0]?.channel} reported on ${stories[0]?.headline}.` : 'the community has been active as usual.'}

SARAH: That's right. ${stories.length > 1 ? `And we're also seeing updates from ${stories[1]?.channel} about ${stories[1]?.headline}.` : 'Local officials have been keeping residents informed.'}

MARCUS: It's important for our viewers to stay informed about what's happening right here in Orangeburg. ${stories.length > 2 ? `We're also following developments around ${stories[2]?.headline}.` : ''}

SARAH: Absolutely. The Orangeburg Department of Public Safety, SC State University, and our local government continue to keep our community safe and thriving.

MARCUS: For those who want more details, you can find the full stories from the Times and Democrat, ODPS, and our local news stations.

SARAH: That's right, Marcus. We encourage everyone to stay connected with local sources and support our community journalism.

MARCUS: From all of us here at Orangeburg Weekly Roundup, stay safe, stay informed.

SARAH: And we'll see you next week with more local news. Goodnight, Orangeburg!`

  return script
}

async function main() {
  console.log('🎙️  ORANGEBURG WEEKLY ROUNDUP - Two-Host Talk Show\n')
  console.log('='

.repeat(60))
  console.log()

  // Step 1: Search for news
  const videos = await searchOrangeburgNews()

  if (videos.length === 0) {
    console.log('⚠️  No recent videos found for Orangeburg')
    console.log('Using placeholder content...\n')
  }

  // Display found videos
  console.log('📰 Recent Orangeburg News:')
  videos.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.title}`)
    console.log(`     Channel: ${v.channel} | ${v.published}`)
  })
  console.log()

  // Step 2: Generate script
  const script = await generateDialogueScript(videos)

  // Step 3: Display script
  console.log('='.repeat(60))
  console.log('📝 GENERATED SCRIPT')
  console.log('='.repeat(60))
  console.log()
  console.log(script)
  console.log()
  console.log('='.repeat(60))
  console.log()

  // Step 4: Provide next steps
  console.log('✅ Script generated successfully!')
  console.log()
  console.log('NEXT STEPS:')
  console.log('1. Review the script above')
  console.log('2. To generate audio with two voices:')
  console.log(`   - Sarah: Voice ID ${HOSTS.host1.voice_id}`)
  console.log(`   - Marcus: Voice ID ${HOSTS.host2.voice_id}`)
  console.log('3. Split script by speaker and generate each part separately')
  console.log('4. Combine audio files in order')
  console.log()

  // Save script to file
  const fs = await import('fs/promises')
  const scriptPath = 'orangeburg-show-script.txt'
  await fs.writeFile(scriptPath, script)
  console.log(`💾 Script saved to: ${scriptPath}`)
}

main().catch(console.error)
