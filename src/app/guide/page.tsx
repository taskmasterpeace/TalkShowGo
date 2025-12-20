'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
} from '@/components/ui'
import {
  BookOpen,
  Radar,
  Brain,
  FileSearch,
  Shield,
  Users,
  CheckCircle,
  Mic,
  Play,
  Send,
  Twitter,
  Youtube,
  Globe,
  Zap,
  ArrowRight,
  ChevronRight,
  Layers,
  Settings,
  Database,
  Workflow,
  Target,
  Clock,
  AlertTriangle,
  Star,
} from 'lucide-react'

const sections = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'pipeline', label: 'The Pipeline', icon: Workflow },
  { id: 'stages', label: 'Pipeline Stages', icon: Layers },
  { id: 'hosts', label: 'Hosts & Voices', icon: Mic },
  { id: 'setup', label: 'Getting Started', icon: Settings },
  { id: 'tips', label: 'Pro Tips', icon: Star },
]

const pipelineStages = [
  {
    name: 'PERIMETER',
    icon: Radar,
    color: '#6366f1',
    description: 'Intelligence gathering from Twitter & YouTube',
    details: [
      'Monitors your tracked Twitter accounts for new tweets',
      'Pulls recent videos from YouTube channels you follow',
      'Runs automatically on a schedule or manually via Force Pull',
      'Raw content lands here before processing',
    ],
    actions: ['Force Pull - manually trigger a content fetch'],
  },
  {
    name: 'NEXUS',
    icon: Brain,
    color: '#8b5cf6',
    description: 'AI clusters related content into story candidates',
    details: [
      'Groups related tweets and videos by topic',
      'Identifies emerging storylines and patterns',
      'Calculates story confidence scores',
      'Surfaces what\'s trending in your niche',
    ],
    actions: ['View story candidates', 'Promote to Sanction'],
  },
  {
    name: 'AUDIT',
    icon: FileSearch,
    color: '#22c55e',
    description: 'Source credibility tracking and verification',
    details: [
      'Tracks credibility scores for all your sources',
      'Monitors accuracy over time',
      'Flags unreliable sources',
      'Helps maintain editorial standards',
    ],
    actions: ['Review source scores', 'Adjust credibility'],
  },
  {
    name: 'TRIBUNAL',
    icon: Users,
    color: '#f59e0b',
    description: 'Human review for discovered sources',
    details: [
      'New sources discovered by the pipeline appear here',
      'You approve or reject nominations',
      'Only approved sources get tracked long-term',
      'Quality control for your intelligence network',
    ],
    actions: ['Approve sources', 'Reject with reason'],
  },
  {
    name: 'SANCTION',
    icon: CheckCircle,
    color: '#10b981',
    description: 'Story workbench for final editing',
    details: [
      'Review and edit story drafts',
      'Set editorial angle, tone, and length',
      'Run integrity checks before publishing',
      'Greenlight stories for production',
    ],
    actions: ['Edit draft', 'Greenlight', 'Kill story'],
  },
  {
    name: 'SIGNAL',
    icon: Send,
    color: '#ef4444',
    description: 'Export and distribution',
    details: [
      'Export finished content to various formats',
      'Track what\'s been published',
      'Analytics on exported content',
      'Distribution history',
    ],
    actions: ['Export content', 'View history'],
  },
]

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('overview')

  return (
    <AppShell topicName="Guide">
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                User Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                        activeSection === section.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </button>
                  )
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <>
              <div>
                <h1 className="font-head text-4xl mb-2">Talk Show Expressions</h1>
                <p className="text-xl text-muted-foreground">
                  AI-powered content intelligence for your niche
                </p>
              </div>

              <Card className="bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
                <CardContent className="p-6">
                  <h2 className="font-head text-2xl mb-4">What is this?</h2>
                  <p className="text-lg mb-4">
                    Talk Show Expressions is an <strong>intelligence-driven content generation platform</strong>.
                    It monitors your niche (Twitter accounts, YouTube channels), identifies emerging stories,
                    and helps you produce content faster than anyone else.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="p-4 bg-background border-2 border-foreground">
                      <Twitter className="h-8 w-8 mb-2 text-blue-400" />
                      <h3 className="font-semibold">Twitter Intel</h3>
                      <p className="text-sm text-muted-foreground">
                        Track accounts, pull tweets, spot trends
                      </p>
                    </div>
                    <div className="p-4 bg-background border-2 border-foreground">
                      <Youtube className="h-8 w-8 mb-2 text-red-500" />
                      <h3 className="font-semibold">YouTube Intel</h3>
                      <p className="text-sm text-muted-foreground">
                        Monitor channels, pull videos, get transcripts
                      </p>
                    </div>
                    <div className="p-4 bg-background border-2 border-foreground">
                      <Mic className="h-8 w-8 mb-2 text-purple-500" />
                      <h3 className="font-semibold">AI Hosts</h3>
                      <p className="text-sm text-muted-foreground">
                        Multiple personalities to narrate your content
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>The Flow</CardTitle>
                  <CardDescription>How content moves through the system</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {['PERIMETER', 'NEXUS', 'SANCTION', 'SIGNAL'].map((stage, i, arr) => (
                      <div key={stage} className="flex items-center">
                        <div className="text-center">
                          <div className="w-16 h-16 border-2 border-foreground flex items-center justify-center font-head text-xs">
                            {stage}
                          </div>
                        </div>
                        {i < arr.length - 1 && (
                          <ArrowRight className="h-6 w-6 mx-4 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Raw content → Story clusters → Editorial review → Published content
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Pipeline Section */}
          {activeSection === 'pipeline' && (
            <>
              <div>
                <h1 className="font-head text-3xl mb-2">The Pipeline</h1>
                <p className="text-muted-foreground">
                  How Talk Show Expressions processes content
                </p>
              </div>

              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <p>
                      The pipeline is a series of automated and manual stages that transform raw social media
                      content into polished, publishable stories. Each stage adds value:
                    </p>

                    <div className="p-4 border-2 border-foreground bg-muted">
                      <h3 className="font-semibold mb-2">Automated Steps</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li><strong>Fetch</strong> - Pull new content from Twitter & YouTube</li>
                        <li><strong>Extract</strong> - AI extracts entities, claims, sentiment</li>
                        <li><strong>Cluster</strong> - Group related content into stories</li>
                        <li><strong>Score</strong> - Calculate story confidence & relevance</li>
                      </ul>
                    </div>

                    <div className="p-4 border-2 border-foreground bg-muted">
                      <h3 className="font-semibold mb-2">Manual Steps (Your Job)</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li><strong>Tribunal</strong> - Approve/reject discovered sources</li>
                        <li><strong>Sanction</strong> - Edit and greenlight stories</li>
                        <li><strong>Signal</strong> - Export and distribute content</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Scheduling
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    The pipeline runs on a schedule. Go to <strong>OUTPOST → Jobs</strong> to see and manage schedules.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border-2 border-foreground">
                      <p className="font-semibold">Twitter Fetch</p>
                      <p className="text-sm text-muted-foreground">Every 15 minutes</p>
                    </div>
                    <div className="p-3 border-2 border-foreground">
                      <p className="font-semibold">YouTube Fetch</p>
                      <p className="text-sm text-muted-foreground">Every hour</p>
                    </div>
                    <div className="p-3 border-2 border-foreground">
                      <p className="font-semibold">Story Clustering</p>
                      <p className="text-sm text-muted-foreground">Every 30 minutes</p>
                    </div>
                    <div className="p-3 border-2 border-foreground">
                      <p className="font-semibold">Extraction</p>
                      <p className="text-sm text-muted-foreground">On new content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Stages Section */}
          {activeSection === 'stages' && (
            <>
              <div>
                <h1 className="font-head text-3xl mb-2">Pipeline Stages</h1>
                <p className="text-muted-foreground">
                  Deep dive into each stage of the content pipeline
                </p>
              </div>

              <div className="space-y-4">
                {pipelineStages.map((stage) => {
                  const Icon = stage.icon
                  return (
                    <Card key={stage.name}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div
                            className="p-3 border-2 border-foreground"
                            style={{ backgroundColor: `${stage.color}20` }}
                          >
                            <Icon className="h-6 w-6" style={{ color: stage.color }} />
                          </div>
                          <div>
                            <CardTitle style={{ color: stage.color }}>{stage.name}</CardTitle>
                            <CardDescription>{stage.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold mb-2 text-sm">What happens here:</h4>
                            <ul className="space-y-1">
                              {stage.details.map((detail, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                  {detail}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2 text-sm">Your actions:</h4>
                            <div className="space-y-2">
                              {stage.actions.map((action, i) => (
                                <Badge key={i} variant="outline" className="mr-2">
                                  {action}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}

          {/* Hosts Section */}
          {activeSection === 'hosts' && (
            <>
              <div>
                <h1 className="font-head text-3xl mb-2">Hosts & Voices</h1>
                <p className="text-muted-foreground">
                  AI personalities that narrate your content
                </p>
              </div>

              <Card>
                <CardContent className="p-6">
                  <p className="mb-4">
                    Hosts are AI personalities with distinct styles. Each host has:
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border-2 border-foreground">
                      <h3 className="font-semibold">Personality Traits</h3>
                      <p className="text-sm text-muted-foreground">
                        Energy, humor, confrontation level, storytelling style
                      </p>
                    </div>
                    <div className="p-4 border-2 border-foreground">
                      <h3 className="font-semibold">Voice Style</h3>
                      <p className="text-sm text-muted-foreground">
                        How they speak - pace, tone, catchphrases
                      </p>
                    </div>
                    <div className="p-4 border-2 border-foreground">
                      <h3 className="font-semibold">Best For</h3>
                      <p className="text-sm text-muted-foreground">
                        What type of content they excel at
                      </p>
                    </div>
                    <div className="p-4 border-2 border-foreground">
                      <h3 className="font-semibold">TTS Voice</h3>
                      <p className="text-sm text-muted-foreground">
                        11Labs voice for audio generation
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Built-in Hosts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { name: 'Maya Sterling', type: 'The Investigator', color: '#6366f1' },
                      { name: 'Marcus Blaze', type: 'The Hot Take King', color: '#ef4444' },
                      { name: 'Devon Sharp', type: 'The Witty Satirist', color: '#22c55e' },
                      { name: 'Tasha Raw', type: 'The Unfiltered Voice', color: '#f43f5e' },
                      { name: 'James Noble', type: 'The Smooth Narrator', color: '#8b5cf6' },
                      { name: 'DJ Momentum', type: 'The Hype Machine', color: '#eab308' },
                      { name: 'King Knowledge', type: 'The Street Analyst', color: '#06b6d4' },
                      { name: 'Algorithm Institute', type: 'The Documentary Narrator', color: '#1a1a2e' },
                    ].map((host) => (
                      <div
                        key={host.name}
                        className="p-3 border-2 border-foreground flex items-center gap-3"
                      >
                        <div
                          className="w-10 h-10 border-2 border-foreground flex items-center justify-center font-head text-sm"
                          style={{ borderColor: host.color, color: host.color }}
                        >
                          {host.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-semibold">{host.name}</p>
                          <p className="text-xs text-muted-foreground">{host.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    11Labs Integration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    Connect your 11Labs account to generate audio narration:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Get your API key from <strong>11labs.io</strong></li>
                    <li>Add it to your <code className="bg-muted px-1">.env</code> file as <code className="bg-muted px-1">ELEVEN_LABS_API_KEY</code></li>
                    <li>Go to <strong>Studio → Voices</strong> to assign voices to hosts</li>
                    <li>Use <strong>Studio → Hosts</strong> to configure which voice each host uses</li>
                  </ol>
                </CardContent>
              </Card>
            </>
          )}

          {/* Setup Section */}
          {activeSection === 'setup' && (
            <>
              <div>
                <h1 className="font-head text-3xl mb-2">Getting Started</h1>
                <p className="text-muted-foreground">
                  Set up your niche and start generating content
                </p>
              </div>

              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Step 1: Define Your Niche
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    A niche (or topic) is the focus area for your content. For example: Battle Rap,
                    NBA Drama, K-Pop News, etc.
                  </p>
                  <div className="p-4 border-2 border-foreground bg-muted">
                    <p className="font-semibold mb-2">Niche Requirements:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>10+ Twitter accounts</strong> to monitor</li>
                      <li><strong>3+ YouTube channels</strong> to follow</li>
                      <li>Keywords that define your niche</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Twitter className="h-5 w-5 text-blue-400" />
                    Step 2: Add Twitter Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    Go to <strong>OUTPOST</strong> and add Twitter accounts to track. You need at least 10.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Choose accounts that regularly post about your niche - news outlets, personalities,
                    commentators, official accounts.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Youtube className="h-5 w-5 text-red-500" />
                    Step 3: Add YouTube Channels
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    Add at least 3 YouTube channels to monitor. The system will pull their recent videos
                    and can even transcribe them.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5 text-green-500" />
                    Step 4: Start the Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Go to <strong>PERIMETER</strong></li>
                    <li>Click <strong>Force Pull</strong> to fetch initial content</li>
                    <li>Wait for extraction jobs to complete (check <strong>OUTPOST → Jobs</strong>)</li>
                    <li>Check <strong>NEXUS</strong> for story candidates</li>
                    <li>Review and approve sources in <strong>TRIBUNAL</strong></li>
                  </ol>
                </CardContent>
              </Card>
            </>
          )}

          {/* Tips Section */}
          {activeSection === 'tips' && (
            <>
              <div>
                <h1 className="font-head text-3xl mb-2">Pro Tips</h1>
                <p className="text-muted-foreground">
                  Get the most out of Talk Show Expressions
                </p>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="p-2 bg-green-500/10 border border-green-500/20 h-fit">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Quality over Quantity</h3>
                        <p className="text-sm text-muted-foreground">
                          10 high-quality Twitter sources beat 50 random accounts. Choose accounts
                          that break news first and have high engagement.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="p-2 bg-blue-500/10 border border-blue-500/20 h-fit">
                        <Database className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Let It Build Up</h3>
                        <p className="text-sm text-muted-foreground">
                          Story clustering works better with more data. Give the system a few days
                          to collect content before expecting great story candidates.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 h-fit">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Review the Tribunal</h3>
                        <p className="text-sm text-muted-foreground">
                          The AI will discover new sources. Take time to review them in Tribunal -
                          approving good sources expands your intelligence network.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="p-2 bg-purple-500/10 border border-purple-500/20 h-fit">
                        <Mic className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Match Host to Content</h3>
                        <p className="text-sm text-muted-foreground">
                          Use the right host for the content type. Documentary pieces? James Noble
                          or Algorithm Institute. Hot takes? Marcus Blaze. News? Maya Sterling.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="p-2 bg-red-500/10 border border-red-500/20 h-fit">
                        <Zap className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Speed Matters</h3>
                        <p className="text-sm text-muted-foreground">
                          When a story breaks, move fast. Go to PERIMETER, Force Pull, then check
                          NEXUS immediately. You can be first with a hot take.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
