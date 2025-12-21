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
  User,
} from 'lucide-react'
import Link from 'next/link'

interface VoiceStepProps {
  onNext: () => void
  onBack: () => void
  onVerified: (verified: boolean) => void
}

interface VoiceInfo {
  id: string
  name: string
  category: string
}

export function VoiceStep({ onNext, onBack, onVerified }: VoiceStepProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [credits, setCredits] = useState<string | null>(null)

  const checkVoiceService = async () => {
    setStatus('checking')

    try {
      const response = await fetch('/api/system/status')
      const data = await response.json()

      const voiceStatus = data.services?.voice?.elevenlabs
      if (voiceStatus?.status === 'connected') {
        setStatus('connected')

        // Parse credits from message if available
        if (voiceStatus.message) {
          const creditsMatch = voiceStatus.message.match(/(\d+[\d,]*)\s*credits/i)
          if (creditsMatch) {
            setCredits(creditsMatch[1])
          }
        }

        // Fetch available voices
        await fetchVoices()
      } else {
        setStatus('error')
      }
    } catch (error) {
      setStatus('error')
    }
  }

  const fetchVoices = async () => {
    try {
      // This would call an endpoint to list voices
      // For now, we'll show default voices
      setVoices([
        { id: 'ZJ7BlVZrxZKBDMTIK5c9', name: 'Battlerap Algorithm', category: 'Cloned' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'Pre-made' },
        { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'Pre-made' },
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'Pre-made' },
      ])
      setSelectedVoice('ZJ7BlVZrxZKBDMTIK5c9')
    } catch (error) {
      console.error('Failed to fetch voices:', error)
    }
  }

  const testVoice = async () => {
    if (!selectedVoice) return

    setTesting(true)
    setTestStatus('testing')

    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Welcome to Talk Show Go. Your AI-powered content generation platform.',
          voice_id: selectedVoice,
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
          Test and configure text-to-speech for your shows
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                ElevenLabs
              </CardTitle>
              <CardDescription>
                Voice generation service
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
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'connected' && (
            <>
              {credits && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Available Credits</span>
                  <Badge variant="secondary">{credits} credits</Badge>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Available Voices
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {voices.map(voice => (
                    <div
                      key={voice.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedVoice === voice.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedVoice(voice.id)}
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{voice.name}</span>
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {voice.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={testVoice}
                  disabled={testing || !selectedVoice}
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
                ElevenLabs is not connected. Please configure your API key.
              </p>
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
                <Link href="/docs/services/VOICE.md">
                  <Button variant="outline" size="sm" className="gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Voice Setup Guide
                  </Button>
                </Link>
              </div>
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
