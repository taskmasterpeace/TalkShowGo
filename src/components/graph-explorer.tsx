'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Graph from 'graphology'
import { SigmaContainer, useLoadGraph, useSigma, useRegisterEvents } from '@react-sigma/core'
import '@react-sigma/core/lib/style.css'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { Button, Badge, Input } from '@/components/ui'
import {
  Search,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  AlertCircle,
  Network,
  Users,
  Building2,
  Trophy,
  Swords,
  MessageSquare,
  Link2,
  Handshake,
  Sparkles,
  ExternalLink,
  Plus,
  Check,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

// ============================================
// TYPES
// ============================================

interface GraphNode {
  id: string
  name: string
  type: string
  role?: string
  connection_count: number
}

interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
  properties: Record<string, unknown>
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    total_entities: number
    total_relationships: number
    entity_type_counts: Record<string, number>
    relationship_counts: Record<string, number>
  }
}

interface GraphExplorerProps {
  topicId?: string
  topicName?: string  // For enrichment keywords
  focusEntity?: string
  onEntitySelect?: (entity: GraphNode | null) => void
}

interface EntityContext {
  id: string
  canonical_name: string
  entity_type: string
  metadata: {
    role?: string
    sub_roles?: string[]
    gender?: string
    affiliations?: Array<{
      name: string
      type: string
      status?: 'current' | 'former' | 'rumored'
    }>
    platforms?: {
      youtube_channel_id?: string
      twitter_handle?: string
    }
    is_primary_source?: boolean
    is_commentator?: boolean
    enrichment_status?: 'pending' | 'enriched' | 'locked'
    enrichment_last_run?: string
    notes?: string
    tags?: string[]
  } | null
}

interface SyncResult {
  success: boolean
  entities_synced: number
  relationships_created: number
  errors?: string[]
}

// ============================================
// COLOR SCHEMES
// ============================================

const NODE_COLORS: Record<string, string> = {
  person: '#3B82F6',        // Blue
  organization: '#8B5CF6',  // Purple
  league: '#10B981',        // Green
  event: '#F59E0B',         // Amber
  default: '#6B7280',       // Gray
}

const EDGE_COLORS: Record<string, string> = {
  BATTLED: '#EF4444',           // Red
  INTERVIEWED: '#3B82F6',       // Blue
  FEUDED_WITH: '#F97316',       // Orange
  AFFILIATED_WITH: '#8B5CF6',   // Purple
  COLLABORATED_WITH: '#06B6D4', // Cyan
  SIGNED_TO: '#EAB308',         // Yellow
  MENTORED: '#6366F1',          // Indigo
  WORKS_FOR: '#22C55E',         // Green
  default: '#9CA3AF',           // Gray
}

const EDGE_ICONS: Record<string, typeof Swords> = {
  BATTLED: Swords,
  INTERVIEWED: MessageSquare,
  AFFILIATED_WITH: Link2,
  COLLABORATED_WITH: Handshake,
  WORKS_FOR: Building2,
}

// ============================================
// ZOOM CONTROLS COMPONENT
// ============================================

function ZoomControls() {
  const sigma = useSigma()

  const handleZoomIn = useCallback(() => {
    const camera = sigma.getCamera()
    camera.animatedZoom({ duration: 300 })
  }, [sigma])

  const handleZoomOut = useCallback(() => {
    const camera = sigma.getCamera()
    camera.animatedUnzoom({ duration: 300 })
  }, [sigma])

  const handleReset = useCallback(() => {
    const camera = sigma.getCamera()
    camera.animatedReset({ duration: 300 })
  }, [sigma])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement) return

      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        handleZoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        handleZoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        handleReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleZoomIn, handleZoomOut, handleReset])

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={handleZoomIn}
        className="bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800"
        title="Zoom In (+)"
      >
        <ZoomIn className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleZoomOut}
        className="bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800"
        title="Zoom Out (-)"
      >
        <ZoomOut className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleReset}
        className="bg-zinc-900/90 border-zinc-700 hover:bg-zinc-800"
        title="Reset View (0)"
      >
        <Maximize2 className="w-4 h-4" />
      </Button>
      {/* Keyboard hint */}
      <div className="mt-2 text-[9px] text-zinc-600 text-center leading-tight">
        <kbd className="px-1 bg-zinc-800 rounded">+</kbd>
        <kbd className="px-1 bg-zinc-800 rounded ml-0.5">-</kbd>
        <kbd className="px-1 bg-zinc-800 rounded ml-0.5">0</kbd>
      </div>
    </div>
  )
}

