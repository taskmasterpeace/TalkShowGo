'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  loadWizardState,
  saveWizardState,
  skipWizard,
  completeWizard,
  WIZARD_STEPS,
  type SetupWizardState,
} from '@/lib/setup-wizard'
import { WelcomeStep } from './WelcomeStep'
import { DockerStep } from './DockerStep'
import { LLMStep } from './LLMStep'
import { APIKeysStep } from './APIKeysStep'
import { VoiceStep } from './VoiceStep'
import { VerifyStep } from './VerifyStep'

export function SetupWizard() {
  const router = useRouter()
  const [state, setState] = useState<SetupWizardState | null>(null)
  const [mounted, setMounted] = useState(false)

  // Load state on mount
  useEffect(() => {
    setMounted(true)
    const loaded = loadWizardState()
    setState(loaded)
  }, [])

  const updateState = useCallback((updates: Partial<SetupWizardState>) => {
    setState(prev => {
      if (!prev) return prev
      const newState = { ...prev, ...updates }
      saveWizardState(newState)
      return newState
    })
  }, [])

  const updateConfig = useCallback(
    (updates: Partial<SetupWizardState['config']>) => {
      setState(prev => {
        if (!prev) return prev
        const newState = {
          ...prev,
          config: {
            ...prev.config,
            ...updates,
            apiKeysVerified: {
              ...prev.config.apiKeysVerified,
              ...(updates.apiKeysVerified || {}),
            },
          },
        }
        saveWizardState(newState)
        return newState
      })
    },
    []
  )

  const goToStep = useCallback(
    (step: number) => {
      updateState({ currentStep: step })
    },
    [updateState]
  )

  const handleNext = useCallback(() => {
    if (!state) return
    const nextStep = Math.min(state.currentStep + 1, WIZARD_STEPS.length - 1)
    goToStep(nextStep)
  }, [state, goToStep])

  const handleBack = useCallback(() => {
    if (!state) return
    const prevStep = Math.max(state.currentStep - 1, 0)
    goToStep(prevStep)
  }, [state, goToStep])

  const handleSkip = useCallback(() => {
    skipWizard()
    router.push('/studio')
  }, [router])

  const handleComplete = useCallback(() => {
    completeWizard()
    router.push('/studio/daily-show')
  }, [router])

  // Show nothing while loading
  if (!mounted || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading setup wizard...</p>
        </div>
      </div>
    )
  }

  const currentStep = WIZARD_STEPS[state.currentStep]
  const progress = (state.currentStep / (WIZARD_STEPS.length - 1)) * 100

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Talk Show Go Setup</h1>
            <div className="flex items-center gap-2">
              {WIZARD_STEPS.map((step, index) => (
                <Badge
                  key={step.id}
                  variant={
                    index === state.currentStep
                      ? 'default'
                      : index < state.currentStep
                      ? 'secondary'
                      : 'outline'
                  }
                  className="cursor-pointer"
                  onClick={() => index <= state.currentStep && goToStep(index)}
                >
                  {index + 1}. {step.title}
                </Badge>
              ))}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto py-8 px-4">
        {currentStep.id === 'welcome' && (
          <WelcomeStep onNext={handleNext} onSkip={handleSkip} />
        )}

        {currentStep.id === 'docker' && (
          <DockerStep
            onNext={handleNext}
            onBack={handleBack}
            onVerified={verified => updateConfig({ dockerVerified: verified })}
          />
        )}

        {currentStep.id === 'llm' && (
          <LLMStep
            onNext={handleNext}
            onBack={handleBack}
            onVerified={(verified, type) =>
              updateConfig({ llmVerified: verified, llmType: type })
            }
            initialType={state.config.llmType}
          />
        )}

        {currentStep.id === 'api-keys' && (
          <APIKeysStep
            onNext={handleNext}
            onBack={handleBack}
            onVerified={verified =>
              updateConfig({ apiKeysVerified: verified })
            }
            initialVerified={state.config.apiKeysVerified}
          />
        )}

        {currentStep.id === 'voice' && (
          <VoiceStep
            onNext={handleNext}
            onBack={handleBack}
            onVerified={verified => updateConfig({ voiceConfigured: verified })}
          />
        )}

        {currentStep.id === 'verify' && (
          <VerifyStep
            onBack={handleBack}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  )
}
