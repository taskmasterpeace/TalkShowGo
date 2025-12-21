'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Mic,
  Twitter,
  Newspaper,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

interface APIKeysStepProps {
  onNext: () => void
  onBack: () => void
  onVerified: (verified: {
    elevenlabs: boolean
    twitter: boolean
    thenewsapi: boolean
    newsdata: boolean
  }) => void
  initialVerified: {
    elevenlabs: boolean
    twitter: boolean
    thenewsapi: boolean
    newsdata: boolean
  }
}

interface APIKeyStatus {
  id: 'elevenlabs' | 'twitter' | 'thenewsapi' | 'newsdata'
  name: string
  description: string
  status: 'checking' | 'connected' | 'missing' | 'error'
  message?: string
  icon: React.ReactNode
  required: boolean
  docsLink: string
  signupLink: string
}

export function APIKeysStep({
  onNext,
  onBack,
  onVerified,
  initialVerified,
}: APIKeysStepProps) {
  const [apiKeys, setApiKeys] = useState<APIKeyStatus[]>([
    {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      description: 'Text-to-speech and voice cloning',
      status: 'checking',
      icon: <Mic className="h-5 w-5" />,
      required: true,
      docsLink: '/docs/api-keys/ELEVENLABS.md',
      signupLink: 'https://elevenlabs.io',
    },
    {
      id: 'twitter',
      name: 'Twitter API',
      description: 'Social media monitoring via twitterapi.io',
      status: 'checking',
      icon: <Twitter className="h-5 w-5" />,
      required: false,
      docsLink: '/docs/api-keys/TWITTER.md',
      signupLink: 'https://twitterapi.io',
    },
    {
      id: 'thenewsapi',
      name: 'TheNewsAPI',
      description: 'Primary news aggregation',
      status: 'checking',
      icon: <Newspaper className="h-5 w-5" />,
      required: false,
      docsLink: '/docs/api-keys/NEWS-APIS.md',
      signupLink: 'https://thenewsapi.com',
    },
    {
      id: 'newsdata',
      name: 'NewsData.io',
      description: 'Backup news source',
      status: 'checking',
      icon: <Newspaper className="h-5 w-5" />,
      required: false,
      docsLink: '/docs/api-keys/NEWS-APIS.md',
      signupLink: 'https://newsdata.io',
    },
  ])
  const [checking, setChecking] = useState(false)

  const checkApiKeys = async () => {
    setChecking(true)

    setApiKeys(prev =>
      prev.map(k => ({ ...k, status: 'checking' as const }))
    )

    try {
      const response = await fetch('/api/system/status')
      const data = await response.json()

      setApiKeys(prev =>
        prev.map(key => {
          let status: 'connected' | 'missing' | 'error' = 'missing'
          let message = ''

          if (key.id === 'elevenlabs') {
            const voiceStatus = data.services?.voice?.elevenlabs
            if (voiceStatus?.status === 'connected') {
              status = 'connected'
              message = voiceStatus.message || ''
            } else if (voiceStatus?.status === 'missing') {
              status = 'missing'
              message = 'API key not configured'
            } else {
              status = 'error'
              message = voiceStatus?.message || 'Connection error'
            }
          } else if (key.id === 'twitter') {
            const twitterStatus = data.services?.content?.twitter
            if (twitterStatus?.status === 'connected') {
              status = 'connected'
              message = twitterStatus.message || ''
            } else if (twitterStatus?.status === 'missing') {
              status = 'missing'
            } else {
              status = 'error'
              message = twitterStatus?.message || ''
            }
          } else if (key.id === 'thenewsapi') {
            const newsStatus = data.services?.news?.thenewsapi
            if (newsStatus?.status === 'connected') {
              status = 'connected'
              message = newsStatus.message || ''
            } else if (newsStatus?.status === 'missing') {
              status = 'missing'
            } else {
              status = 'error'
              message = newsStatus?.message || ''
            }
          } else if (key.id === 'newsdata') {
            const newsStatus = data.services?.news?.newsdata
            if (newsStatus?.status === 'connected') {
              status = 'connected'
              message = newsStatus.message || ''
            } else if (newsStatus?.status === 'missing') {
              status = 'missing'
            } else {
              status = 'error'
              message = newsStatus?.message || ''
            }
          }

          return { ...key, status, message }
        })
      )
    } catch (error) {
      setApiKeys(prev =>
        prev.map(k => ({
          ...k,
          status: 'error' as const,
          message: 'Failed to check status',
        }))
      )
    }

    setChecking(false)
  }

  useEffect(() => {
    checkApiKeys()
  }, [])

  useEffect(() => {
    onVerified({
      elevenlabs: apiKeys.find(k => k.id === 'elevenlabs')?.status === 'connected',
      twitter: apiKeys.find(k => k.id === 'twitter')?.status === 'connected',
      thenewsapi: apiKeys.find(k => k.id === 'thenewsapi')?.status === 'connected',
      newsdata: apiKeys.find(k => k.id === 'newsdata')?.status === 'connected',
    })
  }, [apiKeys, onVerified])

  const requiredConnected = apiKeys
    .filter(k => k.required)
    .every(k => k.status === 'connected')

  const connectedCount = apiKeys.filter(k => k.status === 'connected').length

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">API Keys</h2>
        <p className="text-muted-foreground">
          Connect to external services for voice, social media, and news
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Connections</CardTitle>
              <CardDescription>
                {connectedCount} of {apiKeys.length} services connected
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkApiKeys}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeys.map(key => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    key.status === 'connected'
                      ? 'bg-green-500/10 text-green-500'
                      : key.status === 'error'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {key.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{key.name}</p>
                    {key.required && (
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {key.description}
                  </p>
                  {key.message && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {key.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {key.status === 'checking' ? (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Checking
                  </Badge>
                ) : key.status === 'connected' ? (
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : key.status === 'missing' ? (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Set
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {!requiredConnected && (
        <Card className="max-w-2xl mx-auto border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Required: ElevenLabs API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ElevenLabs is required for voice generation. Add your key to{' '}
              <code>.env.local</code>:
            </p>
            <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
              ELEVENLABS_API_KEY=your_key_here
            </pre>
            <div className="flex gap-2">
              <a
                href="https://elevenlabs.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="default" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Get API Key
                </Button>
              </a>
              <Link href="/docs/api-keys/ELEVENLABS.md">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Setup Guide
                </Button>
              </Link>
            </div>
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
          disabled={!requiredConnected}
          className="gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {!requiredConnected && (
        <p className="text-center text-sm text-muted-foreground">
          ElevenLabs API key is required to continue
        </p>
      )}
    </div>
  )
}
