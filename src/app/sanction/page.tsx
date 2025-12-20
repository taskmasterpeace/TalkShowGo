'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Button,
  Textarea,
  Badge,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'
import {
  CheckCircle,
  AlertTriangle,
  Send,
  Eye,
  Users,
  FileText,
  Zap,
  XCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react'

interface Story {
  id: string
  headline: string
  summary: string
  bucket: string
  confidence: number
  engagement: number
  source_count: number
  draft_content: string | null
  entities: Array<{ name: string; type: string; role: string; mentions: number }>
  claims: Array<{ id: string; text: string; verdict: string; confidence: number }>
  sources: Array<{ handle: string; credibility: number; tweets: number }>
  integrity_checks: Array<{ id: string; label: string; status: boolean; warning?: string }>
}

function SanctionContent() {
  const searchParams = useSearchParams()
  const storyId = searchParams.get('story')

  const [story, setStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(true)
  const [angle, setAngle] = useState('news')
  const [tone, setTone] = useState('serious')
  const [length, setLength] = useState('medium')
  const [greenlightOpen, setGreenlightOpen] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  const fetchStory = useCallback(async () => {
    if (!storyId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/stories/${storyId}`)
      if (response.ok) {
        const data = await response.json()
        setStory(data)
        setDraftContent(data.draft_content || '')
      }
    } catch (error) {
      console.error('Error fetching story:', error)
    } finally {
      setLoading(false)
    }
  }, [storyId])

  useEffect(() => {
    fetchStory()
  }, [fetchStory])

  const regenerateStory = async () => {
    if (!storyId) return

    setRegenerating(true)
    setRegenerateError(null)

    try {
      const response = await fetch(`/api/stories/${storyId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: angle === 'documentary' ? 'documentary' : 'news',
          tone: tone,
          length: length,
          generate_audio: true,
          enable_interview_lookup: true,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Refresh the story data to get the new content
        await fetchStory()
      } else {
        setRegenerateError(data.error || 'Failed to regenerate story')
      }
    } catch (error) {
      setRegenerateError(`Regeneration failed: ${error}`)
    } finally {
      setRegenerating(false)
    }
  }

  const integrityChecks = story?.integrity_checks || []
  const passedChecks = integrityChecks.filter((c) => c.status).length
  const totalChecks = integrityChecks.length

  // Loading state
  if (loading) {
    return (
      <AppShell topicName="Battle Rap">
        <div className="space-y-6">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-primary" />
              SANCTION
            </h1>
            <p className="text-muted-foreground">
              Story Workbench - Review, edit, and greenlight for production
            </p>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" />
            <p>Loading story...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  // No story selected or not found
  if (!story) {
    return (
      <AppShell topicName="Battle Rap">
        <div className="space-y-6">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-primary" />
              SANCTION
            </h1>
            <p className="text-muted-foreground">
              Story Workbench - Review, edit, and greenlight for production
            </p>
          </div>
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold mb-2">No Story Selected</p>
                <p className="text-sm mb-4">
                  Select a story from the Nexus to review and greenlight for production.
                </p>
                <Button variant="outline" onClick={() => window.location.href = '/nexus'}>
                  Go to Nexus
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell topicName="Battle Rap">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-primary" />
              SANCTION
            </h1>
            <p className="text-muted-foreground">
              Story Workbench - Review, edit, and greenlight for production
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <XCircle className="h-4 w-4" />
              Kill Story
            </Button>
            <Dialog open={greenlightOpen} onOpenChange={setGreenlightOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-success hover:bg-success/90">
                  <Zap className="h-4 w-4" />
                  GREENLIGHT
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Greenlight Story for Production</DialogTitle>
                  <DialogDescription>
                    This will send the story to Director&apos;s Palette for video
                    production. Make sure all integrity checks pass.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="p-4 border-2 border-foreground bg-muted mb-4">
                    <h4 className="font-semibold mb-2">Integrity Status</h4>
                    <div className="flex items-center gap-2">
                      {passedChecks === totalChecks && totalChecks > 0 ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-success" />
                          <span className="text-success">
                            All checks passed ({passedChecks}/{totalChecks})
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-5 w-5 text-warning" />
                          <span className="text-warning">
                            {passedChecks}/{totalChecks} checks passed
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Destination:</strong> Director&apos;s Palette
                    </p>
                    <p>
                      <strong>Format:</strong> {angle} / {tone} / {length}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setGreenlightOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-success hover:bg-success/90"
                    onClick={() => setGreenlightOpen(false)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Confirm Greenlight
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Story Editor */}
          <div className="lg:col-span-2 space-y-4">
            {/* Story Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="destructive" className="mb-2">
                      {story.bucket?.toUpperCase() || 'STORY'}
                    </Badge>
                    <CardTitle className="text-xl">{story.headline}</CardTitle>
                    <CardDescription className="mt-2">
                      {story.summary}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>{((story.confidence || 0) * 100).toFixed(0)}% confidence</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{story.source_count || 0} sources</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span>{((story.engagement || 0) / 1000).toFixed(1)}K engagement</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Editorial Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Editorial Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Angle</Label>
                    <Select value={angle} onValueChange={setAngle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="news">News Report</SelectItem>
                        <SelectItem value="explainer">Explainer</SelectItem>
                        <SelectItem value="debate">Debate/Analysis</SelectItem>
                        <SelectItem value="documentary">Documentary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="serious">Serious</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="dramatic">Dramatic</SelectItem>
                        <SelectItem value="humorous">Humorous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Length</Label>
                    <Select value={length} onValueChange={setLength}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (1-2 min)</SelectItem>
                        <SelectItem value="medium">Medium (3-5 min)</SelectItem>
                        <SelectItem value="long">Long (5-10 min)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Draft Editor */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Story Draft</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={regenerateStory}
                    disabled={regenerating}
                  >
                    {regenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                </div>
                {regenerateError && (
                  <p className="text-sm text-destructive mt-2">{regenerateError}</p>
                )}
              </CardHeader>
              <CardContent>
                <Textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                  placeholder="Story draft will appear here once generated..."
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  {draftContent ? draftContent.split(' ').filter(w => w).length : 0} words
                </span>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Integrity Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Integrity Check
                </CardTitle>
                <CardDescription>
                  {totalChecks > 0 ? `${passedChecks}/${totalChecks} checks passed` : 'No checks yet'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {integrityChecks.length > 0 ? (
                  integrityChecks.map((check) => (
                    <div key={check.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={check.status} disabled />
                        <span
                          className={`text-sm ${
                            check.status ? '' : 'text-warning'
                          }`}
                        >
                          {check.label}
                        </span>
                      </div>
                      {check.warning && (
                        <p className="text-xs text-warning ml-6">{check.warning}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Integrity checks will be generated during story processing.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Entities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Entities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {story.entities && story.entities.length > 0 ? (
                  story.entities.map((entity) => (
                    <div
                      key={entity.name}
                      className="flex items-center justify-between p-2 border-2 border-foreground hover:bg-muted cursor-pointer"
                    >
                      <div>
                        <span className="font-medium">{entity.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({entity.role})
                        </span>
                      </div>
                      <Badge variant="outline">
                        {entity.mentions}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No entities extracted yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Claims */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Claims</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {story.claims && story.claims.length > 0 ? (
                  story.claims.map((claim) => (
                    <div
                      key={claim.id}
                      className="p-2 border-2 border-foreground space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            claim.verdict === 'confirmed'
                              ? 'success'
                              : claim.verdict === 'likely'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {claim.verdict}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {(claim.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-sm">{claim.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No claims verified yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {story.sources && story.sources.length > 0 ? (
                  story.sources.map((source) => (
                    <div
                      key={source.handle}
                      className="flex items-center justify-between p-2 border-2 border-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{source.handle}</span>
                        <Badge variant="outline">
                          {source.tweets} tweets
                        </Badge>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          source.credibility >= 0.9
                            ? 'text-success'
                            : source.credibility >= 0.7
                            ? 'text-warning'
                            : 'text-destructive'
                        }`}
                      >
                        {(source.credibility * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No sources linked yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default function SanctionPage() {
  return (
    <Suspense fallback={
      <AppShell topicName="Battle Rap">
        <div className="space-y-6">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-primary" />
              SANCTION
            </h1>
            <p className="text-muted-foreground">
              Story Workbench - Review, edit, and greenlight for production
            </p>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" />
            <p>Loading...</p>
          </div>
        </div>
      </AppShell>
    }>
      <SanctionContent />
    </Suspense>
  )
}
