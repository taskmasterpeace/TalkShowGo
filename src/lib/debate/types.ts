/**
 * TypeScript interfaces for Multi-Host Debate/Conversation System
 */

// ============================================
// DEBATE HOST
// ============================================
export interface DebateHost {
  id: string
  name: string
  archetype: string  // "analyst", "comedian", "investigator"
  bio: string

  // Personality Attributes (0-100)
  opinion_strength: number
  aggression: number
  humor: number
  analytical_depth: number
  empathy: number
  speed: number
  formality: number

  // Behaviors
  behaviors: {
    interrupts?: boolean
    uses_catchphrases?: boolean
    references_pop_culture?: boolean
    cites_sources?: boolean
    asks_rhetorical_questions?: boolean
    uses_profanity?: boolean
    tells_personal_anecdotes?: boolean
    fact_checks_others?: boolean
    plays_devils_advocate?: boolean
    uses_analogies?: boolean
  }

  // LLM Configuration
  preferred_model: string
  fallback_model: string
  model_selection: 'auto' | 'manual'

  // Voice Configuration
  elevenlabs_voice_id: string
  voice_settings: {
    stability?: number
    similarity_boost?: number
    style?: 'conversational' | 'narrative' | 'dramatic'
  }

  // System Prompt
  system_prompt: string
  catchphrases: string[]

  // Metadata
  is_active: boolean
  created_by: string
  created_from_template?: string
  tags: string[]

  created_at: string
  updated_at: string
}

// ============================================
// SHOW FORMAT
// ============================================
export interface ShowFormat {
  id: string
  name: string
  description: string
  format_type: 'debate' | 'news' | 'deep_commentary' | 'investigative' | 'panel'

  min_hosts: number
  max_hosts: number
  target_duration_minutes: number

  phases: Array<{
    name: string
    duration_pct: number
  }>

  turn_taking_strategy: 'round_robin' | 'dynamic' | 'moderated'
  allow_interruptions: boolean

  intro_template: string
  outro_template: string

  created_at: string
}

// ============================================
// EMOTIONAL BEATS
// ============================================
export interface EmotionalBeat {
  type: 'outrage' | 'investigation' | 'revelation' | 'resolution' | 'tension' | 'clarity' | 'custom'
  percent: number  // 0-100: when in the show this beat happens
  host_preference?: 'aggressive' | 'analytical' | 'empathetic' | 'balanced'
  description?: string
}

export interface EmotionalBeats {
  arc_type: string  // "outrage_revelation", "confusion_clarity", etc.
  milestones: EmotionalBeat[]
}

// ============================================
// PREPARATION PHASE
// ============================================
export interface ResearchRequest {
  request: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  sources?: string[]
}

export interface PreparationRun {
  id: string
  show_run_id?: string
  host_id: string

  topic: string
  research_package_id?: string

  research_requests: ResearchRequest[]
  research_results: any[]  // Collected materials

  stance: string
  talking_points: string[]
  questions_for_opponents: string[]

  model_used: string
  tokens_used: number

  started_at: string
  completed_at?: string
}

export interface PreparationResult {
  host_id: string
  stance: string
  talking_points: string[]
  questions_for_opponents: string[]
  research_requests: ResearchRequest[]
  model_used: string
  tokens_used: number
}

// ============================================
// CONVERSATION/DEBATE
// ============================================
export interface ConversationTurn {
  id?: string
  show_run_id?: string

  turn_number: number
  speaker_id: string
  speaker_name?: string
  text: string

  responding_to_turn_id?: string
  responding_to_turn_number?: number
  topic_shift?: boolean

  emotion?: string
  emphasis_words?: string[]

  audio_start_ms?: number
  audio_end_ms?: number

  model_used: string
  tokens_used?: number
  generation_time_ms?: number

  is_opening?: boolean
  is_closing?: boolean

  created_at?: string
}

export interface DebateShowRun {
  id: string
  topic_id?: string

