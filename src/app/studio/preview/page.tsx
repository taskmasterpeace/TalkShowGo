'use client'

import { useState, useRef, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Progress,
  Textarea,
} from '@/components/ui'
import {
  Play,
  Pause,
  Volume2,
  Mic,
  Loader2,
  RotateCcw,
  Download,
  Sparkles,
} from 'lucide-react'

export default function PreviewPage() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [customText, setCustomText] = useState('')
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Pre-generated intro
  const introAudioUrl = '/audio/algorithm-institute-intro.mp3'

  useEffect(() => {
    const audio = new Audio(introAudioUrl)
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
    })

    audio.addEventListener('timeupdate', () => {
      setProgress((audio.currentTime / audio.duration) * 100)
    })

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setProgress(0)
    })

    return () => {
      audio.pause()
      audio.remove()
    }
  }, [])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const restart = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play()
    setIsPlaying(true)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const generateCustom = async () => {
    if (!customText.trim()) return

    setGenerating(true)
    try {
      const response = await fetch('/api/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: customText,
          voice_id: 'ZJ7BlVZrxZKBDMTIK5c9', // Battlerap Algorithm voice
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.1,
        }),
      })

      if (!response.ok) throw new Error('Generation failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setCustomAudioUrl(url)
    } catch (error) {
      console.error('Error generating speech:', error)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AppShell topicName="Studio">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-head text-3xl flex items-center gap-3">
            <Volume2 className="h-8 w-8 text-primary" />
            Voice Preview
          </h1>
          <p className="text-muted-foreground">
            Listen to AI-generated narrations with your Algorithm Institute voice
          </p>
        </div>

        {/* Main Player */}
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Algorithm Institute Intro
                </CardTitle>
                <CardDescription>
                  Generated with your &quot;Battlerap Algorithm&quot; cloned voice
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10">
                YOUR VOICE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Waveform / Progress */}
            <div className="space-y-2">
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime((progress / 100) * duration)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={restart}>
                <RotateCcw className="h-4 w-4" />
              </Button>

              <Button
                size="lg"
                className="w-16 h-16 rounded-full"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-1" />
                )}
              </Button>

              <a href={introAudioUrl} download="algorithm-institute-intro.mp3">
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
            </div>

            {/* Script Preview */}
            <div className="p-4 bg-muted border-2 border-foreground text-sm">
              <p className="font-semibold mb-2">Script:</p>
              <p className="text-muted-foreground leading-relaxed">
                &quot;In the world of battle rap, legends aren&apos;t born. They&apos;re forged in the fire
                of verbal combat, tested by the culture, and remembered by the streets...&quot;
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Custom Generation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate Custom Narration
            </CardTitle>
            <CardDescription>
              Enter your own text and generate audio with the Algorithm Institute voice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter text to narrate... (e.g., 'In the world of battle rap, this battle changed everything...')"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={4}
            />

            <div className="flex items-center gap-4">
              <Button
                onClick={generateCustom}
                disabled={generating || !customText.trim()}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Generate Audio
                  </>
                )}
              </Button>

              {customAudioUrl && (
                <audio controls src={customAudioUrl} className="flex-1" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Voice Info */}
        <Card>
          <CardHeader>
            <CardTitle>Voice Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border-2 border-foreground">
                <p className="text-xs text-muted-foreground">Voice Name</p>
                <p className="font-semibold">Battlerap Algorithm</p>
              </div>
              <div className="p-3 border-2 border-foreground">
                <p className="text-xs text-muted-foreground">Voice ID</p>
                <p className="font-mono text-sm">ZJ7BlVZrxZKBDMTIK5c9</p>
              </div>
              <div className="p-3 border-2 border-foreground">
                <p className="text-xs text-muted-foreground">Stability</p>
                <p className="font-semibold">0.75</p>
              </div>
              <div className="p-3 border-2 border-foreground">
                <p className="text-xs text-muted-foreground">Similarity Boost</p>
                <p className="font-semibold">0.85</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
