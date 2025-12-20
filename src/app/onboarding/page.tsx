'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Button,
  Input,
  Textarea,
  Badge,
  Progress,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import {
  Rocket,
  Twitter,
  Youtube,
  Check,
  X,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap,
  Target,
  Film,
  Mic,
  Video,
  Radio,
  Volume2,
  Play,
  Pause,
  FileText,
  PartyPopper,
  Sparkles,
  Calendar,
} from 'lucide-react'

const MIN_TWITTER_ACCOUNTS = 10
const MIN_YOUTUBE_CHANNELS = 3

const OUTPUT_FORMATS = [
  { id: 'short', label: 'Short-form (TikTok/Reels)', description: '60-90 second clips, punchy, fast-paced', icon: Video },
  { id: 'youtube', label: 'YouTube Videos (3-10 min)', description: 'Documentary style, in-depth narratives', icon: Film },
  { id: 'podcast', label: 'Podcast/Audio Only', description: 'Longer form, audio-first content', icon: Radio },
]

// Host suggestions based on niche keywords
const HOST_SUGGESTIONS: Record<string, string[]> = {
  'battle rap': ['algorithm-institute', 'marcus-blaze', 'king-knowledge'],
  'hip hop': ['tasha-raw', 'dj-momentum', 'king-knowledge'],
  'sports': ['marcus-blaze', 'dj-momentum', 'devon-sharp'],
  'news': ['maya-sterling', 'james-noble', 'devon-sharp'],
  'drama': ['marcus-blaze', 'tasha-raw', 'devon-sharp'],
  'default': ['maya-sterling', 'james-noble', 'algorithm-institute'],
}

interface OnboardingData {
  nicheName: string
  nicheSlug: string
  nicheDescription: string
  keywords: string[]
  twitterAccounts: string[]
  youtubeChannels: string[]
  outputFormats: string[]
  selectedHost: string | null
  selectedTemplate: string | null
}

// Host options with preview info
interface HostOption {
  id: string
  name: string
  archetype: string
  tagline: string
  description: string
  color: string
}

const AVAILABLE_HOSTS: HostOption[] = [
  { id: 'maya_sterling', name: 'Maya Sterling', archetype: 'Investigative Anchor', tagline: 'Let me walk you through this...', description: 'Methodical investigative journalist who builds her case piece by piece.', color: '#6366f1' },
  { id: 'marcus_blaze', name: 'Marcus Blaze', archetype: 'Hot Take King', tagline: "I'm just saying what everybody's thinking!", description: 'High-energy opinion machine who takes controversial stances.', color: '#ef4444' },
  { id: 'devon_sharp', name: 'Devon Sharp', archetype: 'Witty Satirist', tagline: 'Wait, wait, wait... are we serious right now?', description: 'Sharp-witted commentator who uses humor to expose absurdity.', color: '#10b981' },
  { id: 'tasha_raw', name: 'Tasha Raw', archetype: 'Unfiltered Real', tagline: "I don't got time for the bullsh*t", description: 'Unfiltered voice of the people. Raw, real, and relatable.', color: '#f59e0b' },
  { id: 'james_noble', name: 'James Noble', archetype: 'Smooth Narrator', tagline: 'This is the story of...', description: 'The voice of gravitas. Smooth, authoritative documentary style.', color: '#8b5cf6' },
  { id: 'dj_momentum', name: 'DJ Momentum', archetype: 'Hype Energy', tagline: "LET'S GOOOO!", description: 'Pure energy personified. Gets the audience hyped.', color: '#ec4899' },
  { id: 'king_knowledge', name: 'King Knowledge', archetype: 'Street Analyst', tagline: 'Real recognize real', description: 'Deep cultural insider who breaks down the game from within.', color: '#14b8a6' },
]

// Template options
interface TemplateOption {
  id: string
  name: string
  description: string
  format: string
  duration: string
}

