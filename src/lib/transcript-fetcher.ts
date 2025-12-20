/**
 * Transcript Fetcher
 *
 * Smart transcript getter that:
 * 1. Checks database for existing transcript
 * 2. Tries YouTube captions (free)
 * 3. Falls back to download audio + AssemblyAI transcription
 */

import { YoutubeTranscript } from 'youtube-transcript'
import { downloadYouTubeAudio, extractVideoId, getVideoInfo } from './youtube-download'
import { transcribeAudio, isAssemblyAIConfigured, SpeakerSegment } from './assemblyai'
import { createClient } from '@supabase/supabase-js'

// Supabase client for database operations
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000'
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export type TranscriptStatus =
  | 'pending'
  | 'has_youtube_captions'
  | 'has_assemblyai'
  | 'download_failed'
  | 'transcription_failed'
  | 'skipped_too_long'
  | 'skipped_too_short'

export type TranscriptSource = 'youtube_captions' | 'assemblyai' | 'database'

export interface TranscriptResult {
  success: boolean
  video_id: string
  text?: string
  source?: TranscriptSource
  confidence?: number
  speakers?: SpeakerSegment[]
  duration_seconds?: number
  error?: string
  status: TranscriptStatus
}

export interface TranscriptFetchOptions {
  prefer_youtube?: boolean      // Try YouTube captions first (default true)
  enable_download?: boolean     // Download audio if no captions (default true)
  max_duration_minutes?: number // Skip videos longer than this (default 120)
  min_duration_seconds?: number // Skip videos shorter than this (default 60)
  force_refresh?: boolean       // Ignore cached transcript (default false)
  save_to_database?: boolean    // Save transcript to database (default true)
}

/**
 * Check database for existing transcript
 */
async function checkDatabaseForTranscript(videoId: string): Promise<TranscriptResult | null> {
  try {
    const { data, error } = await supabase
      .from('youtube_videos')
      .select('video_id, transcript, transcript_source, transcript_confidence, transcript_status, speaker_segments, duration')
      .eq('video_id', videoId)
      .single()

    if (error || !data || !data.transcript) {
      return null
    }

    console.log(`[TranscriptFetcher] Found cached transcript for ${videoId} (source: ${data.transcript_source})`)

    return {
      success: true,
      video_id: videoId,
      text: data.transcript,
      source: 'database',
      confidence: data.transcript_confidence || undefined,
      speakers: data.speaker_segments || undefined,
      duration_seconds: data.duration || undefined,
      status: data.transcript_status || 'has_youtube_captions'
    }
  } catch (error) {
    console.error(`[TranscriptFetcher] Database error for ${videoId}:`, error)
    return null
  }
}

/**
 * Try to get YouTube captions
 */
async function tryYouTubeCaptions(videoId: string): Promise<string | null> {
  console.log(`[TranscriptFetcher] Trying YouTube captions for ${videoId}`)

  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)

    if (!transcriptItems || transcriptItems.length === 0) {
      console.log(`[TranscriptFetcher] No YouTube captions available for ${videoId}`)
      return null
    }

    // Combine transcript items into full text
    const fullText = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!fullText) {
      return null
    }

    console.log(`[TranscriptFetcher] Got YouTube captions: ${fullText.length} characters`)
    return fullText
  } catch (error) {
    console.log(`[TranscriptFetcher] YouTube captions not available: ${error}`)
    return null
  }
}

/**
 * Save transcript to database
 */
