'use client'

import { useState, useEffect, use } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui'
import {
  User,
  Building,
  MapPin,
  Calendar,
  Package,
  Users,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Lock,
  Unlock,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { EntityContext, EntityAffiliation } from '@/types/entity-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ============================================
// TYPES
// ============================================

interface Entity {
  id: string
  canonical_name: string
  entity_type: string
  description: string | null
  mention_count: number
  metadata: EntityContext
  created_at: string
  topic_id: string
}

// ============================================
// AFFILIATION EDITOR COMPONENT
// ============================================

function AffiliationEditor({
  affiliations,
  onChange,
}: {
  affiliations: EntityAffiliation[]
  onChange: (affiliations: EntityAffiliation[]) => void
}) {
  const addAffiliation = () => {
    onChange([...affiliations, { name: '', type: '', status: 'current' }])
  }

  const updateAffiliation = (index: number, field: keyof EntityAffiliation, value: string) => {
    const updated = [...affiliations]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeAffiliation = (index: number) => {
    onChange(affiliations.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {affiliations.map((aff, i) => (
        <div key={i} className="flex items-center gap-2 p-3 border rounded">
          <Input
            value={aff.name}
            onChange={(e) => updateAffiliation(i, 'name', e.target.value)}
            placeholder="Organization name"
            className="flex-1"
          />
          <Input
            value={aff.type}
            onChange={(e) => updateAffiliation(i, 'type', e.target.value)}
            placeholder="Type (league, team...)"
            className="w-32"
          />
          <select
            value={aff.status}
            onChange={(e) => updateAffiliation(i, 'status', e.target.value as any)}
            className="border rounded px-2 py-2 text-sm"
          >
            <option value="current">Current</option>
            <option value="former">Former</option>
            <option value="rumored">Rumored</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeAffiliation(i)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addAffiliation}>
        <Plus className="h-4 w-4 mr-1" />
        Add Affiliation
      </Button>
    </div>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: entityId } = use(params)
  const router = useRouter()

  const [entity, setEntity] = useState<Entity | null>(null)
  const [context, setContext] = useState<EntityContext>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch entity
  useEffect(() => {
    async function fetchEntity() {
      try {
        const res = await fetch(`/api/entities/${entityId}/context`)
        const data = await res.json()

        if (data.error) {
          setError(data.error)
          return
        }

        setEntity({
          id: data.entity_id,
          canonical_name: data.name,
          entity_type: data.type,
          description: null,
          mention_count: 0,
          metadata: data.context,
          created_at: '',
          topic_id: ''
        })
        setContext(data.context || {})
      } catch (err) {
        setError('Failed to load entity')
      } finally {
        setLoading(false)
      }
    }
    fetchEntity()
  }, [entityId])

  const typeIcons: Record<string, React.ReactNode> = {
    person: <User className="h-5 w-5" />,
    organization: <Building className="h-5 w-5" />,
    place: <MapPin className="h-5 w-5" />,
    event: <Calendar className="h-5 w-5" />,
    product: <Package className="h-5 w-5" />,
    other: <Users className="h-5 w-5" />,
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/entities/${entityId}/context`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setContext(data.context)
        setSuccess('Changes saved successfully')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleEnrich = async () => {
    setEnriching(true)
    setError(null)

    try {
      const res = await fetch(`/api/entities/${entityId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      })
      const data = await res.json()

      if (data.success) {
        setContext(data.context)
        setSuccess(`Enriched with ${data.sources_count} sources: ${data.summary}`)
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setError(data.reason || 'Enrichment failed')
      }
    } catch {
      setError('Failed to enrich entity')
    } finally {
      setEnriching(false)
    }
  }

  const handleLock = async () => {
    try {
      await fetch(`/api/entities/${entityId}/enrich/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      setContext({
        ...context,
        enrichment_status: 'locked',
        enrichment_locked_at: new Date().toISOString(),
        enrichment_locked_by: 'producer'
      })
      setSuccess('Entity locked')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Failed to lock entity')
    }
  }

  const handleUnlock = async () => {
    try {
      await fetch(`/api/entities/${entityId}/enrich/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      setContext({
        ...context,
        enrichment_status: 'enriched',
        enrichment_locked_at: undefined,
        enrichment_locked_by: undefined
      })
      setSuccess('Entity unlocked')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Failed to unlock entity')
    }
  }

  if (loading) {
    return (
      <AppShell topicName="Studio">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (!entity) {
    return (
      <AppShell topicName="Studio">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Entity Not Found</h2>
          <Link href="/studio/entities">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Entities
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const enrichmentStatus = context.enrichment_status || 'pending'
  const isLocked = enrichmentStatus === 'locked'

  return (
    <AppShell topicName="Studio">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/studio/entities">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                {typeIcons[entity.entity_type] || typeIcons.other}
              </div>
              <div>
                <h1 className="font-head text-3xl">{entity.canonical_name}</h1>
                <p className="text-muted-foreground capitalize">{entity.entity_type}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Enrichment Status */}
            <Badge className={
              isLocked ? 'bg-orange-100 text-orange-800' :
              enrichmentStatus === 'enriched' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }>
              {isLocked && <Lock className="h-3 w-3 mr-1" />}
              {enrichmentStatus === 'enriched' && <CheckCircle className="h-3 w-3 mr-1" />}
              {enrichmentStatus}
            </Badge>

            {/* Lock/Unlock */}
            {isLocked ? (
              <Button variant="outline" onClick={handleUnlock}>
                <Unlock className="h-4 w-4 mr-2" />
                Unlock
              </Button>
            ) : (
              <Button variant="outline" onClick={handleLock}>
                <Lock className="h-4 w-4 mr-2" />
                Lock
              </Button>
            )}

            {/* Enrich */}
            <Button
              variant="outline"
              onClick={handleEnrich}
              disabled={enriching || isLocked}
            >
              {enriching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Enrich
            </Button>

            {/* Save */}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 border-2 border-green-500 bg-green-50 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="identity">
          <TabsList>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="affiliations">Affiliations</TabsTrigger>
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="enrichment">Enrichment Info</TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity">
            <Card>
              <CardHeader>
                <CardTitle>Identity & Role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Primary Role</label>
                  <Input
                    value={context.role || ''}
                    onChange={(e) => setContext({ ...context, role: e.target.value })}
                    placeholder="e.g., battler, blogger, league owner, analyst"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    What is this entity primarily known for?
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Additional Roles (comma separated)</label>
                  <Input
                    value={context.sub_roles?.join(', ') || ''}
                    onChange={(e) => setContext({
                      ...context,
                      sub_roles: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., podcast host, event organizer, YouTuber"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Gender</label>
                  <div className="flex gap-2">
                    <select
                      value={context.gender || 'unknown'}
                      onChange={(e) => setContext({ ...context, gender: e.target.value as any })}
                      className="flex-1 border rounded px-3 py-2 text-sm"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    {context.gender_needs_review && (
                      <span className="flex items-center text-xs text-orange-600 bg-orange-100 px-2 rounded">
                        ⚠️ Needs Review
                      </span>
                    )}
                  </div>
                  {context.gender_needs_review && context.gender_review_reason && (
                    <p className="text-xs text-orange-600 mt-1">
                      Reason: {context.gender_review_reason}
                    </p>
                  )}
                </div>

                {/* League Context - distinguishes person gender from league focus */}
                {context.league_context && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <label className="text-sm font-medium text-blue-800">League Context</label>
                    <p className="text-sm text-blue-700">
                      {context.league_context.person_role} of {context.league_context.league_name} ({context.league_context.league_gender_focus} league)
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Note: The person&apos;s gender may differ from the league&apos;s focus.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Content Types (comma separated)</label>
                  <Input
                    value={context.content_types?.join(', ') || ''}
                    onChange={(e) => setContext({
                      ...context,
                      content_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., battles, reactions, interviews, news"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Affiliations Tab */}
          <TabsContent value="affiliations">
            <Card>
              <CardHeader>
                <CardTitle>Affiliations</CardTitle>
              </CardHeader>
              <CardContent>
                <AffiliationEditor
                  affiliations={context.affiliations || []}
                  onChange={(affiliations) => setContext({ ...context, affiliations })}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms">
            <Card>
              <CardHeader>
                <CardTitle>Platforms & Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">YouTube Channel ID</label>
                  <div className="flex gap-2">
                    <Input
                      value={context.platforms?.youtube_channel_id || ''}
                      onChange={(e) => setContext({
                        ...context,
                        platforms: { ...context.platforms, youtube_channel_id: e.target.value }
                      })}
                      placeholder="UCxxxxxxx"
                    />
                    {context.platforms?.youtube_channel_id && (
                      <a
                        href={`https://youtube.com/channel/${context.platforms.youtube_channel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Twitter Handle</label>
                  <div className="flex gap-2">
                    <Input
                      value={context.platforms?.twitter_handle || ''}
                      onChange={(e) => setContext({
                        ...context,
                        platforms: { ...context.platforms, twitter_handle: e.target.value }
                      })}
                      placeholder="@username"
                    />
                    {context.platforms?.twitter_handle && (
                      <a
                        href={`https://twitter.com/${context.platforms.twitter_handle.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Instagram Handle</label>
                  <Input
                    value={context.platforms?.instagram_handle || ''}
                    onChange={(e) => setContext({
                      ...context,
                      platforms: { ...context.platforms, instagram_handle: e.target.value }
                    })}
                    placeholder="@username"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Website</label>
                  <Input
                    value={context.platforms?.website || ''}
                    onChange={(e) => setContext({
                      ...context,
                      platforms: { ...context.platforms, website: e.target.value }
                    })}
                    placeholder="https://example.com"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intelligence Tab */}
          <TabsContent value="intelligence">
            <Card>
              <CardHeader>
                <CardTitle>Intelligence Routing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={context.is_primary_source || false}
                      onChange={(e) => setContext({ ...context, is_primary_source: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">Is Primary Source</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={context.is_commentator || false}
                      onChange={(e) => setContext({ ...context, is_commentator: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">Is Commentator</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Primary sources create original content. Commentators react to/discuss others.
                </p>

                <div>
                  <label className="text-sm font-medium">Covers Topics (comma separated)</label>
                  <Input
                    value={context.covers_topics?.join(', ') || ''}
                    onChange={(e) => setContext({
                      ...context,
                      covers_topics: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., URL battles, KOTD, drama, history"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Bias Indicators (comma separated)</label>
                  <Input
                    value={context.bias_indicators?.join(', ') || ''}
                    onChange={(e) => setContext({
                      ...context,
                      bias_indicators: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., pro-URL, anti-KOTD, neutral"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Reliability Notes</label>
                  <Textarea
                    value={context.reliability_notes || ''}
                    onChange={(e) => setContext({ ...context, reliability_notes: e.target.value })}
                    placeholder="Notes about this source's reliability..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Producer Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={context.notes || ''}
                    onChange={(e) => setContext({ ...context, notes: e.target.value })}
                    placeholder="Additional notes about this entity..."
                    rows={4}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Tags (comma separated)</label>
                  <Input
                    value={context.tags?.join(', ') || ''}
                    onChange={(e) => setContext({
                      ...context,
                      tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., verified, top-tier, controversial, reliable"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enrichment Tab */}
          <TabsContent value="enrichment">
            <Card>
              <CardHeader>
                <CardTitle>Enrichment History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <p className="font-semibold capitalize">{context.enrichment_status || 'pending'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                    <p className="font-semibold">
                      {context.context_updated_at
                        ? new Date(context.context_updated_at).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Updated By</label>
                    <p className="font-semibold">{context.context_updated_by || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Enrichment</label>
                    <p className="font-semibold">
                      {context.enrichment_last_run
                        ? new Date(context.enrichment_last_run).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {isLocked && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded">
                    <p className="text-sm">
                      <strong>Locked by:</strong> {context.enrichment_locked_by || 'Unknown'}
                    </p>
                    <p className="text-sm">
                      <strong>Locked at:</strong>{' '}
                      {context.enrichment_locked_at
                        ? new Date(context.enrichment_locked_at).toLocaleString()
                        : 'Unknown'}
                    </p>
                  </div>
                )}

                {context.enrichment_sources && context.enrichment_sources.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Sources Used ({context.enrichment_sources.length})
                    </label>
                    <div className="mt-2 max-h-48 overflow-y-auto border rounded p-2">
                      {context.enrichment_sources.map((url, i) => (
                        <div key={i} className="text-sm py-1 border-b last:border-0">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate block"
                          >
                            {url}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleEnrich}
                    disabled={enriching || isLocked}
                  >
                    {enriching ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Re-run Enrichment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
