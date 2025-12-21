'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Mic,
  Radio,
  Search,
  Brain,
  Database,
  Clock,
  ArrowRight,
  BookOpen,
  SkipForward,
} from 'lucide-react'
import Link from 'next/link'

interface WelcomeStepProps {
  onNext: () => void
  onSkip: () => void
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Radio className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold">Welcome to Talk Show Go</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          AI-powered content generation for talk shows, documentaries, and narrative storytelling.
          Let&apos;s get you set up.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <Card>
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
              <Search className="h-6 w-6 text-blue-500" />
            </div>
            <CardTitle className="text-lg">Automated Research</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Scans Twitter, YouTube, and news sources for trending topics in your niche
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
              <Brain className="h-6 w-6 text-purple-500" />
            </div>
            <CardTitle className="text-lg">AI Intelligence</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Extracts entities, builds narratives, and generates scripts with AI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
              <Mic className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle className="text-lg">Voice Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Creates professional audio with 7 host personalities and custom voices
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Setup Overview
          </CardTitle>
          <CardDescription>
            Estimated time: 10-15 minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">1</Badge>
            <div>
              <p className="font-medium">Docker Services</p>
              <p className="text-sm text-muted-foreground">Verify PostgreSQL, Redis, and SearXNG</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">2</Badge>
            <div>
              <p className="font-medium">AI/LLM Configuration</p>
              <p className="text-sm text-muted-foreground">Set up Ollama or cloud AI providers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">3</Badge>
            <div>
              <p className="font-medium">API Keys</p>
              <p className="text-sm text-muted-foreground">Configure ElevenLabs, Twitter, and news sources</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">4</Badge>
            <div>
              <p className="font-medium">Voice Setup</p>
              <p className="text-sm text-muted-foreground">Test and configure text-to-speech</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">5</Badge>
            <div>
              <p className="font-medium">Verification</p>
              <p className="text-sm text-muted-foreground">Final system check and you&apos;re ready!</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-4 pt-4">
        <Button size="lg" onClick={onNext} className="gap-2">
          Start Setup
          <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onSkip} className="gap-2">
            <SkipForward className="h-4 w-4" />
            Skip Setup
          </Button>
          <span>|</span>
          <Link href="/docs/DEPLOYMENT.md" className="flex items-center gap-1 hover:text-foreground">
            <BookOpen className="h-4 w-4" />
            View Documentation
          </Link>
        </div>
      </div>
    </div>
  )
}
