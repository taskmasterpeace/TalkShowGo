/**
 * RELAY FETCH
 *
 * Fetches videos from trusted YouTube channels for a topic.
 * Uses RSS feeds for accurate timestamps (not youtubei.js which gives relative dates).
 */

import { supabase } from '@/lib/db'
import { fetchChannelRSS } from '@/lib/sources/youtube-adapter'
import { createTimeRange, isWithinTimeRange } from '@/lib/time-range'

interface RelayFetchData {
  job_run_id: string
  topic_id: string
  hours_back?: number
}

interface FetchStats {
  channelsProcessed: number
  videosFound: number
  videosStored: number
  videosSkipped: number
  errors: Array<{ channel_id: string; channel_name: string; error: string }>
}

export async function relayFetch(data: RelayFetchData) {
  const { job_run_id, topic_id, hours_back = 72 } = data

  const stats: FetchStats = {
    channelsProcessed: 0,
    videosFound: 0,
    videosStored: 0,
    videosSkipped: 0,
    errors: [],
  }

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get time range from topic config or use default
    const timeRange = createTimeRange(hours_back)
    console.log(`[RELAY] Fetching videos from last ${hours_back} hours`)
    console.log(`[RELAY] Time range: ${timeRange.start_date.toISOString()} to ${timeRange.end_date.toISOString()}`)

    // Get all trusted YouTube channels for this topic
    const { data: channels, error: channelsError } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('topic_id', topic_id)
      .eq('status', 'trusted')

    if (channelsError) throw channelsError

    if (!channels || channels.length === 0) {
      console.log(`[RELAY] No trusted channels found for topic ${topic_id}`)
      await markCompleted(job_run_id, stats)
      return stats
    }

    console.log(`[RELAY] Found ${channels.length} trusted channels`)

    // Process each channel
    for (const channel of channels) {
      try {
        console.log(`[RELAY] Fetching from ${channel.channel_name} (${channel.channel_id})`)

        // Fetch videos from RSS feed (accurate timestamps!)
        const videos = await fetchChannelRSS(channel.channel_id)
        stats.channelsProcessed++

        if (videos.length === 0) {
          console.log(`[RELAY] No videos found for ${channel.channel_name}`)
          continue
        }

        // Filter by time range
        const recentVideos = videos.filter((v) =>
          isWithinTimeRange(v.published_at, timeRange)
        )

        stats.videosFound += videos.length
        console.log(`[RELAY] ${channel.channel_name}: ${videos.length} total, ${recentVideos.length} within time range`)

        // Store videos in database
        for (const video of recentVideos) {
          try {
            // Check if video already exists
            const { data: existing } = await supabase
              .from('youtube_videos')
              .select('id')
              .eq('video_id', video.id)
              .single()

            if (existing) {
              stats.videosSkipped++
              continue
            }

            // Insert new video with accurate published_at
            const { error: insertError } = await supabase
              .from('youtube_videos')
              .insert({
                video_id: video.id,
                channel_id: channel.id, // Use UUID from youtube_channels table
                title: video.title,
                description: video.description || '',
                published_at: video.published_at.toISOString(), // REAL timestamp from RSS!
                thumbnail_url: video.thumbnail_url || '',
                view_count: video.view_count || 0,
                topic_id,
                channel_title: video.channel_name,
              })

            if (insertError) {
              // Handle unique constraint violation gracefully
              if (insertError.code === '23505') {
                stats.videosSkipped++
              } else {
                throw insertError
              }
            } else {
              stats.videosStored++
              console.log(`[RELAY] Stored: "${video.title}" (${video.published_at.toISOString()})`)
            }
          } catch (err) {
            console.error(`[RELAY] Error storing video ${video.id}:`, err)
          }
        }

        // Update channel last_checked
        await supabase
          .from('youtube_channels')
          .update({ last_checked: new Date().toISOString() })
          .eq('id', channel.id)

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[RELAY] Error processing ${channel.channel_name}:`, errorMsg)
        stats.errors.push({
          channel_id: channel.channel_id,
          channel_name: channel.channel_name,
          error: errorMsg,
        })
      }
    }

    await markCompleted(job_run_id, stats)

    console.log(`[RELAY] Complete: ${stats.channelsProcessed} channels, ${stats.videosStored} new videos stored, ${stats.videosSkipped} skipped`)

    return stats
  } catch (error) {
    await supabase
      .from('job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [{ error: String(error) }],
      })
      .eq('id', job_run_id)

    throw error
  }
}

async function markCompleted(jobRunId: string, stats: FetchStats) {
  await supabase
    .from('job_runs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      items_processed: stats.videosStored,
      metadata: {
        channels_processed: stats.channelsProcessed,
        videos_found: stats.videosFound,
        videos_stored: stats.videosStored,
        videos_skipped: stats.videosSkipped,
      },
      errors: stats.errors.length > 0 ? stats.errors : null,
    })
    .eq('id', jobRunId)
}
