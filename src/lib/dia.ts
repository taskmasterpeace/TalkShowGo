/**
 * Dia Multi-Voice TTS Client
 *
 * Features:
 * - [S1]/[S2] speaker tags for multi-voice dialogue
 * - Emotional markers: (laughs), (chuckle), (whispers), (sighs), etc.
 * - Consistent voices via seed parameter
 * - Real-time generation (~2x faster than realtime)
 *
 * Example:
 * ```typescript
 * const audio = await generateDialogue({
 *   segments: [
 *     { speaker: 1, text: "Hey there! (laughs) This is incredible!" },
 *     { speaker: 2, text: "I know right? (whispers) This changes everything." }
 *   ],
 *   seed: 42  // Same seed = same voices
 * })
 * ```
 */

const DIA_URL = process.env.DIA_URL || 'http://localhost:8765'

export interface DialogueSegment {
  speaker: 1 | 2
  text: string
}

export interface DiaGenerateRequest {
  text: string
  max_new_tokens?: number
  guidance_scale?: number
  temperature?: number
  output_format?: 'mp3' | 'wav'
  seed?: number
}

export interface DiaHealthResponse {
  status: string
  model: string
  device: string
  supports_multi_voice: boolean
  supported_emotions: string[]
}

/**
 * Generate multi-voice dialogue from segments
 *
 * Automatically formats with [S1]/[S2] tags and alternates speakers
 */
export async function generateDialogue(options: {
  segments: DialogueSegment[]
  seed?: number
  temperature?: number
  guidance_scale?: number
  max_new_tokens?: number
}): Promise<Buffer> {
  const { segments, seed, temperature, guidance_scale, max_new_tokens } = options

  // Validate segments
  if (segments.length === 0) {
    throw new Error('At least one segment required')
  }

  // Format text with speaker tags
  let formattedText = ''
  let lastSpeaker: 1 | 2 | null = null

  for (const segment of segments) {
    // Validate no consecutive speakers
    if (lastSpeaker === segment.speaker) {
      throw new Error(
        `Cannot have consecutive segments from same speaker. ` +
        `Speaker ${segment.speaker} appears twice in a row. ` +
        `Dia requires alternating [S1] and [S2] tags.`
      )
    }

    formattedText += `[S${segment.speaker}] ${segment.text.trim()} `
    lastSpeaker = segment.speaker
  }

  // Generate audio
  return await generateSpeech({
    text: formattedText.trim(),
    seed,
    temperature,
    guidance_scale,
    max_new_tokens,
    output_format: 'mp3'
  })
}

/**
 * Generate speech from pre-formatted text with [S1]/[S2] tags
 */
export async function generateSpeech(request: DiaGenerateRequest): Promise<Buffer> {
  // Validate text starts with [S1]
  if (!request.text.trim().startsWith('[S1]')) {
    throw new Error('Text must start with [S1] speaker tag')
  }

  console.log(`[Dia] Generating audio: ${request.text.length} chars`)

  const response = await fetch(`${DIA_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: request.text,
      max_new_tokens: request.max_new_tokens || 3072,
      guidance_scale: request.guidance_scale || 3.0,
      temperature: request.temperature || 1.8,
      output_format: request.output_format || 'mp3',
      seed: request.seed
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Dia API error: ${response.status} - ${error}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Check if Dia service is available
 */
export async function checkHealth(): Promise<DiaHealthResponse> {
  const response = await fetch(`${DIA_URL}/health`)

  if (!response.ok) {
    throw new Error(`Dia health check failed: ${response.status}`)
  }

  return await response.json()
}

/**
 * Generate multiple audio segments with consistent voices
 *
 * All segments use the same seed for voice consistency
 */
export async function generateBatch(
  segments: DialogueSegment[],
  seed?: number
): Promise<Buffer[]> {
  // Group consecutive segments by speaker into single API calls
  const batches: string[] = []
  let currentBatch = ''
  let lastSpeaker: 1 | 2 | null = null

  for (const segment of segments) {
    if (lastSpeaker === segment.speaker) {
      // Same speaker - add to current batch with space
      currentBatch += ` ${segment.text.trim()}`
    } else {
      // Different speaker - start new batch
      if (currentBatch) {
        batches.push(currentBatch)
      }
      currentBatch = `[S${segment.speaker}] ${segment.text.trim()}`
      lastSpeaker = segment.speaker
    }
  }

  // Push final batch
  if (currentBatch) {
    batches.push(currentBatch)
  }

  // Generate all batches with same seed
  const audioBuffers: Buffer[] = []
  for (const text of batches) {
    const buffer = await generateSpeech({
      text,
      seed,
      output_format: 'mp3'
    })
    audioBuffers.push(buffer)
  }

  return audioBuffers
}

/**
 * Helper: Format emotional tags
 */
export const Emotion = {
  laughs: '(laughs)',
  chuckle: '(chuckle)',
  whispers: '(whispers)',
  sighs: '(sighs)',
  gasps: '(gasps)',
  coughs: '(coughs)',
  groans: '(groans)',
  claps: '(claps)',
  screams: '(screams)',
  inhales: '(inhales)',
  exhales: '(exhales)',
  applause: '(applause)',
  burps: '(burps)',
  humming: '(humming)',
  sneezes: '(sneezes)',
  whistles: '(whistles)'
} as const

/**
 * Check if Dia is configured
 */
export function isDiaConfigured(): boolean {
  return !!DIA_URL
}
