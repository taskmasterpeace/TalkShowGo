/**
 * Fetch YouTube Videos from Battle Rap Channels
 * Uses youtubei.js (FREE - no API key needed!)
 */

import { Innertube } from 'youtubei.js'
import pg from 'pg'
const { Pool } = pg

// Direct database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'talkshowgo',
  user: 'postgres',
  password: 'postgres',
})

const TOPIC_ID = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'
const VIDEOS_PER_CHANNEL = 10

async function main() {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  FETCHING YOUTUBE VIDEOS FROM BATTLE RAP CHANNELS     ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  console.log('')

  // Initialize YouTube client
  console.log('Initializing YouTube client...')
  const youtube = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: false,
  })
  console.log('✅ YouTube client ready!\n')

  // Get channels from database
  const { rows: channels } = await pool.query(`
    SELECT id, channel_id, channel_name, handle
    FROM youtube_channels
    WHERE topic_id = $1
  `, [TOPIC_ID])

  console.log(`Found ${channels.length} channels to fetch videos from:\n`)

  let totalVideos = 0
  const allVideos = []

  for (const channel of channels) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📺 ${channel.channel_name} (@${channel.handle})`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    try {
      // Fetch channel by ID or handle
      const ytChannel = await youtube.getChannel(channel.channel_id)

      if (!ytChannel) {
        console.log('   ⚠️  Could not find channel by ID, trying handle...')
        const ytByHandle = await youtube.getChannel(channel.handle)
        if (!ytByHandle) {
          console.log('   ❌ Channel not found\n')
          continue
        }
      }

      // Get videos
      const videosTab = await ytChannel.getVideos()
      const videos = (videosTab.videos || []).slice(0, VIDEOS_PER_CHANNEL)

      console.log(`   Found ${videos.length} videos:\n`)

      for (const video of videos) {
        const videoId = video.id
        const title = video.title?.text || 'Unknown'
        const viewCount = parseViewCount(video.view_count?.text)
        const duration = video.duration?.text || ''
        const publishedAt = video.published?.text || ''
        const thumbnail = video.thumbnails?.[0]?.url || ''

        // Check if already exists
        const { rows: existing } = await pool.query(
          'SELECT id FROM youtube_videos WHERE video_id = $1',
          [videoId]
        )

        if (existing.length > 0) {
          console.log(`   ⏭️  "${title.substring(0, 45)}..." (exists)`)
          continue
        }

        // Insert video
        await pool.query(`
          INSERT INTO youtube_videos (
            topic_id, channel_id, video_id, title, description,
            view_count, thumbnail_url, processed
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, false)
        `, [
          TOPIC_ID,
          channel.id,
          videoId,
          title,
          video.description_snippet?.text || '',
          viewCount,
          thumbnail,
        ])

        const viewStr = viewCount > 0 ? `${(viewCount/1000).toFixed(0)}K views` : 'views N/A'
        console.log(`   ✅ "${title.substring(0, 45)}..."`)
        console.log(`      ${viewStr} | ${duration} | ${publishedAt}`)

        allVideos.push({
          channel: channel.channel_name,
          title,
          viewCount,
          duration,
          publishedAt,
        })
        totalVideos++
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`)
    }
    console.log('')
  }

  // Summary
  console.log('\n' + '═'.repeat(55))
  console.log('SUMMARY')
  console.log('═'.repeat(55))

  // Get totals from database
  const { rows: stats } = await pool.query(`
    SELECT
      (SELECT count(*) FROM source_accounts WHERE topic_id = $1) as twitter_count,
      (SELECT count(*) FROM youtube_channels WHERE topic_id = $1) as channel_count,
      (SELECT count(*) FROM youtube_videos WHERE topic_id = $1) as video_count
  `, [TOPIC_ID])

  console.log(`
   Battle Rap Niche Status:
   ────────────────────────
   📊 Twitter Sources:    ${stats[0].twitter_count}
   📺 YouTube Channels:   ${stats[0].channel_count}
   🎬 YouTube Videos:     ${stats[0].video_count}
   `)

  // Show top videos by views
  if (allVideos.length > 0) {
    console.log('   TOP VIDEOS FETCHED (by views):')
    console.log('   ' + '─'.repeat(50))
    const sorted = [...allVideos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    for (const v of sorted.slice(0, 10)) {
      const views = v.viewCount > 0 ? `${(v.viewCount/1000).toFixed(0)}K`.padStart(6) : '    ? '
      console.log(`   ${views} | ${v.channel.substring(0,15).padEnd(15)} | ${v.title.substring(0, 35)}`)
    }
  }

  console.log(`\n✅ Fetched ${totalVideos} new videos!\n`)

  await pool.end()
}

function parseViewCount(text) {
  if (!text) return 0
  const cleaned = text.toString().toLowerCase().replace(/,/g, '').replace(' views', '')
  if (cleaned.includes('k')) return Math.round(parseFloat(cleaned) * 1000)
  if (cleaned.includes('m')) return Math.round(parseFloat(cleaned) * 1000000)
  return parseInt(cleaned) || 0
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
