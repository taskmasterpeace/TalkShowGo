'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Newspaper,
  Youtube,
  Twitter,
  Database,
  Mic,
  Brain,
  Globe,
  Rss,
} from 'lucide-react'

interface ServiceHealth {
  name: string
  status: 'connected' | 'error' | 'missing' | 'rate_limited' | 'warning'
  message: string
  details?: Record<string, any>
  configuredKey?: string
}

interface SystemHealthReport {
  success: boolean
  timestamp: string
  overall: string
  statusCounts: {
    connected: number
    error: number
    missing: number
    rate_limited: number
    warning: number
  }
  services: {
    news: ServiceHealth[]
    content: ServiceHealth[]
    ai: ServiceHealth[]
    voice: ServiceHealth[]
    database: ServiceHealth[]
  }
  environment: {
    nodeEnv: string
    hasTheNewsAPI: boolean
    hasNewsDataIO: boolean
    hasDiaTTS: boolean
    hasTwitterAPI: boolean
    hasAnthropicAPI: boolean
    ollamaHost: string
    searxngUrl: string
  }
}

const STATUS_CONFIG = {
  connected: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'Connected',
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'Error',
  },
  missing: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'Missing',
  },
  rate_limited: {
    icon: Clock,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    label: 'Rate Limited',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'Warning',
  },
}

const CATEGORY_ICONS = {
  news: Newspaper,
  content: Globe,
  ai: Brain,
  voice: Mic,
  database: Database,
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  'TheNewsAPI': Newspaper,
  'NewsData.io': Newspaper,
  'RSS Feeds': Rss,
  'YouTube': Youtube,
  'Twitter': Twitter,
  'SearXNG': Globe,
  'Ollama': Brain,
  'Claude API': Brain,
  'Dia TTS': Mic,
  'PostgreSQL': Database,
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const config = STATUS_CONFIG[service.status]
  const StatusIcon = config.icon
  const ServiceIcon = SERVICE_ICONS[service.name] || Activity

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${config.border} ${config.bg}`}>
      <ServiceIcon className={`h-5 w-5 ${config.color} mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{service.name}</span>
          <StatusIcon className={`h-4 w-4 ${config.color}`} />
        </div>
        <p className="text-sm text-muted-foreground truncate">{service.message}</p>
        {service.configuredKey && (
          <p className="text-xs text-muted-foreground mt-1">
            Key: <code className="bg-muted px-1 rounded">{service.configuredKey}</code>
          </p>
        )}
        {service.details && (
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            {Object.entries(service.details).slice(0, 3).map(([key, value]) => (
              <div key={key}>
                {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryCard({
  title,
  icon: Icon,
  services,
}: {
  title: string
  icon: React.ElementType
  services: ServiceHealth[]
}) {
  const connectedCount = services.filter(s => s.status === 'connected').length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant={connectedCount === services.length ? 'default' : 'secondary'}>
            {connectedCount}/{services.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {services.map((service, idx) => (
          <ServiceCard key={idx} service={service} />
        ))}
      </CardContent>
    </Card>
  )
}

export default function SystemStatusPage() {
  const [report, setReport] = useState<SystemHealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/system/status')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch status')
      }

      setReport(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const overallConfig = report ? STATUS_CONFIG[report.overall as keyof typeof STATUS_CONFIG] : STATUS_CONFIG.warning

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            SYSTEM STATUS
          </h1>
          <p className="text-muted-foreground">
            Monitor all connected services and APIs
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !report && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Checking system health...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Report */}
      {report && (
        <>
          {/* Overall Status */}
          <Card className={`${overallConfig.border} ${overallConfig.bg}`}>
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <overallConfig.icon className={`h-12 w-12 ${overallConfig.color}`} />
                  <div>
                    <h2 className="text-2xl font-bold">
                      System {overallConfig.label}
                    </h2>
                    <p className="text-muted-foreground">
                      {report.statusCounts.connected} connected, {report.statusCounts.missing} missing, {report.statusCounts.error} errors
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    {report.statusCounts.connected} Connected
                  </Badge>
                  {report.statusCounts.missing > 0 && (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                      {report.statusCounts.missing} Missing
                    </Badge>
                  )}
                  {report.statusCounts.error > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                      {report.statusCounts.error} Errors
                    </Badge>
                  )}
                  {report.statusCounts.rate_limited > 0 && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                      {report.statusCounts.rate_limited} Rate Limited
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CategoryCard
              title="News Sources"
              icon={CATEGORY_ICONS.news}
              services={report.services.news}
            />
            <CategoryCard
              title="Content Sources"
              icon={CATEGORY_ICONS.content}
              services={report.services.content}
            />
            <CategoryCard
              title="AI Services"
              icon={CATEGORY_ICONS.ai}
              services={report.services.ai}
            />
            <CategoryCard
              title="Voice & Audio"
              icon={CATEGORY_ICONS.voice}
              services={report.services.voice}
            />
            <CategoryCard
              title="Database"
              icon={CATEGORY_ICONS.database}
              services={report.services.database}
            />
          </div>

          {/* Environment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Environment Configuration</CardTitle>
              <CardDescription>
                Current environment variables and configuration status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(report.environment).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="font-medium">
                      {typeof value === 'boolean' ? (
                        value ? (
                          <span className="text-green-500">Configured</span>
                        ) : (
                          <span className="text-yellow-500">Not Set</span>
                        )
                      ) : (
                        <span className="text-sm">{value}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>
                Common tasks to resolve configuration issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-medium">Missing API Keys?</h3>
                  <p className="text-sm text-muted-foreground">
                    Add your API keys to the <code className="bg-muted px-1 rounded">.env.local</code> file.
                  </p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`THENEWSAPI_KEY=your_key
NEWSDATA_API_KEY=your_key`}
                  </pre>
                </div>
                <div className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-medium">SearXNG Not Running?</h3>
                  <p className="text-sm text-muted-foreground">
                    Start the Docker services:
                  </p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`docker-compose up -d`}
                  </pre>
                </div>
                <div className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-medium">Ollama Connection Issues?</h3>
                  <p className="text-sm text-muted-foreground">
                    Check the Ollama host configuration:
                  </p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`OLLAMA_HOST=http://192.168.1.211:11434`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