async function saveTranscriptToDatabase(
  videoId: string,
  transcript: string,
  source: 'youtube_captions' | 'assemblyai',
  confidence?: number,
  speakers?: SpeakerSegment[],
  audioPath?: string
): Promise<void> {
  try {
    const updateData: Record<string, any> = {
      transcript,
      transcript_source: source,
      transcript_status: source === 'youtube_captions' ? 'has_youtube_captions' : 'has_assemblyai'
    }

    if (confidence !== undefined) {
      updateData.transcript_confidence = confidence
    }

    if (speakers) {
      updateData.speaker_segments = speakers
    }

    if (audioPath) {
      updateData.audio_path = audioPath
      updateData.audio_downloaded = true
      updateData.audio_downloaded_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('youtube_videos')
      .update(updateData)
      .eq('video_id', videoId)

    if (error) {
      console.error(`[TranscriptFetcher] Error saving transcript to database:`, error)
    } else {
      console.log(`[TranscriptFetcher] Saved transcript to database for ${videoId}`)
    }
  } catch (error) {
    console.error(`[TranscriptFetcher] Error saving transcript:`, error)
  }
}

/**
 * Update video status in database
 */
async function updateVideoStatus(videoId: string, status: TranscriptStatus): Promise<void> {
  try {
    await supabase
      .from('youtube_videos')
      .update({ transcript_status: status })
      .eq('video_id', videoId)
  } catch (error) {
    console.error(`[TranscriptFetcher] Error updating status:`, error)
  }
}

/**
 * Main function - get transcript for a video
 * Tries multiple methods in order:
 * 1. Check database cache
 * 2. Try YouTube captions (free)
 * 3. Download audio + transcribe with AssemblyAI
 */
export async function getTranscript(
  videoIdOrUrl: string,
  options?: TranscriptFetchOptions
): Promise<TranscriptResult> {
  const videoId = extractVideoId(videoIdOrUrl)
  const preferYouTube = options?.prefer_youtube ?? true
  const enableDownload = options?.enable_download ?? true
  const maxDuration = options?.max_duration_minutes ?? 120
  const minDuration = options?.min_duration_seconds ?? 60
  const forceRefresh = options?.force_refresh ?? false
  const saveToDb = options?.save_to_database ?? true

  console.log(`[TranscriptFetcher] Getting transcript for ${videoId}`)

  // Step 1: Check database cache (unless force refresh)
  if (!forceRefresh) {
    const cached = await checkDatabaseForTranscript(videoId)
    if (cached && cached.text) {
      return cached
    }
  }

  // Step 2: Try YouTube captions
  if (preferYouTube) {
    const youtubeCaptions = await tryYouTubeCaptions(videoId)
    if (youtubeCaptions) {
      // Save to database
      if (saveToDb) {
        await saveTranscriptToDatabase(videoId, youtubeCaptions, 'youtube_captions')
      }

      return {
        success: true,
        video_id: videoId,
        text: youtubeCaptions,
        source: 'youtube_captions',
        status: 'has_youtube_captions'
      }
    }
  }

  // Step 3: Download and transcribe with AssemblyAI
  if (enableDownload) {
    // Check if AssemblyAI is configured
    if (!isAssemblyAIConfigured()) {
      console.log(`[TranscriptFetcher] AssemblyAI not configured, cannot transcribe ${videoId}`)
      return {
        success: false,
        video_id: videoId,
        error: 'AssemblyAI not configured and YouTube captions not available',
        status: 'pending'
      }
    }

    // Get video info to check duration
    try {
      const videoInfo = await getVideoInfo(videoId)
      const durationMinutes = videoInfo.duration_seconds / 60

      // Check duration limits
      if (videoInfo.duration_seconds < minDuration) {
        console.log(`[TranscriptFetcher] Video too short: ${videoInfo.duration_seconds}s (min: ${minDuration}s)`)
        if (saveToDb) {
          await updateVideoStatus(videoId, 'skipped_too_short')
        }
        return {
          success: false,
          video_id: videoId,
          duration_seconds: videoInfo.duration_seconds,
          error: `Video too short: ${videoInfo.duration_seconds}s (min: ${minDuration}s)`,
          status: 'skipped_too_short'
        }
      }

      if (durationMinutes > maxDuration) {
        console.log(`[TranscriptFetcher] Video too long: ${durationMinutes.toFixed(1)}min (max: ${maxDuration}min)`)
        if (saveToDb) {
          await updateVideoStatus(videoId, 'skipped_too_long')
        }
        return {
          success: false,
          video_id: videoId,
          duration_seconds: videoInfo.duration_seconds,
          error: `Video too long: ${durationMinutes.toFixed(1)}min (max: ${maxDuration}min)`,
          status: 'skipped_too_long'
        }
      }

      // Download audio
      console.log(`[TranscriptFetcher] Downloading audio for ${videoId}`)
      const downloadResult = await downloadYouTubeAudio(videoId, {
        maxDurationMinutes: maxDuration
      })

      if (!downloadResult.success) {
        console.log(`[TranscriptFetcher] Download failed: ${downloadResult.error}`)
        if (saveToDb) {
          await updateVideoStatus(videoId, 'download_failed')
        }
        return {
          success: false,
          video_id: videoId,
          error: `Download failed: ${downloadResult.error}`,
          status: 'download_failed'
        }
      }

      // Transcribe with AssemblyAI
      console.log(`[TranscriptFetcher] Transcribing with AssemblyAI: ${downloadResult.audio_path}`)
      const transcriptionResult = await transcribeAudio(downloadResult.audio_path, {
        speaker_labels: true
      })

      if (!transcriptionResult.success) {
        console.log(`[TranscriptFetcher] Transcription failed: ${transcriptionResult.error}`)
        if (saveToDb) {
          await updateVideoStatus(videoId, 'transcription_failed')
        }
        return {
          success: false,
          video_id: videoId,
          error: `Transcription failed: ${transcriptionResult.error}`,
          status: 'transcription_failed'
        }
      }

      // Save to database
      if (saveToDb) {
        await saveTranscriptToDatabase(
          videoId,
          transcriptionResult.transcript_text,
          'assemblyai',
          transcriptionResult.confidence,
          transcriptionResult.speakers,
          downloadResult.audio_path
        )
      }

      return {
        success: true,
        video_id: videoId,
        text: transcriptionResult.transcript_text,
        source: 'assemblyai',
        confidence: transcriptionResult.confidence,
        speakers: transcriptionResult.speakers,
        duration_seconds: transcriptionResult.duration_seconds,
        status: 'has_assemblyai'
      }
    } catch (error) {
      console.error(`[TranscriptFetcher] Error processing ${videoId}:`, error)
      return {
        success: false,
        video_id: videoId,
        error: String(error),
        status: 'transcription_failed'
      }
    }
  }

  // No transcript available
  return {
    success: false,
    video_id: videoId,
    error: 'No transcript source available',
    status: 'pending'
  }
}

/**
 * Get transcripts for multiple videos
 */
export async function getMultipleTranscripts(
  videoIds: string[],
  options?: TranscriptFetchOptions & { concurrency?: number }
): Promise<TranscriptResult[]> {
  const concurrency = options?.concurrency ?? 2  // Lower concurrency for API rate limits
  const results: TranscriptResult[] = []
  const queue = [...videoIds]

  console.log(`[TranscriptFetcher] Getting transcripts for ${queue.length} videos (concurrency: ${concurrency})`)

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency)
    const batchResults = await Promise.all(
      batch.map(videoId => getTranscript(videoId, options))
    )
    results.push(...batchResults)

    const successful = batchResults.filter(r => r.success).length
    console.log(`[TranscriptFetcher] Batch complete: ${successful}/${batch.length} successful, ${queue.length} remaining`)

    // Small delay between batches to avoid rate limiting
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const totalSuccess = results.filter(r => r.success).length
  console.log(`[TranscriptFetcher] All transcripts complete: ${totalSuccess}/${results.length} successful`)

  return results
}
