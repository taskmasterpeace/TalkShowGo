'use client'

import React, { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Progress,
  Input,
  Textarea,
} from '@/components/ui'
import {
  Mic,
  Play,
  Pause,
  Volume2,
  Settings,
  Loader2,
  Quote,
  Zap,
  Brain,
  Heart,
  Flame,
  Shield,
  Sparkles,
  Users,
  Plus,
  Edit,
  Save,
  X,
  Eye,
  Target,
  BookOpen,
  Star,
  Crown,
  Clock,
  MessageCircle,
  Sun,
  Check,
  Map,
  Archive,
  Fingerprint,
  BadgeCheck,
  FastForward,
  AlertCircle,
  Wand2,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface PersonalityTrait {
  id?: string
  trait_name: string
  trait_category: string
  trait_value: number
  trait_description: string
  trait_icon: string
  display_order: number
}

interface Host {
  id: string
  name: string
  archetype: string
  tagline: string
  short_bio: string
  full_bio: string
  voice_style: string
  voice_id: string | null
  best_for: string[]
  catchphrases: string[]
  color_primary: string
  color_secondary: string
  gradient_bg: string
  is_active: boolean
  host_personality_traits: PersonalityTrait[]
}

// Icon mapping
const ICON_MAP: Record<string, any> = {
  brain: Brain,
  heart: Heart,
  shield: Shield,
  zap: Zap,
  smile: Sparkles,
  target: Target,
  'book-open': BookOpen,
  flame: Flame,
  eye: Eye,
  crown: Crown,
  star: Star,
  users: Users,
  clock: Clock,
  'message-circle': MessageCircle,
  sun: Sun,
  check: Check,
  'check-circle': Check,
  map: Map,
  archive: Archive,
  fingerprint: Fingerprint,
  'badge-check': BadgeCheck,
  'fast-forward': FastForward,
  hourglass: Clock,
  'party-popper': Sparkles,
  'pen-tool': Edit,
  book: BookOpen,
  swords: Shield,
}

// ============================================
// TEST VOICE DIALOG
// ============================================

interface HostPreviewInfo {
  host_id: string
  host_name: string
  archetype: string
  test_script: string
  voice_preset: {
    stability: number
    similarity_boost: number
    style: number
  }
  estimated_duration_seconds: number
  elevenlabs_configured: boolean
}

function TestVoiceDialog({
  hostId,
  hostName,
  hostColor,
  open,
  onClose,
}: {
  hostId: string
  hostName: string
  hostColor: string
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewInfo, setPreviewInfo] = useState<HostPreviewInfo | null>(null)
  const [script, setScript] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Fetch preview info when dialog opens
  useEffect(() => {
    if (open && hostId) {
      fetchPreviewInfo()
    }
    // Reset state when dialog closes
    if (!open) {
      setAudioUrl(null)
      setError(null)
      setIsPlaying(false)
    }
  }, [open, hostId])

  const fetchPreviewInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hosts/${hostId}/preview`)
      const data = await res.json()
      if (res.ok) {
        setPreviewInfo(data)
        setScript(data.test_script)
      } else {
        setError(data.error || 'Failed to load preview info')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePreview = async () => {
    setGenerating(true)
    setError(null)
    setAudioUrl(null)

    try {
      const res = await fetch(`/api/hosts/${hostId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      })
      const data = await res.json()

      if (res.ok && data.audio_url) {
        setAudioUrl(data.audio_url)
      } else {
        setError(data.error || 'Failed to generate preview')
      }
    } catch {
      setError('Failed to generate preview. Check ElevenLabs configuration.')
    } finally {
      setGenerating(false)
    }
  }

  const togglePlayback = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl flex items-center gap-2">
            <Mic className="h-6 w-6" style={{ color: hostColor }} />
            Test Voice: {hostName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error && !previewInfo ? (
            <div className="p-4 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">{error}</span>
            </div>
          ) : previewInfo ? (
            <>
              {/* Info */}
              <div className="p-4 bg-muted border-2 border-foreground/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Host Archetype</span>
                  <Badge style={{ backgroundColor: hostColor }} className="text-white">
                    {previewInfo.archetype.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Duration</span>
                  <span>~{previewInfo.estimated_duration_seconds} seconds</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">ElevenLabs Status</span>
                  <span className={previewInfo.elevenlabs_configured ? 'text-green-500' : 'text-amber-500'}>
                    {previewInfo.elevenlabs_configured ? 'Configured' : 'Not Configured'}
                  </span>
                </div>
              </div>

              {/* Script Editor */}
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center justify-between">
                  <span>Test Script</span>
                  <span className="text-xs text-muted-foreground">
                    {script.split(/\s+/).length} words
                  </span>
                </label>
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={5}
                  placeholder="Enter script to preview..."
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Edit the script to hear how {hostName} would deliver different content.
                </p>
              </div>

              {/* Audio Player */}
              {audioUrl && (
                <div className="p-4 border-2 border-foreground/20 bg-background">
                  <div className="flex items-center gap-4">
                    <button
                      className="p-4 rounded-full transition-colors hover:bg-muted"
                      style={{ backgroundColor: `${hostColor}20` }}
                      onClick={togglePlayback}
                    >
                      {isPlaying ? (
                        <Pause className="h-6 w-6" style={{ color: hostColor }} />
                      ) : (
                        <Play className="h-6 w-6" style={{ color: hostColor }} />
                      )}
                    </button>
                    <div className="flex-1">
                      <p className="font-medium">{hostName} Preview</p>
                      <p className="text-sm text-muted-foreground">
                        ~{Math.ceil(script.split(/\s+/).length / 2.5)} seconds
                      </p>
                    </div>
                    <Volume2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-destructive">{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button
                  onClick={handleGeneratePreview}
                  disabled={generating || !script.trim() || !previewInfo.elevenlabs_configured}
                  style={{ backgroundColor: hostColor }}
                  className="text-white"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Generate Preview
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// HOST PROFILE CARD
// ============================================

function HostProfileCard({
  host,
  onSelect,
  onEdit,
  onTestVoice,
  isSelected,
}: {
  host: Host
  onSelect: () => void
  onEdit: () => void
  onTestVoice: () => void
  isSelected: boolean
}) {
  // Group traits by category
  const coreTraits = host.host_personality_traits?.filter(t => t.trait_category === 'core') || []
  const styleTraits = host.host_personality_traits?.filter(t => t.trait_category === 'style') || []
  const approachTraits = host.host_personality_traits?.filter(t => t.trait_category === 'approach') || []

  const displayTraits = [...coreTraits.slice(0, 2), ...styleTraits.slice(0, 1), ...approachTraits.slice(0, 1)]

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 hover:scale-[1.01] ${
        isSelected ? 'ring-4 ring-primary' : ''
      }`}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${host.gradient_bg} opacity-50`} />

      <CardContent className="relative p-6">
        <div className="flex gap-6">
          {/* Avatar placeholder */}
          <div
            className="w-32 h-32 flex-shrink-0 border-4 border-foreground bg-muted flex items-center justify-center relative overflow-hidden"
            style={{ borderColor: host.color_primary }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{ backgroundColor: host.color_primary }}
            />
            <span className="font-head text-4xl" style={{ color: host.color_primary }}>
              {host.name.split(' ').map(n => n[0]).join('')}
            </span>

            {/* Voice preview button */}
            <button
              className="absolute bottom-2 right-2 p-2 bg-background border-2 border-foreground hover:bg-muted transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onTestVoice()
              }}
              title="Test Voice"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-head text-2xl">{host.name}</h3>
                <Badge
                  style={{ backgroundColor: host.color_primary }}
                  className="text-white"
                >
                  {host.archetype}
                </Badge>
              </div>
              <div className="flex gap-2">
                <button
                  className="p-2 border-2 border-foreground hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  className="p-2 border-2 border-foreground hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect()
                  }}
                >
                  <Eye className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tagline */}
            <p
              className="text-lg italic mb-3 flex items-center gap-2"
              style={{ color: host.color_primary }}
            >
              <Quote className="h-4 w-4" />
              {host.tagline}
            </p>

            {/* Short bio */}
            <p className="text-muted-foreground mb-4">{host.short_bio}</p>

            {/* Personality bars - show top 4 traits */}
            <div className="grid grid-cols-4 gap-3">
              {displayTraits.map((trait) => {
                const IconComponent = ICON_MAP[trait.trait_icon] || Brain
                return (
                  <div key={trait.trait_name} className="text-center">
                    <IconComponent
                      className="h-5 w-5 mx-auto mb-1"
                      style={{ color: host.color_primary }}
                    />
                    <div className="h-2 bg-muted rounded-full overflow-hidden border border-foreground/20">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${trait.trait_value}%`,
                          backgroundColor: host.color_primary,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{trait.trait_name}</span>
                    <span className="text-xs font-bold ml-1" style={{ color: host.color_primary }}>
                      {trait.trait_value}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Catchphrases */}
        <div className="mt-4 flex flex-wrap gap-2">
          {host.catchphrases?.slice(0, 3).map((phrase, i) => (
            <Badge
              key={i}
              variant="outline"
              className="border-2"
              style={{ borderColor: host.color_primary }}
            >
              "{phrase}"
            </Badge>
          ))}
        </div>

        {/* Best for */}
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Best for:</span>
          {host.best_for?.map((use, i) => (
            <span key={i}>
              {use}
              {i < host.best_for.length - 1 && ' • '}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// HOST DETAIL MODAL
// ============================================

function HostDetailModal({
  host,
  open,
  onClose,
}: {
  host: Host | null
  open: boolean
  onClose: () => void
}) {
  if (!host) return null

  // Group traits by category
  const traitsByCategory = {
    core: host.host_personality_traits?.filter(t => t.trait_category === 'core') || [],
    style: host.host_personality_traits?.filter(t => t.trait_category === 'style') || [],
    approach: host.host_personality_traits?.filter(t => t.trait_category === 'approach') || [],
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className={`absolute inset-0 bg-gradient-to-br ${host.gradient_bg} opacity-30 pointer-events-none`} />

        <DialogHeader className="relative">
          <div className="flex gap-6">
            {/* Large avatar */}
            <div
              className="w-40 h-40 flex-shrink-0 border-4 border-foreground bg-muted flex items-center justify-center"
              style={{ borderColor: host.color_primary }}
            >
              <span className="font-head text-5xl" style={{ color: host.color_primary }}>
                {host.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>

            <div>
              <DialogTitle className="font-head text-3xl">{host.name}</DialogTitle>
              <Badge
                className="text-white mt-2"
                style={{ backgroundColor: host.color_primary }}
              >
                {host.archetype}
              </Badge>
              <p
                className="text-xl italic mt-3 flex items-center gap-2"
                style={{ color: host.color_primary }}
              >
                <Quote className="h-5 w-5" />
                {host.tagline}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="relative space-y-6 mt-4">
          {/* Full bio */}
          <div>
            <h4 className="font-semibold mb-2 text-lg">About</h4>
            <p className="text-muted-foreground leading-relaxed">{host.full_bio}</p>
          </div>

          {/* Personality - All traits by category */}
          <div>
            <h4 className="font-semibold mb-3 text-lg">Personality Profile</h4>

            {/* Core Traits */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wide">Core Personality</p>
              <div className="grid grid-cols-2 gap-3">
                {traitsByCategory.core.map((trait) => {
                  const IconComponent = ICON_MAP[trait.trait_icon] || Brain
                  return (
                    <div key={trait.trait_name} className="p-3 border-2 border-foreground/20 bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent className="h-5 w-5" style={{ color: host.color_primary }} />
                        <span className="font-semibold">{trait.trait_name}</span>
                        <span className="ml-auto font-head text-lg" style={{ color: host.color_primary }}>
                          {trait.trait_value}
                        </span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden border border-foreground/20">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${trait.trait_value}%`,
                            backgroundColor: host.color_primary,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{trait.trait_description}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Style Traits */}
            {traitsByCategory.style.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wide">Delivery Style</p>
                <div className="grid grid-cols-2 gap-3">
                  {traitsByCategory.style.map((trait) => {
                    const IconComponent = ICON_MAP[trait.trait_icon] || Zap
                    return (
                      <div key={trait.trait_name} className="p-3 border-2 border-foreground/20 bg-background">
                        <div className="flex items-center gap-2 mb-2">
                          <IconComponent className="h-5 w-5" style={{ color: host.color_secondary }} />
                          <span className="font-semibold">{trait.trait_name}</span>
                          <span className="ml-auto font-head text-lg" style={{ color: host.color_secondary }}>
                            {trait.trait_value}
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden border border-foreground/20">
                          <div
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${trait.trait_value}%`,
                              backgroundColor: host.color_secondary,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{trait.trait_description}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Approach Traits */}
            {traitsByCategory.approach.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wide">Content Approach</p>
                <div className="grid grid-cols-2 gap-3">
                  {traitsByCategory.approach.map((trait) => {
                    const IconComponent = ICON_MAP[trait.trait_icon] || Target
                    return (
                      <div key={trait.trait_name} className="p-3 border-2 border-foreground/20 bg-background">
                        <div className="flex items-center gap-2 mb-2">
                          <IconComponent className="h-5 w-5" style={{ color: host.color_primary }} />
                          <span className="font-semibold">{trait.trait_name}</span>
                          <span className="ml-auto font-head text-lg" style={{ color: host.color_primary }}>
                            {trait.trait_value}
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden border border-foreground/20">
                          <div
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${trait.trait_value}%`,
                              backgroundColor: host.color_primary,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{trait.trait_description}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Voice */}
          <div>
            <h4 className="font-semibold mb-2 text-lg">Voice Style</h4>
            <div className="p-4 border-2 border-foreground/20 flex items-center gap-4">
              <Volume2 className="h-8 w-8" style={{ color: host.color_primary }} />
              <div className="flex-1">
                <p>{host.voice_style}</p>
                <p className="text-sm text-muted-foreground">
                  {host.voice_id ? 'Voice configured' : 'Voice not yet configured'}
                </p>
              </div>
              <Button variant="outline" className="gap-2">
                <Play className="h-4 w-4" />
                Preview Voice
              </Button>
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Configure
              </Button>
            </div>
          </div>

          {/* Catchphrases */}
          <div>
            <h4 className="font-semibold mb-2 text-lg">Signature Phrases</h4>
            <div className="flex flex-wrap gap-2">
              {host.catchphrases?.map((phrase, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-base py-2 px-4 border-2"
                  style={{ borderColor: host.color_primary }}
                >
                  "{phrase}"
                </Badge>
              ))}
            </div>
          </div>

          {/* Best for */}
          <div>
            <h4 className="font-semibold mb-2 text-lg">Best Used For</h4>
            <div className="flex flex-wrap gap-2">
              {host.best_for?.map((use, i) => (
                <Badge
                  key={i}
                  style={{ backgroundColor: host.color_primary }}
                  className="text-white"
                >
                  {use}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// VOICE SELECTOR COMPONENT
// ============================================

interface VoiceOption {
  id: string
  name: string
  language?: string
  is_default?: boolean
}

function VoiceSelector({
  selectedVoiceId,
  onSelect,
  hostName,
}: {
  selectedVoiceId: string | null
  onSelect: (voiceId: string | null) => void
  hostName: string
}) {
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  useEffect(() => {
    fetchVoices()
  }, [])

  const fetchVoices = async () => {
    try {
      const res = await fetch('/api/voice?action=status')
      const data = await res.json()
      setVoiceAvailable(data.available)
      setVoices(data.voices || [])
    } catch {
      setVoiceAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async (voiceId: string) => {
    if (previewingId === voiceId) {
      setPreviewingId(null)
      return
    }

    setPreviewingId(voiceId)
    try {
      const previewText = `Hi, I'm ${hostName}. This is how I'll sound when narrating your content.`
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: previewText, voice: voiceId }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => {
          setPreviewingId(null)
          URL.revokeObjectURL(url)
        }
        audio.play()
      }
    } catch (err) {
      console.error('Preview failed:', err)
      setPreviewingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 border-2 border-foreground/20 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading voices...</span>
      </div>
    )
  }

  if (!voiceAvailable) {
    return (
      <div className="p-4 border-2 border-amber-500/50 bg-amber-500/10">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Voice Server Offline</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Start Chatterbox on Presidium AI to assign voices.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {/* No Voice Option */}
        <button
          type="button"
          className={`p-3 border-2 text-left transition-colors ${
            !selectedVoiceId
              ? 'border-primary bg-primary/10'
              : 'border-foreground/20 hover:border-foreground/40'
          }`}
          onClick={() => onSelect(null)}
        >
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">No Voice</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Voice not configured</p>
        </button>

        {/* Available Voices */}
        {voices.map((voice) => (
          <button
            key={voice.id}
            type="button"
            className={`p-3 border-2 text-left transition-colors ${
              selectedVoiceId === voice.id
                ? 'border-primary bg-primary/10'
                : 'border-foreground/20 hover:border-foreground/40'
            }`}
            onClick={() => onSelect(voice.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                <span className="font-medium">{voice.name}</span>
              </div>
              <button
                type="button"
                className="p-1 hover:bg-muted rounded"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePreview(voice.id)
                }}
              >
                {previewingId === voice.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {voice.language?.toUpperCase() || 'EN'}
              {voice.is_default && ' • Default'}
            </p>
          </button>
        ))}
      </div>

      <a
        href="/studio/voices"
        className="text-sm text-primary hover:underline flex items-center gap-1"
      >
        <Plus className="h-3 w-3" />
        Create new voice in Voice Library
      </a>
    </div>
  )
}

// ============================================
// HOST EDIT MODAL
// ============================================

function HostEditModal({
  host,
  open,
  onClose,
  onSave,
}: {
  host: Host | null
  open: boolean
  onClose: () => void
  onSave: (host: Host) => void
}) {
  const [editedHost, setEditedHost] = useState<Host | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'personality' | 'voice'>('basic')

  useEffect(() => {
    if (host) {
      setEditedHost({ ...host })
      setActiveTab('basic')
    }
  }, [host])

  if (!editedHost) return null

  const handleTraitChange = (index: number, field: string, value: any) => {
    const newTraits = [...(editedHost.host_personality_traits || [])]
    newTraits[index] = { ...newTraits[index], [field]: value }
    setEditedHost({ ...editedHost, host_personality_traits: newTraits })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/hosts/${editedHost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editedHost,
          personality_traits: editedHost.host_personality_traits,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        onSave(updated)
        onClose()
      }
    } catch (error) {
      console.error('Error saving host:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl flex items-center gap-2">
            <Edit className="h-6 w-6" />
            Edit Host: {editedHost.name}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b-2 border-foreground/20 pb-2 mt-2">
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'basic' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            onClick={() => setActiveTab('basic')}
          >
            Basic Info
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'personality' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            onClick={() => setActiveTab('personality')}
          >
            Personality
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'voice' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            onClick={() => setActiveTab('voice')}
          >
            <Volume2 className="h-4 w-4" />
            Voice
          </button>
        </div>

        <div className="space-y-6 mt-4">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input
                    value={editedHost.name}
                    onChange={(e) => setEditedHost({ ...editedHost, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Archetype</label>
                  <Input
                    value={editedHost.archetype}
                    onChange={(e) => setEditedHost({ ...editedHost, archetype: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Tagline</label>
                <Input
                  value={editedHost.tagline}
                  onChange={(e) => setEditedHost({ ...editedHost, tagline: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Short Bio</label>
                <Textarea
                  value={editedHost.short_bio}
                  onChange={(e) => setEditedHost({ ...editedHost, short_bio: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Full Bio</label>
                <Textarea
                  value={editedHost.full_bio}
                  onChange={(e) => setEditedHost({ ...editedHost, full_bio: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Best For (comma separated)</label>
                <Input
                  value={editedHost.best_for?.join(', ') || ''}
                  onChange={(e) => setEditedHost({
                    ...editedHost,
                    best_for: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="Breaking News, Hot Takes, Analysis"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Catchphrases (one per line)</label>
                <Textarea
                  value={editedHost.catchphrases?.join('\n') || ''}
                  onChange={(e) => setEditedHost({
                    ...editedHost,
                    catchphrases: e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                  })}
                  rows={3}
                  placeholder="Let's dive in!&#10;Here's the truth...&#10;You won't believe this"
                />
              </div>
            </>
          )}

          {/* Personality Tab */}
          {activeTab === 'personality' && (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Voice Style Description</label>
                <Textarea
                  value={editedHost.voice_style}
                  onChange={(e) => setEditedHost({ ...editedHost, voice_style: e.target.value })}
                  rows={2}
                  placeholder="How they speak - pace, tone, mannerisms"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Personality Traits</label>
                <p className="text-xs text-muted-foreground mb-3">
                  Adjust trait values to define how this host approaches content. Lower values create contrast.
                </p>
                <div className="space-y-3">
                  {editedHost.host_personality_traits?.map((trait, index) => {
                    const IconComponent = ICON_MAP[trait.trait_icon] || Brain
                    return (
                      <div key={index} className="p-3 border-2 border-foreground/20 bg-muted/30">
                        <div className="flex items-center gap-4">
                          <IconComponent
                            className="h-5 w-5 flex-shrink-0"
                            style={{ color: editedHost.color_primary }}
                          />
                          <div className="flex-1">
                            <span className="font-semibold">{trait.trait_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({trait.trait_category})</span>
                          </div>
                          <div className="flex items-center gap-2 w-56">
                            <span className="text-xs text-muted-foreground">Low</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={trait.trait_value}
                              onChange={(e) => handleTraitChange(index, 'trait_value', parseInt(e.target.value))}
                              className="flex-1"
                              style={{
                                accentColor: editedHost.color_primary,
                              }}
                            />
                            <span className="text-xs text-muted-foreground">High</span>
                            <span
                              className="font-head w-10 text-right"
                              style={{ color: editedHost.color_primary }}
                            >
                              {trait.trait_value}
                            </span>
                          </div>
                        </div>
                        <Input
                          className="mt-2"
                          placeholder="What this trait means for this host..."
                          value={trait.trait_description || ''}
                          onChange={(e) => handleTraitChange(index, 'trait_description', e.target.value)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Voice Tab */}
          {activeTab === 'voice' && (
            <>
              <div className="p-4 bg-muted border-2 border-foreground/20">
                <h4 className="font-semibold mb-2">About Host Voices</h4>
                <p className="text-sm text-muted-foreground">
                  Assign a voice to this host for text-to-speech narration. The voice will be used
                  when generating audio content for this host. Create custom voices by recording
                  or uploading samples in the Voice Library.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Assigned Voice</label>
                <VoiceSelector
                  selectedVoiceId={editedHost.voice_id}
                  onSelect={(voiceId) => setEditedHost({ ...editedHost, voice_id: voiceId })}
                  hostName={editedHost.name}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Voice Speed</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={1.0}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">1.0x</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Adjust playback speed</p>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
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
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// BUILD HOST MODAL
// ============================================

function BuildHostModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (host: Host) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/hosts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      const data = await res.json()

      if (res.ok && data.host) {
        onCreated(data.host)
        setPrompt('')
        onClose()
      } else {
        setError(data.error || 'Failed to generate host')
      }
    } catch (error) {
      setError('Failed to generate host. Check your LLM configuration.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" />
            Build a Host
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-muted-foreground">
            Describe your ideal host personality. The AI will generate a complete character
            with name, archetype, voice style, and personality traits.
          </p>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Describe your host
            </label>
            <Textarea
              placeholder="e.g., A sarcastic sports commentator who loves making dad jokes and has encyclopedic knowledge of obscure statistics. They're laid back but get excited during big plays."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>

          <div className="bg-muted p-4 border-2 border-foreground/20">
            <p className="text-sm font-medium mb-2">Tips for good results:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Describe their personality and energy level</li>
              <li>• Mention how they talk (fast, slow, sarcastic, warm)</li>
              <li>• Include what topics they excel at</li>
              <li>• Add quirks, catchphrases, or signature moves</li>
            </ul>
          </div>

          {error && (
            <div className="p-4 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Host
                </>
              )}
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

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedHost, setSelectedHost] = useState<Host | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [editingHost, setEditingHost] = useState<Host | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const [buildOpen, setBuildOpen] = useState(false)

  const [testVoiceHost, setTestVoiceHost] = useState<Host | null>(null)
  const [testVoiceOpen, setTestVoiceOpen] = useState(false)

  useEffect(() => {
    fetchHosts()
  }, [])

  const fetchHosts = async () => {
    try {
      const res = await fetch('/api/hosts')
      const data = await res.json()

      if (Array.isArray(data)) {
        setHosts(data)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to load hosts')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHost = (host: Host) => {
    setSelectedHost(host)
    setDetailOpen(true)
  }

  const handleEditHost = (host: Host) => {
    setEditingHost(host)
    setEditOpen(true)
  }

  const handleSaveHost = (updatedHost: Host) => {
    setHosts(hosts.map(h => h.id === updatedHost.id ? updatedHost : h))
  }

  const handleHostCreated = (newHost: Host) => {
    setHosts([...hosts, newHost])
  }

  const handleTestVoice = (host: Host) => {
    setTestVoiceHost(host)
    setTestVoiceOpen(true)
  }

  return (
    <AppShell topicName="Studio">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Mic className="h-8 w-8 text-primary" />
              THE HOSTS
            </h1>
            <p className="text-muted-foreground text-lg">
              AI narrators with distinct personalities - click to view, edit to customize, or build your own
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/studio/voices">
              <Button variant="outline" className="gap-2">
                <Volume2 className="h-4 w-4" />
                Voice Library
              </Button>
            </a>
            <Button className="gap-2" onClick={() => setBuildOpen(true)}>
              <Plus className="h-4 w-4" />
              Build a Host
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-8 flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <h3 className="font-semibold">Failed to load hosts</h3>
                <p className="text-muted-foreground">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Make sure Docker is running: <code className="bg-muted px-2 py-1">docker-compose up -d</code>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && hosts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No hosts yet</h3>
              <p className="text-muted-foreground mb-4">
                Start the database to load the default hosts, or build your own!
              </p>
              <Button onClick={() => setBuildOpen(true)} className="gap-2">
                <Wand2 className="h-4 w-4" />
                Build Your First Host
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Host Grid */}
        {!loading && !error && hosts.length > 0 && (
          <div className="space-y-6">
            {hosts.map((host) => (
              <HostProfileCard
                key={host.id}
                host={host}
                onSelect={() => handleSelectHost(host)}
                onEdit={() => handleEditHost(host)}
                onTestVoice={() => handleTestVoice(host)}
                isSelected={selectedHost?.id === host.id}
              />
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <HostDetailModal
          host={selectedHost}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />

        {/* Edit Modal */}
        <HostEditModal
          host={editingHost}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveHost}
        />

        {/* Build Host Modal */}
        <BuildHostModal
          open={buildOpen}
          onClose={() => setBuildOpen(false)}
          onCreated={handleHostCreated}
        />

        {/* Test Voice Dialog */}
        {testVoiceHost && (
          <TestVoiceDialog
            hostId={testVoiceHost.id}
            hostName={testVoiceHost.name}
            hostColor={testVoiceHost.color_primary}
            open={testVoiceOpen}
            onClose={() => setTestVoiceOpen(false)}
          />
        )}
      </div>
    </AppShell>
  )
}
