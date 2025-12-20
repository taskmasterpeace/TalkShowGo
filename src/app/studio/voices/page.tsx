'use client'

import { useState, useEffect, useRef } from 'react'
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
  Input,
  Textarea,
} from '@/components/ui'
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Upload,
  Trash2,
  Volume2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  Clock,
  FileAudio,
  Plus,
  RefreshCw,
  Settings,
  User,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface Voice {
  id: string
  name: string
  language?: string
  description?: string
  is_default?: boolean
  created_at?: string
  host_name?: string // If assigned to a host
}

interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
  audioUrl: string | null
}

// ============================================
// RECORDING INSTRUCTIONS
// ============================================

const RECORDING_TIPS = [
  {
    title: 'Length',
    description: '10-30 seconds of clear speech works best. Too short and the voice may sound robotic.',
    icon: Clock,
  },
  {
    title: 'Environment',
    description: 'Record in a quiet room. Avoid echo, background noise, and fans or AC.',
    icon: Volume2,
  },
  {
    title: 'Speaking Style',
    description: 'Speak naturally and consistently. Read a paragraph as if presenting to someone.',
    icon: Mic,
  },
  {
    title: 'What to Say',
    description: 'Read any text with variety - include questions, statements, and emphasis.',
    icon: Info,
  },
]

const SAMPLE_SCRIPTS = [
  "Welcome to the show, everyone! Today we're diving deep into something that's been on all our minds. I've got some hot takes that might surprise you, so buckle up and let's get into it.",
  "The evidence suggests a pattern we can't ignore. When you look at the data from multiple sources, it paints a very different picture than what we've been told. Let me break this down for you.",
  "This is absolutely wild, folks! Did you see what happened? I mean, come on - who could have predicted this? My sources are telling me there's even more to this story.",
]

// ============================================
// VOICE CARD COMPONENT
// ============================================

