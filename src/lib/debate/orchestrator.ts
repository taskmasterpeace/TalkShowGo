/**
 * Debate Orchestrator
 *
 * Generates multi-turn conversations with dynamic turn-taking based on:
 * - Host personalities
 * - Emotional beats (producer's intended arc)
 * - Conversation context
 * - Turn-taking rules (who should speak next?)
 */

import { callOpenRouter, selectModelForHost } from '../openrouter'
import type {
  DebateHost,
  ShowFormat,
  PreparationResult,
  ConversationTurn,
  EmotionalBeat
} from './types'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface DebateContext {
  format: ShowFormat
  hosts: DebateHost[]
  preparationResults: PreparationResult[]
  topic: string
  emotionalBeats?: EmotionalBeat[]
  targetDurationMinutes?: number
}

interface SelectionContext {
  turns: ConversationTurn[]
  hosts: DebateHost[]
  format: ShowFormat
  round: number
  totalTurnsPlanned: number
  emotionalBeats?: EmotionalBeat[]
}

/**
 * Main entry point: Generate complete debate conversation
 */
export async function generateDebateConversation(
  context: DebateContext
): Promise<ConversationTurn[]> {
  console.log(`[Orchestrator] Generating conversation for ${context.hosts.length} hosts`)
  console.log(`[Orchestrator] Topic: ${context.topic}`)

  const turns: ConversationTurn[] = []

  // Calculate target number of turns
  const targetDuration = context.targetDurationMinutes || context.format.target_duration_minutes || 10
  const avgTurnDuration = 0.5 // minutes per turn (2-4 sentences @ ~30 seconds)
  const maxRounds = Math.floor(targetDuration / avgTurnDuration)
  const turnsPerHost = Math.floor(maxRounds / context.hosts.length)

  console.log(`[Orchestrator] Target: ${targetDuration} min = ~${maxRounds} turns (~${turnsPerHost} per host)`)

  // Phase 1: Opening statements (each host states their stance)
  console.log(`[Orchestrator] Phase 1: Opening statements`)
  for (const host of context.hosts) {
    const prepResult = context.preparationResults.find(p => p.host_id === host.id)
    const opening = await generateOpeningStatement(host, prepResult!, context.topic)
    turns.push(opening)
  }

  // Phase 2: Main discussion (dynamic turn-taking)
  console.log(`[Orchestrator] Phase 2: Main discussion (${maxRounds - context.hosts.length * 2} turns)`)
  let currentRound = 0
  const mainDiscussionTurns = maxRounds - (context.hosts.length * 2) // Subtract openings + closings

  while (currentRound < mainDiscussionTurns) {
    const nextSpeaker = selectNextSpeaker({
      turns,
      hosts: context.hosts,
      format: context.format,
      round: currentRound,
      totalTurnsPlanned: maxRounds,
      emotionalBeats: context.emotionalBeats
    })

    const prepResult = context.preparationResults.find(p => p.host_id === nextSpeaker.id)
    const turn = await generateTurn({
      speaker: nextSpeaker,
      previousTurns: turns,
      preparationResult: prepResult!,
      topic: context.topic,
      turnNumber: turns.length + 1
    })

    turns.push(turn)
    currentRound++
  }

  // Phase 3: Closing statements
  console.log(`[Orchestrator] Phase 3: Closing statements`)
  for (const host of context.hosts) {
    const closing = await generateClosingStatement(host, turns, context.topic)
    turns.push(closing)
  }

  console.log(`[Orchestrator] Generated ${turns.length} total turns`)
  return turns
}

/**
 * Generate opening statement for a host
 */
async function generateOpeningStatement(
  host: DebateHost,
  prepResult: PreparationResult,
  topic: string
): Promise<ConversationTurn> {
  const model = selectModelForHost(host)

  const prompt = `${host.system_prompt}

TOPIC: ${topic}

YOUR STANCE (from preparation): ${prepResult.stance}

YOUR TALKING POINTS:
${prepResult.talking_points.join('\n')}

This is your OPENING STATEMENT. You're the first to speak (or one of the first).

State your position clearly in 2-3 sentences. Set the tone for your perspective.
Be true to your personality (opinion strength: ${host.opinion_strength}/100, aggression: ${host.aggression}/100).

Your opening:`

  const response = await callOpenRouter({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 200
  })

  console.log(`[Orchestrator] ${host.name} opening: "${response.content.substring(0, 50)}..."`)

  return {
    turn_number: 0, // Will be set by caller
    speaker_id: host.id,
    speaker_name: host.name,
    text: response.content.trim(),
    model_used: model,
    tokens_used: response.tokens,
    is_opening: true
  }
}

