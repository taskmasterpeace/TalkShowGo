'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  DollarSign,
  Twitter,
  Youtube,
  Search,
  Mic,
  Brain,
  RefreshCw,
  TrendingUp,
  Calendar,
} from 'lucide-react'
import { API_PRICING, PERPLEXITY_MONTHLY_CREDITS, type UsageSummary, type APIUsageRecord } from '@/lib/api-usage'

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter className="h-5 w-5" />,
  youtube: <Youtube className="h-5 w-5" />,
  perplexity: <Search className="h-5 w-5" />,
  elevenlabs: <Mic className="h-5 w-5" />,
  llm: <Brain className="h-5 w-5" />,
  searxng: <Search className="h-5 w-5" />,
}

const SERVICE_COLORS: Record<string, string> = {
  twitter: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  youtube: 'bg-red-500/10 text-red-500 border-red-500/20',
  perplexity: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  elevenlabs: 'bg-green-500/10 text-green-500 border-green-500/20',
  llm: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  searxng: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

function formatCost(cost: number): string {
  if (cost === 0) return 'Free'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function UsageDashboardPage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [recentActivity, setRecentActivity] = useState<APIUsageRecord[]>([])
  const [perplexityCreditsRemaining, setPerplexityCreditsRemaining] = useState<number>(PERPLEXITY_MONTHLY_CREDITS)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/usage')
      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
        setRecentActivity(data.recentActivity || [])
        setPerplexityCreditsRemaining(data.perplexityCreditsRemaining ?? PERPLEXITY_MONTHLY_CREDITS)
      }
    } catch (error) {
      console.error('Failed to fetch usage data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const perplexityCreditsUsed = PERPLEXITY_MONTHLY_CREDITS - perplexityCreditsRemaining
  const perplexityProgress = (perplexityCreditsUsed / PERPLEXITY_MONTHLY_CREDITS) * 100

  return (
    <AppShell topicName="Settings">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              API USAGE & COSTS
            </h1>
            <p className="text-muted-foreground">
              Track API calls and estimated costs across all services
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          {/* Perplexity Credits */}
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4 text-purple-500" />
                Perplexity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {perplexityCreditsRemaining}/{PERPLEXITY_MONTHLY_CREDITS}
              </div>
              <p className="text-xs text-muted-foreground mb-2">credits remaining</p>
              <Progress value={perplexityProgress} className="h-2" />
            </CardContent>
          </Card>

          {/* Twitter */}
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Twitter className="h-4 w-4 text-blue-500" />
                Twitter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.byService?.twitter?.calls || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                calls this month
              </p>
              <p className="text-sm font-semibold text-green-600 mt-1">
                {formatCost(summary?.byService?.twitter?.cost || 0)}
              </p>
            </CardContent>
          </Card>

          {/* ElevenLabs */}
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mic className="h-4 w-4 text-green-500" />
                ElevenLabs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((summary?.byService?.elevenlabs?.calls || 0) / 1000).toFixed(1)}K
              </div>
              <p className="text-xs text-muted-foreground">
                characters used
              </p>
              <p className="text-sm font-semibold text-green-600 mt-1">
                {formatCost(summary?.byService?.elevenlabs?.cost || 0)}
              </p>
            </CardContent>
          </Card>

          {/* Total Cost */}
          <Card className="border-2 border-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Total This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCost(summary?.thisMonth?.cost || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary?.thisMonth?.calls || 0} API calls
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Recent Activity
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* By Service */}
              <Card>
                <CardHeader>
                  <CardTitle>Usage by Service</CardTitle>
                  <CardDescription>All-time usage breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {summary?.byService && Object.entries(summary.byService).map(([service, data]) => (
                      <div key={service} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border ${SERVICE_COLORS[service] || 'bg-gray-100'}`}>
                            {SERVICE_ICONS[service] || <Activity className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{service}</p>
                            <p className="text-sm text-muted-foreground">{data.calls} calls</p>
                          </div>
                        </div>
                        <Badge variant={data.cost > 0 ? 'default' : 'secondary'}>
                          {formatCost(data.cost)}
                        </Badge>
                      </div>
                    ))}
                    {(!summary?.byService || Object.keys(summary.byService).length === 0) && (
                      <p className="text-muted-foreground text-center py-4">No usage data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Time Periods */}
              <Card>
                <CardHeader>
                  <CardTitle>Usage Over Time</CardTitle>
                  <CardDescription>Costs by time period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">Today</p>
                        <p className="text-sm text-muted-foreground">{summary?.today?.calls || 0} calls</p>
                      </div>
                      <p className="text-lg font-bold">{formatCost(summary?.today?.cost || 0)}</p>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">This Week</p>
                        <p className="text-sm text-muted-foreground">{summary?.thisWeek?.calls || 0} calls</p>
                      </div>
                      <p className="text-lg font-bold">{formatCost(summary?.thisWeek?.cost || 0)}</p>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">This Month</p>
                        <p className="text-sm text-muted-foreground">{summary?.thisMonth?.calls || 0} calls</p>
                      </div>
                      <p className="text-lg font-bold">{formatCost(summary?.thisMonth?.cost || 0)}</p>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-primary/10 border-2 border-primary rounded-lg">
                      <div>
                        <p className="font-medium">All Time</p>
                        <p className="text-sm text-muted-foreground">{summary?.allTime?.calls || 0} calls</p>
                      </div>
                      <p className="text-lg font-bold text-primary">{formatCost(summary?.allTime?.cost || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent API Calls</CardTitle>
                <CardDescription>Last 50 API calls across all services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((record, index) => (
                      <div
                        key={record.id || index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border ${SERVICE_COLORS[record.service] || 'bg-gray-100'}`}>
                            {SERVICE_ICONS[record.service] || <Activity className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{record.service}</p>
                            <p className="text-sm text-muted-foreground">{record.endpoint}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={record.estimated_cost > 0 ? 'default' : 'secondary'}>
                            {formatCost(record.estimated_cost)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {record.created_at ? formatDate(record.created_at) : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Pricing Reference</CardTitle>
                <CardDescription>Estimated costs per 1,000 calls/items</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  {Object.entries(API_PRICING).map(([service, endpoints]) => (
                    <div key={service} className="space-y-2">
                      <h3 className="font-semibold capitalize flex items-center gap-2">
                        {SERVICE_ICONS[service]}
                        {service}
                      </h3>
                      <div className="space-y-1">
                        {Object.entries(endpoints).map(([endpoint, price]) => (
                          <div key={endpoint} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{endpoint.replace(/_/g, ' ')}</span>
                            <span className={price === 0 ? 'text-green-600' : ''}>
                              {price === 0 ? 'Free' : `$${price}/1K`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Search className="h-4 w-4 text-purple-500" />
                    Perplexity Sonar
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You have <strong>{PERPLEXITY_MONTHLY_CREDITS} free credits</strong> per month.
                    Each search query uses 1 credit. Credits reset on the 1st of each month.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
