/**
 * ElevenLabs Voice Integration
 *
 * Uses ElevenLabs API for high-quality text-to-speech.
 * Set ELEVENLABS_API_KEY in your .env file.
 */

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  description?: string
  preview_url?: string
  labels?: Record<string, string>
}

export interface ElevenLabsSettings {
  stability: number // 0-1
  similarity_boost: number // 0-1
  style?: number // 0-1
  use_speaker_boost?: boolean
}

export interface TTSOptions {
  voice_id: string
  model_id?: string // 'eleven_monolingual_v1', 'eleven_multilingual_v2', 'eleven_turbo_v2_5'
  voice_settings?: ElevenLabsSettings
}

const DEFAULT_SETTINGS: ElevenLabsSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set')
  }
  return key
}

/**
 * Check if ElevenLabs is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY
}

/**
 * List all available voices
 */
export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      'xi-api-key': getApiKey(),
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.statusText}`)
  }

  const data = await response.json()
  return data.voices || []
}

/**
 * Get a specific voice by ID
 */
export async function getVoice(voiceId: string): Promise<ElevenLabsVoice | null> {
  const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
    headers: {
      'xi-api-key': getApiKey(),
    },
  })

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Failed to fetch voice: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Generate speech from text
 * Returns audio as ArrayBuffer (MP3)
 */
export async function generateSpeech(
  text: string,
  options: TTSOptions
): Promise<ArrayBuffer> {
  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${options.voice_id}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: options.model_id || 'eleven_monolingual_v1',
        voice_settings: options.voice_settings || DEFAULT_SETTINGS,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Speech generation failed: ${error}`)
  }

  return response.arrayBuffer()
}

/**
 * Generate speech and return as a Blob
 */
export async function generateSpeechBlob(
  text: string,
  options: TTSOptions
): Promise<Blob> {
  const buffer = await generateSpeech(text, options)
  return new Blob([buffer], { type: 'audio/mpeg' })
}

/**
 * Generate speech and return as a data URL for playback
 */
export async function generateSpeechUrl(
  text: string,
  options: TTSOptions
): Promise<string> {
  const blob = await generateSpeechBlob(text, options)
  return URL.createObjectURL(blob)
}

/**
 * Stream speech generation (for longer texts)
 */
export async function streamSpeech(
  text: string,
  options: TTSOptions,
  onChunk: (chunk: Uint8Array) => void
): Promise<void> {
  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${options.voice_id}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: options.model_id || 'eleven_monolingual_v1',
        voice_settings: options.voice_settings || DEFAULT_SETTINGS,
      }),
    }
  )

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
 * Get user subscription info (to check quota)
 */