function VoiceCard({
  voice,
  onPlay,
  onDelete,
  onAssign,
  isPlaying,
}: {
  voice: Voice
  onPlay: () => void
  onDelete: () => void
  onAssign: () => void
  isPlaying: boolean
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 border-2 border-foreground bg-muted flex items-center justify-center">
              <Volume2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">{voice.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {voice.language && <span>{voice.language.toUpperCase()}</span>}
                {voice.is_default && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
                {voice.host_name && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <User className="h-3 w-3" />
                    {voice.host_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="p-2 border-2 border-foreground hover:bg-muted transition-colors"
              onClick={onPlay}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              className="p-2 border-2 border-foreground hover:bg-muted transition-colors"
              onClick={onAssign}
            >
              <User className="h-4 w-4" />
            </button>
            {!voice.is_default && (
              <button
                className="p-2 border-2 border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {voice.description && (
          <p className="text-sm text-muted-foreground mt-2">{voice.description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// VOICE RECORDER COMPONENT
// ============================================

function VoiceRecorder({
  onRecordingComplete,
}: {
  onRecordingComplete: (blob: Blob) => void
}) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
  })
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [selectedScript, setSelectedScript] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setState(prev => ({
          ...prev,
          isRecording: false,
          audioBlob: blob,
          audioUrl: url,
        }))
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start(100)

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        audioUrl: null,
      }))

      // Start timer
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }))
      }, 1000)

    } catch (err) {
      console.error('Failed to start recording:', err)
      setPermissionDenied(true)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop()
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const playRecording = () => {
    if (state.audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      audioRef.current = new Audio(state.audioUrl)
      audioRef.current.play()
    }
  }

  const clearRecording = () => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl)
    }
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
    })
  }

  const submitRecording = () => {
    if (state.audioBlob) {
      onRecordingComplete(state.audioBlob)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (permissionDenied) {
    return (
      <div className="p-6 border-2 border-destructive bg-destructive/10 text-center">
        <MicOff className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h3 className="font-semibold mb-2">Microphone Access Denied</h3>
        <p className="text-sm text-muted-foreground">
          Please enable microphone access in your browser settings to record voice samples.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sample Script */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Sample Script to Read</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedScript((prev) => (prev + 1) % SAMPLE_SCRIPTS.length)}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Different Script
          </Button>
        </div>
        <div className="p-4 bg-muted border-2 border-foreground/20 text-lg leading-relaxed">
          "{SAMPLE_SCRIPTS[selectedScript]}"
        </div>
      </div>

      {/* Recording Controls */}
      <div className="flex flex-col items-center gap-4 py-6">
        {/* Timer */}
        <div className="text-4xl font-mono font-bold">
          {formatDuration(state.duration)}
        </div>

        {/* Duration indicator */}
        <div className="flex items-center gap-2 text-sm">
          {state.duration < 10 && state.isRecording && (
            <span className="text-amber-500">Keep going! Need at least 10 seconds.</span>
          )}
          {state.duration >= 10 && state.duration < 30 && (
            <span className="text-green-500">Good length! You can stop or continue.</span>
          )}
          {state.duration >= 30 && (
            <span className="text-blue-500">Perfect! That's plenty of audio.</span>
          )}
        </div>

        {/* Waveform placeholder */}
        {state.isRecording && (
          <div className="flex items-center gap-1 h-16">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-primary animate-pulse"
                style={{
                  height: `${Math.random() * 60 + 10}px`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex items-center gap-4">
          {!state.isRecording && !state.audioBlob && (
            <Button
              size="lg"
              className="gap-2 px-8"
              onClick={startRecording}
            >
              <Mic className="h-5 w-5" />
              Start Recording
            </Button>
          )}

          {state.isRecording && (
            <Button
              size="lg"
              variant="destructive"
              className="gap-2 px-8"
              onClick={stopRecording}
            >
              <Square className="h-5 w-5" />
              Stop Recording
            </Button>
          )}

          {state.audioBlob && (
            <>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={playRecording}
              >
                <Play className="h-5 w-5" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={clearRecording}
              >
                <Trash2 className="h-5 w-5" />
                Discard
              </Button>
              <Button
                size="lg"
                className="gap-2"
                onClick={submitRecording}
                disabled={state.duration < 5}
              >
                <CheckCircle className="h-5 w-5" />
                Use This Recording
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// CREATE VOICE MODAL
// ============================================

function CreateVoiceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (voice: Voice) => void
}) {
  const [mode, setMode] = useState<'choose' | 'record' | 'upload'>('choose')
  const [voiceName, setVoiceName] = useState('')
  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState('en')
  const [audioFile, setAudioFile] = useState<File | Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.includes('audio/') && !file.name.match(/\.(wav|mp3|ogg|webm|m4a)$/i)) {
        setError('Please select an audio file (WAV, MP3, OGG, WebM, or M4A)')
        return
      }
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('File too large. Maximum size is 50MB.')
        return
      }
      setAudioFile(file)
      setError(null)
    }
  }

  const handleRecordingComplete = (blob: Blob) => {
    setAudioFile(blob)
    setMode('upload') // Move to naming step
  }

  const handleSubmit = async () => {
    if (!audioFile || !voiceName.trim()) {
      setError('Please provide a voice name and audio sample')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', audioFile, audioFile instanceof File ? audioFile.name : 'recording.webm')
      formData.append('voice_name', voiceName.trim())
      formData.append('language', language)
      if (description.trim()) {
        formData.append('description', description.trim())
      }

      const response = await fetch('/api/voice', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create voice')
      }

      const voice = await response.json()
      onCreated(voice)
      onClose()

      // Reset state
      setMode('choose')
      setVoiceName('')
      setDescription('')
      setAudioFile(null)
    } catch (err: any) {
      setError(err.message || 'Failed to create voice')
    } finally {
      setUploading(false)
    }
  }

  const resetAndClose = () => {
    setMode('choose')
    setVoiceName('')
    setDescription('')
    setAudioFile(null)
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl flex items-center gap-2">
            <Mic className="h-6 w-6 text-primary" />
            {mode === 'choose' && 'Create New Voice'}
            {mode === 'record' && 'Record Voice Sample'}
            {mode === 'upload' && 'Voice Details'}
          </DialogTitle>
        </DialogHeader>

        {/* Mode Selection */}
        {mode === 'choose' && (
          <div className="space-y-6 mt-4">
            <p className="text-muted-foreground">
              Create a custom voice by recording a sample or uploading an audio file.
              The voice can then be assigned to any host.
            </p>

            {/* Recording Tips */}
            <div className="grid grid-cols-2 gap-4">
              {RECORDING_TIPS.map((tip, i) => (
                <div key={i} className="p-4 border-2 border-foreground/20 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <tip.icon className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{tip.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                </div>
              ))}
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
              <button
                className="p-6 border-4 border-foreground hover:bg-muted transition-colors text-left"
                onClick={() => setMode('record')}
              >
                <Mic className="h-10 w-10 mb-3 text-primary" />
                <h3 className="font-semibold text-lg mb-1">Record Live</h3>
                <p className="text-sm text-muted-foreground">
                  Use your microphone to record a voice sample directly in the browser.
                </p>
              </button>

              <button
                className="p-6 border-4 border-foreground hover:bg-muted transition-colors text-left"
                onClick={() => {
                  setMode('upload')
                  fileInputRef.current?.click()
                }}
              >
                <Upload className="h-10 w-10 mb-3 text-primary" />
                <h3 className="font-semibold text-lg mb-1">Upload File</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a WAV, MP3, or other audio file (10-30 seconds of clear speech).
                </p>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Recording Mode */}
        {mode === 'record' && (
          <div className="mt-4">
            <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
            <div className="flex justify-start mt-4">
              <Button variant="outline" onClick={() => setMode('choose')}>
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Upload/Details Mode */}
        {mode === 'upload' && (
          <div className="space-y-6 mt-4">
            {/* File Selection */}
            {!audioFile && (
              <div
                className="p-8 border-4 border-dashed border-foreground/30 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileAudio className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="font-semibold mb-1">Click to select audio file</p>
                <p className="text-sm text-muted-foreground">WAV, MP3, OGG, WebM, M4A (max 50MB)</p>
              </div>
            )}

            {/* File Selected */}
            {audioFile && (
              <div className="p-4 border-2 border-foreground bg-muted flex items-center gap-4">
                <FileAudio className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">
                    {audioFile instanceof File ? audioFile.name : 'Recorded Audio'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAudioFile(null)}
                >
                  Change
                </Button>
              </div>
            )}

            {/* Voice Details */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Voice Name *</label>
                <Input
                  placeholder="e.g., Marcus Deep, Sarah Energetic"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Language</label>
                <select
                  className="w-full p-2 border-2 border-foreground bg-background"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                <Textarea
                  placeholder="Describe the voice characteristics..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                <span className="text-destructive">{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setMode('choose')}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={uploading || !audioFile || !voiceName.trim()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Voice...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create Voice
                  </>
                )}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function VoicesPage() {
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voiceServerAvailable, setVoiceServerAvailable] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)

  useEffect(() => {
    fetchVoices()
  }, [])

  const fetchVoices = async () => {
    try {
      const res = await fetch('/api/voice?action=status')
      const data = await res.json()

      setVoiceServerAvailable(data.available)
      setVoices(data.voices || [])
    } catch (err) {
      setError('Failed to connect to voice server')
      setVoiceServerAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  const handlePlayVoice = async (voice: Voice) => {
    if (playingVoiceId === voice.id) {
      setPlayingVoiceId(null)
      return
    }

    setPlayingVoiceId(voice.id)

    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "Hello! This is a preview of my voice. I'm ready to narrate your stories.",
          voice: voice.id,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => {
          setPlayingVoiceId(null)
          URL.revokeObjectURL(url)
        }
        audio.play()
      }
    } catch (err) {
      console.error('Failed to play voice:', err)
      setPlayingVoiceId(null)
    }
  }

  const handleDeleteVoice = async (voice: Voice) => {
    if (!confirm(`Delete voice "${voice.name}"? This cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/voice?id=${voice.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setVoices(voices.filter(v => v.id !== voice.id))
      }
    } catch (err) {
      console.error('Failed to delete voice:', err)
    }
  }

  const handleAssignVoice = (voice: Voice) => {
    // TODO: Open host selection modal
    alert(`Voice assignment coming soon! Select a host to assign "${voice.name}" to.`)
  }

  const handleVoiceCreated = (voice: Voice) => {
    setVoices([...voices, voice])
  }

  return (
    <AppShell topicName="Studio">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Volume2 className="h-8 w-8 text-primary" />
              VOICE LIBRARY
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage voice samples for your hosts - record live or upload audio files
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Voice Server Status */}
            <div className={`flex items-center gap-2 px-3 py-2 border-2 ${
              voiceServerAvailable ? 'border-green-500 bg-green-500/10' : 'border-destructive bg-destructive/10'
            }`}>
              {voiceServerAvailable ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Chatterbox Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">Chatterbox Offline</span>
                </>
              )}
            </div>
            <Button
              className="gap-2"
              onClick={() => setCreateOpen(true)}
              disabled={!voiceServerAvailable}
            >
              <Plus className="h-4 w-4" />
              New Voice
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

        {/* Voice Server Offline */}
        {!loading && !voiceServerAvailable && (
          <Card className="border-amber-500">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-8 w-8 text-amber-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">Voice Server Not Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Chatterbox voice server is not responding. Make sure it's running on Presidium AI.
                  </p>
                  <div className="bg-muted p-4 border-2 border-foreground/20 font-mono text-sm">
                    <p>Expected at: {process.env.NEXT_PUBLIC_CHATTERBOX_URL || 'http://localhost:4123'}</p>
                    <p className="mt-2">To start Chatterbox on Presidium:</p>
                    <code className="block mt-1 text-primary">docker start chatterbox</code>
                  </div>
                  <Button className="mt-4 gap-2" onClick={fetchVoices}>
                    <RefreshCw className="h-4 w-4" />
                    Retry Connection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Voice Grid */}
        {!loading && voiceServerAvailable && (
          <>
            {voices.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Volume2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No voices yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first custom voice by recording or uploading an audio sample.
                  </p>
                  <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Voice
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {voices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    onPlay={() => handlePlayVoice(voice)}
                    onDelete={() => handleDeleteVoice(voice)}
                    onAssign={() => handleAssignVoice(voice)}
                    isPlaying={playingVoiceId === voice.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Tips Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Tips for Great Voice Samples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {RECORDING_TIPS.map((tip, i) => (
                <div key={i} className="text-center">
                  <tip.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h4 className="font-semibold text-sm mb-1">{tip.title}</h4>
                  <p className="text-xs text-muted-foreground">{tip.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-muted border-2 border-foreground/20">
              <p className="text-sm">
                <strong>Supported formats:</strong> WAV, MP3, OGG, WebM, M4A (max 50MB)
              </p>
              <p className="text-sm mt-1">
                <strong>Recommended length:</strong> 10-30 seconds of clear, natural speech
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Create Voice Modal */}
        <CreateVoiceModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={handleVoiceCreated}
        />
      </div>
    </AppShell>
  )
}