const AVAILABLE_TEMPLATES: TemplateOption[] = [
  { id: 'battle_rap_daily', name: 'Battle Rap Daily', description: 'Classic news show format with intro, 3 stories, and outro', format: 'News Show', duration: '5-8 min' },
  { id: 'narrative_story', name: 'Narrative Story', description: 'Documentary-style deep dive into a single topic', format: 'Documentary', duration: '10-15 min' },
  { id: 'breaking_news', name: 'Breaking News', description: 'Quick hit format for fast-moving stories', format: 'News Flash', duration: '1-2 min' },
  { id: 'hot_takes', name: 'Hot Takes Show', description: 'Opinion-driven format with bold predictions', format: 'Talk Show', duration: '3-5 min' },
]

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'niche', title: 'Define Niche' },
  { id: 'formats', title: 'Output Formats' },
  { id: 'twitter', title: 'Twitter Sources' },
  { id: 'youtube', title: 'YouTube Channels' },
  { id: 'host', title: 'Select Host' },
  { id: 'template', title: 'Choose Template' },
  { id: 'review', title: 'Review & Create' },
  { id: 'complete', title: 'Complete!' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTopicId, setCreatedTopicId] = useState<string | null>(null)

  const [data, setData] = useState<OnboardingData>({
    nicheName: '',
    nicheSlug: '',
    nicheDescription: '',
    keywords: [],
    twitterAccounts: [],
    youtubeChannels: [],
    outputFormats: ['youtube'], // Default to YouTube
    selectedHost: 'james_noble', // Default host
    selectedTemplate: 'battle_rap_daily', // Default template
  })

  // Voice preview state
  const [previewingHost, setPreviewingHost] = useState<string | null>(null)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const audioRef = React.useRef<HTMLAudioElement>(null)

  const [newKeyword, setNewKeyword] = useState('')
  const [newTwitter, setNewTwitter] = useState('')
  const [newYoutube, setNewYoutube] = useState('')

  // Auto-generate slug from name
  useEffect(() => {
    if (data.nicheName) {
      const slug = data.nicheName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setData(d => ({ ...d, nicheSlug: slug }))
    }
  }, [data.nicheName])

  const addKeyword = () => {
    if (newKeyword.trim() && !data.keywords.includes(newKeyword.trim())) {
      setData(d => ({ ...d, keywords: [...d.keywords, newKeyword.trim()] }))
      setNewKeyword('')
    }
  }

  const removeKeyword = (kw: string) => {
    setData(d => ({ ...d, keywords: d.keywords.filter(k => k !== kw) }))
  }

  const addTwitter = () => {
    const handle = newTwitter.trim().replace('@', '')
    if (handle && !data.twitterAccounts.includes(handle)) {
      setData(d => ({ ...d, twitterAccounts: [...d.twitterAccounts, handle] }))
      setNewTwitter('')
    }
  }

  const removeTwitter = (handle: string) => {
    setData(d => ({ ...d, twitterAccounts: d.twitterAccounts.filter(h => h !== handle) }))
  }

  const addYoutube = () => {
    const channel = newYoutube.trim().replace('@', '')
    if (channel && !data.youtubeChannels.includes(channel)) {
      setData(d => ({ ...d, youtubeChannels: [...d.youtubeChannels, channel] }))
      setNewYoutube('')
    }
  }

  const removeYoutube = (channel: string) => {
    setData(d => ({ ...d, youtubeChannels: d.youtubeChannels.filter(c => c !== channel) }))
  }

  // Suggest host based on niche keywords
  const getSuggestedHost = () => {
    const nicheText = `${data.nicheName} ${data.keywords.join(' ')}`.toLowerCase()
    for (const [keyword, hosts] of Object.entries(HOST_SUGGESTIONS)) {
      if (keyword !== 'default' && nicheText.includes(keyword)) {
        return hosts[0]
      }
    }
    return HOST_SUGGESTIONS.default[0]
  }

  const toggleOutputFormat = (formatId: string) => {
    setData(d => ({
      ...d,
      outputFormats: d.outputFormats.includes(formatId)
        ? d.outputFormats.filter(f => f !== formatId)
        : [...d.outputFormats, formatId]
    }))
  }

  // Preview host voice
  const previewHostVoice = async (hostId: string) => {
    if (previewingHost === hostId && audioRef.current) {
      audioRef.current.pause()
      setPreviewingHost(null)
      return
    }

    setPreviewLoading(true)
    setPreviewingHost(hostId)

    try {
      const res = await fetch(`/api/hosts/${hostId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await res.json()

      if (result.audio_url) {
        setPreviewAudioUrl(result.audio_url)
        // Play after state update
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play()
          }
        }, 100)
      }
    } catch (err) {
      console.error('Preview failed:', err)
      setPreviewingHost(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true
      case 1: return data.nicheName.length >= 2 && data.keywords.length >= 1
      case 2: return data.outputFormats.length >= 1
      case 3: return data.twitterAccounts.length >= MIN_TWITTER_ACCOUNTS
      case 4: return data.youtubeChannels.length >= MIN_YOUTUBE_CHANNELS
      case 5: return !!data.selectedHost // Host selection
      case 6: return !!data.selectedTemplate // Template selection
      case 7: return true // Review
      default: return false
    }
  }

  const createNiche = async () => {
    setCreating(true)
    setError(null)

    try {
      // Create topic with host and template config
      const topicRes = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.nicheName,
          slug: data.nicheSlug,
          description: data.nicheDescription,
          keywords: data.keywords,
          config: {
            default_host: data.selectedHost,
            default_template: data.selectedTemplate,
            output_formats: data.outputFormats,
          },
        }),
      })

      if (!topicRes.ok) {
        throw new Error('Failed to create topic')
      }

      const topic = await topicRes.json()

      // Add Twitter sources
      for (const handle of data.twitterAccounts) {
        await fetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: topic.id,
            platform: 'twitter',
            identifier: handle,
            display_name: handle,
          }),
        })
      }

      // Add YouTube sources
      for (const channel of data.youtubeChannels) {
        await fetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: topic.id,
            platform: 'youtube',
            identifier: channel,
            display_name: channel,
          }),
        })
      }

      // Save topic ID and go to completion step
      setCreatedTopicId(topic.id)
      setCurrentStep(8) // Go to completion step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  const progressPercent = ((currentStep + 1) / STEPS.length) * 100

  return (
    <AppShell topicName="Onboarding">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Progress */}
        <div>
          <div className="flex justify-between mb-2">
            {STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`text-sm ${i <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {step.title}
              </div>
            ))}
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Step Content */}
        {currentStep === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Rocket className="h-16 w-16 mx-auto mb-4 text-primary" />
              <h1 className="font-head text-3xl mb-2">Welcome to Talk Show Expressions</h1>
              <p className="text-muted-foreground text-lg mb-6">
                Let&apos;s set up your first niche. This wizard will guide you through
                adding the sources needed to start generating content.
              </p>
              <div className="grid grid-cols-4 gap-3 text-left max-w-2xl mx-auto">
                <div className="p-3 border-2 border-foreground">
                  <Target className="h-5 w-5 mb-2 text-primary" />
                  <p className="font-semibold text-sm">1. Define</p>
                  <p className="text-xs text-muted-foreground">Name your niche</p>
                </div>
                <div className="p-3 border-2 border-foreground">
                  <Film className="h-5 w-5 mb-2 text-primary" />
                  <p className="font-semibold text-sm">2. Formats</p>
                  <p className="text-xs text-muted-foreground">Choose outputs</p>
                </div>
                <div className="p-3 border-2 border-foreground">
                  <Twitter className="h-5 w-5 mb-2 text-blue-400" />
                  <p className="font-semibold text-sm">3. Twitter</p>
                  <p className="text-xs text-muted-foreground">10+ accounts</p>
                </div>
                <div className="p-3 border-2 border-foreground">
                  <Youtube className="h-5 w-5 mb-2 text-red-500" />
                  <p className="font-semibold text-sm">4. YouTube</p>
                  <p className="text-xs text-muted-foreground">3+ channels</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Define Your Niche
              </CardTitle>
              <CardDescription>
                What topic will this content focus on?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Niche Name *</label>
                <Input
                  placeholder="e.g., Battle Rap, NBA Drama, K-Pop News"
                  value={data.nicheName}
                  onChange={(e) => setData(d => ({ ...d, nicheName: e.target.value }))}
                />
                {data.nicheSlug && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Slug: {data.nicheSlug}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea
                  placeholder="What kind of content will you be creating?"
                  value={data.nicheDescription}
                  onChange={(e) => setData(d => ({ ...d, nicheDescription: e.target.value }))}
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Keywords * (at least 1)
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a keyword..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  />
                  <Button onClick={addKeyword} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="gap-1">
                      {kw}
                      <button onClick={() => removeKeyword(kw)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="h-5 w-5" />
                Output Formats
              </CardTitle>
              <CardDescription>
                What types of content do you want to create? Select all that apply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {OUTPUT_FORMATS.map((format) => {
                  const Icon = format.icon
                  const isSelected = data.outputFormats.includes(format.id)
                  return (
                    <button
                      key={format.id}
                      onClick={() => toggleOutputFormat(format.id)}
                      className={`flex items-center gap-4 p-4 border-2 transition-colors text-left ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-foreground hover:bg-muted'
                      }`}
                    >
                      <div className={`p-2 ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                        <Icon className={`h-6 w-6 ${isSelected ? 'text-primary' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{format.label}</p>
                        <p className="text-sm text-muted-foreground">{format.description}</p>
                      </div>
                      {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                    </button>
                  )
                })}
              </div>

              {/* Host suggestion based on niche */}
              {data.nicheName && (
                <div className="p-4 border-2 border-foreground bg-muted mt-4">
                  <p className="text-sm font-medium mb-2">Suggested Host for {data.nicheName}:</p>
                  <div className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    <span className="font-semibold capitalize">
                      {getSuggestedHost().replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can change this later in Studio → Hosts
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Twitter className="h-5 w-5 text-blue-400" />
                Twitter Sources
              </CardTitle>
              <CardDescription>
                Add at least {MIN_TWITTER_ACCOUNTS} Twitter accounts to monitor.
                These should be accounts that post about your niche.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="@username or username"
                  value={newTwitter}
                  onChange={(e) => setNewTwitter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTwitter())}
                />
                <Button onClick={addTwitter}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              <div className="p-4 border-2 border-foreground">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">
                    Added: {data.twitterAccounts.length} / {MIN_TWITTER_ACCOUNTS} minimum
                  </span>
                  {data.twitterAccounts.length >= MIN_TWITTER_ACCOUNTS ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                </div>
                <Progress
                  value={Math.min((data.twitterAccounts.length / MIN_TWITTER_ACCOUNTS) * 100, 100)}
                  className="h-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {data.twitterAccounts.map((handle) => (
                  <div
                    key={handle}
                    className="flex items-center justify-between p-2 border-2 border-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Twitter className="h-4 w-4 text-blue-400" />
                      @{handle}
                    </span>
                    <button onClick={() => removeTwitter(handle)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {data.twitterAccounts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Twitter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No accounts added yet</p>
                  <p className="text-sm">Add accounts that post about {data.nicheName || 'your niche'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-500" />
                YouTube Channels
              </CardTitle>
              <CardDescription>
                Add at least {MIN_YOUTUBE_CHANNELS} YouTube channels to monitor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="@channel or channel name"
                  value={newYoutube}
                  onChange={(e) => setNewYoutube(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addYoutube())}
                />
                <Button onClick={addYoutube}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              <div className="p-4 border-2 border-foreground">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">
                    Added: {data.youtubeChannels.length} / {MIN_YOUTUBE_CHANNELS} minimum
                  </span>
                  {data.youtubeChannels.length >= MIN_YOUTUBE_CHANNELS ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                </div>
                <Progress
                  value={Math.min((data.youtubeChannels.length / MIN_YOUTUBE_CHANNELS) * 100, 100)}
                  className="h-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {data.youtubeChannels.map((channel) => (
                  <div
                    key={channel}
                    className="flex items-center justify-between p-2 border-2 border-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-red-500" />
                      {channel}
                    </span>
                    <button onClick={() => removeYoutube(channel)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {data.youtubeChannels.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Youtube className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No channels added yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Host Selection */}
        {currentStep === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Select Your Host
              </CardTitle>
              <CardDescription>
                Choose an AI host personality to narrate your content. Click the play button to preview their voice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {AVAILABLE_HOSTS.map((host) => {
                  const isSelected = data.selectedHost === host.id
                  return (
                    <button
                      key={host.id}
                      onClick={() => setData(d => ({ ...d, selectedHost: host.id }))}
                      className={`flex items-center gap-4 p-4 border-2 transition-colors text-left ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-foreground hover:bg-muted'
                      }`}
                    >
                      <div
                        className="w-12 h-12 flex items-center justify-center border-2 flex-shrink-0"
                        style={{ borderColor: host.color, backgroundColor: `${host.color}20` }}
                      >
                        <span className="font-head text-lg" style={{ color: host.color }}>
                          {host.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{host.name}</p>
                          <Badge variant="outline" style={{ borderColor: host.color, color: host.color }}>
                            {host.archetype}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground italic">"{host.tagline}"</p>
                        <p className="text-xs text-muted-foreground mt-1">{host.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          previewHostVoice(host.id)
                        }}
                        className="p-2 border-2 border-foreground hover:bg-muted transition-colors"
                        title="Preview Voice"
                      >
                        {previewLoading && previewingHost === host.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : previewingHost === host.id ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      {isSelected && <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
              {/* Hidden audio element for previews */}
              <audio
                ref={audioRef}
                src={previewAudioUrl || undefined}
                onEnded={() => setPreviewingHost(null)}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 6: Template Selection */}
        {currentStep === 6 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Choose Show Template
              </CardTitle>
              <CardDescription>
                Select a template for your content. This determines the structure and format of your shows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {AVAILABLE_TEMPLATES.map((template) => {
                  const isSelected = data.selectedTemplate === template.id
                  return (
                    <button
                      key={template.id}
                      onClick={() => setData(d => ({ ...d, selectedTemplate: template.id }))}
                      className={`flex items-center gap-4 p-4 border-2 transition-colors text-left ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-foreground hover:bg-muted'
                      }`}
                    >
                      <div className={`p-3 ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                        <FileText className={`h-6 w-6 ${isSelected ? 'text-primary' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{template.name}</p>
                          <Badge variant="outline">{template.format}</Badge>
                          <Badge variant="secondary">{template.duration}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                      {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 7: Review */}
        {currentStep === 7 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Review & Create
              </CardTitle>
              <CardDescription>
                Confirm your niche setup before creating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border-2 border-foreground">
                <h3 className="font-head text-xl mb-2">{data.nicheName}</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  {data.nicheDescription || 'No description provided'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.keywords.map((kw) => (
                    <Badge key={kw} variant="outline">{kw}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border-2 border-foreground">
                  <div className="flex items-center gap-2 mb-2">
                    <Twitter className="h-5 w-5 text-blue-400" />
                    <span className="font-semibold">Twitter Sources</span>
                  </div>
                  <p className="text-2xl font-head">{data.twitterAccounts.length}</p>
                  <p className="text-xs text-muted-foreground">accounts to monitor</p>
                </div>
                <div className="p-4 border-2 border-foreground">
                  <div className="flex items-center gap-2 mb-2">
                    <Youtube className="h-5 w-5 text-red-500" />
                    <span className="font-semibold">YouTube Channels</span>
                  </div>
                  <p className="text-2xl font-head">{data.youtubeChannels.length}</p>
                  <p className="text-xs text-muted-foreground">channels to follow</p>
                </div>
              </div>

              <div className="p-4 border-2 border-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <Film className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Output Formats</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.outputFormats.map(formatId => {
                    const format = OUTPUT_FORMATS.find(f => f.id === formatId)
                    return format ? (
                      <Badge key={formatId} variant="secondary">{format.label}</Badge>
                    ) : null
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border-2 border-foreground">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Selected Host</span>
                  </div>
                  {(() => {
                    const host = AVAILABLE_HOSTS.find(h => h.id === data.selectedHost)
                    return host ? (
                      <>
                        <p className="font-head text-lg">{host.name}</p>
                        <p className="text-xs text-muted-foreground">{host.archetype}</p>
                      </>
                    ) : <p className="text-muted-foreground">No host selected</p>
                  })()}
                </div>
                <div className="p-4 border-2 border-foreground">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Show Template</span>
                  </div>
                  {(() => {
                    const template = AVAILABLE_TEMPLATES.find(t => t.id === data.selectedTemplate)
                    return template ? (
                      <>
                        <p className="font-head text-lg">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.format} - {template.duration}</p>
                      </>
                    ) : <p className="text-muted-foreground">No template selected</p>
                  })()}
                </div>
              </div>

              {error && (
                <div className="p-4 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-destructive">{error}</span>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full gap-2"
                onClick={createNiche}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Create Niche & Start Pipeline
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 8: Completion Screen */}
        {currentStep === 8 && (
          <Card className="border-success">
            <CardContent className="p-8 text-center">
              <div className="mb-6 relative inline-block">
                <PartyPopper className="h-20 w-20 text-success mx-auto" />
                <Sparkles className="h-8 w-8 text-warning absolute -top-2 -right-2 animate-pulse" />
              </div>
              <h1 className="font-head text-3xl mb-2 text-success">You&apos;re All Set!</h1>
              <p className="text-muted-foreground text-lg mb-6">
                Your <span className="font-semibold text-foreground">{data.nicheName}</span> niche is ready to go.
              </p>

              {/* Summary */}
              <div className="bg-muted/50 border-2 border-foreground p-6 text-left mb-6 max-w-md mx-auto">
                <h3 className="font-semibold mb-4 text-center">What We Created</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span><strong>{data.nicheName}</strong> topic configured</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span><strong>{data.twitterAccounts.length}</strong> Twitter sources added</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span><strong>{data.youtubeChannels.length}</strong> YouTube channels connected</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span><strong>{AVAILABLE_HOSTS.find(h => h.id === data.selectedHost)?.name}</strong> host selected</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span><strong>{AVAILABLE_TEMPLATES.find(t => t.id === data.selectedTemplate)?.name}</strong> template ready</span>
                  </li>
                </ul>
              </div>

              {/* What's Next */}
              <h3 className="font-semibold mb-4">What&apos;s Next?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 max-w-2xl mx-auto">
                <button
                  onClick={() => router.push(`/studio/daily-show?topic_id=${createdTopicId}`)}
                  className="p-4 border-2 border-primary bg-primary/10 hover:bg-primary/20 transition-colors text-left group"
                >
                  <Calendar className="h-8 w-8 text-primary mb-2" />
                  <p className="font-semibold">Create First Show</p>
                  <p className="text-xs text-muted-foreground">Generate your first daily show now</p>
                  <ArrowRight className="h-4 w-4 text-primary mt-2 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => router.push('/outpost')}
                  className="p-4 border-2 border-foreground hover:bg-muted transition-colors text-left group"
                >
                  <Plus className="h-8 w-8 mb-2 text-muted-foreground" />
                  <p className="font-semibold">Add More Sources</p>
                  <p className="text-xs text-muted-foreground">Expand your intelligence network</p>
                  <ArrowRight className="h-4 w-4 mt-2 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="p-4 border-2 border-foreground hover:bg-muted transition-colors text-left group"
                >
                  <Target className="h-8 w-8 mb-2 text-muted-foreground" />
                  <p className="font-semibold">View Dashboard</p>
                  <p className="text-xs text-muted-foreground">Monitor your content pipeline</p>
                  <ArrowRight className="h-4 w-4 mt-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Pro Tip */}
              <div className="bg-primary/10 border-2 border-primary/30 p-4 max-w-md mx-auto">
                <p className="text-sm">
                  <strong>Pro Tip:</strong> Run the pipeline from the Dashboard to start collecting content from your sources.
                  The more content collected, the better your shows will be!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation - Hide on completion screen */}
        {currentStep < 8 && (
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {currentStep < STEPS.length - 2 && (
              <Button
                onClick={() => setCurrentStep(s => s + 1)}
                disabled={!canProceed()}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
