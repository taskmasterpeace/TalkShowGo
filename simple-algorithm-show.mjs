/**
 * Simple Algorithm Institute Show Generator
 * Uses configured YouTube channels and Twitter accounts directly
 */

import { Innertube } from 'youtubei.js'
import pg from 'pg'
import fs from 'fs/promises'

const { Client } = pg

// Database connection
const db = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'talkshowgo',
  user: 'postgres',
  password: 'postgres'
})

await db.connect()

console.log('=== ALGORITHM INSTITUTE: Last 48 Hours in Battle Rap ===\n')

// Get configured YouTube channels for battle rap topic
const channelsResult = await db.query(
  `SELECT channel_name, channel_id FROM youtube_channels
   WHERE topic_id = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'`
)

console.log(`Found ${channelsResult.rows.length} configured YouTube channels:`)
channelsResult.rows.forEach(ch => {
  console.log(`  - ${ch.channel_name}`)
})

// Get recent videos from each channel (last 48 hours)
const youtube = await Innertube.create()
const cutoffTime = Date.now() - (48 * 60 * 60 * 1000)

const allVideos = []

for (const channel of channelsResult.rows) {
  console.log(`\nFetching recent videos from ${channel.channel_name}...`)

  try {
    const channelData = await youtube.getChannel(channel.channel_id)
    const videos = await channelData.getVideos()

    const recentVideos = videos.videos
      .filter(v => {
        const uploadedMs = new Date(v.published.text).getTime()
        return uploadedMs > cutoffTime
      })
      .slice(0, 3)

    console.log(`  Found ${recentVideos.length} recent videos`)

    for (const video of recentVideos) {
      allVideos.push({
        channel: channel.channel_name,
        title: video.title.text,
        id: video.id,
        published: video.published.text
      })
      console.log(`    - ${video.title.text}`)
    }
  } catch (error) {
    console.error(`  Error fetching from ${channel.channel_name}:`, error.message)
  }
}

// Get configured Twitter accounts
const twitterResult = await db.query(
  `SELECT handle, platform, credibility_score FROM source_accounts
   WHERE topic_id = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'
   AND platform = 'twitter'`
)

console.log(`\n\nConfigured Twitter accounts (${twitterResult.rows.length}):`)
twitterResult.rows.forEach(acc => {
  console.log(`  @${acc.handle} (credibility: ${acc.credibility_score})`)
})

// Save sources report
const report = {
  generated_at: new Date().toISOString(),
  time_range: 'Last 48 hours',
  youtube_channels: channelsResult.rows.map(c => c.channel_name),
  twitter_accounts: twitterResult.rows.map(a => '@' + a.handle),
  videos_found: allVideos
}

await fs.writeFile('algorithm-sources-report.json', JSON.stringify(report, null, 2))

console.log(`\n\n=== SUMMARY ===`)
console.log(`YouTube Channels Monitored: ${channelsResult.rows.length}`)
console.log(`Twitter Accounts Monitored: ${twitterResult.rows.length}`)
console.log(`Videos Found (48hrs): ${allVideos.length}`)
console.log(`\nFull report saved to: algorithm-sources-report.json`)

await db.end()
