/**
 * Channel Profiling Script
 * Gets channel info and recent videos for each commentary channel
 */

const API_KEY = process.env.YOUTUBE_API_KEY || '' // key was committed here once - REVOKED; env-only now

const CHANNELS = [
  { id: 'UCPmsKnEd95aD2bKEm277aVw', name: 'PIPERBOY WILLIAMS' },
  { id: 'UCWfpcHo75x3Z3OtTAcy7-jQ', name: 'Vada Fly' }
]

async function getChannelInfo(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?key=${API_KEY}&id=${channelId}&part=snippet,contentDetails,statistics`
  const response = await fetch(url)
  const data = await response.json()
  return data.items?.[0]
}

async function getPlaylistVideos(playlistId) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${playlistId}&part=snippet&maxResults=15`
  const response = await fetch(url)
  const data = await response.json()
  return data.items || []
}

async function profileChannel(channelId, channelName) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`=== ${channelName} ===`)
  console.log(`${'='.repeat(60)}`)

  try {
    // Get channel info
    const channel = await getChannelInfo(channelId)
    if (!channel) {
      console.log('Channel not found')
      return
    }

    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads
    const stats = channel.statistics
    const snippet = channel.snippet

    console.log(`Channel ID: ${channelId}`)
    console.log(`Subscribers: ${parseInt(stats.subscriberCount).toLocaleString()}`)
    console.log(`Total Videos: ${stats.videoCount}`)
    console.log(`Total Views: ${parseInt(stats.viewCount).toLocaleString()}`)
    console.log(`Created: ${snippet.publishedAt.split('T')[0]}`)
    console.log(`Description: ${snippet.description?.substring(0, 200)}...`)
    console.log(`\nUploads Playlist: ${uploadsPlaylistId}`)

    // Get recent videos
    if (uploadsPlaylistId) {
      console.log('\n--- Recent Videos (last 15) ---')
      const videos = await getPlaylistVideos(uploadsPlaylistId)
      for (const video of videos) {
        const date = video.snippet.publishedAt.split('T')[0]
        console.log(`${date} | ${video.snippet.title}`)
      }
    }
  } catch (err) {
    console.log(`ERROR: ${err.message}`)
  }
}

async function main() {
  console.log('YOUTUBE CHANNEL PROFILING')
  console.log('=' .repeat(60))

  for (const channel of CHANNELS) {
    await profileChannel(channel.id, channel.name)
  }
}

main()
