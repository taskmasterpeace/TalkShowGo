/**
 * LLM Status API
 *
 * GET /api/llm/status - Check Presidium AI and other LLM providers
 */

import { NextResponse } from 'next/server'
import { checkPresidiumHealth, PRESIDIUM_CONFIG } from '@/lib/presidium-ai'

export async function GET() {
  const providers: {
    name: string
    provider: string
    baseUrl: string
    available: boolean
    models: string[]
    error?: string
  }[] = []

  // Check Presidium AI (Ollama)
  try {
    const health = await checkPresidiumHealth()

    providers.push({
      name: 'Presidium AI (Ollama)',
      provider: 'presidium',
      baseUrl: PRESIDIUM_CONFIG.ollama.url,
      available: health.ollama.available,
      models: health.ollama.models,
    })

    // Add Chatterbox voice status
    providers.push({
      name: 'Presidium AI (Chatterbox)',
      provider: 'chatterbox',
      baseUrl: PRESIDIUM_CONFIG.chatterbox.url,
      available: health.chatterbox,
      models: health.chatterbox ? ['tts-1', 'voice-clone'] : [],
    })
  } catch (error) {
    providers.push({
      name: 'Presidium AI (Ollama)',
      provider: 'presidium',
      baseUrl: PRESIDIUM_CONFIG.ollama.url,
      available: false,
      models: [],
      error: error instanceof Error ? error.message : 'Connection failed',
    })
  }

  // Check local LM Studio as fallback
  try {
    const lmStudioUrl = process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1'
    const response = await fetch(`${lmStudioUrl}/models`, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null)

    if (response?.ok) {
      const data = await response.json()
      providers.push({
        name: 'LM Studio (Local)',
        provider: 'lmstudio',
        baseUrl: lmStudioUrl,
        available: true,
        models: data.data?.map((m: any) => m.id) || [],
      })
    }
  } catch {
    // LM Studio not available, that's ok
  }

  // Check OpenAI if API key exists
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'OpenAI (Cloud Fallback)',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      available: true,
      models: ['gpt-4o', 'gpt-4o-mini'],
    })
  }

  // Find active provider (prioritize Presidium AI)
  const presidiumProvider = providers.find(p => p.provider === 'presidium' && p.available)
  const activeProvider = presidiumProvider || providers.find(p => p.available)

  return NextResponse.json({
    providers,
    activeProvider: activeProvider?.name || null,
    hasLocalLLM: providers.some(p => p.available && p.provider !== 'openai'),
    hasCloudLLM: providers.some(p => p.available && p.provider === 'openai'),
    hasVoice: providers.some(p => p.provider === 'chatterbox' && p.available),
    presidium: {
      ollama: {
        url: PRESIDIUM_CONFIG.ollama.url,
        models: PRESIDIUM_CONFIG.ollama.models,
      },
      chatterbox: {
        url: PRESIDIUM_CONFIG.chatterbox.url,
      },
    },
  })
}
