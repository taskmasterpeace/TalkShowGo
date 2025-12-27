/**
 * Host Generator
 *
 * Generate AI host profiles from celebrity/historical figure names
 * Or create custom hosts manually
 */

import { callOpenRouter } from '../openrouter'
import type { DebateHost, HostGenerationTemplate, CreateHostRequest } from './types'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Generate a host profile from a celebrity/figure name using Claude
 */
export async function generateHostFromTemplate(
  templateName: string,
  category?: string
): Promise<{
  profile: Partial<CreateHostRequest>
  template_id: string
}> {
  console.log(`[HostGenerator] Generating profile for: ${templateName}`)

  // Check if template already exists
  const { data: existing } = await supabase
    .from('host_generation_templates')
    .select('*')
    .ilike('template_name', templateName)
    .single()

  if (existing) {
    console.log(`[HostGenerator] Using existing template`)
    return {
      profile: {
        name: `${templateName} (AI Generated)`,
        archetype: existing.category || 'generated',
        bio: existing.profile_json.speaking_style || `AI-generated profile based on ${templateName}`,
        ...existing.profile_json
      },
      template_id: existing.id
    }
  }

  // Generate new profile using Claude
  const prompt = `Analyze ${templateName} as a talk show host. Generate a detailed personality profile.

Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "opinion_strength": <number 0-100>,
  "aggression": <number 0-100>,
  "humor": <number 0-100>,
  "analytical_depth": <number 0-100>,
  "empathy": <number 0-100>,
  "speed": <number 0-100>,
  "formality": <number 0-100>,
  "behaviors": {
    "interrupts": <boolean>,
    "uses_catchphrases": <boolean>,
    "references_pop_culture": <boolean>,
    "cites_sources": <boolean>,
    "asks_rhetorical_questions": <boolean>,
    "uses_profanity": <boolean>,
    "tells_personal_anecdotes": <boolean>,
    "fact_checks_others": <boolean>,
    "plays_devils_advocate": <boolean>,
    "uses_analogies": <boolean>
  },
  "catchphrases": [<array of 3-5 signature phrases>],
  "speaking_style": "<string describing their delivery>",
  "recommended_model": "<openrouter model ID>"
}

Personality attributes explained:
- opinion_strength: How strongly they express views (0=neutral, 100=very opinionated)
- aggression: How confrontational (0=collaborative, 100=combative)
- humor: Use of jokes and wit (0=serious, 100=comedic)
- analytical_depth: Detail vs brevity (0=surface, 100=deep dive)
- empathy: Emotional vs logical (0=cold facts, 100=human stories)
- speed: Pace of delivery (0=slow deliberate, 100=rapid fire)
- formality: Language style (0=casual slang, 100=academic)

Model recommendations:
- High analytical + high opinion = "anthropic/claude-opus-4.5"
- High speed + high humor = "openai/gpt-4o"
- High aggression = "deepseek/deepseek-chat"
- Balanced = "google/gemini-2.0-flash-exp:free"

Based on what you know about ${templateName}, generate their profile.`

  const response = await callOpenRouter({
    model: 'anthropic/claude-opus-4.5',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000
  })

  // Parse JSON response
  let profileData
  try {
    // Try to extract JSON from response (in case Claude added extra text)
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    profileData = JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('[HostGenerator] Failed to parse response:', response.content)
    throw new Error(`Failed to generate profile: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
  }

  // Save template to database
  const { data: template, error: insertError } = await supabase
    .from('host_generation_templates')
    .insert({
      template_name: templateName,
      category: category || 'Custom',
      profile_json: profileData,
      times_used: 0
    })
    .select()
    .single()

  if (insertError) {
    console.warn('[HostGenerator] Failed to save template:', insertError)
  }

  // Increment usage count
  if (template) {
    await supabase
      .from('host_generation_templates')
      .update({ times_used: (template.times_used || 0) + 1 })
      .eq('id', template.id)
  }

  return {
    profile: {
      name: `${templateName} (AI Generated)`,
      archetype: category || 'generated',
      bio: profileData.speaking_style || `AI-generated profile based on ${templateName}`,
      ...profileData,
      created_from_template: templateName
    },
    template_id: template?.id || 'temp'
  }
}

/**
 * Create a host (manual or from generated profile)
 */
export async function createHost(hostData: CreateHostRequest): Promise<DebateHost> {
  console.log(`[HostGenerator] Creating host: ${hostData.name}`)

  // Build system prompt if not provided
  const systemPrompt = hostData.system_prompt || generateSystemPrompt(hostData)

  const { data, error } = await supabase
    .from('debate_hosts')
    .insert({
      name: hostData.name,
      archetype: hostData.archetype || 'custom',
      bio: hostData.bio || '',
      opinion_strength: hostData.opinion_strength || 50,
      aggression: hostData.aggression || 50,
      humor: hostData.humor || 50,
      analytical_depth: hostData.analytical_depth || 50,
      empathy: hostData.empathy || 50,
      speed: hostData.speed || 50,
      formality: hostData.formality || 50,
      behaviors: hostData.behaviors || {},
      preferred_model: hostData.preferred_model || 'google/gemini-2.0-flash-exp:free',
      fallback_model: 'google/gemini-2.0-flash-exp:free',
      model_selection: 'auto',
      elevenlabs_voice_id: hostData.elevenlabs_voice_id || '',
      voice_settings: {},
      system_prompt: systemPrompt,
      catchphrases: hostData.catchphrases || [],
      is_active: true,
      created_by: 'system',
      tags: hostData.tags || []
    })
    .select()
    .single()

  if (error) {
    console.error('[HostGenerator] Error creating host:', error)
    throw new Error(`Failed to create host: ${error.message}`)
  }

  return data as DebateHost
}

/**
 * Generate system prompt based on host attributes
 */
function generateSystemPrompt(host: Partial<CreateHostRequest>): string {
  const name = host.name || 'Host'
  const archetype = host.archetype || 'commentator'

  let prompt = `You are ${name}, a ${archetype} appearing on a talk show.

PERSONALITY PROFILE:
- Opinion Strength: ${host.opinion_strength || 50}/100 (how strongly you express views)
- Aggression: ${host.aggression || 50}/100 (how confrontational you are)
- Humor: ${host.humor || 50}/100 (how much you use jokes and wit)
- Analytical Depth: ${host.analytical_depth || 50}/100 (how detailed your analysis is)
- Empathy: ${host.empathy || 50}/100 (how much you focus on human impact)
- Speed: ${host.speed || 50}/100 (how fast-paced your delivery is)
- Formality: ${host.formality || 50}/100 (how formal your language is)

BEHAVIORS:`

  if (host.behaviors) {
    if (host.behaviors.interrupts) prompt += '\n- You sometimes interrupt others to make your point'
    if (host.behaviors.uses_catchphrases && host.catchphrases?.length) {
      prompt += `\n- You use signature phrases like: ${host.catchphrases.join(', ')}`
    }
    if (host.behaviors.references_pop_culture) prompt += '\n- You make pop culture references'
    if (host.behaviors.cites_sources) prompt += '\n- You cite sources and evidence'
    if (host.behaviors.asks_rhetorical_questions) prompt += '\n- You ask rhetorical questions'
    if (host.behaviors.uses_profanity) prompt += '\n- You occasionally use mild profanity for emphasis'
    if (host.behaviors.tells_personal_anecdotes) prompt += '\n- You tell personal stories'
    if (host.behaviors.fact_checks_others) prompt += '\n- You fact-check other hosts'
    if (host.behaviors.plays_devils_advocate) prompt += '\n- You play devil\'s advocate'
    if (host.behaviors.uses_analogies) prompt += '\n- You use analogies and metaphors'
  }

  prompt += `\n\nSTYLE:
${host.bio || 'Speak naturally and stay true to your personality.'}

When responding:
1. Stay in character at all times
2. Keep responses 2-4 sentences unless the format calls for longer
3. Respond naturally to what was just said
4. Let your personality attributes guide your tone and delivery`

  return prompt
}

/**
 * Get all hosts
 */
export async function getAllHosts(filters?: {
  archetype?: string
  tags?: string[]
  active_only?: boolean
}): Promise<DebateHost[]> {
  let query = supabase.from('debate_hosts').select('*')

  if (filters?.archetype) {
    query = query.eq('archetype', filters.archetype)
  }

  if (filters?.active_only) {
    query = query.eq('is_active', true)
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch hosts: ${error.message}`)
  }

  return data as DebateHost[]
}

/**
 * Get host by ID
 */
export async function getHostById(id: string): Promise<DebateHost | null> {
  const { data, error } = await supabase
    .from('debate_hosts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[HostGenerator] Error fetching host:', error)
    return null
  }

  return data as DebateHost
}

/**
 * Update host
 */
export async function updateHost(id: string, updates: Partial<CreateHostRequest>): Promise<DebateHost> {
  const { data, error } = await supabase
    .from('debate_hosts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update host: ${error.message}`)
  }

  return data as DebateHost
}

/**
 * Delete host
 */
export async function deleteHost(id: string): Promise<void> {
  const { error } = await supabase
    .from('debate_hosts')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete host: ${error.message}`)
  }
}

/**
 * Get all templates
 */
export async function getAllTemplates(): Promise<HostGenerationTemplate[]> {
  const { data, error } = await supabase
    .from('host_generation_templates')
    .select('*')
    .order('times_used', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`)
  }

  return data as HostGenerationTemplate[]
}
