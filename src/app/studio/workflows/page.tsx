'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/ui'
import {
  Workflow,
  Play,
  Pause,
  Clock,
  RefreshCw,
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
  Timer,
  Zap,
  Database,
  Brain,
  Shield,
  Newspaper,
  Radar,
} from 'lucide-react'

// ============================================
// WORKFLOW DATA (Default configurations)
// ============================================

const DEFAULT_WORKFLOWS = [
  {
    id: 'perimeter_twitter',
    name: 'Twitter Fetch',
    phase: 'PERIMETER',
    description: 'Fetch new tweets from monitored accounts',
    icon: Radar,
    color: '#3b82f6',
    defaultInterval: 15,
    useLocalLLM: false,
    active: true,
  },
  {
    id: 'perimeter_youtube',
    name: 'YouTube Fetch',
    phase: 'PERIMETER',
    description: 'Fetch new videos from tracked channels',
    icon: Radar,
    color: '#3b82f6',
    defaultInterval: 60,
    useLocalLLM: false,
    active: true,
  },
  {
    id: 'extraction',
    name: 'Entity Extraction',
    phase: 'EXTRACTION',
    description: 'Extract entities and claims from raw content',
    icon: Brain,
    color: '#8b5cf6',
    defaultInterval: 30,
    useLocalLLM: true,
    active: true,
  },
  {
    id: 'audit',
    name: 'Consensus Scoring',
    phase: 'AUDIT',
    description: 'Calculate consensus and contention scores',
    icon: Shield,
    color: '#22c55e',
    defaultInterval: 60,
    useLocalLLM: false,
    active: true,
  },
  {
    id: 'nexus',
    name: 'Story Threading',
    phase: 'NEXUS',
    description: 'Group claims into story candidates',
    icon: Newspaper,
    color: '#f97316',
    defaultInterval: 120,
    useLocalLLM: true,
    active: true,
  },
  {
    id: 'rag_indexing',
    name: 'RAG Indexing',
    phase: 'SYSTEM',
    description: 'Index new content for chat/search',
    icon: Database,
    color: '#06b6d4',
    defaultInterval: 30,
    useLocalLLM: true,
    active: true,
  },
]

// ============================================
// WORKFLOW CARD
// ============================================

