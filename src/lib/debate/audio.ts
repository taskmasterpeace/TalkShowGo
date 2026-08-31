/**
 * Multi-Host Audio Generation
 *
 * Generates audio for multi-host conversations using DIA (Dia-1.6B-0626).
 * DIA supports multi-voice dialogue with [S1]/[S2] tags and emotional markers.
 */

import { generateDialogue, isDiaAvailable, type DialogueSegment } from '@/lib/dia'
import { supabase } from '@/lib/db'
import type { ConversationTurn, DebateHost } from './types'

interface AudioSegment {
  audio_url: string
  duration_ms: number
  speaker_name: string
  turn_number: number
}

/**
 * Generate audio for complete show using DIA multi-voice TTS
 */
export async function generateMultiHostAudio(
  showRunId: string,
  conversations: ConversationTurn[],
  hosts: DebateHost[]
): Promise<{
  audio_url: string
  duration_seconds: number
  cost_usd: number
}> {
  console.log(`[Audio] Generating audio for ${conversations.length} turns with DIA`)
  console.log(`[Audio] ${hosts.length} hosts detected`)

  // Check DIA availability
  if (!await isDiaAvailable()) {
    throw new Error('DIA voice service not available. Is it running on localhost:8765?')
  }

  // Update status
  await supabase
    .from('debate_show_runs')
    .update({ status: 'audio_generating' })
    .eq('id', showRunId)

  // Map hosts to speaker numbers (S1, S2, etc.)
  const hostToSpeaker = new Map<string, number>()
  hosts.forEach((host, index) => {
    hostToSpeaker.set(host.id, index + 1)
  })

  // Convert ConversationTurn[] to DIA DialogueSegment[]
  const dialogueSegments: DialogueSegment[] = conversations.map(turn => {
    const speakerNum = hostToSpeaker.get(turn.speaker_id) || 1
    const host = hosts.find(h => h.id === turn.speaker_id)!

    // Add emotional markers based on host personality
    let text = turn.text

    // High aggression → add emphasis
    if (host.aggression > 70) {
      text = addEmotionalMarker(text, 'emphasis')
    }

    // High humor → add laughs occasionally
    if (host.humor > 70 && Math.random() > 0.7) {
      text = addEmotionalMarker(text, 'laugh')
    }

    // Analytical depth → thoughtful pauses
    if (host.analytical_depth > 70) {
      text = addEmotionalMarker(text, 'pause')
    }

    return {
      speaker: speakerNum as 1 | 2,
      text: text.trim()
    }
  })

  console.log(`[Audio] Generated ${dialogueSegments.length} dialogue segments`)

  // DIA supports 2 speakers natively, for 3+ hosts we need to split
  let audioBuffer: Buffer

  if (hosts.length <= 2) {
    // Perfect! Generate entire conversation in one go
    console.log(`[Audio] Generating 2-speaker dialogue with DIA (single generation)`)
    audioBuffer = await generateDialogue({
      segments: dialogueSegments,
      seed: 42, // Consistent voices
      temperature: 0.8,
      guidance_scale: 3.0
    })
  } else {
    // 3+ hosts: Need to generate with different seeds to create distinct voices
    console.log(`[Audio] ${hosts.length} speakers detected - generating with multiple seeds`)

    // Group segments by pairs (S1 vs S2, S1 vs S3, etc.)
    // This is a simplified approach - for production, might want smarter grouping
    const chunks: Buffer[] = []

    for (let i = 0; i < dialogueSegments.length; i += 10) {
      const chunk = dialogueSegments.slice(i, i + 10)

      // Remap speakers to S1/S2 for this chunk
      const remappedChunk = chunk.map(seg => {
        // Use modulo to map any speaker to S1 or S2
        const remappedSpeaker = (((seg.speaker - 1) % 2) + 1) as 1 | 2
        return {
          speaker: remappedSpeaker,
          text: seg.text
        }
      })

      const chunkAudio = await generateDialogue({
        segments: remappedChunk,
        seed: 42 + (i / 10), // Different seed per chunk for variety
        temperature: 0.8,
        guidance_scale: 3.0
      })

      chunks.push(chunkAudio)
    }

    // Combine chunks (simple concatenation for now)
    audioBuffer = Buffer.concat(chunks)
  }

  // Estimate duration (DIA is ~2x realtime, so chars/200 words per min)
  const totalChars = conversations.reduce((sum, t) => sum + t.text.length, 0)
  const estimatedDurationSeconds = Math.ceil(totalChars / 15) // ~15 chars per second of speech

  console.log(`[Audio] Generated audio: ${audioBuffer.length} bytes, ~${estimatedDurationSeconds}s`)

  // Save audio to Supabase storage
  const audioFileName = `debate-${showRunId}.mp3`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('audio')
    .upload(audioFileName, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true
    })

  if (uploadError) {
    console.error('[Audio] Upload failed:', uploadError)
    throw new Error(`Failed to upload audio: ${uploadError.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('audio')
    .getPublicUrl(audioFileName)

  const audioUrl = urlData.publicUrl

  // Update show run with audio (DIA is FREE!)
  await supabase
    .from('debate_show_runs')
    .update({
      audio_url: audioUrl,
      audio_duration_seconds: estimatedDurationSeconds,
      status: 'completed',
      cost_breakdown: {
        audio: 0.0 // DIA is free!
      }
    })
    .eq('id', showRunId)

  console.log(`[Audio] Complete! Duration: ~${estimatedDurationSeconds}s, Cost: $0.00 (DIA)`)

  return {
    audio_url: audioUrl,
    duration_seconds: estimatedDurationSeconds,
    cost_usd: 0.0 // Free!
  }
}

/**
 * Generate audio for a single turn (for testing/preview)
 */
export async function generateTurnAudio(
  turn: ConversationTurn,
  host: DebateHost
): Promise<{
  audio_url: string
  duration_ms: number
}> {
  console.log(`[Audio] Generating preview for turn with DIA: ${turn.text.substring(0, 50)}...`)

  // Check DIA availability
  if (!await isDiaAvailable()) {
    throw new Error('DIA voice service not available')
  }

  // Add emotional markers based on host personality
  let text = turn.text
  if (host.aggression > 70) {
    text = addEmotionalMarker(text, 'emphasis')
  }
  if (host.humor > 70 && Math.random() > 0.7) {
    text = addEmotionalMarker(text, 'laugh')
  }

  // Generate audio with DIA (single speaker)
  const audioBuffer = await generateDialogue({
    segments: [{ speaker: 1, text }],
    seed: 42,
    temperature: 0.8,
    guidance_scale: 3.0
  })

  // Estimate duration
  const durationMs = Math.ceil((text.length / 15) * 1000)

  // For preview, we'd need to return a temp URL or base64
  // Simplified: return buffer info
  return {
    audio_url: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`,
    duration_ms: durationMs
  }
}

/**
 * Add emotional markers to text based on DIA's supported markers
 * DIA markers: [laughs], [sighs], [gasps], [clears throat], [breath], [music], etc.
 */
function addEmotionalMarker(text: string, emotion: 'emphasis' | 'laugh' | 'pause'): string {
  switch (emotion) {
    case 'emphasis':
      // Add emphasis at strong punctuation
      return text.replace(/([.!?])/g, '$1 [breath]')

    case 'laugh':
      // Add laugh at end of sentence occasionally
      return text.replace(/\./g, '. [laughs]')

    case 'pause':
      // Add thoughtful pauses
      return text.replace(/,/g, ', ...')

    default:
      return text
  }
}
