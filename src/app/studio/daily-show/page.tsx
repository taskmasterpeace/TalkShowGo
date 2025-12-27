'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTopic } from '@/context/topic-context'
import {
  Radio,
  CheckCircle2,
  Loader2,
  Mic,
  FileStack,
  Play,
  Download,
  ChevronRight,
  ChevronLeft,
  Twitter,
  RefreshCw,
  Edit3,
  Volume2,
  TrendingUp,
  Clock,
  Users,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react'

// Types
interface ShowTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  template_type: string
  intro_template: string
  story_template: string
  outro_template: string
  twitter_digest_template: string | null
  default_story_count: number
  default_hours_back: number
  max_duration_minutes: number
  style_tone: string
  include_twitter_digest: boolean
  include_cta: boolean
  preferred_host_slug: string | null
  topic_id: string | null
  is_active: boolean
  is_default: boolean
}

interface Host {
  id: string
  name: string
  archetype: string
  tagline: string
  description: string
  voice: {
    tone: string[]
    pace: string
    energy: string
    formality: string
  }
}

interface ProposedTopic {
  id: string
  headline: string  // API returns 'headline', not 'title'
  summary: string
  source_count: number
  engagement_score: number
  twitter_mentions: number
  youtube_videos: number
  suggested_priority: number
  keywords: string[]
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  sources: Array<{
    type: 'tweet' | 'youtube'
    title: string
    url: string
    engagement: number
    author: string
    published_at: string
  }>
}

interface TrendingTopic {
  topic: string
  mentions: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  sample_tweet?: string
  top_account?: string
}

interface TwitterDigest {
  trending_topics: TrendingTopic[]
  sentiment: { overall: string; breakdown: Record<string, number> }
  top_tweets: Array<{
    text: string
    author: string
    likes: number
    retweets: number
  }>
  formatted_script: string
}

const WIZARD_STEPS = [
  { id: 'template', label: 'Template', icon: FileStack },
  { id: 'host', label: 'Host', icon: Mic },
  { id: 'topics', label: 'Topics', icon: TrendingUp },
  { id: 'preview', label: 'Preview', icon: Edit3 },
  { id: 'generate', label: 'Generate', icon: Volume2 },
]

// Default hosts matching the codebase
const HOSTS: Host[] = [
  {
    id: 'maya_sterling',
    name: 'Maya Sterling',
    archetype: 'investigative_anchor',
    tagline: 'Let me walk you through this...',
    description: 'Methodical investigative journalist who builds her case piece by piece.',
    voice: { tone: ['intelligent', 'thorough', 'passionate'], pace: 'moderate', energy: 'moderate', formality: 'professional' }
  },
  {
    id: 'marcus_blaze',
    name: 'Marcus Blaze',
    archetype: 'hot_take_king',
    tagline: "I'm just saying what everybody's thinking!",
    description: "High-energy opinion machine who isn't afraid to take controversial stances.",
    voice: { tone: ['passionate', 'confrontational', 'dramatic'], pace: 'variable', energy: 'explosive', formality: 'conversational' }
  },
  {
    id: 'devon_sharp',
    name: 'Devon Sharp',
    archetype: 'witty_satirist',
    tagline: 'Wait, wait, wait... are we serious right now?',
    description: 'Sharp-witted commentator who uses humor to expose absurdity.',
    voice: { tone: ['sarcastic', 'intelligent', 'incredulous'], pace: 'variable', energy: 'moderate', formality: 'conversational' }
  },
  {
    id: 'tasha_raw',
    name: 'Tasha Raw',
    archetype: 'unfiltered_real',
    tagline: "I don't got time for the bullsh*t",
    description: 'Unfiltered voice of the people. Says exactly what the culture is thinking.',
    voice: { tone: ['blunt', 'funny', 'real'], pace: 'fast', energy: 'high', formality: 'street' }
  },
  {
    id: 'james_noble',
    name: 'James Noble',
    archetype: 'smooth_narrator',
    tagline: 'This is the story of...',
    description: 'The voice of gravitas. Smooth, authoritative narrator who makes everything feel cinematic.',
    voice: { tone: ['authoritative', 'calm', 'dramatic'], pace: 'slow', energy: 'calm', formality: 'professional' }
  },
  {
    id: 'dj_momentum',
    name: 'DJ Momentum',
    archetype: 'hype_energy',
    tagline: "LET'S GOOOO!",
    description: 'Pure energy personified. Gets the audience hyped and keeps the momentum going.',
    voice: { tone: ['excited', 'energetic', 'positive'], pace: 'fast', energy: 'explosive', formality: 'casual' }
  },
  {
    id: 'king_knowledge',
    name: 'King Knowledge',
    archetype: 'street_analyst',
    tagline: 'Real recognize real',
    description: 'Deep cultural insider who breaks down the game from within.',
    voice: { tone: ['wise', 'measured', 'authentic'], pace: 'moderate', energy: 'moderate', formality: 'street' }
  },
]

