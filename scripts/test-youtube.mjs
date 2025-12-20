/**
 * Test YouTube Integration
 * Tests: Channel info, videos, transcripts
 */

import { Innertube } from 'youtubei.js'
import { YoutubeTranscript } from 'youtube-transcript'

async function testYouTube() {
  console.log('🎬 Testing YouTube Integration...\n')

  // Initialize
  console.log('Initializing youtubei.js...')
  const youtube = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: false,
  })
  console.log('✅ Initialized!\n')

  // Test 1: Get channel info
  console.log('📺 Test 1: Getting URLTV channel info...')
  try {
    const channel = await youtube.getChannel('urltv')
    console.log('Channel:', channel.metadata?.title)
    console.log('Subscribers:', channel.metadata?.subscriber_count)
    console.log('Videos:', channel.metadata?.video_count)
    console.log('✅ Channel info works!\n')
  } catch (err) {
    console.log('❌ Channel info failed:', err.message, '\n')
  }

  // Test 2: Get channel videos
  console.log('🎥 Test 2: Getting recent videos...')
  try {
    const channel = await youtube.getChannel('urltv')
    const videos = await channel.getVideos()

    console.log(`Found ${videos.videos?.length || 0} videos:`)
    for (const video of (videos.videos || []).slice(0, 5)) {
      console.log(`  - ${video.title?.text} (${video.view_count?.text} views)`)
    }
    console.log('✅ Video list works!\n')
  } catch (err) {
    console.log('❌ Video list failed:', err.message, '\n')
  }

  // Test 3: Search YouTube
  console.log('🔍 Test 3: Searching "Geechi Gotti vs"...')
  try {
    const results = await youtube.search('Geechi Gotti vs', { type: 'video' })

    console.log(`Found ${results.videos?.length || 0} results:`)
    for (const video of (results.videos || []).slice(0, 5)) {
      console.log(`  - ${video.title?.text}`)
    }
    console.log('✅ Search works!\n')
  } catch (err) {
    console.log('❌ Search failed:', err.message, '\n')
  }

  // Test 4: Get transcript
  console.log('📝 Test 4: Getting transcript for a battle...')
  try {
    // Use a known battle video ID
    const transcript = await YoutubeTranscript.fetchTranscript('wN8Z-k5VLqw') // Random URL video

    if (transcript && transcript.length > 0) {
      console.log(`Got ${transcript.length} transcript segments`)
      console.log('First 3 segments:')
      for (const seg of transcript.slice(0, 3)) {
        console.log(`  [${(seg.offset/1000).toFixed(1)}s] ${seg.text.substring(0, 50)}...`)
      }
      console.log('✅ Transcripts work!\n')
    } else {
      console.log('⚠️ No transcript available for this video\n')
    }
  } catch (err) {
    console.log('❌ Transcript failed:', err.message, '\n')
  }

  console.log('🎉 YouTube testing complete!')
}

testYouTube().catch(console.error)
