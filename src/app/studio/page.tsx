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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Progress,
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
  DialogDescription,
} from '@/components/ui'
import {
  Mic,
  Film,
  Users,
  Clock,
  Zap,
  Search,
  Brain,
  Flame,
  Shield,
  BookOpen,
  Gauge,
  Heart,
  Volume2,
  MessageSquare,
  Target,
  AlertTriangle,
  ChevronRight,
  Play,
  Pause,
  Settings,
  RefreshCw,
  Loader2,
  Plus,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface Host {
  id: string
  slug: string
  name: string
  archetype: string
  tagline: string
  description: string
  voice_tone: string[]
  voice_pace: string
  voice_energy: string
  voice_formality: string
  style_uses_humor: boolean
  style_uses_analogy: boolean
  style_rhetorical_questions: boolean
  style_breaks_fourth_wall: boolean
  style_includes_opinion: boolean
  style_confrontational: boolean
  style_uses_slang: boolean
  style_profanity_level: string
  delivery_opening_style: string
  delivery_transition_phrases: string[]
  delivery_emphasis_technique: string
  delivery_closing_style: string
  delivery_catchphrases: string[]
  best_for_formats: string[]
  is_active: boolean
}

interface Producer {
  id: string
  slug: string
  name: string
  archetype: string
  description: string
  attr_verification_rigor: number
  attr_rabbit_hole_depth: number
  attr_controversy_affinity: number
  attr_speed_priority: number
  attr_narrative_focus: number
  attr_web_research_intensity: number
  search_always_check_web: boolean
  search_verify_official_sources: boolean
  search_check_comments: boolean
  search_look_for_contrast: boolean
  search_cross_reference_twitter: boolean
  search_max_sources_before_decision: number
  best_for_formats: string[]
  trigger_opportunity_types: string[]
  llm_provider: string
  llm_temperature: number
  llm_system_prompt: string
  is_active: boolean
}

interface Workflow {
  id: string
  name: string
  description: string
  pipeline_phase: string
  topic_id: string | null
  schedule_type: string
  schedule_interval_minutes: number | null
  schedule_cron: string | null
  use_local_llm: boolean
  llm_provider: string
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  topics?: { id: string; name: string }
}

// ============================================
// ICON MAPPINGS
// ============================================

const archetypeIcons: Record<string, any> = {
  investigative_anchor: Search,
  hot_take_king: Flame,
  witty_satirist: MessageSquare,
  unfiltered_real: AlertTriangle,
  smooth_narrator: BookOpen,
  hype_energy: Zap,
  street_analyst: Target,
  drama_hunter: Flame,
  fact_checker: Shield,
  deep_diver: Search,
  speed_demon: Zap,
  storyteller: BookOpen,
  community_pulse: Heart,
}

const phaseColors: Record<string, string> = {
  perimeter: 'primary',
  extraction: 'warning',
  audit: 'destructive',
  tribunal: 'secondary',
  nexus: 'success',
  sanction: 'primary',
  signal: 'success',
}

// ============================================
// COMPONENTS
// ============================================

function HostCard({ host, onClick }: { host: Host; onClick: () => void }) {
  const Icon = archetypeIcons[host.archetype] || Mic

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="p-3 border-2 border-foreground bg-primary/10">
            <Icon className="h-8 w-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-head text-lg">{host.name}</span>
              <Badge variant="outline" size="sm">
                {host.archetype.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-primary italic mb-2">"{host.tagline}"</p>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {host.description}
            </p>

            {/* Voice characteristics */}
            <div className="flex flex-wrap gap-1 mb-2">
              <Badge variant="secondary" size="sm">
                {host.voice_pace} pace
              </Badge>
              <Badge variant="secondary" size="sm">
                {host.voice_energy} energy
              </Badge>
              <Badge variant="secondary" size="sm">
                {host.voice_formality}
              </Badge>
            </div>

            {/* Best for formats */}
            <div className="flex flex-wrap gap-1">
              {host.best_for_formats?.slice(0, 3).map((format) => (
                <Badge key={format} variant="outline" size="sm">
                  {format.replace('_', ' ')}
                </Badge>
              ))}
              {host.best_for_formats?.length > 3 && (
                <Badge variant="outline" size="sm">
                  +{host.best_for_formats.length - 3}
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

function ProducerCard({ producer, onClick }: { producer: Producer; onClick: () => void }) {
  const Icon = archetypeIcons[producer.archetype] || Film

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="p-3 border-2 border-foreground bg-warning/10">
            <Icon className="h-8 w-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-head text-lg">{producer.name}</span>
              <Badge variant="warning" size="sm">
                {producer.archetype.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {producer.description}
            </p>

            {/* Attribute bars */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span>Verification</span>
                  <span>{Math.round(producer.attr_verification_rigor * 100)}%</span>
                </div>
                <Progress value={producer.attr_verification_rigor * 100} className="h-1" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>Speed</span>
                  <span>{Math.round(producer.attr_speed_priority * 100)}%</span>
                </div>
                <Progress value={producer.attr_speed_priority * 100} className="h-1" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>Controversy</span>
                  <span>{Math.round(producer.attr_controversy_affinity * 100)}%</span>
                </div>
                <Progress value={producer.attr_controversy_affinity * 100} className="h-1" />
              </div>
            </div>

            {/* Triggers */}
            <div className="flex flex-wrap gap-1 mt-2">
              {producer.trigger_opportunity_types?.slice(0, 3).map((trigger) => (
                <Badge key={trigger} variant="outline" size="sm">
                  {trigger.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const getScheduleDisplay = () => {
    if (workflow.schedule_type === 'interval') {
      const mins = workflow.schedule_interval_minutes || 0
      if (mins < 60) return `Every ${mins} min`
      if (mins < 1440) return `Every ${Math.round(mins / 60)} hr`
      return `Every ${Math.round(mins / 1440)} day`
    }
    if (workflow.schedule_type === 'cron') return workflow.schedule_cron
    if (workflow.schedule_type === 'manual') return 'Manual'
    return workflow.schedule_type
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className={`p-2 border-2 border-foreground ${
              workflow.is_active ? 'bg-success/10' : 'bg-muted'
            }`}
          >
            {workflow.is_active ? (
              <Play className="h-5 w-5 text-success" />
            ) : (
              <Pause className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{workflow.name}</span>
              <Badge variant={phaseColors[workflow.pipeline_phase] as any || 'secondary'} size="sm">
                {workflow.pipeline_phase.toUpperCase()}
              </Badge>
              {workflow.use_local_llm && (
                <Badge variant="outline" size="sm">
                  Local LLM
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{workflow.description}</p>
          </div>

          <div className="text-right text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              {getScheduleDisplay()}
            </div>
            {workflow.next_run_at && (
              <p className="text-xs text-muted-foreground">
                Next: {new Date(workflow.next_run_at).toLocaleString()}
              </p>
            )}
          </div>

          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState('hosts')
  const [hosts, setHosts] = useState<Host[]>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedHost, setSelectedHost] = useState<Host | null>(null)
  const [selectedProducer, setSelectedProducer] = useState<Producer | null>(null)
  const [hostDialogOpen, setHostDialogOpen] = useState(false)
  const [producerDialogOpen, setProducerDialogOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [hostsRes, producersRes, workflowsRes] = await Promise.all([
        fetch('/api/hosts'),
        fetch('/api/producers'),
        fetch('/api/workflows'),
      ])

      if (hostsRes.ok) setHosts(await hostsRes.json())
      if (producersRes.ok) setProducers(await producersRes.json())
      if (workflowsRes.ok) setWorkflows(await workflowsRes.json())
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredHosts = hosts.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.archetype.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredProducers = producers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.archetype.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const showHostDetails = (host: Host) => {
    setSelectedHost(host)
    setHostDialogOpen(true)
  }

  const showProducerDetails = (producer: Producer) => {
    setSelectedProducer(producer)
    setProducerDialogOpen(true)
  }

  return (
    <AppShell topicName="System">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Film className="h-8 w-8 text-primary" />
              STUDIO
            </h1>
            <p className="text-muted-foreground">
              Manage hosts, producers, and production workflows
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hosts</p>
                  <p className="font-head text-3xl">{hosts.length}</p>
                </div>
                <Mic className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Producers</p>
                  <p className="font-head text-3xl">{producers.length}</p>
                </div>
                <Film className="h-8 w-8 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Workflows</p>
                  <p className="font-head text-3xl">
                    {workflows.filter((w) => w.is_active).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Using Local LLM</p>
                  <p className="font-head text-3xl">
                    {workflows.filter((w) => w.use_local_llm).length}
                  </p>
                </div>
                <Brain className="h-8 w-8 text-secondary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search hosts and producers..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin mr-3" />
              <span>Loading studio data...</span>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="hosts" className="gap-2">
                <Mic className="h-4 w-4" />
                Hosts ({filteredHosts.length})
              </TabsTrigger>
              <TabsTrigger value="producers" className="gap-2">
                <Film className="h-4 w-4" />
                Producers ({filteredProducers.length})
              </TabsTrigger>
              <TabsTrigger value="workflows" className="gap-2">
                <Clock className="h-4 w-4" />
                Workflows ({workflows.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hosts" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  AI host personalities that define voice, style, and delivery for your content
                </p>
                <Button className="gap-2" onClick={() => window.location.href = '/studio/hosts'}>
                  <Plus className="h-4 w-4" />
                  Build New Host
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredHosts.map((host) => (
                  <HostCard
                    key={host.id}
                    host={host}
                    onClick={() => showHostDetails(host)}
                  />
                ))}
              </div>
              {filteredHosts.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hosts found</p>
                    <p className="text-sm">Click "Build New Host" to create your first AI host</p>
                    <Button className="mt-4 gap-2" onClick={() => window.location.href = '/studio/hosts'}>
                      <Plus className="h-4 w-4" />
                      Build New Host
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="producers" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  AI producers that control research depth, verification rigor, and story selection
                </p>
                <Button className="gap-2" variant="outline" onClick={() => window.location.href = '/studio/producers'}>
                  <Plus className="h-4 w-4" />
                  Create Producer
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredProducers.map((producer) => (
                  <ProducerCard
                    key={producer.id}
                    producer={producer}
                    onClick={() => showProducerDetails(producer)}
                  />
                ))}
              </div>
              {filteredProducers.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No producers found</p>
                    <p className="text-sm">Click "Create Producer" to add a production personality</p>
                    <Button className="mt-4 gap-2" onClick={() => window.location.href = '/studio/producers'}>
                      <Plus className="h-4 w-4" />
                      Create Producer
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="workflows" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Automated workflows that run on schedules to keep your content pipeline flowing
                </p>
                <Button className="gap-2" variant="outline" onClick={() => window.location.href = '/studio/workflows'}>
                  <Plus className="h-4 w-4" />
                  Create Workflow
                </Button>
              </div>
              <div className="space-y-3">
                {workflows.map((workflow) => (
                  <WorkflowCard key={workflow.id} workflow={workflow} />
                ))}
              </div>
              {workflows.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No workflows configured</p>
                    <p className="text-sm">Click "Create Workflow" to automate your pipeline</p>
                    <Button className="mt-4 gap-2" onClick={() => window.location.href = '/studio/workflows'}>
                      <Plus className="h-4 w-4" />
                      Create Workflow
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Host Details Dialog */}
        <Dialog open={hostDialogOpen} onOpenChange={setHostDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedHost && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {(() => {
                      const Icon = archetypeIcons[selectedHost.archetype] || Mic
                      return <Icon className="h-6 w-6" />
                    })()}
                    {selectedHost.name}
                    <Badge variant="outline">{selectedHost.archetype.replace('_', ' ')}</Badge>
                  </DialogTitle>
                  <DialogDescription className="text-primary italic">
                    "{selectedHost.tagline}"
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <p className="text-sm">{selectedHost.description}</p>

                  {/* Voice */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Volume2 className="h-4 w-4" /> Voice Characteristics
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-muted border-2 border-foreground/10">
                        <span className="text-muted-foreground">Tone:</span>{' '}
                        {selectedHost.voice_tone?.join(', ')}
                      </div>
                      <div className="p-2 bg-muted border-2 border-foreground/10">
                        <span className="text-muted-foreground">Pace:</span> {selectedHost.voice_pace}
                      </div>
                      <div className="p-2 bg-muted border-2 border-foreground/10">
                        <span className="text-muted-foreground">Energy:</span>{' '}
                        {selectedHost.voice_energy}
                      </div>
                      <div className="p-2 bg-muted border-2 border-foreground/10">
                        <span className="text-muted-foreground">Formality:</span>{' '}
                        {selectedHost.voice_formality}
                      </div>
                    </div>
                  </div>

                  {/* Style */}
                  <div>
                    <h4 className="font-semibold mb-2">Content Style</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedHost.style_uses_humor && (
                        <Badge variant="secondary">Uses Humor</Badge>
                      )}
                      {selectedHost.style_uses_analogy && (
                        <Badge variant="secondary">Uses Analogies</Badge>
                      )}
                      {selectedHost.style_rhetorical_questions && (
                        <Badge variant="secondary">Rhetorical Questions</Badge>
                      )}
                      {selectedHost.style_breaks_fourth_wall && (
                        <Badge variant="secondary">Breaks 4th Wall</Badge>
                      )}
                      {selectedHost.style_includes_opinion && (
                        <Badge variant="secondary">Opinionated</Badge>
                      )}
                      {selectedHost.style_confrontational && (
                        <Badge variant="warning">Confrontational</Badge>
                      )}
                      {selectedHost.style_uses_slang && (
                        <Badge variant="secondary">Uses Slang</Badge>
                      )}
                      <Badge
                        variant={
                          selectedHost.style_profanity_level === 'none'
                            ? 'outline'
                            : selectedHost.style_profanity_level === 'heavy'
                            ? 'destructive'
                            : 'warning'
                        }
                      >
                        Profanity: {selectedHost.style_profanity_level}
                      </Badge>
                    </div>
                  </div>

                  {/* Delivery */}
                  <div>
                    <h4 className="font-semibold mb-2">Delivery Patterns</h4>
                    <div className="space-y-2 text-sm">
                      <div className="p-2 bg-muted border-2 border-foreground/10">
                        <span className="text-muted-foreground">Opening:</span>{' '}
                        {selectedHost.delivery_opening_style}
                      </div>
                      <div className="p-2 bg-muted border-2 border-foreground/10">
                        <span className="text-muted-foreground">Emphasis:</span>{' '}
                        {selectedHost.delivery_emphasis_technique}
                      </div>
                      <div className="p-2 bg-muted border-2 border-foreground/10">
                        <span className="text-muted-foreground">Closing:</span>{' '}
                        {selectedHost.delivery_closing_style}
                      </div>
                    </div>
                  </div>

                  {/* Catchphrases */}
                  <div>
                    <h4 className="font-semibold mb-2">Catchphrases</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedHost.delivery_catchphrases?.map((phrase, idx) => (
                        <Badge key={idx} variant="outline">
                          "{phrase}"
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Best for */}
                  <div>
                    <h4 className="font-semibold mb-2">Best For Formats</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedHost.best_for_formats?.map((format) => (
                        <Badge key={format} variant="primary">
                          {format.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Producer Details Dialog */}
        <Dialog open={producerDialogOpen} onOpenChange={setProducerDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedProducer && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {(() => {
                      const Icon = archetypeIcons[selectedProducer.archetype] || Film
                      return <Icon className="h-6 w-6" />
                    })()}
                    {selectedProducer.name}
                    <Badge variant="warning">{selectedProducer.archetype.replace('_', ' ')}</Badge>
                  </DialogTitle>
                  <DialogDescription>{selectedProducer.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Attributes */}
                  <div>
                    <h4 className="font-semibold mb-3">Personality Attributes</h4>
                    <div className="space-y-3">
                      {[
                        {
                          name: 'Verification Rigor',
                          value: selectedProducer.attr_verification_rigor,
                          desc: 'How thoroughly they verify information',
                        },
                        {
                          name: 'Rabbit Hole Depth',
                          value: selectedProducer.attr_rabbit_hole_depth,
                          desc: 'How deep they research',
                        },
                        {
                          name: 'Controversy Affinity',
                          value: selectedProducer.attr_controversy_affinity,
                          desc: 'How much they seek out conflict',
                        },
                        {
                          name: 'Speed Priority',
                          value: selectedProducer.attr_speed_priority,
                          desc: 'How fast vs thorough they work',
                        },
                        {
                          name: 'Narrative Focus',
                          value: selectedProducer.attr_narrative_focus,
                          desc: 'How much they prioritize storytelling',
                        },
                        {
                          name: 'Web Research Intensity',
                          value: selectedProducer.attr_web_research_intensity,
                          desc: 'How much they search the web',
                        },
                      ].map((attr) => (
                        <div key={attr.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{attr.name}</span>
                            <span>{Math.round(attr.value * 100)}%</span>
                          </div>
                          <Progress value={attr.value * 100} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">{attr.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Search Behavior */}
                  <div>
                    <h4 className="font-semibold mb-2">Search Behavior</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'search_always_check_web', label: 'Always Check Web' },
                        { key: 'search_verify_official_sources', label: 'Verify Official' },
                        { key: 'search_check_comments', label: 'Check Comments' },
                        { key: 'search_look_for_contrast', label: 'Look for Contrast' },
                        { key: 'search_cross_reference_twitter', label: 'Cross-ref Twitter' },
                      ].map((behavior) => (
                        <div
                          key={behavior.key}
                          className={`p-2 border-2 text-sm ${
                            selectedProducer[behavior.key as keyof Producer]
                              ? 'border-success bg-success/10'
                              : 'border-foreground/10'
                          }`}
                        >
                          {behavior.label}:{' '}
                          {selectedProducer[behavior.key as keyof Producer] ? 'Yes' : 'No'}
                        </div>
                      ))}
                      <div className="p-2 border-2 border-foreground/10 text-sm">
                        Max Sources: {selectedProducer.search_max_sources_before_decision}
                      </div>
                    </div>
                  </div>

                  {/* Triggers */}
                  <div>
                    <h4 className="font-semibold mb-2">Triggered By</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProducer.trigger_opportunity_types?.map((trigger) => (
                        <Badge key={trigger} variant="warning">
                          {trigger.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Best for */}
                  <div>
                    <h4 className="font-semibold mb-2">Best For Formats</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProducer.best_for_formats?.map((format) => (
                        <Badge key={format} variant="primary">
                          {format.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* LLM Config */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Brain className="h-4 w-4" /> LLM Configuration
                    </h4>
                    <div className="p-3 bg-muted border-2 border-foreground/10 text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Provider:</span>{' '}
                        {selectedProducer.llm_provider}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Temperature:</span>{' '}
                        {selectedProducer.llm_temperature}
                      </p>
                      {selectedProducer.llm_system_prompt && (
                        <div className="mt-2">
                          <span className="text-muted-foreground">System Prompt:</span>
                          <p className="mt-1 p-2 bg-background border text-xs">
                            {selectedProducer.llm_system_prompt}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
