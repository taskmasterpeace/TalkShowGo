/**
 * Setup Wizard State Management
 *
 * Manages the state of the interactive setup wizard, including:
 * - Current step tracking
 * - Completion status for each step
 * - Skip/resume functionality
 * - LocalStorage persistence
 */

export interface SetupWizardState {
  currentStep: number
  completed: boolean
  skipped: boolean
  lastUpdated: string
  config: {
    dockerVerified: boolean
    llmType: 'ollama' | 'openai' | 'anthropic' | null
    llmVerified: boolean
    apiKeysVerified: {
      elevenlabs: boolean
      twitter: boolean
      thenewsapi: boolean
      newsdata: boolean
    }
    voiceConfigured: boolean
    systemVerified: boolean
  }
}

const STORAGE_KEY = 'talkshowgo_setup'

const DEFAULT_STATE: SetupWizardState = {
  currentStep: 0,
  completed: false,
  skipped: false,
  lastUpdated: new Date().toISOString(),
  config: {
    dockerVerified: false,
    llmType: null,
    llmVerified: false,
    apiKeysVerified: {
      elevenlabs: false,
      twitter: false,
      thenewsapi: false,
      newsdata: false,
    },
    voiceConfigured: false,
    systemVerified: false,
  },
}

export const WIZARD_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Introduction to Talk Show Go',
  },
  {
    id: 'docker',
    title: 'Docker Services',
    description: 'Verify core infrastructure',
  },
  {
    id: 'llm',
    title: 'AI/LLM Setup',
    description: 'Configure language models',
  },
  {
    id: 'api-keys',
    title: 'API Keys',
    description: 'Connect external services',
  },
  {
    id: 'voice',
    title: 'Voice Setup',
    description: 'Configure text-to-speech',
  },
  {
    id: 'verify',
    title: 'Verification',
    description: 'Final system check',
  },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']

/**
 * Load wizard state from localStorage
 */
export function loadWizardState(): SetupWizardState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to handle any new fields
      return {
        ...DEFAULT_STATE,
        ...parsed,
        config: {
          ...DEFAULT_STATE.config,
          ...parsed.config,
          apiKeysVerified: {
            ...DEFAULT_STATE.config.apiKeysVerified,
            ...parsed.config?.apiKeysVerified,
          },
        },
      }
    }
  } catch (error) {
    console.error('Failed to load wizard state:', error)
  }

  return DEFAULT_STATE
}

/**
 * Save wizard state to localStorage
 */
export function saveWizardState(state: SetupWizardState): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const toSave = {
      ...state,
      lastUpdated: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (error) {
    console.error('Failed to save wizard state:', error)
  }
}

/**
 * Reset wizard state to defaults
 */
export function resetWizardState(): SetupWizardState {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
  return DEFAULT_STATE
}

/**
 * Mark wizard as skipped
 */
export function skipWizard(): SetupWizardState {
  const state = loadWizardState()
  const newState: SetupWizardState = {
    ...state,
    skipped: true,
    lastUpdated: new Date().toISOString(),
  }
  saveWizardState(newState)
  return newState
}

/**
 * Mark wizard as completed
 */
export function completeWizard(): SetupWizardState {
  const state = loadWizardState()
  const newState: SetupWizardState = {
    ...state,
    completed: true,
    currentStep: WIZARD_STEPS.length - 1,
    lastUpdated: new Date().toISOString(),
  }
  saveWizardState(newState)
  return newState
}

/**
 * Update current step
 */
export function setCurrentStep(step: number): SetupWizardState {
  const state = loadWizardState()
  const newState: SetupWizardState = {
    ...state,
    currentStep: Math.max(0, Math.min(step, WIZARD_STEPS.length - 1)),
    lastUpdated: new Date().toISOString(),
  }
  saveWizardState(newState)
  return newState
}

/**
 * Update config field
 */
export function updateConfig(
  updates: Partial<SetupWizardState['config']>
): SetupWizardState {
  const state = loadWizardState()
  const newState: SetupWizardState = {
    ...state,
    config: {
      ...state.config,
      ...updates,
      apiKeysVerified: {
        ...state.config.apiKeysVerified,
        ...(updates.apiKeysVerified || {}),
      },
    },
    lastUpdated: new Date().toISOString(),
  }
  saveWizardState(newState)
  return newState
}

/**
 * Check if wizard should be shown
 */
export function shouldShowWizard(): boolean {
  const state = loadWizardState()
  return !state.completed && !state.skipped
}

/**
 * Get progress percentage
 */
export function getWizardProgress(state: SetupWizardState): number {
  const totalSteps = WIZARD_STEPS.length
  return Math.round((state.currentStep / (totalSteps - 1)) * 100)
}

/**
 * Check if all required services are configured
 */
export function isMinimalSetupComplete(state: SetupWizardState): boolean {
  return (
    state.config.dockerVerified &&
    state.config.llmVerified &&
    state.config.apiKeysVerified.elevenlabs
  )
}
