// Quick script to find the Algorithm Institute channel
import { Innertube } from 'youtubei.js'

async function findChannel() {
  console.log('Initializing YouTube client...')
  const youtube = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: false,
  })

  // Try searching for the channel
  console.log('\nSearching for "Algorithm Institute Battle Rap"...')
  const searchResults = await youtube.search('Algorithm Institute of Battle Rap', { type: 'channel' })

  console.log('\nChannel results:')
  for (const channel of searchResults.channels || []) {
    console.log(`- ${channel.author?.name || 'Unknown'} (${channel.author?.id || 'no id'})`)
    console.log(`  Subscribers: ${channel.subscriber_count?.text || 'N/A'}`)
    console.log(`  Videos: ${channel.video_count?.text || 'N/A'}`)
    console.log('')
  }

  // Also search for videos
  console.log('\nSearching for videos...')
  const videoResults = await youtube.search('Algorithm Institute Battle Rap Hitman', { type: 'video' })

  console.log('\nVideo results:')
  for (const video of (videoResults.videos || []).slice(0, 10)) {
    console.log(`- "${video.title?.text || 'Unknown'}"`)
    console.log(`  Channel: ${video.author?.name || 'Unknown'}`)
    console.log(`  Views: ${video.view_count?.text || 'N/A'}`)
    console.log(`  URL: https://youtube.com/watch?v=${video.id}`)
    console.log('')
  }
}

findChannel().catch(console.error)