function WorkflowCard({
  workflow,
  onUpdate,
}: {
  workflow: typeof DEFAULT_WORKFLOWS[0] & { interval?: number }
  onUpdate: (id: string, updates: Partial<typeof workflow>) => void
}) {
  const [interval, setInterval] = useState(workflow.interval || workflow.defaultInterval)
  const [isEditing, setIsEditing] = useState(false)

  const Icon = workflow.icon

  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: workflow.color }}
      />

      <CardContent className="p-4 pl-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-none border-2 border-foreground flex items-center justify-center"
            style={{ backgroundColor: `${workflow.color}20` }}
          >
            <Icon className="h-6 w-6" style={{ color: workflow.color }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{workflow.name}</h3>
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: workflow.color, color: workflow.color }}
              >
                {workflow.phase}
              </Badge>
              {workflow.useLocalLLM && (
                <Badge className="text-xs bg-purple-500">
                  Uses LLM
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {workflow.description}
            </p>

            {/* Interval Control */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={interval}
                      onChange={(e) => setInterval(parseInt(e.target.value) || 15)}
                      className="w-20 h-8"
                      min={5}
                      max={1440}
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onUpdate(workflow.id, { interval })
                        setIsEditing(false)
                      }}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm hover:underline"
                  >
                    Every {interval} minutes
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-end gap-2">
            <Switch
              checked={workflow.active}
              onCheckedChange={(active) => onUpdate(workflow.id, { active })}
            />
            <span className="text-xs text-muted-foreground">
              {workflow.active ? 'Active' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Last Run Status (placeholder) */}
        <div className="mt-3 pt-3 border-t border-foreground/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>Last run: Never</span>
          <Button size="sm" variant="ghost" className="h-7 gap-1">
            <Play className="h-3 w-3" />
            Run Now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState(DEFAULT_WORKFLOWS)
  const [llmStatus, setLlmStatus] = useState<{
    local: boolean
    provider: string | null
  } | null>(null)

  useEffect(() => {
    checkLLMStatus()
  }, [])

  const checkLLMStatus = async () => {
    try {
      const res = await fetch('/api/llm/status')
      const data = await res.json()
      setLlmStatus({
        local: data.hasLocalLLM,
        provider: data.activeProvider,
      })
    } catch (error) {
      console.error('LLM status check failed:', error)
    }
  }

  const updateWorkflow = (id: string, updates: Partial<typeof workflows[0]>) => {
    setWorkflows(prev =>
      prev.map(w => (w.id === id ? { ...w, ...updates } : w))
    )
  }

  // Group workflows by phase
  const perimeter = workflows.filter(w => w.phase === 'PERIMETER')
  const processing = workflows.filter(w => ['EXTRACTION', 'AUDIT', 'NEXUS'].includes(w.phase))
  const system = workflows.filter(w => w.phase === 'SYSTEM')

  return (
    <AppShell topicName="Studio">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Workflow className="h-8 w-8 text-primary" />
              WORKFLOWS
            </h1>
            <p className="text-muted-foreground">
              Configure how often each pipeline phase runs. Local LLM saves money!
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* LLM Status */}
            <div className="flex items-center gap-2 text-sm">
              {llmStatus === null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : llmStatus.local ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Local LLM: {llmStatus.provider}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span>No local LLM (using cloud)</span>
                </>
              )}
            </div>
            <Button variant="outline" onClick={checkLLMStatus} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 flex items-center justify-center border-2 border-foreground">
                <Radar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-head">{perimeter.filter(w => w.active).length}</p>
                <p className="text-xs text-muted-foreground">Active fetchers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 flex items-center justify-center border-2 border-foreground">
                <Brain className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-head">{workflows.filter(w => w.useLocalLLM).length}</p>
                <p className="text-xs text-muted-foreground">LLM-powered</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 flex items-center justify-center border-2 border-foreground">
                <Timer className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-head">
                  {Math.min(...workflows.map(w => (w as any).interval || w.defaultInterval))}m
                </p>
                <p className="text-xs text-muted-foreground">Fastest interval</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 flex items-center justify-center border-2 border-foreground">
                <Zap className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-head">{workflows.filter(w => w.active).length}</p>
                <p className="text-xs text-muted-foreground">Total active</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Fetchers */}
        <div>
          <h2 className="font-head text-xl mb-4 flex items-center gap-2">
            <Radar className="h-5 w-5 text-blue-500" />
            Data Fetchers (PERIMETER)
          </h2>
          <div className="grid gap-4">
            {perimeter.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onUpdate={updateWorkflow}
              />
            ))}
          </div>
        </div>

        {/* Processing Workflows */}
        <div>
          <h2 className="font-head text-xl mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Processing Pipeline
          </h2>
          <div className="grid gap-4">
            {processing.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onUpdate={updateWorkflow}
              />
            ))}
          </div>
        </div>

        {/* System Workflows */}
        <div>
          <h2 className="font-head text-xl mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-cyan-500" />
            System Tasks
          </h2>
          <div className="grid gap-4">
            {system.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onUpdate={updateWorkflow}
              />
            ))}
          </div>
        </div>

        {/* LLM Cost Savings Note */}
        {llmStatus?.local && (
          <Card className="bg-green-500/10 border-green-500">
            <CardContent className="p-4 flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold">Local LLM Active - Saving Money!</h3>
                <p className="text-sm text-muted-foreground">
                  Entity extraction, story threading, and RAG indexing are running locally.
                  Cloud API is only used as fallback.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
