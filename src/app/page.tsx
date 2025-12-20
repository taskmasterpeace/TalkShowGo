'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '@/components/layout'
import { useTopic } from '@/context/topic-context'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Progress,
} from '@/components/ui'
import {
  Activity,
  TrendingUp,
  Users,
  Newspaper,
  CheckCircle,
  AlertTriangle,
  Play,
  Clock,
  RefreshCw,
  Rocket,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

interface DashboardStats {
  activeSources: number
  entitiesTracked: number
  claimsAnalyzed: number
  storiesReady: number
  disputedClaims: number
}

interface RecentActivity {
  id: string
  type: 'tweet' | 'entity' | 'claim' | 'nomination' | 'story'
  message: string
  time: string
}

interface PipelineJob {
  id: string
  name: string
  status: 'running' | 'queued' | 'completed' | 'failed'
  progress: number
}

export default function Dashboard() {
  const { selectedTopic, isLoading: topicLoading } = useTopic()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [jobs, setJobs] = useState<PipelineJob[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    if (!selectedTopic) return

    setLoading(true)
    try {
      // Fetch jobs
      const jobsRes = await fetch('/api/jobs?limit=10')
      const jobsData = await jobsRes.json()

      // Fetch topic-specific data using selectedTopic from context
      const [sourcesRes, entitiesRes, claimsRes, storiesRes] = await Promise.all([
        fetch(`/api/topics/${selectedTopic.id}/sources`),
        fetch(`/api/topics/${selectedTopic.id}/entities`),
        fetch(`/api/claims?topic_id=${selectedTopic.id}`).catch(() => ({ json: () => [] })),
        fetch(`/api/stories?topic_id=${selectedTopic.id}&status=candidate`).catch(() => ({ json: () => [] })),
      ])

      const sources = await sourcesRes.json()
      const entities = await entitiesRes.json()
      const claims = await claimsRes.json()
      const stories = await storiesRes.json()

      setStats({
        activeSources: Array.isArray(sources) ? sources.length : 0,
        entitiesTracked: Array.isArray(entities) ? entities.length : 0,
        claimsAnalyzed: Array.isArray(claims) ? claims.length : 0,
        storiesReady: Array.isArray(stories) ? stories.length : 0,
        disputedClaims: Array.isArray(claims) ? claims.filter((c: any) => c.status === 'disputed').length : 0,
      })

      // Transform jobs data
      if (Array.isArray(jobsData)) {
        setJobs(jobsData.slice(0, 3).map((job: any) => ({
          id: job.id,
          name: job.job_type?.toUpperCase() || 'Unknown',
          status: job.status === 'running' ? 'running' : job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'queued',
          progress: job.status === 'completed' ? 100 : job.status === 'running' ? 50 : 0,
        })))

        // Create recent activity from jobs
        const recentFromJobs: RecentActivity[] = jobsData.slice(0, 5).map((job: any) => ({
          id: job.id,
          type: 'story' as const,
          message: `${job.job_type} job ${job.status}`,
          time: formatTimeAgo(new Date(job.created_at)),
        }))
        setActivity(recentFromJobs)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      setStats({
        activeSources: 0,
        entitiesTracked: 0,
        claimsAnalyzed: 0,
        storiesReady: 0,
        disputedClaims: 0,
      })
    }
    setLoading(false)
  }, [selectedTopic])

  useEffect(() => {
    if (selectedTopic) {
      fetchDashboardData()
    }
  }, [selectedTopic, fetchDashboardData])

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
  }

  const runPipeline = async () => {
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: 'full_pipeline' }),
      })
      if (res.ok) {
        fetchDashboardData()
      }
    } catch (error) {
      console.error('Failed to start pipeline:', error)
    }
  }

  const statsDisplay = [
    {
      name: 'Active Sources',
      value: stats?.activeSources ?? 0,
      change: 'monitoring',
      icon: Users,
      color: 'primary',
    },
    {
      name: 'Entities Tracked',
      value: stats?.entitiesTracked ?? 0,
      change: 'extracted',
      icon: TrendingUp,
      color: 'success',
    },
    {
      name: 'Claims Analyzed',
      value: stats?.claimsAnalyzed ?? 0,
      change: `${stats?.disputedClaims ?? 0} disputed`,
      icon: Activity,
      color: 'warning',
    },
    {
      name: 'Stories Ready',
      value: stats?.storiesReady ?? 0,
      change: 'candidates',
      icon: Newspaper,
      color: 'destructive',
    },
  ]

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl">Command Center</h1>
            <p className="text-muted-foreground">
              Real-time overview of your content intelligence pipeline
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button className="gap-2" onClick={runPipeline}>
              <Play className="h-4 w-4" />
              Run Full Pipeline
            </Button>
          </div>
        </div>

        {/* Getting Started Card - Show when setup is incomplete */}
        {selectedTopic && stats && (stats.activeSources < 10 || stats.storiesReady === 0) && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/20 border-2 border-primary">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-head text-lg">Getting Started with {selectedTopic.name}</h3>
                    <Sparkles className="h-4 w-4 text-warning" />
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Setup Progress</span>
                      <span className="font-medium">
                        {Math.round(
                          ((stats.activeSources >= 10 ? 25 : (stats.activeSources / 10) * 25) +
                          (stats.entitiesTracked >= 20 ? 25 : (stats.entitiesTracked / 20) * 25) +
                          (stats.storiesReady > 0 ? 25 : 0) +
                          (stats.claimsAnalyzed > 0 ? 25 : 0))
                        )}%
                      </span>
                    </div>
                    <Progress
                      value={
                        (stats.activeSources >= 10 ? 25 : (stats.activeSources / 10) * 25) +
                        (stats.entitiesTracked >= 20 ? 25 : (stats.entitiesTracked / 20) * 25) +
                        (stats.storiesReady > 0 ? 25 : 0) +
                        (stats.claimsAnalyzed > 0 ? 25 : 0)
                      }
                      className="h-2"
                    />
                  </div>

                  {/* Checklist */}
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-sm">
                      {selectedTopic ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <div className="h-4 w-4 border-2 border-muted-foreground rounded-full" />
                      )}
                      <span className={selectedTopic ? '' : 'text-muted-foreground'}>
                        Create a niche
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      {stats.activeSources >= 10 ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <div className="h-4 w-4 border-2 border-muted-foreground rounded-full" />
                      )}
                      <span className={stats.activeSources >= 10 ? '' : 'text-muted-foreground'}>
                        Add sources ({stats.activeSources}/10 minimum)
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      {stats.entitiesTracked >= 20 ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <div className="h-4 w-4 border-2 border-muted-foreground rounded-full" />
                      )}
                      <span className={stats.entitiesTracked >= 20 ? '' : 'text-muted-foreground'}>
                        Extract entities ({stats.entitiesTracked}/20 recommended)
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      {stats.storiesReady > 0 ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <div className="h-4 w-4 border-2 border-muted-foreground rounded-full" />
                      )}
                      <span className={stats.storiesReady > 0 ? '' : 'text-muted-foreground'}>
                        Create your first show
                      </span>
                    </li>
                  </ul>

                  {/* CTA Button */}
                  <Button
                    onClick={() => window.location.href = '/studio/daily-show'}
                    className="gap-2"
                  >
                    Create Daily Show
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsDisplay.map((stat) => (
            <Card key={stat.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.name}</p>
                    <p className="font-head text-3xl mt-1">
                      {loading ? '-' : stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.change}
                    </p>
                  </div>
                  <div
                    className={`p-3 border-2 border-foreground bg-${stat.color}`}
                  >
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest events from the pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity. Run the pipeline to get started.
                </div>
              ) : (
                activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 border-2 border-foreground hover:bg-muted transition-colors"
                  >
                    <div className="mt-0.5">
                      {item.type === 'tweet' && (
                        <Badge variant="primary" size="sm">
                          TWEET
                        </Badge>
                      )}
                      {item.type === 'entity' && (
                        <Badge variant="success" size="sm">
                          ENTITY
                        </Badge>
                      )}
                      {item.type === 'claim' && (
                        <Badge variant="warning" size="sm">
                          CLAIM
                        </Badge>
                      )}
                      {item.type === 'nomination' && (
                        <Badge variant="secondary" size="sm">
                          NOMINATION
                        </Badge>
                      )}
                      {item.type === 'story' && (
                        <Badge variant="destructive" size="sm">
                          JOB
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.time}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Pipeline Status */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Status</CardTitle>
              <CardDescription>Recent job runs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No jobs yet
                </div>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{job.name}</span>
                      <span className="flex items-center gap-1.5">
                        {job.status === 'running' && (
                          <>
                            <Clock className="h-3 w-3 animate-spin" />
                            <span className="text-xs">Running</span>
                          </>
                        )}
                        {job.status === 'queued' && (
                          <span className="text-xs text-muted-foreground">
                            Queued
                          </span>
                        )}
                        {job.status === 'completed' && (
                          <>
                            <CheckCircle className="h-3 w-3 text-success" />
                            <span className="text-xs text-success">Done</span>
                          </>
                        )}
                        {job.status === 'failed' && (
                          <>
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            <span className="text-xs text-destructive">Failed</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="h-2 border-2 border-foreground bg-muted">
                      <div
                        className={`h-full ${
                          job.status === 'completed'
                            ? 'bg-success'
                            : job.status === 'running'
                            ? 'bg-primary'
                            : job.status === 'failed'
                            ? 'bg-destructive'
                            : 'bg-muted'
                        }`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={() => window.location.href = '/outpost'}>
                <Users className="h-4 w-4" />
                Add Source
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.location.href = '/perimeter'}>
                <Activity className="h-4 w-4" />
                Run PERIMETER
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.location.href = '/extraction'}>
                <TrendingUp className="h-4 w-4" />
                Run EXTRACTION
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.location.href = '/tribunal'}>
                <AlertTriangle className="h-4 w-4" />
                Review Nominations
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.location.href = '/nexus'}>
                <Newspaper className="h-4 w-4" />
                View Story Desk
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
