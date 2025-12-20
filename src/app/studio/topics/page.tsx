'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  HelpTooltip,
} from '@/components/ui'
import {
  Target,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Twitter,
  Youtube,
  Settings,
  ExternalLink,
  Radio,
} from 'lucide-react'

interface TopicDetails {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  created_at: string
  intel_config?: {
    hours_back?: number
    min_sources?: number
    known_entities?: string[]
    story_patterns?: string[]
  }
  _counts?: {
    sources: number
    entities: number
    tweets: number
    videos: number
  }
}

export default function TopicsManagementPage() {
  const router = useRouter()
  const { topics, selectedTopic, selectTopic, refreshTopics, isLoading: contextLoading } = useTopic()
  const [topicDetails, setTopicDetails] = useState<Map<string, TopicDetails>>(new Map())
  const [loading, setLoading] = useState(false)
  const [editingTopic, setEditingTopic] = useState<TopicDetails | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch detailed info for all topics
  useEffect(() => {
    const fetchDetails = async () => {
      if (topics.length === 0) return
      setLoading(true)

      const details = new Map<string, TopicDetails>()
      for (const topic of topics) {
        try {
          // Fetch topic details with counts
          const [topicRes, sourcesRes, entitiesRes] = await Promise.all([
            fetch(`/api/topics/${topic.id}`),
            fetch(`/api/topics/${topic.id}/sources`),
            fetch(`/api/topics/${topic.id}/entities`),
          ])

          const topicData = await topicRes.json()
          const sources = await sourcesRes.json()
          const entities = await entitiesRes.json()

          // Count Twitter and YouTube sources separately
          const twitterCount = Array.isArray(sources)
            ? sources.filter((s: any) => s.platform === 'twitter').length
            : 0
          const youtubeCount = Array.isArray(sources)
            ? sources.filter((s: any) => s.platform === 'youtube').length
            : 0

          details.set(topic.id, {
            ...topicData,
            _counts: {
              sources: Array.isArray(sources) ? sources.length : 0,
              entities: Array.isArray(entities) ? entities.length : 0,
              tweets: twitterCount,
              videos: youtubeCount,
            },
          })
        } catch (err) {
          console.error(`Failed to fetch details for topic ${topic.id}:`, err)
        }
      }

      setTopicDetails(details)
      setLoading(false)
    }

    fetchDetails()
  }, [topics])

  const handleSelectTopic = (topic: TopicDetails) => {
    const basicTopic = {
      id: topic.id,
      name: topic.name,
      description: topic.description || undefined,
      status: topic.status,
      created_at: topic.created_at,
    }
    selectTopic(basicTopic)
    router.push('/')
  }

  const handleEditTopic = (topic: TopicDetails) => {
    setEditingTopic(topic)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingTopic) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/topics/${editingTopic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTopic.name,
          description: editingTopic.description,
          intel_config: editingTopic.intel_config,
        }),
      })

      if (!res.ok) throw new Error('Failed to update topic')

      await refreshTopics()
      setEditDialogOpen(false)
      setEditingTopic(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const getHealthStatus = (details: TopicDetails | undefined) => {
    if (!details?._counts) return 'unknown'
    const { sources, entities } = details._counts
    if (sources >= 10 && entities >= 20) return 'healthy'
    if (sources >= 5 || entities >= 10) return 'warning'
    return 'needs-attention'
  }

  const healthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3" /> Healthy</Badge>
      case 'warning':
        return <Badge variant="warning" className="gap-1"><AlertCircle className="h-3 w-3" /> Needs Work</Badge>
      case 'needs-attention':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Setup Incomplete</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-head text-3xl">Topic Management</h1>
              <p className="text-muted-foreground">
                Manage your content niches, sources, and settings
              </p>
            </div>
            <HelpTooltip
              title="What are Topics?"
              content="Topics (niches) are content verticals like 'Battle Rap' or 'Sports News'. Each topic has its own sources, entities, and settings."
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refreshTopics()} disabled={contextLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${contextLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => router.push('/onboarding')}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Topic
            </Button>
          </div>
        </div>

        {/* Topics Grid */}
        {loading || contextLoading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin mr-3" />
              <span>Loading topics...</span>
            </CardContent>
          </Card>
        ) : topics.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="font-head text-xl mb-2">No Topics Yet</h2>
              <p className="text-muted-foreground mb-4">
                Create your first topic to start generating content
              </p>
              <Button onClick={() => router.push('/onboarding')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Topic
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.map((topic) => {
              const details = topicDetails.get(topic.id)
              const isSelected = selectedTopic?.id === topic.id
              const health = getHealthStatus(details)

              return (
                <Card
                  key={topic.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    isSelected ? 'ring-2 ring-primary border-primary' : ''
                  }`}
                  onClick={() => handleSelectTopic(details || topic as any)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {isSelected && <Radio className="h-4 w-4 text-primary" />}
                        <h3 className="font-head text-lg">{topic.name}</h3>
                      </div>
                      {healthBadge(health)}
                    </div>

                    {topic.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {topic.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="p-2 bg-muted border border-foreground/10">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Twitter className="h-3 w-3" />
                          Twitter
                        </div>
                        <p className="font-semibold">{details?._counts?.tweets || 0}</p>
                      </div>
                      <div className="p-2 bg-muted border border-foreground/10">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Youtube className="h-3 w-3" />
                          YouTube
                        </div>
                        <p className="font-semibold">{details?._counts?.videos || 0}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <span>{details?._counts?.sources || 0} sources</span>
                      <span>•</span>
                      <span>{details?._counts?.entities || 0} entities</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditTopic(details || topic as any)
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/outpost?topic_id=${topic.id}`)
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Edit Topic Settings
              </DialogTitle>
              <DialogDescription>
                Update your topic configuration
              </DialogDescription>
            </DialogHeader>

            {editingTopic && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Name</label>
                  <Input
                    value={editingTopic.name}
                    onChange={(e) =>
                      setEditingTopic({ ...editingTopic, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Description</label>
                  <Textarea
                    value={editingTopic.description || ''}
                    onChange={(e) =>
                      setEditingTopic({ ...editingTopic, description: e.target.value })
                    }
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">
                    Hours Back (how far to look for content)
                  </label>
                  <Input
                    type="number"
                    value={editingTopic.intel_config?.hours_back || 24}
                    onChange={(e) =>
                      setEditingTopic({
                        ...editingTopic,
                        intel_config: {
                          ...editingTopic.intel_config,
                          hours_back: parseInt(e.target.value) || 24,
                        },
                      })
                    }
                    min={1}
                    max={168}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Default: 24 hours. Max: 168 hours (1 week)
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
