/**
 * Script Refiner
 *
 * Allows producers to "punch up" generated scripts using professional production strategies.
 * Producers can apply strategies like:
 * - Increase Conflict
 * - Heighten Stakes
 * - Add Callback
 * - Stronger Close
 * - Build Suspense
 * - Lighten Mood
 * - Deepen Analysis
 * - Pace Up
 * - Emotional Peak
 * - Plant/Payoff
 */

import { callOpenRouter } from '../openrouter'
import { createClient } from '@supabase/supabase-js'
import type { ProductionStrategy, AppliedStrategy } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface RefinementResult {
  refined_script: string
  changes_summary: string
  original_script: string
  tokens_used: number
  cost_usd: number
}

/**
 * Main entry point: Refine script with applied strategies
 */
export async function refineScript(
  showRunId: string,
  strategies: AppliedStrategy[]
): Promise<RefinementResult> {
  console.log(`[Refiner] Refining script for show ${showRunId}`)
  console.log(`[Refiner] Applying ${strategies.length} strategies`)

  // 1. Load original script
  const { data: showRun } = await supabase
    .from('debate_show_runs')
    .select('*')
    .eq('id', showRunId)
    .single()

  if (!showRun) {
    throw new Error('Show run not found')
  }

  const originalScript = showRun.full_script

  // 2. Load hosts for context
  const hosts = await Promise.all(
    showRun.host_ids.map(async (id: string) => {
      const { data } = await supabase
        .from('debate_hosts')
        .select('*')
        .eq('id', id)
        .single()
      return data
    })
  )

  // 3. Build refinement prompt
  const refinementPrompt = await buildRefinementPrompt(
    originalScript,
    strategies,
    hosts.filter(h => h !== null)
  )

  // 4. Call LLM to refine
  console.log(`[Refiner] Calling Claude Opus for script refinement...`)
  const response = await callOpenRouter({
    model: 'anthropic/claude-opus-4.5', // Use best model for refinement
    messages: [{ role: 'user', content: refinementPrompt }],
    temperature: 0.7,
    max_tokens: 6000
  })

  const refinedScript = response.content

  // 5. Generate summary of changes
  const changesSummary = await summarizeChanges(originalScript, refinedScript)

  // 6. Calculate cost
  const costUsd = response.tokens * 0.000015 // Claude Opus pricing

  // 7. Save refinement
  const { data: refinement } = await supabase
    .from('script_refinements')
    .insert({
      show_run_id: showRunId,
      refinement_number: (showRun.refinement_count || 0) + 1,
      strategies_applied: strategies,
      original_script: originalScript,
      refined_script: refinedScript,
      changes_summary: changesSummary,
      tokens_used: response.tokens,
      cost_usd: costUsd
    })
    .select()
    .single()

  // 8. Update show run
  await supabase
    .from('debate_show_runs')
    .update({
      full_script: refinedScript,
      refinement_count: (showRun.refinement_count || 0) + 1
    })
    .eq('id', showRunId)

  console.log(`[Refiner] Refinement complete. Tokens: ${response.tokens}, Cost: $${costUsd.toFixed(4)}`)

  return {
    refined_script: refinedScript,
    changes_summary: changesSummary,
    original_script: originalScript,
    tokens_used: response.tokens,
    cost_usd: costUsd
  }
}

/**
 * Build refinement prompt from strategies
 */
async function buildRefinementPrompt(
  script: string,
  strategies: AppliedStrategy[],
  hosts: any[]
): Promise<string> {
  // Load strategy definitions from database
  const { data: strategyDefs } = await supabase
    .from('production_strategies')
    .select('*')
    .in('id', strategies.map(s => s.strategy_id))

  const strategyMap = new Map(
    (strategyDefs || []).map(s => [s.id, s])
  )

  let prompt = `You are a professional TV producer refining a multi-host show script.

ORIGINAL SCRIPT:
${script}

HOSTS IN THIS SHOW:
${hosts.map(h => `- ${h.name}: ${h.archetype} (${h.bio})`).join('\n')}

PRODUCER REFINEMENT NOTES:

The producer wants you to apply these specific refinements to improve the script:

`

  for (const applied of strategies) {
    const strategy = strategyMap.get(applied.strategy_id)
    if (!strategy) continue

    const filledTemplate = fillTemplate(strategy.prompt_template, {
      host: applied.target_host_id
        ? hosts.find(h => h.id === applied.target_host_id)?.name || 'host'
        : 'all hosts',
      host_a: hosts[0]?.name || 'Host A',
      host_b: hosts[1]?.name || 'Host B',
      time_range: applied.time_range || 'entire show',
      start_time: applied.time_range?.split('-')[0] || '0:00',
      end_time: applied.time_range?.split('-')[1] || 'end',
      custom_notes: applied.custom_notes || 'No additional notes',
      topic: applied.context?.topic || '',
      revelation: applied.context?.revelation || 'the key point'
    })

    prompt += `\n${applied.refinement_number || strategies.indexOf(applied) + 1}. ${strategy.name}:\n${filledTemplate}\n`
  }

  prompt += `\n\nINSTRUCTIONS:
1. Rewrite the script incorporating ALL refinements above
2. Keep the overall structure and conversation format
3. Maintain each host's character voice and personality
4. Make the changes feel natural, not forced
5. Don't add commentary or explanations
6. Return ONLY the refined script

Begin refined script:`

  return prompt
}

/**
 * Fill template placeholders with actual values
 */
function fillTemplate(template: string, values: Record<string, string>): string {
  let filled = template
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{${key}}`
    filled = filled.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
  }
  return filled
}

/**
 * Generate summary of changes
 */
async function summarizeChanges(
  original: string,
  refined: string
): Promise<string> {
  const prompt = `Compare these two versions of a script and summarize what changed.

ORIGINAL:
${original.substring(0, 2000)}...

REFINED:
${refined.substring(0, 2000)}...

Provide a brief summary (3-5 bullet points) of the key changes made.
Focus on structural changes, tone shifts, and added/removed content.

Summary:`

  const response = await callOpenRouter({
    model: 'anthropic/claude-opus-4.5',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 500
  })

  return response.content
}

/**
 * Get all available strategies
 */
export async function getAllStrategies(): Promise<ProductionStrategy[]> {
  const { data, error } = await supabase
    .from('production_strategies')
    .select('*')
    .eq('is_active', true)
    .order('category')

  if (error) {
    console.error('[Refiner] Error fetching strategies:', error)
    return []
  }

  return data as ProductionStrategy[]
}

/**
 * Get strategy by ID
 */
export async function getStrategyById(id: string): Promise<ProductionStrategy | null> {
  const { data } = await supabase
    .from('production_strategies')
    .select('*')
    .eq('id', id)
    .single()

  return data as ProductionStrategy | null
}
