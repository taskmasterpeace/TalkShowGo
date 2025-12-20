/**
 * YouTube Audio Download
 *
 * Uses yt-dlp (via youtube-dl-exec) to download audio from YouTube videos.
 * Downloads as MP3 for compatibility with AssemblyAI.
 */

import youtubeDlExec from 'youtube-dl-exec'
import * as path from 'path'
import * as fs from 'fs/promises'

// Configure yt-dlp binary path - use system PATH or explicit path
// On Windows with pip install: C:\Users\<user>\AppData\Local\Programs\Python\Python311\Scripts\yt-dlp.exe
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp'

// Create a configured youtubeDl instance
const youtubeDl = youtubeDlExec.create(YT_DLP_PATH)

// Default output directory
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'data', 'audio', 'downloads')

export interface DownloadResult {
  success: boolean
  video_id: string
  title: string
  audio_path: string
  duration_seconds: number
  file_size_bytes: number
  error?: string
}

export interface DownloadOptions {
  outputDir?: string
  format?: 'mp3' | 'm4a' | 'wav'
  quality?: 'best' | 'worst' | '128' | '192' | '256' | '320'
  maxDurationMinutes?: number
}

/**
 * Extract video ID from YouTube URL or return as-is if already an ID
 */
export function extractVideoId(urlOrId: string): string {
  // Already a video ID (11 characters, alphanumeric + - _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId
  }

  // YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern)
    if (match) {
      return match[1]
    }
  }

  throw new Error(`Could not extract video ID from: ${urlOrId}`)
}

/**
 * Get video info without downloading
 */
export async function getVideoInfo(videoId: string): Promise<{
  title: string
  duration_seconds: number
  description: string
  channel: string
  view_count: number
}> {
  const url = `https://www.youtube.com/watch?v=${videoId}`

  try {
    const info = await youtubeDl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      skipDownload: true
    })

    return {
      title: (info as any).title || 'Unknown',
      duration_seconds: (info as any).duration || 0,
      description: (info as any).description || '',
      channel: (info as any).channel || (info as any).uploader || 'Unknown',
      view_count: (info as any).view_count || 0
    }
  } catch (error) {
    console.error(`[YouTubeDownload] Error getting video info for ${videoId}:`, error)
    throw error
  }
}

/**
 * Download audio from a single YouTube video
 */
export async function downloadYouTubeAudio(
  videoUrlOrId: string,
  options?: DownloadOptions
): Promise<DownloadResult> {
  const videoId = extractVideoId(videoUrlOrId)
  const outputDir = options?.outputDir || DEFAULT_OUTPUT_DIR
  const format = options?.format || 'mp3'
  const maxDuration = options?.maxDurationMinutes || 120

  console.log(`[YouTubeDownload] Starting download for video: ${videoId}`)

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, `${videoId}.${format}`)

  try {
    // First, get video info to check duration
    const info = await getVideoInfo(videoId)

    // Check duration limit
    const durationMinutes = info.duration_seconds / 60
    if (durationMinutes > maxDuration) {
      console.log(`[YouTubeDownload] Video too long: ${durationMinutes.toFixed(1)} minutes (max: ${maxDuration})`)
      return {
        success: false,
        video_id: videoId,
        title: info.title,
        audio_path: '',
        duration_seconds: info.duration_seconds,
        file_size_bytes: 0,
        error: `Video too long: ${durationMinutes.toFixed(1)} minutes (max: ${maxDuration})`
      }
    }

    // Check if already downloaded
    try {
      const existingStats = await fs.stat(outputPath)
      if (existingStats.size > 0) {
        console.log(`[YouTubeDownload] Audio already exists: ${outputPath}`)
        return {
          success: true,
          video_id: videoId,
          title: info.title,
          audio_path: outputPath,
          duration_seconds: info.duration_seconds,
          file_size_bytes: existingStats.size
        }
      }
    } catch {
      // File doesn't exist, continue with download
    }

    console.log(`[YouTubeDownload] Downloading "${info.title}" (${durationMinutes.toFixed(1)} min)`)

    const url = `https://www.youtube.com/watch?v=${videoId}`

    // Download audio only
    await youtubeDl(url, {
      extractAudio: true,
      audioFormat: format,
      audioQuality: options?.quality === 'best' ? 0 : options?.quality === 'worst' ? 9 : 5,
      output: outputPath,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      // Prevent downloading video
      format: 'bestaudio/best'
    })

    // Verify download
    const stats = await fs.stat(outputPath)
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty')
    }

    console.log(`[YouTubeDownload] Download complete: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)

    return {
      success: true,
      video_id: videoId,
      title: info.title,
      audio_path: outputPath,
      duration_seconds: info.duration_seconds,
      file_size_bytes: stats.size
    }
  } catch (error) {
    console.error(`[YouTubeDownload] Error downloading ${videoId}:`, error)

    // Clean up partial download
    try {
      await fs.unlink(outputPath)
    } catch {
      // File might not exist
    }

    return {
      success: false,
      video_id: videoId,
      title: '',
      audio_path: '',
      duration_seconds: 0,
      file_size_bytes: 0,
      error: String(error)
    }
  }
}

/**
 * Download multiple videos with concurrency control
 */
export async function downloadMultipleAudios(
  videoUrlsOrIds: string[],
  options?: DownloadOptions & { concurrency?: number }
): Promise<DownloadResult[]> {
  const concurrency = options?.concurrency || 3
  const results: DownloadResult[] = []
  const queue = [...videoUrlsOrIds]

  console.log(`[YouTubeDownload] Downloading ${queue.length} videos with concurrency ${concurrency}`)

  // Process in batches
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency)
    const batchResults = await Promise.all(
      batch.map(urlOrId => downloadYouTubeAudio(urlOrId, options))
    )
    results.push(...batchResults)

    const successful = batchResults.filter(r => r.success).length
    console.log(`[YouTubeDownload] Batch complete: ${successful}/${batch.length} successful`)
  }

  const totalSuccess = results.filter(r => r.success).length
  console.log(`[YouTubeDownload] All downloads complete: ${totalSuccess}/${results.length} successful`)

  return results
}

/**
 * Clean up old audio files (older than specified days)
 */
export async function cleanupOldAudio(
  outputDir?: string,
  olderThanDays: number = 7
): Promise<number> {
  const dir = outputDir || DEFAULT_OUTPUT_DIR
  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
  let deletedCount = 0

  try {
    const files = await fs.readdir(dir)

    for (const file of files) {
      if (file === '.gitkeep') continue

      const filePath = path.join(dir, file)
      const stats = await fs.stat(filePath)

      if (stats.mtimeMs < cutoffTime) {
        await fs.unlink(filePath)
        deletedCount++
        console.log(`[YouTubeDownload] Deleted old audio: ${file}`)
      }
    }
  } catch (error) {
    console.error('[YouTubeDownload] Error cleaning up old audio:', error)
  }

  return deletedCount
}

/**
 * Check if yt-dlp is available
 */
export async function isYtDlpAvailable(): Promise<boolean> {
  try {
    const result = await youtubeDl.exec('--version')
    console.log('[YouTubeDownload] yt-dlp version:', result.stdout)
    return true
  } catch (error) {
    console.error('[YouTubeDownload] yt-dlp not available:', error)
    return false
  }
}
