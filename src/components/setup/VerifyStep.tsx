'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Database,
  HardDrive,
  Search,
  Brain,
  Mic,
  Twitter,
  Newspaper,
  ArrowLeft,
  PartyPopper,
  ExternalLink,
  Tv,
  Settings,
} from 'lucide-react'
import Link from 'next/link'

interface VerifyStepProps {
  onBack: () => void
  onComplete: () => void
}

interface ServiceCheck {
  name: string
  category: string
  status: 'checking' | 'connected' | 'missing' | 'error'
  icon: React.ReactNode
  required: boolean
}

export function VerifyStep({ onBack, onComplete }: VerifyStepProps) {
  const [services, setServices] = useState<ServiceCheck[]>([
    // Infrastructure
    { name: 'PostgreSQL', category: 'Infrastructure', status: 'checking', icon: <Database className="h-4 w-4" />, required: true },
    { name: 'Redis', category: 'Infrastructure', status: 'checking', icon: <HardDrive className="h-4 w-4" />, required: true },
    { name: 'SearXNG', category: 'Infrastructure', status: 'checking', icon: <Search className="h-4 w-4" />, required: true },
    // AI
    { name: 'Ollama', category: 'AI', status: 'checking', icon: <Brain className="h-4 w-4" />, required: false },
    { name: 'OpenAI', category: 'AI', status: 'checking', icon: <Brain className="h-4 w-4" />, required: false },
    { name: 'Anthropic', category: 'AI', status: 'checking', icon: <Brain className="h-4 w-4" />, required: false },
    // Voice
    { name: 'Dia TTS', category: 'Voice', status: 'checking', icon: <Mic className="h-4 w-4" />, required: true },
    // Content
    { name: 'Twitter', category: 'Content', status: 'checking', icon: <Twitter className="h-4 w-4" />, required: false },
    { name: 'TheNewsAPI', category: 'News', status: 'checking', icon: <Newspaper className="h-4 w-4" />, required: false },
    { name: 'NewsData.io', category: 'News', status: 'checking', icon: <Newspaper className="h-4 w-4" />, required: false },
  ])
  const [checking, setChecking] = useState(false)
  const [checkComplete, setCheckComplete] = useState(false)

  const runFullCheck = async () => {
    setChecking(true)
    setCheckComplete(false)

    setServices(prev => prev.map(s => ({ ...s, status: 'checking' as const })))

    try {
      const response = await fetch('/api/system/status')
      const data = await response.json()

      setServices(prev =>
        prev.map(service => {
          let status: 'connected' | 'missing' | 'error' = 'error'

          // Map each service to its status in the API response
          switch (service.name) {
            case 'PostgreSQL':
              status = data.services?.database?.status === 'connected' ? 'connected' : 'error'
              break
            case 'Redis':
              status = data.services?.redis?.status === 'connected' ? 'connected' : 'error'
              break
            case 'SearXNG':
              status = data.services?.search?.searxng?.status === 'connected' ? 'connected' : 'error'
              break
            case 'Ollama':
              status = data.services?.ai?.ollama?.status === 'connected' ? 'connected' :
                       data.services?.ai?.ollama?.status === 'missing' ? 'missing' : 'error'
              break
            case 'OpenAI':
              status = data.services?.ai?.openai?.status === 'connected' ? 'connected' :
                       data.services?.ai?.openai?.status === 'missing' ? 'missing' : 'error'
              break
            case 'Anthropic':
              status = data.services?.ai?.anthropic?.status === 'connected' ? 'connected' :
                       data.services?.ai?.anthropic?.status === 'missing' ? 'missing' : 'error'
              break
            case 'Dia TTS':
              // Check if any voice service in the array is connected
              const voiceServices = data.services?.voice || []
              const diaService = Array.isArray(voiceServices)
                ? voiceServices.find((s: any) => s.name === 'Dia TTS')
                : voiceServices
              status = diaService?.status === 'connected' ? 'connected' :
                       diaService?.status === 'missing' ? 'missing' : 'error'
              break
            case 'Twitter':
              status = data.services?.content?.twitter?.status === 'connected' ? 'connected' :
                       data.services?.content?.twitter?.status === 'missing' ? 'missing' : 'error'
              break
            case 'TheNewsAPI':
              status = data.services?.news?.thenewsapi?.status === 'connected' ? 'connected' :
                       data.services?.news?.thenewsapi?.status === 'missing' ? 'missing' : 'error'
              break
            case 'NewsData.io':
              status = data.services?.news?.newsdata?.status === 'connected' ? 'connected' :
                       data.services?.news?.newsdata?.status === 'missing' ? 'missing' : 'error'
              break
          }

          return { ...service, status }
        })
      )
    } catch (error) {
      setServices(prev =>
        prev.map(s => ({ ...s, status: 'error' as const }))
      )
    }

    setChecking(false)
    setCheckComplete(true)
  }

  useEffect(() => {
    runFullCheck()
  }, [])

  const connectedCount = services.filter(s => s.status === 'connected').length
  const requiredConnected = services
    .filter(s => s.required)
    .every(s => s.status === 'connected')
  const hasAnyAI = services
    .filter(s => s.category === 'AI')
    .some(s => s.status === 'connected')

  const isReady = requiredConnected && hasAnyAI

  const categories = Array.from(new Set(services.map(s => s.category)))

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Final Verification</h2>
        <p className="text-muted-foreground">
          Running a complete system check
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                {connectedCount} of {services.length} services connected
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runFullCheck}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Re-check</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={(connectedCount / services.length) * 100} />

          {categories.map(category => (
            <div key={category} className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">
                {category}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {services
                  .filter(s => s.category === category)
                  .map(service => (
                    <div
                      key={service.name}
                      className="flex items-center justify-between p-2 border rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            service.status === 'connected'
                              ? 'text-green-500'
                              : service.status === 'missing'
                              ? 'text-muted-foreground'
                              : service.status === 'error'
                              ? 'text-red-500'
                              : 'text-muted-foreground'
                          }
                        >
                          {service.icon}
                        </span>
                        <span>{service.name}</span>
                        {service.required && (
                          <Badge variant="outline" className="text-[10px] px-1">
                            Req
                          </Badge>
                        )}
                      </div>
                      {service.status === 'checking' ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : service.status === 'connected' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : service.status === 'missing' ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {checkComplete && isReady && (
        <Card className="max-w-2xl mx-auto border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <PartyPopper className="h-5 w-5" />
              You&apos;re All Set!
            </CardTitle>
            <CardDescription>
              Talk Show Go is ready to create amazing content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              All required services are connected. You can now:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/studio/daily-show">
                <Button className="w-full gap-2">
                  <Tv className="h-4 w-4" />
                  Create Your First Show
                </Button>
              </Link>
              <Link href="/studio/system-status">
                <Button variant="outline" className="w-full gap-2">
                  <Settings className="h-4 w-4" />
                  View Full Status
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {checkComplete && !isReady && (
        <Card className="max-w-2xl mx-auto border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg">Almost There!</CardTitle>
            <CardDescription>
              Some required services need attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!requiredConnected && (
              <p className="text-sm">
                Required infrastructure services must be running. Make sure Docker is started.
              </p>
            )}
            {!hasAnyAI && (
              <p className="text-sm">
                At least one AI provider (Ollama, OpenAI, or Anthropic) must be configured.
              </p>
            )}
            <div className="flex gap-2">
              <Link href="/docs/troubleshooting/COMMON-ISSUES.md">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Troubleshooting Guide
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
          onClick={onComplete}
          disabled={!isReady}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Complete Setup
        </Button>
      </div>
    </div>
  )
}
