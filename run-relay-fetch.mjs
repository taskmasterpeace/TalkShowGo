/**
 * Run RELAY Fetch directly to populate videos with proper timestamps
 */

import { parseStringPromise } from 'xml2js'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_KEY) {
  console.error('No Supabase key found!')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const TOPIC_ID = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'
const HOURS_BACK = 72

// Time range functions
function createTimeRange(hoursBack) {
  const now = new Date()
  const startDate = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)
  return { hours_back: hoursBack, start_date: startDate, end_date: now }
}

function isWithinTimeRange(date, range) {
  if (!date) return false
  const d = new Date(date)
  return d >= range.start_date && d <= range.end_date
}

// Fetch videos from RSS
async function fetchChannelRSS(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentKingdom/1.0)' }
    })

    if (!response.ok) return []

    const xml = await response.text()
    const parsed = await parseStringPromise(xml)

    if (!parsed.feed?.entry) return []

    const channelName = parsed.feed.author?.[0]?.name?.[0] || 'Unknown'

    return parsed.feed.entry.map(entry => {
      const mediaGroup = entry['media:group']?.[0]
      const community = mediaGroup?.['media:community']?.[0]

      return {
        id: entry['yt:videoId'][0],
        title: entry.title[0],
        channel_id: channelId,
        channel_name: channelName,
        published_at: new Date(entry.published[0]),
        description: mediaGroup?.['media:description']?.[0] || '',
        view_count: parseInt(community?.['media:statistics']?.[0]?.$?.views || '0'),
        thumbnail_url: mediaGroup?.['media:thumbnail']?.[0]?.$?.url || '',
      }
    })
  } catch (error) {
    console.error(`Error fetching ${channelId}:`, error.message)
    return []
  }
}

async function main() {
  console.log('=' .repeat(60))
  console.log('RELAY FETCH - Direct Run')
  console.log('=' .repeat(60))
  console.log('')

  const timeRange = createTimeRange(HOURS_BACK)
  console.log(`Time range: last ${HOURS_BACK} hours`)
  console.log(`Start: ${timeRange.start_date.toISOString()}`)
  console.log(`End: ${timeRange.end_date.toISOString()}`)
  console.log('')

  // Get trusted channels
  const { data: channels, error: channelsError } = await supabase
    .from('youtube_channels')
    .select('*')
    .eq('topic_id', TOPIC_ID)
    .eq('status', 'trusted')

  if (channelsError) {
    console.error('Error fetching channels:', channelsError)
    return
  }

  console.log(`Found ${channels.length} trusted channels`)
  console.log('')

  let totalStored = 0
  let totalUpdated = 0
  let totalSkipped = 0

  for (const channel of channels) {
    console.log(`📺 ${channel.channel_name} (${channel.channel_id})`)

    const videos = await fetchChannelRSS(channel.channel_id)

    if (videos.length === 0) {
      console.log('   No videos from RSS')
      continue
    }

    // Filter by time range
    const recentVideos = videos.filter(v => isWithinTimeRange(v.published_at, timeRange))
    console.log(`   ${videos.length} total, ${recentVideos.length} within time range`)

    for (const video of recentVideos) {
      // Check if exists
      const { data: existing } = await supabase
        .from('youtube_videos')
        .select('id, published_at')
        .eq('video_id', video.id)
        .single()

      if (existing) {
        if (!existing.published_at) {
          // Update with proper published_at
          const { error } = await supabase
            .from('youtube_videos')
            .update({ published_at: video.published_at.toISOString() })
            .eq('video_id', video.id)

          if (!error) {
            console.log(`   ✅ UPDATED date: "${video.title.substring(0, 40)}..." → ${video.published_at.toISOString()}`)
            totalUpdated++
          } else {
            console.log(`   ❌ Update error: ${error.message}`)
          }
        } else {
          totalSkipped++
        }
      } else {
        // Insert new - use the channel's UUID id, not the string channel_id
        const { error } = await supabase
          .from('youtube_videos')
          .insert({
            video_id: video.id,
            channel_id: channel.id,  // Use the UUID from youtube_channels table
            title: video.title,
            description: video.description || '',
            published_at: video.published_at.toISOString(),
            thumbnail_url: video.thumbnail_url || '',
            view_count: video.view_count || 0,
            topic_id: TOPIC_ID,
            channel_title: video.channel_name,
          })

        if (!error) {
          console.log(`   ✅ STORED: "${video.title.substring(0, 40)}..." (${video.published_at.toISOString()})`)
          totalStored++
        } else if (error.code === '23505') {
          totalSkipped++
        } else {
          console.log(`   ❌ Insert error: ${error.message}`)
        }
      }
    }

    // Update channel last_checked
    await supabase
      .from('youtube_channels')
      .update({ last_checked: new Date().toISOString() })
      .eq('id', channel.id)
  }

  console.log('')
  console.log('=' .repeat(60))
  console.log('SUMMARY')
  console.log('=' .repeat(60))
  console.log(`New videos stored: ${totalStored}`)
  console.log(`Existing videos updated with dates: ${totalUpdated}`)
  console.log(`Videos skipped (already had dates): ${totalSkipped}`)

  // Verify
  const { data: withDates } = await supabase
    .from('youtube_videos')
    .select('id')
    .eq('topic_id', TOPIC_ID)
    .not('published_at', 'is', null)
    .gte('published_at', timeRange.start_date.toISOString())

  console.log(`Videos with dates in time range: ${withDates?.length || 0}`)
}

main().catch(console.error)
