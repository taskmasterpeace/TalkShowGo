'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Mic,
  Volume2,
  Play,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'

interface VoiceStepProps {
  onNext: () => void
  onBack: () => void
  onVerified: (verified: boolean) => void
}

export function VoiceStep({ onNext, onBack, onVerified }: VoiceStepProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [testing, setTesting] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [diaInfo, setDiaInfo] = useState<{ device?: string; emotions?: number } | null>(null)

  const checkVoiceService = async () => {
    setStatus('checking')

    try {
      const response = await fetch('/api/voices')
      const data = await response.json()

      if (data.configured) {
        setStatus('connected')
        setDiaInfo({
          emotions: data.supported_emotions?.length || 0,
        })
      } else {
        setStatus('error')
      }
    } catch (error) {
      setStatus('error')
    }
  }

  const testVoice = async () => {
    setTesting(true)
    setTestStatus('testing')

    try {
      const response = await fetch('/api/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Welcome to Talk Show Go. Your AI-powered content generation platform.',
          seed: 42,
        }),
      })

      if (response.ok) {
        setTestStatus('success')
        // Play the audio if returned
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.play()
      } else {
        setTestStatus('error')
      }
    } catch (error) {
      setTestStatus('error')
    }

    setTesting(false)
  }

  useEffect(() => {
    checkVoiceService()
  }, [])

  useEffect(() => {
    onVerified(status === 'connected')
  }, [status, onVerified])

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Voice Configuration</h2>
        <p className="text-muted-foreground">
          Test and configure Dia TTS for your shows
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Dia TTS
              </CardTitle>
              <CardDescription>
                Local multi-voice text-to-speech service
              </CardDescription>
            </div>
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
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Not Running
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'connected' && (
            <>
              <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between">
                  <span>Multi-voice support</span>
                  <Badge variant="secondary">[S1] / [S2] speakers</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Emotional markers</span>
                  <Badge variant="secondary">{diaInfo?.emotions || 'many'} supported</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Cost</span>
                  <Badge variant="secondary">Free (local)</Badge>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={testVoice}
                  disabled={testing}
                  variant="outline"
                  className="gap-2"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Test Voice
                </Button>

                {testStatus === 'success' && (
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Voice test successful
                  </Badge>
                )}
                {testStatus === 'error' && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Test failed
                  </Badge>
                )}
              </div>
            </>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Dia TTS is not running. Start it with Docker:
              </p>
              <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                npm run dia:up
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {status === 'connected' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg">Host Personalities</CardTitle>
            <CardDescription>
              Talk Show Go includes 7 AI host personalities with unique styles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-muted rounded">
                <span className="font-medium">Maya Sterling</span>
                <span className="text-muted-foreground"> - Investigative</span>
              </div>
              <div className="p-2 bg-muted rounded">
                <span className="font-medium">Marcus Blaze</span>
                <span className="text-muted-foreground"> - Hot Takes</span>
              </div>
              <div className="p-2 bg-muted rounded">
                <span className="font-medium">Devon Sharp</span>
                <span className="text-muted-foreground"> - Satirist</span>
              </div>
              <div className="p-2 bg-muted rounded">
                <span className="font-medium">Tasha Raw</span>
                <span className="text-muted-foreground"> - Real Talk</span>
              </div>
              <div className="p-2 bg-muted rounded">
                <span className="font-medium">James Noble</span>
                <span className="text-muted-foreground"> - Documentary</span>
              </div>
              <div className="p-2 bg-muted rounded">
                <span className="font-medium">DJ Momentum</span>
                <span className="text-muted-foreground"> - High Energy</span>
              </div>
              <div className="p-2 bg-muted rounded col-span-2">
                <span className="font-medium">King Knowledge</span>
                <span className="text-muted-foreground"> - Street Analyst</span>
              </div>
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
          disabled={status !== 'connected'}
          className="gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
