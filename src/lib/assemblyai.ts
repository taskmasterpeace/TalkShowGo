/**
 * AssemblyAI Transcription Client
 *
 * Provides speech-to-text transcription with optional speaker diarization.
 * Used when YouTube captions are not available.
 */

import { AssemblyAI, TranscriptUtterance } from 'assemblyai'
import * as fs from 'fs/promises'
import * as path from 'path'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

export interface SpeakerSegment {
  speaker: string      // "A", "B", etc.
  start_ms: number
  end_ms: number
  text: string
}

export interface WordTimestamp {
  text: string
  start_ms: number
  end_ms: number
  confidence: number
}

export interface TranscriptionResult {
  success: boolean
  transcript_id?: string
  transcript_text: string
  confidence: number
  duration_seconds: number
  speakers?: SpeakerSegment[]
  words?: WordTimestamp[]
  error?: string
}

export interface TranscriptionOptions {
  speaker_labels?: boolean  // Enable speaker diarization
  language_code?: string    // Default 'en'
  word_boost?: string[]     // Words to boost recognition for
  punctuate?: boolean       // Add punctuation
  format_text?: boolean     // Format text (capitalization, etc.)
}

let client: AssemblyAI | null = null

/**
 * Get or create AssemblyAI client
 */
function getClient(): AssemblyAI {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured')
  }

  if (!client) {
    client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY
    })
  }

  return client
}

/**
 * Check if AssemblyAI is configured
 */
export function isAssemblyAIConfigured(): boolean {
  return !!ASSEMBLYAI_API_KEY
}

/**
 * Transcribe audio from a local file
 */
export async function transcribeAudio(
  audioPath: string,
  options?: TranscriptionOptions
): Promise<TranscriptionResult> {
  console.log(`[AssemblyAI] Transcribing audio: ${audioPath}`)

  if (!isAssemblyAIConfigured()) {
    return {
      success: false,
      transcript_text: '',
      confidence: 0,
      duration_seconds: 0,
      error: 'AssemblyAI API key not configured'
    }
  }

  try {
    // Verify file exists
    const stats = await fs.stat(audioPath)
    if (stats.size === 0) {
      throw new Error('Audio file is empty')
    }

    console.log(`[AssemblyAI] Audio file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)

    const client = getClient()

    // Read file as buffer and upload
    const audioData = await fs.readFile(audioPath)

    console.log('[AssemblyAI] Uploading audio file...')
    const uploadUrl = await client.files.upload(audioData)
    console.log('[AssemblyAI] Upload complete, starting transcription...')

    // Start transcription
    const transcript = await client.transcripts.transcribe({
      audio: uploadUrl,
      speaker_labels: options?.speaker_labels ?? true,
      language_code: options?.language_code || 'en',
      word_boost: options?.word_boost,
      punctuate: options?.punctuate ?? true,
      format_text: options?.format_text ?? true
    })

    if (transcript.status === 'error') {
      throw new Error(transcript.error || 'Transcription failed')
    }

    console.log(`[AssemblyAI] Transcription complete. Status: ${transcript.status}`)

    // Extract speaker segments if available
    let speakers: SpeakerSegment[] | undefined
    if (transcript.utterances && transcript.utterances.length > 0) {
      speakers = transcript.utterances.map((u: TranscriptUtterance) => ({
        speaker: u.speaker,
        start_ms: u.start,
        end_ms: u.end,
        text: u.text
      }))
      console.log(`[AssemblyAI] Found ${speakers.length} speaker segments`)
    }

    // Extract word timestamps if available
    let words: WordTimestamp[] | undefined
    if (transcript.words && transcript.words.length > 0) {
      words = transcript.words.map(w => ({
        text: w.text,
        start_ms: w.start,
        end_ms: w.end,
        confidence: w.confidence
      }))
    }

    // Calculate average confidence
    const avgConfidence = transcript.confidence || 0

    return {
      success: true,
      transcript_id: transcript.id,
      transcript_text: transcript.text || '',
      confidence: avgConfidence,
      duration_seconds: (transcript.audio_duration || 0),
      speakers,
      words
    }
  } catch (error) {
    console.error('[AssemblyAI] Transcription error:', error)
    return {
      success: false,
      transcript_text: '',
      confidence: 0,
      duration_seconds: 0,
      error: String(error)
    }
  }
}

/**
 * Transcribe audio from a URL
 */
export async function transcribeFromUrl(
  audioUrl: string,
  options?: TranscriptionOptions
): Promise<TranscriptionResult> {
  console.log(`[AssemblyAI] Transcribing from URL: ${audioUrl}`)

  if (!isAssemblyAIConfigured()) {
    return {
      success: false,
      transcript_text: '',
      confidence: 0,
      duration_seconds: 0,
      error: 'AssemblyAI API key not configured'
    }
  }

  try {
    const client = getClient()

    console.log('[AssemblyAI] Starting transcription from URL...')

    const transcript = await client.transcripts.transcribe({
      audio: audioUrl,
      speaker_labels: options?.speaker_labels ?? true,
      language_code: options?.language_code || 'en',
      word_boost: options?.word_boost,
      punctuate: options?.punctuate ?? true,
      format_text: options?.format_text ?? true
    })

    if (transcript.status === 'error') {
      throw new Error(transcript.error || 'Transcription failed')
    }

    console.log(`[AssemblyAI] Transcription complete. Status: ${transcript.status}`)

    // Extract speaker segments
    let speakers: SpeakerSegment[] | undefined
    if (transcript.utterances && transcript.utterances.length > 0) {
      speakers = transcript.utterances.map((u: TranscriptUtterance) => ({
        speaker: u.speaker,
        start_ms: u.start,
        end_ms: u.end,
        text: u.text
      }))
    }

    return {
      success: true,
      transcript_id: transcript.id,
      transcript_text: transcript.text || '',
      confidence: transcript.confidence || 0,
      duration_seconds: transcript.audio_duration || 0,
      speakers
    }
  } catch (error) {
    console.error('[AssemblyAI] Transcription error:', error)
    return {
      success: false,
      transcript_text: '',
      confidence: 0,
      duration_seconds: 0,
      error: String(error)
    }
  }
}

/**
 * Get the status of a transcription job
 */
export async function getTranscriptionStatus(transcriptId: string): Promise<{
  status: string
  error?: string
}> {
  if (!isAssemblyAIConfigured()) {
    return { status: 'error', error: 'AssemblyAI not configured' }
  }

  try {
    const client = getClient()
    const transcript = await client.transcripts.get(transcriptId)
    return {
      status: transcript.status,
      error: transcript.error || undefined
    }
  } catch (error) {
    return {
      status: 'error',
      error: String(error)
    }
  }
}

/**
 * Format speaker segments as readable text
 */
export function formatSpeakerTranscript(speakers: SpeakerSegment[]): string {
  if (!speakers || speakers.length === 0) {
    return ''
  }

  return speakers.map(segment => {
    const minutes = Math.floor(segment.start_ms / 60000)
    const seconds = Math.floor((segment.start_ms % 60000) / 1000)
    const timestamp = `[${minutes}:${seconds.toString().padStart(2, '0')}]`
    return `${timestamp} Speaker ${segment.speaker}: ${segment.text}`
  }).join('\n\n')
}

/**
 * Estimate transcription cost
 * AssemblyAI charges ~$0.006 per minute of audio
 */
export function estimateTranscriptionCost(durationSeconds: number): number {
  const COST_PER_MINUTE = 0.006
  const minutes = durationSeconds / 60
  return minutes * COST_PER_MINUTE
}