export async function getSubscriptionInfo(): Promise<{
  character_count: number
  character_limit: number
  can_extend_character_limit: boolean
  allowed_to_extend_character_limit: boolean
  next_character_count_reset_unix: number
  voice_limit: number
  professional_voice_limit: number
}> {
  const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
    headers: {
      'xi-api-key': getApiKey(),
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch subscription: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get usage history
 */
export async function getUsageHistory(): Promise<{
  usage: Array<{
    character_count: number
    date_unix: number
  }>
}> {
  const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
    headers: {
      'xi-api-key': getApiKey(),
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch usage: ${response.statusText}`)
  }

  return response.json()
}

// ============================================
// HOST VOICE INTEGRATION
// ============================================

export interface HostElevenLabsConfig {
  voice_id: string
  voice_name: string
  model_id?: string
  stability?: number
  similarity_boost?: number
  style?: number
}

/**
 * Voice presets for different host archetypes
 */
export const VOICE_PRESETS: Record<string, Partial<ElevenLabsSettings>> = {
  investigator: { stability: 0.7, similarity_boost: 0.8, style: 0.2 },
  hot_take: { stability: 0.3, similarity_boost: 0.9, style: 0.7 },
  satirist: { stability: 0.5, similarity_boost: 0.75, style: 0.5 },
  unfiltered: { stability: 0.25, similarity_boost: 0.85, style: 0.8 },
  narrator: { stability: 0.8, similarity_boost: 0.7, style: 0.1 },
  hype: { stability: 0.2, similarity_boost: 0.9, style: 0.9 },
  analyst: { stability: 0.65, similarity_boost: 0.75, style: 0.3 },
  documentary: { stability: 0.75, similarity_boost: 0.8, style: 0.15 },
}

/**
 * Generate speech for a host with their configured voice
 */
export async function generateHostSpeech(
  text: string,
  config: HostElevenLabsConfig
): Promise<Blob> {
  return generateSpeechBlob(text, {
    voice_id: config.voice_id,
    model_id: config.model_id,
    voice_settings: {
      stability: config.stability ?? 0.5,
      similarity_boost: config.similarity_boost ?? 0.75,
      style: config.style ?? 0.0,
      use_speaker_boost: true,
    },
  })
}

/**
 * Narrate a full script with a host's voice
 */
export async function narrateScript(
  script: string,
  config: HostElevenLabsConfig,
  onProgress?: (percent: number, audioUrl: string) => void
): Promise<string[]> {
  // Split script into manageable chunks (ElevenLabs has a 5000 char limit per request)
  const MAX_CHUNK_SIZE = 4500
  const chunks: string[] = []

  const paragraphs = script.split(/\n\n+/).filter(p => p.trim())

  let currentChunk = ''
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > MAX_CHUNK_SIZE) {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = para
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())

  const audioUrls: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const audioUrl = await generateSpeechUrl(chunks[i], {
      voice_id: config.voice_id,
      model_id: config.model_id,
      voice_settings: {
        stability: config.stability ?? 0.5,
        similarity_boost: config.similarity_boost ?? 0.75,
        style: config.style ?? 0.0,
        use_speaker_boost: true,
      },
    })

    audioUrls.push(audioUrl)

    if (onProgress) {
      onProgress(((i + 1) / chunks.length) * 100, audioUrl)
    }
  }

  return audioUrls
}

// ============================================
// MULTI-VOICE SUPPORT
// ============================================

export interface VoiceConfig {
  voiceId: string
  name: string
  hostId?: string  // Link to host personality
  settings: ElevenLabsSettings
}

export interface AudioSegment {
  id: string
  hostId: string
  voiceConfig: VoiceConfig
  text: string
  audio?: ArrayBuffer
  audioUrl?: string
  status: 'pending' | 'generating' | 'complete' | 'error'
  error?: string
  durationSeconds?: number
}

/**
 * Map host personalities to ElevenLabs voices
 */
export const HOST_VOICE_MAP: Record<string, VoiceConfig> = {
  // Default voice for all hosts (can be overridden per-host)
  'james_noble': {
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9',  // Battlerap Algorithm
    name: 'Battlerap Algorithm',
    hostId: 'james_noble',
    settings: { stability: 0.75, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
  },
  'maya_sterling': {
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9',
    name: 'Battlerap Algorithm',
    hostId: 'maya_sterling',
    settings: { stability: 0.7, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
  },
  'marcus_blaze': {
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9',
    name: 'Battlerap Algorithm',
    hostId: 'marcus_blaze',
    settings: { stability: 0.3, similarity_boost: 0.9, style: 0.7, use_speaker_boost: true },
  },
  'devon_sharp': {
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9',
    name: 'Battlerap Algorithm',
    hostId: 'devon_sharp',
    settings: { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true },
  },
  'tasha_raw': {
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9',
    name: 'Battlerap Algorithm',
    hostId: 'tasha_raw',
    settings: { stability: 0.25, similarity_boost: 0.85, style: 0.8, use_speaker_boost: true },
  },
  'dj_momentum': {
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9',
    name: 'Battlerap Algorithm',
    hostId: 'dj_momentum',
    settings: { stability: 0.2, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
  },
  'king_knowledge': {
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'ZJ7BlVZrxZKBDMTIK5c9',
    name: 'Battlerap Algorithm',
    hostId: 'king_knowledge',
    settings: { stability: 0.65, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
  },
}

/**
 * Get voice configuration for a host
 */
export function getVoiceForHost(hostId: string): VoiceConfig {
  return HOST_VOICE_MAP[hostId] || HOST_VOICE_MAP['james_noble']  // Default to James Noble
}

/**
 * Generate audio for a single segment
 */
export async function generateSegmentAudio(
  segment: AudioSegment,
  onProgress?: (segment: AudioSegment) => void
): Promise<AudioSegment> {
  try {
    segment.status = 'generating'
    onProgress?.(segment)

    const audio = await generateSpeech(segment.text, {
      voice_id: segment.voiceConfig.voiceId,
      voice_settings: segment.voiceConfig.settings,
    })

    segment.audio = audio
    segment.audioUrl = URL.createObjectURL(new Blob([audio], { type: 'audio/mpeg' }))
    segment.status = 'complete'
    // Rough estimate: 150 words per minute, average 5 chars per word
    segment.durationSeconds = Math.ceil((segment.text.length / 5) / 150 * 60)
    onProgress?.(segment)

    return segment
  } catch (error) {
    segment.status = 'error'
    segment.error = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.(segment)
    throw error
  }
}

/**
 * Generate audio for multiple segments (multi-voice show)
 */
export async function generateMultiVoiceAudio(
  segments: AudioSegment[],
  onSegmentProgress?: (segment: AudioSegment, index: number, total: number) => void
): Promise<AudioSegment[]> {
  const results: AudioSegment[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]

    try {
      const result = await generateSegmentAudio(segment, (seg) => {
        onSegmentProgress?.(seg, i, segments.length)
      })
      results.push(result)
    } catch (error) {
      console.error(`[MultiVoice] Segment ${i + 1} failed:`, error)
      results.push(segment)  // Push failed segment
    }
  }

  return results
}

/**
 * Concatenate multiple audio buffers into one
 * Note: This is a simple concatenation that works for MP3 files
 */
export async function concatenateAudioBuffers(
  buffers: ArrayBuffer[]
): Promise<ArrayBuffer> {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0)
  const result = new Uint8Array(totalLength)

  let offset = 0
  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset)
    offset += buffer.byteLength
  }

  return result.buffer
}

/**
 * Create a complete show from segments
 */
export async function createMultiVoiceShow(
  segments: Array<{ hostId: string; text: string; segmentId: string }>,
  onProgress?: (completed: number, total: number, currentSegment: string) => void
): Promise<{
  audioBuffer: ArrayBuffer
  segments: AudioSegment[]
  totalDuration: number
}> {
  // Create segment objects
  const audioSegments: AudioSegment[] = segments.map(seg => ({
    id: seg.segmentId,
    hostId: seg.hostId,
    voiceConfig: getVoiceForHost(seg.hostId),
    text: seg.text,
    status: 'pending' as const,
  }))

  // Generate audio for each segment
  const completedSegments = await generateMultiVoiceAudio(
    audioSegments,
    (segment, index, total) => {
      onProgress?.(index + 1, total, segment.id)
    }
  )

  // Get successful segments
  const successfulSegments = completedSegments.filter(s => s.status === 'complete' && s.audio)

  // Concatenate audio
  const audioBuffers = successfulSegments
    .map(s => s.audio!)
    .filter(Boolean)

  const combinedAudio = await concatenateAudioBuffers(audioBuffers)

  // Calculate total duration
  const totalDuration = successfulSegments.reduce(
    (sum, s) => sum + (s.durationSeconds || 0),
    0
  )

  return {
    audioBuffer: combinedAudio,
    segments: completedSegments,
    totalDuration,
  }
}

// ============================================
// ELEVEN V3 DIALOGUE API (MULTI-SPEAKER IN ONE CALL)
// ============================================

export interface DialogueLine {
  speaker: string
  text: string
  emotion?: string  // 'excited', 'laughs', 'serious', 'interrupting', 'thoughtful'
}

export interface DialogueSpeaker {
  name: string
  voice_id: string
}

export interface DialogueOptions {
  model_id?: string
  add_timestamps?: boolean
}

/**
 * Generate multi-speaker dialogue using Eleven v3
 * ONE API call for entire conversation with natural flow
 *
 * Uses speaker tags and emotion markers for natural dialogue:
 * <sarah>[excited] Good evening!</sarah>
 * <marcus>[laughs] Great to be here!</marcus>
 */
export async function generateDialogue(
  speakers: DialogueSpeaker[],
  dialogue: DialogueLine[],
  options?: DialogueOptions
): Promise<{
  audio: ArrayBuffer
  duration_seconds: number
}> {
  // Build dialogue text with speaker tags and emotions
  const dialogueText = dialogue
    .map(line => {
      const emotion = line.emotion ? `[${line.emotion}] ` : ''
      return `<${line.speaker}>${emotion}${line.text}</${line.speaker}>`
    })
    .join('\n')

  // Map speakers to voice IDs
  const speakerMap = speakers.reduce((map, s) => {
    map[s.name] = s.voice_id
    return map
  }, {} as Record<string, string>)

  console.log(`[ElevenLabs] Generating ${dialogue.length} dialogue lines with ${speakers.length} speakers`)

  const response = await fetch(
    `${ELEVENLABS_API_URL}/v1/text-to-speech/dialogue`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: dialogueText,
        model_id: options?.model_id || 'eleven_v3_alpha',
        speakers: speakerMap,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error(`[ElevenLabs] Dialogue generation failed:`, error)
    throw new Error(`Dialogue generation failed: ${error}`)
  }

  const audio = await response.arrayBuffer()

  // Estimate duration based on word count (150 words per minute)
  const wordCount = dialogue.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0)
  const duration_seconds = Math.ceil((wordCount / 150) * 60)

  console.log(`[ElevenLabs] Generated dialogue: ${wordCount} words, ~${duration_seconds}s duration`)

  return { audio, duration_seconds }
}

// ============================================
// POPULAR ELEVENLABS VOICES
// ============================================

/**
 * Some popular ElevenLabs voices for reference
 */
export const POPULAR_VOICES = {
  // Male voices
  adam: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', style: 'deep, narrative' },
  antoni: { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', style: 'young, energetic' },
  arnold: { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', style: 'crisp, articulate' },
  josh: { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', style: 'deep, narrative' },
  sam: { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', style: 'young, dynamic' },

  // Female voices
  rachel: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', style: 'calm, professional' },
  domi: { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', style: 'strong, confident' },
  bella: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', style: 'soft, warm' },
  elli: { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', style: 'young, expressive' },

  // Character voices
  clyde: { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde', style: 'war veteran, gruff' },
  dave: { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave', style: 'british, conversational' },
  fin: { id: 'D38z5RcWu1voky8WS1ja', name: 'Fin', style: 'irish, sailor' },
  glinda: { id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda', style: 'witch, theatrical' },
}