/**
 * Generate a turn in the main discussion
 */
interface TurnContext {
  speaker: DebateHost
  previousTurns: ConversationTurn[]
  preparationResult: PreparationResult
  topic: string
  turnNumber: number
}

async function generateTurn(context: TurnContext): Promise<ConversationTurn> {
  const model = selectModelForHost(context.speaker)

  // Build conversation history (last 5 turns for context)
  const recentTurns = context.previousTurns.slice(-5)
  const conversationHistory = recentTurns.map(t =>
    `${t.speaker_name}: ${t.text}`
  ).join('\n\n')

  const lastTurn = context.previousTurns[context.previousTurns.length - 1]

  const prompt = `${context.speaker.system_prompt}

TOPIC: ${context.topic}

YOUR STANCE: ${context.preparationResult.stance}

YOUR TALKING POINTS:
${context.preparationResult.talking_points.join('\n')}

CONVERSATION SO FAR:
${conversationHistory}

${lastTurn ? `\n${lastTurn.speaker_name} just said:\n"${lastTurn.text}"\n` : ''}

Generate your next response (2-4 sentences).
${lastTurn && lastTurn.speaker_id !== context.speaker.id ? 'Respond to what was just said.' : 'Make your next point.'}
Stay in character. Be natural.

Your response:`

  const response = await callOpenRouter({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8, // Slightly higher for variety
    max_tokens: 250
  })

  console.log(`[Orchestrator] Turn ${context.turnNumber}: ${context.speaker.name}`)

  return {
    turn_number: context.turnNumber,
    speaker_id: context.speaker.id,
    speaker_name: context.speaker.name,
    text: response.content.trim(),
    responding_to_turn_number: lastTurn?.turn_number,
    model_used: model,
    tokens_used: response.tokens
  }
}

/**
 * Generate closing statement
 */
async function generateClosingStatement(
  host: DebateHost,
  allTurns: ConversationTurn[],
  topic: string
): Promise<ConversationTurn> {
  const model = selectModelForHost(host)

  // Get host's own previous turns
  const myTurns = allTurns.filter(t => t.speaker_id === host.id)
  const myPoints = myTurns.slice(0, 3).map(t => t.text).join(' ')

  const prompt = `${host.system_prompt}

TOPIC: ${topic}

YOUR KEY POINTS DURING DISCUSSION:
${myPoints}

This is your CLOSING STATEMENT. Wrap up your position in 2-3 sentences.
Reinforce your main argument. Stay true to your character.

Your closing:`

  const response = await callOpenRouter({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 200
  })

  console.log(`[Orchestrator] ${host.name} closing: "${response.content.substring(0, 50)}..."`)

  return {
    turn_number: 0, // Will be set by caller
    speaker_id: host.id,
    speaker_name: host.name,
    text: response.content.trim(),
    model_used: model,
    tokens_used: response.tokens,
    is_closing: true
  }
}

/**
 * Select which host should speak next using scoring algorithm
 */
function selectNextSpeaker(context: SelectionContext): DebateHost {
  const lastTurn = context.turns[context.turns.length - 1]
  const scores: Map<string, number> = new Map()

  // Calculate current position in emotional arc (0-100)
  const progress = (context.turns.length / context.totalTurnsPlanned) * 100
  const currentBeat = getCurrentEmotionalBeat(context.emotionalBeats, progress)

  for (const host of context.hosts) {
    let score = 0

    // Rule 1: Haven't spoken recently (fairness)
    const turnsSinceSpoke = getTurnsSinceLastSpoke(host.id, context.turns)
    score += turnsSinceSpoke * 10

    // Rule 2: Likely to disagree with last point (creates tension)
    if (lastTurn && lastTurn.speaker_id !== host.id) {
      const disagreementLikelihood = calculateDisagreement(host, lastTurn)
      score += disagreementLikelihood * 15
    }

    // Rule 3: Balance aggressive vs calm (conversation dynamics)
    const aggressionBalance = calculateAggressionBalance(host, context.turns)
    score += aggressionBalance * 5

    // Rule 4: Matches current emotional beat (HIGHEST PRIORITY - producer intent)
    if (currentBeat) {
      const beatAlignment = calculateBeatAlignment(host, currentBeat)
      score += beatAlignment * 25 // Highest weight - respects producer's arc
    }

    scores.set(host.id, score)
  }

  // Select highest scoring host
  const winnerId = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])[0][0]

  const winner = context.hosts.find(h => h.id === winnerId)!

  console.log(`[Orchestrator] Next speaker: ${winner.name} (score breakdown logged)`)

  return winner
}

