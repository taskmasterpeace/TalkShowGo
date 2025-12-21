'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Brain,
  Cloud,
  Server,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

interface LLMStepProps {
  onNext: () => void
  onBack: () => void
  onVerified: (verified: boolean, type: 'ollama' | 'openai' | 'anthropic' | null) => void
  initialType: 'ollama' | 'openai' | 'anthropic' | null
}

type LLMProvider = 'ollama' | 'openai' | 'anthropic'

interface ProviderConfig {
  id: LLMProvider
  name: string
  description: string
  icon: React.ReactNode
  isLocal: boolean
  configField?: string
  placeholder?: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run AI models locally - free and private',
    icon: <Server className="h-6 w-6" />,
    isLocal: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4 and other OpenAI models',
    icon: <Cloud className="h-6 w-6" />,
    isLocal: false,
    configField: 'OPENAI_API_KEY',
    placeholder: 'sk-...',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude models for advanced reasoning',
    icon: <Brain className="h-6 w-6" />,
    isLocal: false,
    configField: 'ANTHROPIC_API_KEY',
    placeholder: 'sk-ant-...',
  },
]

export function LLMStep({ onNext, onBack, onVerified, initialType }: LLMStepProps) {
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(initialType)
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [models, setModels] = useState<string[]>([])

  const checkProvider = async (provider: LLMProvider) => {
    setStatus('checking')
    setStatusMessage('')
    setModels([])

    try {
      const response = await fetch('/api/system/status')
      const data = await response.json()

      if (provider === 'ollama') {
        const ollamaStatus = data.services?.ai?.ollama
        if (ollamaStatus?.status === 'connected') {
          setStatus('connected')
          setStatusMessage(ollamaStatus.message || 'Connected')
          // Parse models from message if available
          if (ollamaStatus.message?.includes('models:')) {
            const modelList = ollamaStatus.message.split('models:')[1]?.trim()
            if (modelList) {
              setModels(modelList.split(',').map((m: string) => m.trim()))
            }
          }
        } else {
          setStatus('error')
          setStatusMessage(ollamaStatus?.message || 'Not connected')
        }
      } else if (provider === 'openai') {
        const openaiStatus = data.services?.ai?.openai
        if (openaiStatus?.status === 'connected') {
          setStatus('connected')
          setStatusMessage('API key configured')
        } else if (openaiStatus?.status === 'missing') {
          setStatus('error')
          setStatusMessage('API key not configured')
        } else {
          setStatus('error')
          setStatusMessage(openaiStatus?.message || 'Not connected')
        }
      } else if (provider === 'anthropic') {
        const anthropicStatus = data.services?.ai?.anthropic
        if (anthropicStatus?.status === 'connected') {
          setStatus('connected')
          setStatusMessage('API key configured')
        } else if (anthropicStatus?.status === 'missing') {
          setStatus('error')
          setStatusMessage('API key not configured')
        } else {
          setStatus('error')
          setStatusMessage(anthropicStatus?.message || 'Not connected')
        }
      }
    } catch (error) {
      setStatus('error')
      setStatusMessage('Failed to check status')
    }
  }

  useEffect(() => {
    if (selectedProvider) {
      checkProvider(selectedProvider)
    }
  }, [selectedProvider])

  useEffect(() => {
    onVerified(status === 'connected', selectedProvider)
  }, [status, selectedProvider, onVerified])

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">AI/LLM Configuration</h2>
        <p className="text-muted-foreground">
          Choose how to power Talk Show Go&apos;s AI features
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {PROVIDERS.map(provider => (
          <Card
            key={provider.id}
            className={`cursor-pointer transition-all ${
              selectedProvider === provider.id
                ? 'border-primary ring-2 ring-primary/20'
                : 'hover:border-primary/50'
            }`}
            onClick={() => setSelectedProvider(provider.id)}
          >
            <CardHeader>
              <div
                className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                  selectedProvider === provider.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {provider.icon}
              </div>
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              <CardDescription>{provider.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={provider.isLocal ? 'secondary' : 'outline'}>
                  {provider.isLocal ? 'Self-hosted' : 'Cloud'}
                </Badge>
                {provider.isLocal && <Badge variant="outline">Free</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedProvider && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {PROVIDERS.find(p => p.id === selectedProvider)?.name} Status
              </CardTitle>
              {status === 'checking' ? (
                <Badge variant="secondary">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Checking
                </Badge>
              ) : status === 'connected' ? (
                <Badge className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : status === 'error' ? (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Error
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusMessage && (
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            )}

            {selectedProvider === 'ollama' && models.length > 0 && (
              <div className="space-y-2">
                <Label>Available Models</Label>
                <div className="flex flex-wrap gap-2">
                  {models.map(model => (
                    <Badge key={model} variant="outline">
                      {model}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedProvider === 'ollama' && status === 'error' && (
              <div className="space-y-3">
                <p className="text-sm">
                  Make sure Ollama is running. You can configure a remote Ollama instance:
                </p>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                  OLLAMA_HOST=http://localhost:11434
                </pre>
                <Link href="/docs/services/OLLAMA.md">
                  <Button variant="outline" size="sm" className="gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Ollama Setup Guide
                  </Button>
                </Link>
              </div>
            )}

            {(selectedProvider === 'openai' || selectedProvider === 'anthropic') &&
              status === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm">
                    Add your API key to <code>.env.local</code>:
                  </p>
                  <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                    {PROVIDERS.find(p => p.id === selectedProvider)?.configField}=
                    {PROVIDERS.find(p => p.id === selectedProvider)?.placeholder}
                  </pre>
                  <Link href="/docs/api-keys/OPTIONAL.md">
                    <Button variant="outline" size="sm" className="gap-1">
                      <ExternalLink className="h-3 w-3" />
                      API Keys Guide
                    </Button>
                  </Link>
                </div>
              )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => checkProvider(selectedProvider)}
              disabled={status === 'checking'}
            >
              {status === 'checking' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Re-check Connection
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between max-w-2xl mx-auto pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={status !== 'connected'}
          className="gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {status !== 'connected' && selectedProvider && (
        <p className="text-center text-sm text-muted-foreground">
          Connect to an LLM provider to continue
        </p>
      )}
    </div>
  )
}
