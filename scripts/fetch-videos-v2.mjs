/**
 * Fetch YouTube Videos v2 - Uses correct channel IDs
 */

import { Innertube } from 'youtubei.js'
import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'talkshowgo',
  user: 'postgres',
  password: 'postgres',
})

const TOPIC_ID = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'
const VIDEOS_PER_CHANNEL = 15

async function main() {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  FETCHING BATTLE RAP YOUTUBE VIDEOS                       ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('')

  const youtube = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: false,
  })

  // Get channels
  const { rows: channels } = await pool.query(`
    SELECT id, channel_id, channel_name
    FROM youtube_channels
    WHERE topic_id = $1
  `, [TOPIC_ID])

  console.log(`Fetching from ${channels.length} channels...\n`)

  let totalNew = 0
  let totalSkipped = 0
  const allVideos = []

  for (const channel of channels) {
    console.log(`\n${'━'.repeat(60)}`)
    console.log(`📺 ${channel.channel_name}`)
    console.log(`   ID: ${channel.channel_id}`)
    console.log('━'.repeat(60))

    try {
      const ytChannel = await youtube.getChannel(channel.channel_id)

      if (!ytChannel) {
        console.log('   ❌ Channel not found')
        continue
      }

      const videosTab = await ytChannel.getVideos()
      const videos = (videosTab.videos || []).slice(0, VIDEOS_PER_CHANNEL)

      console.log(`   Found ${videos.length} videos\n`)

      for (const video of videos) {
        const videoId = video.id
        const title = video.title?.text || 'Unknown'
        const viewCount = parseViewCount(video.view_count?.text)
        const duration = video.duration?.text || ''
        const publishedAt = video.published?.text || ''
        const thumbnail = video.thumbnails?.[0]?.url || ''
        const description = video.description_snippet?.text || ''

        // Check exists
        const { rows: existing } = await pool.query(
          'SELECT id FROM youtube_videos WHERE video_id = $1',
          [videoId]
        )

        if (existing.length > 0) {
          totalSkipped++
          continue
        }

        // Insert
        await pool.query(`
          INSERT INTO youtube_videos (
            topic_id, channel_id, video_id, title, description,
            view_count, thumbnail_url, processed
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, false)
        `, [TOPIC_ID, channel.id, videoId, title, description, viewCount, thumbnail])

        const views = viewCount > 1000000 ? `${(viewCount/1000000).toFixed(1)}M` :
                      viewCount > 1000 ? `${(viewCount/1000).toFixed(0)}K` : viewCount.toString()

        console.log(`   ✅ ${views.padStart(6)} | ${title.substring(0, 50)}`)

        allVideos.push({
          channel: channel.channel_name,
          title,
          viewCount,
          duration,
          publishedAt,
        })
        totalNew++
      }

      if (totalSkipped > 0 && videos.length > 0) {
        const skippedForChannel = videos.length - allVideos.filter(v => v.channel === channel.channel_name).length
        if (skippedForChannel > 0) {
          console.log(`   ⏭️  ${skippedForChannel} videos already in database`)
        }
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`)
    }
  }

  // Final summary
  console.log('\n' + '═'.repeat(60))
  console.log('FINAL RESULTS')
  console.log('═'.repeat(60))

  const { rows: stats } = await pool.query(`
    SELECT
      (SELECT count(*) FROM source_accounts WHERE topic_id = $1) as twitter_count,
      (SELECT count(*) FROM youtube_channels WHERE topic_id = $1) as channel_count,
      (SELECT count(*) FROM youtube_videos WHERE topic_id = $1) as video_count
  `, [TOPIC_ID])

  console.log(`
   BATTLE RAP NICHE:
   ─────────────────
   📊 Twitter Sources:    ${stats[0].twitter_count}
   📺 YouTube Channels:   ${stats[0].channel_count}
   🎬 YouTube Videos:     ${stats[0].video_count}

   New videos fetched:    ${totalNew}
   Already in database:   ${totalSkipped}
  `)

  // Top videos
  if (allVideos.length > 0) {
    console.log('   TOP 15 VIDEOS BY VIEWS:')
    console.log('   ' + '─'.repeat(50))

    const sorted = [...allVideos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    for (const v of sorted.slice(0, 15)) {
      const views = v.viewCount > 1000000 ? `${(v.viewCount/1000000).toFixed(1)}M` :
                    v.viewCount > 1000 ? `${(v.viewCount/1000).toFixed(0)}K` : 'N/A'
      console.log(`   ${views.padStart(6)} | ${v.title.substring(0, 45)}`)
    }
  }

  // Videos by channel
  console.log('\n   VIDEOS BY CHANNEL:')
  console.log('   ' + '─'.repeat(50))

  const { rows: byChannel } = await pool.query(`
    SELECT yc.channel_name, count(yv.id) as video_count
    FROM youtube_channels yc
    LEFT JOIN youtube_videos yv ON yv.channel_id = yc.id
    WHERE yc.topic_id = $1
    GROUP BY yc.id, yc.channel_name
    ORDER BY video_count DESC
  `, [TOPIC_ID])

  for (const c of byChannel) {
    console.log(`   ${c.video_count.toString().padStart(3)} | ${c.channel_name}`)
  }

  console.log('')
  await pool.end()
}

function parseViewCount(text) {
  if (!text) return 0
  const cleaned = text.toString().toLowerCase().replace(/,/g, '').replace(' views', '')
  if (cleaned.includes('m')) return Math.round(parseFloat(cleaned) * 1000000)
  if (cleaned.includes('k')) return Math.round(parseFloat(cleaned) * 1000)
  return parseInt(cleaned) || 0
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