/**
 * Get current emotional beat based on progress through show
 */
function getCurrentEmotionalBeat(
  beats: EmotionalBeat[] | undefined,
  progress: number
): EmotionalBeat | null {
  if (!beats || beats.length === 0) return null

  // Find the beat we're currently in
  for (let i = beats.length - 1; i >= 0; i--) {
    if (progress >= beats[i].percent) {
      return beats[i]
    }
  }

  return beats[0] // Default to first beat
}

/**
 * Calculate how well a host aligns with the current emotional beat
 */
function calculateBeatAlignment(host: DebateHost, beat: EmotionalBeat): number {
  switch (beat.type) {
    case 'outrage':
      // High aggression + high opinion strength
      return (host.aggression + host.opinion_strength) / 2

    case 'investigation':
    case 'clarity':
      // High analytical depth + moderate empathy
      return (host.analytical_depth + host.empathy) / 2

    case 'revelation':
      // High analytical depth + low humor (serious delivery)
      return (host.analytical_depth + (100 - host.humor)) / 2

    case 'resolution':
      // High empathy + low aggression
      return (host.empathy + (100 - host.aggression)) / 2

    case 'tension':
      // High aggression + high opinion strength
      return (host.aggression + host.opinion_strength) / 2

    case 'custom':
      // Use host_preference hint if provided
      if (beat.host_preference === 'aggressive') {
        return host.aggression
      } else if (beat.host_preference === 'analytical') {
        return host.analytical_depth
      } else if (beat.host_preference === 'empathetic') {
        return host.empathy
      }
      return 50 // Neutral

    default:
      return 50 // Neutral
  }
}

/**
 * Calculate how long since this host last spoke
 */
function getTurnsSinceLastSpoke(hostId: string, turns: ConversationTurn[]): number {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].speaker_id === hostId) {
      return turns.length - 1 - i
    }
  }
  return turns.length // Never spoke
}

/**
 * Calculate likelihood this host would disagree with the last turn
 */
function calculateDisagreement(host: DebateHost, lastTurn: ConversationTurn): number {
  // Simple heuristic: High opinion strength = more likely to disagree
  // In reality, would analyze content similarity, but that requires embeddings

  // If host is aggressive and opinionated, likely to push back
  const baseDisagreement = (host.aggression + host.opinion_strength) / 2

  // Small random factor for variety
  const variance = Math.random() * 20 - 10 // -10 to +10

  return Math.max(0, Math.min(100, baseDisagreement + variance))
}

/**
 * Calculate aggression balance - prefer calmer hosts if recent turns were aggressive
 */
function calculateAggressionBalance(host: DebateHost, turns: ConversationTurn[]): number {
  // Get last 3 turns
  const recentTurns = turns.slice(-3)

  // Calculate average aggression of recent speakers
  let recentAggression = 50 // Default neutral

  // For now, use simple heuristic
  // In full implementation, would track aggression per turn

  // If this host is less aggressive than average, give bonus
  if (host.aggression < recentAggression) {
    return 100 - host.aggression // Reward calmness
  }

  return host.aggression // Neutral
}

/**
 * Save conversation to database
 */
export async function saveConversation(
  showRunId: string,
  turns: ConversationTurn[]
): Promise<void> {
  console.log(`[Orchestrator] Saving ${turns.length} turns to database`)

  // Update show run with conversation
  const fullScript = turns.map((t, i) =>
    `[${t.speaker_name}]: ${t.text}`
  ).join('\n\n')

  await supabase
    .from('debate_show_runs')
    .update({
      conversation_turns: turns,
      full_script: fullScript,
      status: 'debate_completed'
    })
    .eq('id', showRunId)

  // Save individual turns
  for (const turn of turns) {
    await supabase
      .from('conversation_turns')
      .insert({
        show_run_id: showRunId,
        turn_number: turn.turn_number,
        speaker_id: turn.speaker_id,
        text: turn.text,
        responding_to_turn_id: turn.responding_to_turn_number,
        model_used: turn.model_used,
        tokens_used: turn.tokens_used
      })
  }

  console.log(`[Orchestrator] Conversation saved successfully`)
}
