/**
 * Multi-Host Audio Generation
 *
 * Generates audio for multi-host conversations using ElevenLabs.
 * Each host gets their own voice, turns are generated separately and combined.
 */

import { textToSpeech, combineAudioSegments } from '../elevenlabs'
import { createClient } from '@supabase/supabase-js'
import type { ConversationTurn, DebateHost } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface AudioSegment {
  audio_url: string
  duration_ms: number
  speaker_name: string
  turn_number: number
}

/**
 * Generate audio for complete show
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
  console.log(`[Audio] Generating audio for ${conversations.length} turns`)

  // Update status
  await supabase
    .from('debate_show_runs')
    .update({ status: 'audio_generating' })
    .eq('id', showRunId)

  const segments: AudioSegment[] = []
  let totalCharacters = 0

  // Generate audio for each turn
  for (const turn of conversations) {
    const host = hosts.find(h => h.id === turn.speaker_id)
    if (!host) {
      console.warn(`[Audio] Host not found for turn ${turn.turn_number}`)
      continue
    }

    console.log(`[Audio] Turn ${turn.turn_number}: ${host.name}`)

    // Generate audio with host's voice
    const audioResult = await textToSpeech({
      text: turn.text,
      voice_id: host.elevenlabs_voice_id || 'default',
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: host.voice_settings?.stability || 0.5,
        similarity_boost: host.voice_settings?.similarity_boost || 0.75,
        style: host.voice_settings?.style || 'conversational' as any
      }
    })

    segments.push({
      audio_url: audioResult.audio_url,
      duration_ms: audioResult.duration_ms,
      speaker_name: host.name,
      turn_number: turn.turn_number
    })

    totalCharacters += turn.text.length

    // Update turn with audio metadata
    await supabase
      .from('conversation_turns')
      .update({
        audio_start_ms: segments.reduce((sum, s) => sum + s.duration_ms, 0) - audioResult.duration_ms,
        audio_end_ms: segments.reduce((sum, s) => sum + s.duration_ms, 0)
      })
      .eq('show_run_id', showRunId)
      .eq('turn_number', turn.turn_number)
  }

  console.log(`[Audio] Generated ${segments.length} segments`)

  // Combine all segments into one audio file
  const combinedAudio = await combineAudioSegments(segments.map(s => s.audio_url))

  const totalDuration = segments.reduce((sum, s) => sum + s.duration_ms, 0) / 1000

  // Calculate cost (ElevenLabs pricing: ~$0.30 per 1000 characters)
  const costUsd = (totalCharacters / 1000) * 0.30

  // Update show run with audio
  await supabase
    .from('debate_show_runs')
    .update({
      audio_url: combinedAudio.audio_url,
      audio_duration_seconds: Math.round(totalDuration),
      status: 'completed',
      cost_breakdown: {
        audio: costUsd
      }
    })
    .eq('id', showRunId)

  console.log(`[Audio] Complete! Duration: ${totalDuration}s, Cost: $${costUsd.toFixed(2)}`)

  return {
    audio_url: combinedAudio.audio_url,
    duration_seconds: Math.round(totalDuration),
    cost_usd: costUsd
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
  console.log(`[Audio] Generating preview for turn: ${turn.text.substring(0, 50)}...`)

  const result = await textToSpeech({
    text: turn.text,
    voice_id: host.elevenlabs_voice_id || 'default',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: host.voice_settings?.stability || 0.5,
      similarity_boost: host.voice_settings?.similarity_boost || 0.75,
      style: host.voice_settings?.style || 'conversational' as any
    }
  })

  return {
    audio_url: result.audio_url,
    duration_ms: result.duration_ms
  }
}
