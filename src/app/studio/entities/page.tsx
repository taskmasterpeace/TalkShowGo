'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@/components/ui'
import {
  Users,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  Lock,
  Unlock,
  Sparkles,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  User,
  Building,
  MapPin,
  Calendar,
  Package,
} from 'lucide-react'
import { EntityContext } from '@/types/entity-context'
import Link from 'next/link'

// ============================================
// TYPES
// ============================================

interface Entity {
  id: string
  canonical_name: string
  entity_type: string
  mention_count: number
  metadata: EntityContext
  created_at: string
}

interface Topic {
  id: string
  name: string
}

// ============================================
// ENTITY CARD COMPONENT
// ============================================

function EntityCard({
  entity,
  onEnrich,
  onLock,
  onUnlock,
  onView,
  enriching,
}: {
  entity: Entity
  onEnrich: () => void
  onLock: () => void
  onUnlock: () => void
  onView: () => void
  enriching: boolean
}) {
  const ctx = entity.metadata || {}
  const enrichmentStatus = ctx.enrichment_status || 'pending'

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800 border-gray-400',
    enriched: 'bg-green-100 text-green-800 border-green-400',
    locked: 'bg-orange-100 text-orange-800 border-orange-400',
  }

  const typeIcons: Record<string, React.ReactNode> = {
    person: <User className="h-4 w-4" />,
    organization: <Building className="h-4 w-4" />,
    place: <MapPin className="h-4 w-4" />,
    event: <Calendar className="h-4 w-4" />,
    product: <Package className="h-4 w-4" />,
    other: <Users className="h-4 w-4" />,
  }

  return (
    <Card className="hover:shadow-lg transition-all">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded">
              {typeIcons[entity.entity_type] || typeIcons.other}
            </div>
            <div>
              <h3 className="font-bold">{entity.canonical_name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{entity.entity_type}</p>
            </div>
          </div>
          <Badge className={statusColors[enrichmentStatus]}>
            {enrichmentStatus === 'locked' && <Lock className="h-3 w-3 mr-1" />}
            {enrichmentStatus === 'enriched' && <CheckCircle className="h-3 w-3 mr-1" />}
            {enrichmentStatus === 'pending' && <Clock className="h-3 w-3 mr-1" />}
            {enrichmentStatus}
          </Badge>
        </div>

        {/* Context Info */}
        <div className="space-y-2 mb-4">
          {ctx.role && (
            <div className="text-sm">
              <span className="text-muted-foreground">Role:</span>{' '}
              <span className="font-medium">{ctx.role}</span>
            </div>
          )}
          {ctx.affiliations && ctx.affiliations.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Affiliations:</span>{' '}
              <span className="font-medium">
                {ctx.affiliations.map(a => a.name).join(', ')}
              </span>
            </div>
          )}
          {ctx.is_commentator && (
            <Badge variant="secondary" className="text-xs">Commentator</Badge>
          )}
          {ctx.is_primary_source && (
            <Badge variant="secondary" className="text-xs">Primary Source</Badge>
          )}
          {ctx.gender_needs_review && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Gender Review
            </Badge>
          )}
          {ctx.league_context && (
            <Badge variant="outline" className="text-xs">
              {ctx.league_context.person_role} of {ctx.league_context.league_name}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div>
            <span className="font-semibold text-foreground">{entity.mention_count}</span> mentions
          </div>
          {ctx.enrichment_sources && (
            <div>
              <span className="font-semibold text-foreground">{ctx.enrichment_sources.length}</span> sources
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/studio/entities/${entity.id}`} className="flex-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          </Link>
          {enrichmentStatus !== 'locked' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onEnrich}
                disabled={enriching}
              >
                {enriching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLock}
              >
                <Lock className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnlock}
            >
              <Unlock className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// ENTITY DETAIL MODAL
// ============================================

function EntityDetailModal({
  entity,
  open,
  onClose,
  onSave,
}: {
  entity: Entity | null
  open: boolean
  onClose: () => void
  onSave: (context: Partial<EntityContext>) => void
}) {
  const [editedContext, setEditedContext] = useState<EntityContext>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (entity) {
      setEditedContext(entity.metadata || {})
    }
  }, [entity])

  if (!entity) return null

  const handleSave = async () => {
    setSaving(true)
    await onSave(editedContext)
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl flex items-center gap-2">
            <Edit className="h-6 w-6 text-primary" />
            {entity.canonical_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Type</label>
              <p className="text-muted-foreground capitalize">{entity.entity_type}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Mentions</label>
              <p className="text-muted-foreground">{entity.mention_count}</p>
            </div>
          </div>

          {/* Editable Fields */}
          <div>
            <label className="text-sm font-medium">Role</label>
            <Input
              value={editedContext.role || ''}
              onChange={(e) => setEditedContext({ ...editedContext, role: e.target.value })}
              placeholder="e.g., battler, blogger, league owner"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Sub-Roles (comma separated)</label>
            <Input
              value={editedContext.sub_roles?.join(', ') || ''}
              onChange={(e) => setEditedContext({
                ...editedContext,
                sub_roles: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="e.g., podcast host, event organizer"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editedContext.is_commentator || false}
                onChange={(e) => setEditedContext({
                  ...editedContext,
                  is_commentator: e.target.checked
                })}
              />
              Is Commentator
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editedContext.is_primary_source || false}
                onChange={(e) => setEditedContext({
                  ...editedContext,
                  is_primary_source: e.target.checked
                })}
              />
              Is Primary Source
            </label>
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={editedContext.notes || ''}
              onChange={(e) => setEditedContext({ ...editedContext, notes: e.target.value })}
              placeholder="Additional notes about this entity..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Tags (comma separated)</label>
            <Input
              value={editedContext.tags?.join(', ') || ''}
              onChange={(e) => setEditedContext({
                ...editedContext,
                tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="e.g., verified, top-tier, controversial"
            />
          </div>

          {/* Enrichment Info */}
          {editedContext.enrichment_status && (
            <div className="p-4 bg-muted rounded">
              <h4 className="font-semibold mb-2">Enrichment Info</h4>
              <div className="text-sm space-y-1">
                <p>Status: <span className="font-medium">{editedContext.enrichment_status}</span></p>
                {editedContext.enrichment_last_run && (
                  <p>Last run: <span className="font-medium">
                    {new Date(editedContext.enrichment_last_run).toLocaleString()}
                  </span></p>
                )}
                {editedContext.enrichment_sources && editedContext.enrichment_sources.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground">
                      {editedContext.enrichment_sources.length} sources used
                    </summary>
                    <ul className="mt-2 text-xs space-y-1 max-h-32 overflow-y-auto">
                      {editedContext.enrichment_sources.map((url, i) => (
                        <li key={i} className="truncate">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function EntitiesPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState<'mentions' | 'name' | 'recent'>('mentions')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set())
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Fetch topics
  useEffect(() => {
    async function fetchTopics() {
      try {
        const res = await fetch('/api/topics')
        const data = await res.json()
        if (Array.isArray(data)) {
          setTopics(data)
          if (data.length > 0) {
            setSelectedTopicId(data[0].id)
          }
        }
      } catch {
        setError('Failed to load topics')
      }
    }
    fetchTopics()
  }, [])

  // Fetch entities
  useEffect(() => {
    if (!selectedTopicId) {
      setLoading(false)
      return
    }

    async function fetchEntities() {
      setLoading(true)
      try {
        const res = await fetch(`/api/topics/${selectedTopicId}/entities`)
        const data = await res.json()
        setEntities(Array.isArray(data) ? data : data.entities || [])
        setError(null)
      } catch {
        setError('Failed to load entities')
      } finally {
        setLoading(false)
      }
    }
    fetchEntities()
  }, [selectedTopicId])

  // Filter and sort
  const filteredEntities = entities
    .filter(e => {
      if (filterType !== 'all' && e.entity_type !== filterType) return false
      if (filterStatus !== 'all') {
        const status = e.metadata?.enrichment_status || 'pending'
        if (status !== filterStatus) return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          e.canonical_name.toLowerCase().includes(q) ||
          e.metadata?.role?.toLowerCase().includes(q) ||
          e.metadata?.notes?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'mentions':
          cmp = a.mention_count - b.mention_count
          break
        case 'name':
          cmp = a.canonical_name.localeCompare(b.canonical_name)
          break
        case 'recent':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

  // Actions
  const handleEnrich = async (entityId: string) => {
    setEnrichingIds(prev => new Set(prev).add(entityId))
    try {
      const res = await fetch(`/api/entities/${entityId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const result = await res.json()

      if (result.success) {
        // Update entity in list
        setEntities(prev => prev.map(e =>
          e.id === entityId ? { ...e, metadata: result.context } : e
        ))
      }
    } catch (error) {
      console.error('Enrichment failed:', error)
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev)
        next.delete(entityId)
        return next
      })
    }
  }

  const handleLock = async (entityId: string) => {
    try {
      await fetch(`/api/entities/${entityId}/enrich/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      // Update entity in list
      setEntities(prev => prev.map(e =>
        e.id === entityId
          ? { ...e, metadata: { ...e.metadata, enrichment_status: 'locked' } }
          : e
      ))
    } catch (error) {
      console.error('Lock failed:', error)
    }
  }

  const handleUnlock = async (entityId: string) => {
    try {
      await fetch(`/api/entities/${entityId}/enrich/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      // Update entity in list
      setEntities(prev => prev.map(e =>
        e.id === entityId
          ? { ...e, metadata: { ...e.metadata, enrichment_status: 'enriched' } }
          : e
      ))
    } catch (error) {
      console.error('Unlock failed:', error)
    }
  }

  const handleSaveContext = async (context: Partial<EntityContext>) => {
    if (!selectedEntity) return

    try {
      const res = await fetch(`/api/entities/${selectedEntity.id}/context`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      })
      const result = await res.json()

      // Update entity in list
      setEntities(prev => prev.map(e =>
        e.id === selectedEntity.id ? { ...e, metadata: result.context } : e
      ))
      setDetailOpen(false)
    } catch (error) {
      console.error('Save failed:', error)
    }
  }

  const handleBatchEnrich = async () => {
    const pendingEntities = filteredEntities
      .filter(e => (e.metadata?.enrichment_status || 'pending') === 'pending')
      .slice(0, 10)

    for (const entity of pendingEntities) {
      await handleEnrich(entity.id)
    }
  }

  // Stats
  const stats = {
    total: entities.length,
    pending: entities.filter(e => !e.metadata?.enrichment_status || e.metadata.enrichment_status === 'pending').length,
    enriched: entities.filter(e => e.metadata?.enrichment_status === 'enriched').length,
    locked: entities.filter(e => e.metadata?.enrichment_status === 'locked').length,
  }

  return (
    <AppShell topicName="Studio">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              ENTITIES
            </h1>
            <p className="text-muted-foreground text-lg">
              View, enrich, and manage entity context
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedTopicId || ''} onValueChange={setSelectedTopicId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select topic..." />
              </SelectTrigger>
              <SelectContent>
                {topics.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleBatchEnrich}
              disabled={stats.pending === 0 || enrichingIds.size > 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Enrich Pending ({stats.pending})
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Entities</p>
          </Card>
          <Card className="p-4 text-center border-gray-500">
            <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </Card>
          <Card className="p-4 text-center border-green-500">
            <p className="text-2xl font-bold text-green-600">{stats.enriched}</p>
            <p className="text-sm text-muted-foreground">Enriched</p>
          </Card>
          <Card className="p-4 text-center border-orange-500">
            <p className="text-2xl font-bold text-orange-600">{stats.locked}</p>
            <p className="text-sm text-muted-foreground">Locked</p>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Type */}
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="place">Place</SelectItem>
                </SelectContent>
              </Select>

              {/* Filter Status */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="enriched">Enriched</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-36">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentions">Mentions</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="recent">Recent</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
              >
                {sortDir === 'desc' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="p-4 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Empty */}
        {!loading && filteredEntities.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No entities found</h3>
              <p className="text-muted-foreground">
                {entities.length === 0
                  ? 'Run entity extraction to discover entities'
                  : 'No entities match your filters'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Entity Grid */}
        {!loading && filteredEntities.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {filteredEntities.map(entity => (
              <EntityCard
                key={entity.id}
                entity={entity}
                onEnrich={() => handleEnrich(entity.id)}
                onLock={() => handleLock(entity.id)}
                onUnlock={() => handleUnlock(entity.id)}
                onView={() => {
                  setSelectedEntity(entity)
                  setDetailOpen(true)
                }}
                enriching={enrichingIds.has(entity.id)}
              />
            ))}
          </div>
        )}

        {/* Entity Detail Modal */}
        <EntityDetailModal
          entity={selectedEntity}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          onSave={handleSaveContext}
        />
      </div>
    </AppShell>
  )
}
