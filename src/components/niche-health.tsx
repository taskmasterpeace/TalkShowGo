'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Progress,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Twitter,
  Youtube,
  Rss,
  Database,
  Brain,
  Search,
  Key,
  Users,
  FileText,
  Activity,
  Loader2,
} from 'lucide-react'
import { NicheHealth, NicheRequirement, LayerHealth, getStatusColor, getStatusIcon } from '@/lib/niche/types'

interface NicheHealthDashboardProps {
  topicId: string
  compact?: boolean
}

const categoryIcons: Record<string, any> = {
  sources: Twitter,
  data: Database,
  api: Key,
  config: Activity,
}

const requirementIcons: Record<string, any> = {
  twitter_sources: Twitter,
  youtube_channels: Youtube,
  rss_feeds: Rss,
  official_accounts: Users,
  entities_seeded: Users,
  credibility_profile: FileText,
  web_resources: Search,
  twitter_api: Twitter,
  youtube_api: Youtube,
  openai_api: Brain,
  database_connected: Database,
}

const statusIcons: Record<string, any> = {
  healthy: CheckCircle,
  online: CheckCircle,
  degraded: AlertTriangle,
  failing: XCircle,
  offline: XCircle,
  critical: XCircle,
  missing: HelpCircle,
  not_configured: HelpCircle,
}

export function NicheHealthDashboard({ topicId, compact = false }: NicheHealthDashboardProps) {
  const [health, setHealth] = useState<NicheHealth | null>(null)
  const [layers, setLayers] = useState<LayerHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/health`)
      if (!res.ok) throw new Error('Failed to fetch health')
      const data = await res.json()
      setHealth(data.health)
      setLayers(data.layers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [topicId])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Checking system health...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span>Error: {error}</span>
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchHealth}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!health) return null

  const StatusIcon = statusIcons[health.overallStatus] || HelpCircle

  // Group requirements by category
  const byCategory = health.requirements.reduce((acc, req) => {
    if (!acc[req.category]) acc[req.category] = []
    acc[req.category].push(req)
    return acc
  }, {} as Record<string, NicheRequirement[]>)

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon
                className={`h-6 w-6 ${
                  health.overallStatus === 'healthy'
                    ? 'text-success'
                    : health.overallStatus === 'degraded'
                    ? 'text-warning'
                    : health.overallStatus === 'critical'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              />
              <div>
                <p className="font-semibold">{health.topicName} Health</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {health.overallStatus.replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-head text-2xl">{health.score}%</p>
              <Button variant="ghost" size="sm" onClick={fetchHealth}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div
                className={`p-4 border-2 border-foreground ${
                  health.overallStatus === 'healthy'
                    ? 'bg-success/20'
                    : health.overallStatus === 'degraded'
                    ? 'bg-warning/20'
                    : health.overallStatus === 'critical'
                    ? 'bg-destructive/20'
                    : 'bg-muted'
                }`}
              >
                <StatusIcon className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-head text-2xl">{health.topicName}</h2>
                <p className="text-muted-foreground capitalize">
                  Status: {health.overallStatus.replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-head text-4xl">{health.score}%</p>
              <p className="text-sm text-muted-foreground">Health Score</p>
            </div>
          </div>
          <Progress value={health.score} className="h-3" />
        </CardContent>
      </Card>

      {/* Requirements by Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(byCategory).map(([category, requirements]) => {
          const CategoryIcon = categoryIcons[category] || Activity
          const healthyCount = requirements.filter(r => r.status === 'healthy').length
          const allHealthy = healthyCount === requirements.length

          return (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg capitalize">
                  <CategoryIcon className="h-5 w-5" />
                  {category}
                  <Badge
                    variant={allHealthy ? 'success' : healthyCount > 0 ? 'warning' : 'destructive'}
                    size="sm"
                    className="ml-auto"
                  >
                    {healthyCount}/{requirements.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {requirements.map((req) => {
                    const ReqIcon = requirementIcons[req.id] || Activity
                    const ReqStatusIcon = statusIcons[req.status] || HelpCircle

                    return (
                      <div
                        key={req.id}
                        className="flex items-center gap-3 p-2 border-2 border-foreground/10 hover:border-foreground/30 transition-colors"
                      >
                        <ReqIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{req.name}</span>
                            {req.required && (
                              <Badge variant="outline" size="sm">
                                Required
                              </Badge>
                            )}
                          </div>
                          {req.details && (
                            <p className="text-xs text-muted-foreground truncate">
                              {req.details}
                            </p>
                          )}
                        </div>
                        <ReqStatusIcon
                          className={`h-4 w-4 flex-shrink-0 ${
                            req.status === 'healthy'
                              ? 'text-success'
                              : req.status === 'degraded'
                              ? 'text-warning'
                              : req.status === 'failing' || req.status === 'missing'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pipeline Layers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Pipeline Layers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {layers.map((layer) => {
              const LayerStatusIcon = statusIcons[layer.status] || HelpCircle

              return (
                <div
                  key={layer.layer}
                  className={`p-3 border-2 text-center ${
                    layer.status === 'online'
                      ? 'border-success bg-success/10'
                      : layer.status === 'degraded'
                      ? 'border-warning bg-warning/10'
                      : layer.status === 'offline'
                      ? 'border-destructive bg-destructive/10'
                      : 'border-foreground/20 bg-muted'
                  }`}
                >
                  <LayerStatusIcon
                    className={`h-6 w-6 mx-auto mb-2 ${
                      layer.status === 'online'
                        ? 'text-success'
                        : layer.status === 'degraded'
                        ? 'text-warning'
                        : layer.status === 'offline'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}
                  />
                  <p className="font-semibold text-sm">{layer.name.replace(' Layer', '')}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {layer.status.replace('_', ' ')}
                  </p>
                  {layer.metrics.itemsProcessed > 0 && (
                    <p className="text-xs mt-1">{layer.metrics.itemsProcessed} items</p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={fetchHealth} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Health Check
        </Button>
      </div>
    </div>
  )
}

export default NicheHealthDashboard
