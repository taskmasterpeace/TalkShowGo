/**
 * Host Generation API
 *
 * POST /api/hosts/generate - Generate a host from a prompt
 *
 * Uses Presidium AI (Ollama) to create a complete host personality.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { chatJSON, PRESIDIUM_CONFIG } from '@/lib/presidium-ai'

// Color palette for random selection
const COLOR_SCHEMES = [
  { primary: '#6366f1', secondary: '#818cf8', gradient: 'from-indigo-500/20 to-purple-500/20' },
  { primary: '#ef4444', secondary: '#f97316', gradient: 'from-red-500/20 to-orange-500/20' },
  { primary: '#22c55e', secondary: '#84cc16', gradient: 'from-green-500/20 to-lime-500/20' },
  { primary: '#f43f5e', secondary: '#ec4899', gradient: 'from-rose-500/20 to-pink-500/20' },
  { primary: '#8b5cf6', secondary: '#a78bfa', gradient: 'from-violet-500/20 to-purple-500/20' },
  { primary: '#eab308', secondary: '#facc15', gradient: 'from-yellow-500/20 to-amber-500/20' },
  { primary: '#06b6d4', secondary: '#22d3ee', gradient: 'from-cyan-500/20 to-teal-500/20' },
  { primary: '#f97316', secondary: '#fb923c', gradient: 'from-orange-500/20 to-amber-500/20' },
]

const GENERATION_PROMPT = `You are a character designer for a media platform. Create a detailed host personality based on the user's description.

Return a JSON object with EXACTLY this structure (no additional fields):
{
  "name": "Full Name",
  "archetype": "Short archetype label (3-5 words max)",
  "tagline": "Their signature catchphrase or intro (short)",
  "short_bio": "One sentence summary of who they are",
  "full_bio": "2-3 paragraph detailed personality description",
  "voice_style": "How they speak - pace, tone, mannerisms",
  "best_for": ["Content type 1", "Content type 2", "Content type 3"],
  "catchphrases": ["Phrase 1", "Phrase 2", "Phrase 3", "Phrase 4"],
  "personality_traits": [
    {"name": "Trait1", "category": "core", "value": 75, "description": "What this means for them", "icon": "brain"},
    {"name": "Trait2", "category": "core", "value": 60, "description": "...", "icon": "heart"},
    {"name": "Trait3", "category": "core", "value": 85, "description": "...", "icon": "shield"},
    {"name": "Trait4", "category": "style", "value": 50, "description": "...", "icon": "zap"},
    {"name": "Trait5", "category": "style", "value": 70, "description": "...", "icon": "smile"},
    {"name": "Trait6", "category": "approach", "value": 80, "description": "...", "icon": "target"},
    {"name": "Trait7", "category": "approach", "value": 45, "description": "...", "icon": "book-open"},
    {"name": "Trait8", "category": "approach", "value": 90, "description": "...", "icon": "flame"}
  ]
}

IMPORTANT RULES:
1. Trait values should vary widely (15-100). Not everyone is good at everything. Create DISTINCT personalities.
2. Include weaknesses - some traits should be LOW (15-40)
3. Categories: "core" (personality), "style" (delivery), "approach" (method)
4. Icon options: brain, heart, shield, zap, smile, target, book-open, flame, eye, crown, star, users, clock, message-circle
5. Make the character memorable and distinct
6. The voice_style should describe HOW they talk, not WHAT they talk about`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Log the generation attempt
    const { data: logEntry } = await supabase
      .from('host_generation_logs')
      .insert({
        input_prompt: prompt,
        llm_provider: 'presidium',
        status: 'pending',
      })
      .select()
      .single()

    let generatedHost: any = null
    let provider = 'presidium'

    // Try Presidium AI (Ollama) first
    try {
      generatedHost = await chatJSON([
        { role: 'system', content: GENERATION_PROMPT },
        { role: 'user', content: prompt },
      ], {
        model: PRESIDIUM_CONFIG.ollama.models.reasoning, // Use qwen3:30b for better reasoning
        temperature: 0.8,
      })
    } catch (presidiumError) {
      console.log('Presidium AI not available, trying fallback...')

      // Fallback to OpenAI if available
      if (process.env.OPENAI_API_KEY) {
        provider = 'openai'
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: GENERATION_PROMPT },
              { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            response_format: { type: 'json_object' },
          }),
        })

        if (openaiResponse.ok) {
          const data = await openaiResponse.json()
          const content = data.choices?.[0]?.message?.content
          if (content) {
            generatedHost = JSON.parse(content)
          }
        }
      }
    }

    if (!generatedHost) {
      // Update log with error
      if (logEntry) {
        await supabase
          .from('host_generation_logs')
          .update({
            status: 'failed',
            error_message: 'No LLM available. Make sure Presidium AI is running.',
          })
          .eq('id', logEntry.id)
      }

      return NextResponse.json(
        {
          error: 'No LLM available. Make sure Presidium AI is running at ' + PRESIDIUM_CONFIG.ollama.url,
          presidium_url: PRESIDIUM_CONFIG.ollama.url,
        },
        { status: 503 }
      )
    }

    // Pick a random color scheme
    const colorScheme = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)]

    // Create the host in the database
    const { data: host, error: hostError } = await supabase
      .from('hosts')
      .insert({
        name: generatedHost.name,
        archetype: generatedHost.archetype,
        tagline: generatedHost.tagline,
        short_bio: generatedHost.short_bio,
        full_bio: generatedHost.full_bio,
        voice_style: generatedHost.voice_style,
        best_for: generatedHost.best_for || [],
        catchphrases: generatedHost.catchphrases || [],
        color_primary: colorScheme.primary,
        color_secondary: colorScheme.secondary,
        gradient_bg: colorScheme.gradient,
      })
      .select()
      .single()

    if (hostError) throw hostError

    // Insert personality traits
    if (generatedHost.personality_traits && generatedHost.personality_traits.length > 0) {
      const traitsToInsert = generatedHost.personality_traits.map((trait: any, index: number) => ({
        host_id: host.id,
        trait_name: trait.name,
        trait_category: trait.category || 'core',
        trait_value: trait.value,
        trait_description: trait.description,
        trait_icon: trait.icon,
        display_order: index,
      }))

      await supabase.from('host_personality_traits').insert(traitsToInsert)
    }

    // Update generation log
    if (logEntry) {
      await supabase
        .from('host_generation_logs')
        .update({
          generated_host_id: host.id,
          llm_provider: provider,
          raw_response: generatedHost,
          status: 'completed',
        })
        .eq('id', logEntry.id)
    }

    // Fetch the complete host with traits
    const { data: completeHost } = await supabase
      .from('hosts')
      .select(`
        *,
        host_personality_traits(*)
      `)
      .eq('id', host.id)
      .single()

    return NextResponse.json({
      success: true,
      host: completeHost,
      provider,
    }, { status: 201 })
  } catch (error) {
    console.error('Error generating host:', error)
    return NextResponse.json(
      { error: 'Failed to generate host' },
      { status: 500 }
    )
  }
}
