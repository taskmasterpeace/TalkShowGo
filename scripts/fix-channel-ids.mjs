/**
 * Fix YouTube Channel IDs
 * Look up real channel IDs by searching
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

// Channel searches - we'll search for these and get the real channel IDs
const CHANNEL_SEARCHES = [
  { search: 'URLTV Ultimate Rap League', name: 'Ultimate Rap League' },
  { search: 'King of the Dot Entertainment KOTD', name: 'King Of The Dot Entertainment' },
  { search: 'RBE Rare Breed Entertainment battle rap', name: 'RBE Presents' },
  { search: 'Champion Smack URL battle', name: 'Champion' },
  { search: 'No Studio N battle rap', name: 'No Studio N' },
  { search: '15 Minutes of Fame battle rap', name: '15 Minutes of Fame' },
  { search: 'Jay Blac Is Bored', name: 'Jay Blac Is Bored' },
]

async function main() {
  console.log('Fixing YouTube channel IDs...\n')

  const youtube = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: false,
  })

  for (const ch of CHANNEL_SEARCHES) {
    console.log(`Searching for: "${ch.search}"...`)

    try {
      const results = await youtube.search(ch.search, { type: 'channel' })
      const channels = results.channels || []

      if (channels.length === 0) {
        console.log(`   ❌ No channels found\n`)
        continue
      }

      // Get first result
      const found = channels[0]
      const channelId = found.author?.id || found.id
      const channelName = found.author?.name || found.name?.text || 'Unknown'
      const subs = found.subscriber_count?.text || 'Unknown subs'

      console.log(`   Found: ${channelName} (${channelId})`)
      console.log(`   Subscribers: ${subs}`)

      // Update database
      const { rowCount } = await pool.query(`
        UPDATE youtube_channels
        SET channel_id = $1, channel_name = $2
        WHERE topic_id = $3 AND channel_name ILIKE $4
      `, [channelId, channelName, TOPIC_ID, `%${ch.name.split(' ')[0]}%`])

      if (rowCount > 0) {
        console.log(`   ✅ Updated in database\n`)
      } else {
        // Insert if not exists
        const { rowCount: insertCount } = await pool.query(`
          INSERT INTO youtube_channels (topic_id, channel_id, channel_name, handle, status, credibility_score)
          VALUES ($1, $2, $3, $4, 'trusted', 0.85)
          ON CONFLICT (topic_id, channel_id) DO UPDATE SET channel_name = $3
        `, [TOPIC_ID, channelId, channelName, channelName.toLowerCase().replace(/\s+/g, '')])
        console.log(`   ✅ Inserted/updated\n`)
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}\n`)
    }
  }

  // Show final channels
  const { rows } = await pool.query(`
    SELECT channel_id, channel_name, handle
    FROM youtube_channels
    WHERE topic_id = $1
  `, [TOPIC_ID])

  console.log('\n' + '═'.repeat(60))
  console.log('FINAL CHANNELS IN DATABASE:')
  console.log('═'.repeat(60))
  for (const ch of rows) {
    console.log(`${ch.channel_name.padEnd(35)} | ${ch.channel_id}`)
  }

  await pool.end()
}

main().catch(console.error)
