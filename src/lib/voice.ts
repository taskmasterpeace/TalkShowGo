/**
 * Chatterbox Voice Integration
 *
 * Uses Presidium AI's Chatterbox server for text-to-speech and voice cloning.
 * Each host can have their own cloned voice.
 */

const CHATTERBOX_URL = process.env.CHATTERBOX_URL || 'https://voice.machinekinglabs.com'

export interface Voice {
  id: string
  name: string
  language: string
  preview_url?: string
}

export interface SpeechOptions {
  voice?: string
  speed?: number // 0.5 to 2.0
  pitch?: number // 0.5 to 2.0
  language?: string
}

export interface VoiceCloneOptions {
  voice_name: string
  language?: string
  description?: string
}

/**
 * Check if Chatterbox is available
 */
export async function checkVoiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${CHATTERBOX_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * List all available voices (including cloned ones)
 */
export async function listVoices(): Promise<Voice[]> {
  try {
    const response = await fetch(`${CHATTERBOX_URL}/v1/voices`)
    if (!response.ok) {
      throw new Error('Failed to fetch voices')
    }
    const data = await response.json()
    return data.voices || data || []
  } catch (error) {
    console.error('Error listing voices:', error)
    return []
  }
}

/**
 * List supported languages
 */
export async function listLanguages(): Promise<string[]> {
  try {
    const response = await fetch(`${CHATTERBOX_URL}/languages`)
    if (!response.ok) {
      return ['en'] // Default to English
    }
    const data = await response.json()
    return data.languages || data || ['en']
  } catch {
    return ['en']
  }
}

/**
 * Generate speech from text
 * Returns audio as a Blob (MP3)
 */
export async function generateSpeech(
  text: string,
  options: SpeechOptions = {}
): Promise<Blob> {
  const response = await fetch(`${CHATTERBOX_URL}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: options.voice || 'default',
      speed: options.speed || 1.0,
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Speech generation failed: ${error}`)
  }

  return response.blob()
}

/**
 * Generate speech and return as a data URL for immediate playback
 */
export async function generateSpeechUrl(
  text: string,
  options: SpeechOptions = {}
): Promise<string> {
  const blob = await generateSpeech(text, options)
  return URL.createObjectURL(blob)
}

/**
 * Stream speech generation (for longer texts)
 */
export async function streamSpeech(
  text: string,
  options: SpeechOptions = {},
  onChunk: (chunk: Uint8Array) => void
): Promise<void> {
  const response = await fetch(`${CHATTERBOX_URL}/v1/audio/speech/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: options.voice || 'default',
      speed: options.speed || 1.0,
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error('Stream speech failed')
  }

  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) onChunk(value)
  }
}

/**
 * Clone a voice from an audio file
 * Requires 10-30 seconds of clear speech
 */
export async function cloneVoice(
  audioFile: File | Blob,
  options: VoiceCloneOptions
): Promise<Voice> {
  const formData = new FormData()
  formData.append('file', audioFile)
  formData.append('voice_name', options.voice_name)
  if (options.language) formData.append('language', options.language)
  if (options.description) formData.append('description', options.description)

  const response = await fetch(`${CHATTERBOX_URL}/v1/voices`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voice cloning failed: ${error}`)
  }

  return response.json()
}

/**
 * Delete a cloned voice
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  const response = await fetch(`${CHATTERBOX_URL}/v1/voices/${voiceId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('Failed to delete voice')
  }
}

/**
 * Generate a voice preview (short sample)
 */
export async function generateVoicePreview(
  voiceId: string,
  sampleText?: string
): Promise<string> {
  const text = sampleText || "Hello! This is a preview of my voice. I'm ready to narrate your stories."
  return generateSpeechUrl(text, { voice: voiceId })
}

// ============================================
// HOST VOICE INTEGRATION
// ============================================

/**
 * Voice configuration for a host
 */
export interface HostVoiceConfig {
  voice_id: string
  voice_name: string
  speed: number
  pitch?: number
  style_tags?: string[] // e.g., ['energetic', 'dramatic']
}

/**
 * Default voice styles for different host archetypes
 */
export const VOICE_STYLE_PRESETS: Record<string, Partial<SpeechOptions>> = {
  investigator: { speed: 0.9 }, // Slower, methodical
  hot_take: { speed: 1.1 }, // Faster, energetic
  satirist: { speed: 1.0 }, // Normal with pauses
  unfiltered: { speed: 1.15 }, // Fast and punchy
  narrator: { speed: 0.85 }, // Slow, dramatic
  hype: { speed: 1.3 }, // Very fast
  analyst: { speed: 0.95 }, // Measured
}

/**
 * Generate speech for a host with their configured voice
 */
export async function generateHostSpeech(
  text: string,
  hostVoiceConfig: HostVoiceConfig
): Promise<Blob> {
  return generateSpeech(text, {
    voice: hostVoiceConfig.voice_id,
    speed: hostVoiceConfig.speed,
  })
}

/**
 * Narrate a script with a host's voice
 * Splits into segments for natural pacing
 */
export async function narrateScript(
  script: string,
  hostVoiceConfig: HostVoiceConfig,
  onSegment?: (audioUrl: string, segmentIndex: number) => void
): Promise<string[]> {
  // Split script into segments (by paragraph or sentence)
  const segments = script
    .split(/\n\n+/)
    .filter(s => s.trim())
    .flatMap(para => {
      // If paragraph is long, split by sentences
      if (para.length > 500) {
        return para.match(/[^.!?]+[.!?]+/g) || [para]
      }
      return [para]
    })

  const audioUrls: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim()
    if (!segment) continue

    const audioUrl = await generateSpeechUrl(segment, {
      voice: hostVoiceConfig.voice_id,
      speed: hostVoiceConfig.speed,
    })

    audioUrls.push(audioUrl)

    if (onSegment) {
      onSegment(audioUrl, i)
    }
  }

  return audioUrls
}

// ============================================
// AUDIO UTILITIES
// ============================================

/**
 * Create an audio player for generated speech
 */
export function createAudioPlayer(audioUrl: string): HTMLAudioElement {
  const audio = new Audio(audioUrl)
  return audio
}

/**
 * Play audio and return a promise that resolves when done
 */
export function playAudio(audioUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl)
    audio.onended = () => resolve()
    audio.onerror = (e) => reject(e)
    audio.play()
  })
}

/**
 * Play multiple audio segments in sequence
 */
export async function playAudioSequence(
  audioUrls: string[],
  onSegmentStart?: (index: number) => void
): Promise<void> {
  for (let i = 0; i < audioUrls.length; i++) {
    if (onSegmentStart) onSegmentStart(i)
    await playAudio(audioUrls[i])
  }
}

/**
 * Download audio as a file
 */
export function downloadAudio(blob: Blob, filename: string = 'speech.mp3'): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