// ============================================
// GRAPH LOADER COMPONENT
// ============================================

function GraphLoader({ graphData, selectedNode, setSelectedNode }: {
  graphData: GraphData
  selectedNode: GraphNode | null
  setSelectedNode: (node: GraphNode | null) => void
}) {
  const loadGraph = useLoadGraph()
  const sigma = useSigma()
  const registerEvents = useRegisterEvents()

  // Create and load graph
  useEffect(() => {
    const graph = new Graph()

    // Add nodes with better sizing
    for (const node of graphData.nodes) {
      const baseSize = 8
      const connectionBonus = Math.min(node.connection_count * 2, 12)
      const size = baseSize + connectionBonus

      graph.addNode(node.id, {
        label: node.name,
        size,
        color: NODE_COLORS[node.type] || NODE_COLORS.default,
        x: Math.random() * 100,
        y: Math.random() * 100,
        originalData: node,
      })
    }

    // Add edges with better styling
    for (const edge of graphData.edges) {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
      if (edge.source === edge.target) continue

      const edgeKey = [edge.source, edge.target].sort().join('_') + '_' + edge.type
      if (graph.hasEdge(edgeKey)) continue

      try {
        graph.addEdgeWithKey(edgeKey, edge.source, edge.target, {
          color: EDGE_COLORS[edge.type] || EDGE_COLORS.default,
          size: 2,
          relationType: edge.type,  // Store relationship type separately
        })
      } catch {
        // Edge already exists
      }
    }

    // Apply force-directed layout with better settings
    if (graph.order > 0) {
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: {
          gravity: 0.5,
          scalingRatio: 3,
          slowDown: 2,
          barnesHutOptimize: graph.order > 50,
          strongGravityMode: true,
          outboundAttractionDistribution: true,
        },
      })
    }

    loadGraph(graph)
  }, [graphData, loadGraph])

  // Register click events
  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        const nodeData = sigma.getGraph().getNodeAttributes(event.node)
        setSelectedNode(nodeData.originalData as GraphNode)
      },
      clickStage: () => {
        setSelectedNode(null)
      },
      enterNode: () => {
        document.body.style.cursor = 'pointer'
      },
      leaveNode: () => {
        document.body.style.cursor = 'default'
      },
    })
  }, [registerEvents, sigma, setSelectedNode])

  // Highlight selected node and neighbors
  useEffect(() => {
    const graph = sigma.getGraph()

    graph.forEachNode((nodeId, attrs) => {
      if (selectedNode && nodeId === selectedNode.id) {
        graph.setNodeAttribute(nodeId, 'highlighted', true)
        graph.setNodeAttribute(nodeId, 'color', '#FBBF24')
        graph.setNodeAttribute(nodeId, 'size', (attrs.size as number) * 1.3)
      } else {
        graph.setNodeAttribute(nodeId, 'highlighted', false)
        const originalNode = attrs.originalData as GraphNode
        graph.setNodeAttribute(nodeId, 'color', NODE_COLORS[originalNode?.type] || NODE_COLORS.default)
        // Reset size
        const baseSize = 8
        const connectionBonus = Math.min(originalNode?.connection_count * 2 || 0, 12)
        graph.setNodeAttribute(nodeId, 'size', baseSize + connectionBonus)
      }
    })
  }, [selectedNode, sigma])

  return <ZoomControls />
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Controls skeleton */}
      <div className="flex items-center gap-4 p-4 bg-zinc-900 border-b-2 border-black">
        <div className="h-10 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 w-16 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
      {/* Graph area skeleton */}
      <div className="flex-1 bg-zinc-950 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Network className="w-16 h-16 text-zinc-700 mx-auto mb-4 animate-pulse" />
            <p className="text-zinc-500 text-lg">Loading knowledge graph...</p>
            <p className="text-zinc-600 text-sm mt-2">Analyzing entity relationships</p>
          </div>
        </div>
        {/* Fake nodes */}
        <div className="absolute top-1/4 left-1/4 w-4 h-4 rounded-full bg-blue-500/30 animate-ping" />
        <div className="absolute top-1/3 right-1/3 w-3 h-3 rounded-full bg-purple-500/30 animate-ping" style={{ animationDelay: '0.2s' }} />
        <div className="absolute bottom-1/3 left-1/3 w-5 h-5 rounded-full bg-green-500/30 animate-ping" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}

