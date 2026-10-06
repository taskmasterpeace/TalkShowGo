'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import {
  Users,
  Swords,
  Mic,
  Building2,
  Link2,
  Handshake,
  UserX,
  GraduationCap,
  FileSignature,
  Plus,
  Loader2,
  AlertCircle,
  ArrowRight,
  Network,
  Search,
} from 'lucide-react'

// Relationship types with brutalist styling
const RELATIONSHIP_CONFIG = {
  BATTLED: { label: 'Battled', icon: Swords, color: 'bg-red-400 text-black border-2 border-black' },
  INTERVIEWED: { label: 'Interviewed', icon: Mic, color: 'bg-blue-400 text-black border-2 border-black' },
  AFFILIATED_WITH: { label: 'Affiliated', icon: Building2, color: 'bg-purple-400 text-black border-2 border-black' },
  WORKS_FOR: { label: 'Works For', icon: Building2, color: 'bg-green-400 text-black border-2 border-black' },
  SIGNED_TO: { label: 'Signed To', icon: FileSignature, color: 'bg-yellow-400 text-black border-2 border-black' },
  FEUDED_WITH: { label: 'Feuded With', icon: UserX, color: 'bg-orange-400 text-black border-2 border-black' },
  COLLABORATED_WITH: { label: 'Collaborated', icon: Handshake, color: 'bg-cyan-400 text-black border-2 border-black' },
  MENTORED: { label: 'Mentored', icon: GraduationCap, color: 'bg-indigo-400 text-black border-2 border-black' },
} as const

type RelationType = keyof typeof RELATIONSHIP_CONFIG

interface GraphEntity {
  id: string
  name: string
  type: string
  role?: string
}

interface Relationship {
  relationship: {
    type: string
    properties: Record<string, unknown>
  }
  connected_entity: GraphEntity
  direction: 'outgoing' | 'incoming'
}

interface EntityRelationshipsProps {
  entityId: string
  entityName: string
  onClose?: () => void
}