export default function DailyShowPage() {
  // Get selected topic from context
  const { selectedTopic, isLoading: topicLoading } = useTopic()

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0)

  // Selection state
  const [templates, setTemplates] = useState<ShowTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ShowTemplate | null>(null)
  const [selectedHost, setSelectedHost] = useState<Host | null>(null)

  // Channel style & production format
  const [productionFormat, setProductionFormat] = useState('news_bulletin')
  const [useAlgorithmStyle, setUseAlgorithmStyle] = useState(true)

  // Topics state
  const [proposedTopics, setProposedTopics] = useState<ProposedTopic[]>([])
  const [selectedTopicIndices, setSelectedTopicIndices] = useState<Set<number>>(new Set())
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [hoursBack, setHoursBack] = useState(24)

  // Date selection mode
  const [dateMode, setDateMode] = useState<'hours' | 'date'>('hours')
  const [targetDate, setTargetDate] = useState<string>('')  // YYYY-MM-DD format

  // Helper to get preset dates
  const getPresetDates = () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const dayBefore = new Date(today)
    dayBefore.setDate(dayBefore.getDate() - 2)

    return {
      today: today.toISOString().split('T')[0],
      yesterday: yesterday.toISOString().split('T')[0],
      dayBefore: dayBefore.toISOString().split('T')[0]
    }
  }

  // Twitter digest state
  const [twitterDigest, setTwitterDigest] = useState<TwitterDigest | null>(null)
  const [includeTwitter, setIncludeTwitter] = useState(true)

  // Preview/generation state
  const [previewScript, setPreviewScript] = useState('')
  const [editedScript, setEditedScript] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
        // Auto-select default template
        const defaultTemplate = data.find((t: ShowTemplate) => t.is_default && t.template_type === 'daily')
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate)
          setHoursBack(defaultTemplate.default_hours_back)
          setIncludeTwitter(defaultTemplate.include_twitter_digest)
          // Auto-select preferred host
          if (defaultTemplate.preferred_host_slug) {
            const preferredHost = HOSTS.find(h => h.id === defaultTemplate.preferred_host_slug)
            if (preferredHost) setSelectedHost(preferredHost)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    }
  }

  const fetchProposedTopics = async () => {
    if (!selectedTopic) {
      setError('Please select a niche first')
      return
    }

    setLoadingTopics(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        topic_id: selectedTopic.id,
        max_topics: '5',
        include_twitter: includeTwitter.toString()
      })

      // Use target_date if in date mode, otherwise use hours_back
      if (dateMode === 'date' && targetDate) {
        params.append('target_date', targetDate)
      } else {
        params.append('hours_back', hoursBack.toString())
      }

      const res = await fetch(`/api/stories/daily-show/propose?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProposedTopics(data.topics || [])
        if (data.twitter_digest) {
          setTwitterDigest({
            trending_topics: data.twitter_digest.trending || [],
            sentiment: data.twitter_digest.sentiment || { overall: 'neutral', breakdown: {} },
            top_tweets: data.twitter_digest.top_tweets || [],
            formatted_script: data.twitter_digest.formatted_script || ''
          })
        }
        // Auto-select all topics
        setSelectedTopicIndices(new Set(data.topics?.map((_: unknown, i: number) => i) || []))
      } else {
        const errData = await res.json()
        setError(errData.error || 'Failed to fetch topics')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoadingTopics(false)
    }
  }

  const generatePreviewScript = useCallback(() => {
    if (!selectedTemplate || !selectedHost) return

    const selectedTopicsList = Array.from(selectedTopicIndices).map(i => proposedTopics[i])
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    let script = ''

    // Intro
    script += '=== INTRO ===\n\n'
    script += selectedTemplate.intro_template
      .replace('{show_name}', 'Battle Rap Daily')
      .replace('{date}', date)
      .replace('{host_name}', selectedHost.name)
      .replace('{topic_count}', selectedTopicsList.length.toString())
      .replace('{twitter_trending}', twitterDigest?.formatted_script || '')
      .replace('{host_opening}', selectedHost.tagline)
    script += '\n\n'

    // Stories
    selectedTopicsList.forEach((topic, i) => {
      script += `=== STORY ${i + 1}: ${topic.headline} ===\n\n`
      script += selectedTemplate.story_template
        .replace('{headline}', topic.headline)
        .replace('{story_body}', topic.summary)
        .replace('{transition}', i === 0 ? "Let's get into it." : 'Moving on...')
        .replace('{twitter_reaction}', topic.sentiment ? `The community is feeling ${topic.sentiment} about this.` : '')
      script += '\n\n'
    })

    // Outro
    script += '=== OUTRO ===\n\n'
    script += selectedTemplate.outro_template
      .replace('{show_name}', 'Battle Rap Daily')
      .replace('{host_closing}', `I'm ${selectedHost.name}, and that's your Battle Rap Daily.`)

    setPreviewScript(script)
    setEditedScript(script)
  }, [selectedTemplate, selectedHost, selectedTopicIndices, proposedTopics, twitterDigest])

  // Auto-generate preview when entering preview step
  useEffect(() => {
    if (currentStep === 3) {
      generatePreviewScript()
    }
  }, [currentStep, generatePreviewScript])

  const handleGenerate = async () => {
    if (!selectedTemplate || !selectedHost || !selectedTopic) {
      setError('Please select a template, host, and niche')
      return
    }

    setIsGenerating(true)
    setGenerationProgress('Starting generation...')
    setError(null)
    setAudioUrl(null)

    try {
      setGenerationProgress('Generating audio script...')

      const response = await fetch('/api/stories/daily-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopic.id,
          show_name: selectedTopic.name + ' Daily',
          host_name: selectedHost.name,
          stories_count: selectedTopicIndices.size,
          hours_back: hoursBack,
          generate_audio: true,
          template_id: selectedTemplate.id,
          host_slug: selectedHost.id,
          selected_topics: Array.from(selectedTopicIndices).map(i => proposedTopics[i]),
          custom_script: editedScript,
          production_format: productionFormat,
          channel_style_file: useAlgorithmStyle ? 'algorithm-institute-of-battle-rap' : null
        })
      })

      if (response.ok) {
        const data = await response.json()
        setGenerationProgress('Audio generated successfully!')
        if (data.audio_url) {
          setAudioUrl(data.audio_url)
        }
      } else {
        const errData = await response.json()
        setError(errData.error || 'Generation failed')
        setGenerationProgress('')
      }
    } catch (err) {
      setError(String(err))
      setGenerationProgress('')
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleTopicSelection = (index: number) => {
    const newSet = new Set(selectedTopicIndices)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedTopicIndices(newSet)
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedTemplate !== null
      case 1: return selectedHost !== null
      case 2: return selectedTopicIndices.size > 0
      case 3: return editedScript.length > 0
      case 4: return true
      default: return false
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Template Selection
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-head">Select Show Template</h2>
            <p className="text-muted-foreground">Choose the format and style for your show.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template)
                    setHoursBack(template.default_hours_back)
                    setIncludeTwitter(template.include_twitter_digest)
                    if (template.preferred_host_slug) {
                      const host = HOSTS.find(h => h.id === template.preferred_host_slug)
                      if (host) setSelectedHost(host)
                    }
                  }}
                  className={`p-4 border-2 text-left transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-primary bg-primary/10 brutal-shadow'
                      : 'border-foreground hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold">{template.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-muted border border-foreground">
                        {template.template_type}
                      </span>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground mt-2">{template.description}</p>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                    <span><Clock className="inline h-3 w-3 mr-1" />{template.default_hours_back}h</span>
                    <span><TrendingUp className="inline h-3 w-3 mr-1" />{template.default_story_count} stories</span>
                    {template.include_twitter_digest && (
                      <span><Twitter className="inline h-3 w-3 mr-1" />Twitter</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {templates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No templates found. <a href="/studio/templates" className="text-primary underline">Create one</a>
              </div>
            )}
          </div>
        )

      case 1: // Host Selection
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-head">Select Your Host</h2>
            <p className="text-muted-foreground">Each host brings a unique personality and style to the show.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {HOSTS.map(host => (
                <button
                  key={host.id}
                  onClick={() => setSelectedHost(host)}
                  className={`p-4 border-2 text-left transition-all ${
                    selectedHost?.id === host.id
                      ? 'border-primary bg-primary/10 brutal-shadow'
                      : 'border-foreground hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold">{host.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-muted border border-foreground capitalize">
                        {host.archetype.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {selectedHost?.id === host.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <p className="text-sm italic text-muted-foreground mt-2">"{host.tagline}"</p>
                  <p className="text-xs text-muted-foreground mt-1">{host.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {host.voice.tone.slice(0, 3).map(t => (
                      <span key={t} className="text-xs px-1.5 py-0.5 bg-secondary/50 border border-foreground/30">
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {/* Production Format & Channel Style Controls */}
            <div className="mt-6 space-y-4 p-4 border-2 border-foreground bg-muted/30">
              <div>
                <label className="block font-bold mb-2">Production Format</label>
                <select
                  value={productionFormat}
                  onChange={(e) => setProductionFormat(e.target.value)}
                  className="w-full p-2 border-2 border-foreground bg-background"
                >
                  <option value="talk_show">Talk Show (Multi-perspective debate)</option>
                  <option value="news_bulletin">News Bulletin (Breaking news)</option>
                  <option value="news_coverage">News Coverage (In-depth reporting)</option>
                  <option value="hot_take">Hot Take (Opinion/reaction)</option>
                  <option value="investigation">Investigation (Deep dive)</option>
                  <option value="narrative_story">Narrative Story (Storytelling)</option>
                  <option value="recap">Recap (Summary)</option>
                  <option value="prediction_panel">Prediction Panel (Speculation)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAlgorithmStyle}
                    onChange={(e) => setUseAlgorithmStyle(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-bold">Use Algorithm Institute channel style</span>
                </label>
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  Writes in your channel's signature style: cinematic openings, chapter transitions, dramatic tone, iconic closing
                </p>
              </div>
            </div>
          </div>
        )

      case 2: // Topic Selection
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-head">Select Topics</h2>
                <p className="text-muted-foreground">Pick which stories to include in the show.</p>
              </div>
            </div>

            {/* Date Selection Controls */}
            <div className="flex flex-wrap items-center gap-4 p-4 border-2 border-foreground/30 bg-muted/30">
              {/* Mode Toggle */}
              <div className="flex items-center border-2 border-foreground">
                <button
                  onClick={() => setDateMode('hours')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    dateMode === 'hours'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Clock className="h-4 w-4 inline mr-1" />
                  Hours Back
                </button>
                <button
                  onClick={() => {
                    setDateMode('date')
                    if (!targetDate) {
                      setTargetDate(getPresetDates().yesterday)
                    }
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    dateMode === 'date'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Clock className="h-4 w-4 inline mr-1" />
                  Specific Date
                </button>
              </div>

              {/* Hours Back selector */}
              {dateMode === 'hours' && (
                <select
                  value={hoursBack}
                  onChange={(e) => setHoursBack(Number(e.target.value))}
                  className="border-2 border-foreground px-3 py-1.5 bg-background"
                >
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                </select>
              )}

              {/* Date picker and presets */}
              {dateMode === 'date' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    max={getPresetDates().today}
                    className="border-2 border-foreground px-3 py-1.5 bg-background"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTargetDate(getPresetDates().yesterday)}
                      className={`px-2 py-1 text-xs border-2 transition-colors ${
                        targetDate === getPresetDates().yesterday
                          ? 'border-primary bg-primary/10 font-bold'
                          : 'border-foreground/50 hover:bg-muted'
                      }`}
                    >
                      Yesterday
                    </button>
                    <button
                      onClick={() => setTargetDate(getPresetDates().dayBefore)}
                      className={`px-2 py-1 text-xs border-2 transition-colors ${
                        targetDate === getPresetDates().dayBefore
                          ? 'border-primary bg-primary/10 font-bold'
                          : 'border-foreground/50 hover:bg-muted'
                      }`}
                    >
                      Day Before
                    </button>
                  </div>
                </div>
              )}

              {/* Twitter toggle */}
              <label className="flex items-center gap-2 ml-auto">
                <input
                  type="checkbox"
                  checked={includeTwitter}
                  onChange={(e) => setIncludeTwitter(e.target.checked)}
                  className="w-4 h-4"
                />
                <Twitter className="h-4 w-4" />
                <span className="text-sm">Include Twitter</span>
              </label>

              {/* Scan button */}
              <button
                onClick={fetchProposedTopics}
                disabled={loadingTopics || (dateMode === 'date' && !targetDate)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-foreground bg-primary text-primary-foreground hover:brutal-shadow disabled:opacity-50"
              >
                {loadingTopics ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Scan Sources
              </button>
            </div>

            {error && (
              <div className="p-4 border-2 border-destructive bg-destructive/10 text-destructive">
                {error}
              </div>
            )}

            {loadingTopics ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3">Scanning Twitter and YouTube...</span>
              </div>
            ) : proposedTopics.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{selectedTopicIndices.size} of {proposedTopics.length} selected</span>
                  <button
                    onClick={() => {
                      if (selectedTopicIndices.size === proposedTopics.length) {
                        setSelectedTopicIndices(new Set())
                      } else {
                        setSelectedTopicIndices(new Set(proposedTopics.map((_, i) => i)))
                      }
                    }}
                    className="text-primary hover:underline"
                  >
                    {selectedTopicIndices.size === proposedTopics.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {proposedTopics.map((topic, i) => (
                  <button
                    key={i}
                    onClick={() => toggleTopicSelection(i)}
                    className={`w-full p-4 border-2 text-left transition-all ${
                      selectedTopicIndices.has(i)
                        ? 'border-primary bg-primary/5'
                        : 'border-foreground/30 hover:border-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {selectedTopicIndices.has(i) ? (
                        <CheckSquare className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold">{topic.headline}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 border ${
                              topic.twitter_mentions > 0 && topic.youtube_videos > 0 ? 'bg-purple-100 border-purple-300' :
                              topic.twitter_mentions > 0 ? 'bg-blue-100 border-blue-300' :
                              'bg-red-100 border-red-300'
                            }`}>
                              {topic.twitter_mentions > 0 && topic.youtube_videos > 0 ? 'mixed' :
                               topic.twitter_mentions > 0 ? 'twitter' : 'youtube'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Score: {Math.round(topic.engagement_score)}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{topic.summary}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {topic.keywords.slice(0, 5).map(kw => (
                            <span key={kw} className="text-xs px-1.5 py-0.5 bg-muted border border-foreground/20">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Twitter Digest Preview */}
                {includeTwitter && twitterDigest && (
                  <div className="mt-6 p-4 border-2 border-blue-400 bg-blue-50">
                    <h3 className="font-bold flex items-center gap-2">
                      <Twitter className="h-4 w-4" />
                      Twitter Digest
                    </h3>
                    {twitterDigest.trending_topics.length > 0 && (
                      <div className="mt-2">
                        <span className="text-sm font-medium">Trending:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {twitterDigest.trending_topics.map((t: TrendingTopic) => (
                            <span key={t.topic} className="text-xs px-2 py-0.5 bg-blue-200 border border-blue-400">
                              {t.topic} ({t.mentions})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {twitterDigest.top_tweets.length > 0 && (
                      <div className="mt-3">
                        <span className="text-sm font-medium">Top Reactions:</span>
                        {twitterDigest.top_tweets.slice(0, 2).map((tweet, i) => (
                          <div key={i} className="mt-2 p-2 bg-white border border-blue-200 text-sm">
                            <p className="italic">"{tweet.text}"</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              — @{tweet.author} ({tweet.likes} likes)
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-foreground/30">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Click "Scan Sources" to discover trending topics</p>
                <p className="text-sm">
                  {dateMode === 'date' && targetDate
                    ? `We'll search Twitter and YouTube for ${new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                    : `We'll search Twitter and YouTube for the last ${hoursBack} hours`
                  }
                </p>
              </div>
            )}
          </div>
        )

      case 3: // Preview & Edit
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-head">Preview & Edit Script</h2>
                <p className="text-muted-foreground">Review and edit before generating audio.</p>
              </div>
              <button
                onClick={generatePreviewScript}
                className="flex items-center gap-2 px-4 py-2 border-2 border-foreground hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </button>
            </div>

            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Mic className="h-4 w-4" />
                Host: <strong>{selectedHost?.name}</strong>
              </span>
              <span className="flex items-center gap-1">
                <FileStack className="h-4 w-4" />
                Template: <strong>{selectedTemplate?.name}</strong>
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Stories: <strong>{selectedTopicIndices.size}</strong>
              </span>
            </div>

            <textarea
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              className="w-full h-[400px] p-4 border-2 border-foreground bg-background font-mono text-sm resize-none"
              placeholder="Script will appear here..."
            />

            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Words: {editedScript.split(/\s+/).filter(Boolean).length}</span>
              <span>Est. duration: ~{Math.ceil(editedScript.split(/\s+/).filter(Boolean).length / 150)} minutes</span>
            </div>
          </div>
        )

      case 4: // Generate
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-head">Generate Audio</h2>
              <p className="text-muted-foreground">Ready to create your Battle Rap Daily episode.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 p-6 border-2 border-foreground bg-muted/30">
              <div className="text-center">
                <Mic className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="font-bold">{selectedHost?.name}</p>
                <p className="text-xs text-muted-foreground">Host</p>
              </div>
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="font-bold">{selectedTopicIndices.size} Stories</p>
                <p className="text-xs text-muted-foreground">Topics</p>
              </div>
              <div className="text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="font-bold">~{Math.ceil(editedScript.split(/\s+/).filter(Boolean).length / 150)} min</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
            </div>

            {error && (
              <div className="p-4 border-2 border-destructive bg-destructive/10 text-destructive">
                {error}
              </div>
            )}

            {generationProgress && (
              <div className="p-4 border-2 border-primary bg-primary/10 text-primary flex items-center gap-3">
                {isGenerating && <Loader2 className="h-5 w-5 animate-spin" />}
                {generationProgress}
              </div>
            )}

            {audioUrl ? (
              <div className="space-y-4">
                <div className="p-4 border-2 border-success bg-success/10">
                  <div className="flex items-center gap-2 text-success mb-3">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-bold">Audio Generated Successfully!</span>
                  </div>
                  <audio controls className="w-full">
                    <source src={audioUrl} type="audio/mpeg" />
                  </audio>
                </div>
                <div className="flex gap-3">
                  <a
                    href={audioUrl}
                    download
                    className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-foreground bg-secondary hover:brutal-shadow"
                  >
                    <Download className="h-5 w-5" />
                    Download MP3
                  </a>
                  <button
                    onClick={() => {
                      setAudioUrl(null)
                      setGenerationProgress('')
                    }}
                    className="px-6 py-3 border-2 border-foreground hover:bg-muted"
                  >
                    Generate Again
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 border-2 border-foreground bg-primary text-primary-foreground text-lg font-bold hover:brutal-shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-6 w-6" />
                    Generate Audio
                  </>
                )}
              </button>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Radio className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-head">Battle Rap Daily</h1>
          <p className="text-muted-foreground">Create your daily show in 5 steps</p>
        </div>
      </div>

      {/* Wizard Steps */}
      <div className="flex items-center justify-between mb-8 p-4 border-2 border-foreground bg-muted/30">
        {WIZARD_STEPS.map((step, i) => {
          const Icon = step.icon
          const isActive = i === currentStep
          const isCompleted = i < currentStep

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => i <= currentStep && setCurrentStep(i)}
                disabled={i > currentStep}
                className={`flex items-center gap-2 px-3 py-2 transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-success/20 text-success'
                    : 'text-muted-foreground'
                } ${i <= currentStep ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
                <span className="hidden md:inline font-medium">{step.label}</span>
              </button>
              {i < WIZARD_STEPS.length - 1 && (
                <ChevronRight className={`h-5 w-5 mx-2 ${i < currentStep ? 'text-success' : 'text-muted-foreground'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <div className="border-2 border-foreground p-6 bg-background min-h-[400px]">
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-6 py-3 border-2 border-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>

        {currentStep < WIZARD_STEPS.length - 1 && (
          <button
            onClick={() => setCurrentStep(prev => Math.min(WIZARD_STEPS.length - 1, prev + 1))}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-3 border-2 border-foreground bg-primary text-primary-foreground hover:brutal-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