// ============================================
// ERROR STATE
// ============================================

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  const isConnectionError = error.toLowerCase().includes('connect') ||
    error.toLowerCase().includes('refused') ||
    error.toLowerCase().includes('not available')

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto p-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            {isConnectionError ? 'Memgraph Not Running' : 'Unable to Load Graph'}
          </h3>
          <p className="text-zinc-400 mb-4">{error}</p>

          {isConnectionError && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-zinc-300 mb-2">To start Memgraph:</p>
              <div className="space-y-1">
                <code className="block text-xs bg-black px-2 py-1 rounded text-blue-400">
                  npm run docker:up
                </code>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Or start Docker Desktop and run the command above.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
            <Network className="w-10 h-10 text-zinc-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Entities Yet</h3>
          <p className="text-zinc-400 mb-6">
            Run research to discover entities and relationships, or sync existing data from the database.
          </p>
          <Button onClick={onSync} disabled={syncing} className="w-full">
            {syncing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync Entities from Database
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function GraphExplorer({ topicId, topicName, focusEntity, onEntitySelect }: GraphExplorerProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [entityContext, setEntityContext] = useState<EntityContext | null>(null)
  const [loadingContext, setLoadingContext] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<{ success: boolean; message: string } | null>(null)

  // Fetch graph data
  const fetchGraph = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (topicId) params.set('topic_id', topicId)  // Filter by current niche
      if (filterType) params.set('entity_type', filterType)

      const response = await fetch(`/api/graph/full?${params}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch graph data')
      }

      const data = await response.json()
      setGraphData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph')
    } finally {
      setLoading(false)
    }
  }, [topicId, filterType])

  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  // Sync graph - Fixed to send JSON body
  const handleSync = async () => {
    if (!topicId) {
      setError('Please select a topic/niche first')
      return
    }

    setSyncing(true)
    setSyncResult(null)
    setError(null)

    try {
      const response = await fetch('/api/graph/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      setSyncResult({
        success: true,
        entities_synced: data.entities_synced || 0,
        relationships_created: data.relationships_created || 0,
        errors: data.errors
      })

      // Refresh graph after successful sync
      await fetchGraph()

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSyncResult(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
      setSyncResult(null)
    } finally {
      setSyncing(false)
    }
  }

  // Fetch entity context when node is selected
  const fetchEntityContext = useCallback(async (entityId: string) => {
    setLoadingContext(true)
    setEntityContext(null)

    try {
      const response = await fetch(`/api/entities/${entityId}/context`)
      if (response.ok) {
        const data = await response.json()
        setEntityContext(data)
      }
    } catch (err) {
      console.error('Failed to fetch entity context:', err)
    } finally {
      setLoadingContext(false)
    }
  }, [])

  // AI Enrichment
  const handleEnrich = async (entityId: string) => {
    setEnriching(true)
    setEnrichResult(null)

    try {
      const response = await fetch(`/api/entities/${entityId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force: false,
          niche_keywords: topicName ? [topicName] : ['battle rap']
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Enrichment failed')
      }

      setEnrichResult({
        success: true,
        message: 'Entity enriched with AI!'
      })

      // Refresh context after enrichment
      await fetchEntityContext(entityId)

      // Auto-hide success after 3 seconds
      setTimeout(() => setEnrichResult(null), 3000)
    } catch (err) {
      setEnrichResult({
        success: false,
        message: err instanceof Error ? err.message : 'Enrichment failed'
      })
    } finally {
      setEnriching(false)
    }
  }

  // Handle node selection
  const handleNodeSelect = (node: GraphNode | null) => {
    setSelectedNode(node)
    onEntitySelect?.(node)
    setEnrichResult(null)

    // Fetch full context when node is selected
    if (node) {
      fetchEntityContext(node.id)
    } else {
      setEntityContext(null)
    }
  }

  // Filter nodes by search
  const filteredData = useMemo(() => {
    if (!graphData) return null
    if (!searchQuery) return graphData

    const query = searchQuery.toLowerCase()
    const matchingNodeIds = new Set(
      graphData.nodes
        .filter(n => n.name.toLowerCase().includes(query))
        .map(n => n.id)
    )

    return {
      ...graphData,
      nodes: graphData.nodes.filter(n => matchingNodeIds.has(n.id)),
      edges: graphData.edges.filter(
        e => matchingNodeIds.has(e.source) && matchingNodeIds.has(e.target)
      ),
    }
  }, [graphData, searchQuery])

  // Loading state
  if (loading) {
    return <LoadingSkeleton />
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={fetchGraph} />
  }

  // Empty state
  if (!filteredData || filteredData.nodes.length === 0) {
    return <EmptyState onSync={handleSync} syncing={syncing} />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sync Result Toast */}
      {syncResult && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2">
          <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 rounded-lg flex items-center gap-3 shadow-lg">
            <Check className="w-4 h-4" />
            <span className="text-sm">
              Synced {syncResult.entities_synced} entities, {syncResult.relationships_created} relationships
            </span>
            <button onClick={() => setSyncResult(null)} className="hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4 p-4 bg-zinc-900 border-b-2 border-black">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zinc-800 border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={filterType === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(null)}
          >
            All
          </Button>
          <Button
            variant={filterType === 'person' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('person')}
            className={filterType !== 'person' ? 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10' : ''}
          >
            <Users className="w-3 h-3 mr-1" />
            People
          </Button>
          <Button
            variant={filterType === 'league' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('league')}
            className={filterType !== 'league' ? 'border-green-500/50 text-green-400 hover:bg-green-500/10' : ''}
          >
            <Trophy className="w-3 h-3 mr-1" />
            Leagues
          </Button>
          <Button
            variant={filterType === 'organization' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('organization')}
            className={filterType !== 'organization' ? 'border-purple-500/50 text-purple-400 hover:bg-purple-500/10' : ''}
          >
            <Building2 className="w-3 h-3 mr-1" />
            Orgs
          </Button>
        </div>

        <Button
          onClick={handleSync}
          disabled={syncing || !topicId}
          variant="outline"
          className="border-zinc-700"
          title={topicId ? "Sync entities from database" : "Select a topic first"}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync'}
        </Button>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative bg-zinc-950">
        <SigmaContainer
          style={{ height: '100%', width: '100%' }}
          settings={{
            defaultNodeColor: '#6B7280',
            defaultEdgeColor: '#374151',
            labelColor: { color: '#E5E7EB' },
            labelSize: 14,
            labelWeight: 'bold',
            labelRenderedSizeThreshold: 8,
            renderEdgeLabels: false,
            enableEdgeEvents: false,
            nodeProgramClasses: {},
            defaultEdgeType: 'line',
            minCameraRatio: 0.1,
            maxCameraRatio: 10,
          }}
        >
          <GraphLoader
            graphData={filteredData}
            selectedNode={selectedNode}
            setSelectedNode={handleNodeSelect}
          />
        </SigmaContainer>

        {/* Node Type Legend */}
        <div className="absolute top-4 left-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 backdrop-blur-sm">
          <div className="text-xs font-semibold text-zinc-300 mb-2">Entity Types</div>
          <div className="space-y-1.5">
            {Object.entries(NODE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-zinc-400 capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Relationship Legend */}
        <div className="absolute bottom-4 left-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 backdrop-blur-sm">
          <div className="text-xs font-semibold text-zinc-300 mb-2">Relationships</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {Object.entries(EDGE_COLORS).filter(([k]) => k !== 'default').slice(0, 6).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
                <span className="text-xs text-zinc-400">{type.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="absolute top-4 right-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="font-mono font-bold text-white">{filteredData.nodes.length}</span>
              <span className="text-zinc-500">entities</span>
            </div>
            <div className="w-px h-4 bg-zinc-700" />
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-purple-400" />
              <span className="font-mono font-bold text-white">{filteredData.edges.length}</span>
              <span className="text-zinc-500">relationships</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Entity Panel */}
      {selectedNode && (
        <div className="absolute bottom-20 right-20 w-[420px] bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg overflow-hidden max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">{selectedNode.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{
                      borderColor: NODE_COLORS[selectedNode.type] || NODE_COLORS.default,
                      color: NODE_COLORS[selectedNode.type] || NODE_COLORS.default
                    }}
                  >
                    {selectedNode.type}
                  </Badge>
                  {(entityContext?.metadata?.role || selectedNode.role) && (
                    <Badge variant="secondary" className="text-xs">
                      {entityContext?.metadata?.role || selectedNode.role}
                    </Badge>
                  )}
                  {entityContext?.metadata?.enrichment_status && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        entityContext.metadata.enrichment_status === 'enriched'
                          ? 'border-green-500 text-green-400'
                          : entityContext.metadata.enrichment_status === 'locked'
                          ? 'border-orange-500 text-orange-400'
                          : 'border-zinc-500 text-zinc-400'
                      }`}
                    >
                      {entityContext.metadata.enrichment_status}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleNodeSelect(null)}
                className="h-8 w-8 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEnrich(selectedNode.id)}
                disabled={enriching || entityContext?.metadata?.enrichment_status === 'locked'}
                className="flex-1 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              >
                {enriching ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 mr-1" />
                )}
                {enriching ? 'Enriching...' : 'AI Enrich'}
              </Button>
              <Link
                href={`/studio/entities/${selectedNode.id}`}
                className="flex-1"
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Full Editor
                </Button>
              </Link>
            </div>

            {/* Enrich Result */}
            {enrichResult && (
              <div className={`mt-2 p-2 rounded text-xs ${
                enrichResult.success
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {enrichResult.message}
              </div>
            )}
          </div>

          {/* Context Details */}
          <div className="flex-1 overflow-y-auto">
            {/* Loading Context */}
            {loadingContext && (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span className="ml-2 text-sm text-zinc-500">Loading context...</span>
              </div>
            )}

            {/* Entity Context */}
            {entityContext && !loadingContext && (
              <div className="p-4 space-y-4 bg-zinc-950">
                {/* Affiliations */}
                {entityContext.metadata?.affiliations && entityContext.metadata.affiliations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-400 mb-2 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      Affiliations
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {entityContext.metadata.affiliations.map((aff, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={`text-xs ${
                            aff.status === 'former' ? 'opacity-50' : ''
                          }`}
                        >
                          {aff.name}
                          <span className="ml-1 text-zinc-500">({aff.type})</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Platforms */}
                {entityContext.metadata?.platforms && (
                  Object.values(entityContext.metadata.platforms).some(v => v) && (
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 mb-2">Platforms</h4>
                      <div className="space-y-1 text-xs">
                        {entityContext.metadata.platforms.youtube_channel_id && (
                          <div className="text-zinc-300">
                            YouTube: <span className="font-mono text-zinc-500">{entityContext.metadata.platforms.youtube_channel_id}</span>
                          </div>
                        )}
                        {entityContext.metadata.platforms.twitter_handle && (
                          <div className="text-zinc-300">
                            Twitter: <span className="font-mono text-blue-400">@{entityContext.metadata.platforms.twitter_handle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}

                {/* Tags */}
                {entityContext.metadata?.tags && entityContext.metadata.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-400 mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {entityContext.metadata.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {entityContext.metadata?.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-400 mb-2">Notes</h4>
                    <p className="text-xs text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-800">
                      {entityContext.metadata.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Relationships */}
            <div className="p-4 border-t border-zinc-800">
              <div className="flex items-center gap-2 text-sm mb-3">
                <Link2 className="w-4 h-4 text-zinc-500" />
                <span className="font-mono text-white">{selectedNode.connection_count}</span>
                <span className="text-zinc-500">connections</span>
              </div>

              {/* Show actual relationships */}
              {(() => {
                const nodeEdges = filteredData.edges.filter(
                  e => e.source === selectedNode.id || e.target === selectedNode.id
                )

                if (nodeEdges.length === 0) {
                  return (
                    <p className="text-xs text-zinc-600">No relationships in current view</p>
                  )
                }

                // Group by relationship type
                const byType: Record<string, Array<{ node: GraphNode; direction: 'from' | 'to' }>> = {}

                for (const edge of nodeEdges) {
                  const otherNodeId = edge.source === selectedNode.id ? edge.target : edge.source
                  const otherNode = filteredData.nodes.find(n => n.id === otherNodeId)
                  if (!otherNode) continue

                  const direction = edge.source === selectedNode.id ? 'to' : 'from'
                  if (!byType[edge.type]) byType[edge.type] = []
                  byType[edge.type].push({ node: otherNode, direction })
                }

                return (
                  <div className="space-y-3">
                    {Object.entries(byType).map(([type, connections]) => (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="w-3 h-0.5 rounded"
                            style={{ backgroundColor: EDGE_COLORS[type] || EDGE_COLORS.default }}
                          />
                          <span className="text-xs font-semibold text-zinc-400">
                            {type.replace(/_/g, ' ')}
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {connections.length}
                          </Badge>
                        </div>
                        <div className="pl-5 space-y-1">
                          {connections.slice(0, 5).map((conn, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              <span className="text-zinc-600">
                                {conn.direction === 'to' ? '→' : '←'}
                              </span>
                              <button
                                onClick={() => handleNodeSelect(conn.node)}
                                className="text-zinc-300 hover:text-white hover:underline text-left"
                              >
                                {conn.node.name}
                              </button>
                            </div>
                          ))}
                          {connections.length > 5 && (
                            <p className="text-[10px] text-zinc-600">
                              +{connections.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GraphExplorer
