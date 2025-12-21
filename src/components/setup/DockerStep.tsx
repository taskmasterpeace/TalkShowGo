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
  Database,
  HardDrive,
  Search,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

interface DockerStepProps {
  onNext: () => void
  onBack: () => void
  onVerified: (verified: boolean) => void
}

interface ServiceStatus {
  name: string
  status: 'checking' | 'connected' | 'error'
  message?: string
  icon: React.ReactNode
  docsLink: string
}

export function DockerStep({ onNext, onBack, onVerified }: DockerStepProps) {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'PostgreSQL',
      status: 'checking',
      icon: <Database className="h-5 w-5" />,
      docsLink: '/docs/docker/SERVICES.md#postgresql',
    },
    {
      name: 'Redis',
      status: 'checking',
      icon: <HardDrive className="h-5 w-5" />,
      docsLink: '/docs/docker/SERVICES.md#redis',
    },
    {
      name: 'SearXNG',
      status: 'checking',
      icon: <Search className="h-5 w-5" />,
      docsLink: '/docs/services/SEARXNG.md',
    },
  ])
  const [checking, setChecking] = useState(false)

  const checkServices = async () => {
    setChecking(true)

    // Reset all to checking
    setServices(prev =>
      prev.map(s => ({ ...s, status: 'checking' as const }))
    )

    try {
      const response = await fetch('/api/system/status')
      const data = await response.json()

      setServices(prev =>
        prev.map(service => {
          let status: 'connected' | 'error' = 'error'
          let message = ''

          if (service.name === 'PostgreSQL') {
            status = data.services?.database?.status === 'connected' ? 'connected' : 'error'
            message = data.services?.database?.message || ''
          } else if (service.name === 'Redis') {
            status = data.services?.redis?.status === 'connected' ? 'connected' : 'error'
            message = data.services?.redis?.message || ''
          } else if (service.name === 'SearXNG') {
            status = data.services?.search?.searxng?.status === 'connected' ? 'connected' : 'error'
            message = data.services?.search?.searxng?.message || ''
          }

          return { ...service, status, message }
        })
      )
    } catch (error) {
      setServices(prev =>
        prev.map(s => ({
          ...s,
          status: 'error' as const,
          message: 'Failed to check status',
        }))
      )
    }

    setChecking(false)
  }

  useEffect(() => {
    checkServices()
  }, [])

  const allConnected = services.every(s => s.status === 'connected')
  const hasErrors = services.some(s => s.status === 'error')

  useEffect(() => {
    onVerified(allConnected)
  }, [allConnected, onVerified])

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Docker Services</h2>
        <p className="text-muted-foreground">
          Verify that the core infrastructure services are running
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>
                These services run in Docker containers
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkServices}
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
          {services.map(service => (
            <div
              key={service.name}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    service.status === 'connected'
                      ? 'bg-green-500/10 text-green-500'
                      : service.status === 'error'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {service.icon}
                </div>
                <div>
                  <p className="font-medium">{service.name}</p>
                  {service.message && (
                    <p className="text-sm text-muted-foreground">
                      {service.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {service.status === 'checking' ? (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Checking
                  </Badge>
                ) : service.status === 'connected' ? (
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
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

      {hasErrors && (
        <Card className="max-w-2xl mx-auto border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Make sure Docker is running and start the services:
            </p>
            <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
              docker compose up -d
            </pre>
            <div className="flex gap-2">
              <Link href="/docs/docker/DOCKER-SETUP.md">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Docker Setup Guide
                </Button>
              </Link>
              <Link href="/docs/troubleshooting/COMMON-ISSUES.md">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Troubleshooting
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
        <Button onClick={onNext} disabled={!allConnected} className="gap-2">
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {!allConnected && (
        <p className="text-center text-sm text-muted-foreground">
          All services must be connected to continue
        </p>
      )}
    </div>
  )
}
