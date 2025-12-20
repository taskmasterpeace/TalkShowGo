'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui'
import {
  Newspaper,
  Zap,
  TrendingUp,
  Clock,
  Repeat,
  BookOpen,
  Eye,
  CheckCircle,
  AlertTriangle,
  Users,
  RefreshCw,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface StoryCandidate {
  id: string
  headline: string
  summary: string
  bucket: string
  primary_entities: string[]
  primary_claims: string[]
  evidence_package: any
  confidence_score: number
  engagement_total: number
  status: string
  created_at: string
}

const buckets = [
  { id: 'breaking', name: 'Breaking', icon: Zap, color: 'destructive', description: 'Time-sensitive, just emerged' },
  { id: 'developing', name: 'Developing', icon: TrendingUp, color: 'warning', description: 'Active story, new info coming' },
  { id: 'recurring', name: 'Recurring', icon: Repeat, color: 'primary', description: 'Ongoing saga' },
  { id: 'feature', name: 'Feature', icon: BookOpen, color: 'success', description: 'Deep dive opportunity' },
  { id: 'background', name: 'Background', icon: Clock, color: 'secondary', description: 'Context and history' },
]

const getBucketInfo = (bucketId: string) => {
  return buckets.find((b) => b.id === bucketId) || buckets[4]
}

export default function NexusPage() {
  const [stories, setStories] = useState<StoryCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBucket, setFilterBucket] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    fetchStories()
  }, [])

  const fetchStories = async () => {
    setLoading(true)
    try {
      // Get the active topic first
      const topicsRes = await fetch('/api/topics')
      const topics = await topicsRes.json()
      const activeTopic = topics[0]

      if (activeTopic) {
        const res = await fetch(`/api/stories?topic_id=${activeTopic.id}`)
        if (res.ok) {
          const data = await res.json()
          setStories(Array.isArray(data) ? data : [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch stories:', error)
    }
    setLoading(false)
  }

  const filteredStories = stories.filter((story) => {
    if (filterBucket !== 'all' && story.bucket !== filterBucket) return false
    if (filterStatus !== 'all' && story.status !== filterStatus) return false
    return true
  })

  const groupedStories = buckets.reduce((acc, bucket) => {
    acc[bucket.id] = filteredStories.filter((s) => s.bucket === bucket.id)
    return acc
  }, {} as Record<string, StoryCandidate[]>)

  return (
    <AppShell topicName="Battle Rap">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Newspaper className="h-8 w-8 text-primary" />
              NEXUS
            </h1>
            <p className="text-muted-foreground">
              Story candidates assembled from intelligence - ready for editorial review
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchStories} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Select value={filterBucket} onValueChange={setFilterBucket}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Buckets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buckets</SelectItem>
                {buckets.map((bucket) => (
                  <SelectItem key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="candidate">Candidate</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="greenlit">Greenlit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bucket Legend */}
        <div className="flex flex-wrap gap-3">
          {buckets.map((bucket) => {
            const Icon = bucket.icon
            const count = groupedStories[bucket.id]?.length || 0
            return (
              <div
                key={bucket.id}
                className="flex items-center gap-2 px-3 py-1.5 border-2 border-foreground bg-background"
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{bucket.name}</span>
                <Badge variant={bucket.color as any} size="sm">
                  {count}
                </Badge>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : stories.length === 0 ? (
          <Card>
            <CardContent className="p-16 text-center">
              <Newspaper className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-bold mb-2">No Story Candidates Yet</h3>
              <p className="text-muted-foreground mb-4">
                Run the NEXUS pipeline to generate story candidates from extracted claims and entities.
              </p>
              <Button onClick={() => window.location.href = '/jobs'}>
                Go to Jobs
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Kanban-style Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {buckets.map((bucket) => {
                const Icon = bucket.icon
                const bucketStories = groupedStories[bucket.id] || []
                return (
                  <div key={bucket.id} className="space-y-3">
                    {/* Bucket Header */}
                    <div className="flex items-center gap-2 p-2 border-2 border-foreground bg-muted">
                      <Icon className="h-4 w-4" />
                      <span className="font-semibold text-sm">{bucket.name}</span>
                      <Badge variant={bucket.color as any} size="sm">
                        {bucketStories.length}
                      </Badge>
                    </div>

                    {/* Stories */}
                    <div className="space-y-3">
                      {bucketStories.map((story) => (
                        <Card
                          key={story.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <CardContent className="p-3">
                            <div className="space-y-2">
                              {/* Status */}
                              <div className="flex items-center justify-between">
                                <Badge
                                  variant={
                                    story.status === 'greenlit'
                                      ? 'success'
                                      : story.status === 'reviewing'
                                      ? 'warning'
                                      : 'secondary'
                                  }
                                  size="sm"
                                >
                                  {story.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(new Date(story.created_at))}
                                </span>
                              </div>

                              {/* Headline */}
                              <h4 className="font-medium text-sm leading-tight line-clamp-3">
                                {story.headline}
                              </h4>

                              {/* Entities */}
                              {story.primary_entities && story.primary_entities.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {story.primary_entities.slice(0, 2).map((entity, idx) => (
                                    <Badge key={idx} variant="outline" size="sm">
                                      {entity}
                                    </Badge>
                                  ))}
                                  {story.primary_entities.length > 2 && (
                                    <Badge variant="outline" size="sm">
                                      +{story.primary_entities.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {/* Metrics */}
                              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-foreground/20">
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {((story.confidence_score || 0) * 100).toFixed(0)}%
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {story.primary_claims?.length || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {((story.engagement_total || 0) / 1000).toFixed(1)}K
                                </span>
                              </div>

                              {/* Risk flags */}
                              {story.evidence_package?.claims?.some((c: any) => c.verdict === 'disputed') && (
                                <div className="flex items-center gap-1 text-xs text-warning">
                                  <AlertTriangle className="h-3 w-3" />
                                  Contains disputed claims
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {bucketStories.length === 0 && (
                        <div className="p-4 border-2 border-dashed border-foreground/30 text-center text-sm text-muted-foreground">
                          No stories
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Full Story List (alternative view) */}
            <Card>
              <CardHeader>
                <CardTitle>All Story Candidates</CardTitle>
                <CardDescription>
                  Click on a story to open in the Story Workbench for review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredStories.map((story) => {
                    const bucketInfo = getBucketInfo(story.bucket)
                    const BucketIcon = bucketInfo.icon
                    return (
                      <div
                        key={story.id}
                        className="flex items-center gap-4 p-4 border-2 border-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        <div className="p-2 border-2 border-foreground bg-muted">
                          <BucketIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={bucketInfo.color as any} size="sm">
                              {bucketInfo.name}
                            </Badge>
                            <Badge
                              variant={
                                story.status === 'greenlit'
                                  ? 'success'
                                  : story.status === 'reviewing'
                                  ? 'warning'
                                  : 'secondary'
                              }
                              size="sm"
                            >
                              {story.status}
                            </Badge>
                          </div>
                          <h4 className="font-medium">{story.headline}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {story.summary}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span>{((story.confidence_score || 0) * 100).toFixed(0)}% confidence</span>
                            <span>{story.primary_claims?.length || 0} claims</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatRelativeTime(new Date(story.created_at))}
                          </div>
                        </div>
                        <Button onClick={() => window.location.href = `/sanction?story=${story.id}`}>
                          Review
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}