  show_format_id: string
  host_ids: string[]

  topic: string
  research_package_id?: string
  producer_instructions?: string

  emotional_beats?: EmotionalBeats

  preparation_run_ids: string[]
  preparation_summary: {
    [host_id: string]: {
      stance: string
      talking_points: string[]
    }
  }

  conversation_turns: ConversationTurn[]
  full_script: string

  audio_url?: string
  audio_duration_seconds?: number

  total_tokens_used: number
  cost_usd: number
  cost_breakdown: {
    prep_phase: number
    debate_phase: number
    audio: number
    refinement?: number
  }

  refinement_count: number

  status: 'prep_pending' | 'prep_running' | 'debate_pending' | 'debate_running' | 'audio_generating' | 'completed' | 'failed'
  error_message?: string

  created_at: string
  completed_at?: string
}

// ============================================
// PRODUCTION STRATEGIES
// ============================================
export interface ProductionStrategy {
  id: string
  name: string
  category: 'pacing' | 'emotion' | 'structure' | 'character'
  description: string
  when_to_use: string
  prompt_template: string
  examples: string[]
  is_active: boolean
  created_at: string
}

export interface AppliedStrategy {
  strategy_id: string
  target_host_id?: string
  time_range?: string  // "3:00-5:30"
  custom_notes?: string
  refinement_number?: number
  context?: {
    topic?: string
    revelation?: string
    [key: string]: any
  }
}

export interface ScriptRefinement {
  id: string
  show_run_id: string
  refinement_number: number

  strategies_applied: AppliedStrategy[]

  original_script: string
  refined_script: string
  changes_summary: string

  tokens_used: number
  cost_usd: number

  created_at: string
}

// ============================================
// HOST GENERATION
// ============================================
export interface HostGenerationTemplate {
  id: string
  template_name: string
  category: string

  profile_json: {
    opinion_strength: number
    aggression: number
    humor: number
    analytical_depth: number
    empathy: number
    speed: number
    formality: number
    behaviors: DebateHost['behaviors']
    catchphrases: string[]
    recommended_model: string
    speaking_style: string
  }

  times_used: number
  avg_rating?: number

  created_at: string
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================
export interface CreateHostRequest {
  name: string
  archetype: string
  bio?: string
  opinion_strength?: number
  aggression?: number
  humor?: number
  analytical_depth?: number
  empathy?: number
  speed?: number
  formality?: number
  behaviors?: DebateHost['behaviors']
  preferred_model?: string
  elevenlabs_voice_id?: string
  system_prompt?: string
  catchphrases?: string[]
  tags?: string[]
}

export interface GenerateHostFromTemplateRequest {
  template_name: string  // "Stephen A Smith", "Rachel Maddow", etc.
  category?: string
  edit_before_saving?: boolean
}

export interface CreateShowRequest {
  topic_id?: string
  show_format_id: string
  host_ids: string[]
  topic: string
  research_package_id?: string
  producer_instructions?: string
  emotional_beats?: EmotionalBeats
  target_duration_minutes?: number
}

export interface RefineScriptRequest {
  show_run_id: string
  strategies: AppliedStrategy[]
}

export interface RefineScriptResponse {
  success: boolean
  refined_script: string
  changes_summary: string
  original_script: string
  refinement_id: string
  tokens_used: number
  cost_usd: number
}

// ============================================
// UTILITY TYPES
// ============================================
export interface SelectionContext {
  turns: ConversationTurn[]
  hosts: DebateHost[]
  format: ShowFormat
  round: number
  totalTurnsPlanned: number
  emotionalBeats?: EmotionalBeats
}

export interface TurnContext {
  speaker: DebateHost
  previousTurns: ConversationTurn[]
  preparationResult: PreparationResult
  topic: string
  emotionalBeat?: EmotionalBeat
}

export interface RefinementResult {
  refined_script: string
  changes_summary: string
  original_script: string
}
