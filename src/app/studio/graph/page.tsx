'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { AppShell } from '@/components/layout'
import { useTopic } from '@/context/topic-context'
import { Card, CardContent, Button, Badge } from '@/components/ui'
import { Network, RefreshCw, AlertCircle, Users, ArrowRight, Zap } from 'lucide-react'

// Dynamic import for Sigma (SSR issues)
const GraphExplorer = dynamic(
  () => import('@/components/graph-explorer'),
  { ssr: false, loading: () => <GraphLoading /> }
)

function GraphLoading() {
  return (
    <div className="flex items-center justify-center h-[600px] bg-zinc-950 border-2 border-black">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
        <p className="text-zinc-400">Loading graph visualization...</p>
      </div>
    </div>
  )
}

interface GraphNode {
  id: string
  name: string
  type: string
  role?: string
  connection_count: number
}

interface GraphStats {
  total_entities: number
  total_relationships: number
  entity_type_counts: Record<string, number>
  relationship_counts: Record<string, number>
  top_connected: Array<{ entity: { name: string }; connection_count: number }>
}

export default function GraphPage() {
  const { selectedTopic } = useTopic()
  const [selectedEntity, setSelectedEntity] = useState<GraphNode | null>(null)
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [relationships, setRelationships] = useState<Array<{
    relationship: { type: string; properties: Record<string, unknown> }
    connected_entity: { id: string; name: string; type: string }
    direction: 'incoming' | 'outgoing'
  }>>([])
  const [loadingRelationships, setLoadingRelationships] = useState(false)

  // Fetch graph stats (filtered by topic)
  useEffect(() => {
    const url = selectedTopic?.id
      ? `/api/graph/stats?topic_id=${selectedTopic.id}`
      : '/api/graph/stats'
    fetch(url)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error)
  }, [selectedTopic?.id])

  // Fetch relationships when entity selected
  useEffect(() => {
    if (!selectedEntity) {
      setRelationships([])
      return
    }

    setLoadingRelationships(true)
    fetch(`/api/entities/${selectedEntity.id}/relationships`)
      .then(res => res.json())
      .then(data => setRelationships(data.relationships || []))
      .catch(console.error)
      .finally(() => setLoadingRelationships(false))
  }, [selectedEntity])

  const relationshipColors: Record<string, string> = {
    BATTLED: 'bg-red-500/20 text-red-400 border-red-500',
    INTERVIEWED: 'bg-blue-500/20 text-blue-400 border-blue-500',
    FEUDED_WITH: 'bg-orange-500/20 text-orange-400 border-orange-500',
    AFFILIATED_WITH: 'bg-purple-500/20 text-purple-400 border-purple-500',
    COLLABORATED_WITH: 'bg-cyan-500/20 text-cyan-400 border-cyan-500',
    SIGNED_TO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
    MENTORED: 'bg-indigo-500/20 text-indigo-400 border-indigo-500',
    WORKS_FOR: 'bg-green-500/20 text-green-400 border-green-500',
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-400 border-2 border-black">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-head">KNOWLEDGE GRAPH</h1>
              <p className="text-zinc-400">
                {selectedTopic ? (
                  <>Exploring <span className="text-yellow-400">{selectedTopic.name}</span> relationships</>
                ) : (
                  <span className="text-orange-400">Select a niche to view its graph</span>
                )}
              </p>
            </div>
          </div>

          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="font-mono">{stats.total_entities}</span>
                <span className="text-zinc-500">entities</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-purple-400" />
                <span className="font-mono">{stats.total_relationships}</span>
                <span className="text-zinc-500">relationships</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Graph Canvas */}
          <div className="flex-1 relative">
            <GraphExplorer
              topicId={selectedTopic?.id}
              topicName={selectedTopic?.name}
              onEntitySelect={setSelectedEntity}
            />
          </div>

          {/* Sidebar */}
          <div className="w-80 border-l-2 border-black bg-zinc-900 overflow-y-auto">
            {selectedEntity ? (
              <div className="p-4 space-y-4">
                {/* Entity Header */}
                <div className="border-2 border-black bg-zinc-950 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h2 className="text-xl font-bold mb-2">{selectedEntity.name}</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedEntity.type}</Badge>
                    {selectedEntity.role && (
                      <span className="text-xs text-zinc-500">{selectedEntity.role}</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-zinc-400">
                    <Zap className="w-3 h-3 inline mr-1" />
                    {selectedEntity.connection_count} connections
                  </div>
                </div>

                {/* Relationships */}
                <div>
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Relationships
                  </h3>

                  {loadingRelationships ? (
                    <div className="text-center py-4">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                    </div>
                  ) : relationships.length > 0 ? (
                    <div className="space-y-2">
                      {relationships.map((rel, i) => (
                        <div
                          key={i}
                          className={`p-3 border rounded ${relationshipColors[rel.relationship.type] || 'border-zinc-700'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className={relationshipColors[rel.relationship.type]}
                            >
                              {rel.relationship.type}
                            </Badge>
                            <span className="text-xs text-zinc-500">
                              {rel.direction === 'outgoing' ? '→' : '←'}
                            </span>
                          </div>
                          <div className="font-medium">{rel.connected_entity.name}</div>
                          {rel.relationship.properties?.date ? (
                            <div className="text-xs text-zinc-500 mt-1">
                              {String(rel.relationship.properties.date)}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-500 text-sm py-4 text-center">
                      No relationships found
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4">
                {/* Stats Panel */}
                {stats && (
                  <div className="space-y-4">
                    <div className="border-2 border-black bg-zinc-950 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <h3 className="font-bold mb-3">Graph Statistics</h3>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Entity Types</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(stats.entity_type_counts || {}).map(([type, count]) => (
                              <Badge key={type} variant="outline">
                                {type}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Relationship Types</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(stats.relationship_counts || {}).map(([type, count]) => (
                              <Badge
                                key={type}
                                variant="outline"
                                className={relationshipColors[type]}
                              >
                                {type}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Connected */}
                    {stats.top_connected && stats.top_connected.length > 0 && (
                      <div className="border-2 border-black bg-zinc-950 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="font-bold mb-3">Most Connected</h3>
                        <div className="space-y-2">
                          {stats.top_connected.slice(0, 5).map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-sm">{item.entity.name}</span>
                              <span className="text-xs font-mono text-zinc-500">
                                {item.connection_count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-center text-zinc-500 text-sm pt-4">
                      Click an entity in the graph to see details
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