export function EntityRelationships({ entityId, entityName, onClose }: EntityRelationshipsProps) {
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  // Add relationship dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GraphEntity[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<GraphEntity | null>(null)
  const [selectedRelType, setSelectedRelType] = useState<RelationType>('BATTLED')
  const [addingRelation, setAddingRelation] = useState(false)

  // Fetch relationships
  useEffect(() => {
    async function fetchRelationships() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/entities/${entityId}/relationships`)
        const data = await res.json()

        if (data.error) {
          setError(data.error)
        } else {
          setRelationships(data.relationships || [])
        }
      } catch {
        setError('Failed to load relationships')
      } finally {
        setLoading(false)
      }
    }

    fetchRelationships()
  }, [entityId])

  // Search entities for adding relationships
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const res = await fetch(`/api/graph/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
      const data = await res.json()
      setSearchResults(data.entities || [])
    } catch {
      console.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  // Add relationship
  const handleAddRelationship = async () => {
    if (!selectedTarget) return

    setAddingRelation(true)
    try {
      const res = await fetch(`/api/entities/${entityId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: selectedTarget.id,
          type: selectedRelType,
          properties: {},
        }),
      })

      if (res.ok) {
        // Refresh relationships
        const relRes = await fetch(`/api/entities/${entityId}/relationships`)
        const data = await relRes.json()
        setRelationships(data.relationships || [])
        setAddDialogOpen(false)
        setSelectedTarget(null)
        setSearchQuery('')
        setSearchResults([])
      }
    } catch {
      console.error('Failed to add relationship')
    } finally {
      setAddingRelation(false)
    }
  }

  // Filter relationships
  const filteredRelationships = filterType === 'all'
    ? relationships
    : relationships.filter(r => r.relationship.type === filterType)

  // Group by type for summary
  const groupedByType = relationships.reduce((acc, rel) => {
    const type = rel.relationship.type
    if (!acc[type]) acc[type] = []
    acc[type].push(rel)
    return acc
  }, {} as Record<string, Relationship[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading relationships...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-600">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          <h3 className="font-bold text-lg">Relationships for {entityName}</h3>
          <Badge variant="secondary">{relationships.length} connections</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Relationship
          </Button>
          {onClose && (
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards - Brutalist Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(groupedByType).map(([type, rels]) => {
          const config = RELATIONSHIP_CONFIG[type as RelationType]
          if (!config) return null
          const Icon = config.icon
          return (
            <div
              key={type}
              className={`cursor-pointer border-2 border-black bg-background p-3 transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                filterType === type ? 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-yellow-100' : ''
              }`}
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-bold">{config.label}</span>
                <span className="ml-auto font-mono font-bold">{rels.length}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(RELATIONSHIP_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Relationships List - Brutalist Style */}
      <div className="space-y-3">
        {filteredRelationships.length === 0 ? (
          <div className="border-2 border-black p-8 text-center bg-gray-50">
            <Link2 className="h-8 w-8 mx-auto mb-2" />
            <p className="font-bold">No relationships found</p>
            <p className="text-sm text-muted-foreground">Click "Add Relationship" to connect entities</p>
          </div>
        ) : (
          filteredRelationships.map((rel, idx) => {
            const config = RELATIONSHIP_CONFIG[rel.relationship.type as RelationType]
            const Icon = config?.icon || Link2
            const props = rel.relationship.properties || {}

            return (
              <div
                key={idx}
                className="border-2 border-black bg-background p-3 flex items-center gap-3 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                <span className={`px-2 py-1 text-sm font-bold flex items-center gap-1 ${config?.color || 'bg-gray-200 border-2 border-black'}`}>
                  <Icon className="h-3 w-3" />
                  {config?.label || rel.relationship.type}
                </span>

                <ArrowRight className="h-4 w-4" />

                <div className="flex-1">
                  <span className="font-bold">{rel.connected_entity.name}</span>
                  {rel.connected_entity.role && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ({rel.connected_entity.role})
                    </span>
                  )}
                </div>

                {props.date ? (
                  <span className="text-xs font-mono border border-black px-2 py-0.5 bg-gray-100">
                    {props.date as string}
                  </span>
                ) : null}
                {props.league ? (
                  <span className="text-xs font-mono border border-black px-2 py-0.5 bg-gray-100">
                    {props.league as string}
                  </span>
                ) : null}
                {props.platform ? (
                  <span className="text-xs font-mono border border-black px-2 py-0.5 bg-gray-100">
                    {props.platform as string}
                  </span>
                ) : null}

                <span className="text-xs font-mono uppercase bg-black text-white px-2 py-0.5">
                  {rel.direction}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Add Relationship Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Relationship</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search for entity */}
            <div>
              <label className="text-sm font-medium mb-2 block">Search Entity</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {searchResults.map((entity) => (
                  <div
                    key={entity.id}
                    className={`p-2 cursor-pointer hover:bg-muted flex items-center justify-between ${
                      selectedTarget?.id === entity.id ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => setSelectedTarget(entity)}
                  >
                    <span>{entity.name}</span>
                    <Badge variant="secondary">{entity.type}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Target */}
            {selectedTarget && (
              <div className="p-2 bg-primary/5 rounded-md">
                <span className="text-sm text-muted-foreground">Selected: </span>
                <span className="font-medium">{selectedTarget.name}</span>
              </div>
            )}

            {/* Relationship Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Relationship Type</label>
              <Select value={selectedRelType} onValueChange={(v) => setSelectedRelType(v as RelationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddRelationship} disabled={!selectedTarget || addingRelation}>
                {addingRelation && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Relationship
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Standalone card for graph stats summary - Brutalist Style
export function GraphStatsSummary() {
  const [stats, setStats] = useState<{
    total_entities: number
    total_relationships: number
    relationship_counts: Record<string, number>
    top_connected: Array<{ entity: GraphEntity; connection_count: number }>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/graph/stats')
        const data = await res.json()
        if (data.error) {
          setError(data.error)
        } else {
          setStats(data)
        }
      } catch {
        setError('Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="border-2 border-black p-4 flex items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading graph...</span>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="border-2 border-black p-4 flex items-center text-muted-foreground bg-gray-50">
        <AlertCircle className="h-4 w-4 mr-2" />
        <span className="text-sm">Graph not available</span>
      </div>
    )
  }

  return (
    <div className="border-2 border-black bg-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="border-b-2 border-black px-4 py-2 bg-yellow-400">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Network className="h-4 w-4" />
          KNOWLEDGE GRAPH
        </h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="text-center">
            <p className="text-2xl font-mono font-bold">{stats.total_entities}</p>
            <p className="text-xs font-bold uppercase">Entities</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-mono font-bold">{stats.total_relationships}</p>
            <p className="text-xs font-bold uppercase">Relations</p>
          </div>
        </div>

        {stats.top_connected && stats.top_connected.length > 0 && (
          <div className="border-t-2 border-black pt-3">
            <p className="text-xs font-bold uppercase mb-2">Top Connected</p>
            <div className="space-y-1">
              {stats.top_connected.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{item.entity.name}</span>
                  <span className="font-mono font-bold bg-black text-white px-2">{item.connection_count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
