/**
 * PROMPT LOADER
 *
 * Core logic for loading prompts with database override support.
 * - Queries database for custom overrides
 * - Falls back to hardcoded defaults from prompt-registry.ts
 * - Validates required variables
 * - Fills templates with provided values
 * - Returns filled prompts ready for LLM use
 */

import { createClient } from '@supabase/supabase-js'
import {
  getPromptById,
  fillPromptTemplate,
  PromptDefinition,
  PromptVariable,
  PROMPT_REGISTRY,
} from './prompt-registry'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================
// TYPES
// ============================================

export interface LoadPromptOptions {
  prompt_id: string
  topic_id?: string
  variables: Record<string, any>
}

export interface LoadedPrompt {
  filled: string // Filled template ready to use
  source: 'custom' | 'default'
  version: number
  missing_variables: string[]
  prompt_id: string
  topic_id?: string
}

export interface CustomPromptOverride {
  id: string
  prompt_id: string
  topic_id?: string
  template: string
  variables: string[] // Required variables
  version: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface PromptChangeHistoryEntry {
  id: string
  prompt_override_id: string
  old_template?: string
  new_template: string
  changed_by: string
  change_reason?: string
  changed_at: string
}

// ============================================
// CORE LOADING LOGIC
// ============================================

/**
 * Load a prompt with database override support
 */
export async function loadPrompt(options: LoadPromptOptions): Promise<LoadedPrompt> {
  const { prompt_id, topic_id, variables } = options

  try {
    // Step 1: Try to get custom override from database
    const customPrompt = await getCustomPrompt(prompt_id, topic_id)

    if (customPrompt) {
      // Use custom override
      const { filled, missing } = fillTemplate(customPrompt.template, customPrompt.variables, variables)

      return {
        filled,
        source: 'custom',
        version: customPrompt.version,
        missing_variables: missing,
        prompt_id,
        topic_id,
      }
    }

    // Step 2: Fall back to default from registry
    const defaultPrompt = getPromptById(prompt_id)

    if (!defaultPrompt) {
      throw new Error(`Prompt not found: ${prompt_id}`)
    }

    const requiredVars = defaultPrompt.variables.filter(v => v.required).map(v => v.name)
    const { filled, missing } = fillTemplate(defaultPrompt.template, requiredVars, variables)

    return {
      filled,
      source: 'default',
      version: defaultPrompt.version,
      missing_variables: missing,
      prompt_id,
      topic_id,
    }
  } catch (error) {
    console.error(`[prompt-loader] Error loading prompt ${prompt_id}:`, error)

    // Fallback to default on any error
    const defaultPrompt = getPromptById(prompt_id)
    if (!defaultPrompt) {
      throw error
    }

    const requiredVars = defaultPrompt.variables.filter(v => v.required).map(v => v.name)
    const { filled, missing } = fillTemplate(defaultPrompt.template, requiredVars, variables)

    return {
      filled,
      source: 'default',
      version: defaultPrompt.version,
      missing_variables: missing,
      prompt_id,
      topic_id,
    }
  }
}

/**
 * Fill a template with variables
 */
function fillTemplate(
  template: string,
  requiredVars: string[],
  values: Record<string, any>
): { filled: string; missing: string[] } {
  let filled = template
  const missing: string[] = []

  // Check for missing required variables
  for (const varName of requiredVars) {
    const value = values[varName]
    if (value === undefined || value === null || value === '') {
      missing.push(varName)
    }
  }

  // Fill in all variables (use empty string for missing)
  for (const [key, value] of Object.entries(values)) {
    const strValue = value !== undefined && value !== null ? String(value) : ''
    filled = filled.replace(new RegExp(`\\{${key}\\}`, 'g'), strValue)
  }

  return { filled, missing }
}

// ============================================
// DATABASE QUERIES
// ============================================

/**
 * Get custom prompt override from database
 */
export async function getCustomPrompt(
  prompt_id: string,
  topic_id?: string
): Promise<CustomPromptOverride | null> {
  try {
    // Query database using the helper function
    const { data, error } = await supabase.rpc('get_active_prompt_override', {
      p_prompt_id: prompt_id,
      p_topic_id: topic_id || null,
    })

    if (error) {
      console.error('[prompt-loader] Database error:', error)
      return null
    }

    if (!data || data.length === 0) {
      return null
    }

    const row = data[0]

    return {
      id: row.id,
      prompt_id,
      topic_id: topic_id || undefined,
      template: row.template,
      variables: row.variables || [],
      version: row.version,
      notes: row.notes || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[prompt-loader] Error fetching custom prompt:', error)
    return null
  }
}

/**
 * Save or update a custom prompt override
 */
export async function saveCustomPrompt(
  prompt_id: string,
  template: string,
  topic_id?: string,
  notes?: string
): Promise<{ success: boolean; error?: string; version?: number }> {
  try {
    // Step 1: Validate that the prompt exists in registry
    const defaultPrompt = getPromptById(prompt_id)
    if (!defaultPrompt) {
      return { success: false, error: `Prompt ${prompt_id} not found in registry` }
    }

    // Step 2: Extract required variables from template
    const requiredVars = extractVariables(template)

    // Step 3: Validate against default required variables
    const defaultRequiredVars = defaultPrompt.variables.filter(v => v.required).map(v => v.name)
    const missingVars = defaultRequiredVars.filter(v => !requiredVars.includes(v))

    if (missingVars.length > 0) {
      return {
        success: false,
        error: `Missing required variables: ${missingVars.join(', ')}`,
      }
    }

    // Step 4: Check if override already exists
    const existing = await getCustomPrompt(prompt_id, topic_id)

    if (existing) {
      // Update existing override
      const { data, error } = await supabase
        .from('prompt_overrides')
        .update({
          template,
          variables: requiredVars,
          notes,
          version: existing.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('version')
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, version: data.version }
    } else {
      // Create new override
      const { data, error } = await supabase
        .from('prompt_overrides')
        .insert({
          prompt_id,
          topic_id: topic_id || null,
          template,
          variables: requiredVars,
          notes,
          version: 1,
          is_active: true,
        })
        .select('version')
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, version: data.version }
    }
  } catch (error) {
    console.error('[prompt-loader] Error saving custom prompt:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Reset a prompt to default (deactivate custom override)
 */
export async function resetToDefault(
  prompt_id: string,
  topic_id?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('prompt_overrides')
      .update({ is_active: false })
      .eq('prompt_id', prompt_id)
      .eq('topic_id', topic_id || null)
      .eq('is_active', true)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[prompt-loader] Error resetting prompt:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Get change history for a prompt
 */
export async function getPromptHistory(
  prompt_id: string,
  topic_id?: string
): Promise<PromptChangeHistoryEntry[]> {
  try {
    // First get the override ID
    const customPrompt = await getCustomPrompt(prompt_id, topic_id)
    if (!customPrompt) {
      return []
    }

    const { data, error } = await supabase
      .from('prompt_change_history')
      .select('*')
      .eq('prompt_override_id', customPrompt.id)
      .order('changed_at', { ascending: false })

    if (error) {
      console.error('[prompt-loader] Error fetching history:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[prompt-loader] Error fetching history:', error)
    return []
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract all {variable} placeholders from a template
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{(\w+)\}/g)
  if (!matches) return []

  return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))]
}

/**
 * Validate that all required variables are present in template
 */
export function validateVariables(
  template: string,
  requiredVars: string[]
): { valid: boolean; missing: string[] } {
  const templateVars = extractVariables(template)
  const missing = requiredVars.filter(v => !templateVars.includes(v))

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Get all custom prompts (for export)
 */
export async function getAllCustomPrompts(): Promise<CustomPromptOverride[]> {
  try {
    const { data, error } = await supabase
      .from('prompt_overrides')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[prompt-loader] Error fetching all custom prompts:', error)
      return []
    }

    return (
      data?.map(row => ({
        id: row.id,
        prompt_id: row.prompt_id,
        topic_id: row.topic_id || undefined,
        template: row.template,
        variables: row.variables || [],
        version: row.version,
        notes: row.notes || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) || []
    )
  } catch (error) {
    console.error('[prompt-loader] Error fetching all custom prompts:', error)
    return []
  }
}

/**
 * Get enriched prompt list (defaults + override status)
 */
export async function getEnrichedPromptList(topic_id?: string): Promise<
  Array<
    PromptDefinition & {
      has_override: boolean
      override_version?: number
      override_notes?: string
    }
  >
> {
  try {
    // Get all custom overrides
    const customPrompts = await getAllCustomPrompts()

    // Enrich registry prompts with override status
    return PROMPT_REGISTRY.map(prompt => {
      const override = customPrompts.find(
        cp => cp.prompt_id === prompt.id && (topic_id === undefined || cp.topic_id === topic_id)
      )

      return {
        ...prompt,
        has_override: !!override,
        override_version: override?.version,
        override_notes: override?.notes,
      }
    })
  } catch (error) {
    console.error('[prompt-loader] Error enriching prompt list:', error)
    return PROMPT_REGISTRY.map(p => ({ ...p, has_override: false }))
  }
}
