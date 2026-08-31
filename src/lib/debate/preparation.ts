/**
 * Preparation Orchestrator
 *
 * Handles the preparation phase where each host:
 * 1. Reviews research materials
 * 2. Decides what additional research they want
 * 3. Forms their stance/position
 * 4. Generates talking points
 */

import { callOpenRouter, selectModelForHost } from '../openrouter'
import type { DebateHost, PreparationRun, PreparationResult, ResearchRequest } from './types'
import { supabase } from '@/lib/db'

/**
 * Run preparation phase for all hosts in parallel
 */
export async function runPreparationPhase(
  hosts: DebateHost[],
  topic: string,
  researchPackageId?: string
): Promise<PreparationResult[]> {
  console.log(`[Preparation] Starting prep for ${hosts.length} hosts on: ${topic}`)

  const results = await Promise.all(
    hosts.map(host => runHostPreparation(host, topic, researchPackageId))
  )

  return results
}

/**
 * Run preparation for a single host
 */
async function runHostPreparation(
  host: DebateHost,
  topic: string,
  researchPackageId?: string
): Promise<PreparationResult> {
  console.log(`[Preparation] ${host.name} starting prep...`)

  // 1. Load research package if provided
  let researchSummary = 'No research package provided.'
  if (researchPackageId) {
    // TODO: Load from research_packages table when it exists
    researchSummary = 'Research materials available (loading not yet implemented)'
  }

  // 2. Generate self-directed research requests
  const researchRequests = await generateResearchRequests(host, topic, researchSummary)

  // 3. Execute research requests (for now, just log them)
  // TODO: Actually fetch materials using existing research APIs
  const researchResults: any[] = []

  // 4. Form stance
  const stance = await formStance(host, topic, researchSummary, researchRequests)

  // 5. Generate talking points
  const talkingPoints = await generateTalkingPoints(host, stance, topic)

  // 6. Generate questions for opponents
  const questionsForOpponents = await generateQuestions(host, stance, topic)

  // 7. Save to database
  const { data: prepRun } = await supabase
    .from('debate_preparation_runs')
    .insert({
      host_id: host.id,
      topic,
      research_package_id: researchPackageId,
      research_requests: researchRequests,
      research_results: researchResults,
      stance,
      talking_points: talkingPoints,
      questions_for_opponents: questionsForOpponents,
      model_used: selectModelForHost(host),
      tokens_used: 0, // Updated below
      completed_at: new Date().toISOString()
    })
    .select()
    .single()

  console.log(`[Preparation] ${host.name} completed prep`)

  return {
    host_id: host.id,
    stance,
    talking_points: talkingPoints,
    questions_for_opponents: questionsForOpponents,
    research_requests: researchRequests,
    model_used: selectModelForHost(host),
    tokens_used: 0
  }
}

/**
 * Generate research requests based on host personality
 */
async function generateResearchRequests(
  host: DebateHost,
  topic: string,
  availableResearch: string
): Promise<ResearchRequest[]> {
  const model = selectModelForHost(host)

  const prompt = `You are ${host.name}, preparing for a show about: "${topic}"

YOUR PERSONALITY:
- Opinion Strength: ${host.opinion_strength}/100
- Analytical Depth: ${host.analytical_depth}/100
- Empathy: ${host.empathy}/100
- Aggression: ${host.aggression}/100

AVAILABLE RESEARCH:
${availableResearch}

Based on your personality, what SPECIFIC aspects do you want to research further?

Consider:
- If you're analytical (${host.analytical_depth}/100), you might want data, documents, expert analysis
- If you're empathetic (${host.empathy}/100), you might want personal stories, interviews
- If you're aggressive (${host.aggression}/100), you might want opposing viewpoints to counter
- If you have strong opinions (${host.opinion_strength}/100), you might want evidence to support your stance

Generate 2-4 research requests in JSON format:
[
  {
    "request": "What you want to find",
    "reason": "Why you need it",
    "priority": "high" | "medium" | "low"
  }
]

Return ONLY the JSON array, no extra text.`

  const response = await callOpenRouter({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 800
  })

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found')
    }
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.warn(`[Preparation] ${host.name} failed to generate research requests:`, error)
    return []
  }
}

/**
 * Form stance on the topic
 */
async function formStance(
  host: DebateHost,
  topic: string,
  researchSummary: string,
  researchRequests: ResearchRequest[]
): Promise<string> {
  const model = selectModelForHost(host)

  const prompt = `${host.system_prompt}

TOPIC: ${topic}

RESEARCH AVAILABLE:
${researchSummary}

YOU WANTED TO RESEARCH:
${researchRequests.map(r => `- ${r.request} (${r.reason})`).join('\n')}

Based on your personality and the available information, form your stance on this topic.

Write 2-3 sentences stating your position clearly.
Be true to your personality:
- Opinion Strength ${host.opinion_strength}/100: ${host.opinion_strength > 70 ? 'Take a strong, clear position' : 'Be more measured and nuanced'}
- Analytical ${host.analytical_depth}/100: ${host.analytical_depth > 70 ? 'Support with reasoning' : 'Keep it simple'}

Your stance:`

  const response = await callOpenRouter({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 200
  })

  return response.content.trim()
}

/**
 * Generate talking points
 */
async function generateTalkingPoints(
  host: DebateHost,
  stance: string,
  topic: string
): Promise<string[]> {
  const model = selectModelForHost(host)

  const prompt = `${host.system_prompt}

TOPIC: ${topic}
YOUR STANCE: ${stance}

Generate 3-5 key talking points to support your stance.
Each should be one concise sentence.

Return as JSON array:
["Point 1", "Point 2", "Point 3"]

Only the JSON array, no extra text.`

  const response = await callOpenRouter({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 300
  })

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found')
    }
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.warn(`[Preparation] ${host.name} failed to generate talking points:`, error)
    return [stance]
  }
}

/**
 * Generate questions for opponents
 */
async function generateQuestions(
  host: DebateHost,
  stance: string,
  topic: string
): Promise<string[]> {
  const model = selectModelForHost(host)

  const prompt = `${host.system_prompt}

TOPIC: ${topic}
YOUR STANCE: ${stance}

Generate 2-3 challenging questions you'd ask someone who disagrees with you.

Return as JSON array:
["Question 1?", "Question 2?"]

Only the JSON array.`

  const response = await callOpenRouter({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 200
  })

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found')
    }
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.warn(`[Preparation] ${host.name} failed to generate questions:`, error)
    return []
  }
}

/**
 * Get preparation run by ID
 */
export async function getPreparationRun(id: string): Promise<PreparationRun | null> {
  const { data, error } = await supabase
    .from('debate_preparation_runs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[Preparation] Error fetching prep run:', error)
    return null
  }

  return data as PreparationRun
}
