/**
 * RELAY FETCH
 *
 * Fetches videos from trusted YouTube channels for a topic.
 * Monitors known credible sources for new content.
 */

import { supabase } from '@/lib/db'

interface RelayFetchData {
  job_run_id: string
  topic_id: string
}

export async function relayFetch(data: RelayFetchData) {
  const { job_run_id, topic_id } = data
  let itemsProcessed = 0
  const errors: any[] = []

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get all trusted YouTube channels for this topic
    const { data: channels, error: channelsError } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('topic_id', topic_id)
      .eq('status', 'trusted')

    if (channelsError) throw channelsError

    for (const channel of channels || []) {
      try {
        // In production, this would call YouTube API
        // const videos = await fetchChannelVideos(channel.channel_id)

        console.log(`Would fetch videos from ${channel.channel_name}`)

        await supabase
          .from('youtube_channels')
          .update({ last_checked: new Date().toISOString() })
          .eq('id', channel.id)

        itemsProcessed++
      } catch (err) {
        errors.push({
          channel_id: channel.id,
          channel_name: channel.channel_name,
          error: String(err),
        })
      }
    }

    await supabase
      .from('job_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        items_processed: itemsProcessed,
        errors,
      })
      .eq('id', job_run_id)

    return { itemsProcessed, errors }
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

// YouTube API helper (to be implemented)
async function fetchChannelVideos(channelId: string) {
  // This would use YouTube Data API v3
  // const response = await fetch(
  //   `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&type=video&order=date&key=${process.env.YOUTUBE_API_KEY}`
  // )
  // return response.json()

  return []
}
