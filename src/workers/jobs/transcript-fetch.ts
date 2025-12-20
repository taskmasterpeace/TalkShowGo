/**
 * TRANSCRIPT FETCH (renamed to COMMENTS FETCH really)
 *
 * Fetches comments from YouTube videos using the OFFICIAL API.
 * Comments with high engagement = community consensus.
 */

import { supabase } from '@/lib/db'
import { getYouTubeClient, YouTubeComment } from '@/lib/youtube-api'

interface TranscriptFetchData {
  job_run_id: string
  topic_id: string
  batch_size?: number
}

export async function transcriptFetch(data: TranscriptFetchData) {
  const {
    job_run_id,
    topic_id,
    batch_size = 10,
  } = data

  let itemsProcessed = 0
  let commentsFetched = 0
  const errors: any[] = []

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Check if we have YouTube API key
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY not configured')
    }

    const youtube = getYouTubeClient()

    // Get videos that need comments fetched
    const { data: videos, error: videosError } = await supabase
      .from('youtube_videos')
      .select('id, video_id, title')
      .eq('topic_id', topic_id)
      .or('comments_fetched.is.null,comments_fetched.eq.false')
      .limit(batch_size)

    if (videosError) throw videosError

    console.log(`Processing ${videos?.length || 0} videos for comments...`)

    for (const video of videos || []) {
      try {
        // Fetch comments using official API
        const comments = await youtube.getVideoComments(video.video_id, {
          maxResults: 50,
          order: 'relevance', // Top comments first
        })

        if (comments.length > 0) {
          // Store comments
          const commentRecords = comments.map((c: YouTubeComment) => ({
            video_id: video.id,
            comment_id: c.commentId,
            author_name: c.authorName,
            author_channel_id: c.authorChannelId,
            text: c.text,
            like_count: c.likeCount,
            reply_count: c.replyCount,
            published_at: c.publishedAt ? new Date(c.publishedAt).toISOString() : null,
            is_reply: c.isReply,
          }))

          // Upsert comments (ignore duplicates)
          const { error: insertError } = await supabase
            .from('youtube_comments')
            .upsert(commentRecords, {
              onConflict: 'comment_id',
              ignoreDuplicates: true,
            })

          if (!insertError) {
            await supabase
              .from('youtube_videos')
              .update({
                comments_fetched: true,
                comments_fetched_at: new Date().toISOString(),
              })
              .eq('id', video.id)

            commentsFetched += comments.length
            console.log(`✓ ${comments.length} comments from: ${video.title.substring(0, 50)}...`)
          } else {
            console.error(`Insert error for ${video.video_id}:`, insertError)
          }
        } else {
          // Mark as fetched even if no comments (to avoid re-fetching)
          await supabase
            .from('youtube_videos')
            .update({
              comments_fetched: true,
              comments_fetched_at: new Date().toISOString(),
            })
            .eq('id', video.id)
          console.log(`✗ No comments for: ${video.title.substring(0, 50)}...`)
        }

        itemsProcessed++

        // Small delay to be nice to API
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (err: any) {
        console.error(`Error processing video ${video.video_id}:`, err?.message || err)
        errors.push({
          video_id: video.video_id,
          title: video.title,
          error: err?.message || String(err),
        })
      }
    }

    await supabase
      .from('job_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        items_processed: itemsProcessed,
        metadata: {
          comments_fetched: commentsFetched,
        },
        errors,
      })
      .eq('id', job_run_id)

    console.log(`Comments fetch complete: ${commentsFetched} comments from ${itemsProcessed} videos`)

    return {
      itemsProcessed,
      commentsFetched,
      errors,
    }
  } catch (error: any) {
    console.error('Job failed:', error)
    await supabase
      .from('job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [{ error: error?.message || String(error) }],
      })
      .eq('id', job_run_id)

    throw error
  }
}
