'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { useTopic } from '@/context/topic-context'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
} from '@/components/ui'
import {
  Activity,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Radar,
  Youtube,
  Search,
  Network,
  Shield,
  Users,
  Newspaper,
  Send,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

// Job type definitions
const JOB_DEFINITIONS = [
  {
    id: 'perimeter_sweep',
    name: 'PERIMETER Sweep',
    description: 'Fetch tweets from sources',
    icon: Radar,
  },
  {
    id: 'relay_fetch',
    name: 'RELAY Fetch',
    description: 'Fetch from YouTube channels',
    icon: Youtube,
  },
  {
    id: 'recon_search',
    name: 'RECON Search',
    description: 'Search YouTube for topics',
    icon: Search,
  },
  {
    id: 'extraction_run',
    name: 'EXTRACTION Run',
    description: 'Extract entities and claims',
    icon: Network,
  },
  {
    id: 'audit_score',
    name: 'AUDIT Score',
    description: 'Calculate credibility scores',
    icon: Shield,
  },
  {
    id: 'tribunal_discover',
    name: 'TRIBUNAL Discover',
    description: 'Find new source nominations',
    icon: Users,
  },
  {
    id: 'nexus_bucket',
    name: 'NEXUS Bucket',
    description: 'Assemble story candidates',
    icon: Newspaper,
  },
  {
    id: 'signal_export',
    name: 'SIGNAL Export',
    description: 'Export to production',
    icon: Send,
  },
  {
    id: 'transcript_fetch',
    name: 'TRANSCRIPT Fetch',
    description: 'Fetch video transcripts',
    icon: Youtube,
  },
]

interface JobRun {
  id: string
  job_type: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  topic_id: string
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  items_processed: number | null
  errors: any[] | null
  metadata: any
  created_at: string
}

interface JobStatus {
  job_type: string
  last_run: JobRun | null
  runs_today: number
  success_rate: number
}

export default function JobsPage() {
  const { selectedTopic } = useTopic()
  const [jobStatuses, setJobStatuses] = useState<Map<string, JobStatus>>(new Map())
  const [recentRuns, setRecentRuns] = useState<JobRun[]>([])
  const [loading, setLoading] = useState(true)
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null)
  const [retryingJob, setRetryingJob] = useState<string | null>(null)

  // Fetch job data when topic changes
  useEffect(() => {
    if (selectedTopic) {
      fetchJobData()
    }
  }, [selectedTopic?.id])

  const fetchJobData = async () => {
    if (!selectedTopic) return

    setLoading(true)
    try {
      // Fetch recent job runs
      const runsRes = await fetch(`/api/jobs?topic_id=${selectedTopic.id}&limit=50`)
      const runsData = await runsRes.json()

      if (Array.isArray(runsData)) {
        setRecentRuns(runsData)

        // Build status map from recent runs
        const statusMap = new Map<string, JobStatus>()
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        for (const jobDef of JOB_DEFINITIONS) {
          const jobRuns = runsData.filter((r: JobRun) => r.job_type === jobDef.id)
          const todayRuns = jobRuns.filter((r: JobRun) =>
            new Date(r.created_at) >= today
          )
          const completedRuns = jobRuns.filter((r: JobRun) => r.status === 'completed')

          statusMap.set(jobDef.id, {
            job_type: jobDef.id,
            last_run: jobRuns[0] || null,
            runs_today: todayRuns.length,
            success_rate: jobRuns.length > 0
              ? (completedRuns.length / jobRuns.length) * 100
              : 0
          })
        }

        setJobStatuses(statusMap)
      }
    } catch (error) {
      console.error('Error fetching job data:', error)
    } finally {
      setLoading(false)
    }
  }

  const triggerJob = async (jobType: string) => {
    if (!selectedTopic) return

    setTriggeringJob(jobType)
    try {
      const res = await fetch(`/api/jobs/${jobType}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: selectedTopic.id })
      })

      if (res.ok) {
        // Refresh data after triggering
        setTimeout(fetchJobData, 1000)
      } else {
        const error = await res.json()
        alert(`Failed to trigger job: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to trigger job: ${error}`)
    } finally {
      setTriggeringJob(null)
    }
  }

  const retryJob = async (jobId: string) => {
    setRetryingJob(jobId)
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Refresh data after retrying
        setTimeout(fetchJobData, 1000)
      } else {
        alert(`Failed to retry job: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to retry job: ${error}`)
    } finally {
      setRetryingJob(null)
    }
  }

  const getJobDef = (jobType: string) => {
    return JOB_DEFINITIONS.find(j => j.id === jobType) || {
      id: jobType,
      name: jobType,
      description: 'Unknown job type',
      icon: Activity
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              Pipeline Jobs
            </h1>
            <p className="text-muted-foreground">
              Monitor and trigger pipeline jobs
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchJobData} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button className="gap-2" onClick={() => triggerJob('perimeter_sweep')}>
              <Play className="h-4 w-4" />
              Run Full Pipeline
            </Button>
          </div>
        </div>

        {/* Job Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {JOB_DEFINITIONS.map((job) => {
            const Icon = job.icon
            const status = jobStatuses.get(job.id)
            const lastRun = status?.last_run
            const isTriggering = triggeringJob === job.id

            return (
              <Card key={job.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 border-2 border-foreground bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    {!lastRun && (
                      <Badge variant="secondary" size="sm">
                        Never run
                      </Badge>
                    )}
                    {lastRun?.status === 'completed' && (
                      <Badge variant="success" size="sm">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        OK
                      </Badge>
                    )}
                    {lastRun?.status === 'failed' && (
                      <Badge variant="destructive" size="sm">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                    {lastRun?.status === 'running' && (
                      <Badge variant="warning" size="sm">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Running
                      </Badge>
                    )}
                    {lastRun?.status === 'queued' && (
                      <Badge variant="secondary" size="sm">
                        <Clock className="h-3 w-3 mr-1" />
                        Queued
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold">{job.name}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {job.description}
                  </p>
                  {lastRun && (
                    <div className="text-xs text-muted-foreground mb-2">
                      Last: {formatRelativeTime(new Date(lastRun.created_at))}
                      {lastRun.items_processed !== null && ` (${lastRun.items_processed} items)`}
                    </div>
                  )}
                  {lastRun?.errors && lastRun.errors.length > 0 && (
                    <div className="text-xs text-destructive mb-2 truncate">
                      Error: {lastRun.errors[0]?.error || lastRun.errors[0]?.message || 'Unknown'}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => triggerJob(job.id)}
                    disabled={isTriggering}
                  >
                    {isTriggering ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Run Now
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Job Runs</CardTitle>
            <CardDescription>Last 50 job executions with retry capability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No job runs yet. Trigger a job to get started.</p>
                </div>
              ) : (
                recentRuns.slice(0, 20).map((run) => {
                  const jobDef = getJobDef(run.job_type)
                  const Icon = jobDef.icon
                  const isRetrying = retryingJob === run.id
                  const canRetry = run.status === 'failed'

                  return (
                    <div
                      key={run.id}
                      className="flex items-center gap-4 p-3 border-2 border-foreground"
                    >
                      <Icon className="h-5 w-5" />
                      <div className="flex-1">
                        <span className="font-medium">{jobDef.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {formatRelativeTime(new Date(run.created_at))}
                        </span>
                        {run.errors && run.errors.length > 0 && (
                          <div className="text-xs text-destructive mt-1 truncate max-w-md">
                            {run.errors[0]?.error || run.errors[0]?.message}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}
                      </div>
                      <div className="text-sm">
                        {run.items_processed ?? 0} items
                      </div>
                      {run.status === 'completed' && (
                        <CheckCircle className="h-5 w-5 text-success" />
                      )}
                      {run.status === 'failed' && (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      {run.status === 'running' && (
                        <Loader2 className="h-5 w-5 animate-spin text-warning" />
                      )}
                      {run.status === 'queued' && (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}

                      {/* Retry Button for Failed Jobs */}
                      {canRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryJob(run.id)}
                          disabled={isRetrying}
                          className="gap-1"
                        >
                          {isRetrying ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Retry
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
