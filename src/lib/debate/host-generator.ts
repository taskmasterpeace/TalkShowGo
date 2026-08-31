/**
 * Host Generator
 *
 * Generate AI host profiles from celebrity/historical figure names
 * Or create custom hosts manually
 */

import { callOpenRouter } from '../openrouter'
import type { DebateHost, HostGenerationTemplate, CreateHostRequest } from './types'
import { supabase } from '@/lib/db'

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
      dia_voice_seed: hostData.dia_voice_seed || '',
      voice_settings: {},
      system_prompt: systemPrompt,
      catchphrases: hostData.catchphrases || [],
      is_active: true,
      created_by: 'system',
      tags: hostData.tags || []
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[HostGenerator] Error creating host:', error)
    throw new Error(`Failed to create host: ${error?.message || 'No data returned'}`)
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

  if (error || !data) {
    throw new Error(`Failed to update host: ${error?.message || 'No data returned'}`)
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

/**
 * Generate multiple hosts with opposing perspectives for a topic
 * Uses Twitter context to inform host personalities and stances
 */
export async function generateHostsForTopic(config: {
  topic: string
  num_hosts?: number
  topic_context?: {
    twitter_sentiment?: string
    key_quotes?: string[]
    engagement?: number
  }
}): Promise<DebateHost[]> {
  const { topic, num_hosts = 2, topic_context } = config

  console.log(`[HostGenerator] Generating ${num_hosts} hosts for topic: ${topic}`)

  // Generate host personas using Claude
  const prompt = `Generate ${num_hosts} distinct debate show host personas for a discussion about: "${topic}"

CONTEXT FROM TWITTER:
${topic_context?.twitter_sentiment ? `- Sentiment: ${topic_context.twitter_sentiment}` : ''}
${topic_context?.key_quotes ? `- Sample quotes from the community:\n${topic_context.key_quotes.slice(0, 3).map(q => `  * "${q}"`).join('\n')}` : ''}
${topic_context?.engagement ? `- Engagement level: ${topic_context.engagement}` : ''}

Create ${num_hosts} hosts with OPPOSING perspectives on this topic. Make them:
1. Distinct personalities (different aggression, empathy, analytical levels)
2. Clear opposing viewpoints (if 2 hosts: pro/con, if 3+ hosts: spectrum of views)
3. Based on real archetypes (e.g., "The Skeptic", "The Optimist", "The Analyst", "The Provocateur")

Return ONLY valid JSON array with this structure:
[
  {
    "name": "<creative host name>",
    "archetype": "<their role/type>",
    "bio": "<one sentence about their stance on this topic>",
    "opinion_strength": <0-100>,
    "aggression": <0-100>,
    "humor": <0-100>,
    "analytical_depth": <0-100>,
    "empathy": <0-100>,
    "speed": <0-100>,
    "formality": <0-100>,
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
    "catchphrases": [<1-3 signature phrases>],
    "speaking_style": "<description>",
    "preferred_model": "<openrouter model>"
  }
]

Make sure hosts have CONTRASTING personalities and viewpoints to create interesting debate dynamics.`

  const response = await callOpenRouter({
    model: 'meta-llama/llama-3.3-70b-instruct', // Using Llama instead
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8, // Higher temp for more creative personas
    max_tokens: 2000
  })

  // Parse JSON response
  let hostsData: any[]
  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in response')
    }
    hostsData = JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('[HostGenerator] Failed to parse response:', response.content)
    throw new Error(`Failed to generate hosts: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
  }

  if (!Array.isArray(hostsData) || hostsData.length === 0) {
    throw new Error('No hosts generated')
  }

  console.log(`[HostGenerator] Generated ${hostsData.length} host personas`)

  // Create hosts in database
  const createdHosts: DebateHost[] = []

  for (const hostData of hostsData) {
    try {
      const host = await createHost({
        name: hostData.name,
        archetype: hostData.archetype,
        bio: hostData.bio,
        opinion_strength: hostData.opinion_strength,
        aggression: hostData.aggression,
        humor: hostData.humor,
        analytical_depth: hostData.analytical_depth,
        empathy: hostData.empathy,
        speed: hostData.speed,
        formality: hostData.formality,
        behaviors: hostData.behaviors,
        catchphrases: hostData.catchphrases,
        preferred_model: hostData.preferred_model || 'google/gemini-2.0-flash-exp:free',
        tags: ['auto-generated', topic.split(' ')[0].toLowerCase()]
      })

      createdHosts.push(host)
      console.log(`[HostGenerator] Created host: ${host.name} (${host.archetype})`)
    } catch (error) {
      console.error(`[HostGenerator] Failed to create host ${hostData.name}:`, error)
    }
  }

  if (createdHosts.length === 0) {
    throw new Error('Failed to create any hosts')
  }

  return createdHosts
}
