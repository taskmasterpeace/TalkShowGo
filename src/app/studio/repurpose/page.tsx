'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { useTopic } from '@/context/topic-context'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui'
import {
  RefreshCw,
  Youtube,
  Search,
  Sparkles,
  Play,
  Download,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  FileText,
  Volume2,
  Clock,
  Eye,
  Loader2,
  Folder,
  FileJson,
  Copy,
  Music
} from 'lucide-react'

// Wizard steps
const STEPS = [
  { id: 'input', label: 'Video URL', icon: Youtube },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'options', label: 'Options', icon: Sparkles },
  { id: 'generate', label: 'Generate', icon: RefreshCw },
  { id: 'result', label: 'Result', icon: Check }
]

interface VideoInfo {
  video_id: string
  title: string
  channel: string
  duration?: number
  views?: number
  published_at?: string
  thumbnail_url?: string
  has_transcript: boolean
  transcript_preview?: string
  can_repurpose: boolean
}

interface RepurposeResult {
  success: boolean
  run_id: string
  story_id?: string
  original: {
    video_id: string
    title: string
    transcript_length: number
  }
  extracted: {
    topic: string
    entities: string[]
    summary: string
  }
  supplemental_research: {
    youtube_videos_found: number
    youtube_transcripts_acquired: number
    interviews_found: number
    web_results_found: number
    total_supplemental_sources: number
  }
  script: {
    content: string
    word_count: number
    estimated_duration_seconds: number
    chapters?: string[]
  }
  audio?: {
    url: string
    path: string
  }
  files: {
    script: {
      filename: string
      url: string
      word_count: number
      size_bytes: number
    }
    research: {
      filename: string
      url: string
      source_count: number
    }
    audio: {
      filename: string
      url: string
      duration_seconds: number
    } | null
  }
}

export default function RepurposePage() {
  const { selectedTopic } = useTopic()
  const [currentStep, setCurrentStep] = useState(0)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Options
  const [style, setStyle] = useState<'documentary' | 'news' | 'analysis' | 'narrative'>('documentary')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [hostName, setHostName] = useState('Algorithm Institute')

  // Result
  const [result, setResult] = useState<RepurposeResult | null>(null)
  const [progress, setProgress] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  // Copy script to clipboard
  const copyScript = async () => {
    if (!result?.script.content) return
    try {
      await navigator.clipboard.writeText(result.script.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Fetch video info
  const handleFetchVideo = async () => {
    if (!videoUrl.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/repurpose?video_url=${encodeURIComponent(videoUrl)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video')
      }

      setVideoInfo(data)
      setCurrentStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video')
    } finally {
      setLoading(false)
    }
  }

  // Run repurposing
  const handleRepurpose = async () => {
    if (!videoInfo) return

    setLoading(true)
    setError(null)
    setProgress(['Starting repurposing...'])
    setCurrentStep(3)

    try {
      setProgress(p => [...p, 'Fetching original transcript...'])

      const response = await fetch('/api/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl,
          topic_id: selectedTopic?.id,
          style,
          length,
          generate_audio: generateAudio,
          host_name: hostName
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Repurposing failed')
      }

      setResult(data)
      setProgress(p => [...p, 'Complete!'])
      setCurrentStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repurposing failed')
      setProgress(p => [...p, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`])
    } finally {
      setLoading(false)
    }
  }

  // Format duration
  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Format views
  const formatViews = (views?: number) => {
    if (!views) return 'Unknown'
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
    return views.toString()
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500 border-2 border-black">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-head">CONTENT REPURPOSING</h1>
              <p className="text-zinc-400">
                Transform any YouTube video into your own improved version
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            const isActive = idx === currentStep
            const isComplete = idx < currentStep

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                    isActive
                      ? 'bg-yellow-400 border-black text-black'
                      : isComplete
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:block">{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-zinc-600 mx-2" />
                )}
              </div>
            )
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-white">
              &times;
            </button>
          </div>
        )}

        {/* Step Content */}
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardContent className="p-6">
            {/* Step 0: Input URL */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">YouTube Video URL</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                      <Input
                        placeholder="https://youtube.com/watch?v=..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="pl-10"
                        onKeyDown={(e) => e.key === 'Enter' && handleFetchVideo()}
                      />
                    </div>
                    <Button onClick={handleFetchVideo} disabled={loading || !videoUrl.trim()}>
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span className="ml-2">Fetch</span>
                    </Button>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <h4 className="font-semibold mb-2">How it works:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-400">
                    <li>Paste a YouTube video URL</li>
                    <li>We extract the transcript and main topic</li>
                    <li>Research finds more sources on the same topic</li>
                    <li>AI generates an improved, comprehensive script</li>
                    <li>Dia creates natural multi-voice audio</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Step 1: Preview Video */}
            {currentStep === 1 && videoInfo && (
              <div className="space-y-6">
                <div className="flex gap-6">
                  {/* Thumbnail */}
                  {videoInfo.thumbnail_url && (
                    <img
                      src={videoInfo.thumbnail_url}
                      alt={videoInfo.title}
                      className="w-64 h-36 object-cover rounded-lg border-2 border-black"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">{videoInfo.title}</h3>
                    <p className="text-zinc-400 mb-3">{videoInfo.channel}</p>

                    <div className="flex flex-wrap gap-3 text-sm">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(videoInfo.duration)}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatViews(videoInfo.views)} views
                      </Badge>
                      <Badge
                        variant="outline"
                        className={videoInfo.has_transcript ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        {videoInfo.has_transcript ? 'Has Transcript' : 'No Transcript'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Transcript Preview */}
                {videoInfo.transcript_preview && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Transcript Preview:</h4>
                    <div className="bg-zinc-900 rounded-lg p-3 text-sm text-zinc-400 max-h-32 overflow-y-auto border border-zinc-800">
                      {videoInfo.transcript_preview}...
                    </div>
                  </div>
                )}

                {/* Can't repurpose warning */}
                {!videoInfo.can_repurpose && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500 rounded-lg">
                    <p className="text-orange-400">
                      This video doesn't have a transcript. We need captions or a transcript to repurpose content.
                    </p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(0)}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={() => setCurrentStep(2)} disabled={!videoInfo.can_repurpose}>
                    Continue
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Options */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-3">Content Style</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'documentary', label: 'Documentary', desc: 'In-depth storytelling' },
                      { value: 'news', label: 'News', desc: 'Concise reporting' },
                      { value: 'analysis', label: 'Analysis', desc: 'Deep dive breakdown' },
                      { value: 'narrative', label: 'Narrative', desc: 'Story-driven' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setStyle(option.value as typeof style)}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          style === option.value
                            ? 'bg-yellow-400 border-black text-black'
                            : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className={`text-sm ${style === option.value ? 'text-black/70' : 'text-zinc-500'}`}>
                          {option.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-3">Content Length</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'short', label: 'Short', desc: '~5 min' },
                      { value: 'medium', label: 'Medium', desc: '~10 min' },
                      { value: 'long', label: 'Long', desc: '~17 min' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setLength(option.value as typeof length)}
                        className={`p-4 rounded-lg border-2 text-center transition-colors ${
                          length === option.value
                            ? 'bg-yellow-400 border-black text-black'
                            : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className={`text-sm ${length === option.value ? 'text-black/70' : 'text-zinc-500'}`}>
                          {option.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generateAudio}
                      onChange={(e) => setGenerateAudio(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-zinc-600"
                    />
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        Generate Audio
                      </div>
                      <div className="text-sm text-zinc-500">Create multi-voice narration with Dia</div>
                    </div>
                  </label>
                </div>

                {/* Navigation */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleRepurpose}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start Repurposing
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Generating */}
            {currentStep === 3 && (
              <div className="space-y-6 text-center py-8">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-yellow-400" />
                <div>
                  <h3 className="text-xl font-bold mb-2">Repurposing Content...</h3>
                  <p className="text-zinc-400">This may take a few minutes</p>
                </div>

                <div className="bg-zinc-900 rounded-lg p-4 text-left max-h-48 overflow-y-auto border border-zinc-800">
                  {progress.map((msg, i) => (
                    <div key={i} className="text-sm text-zinc-400 py-1 flex items-center gap-2">
                      <span className="text-green-400">✓</span>
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Result */}
            {currentStep === 4 && result && (
              <div className="space-y-6">
                {/* Success Banner */}
                <div className="bg-green-500/10 border border-green-500 rounded-lg p-4 flex items-center gap-3">
                  <Check className="w-6 h-6 text-green-400" />
                  <div>
                    <div className="font-bold text-green-400">Repurposing Complete!</div>
                    <div className="text-sm text-zinc-400">
                      Generated {result.script.word_count} words from {result.supplemental_research.total_supplemental_sources} sources
                    </div>
                  </div>
                </div>

                {/* Generated Files Section */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-yellow-400" />
                    Generated Files
                  </h3>

                  <div className="space-y-3">
                    {/* Script File */}
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-zinc-100 font-medium">{result.files.script.filename}</p>
                          <p className="text-sm text-zinc-500">
                            {result.files.script.word_count.toLocaleString()} words • ~{Math.ceil(result.files.script.word_count / 150)} min read
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={copyScript}>
                          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" asChild>
                          <a href={result.files.script.url} download>
                            <Download className="w-4 h-4 mr-1" /> TXT
                          </a>
                        </Button>
                      </div>
                    </div>

                    {/* Audio File (if exists) */}
                    {result.files.audio && (
                      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Music className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="text-zinc-100 font-medium">{result.files.audio.filename}</p>
                            <p className="text-sm text-zinc-500">
                              {formatDuration(result.files.audio.duration_seconds)}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" asChild>
                          <a href={result.files.audio.url} download>
                            <Download className="w-4 h-4 mr-1" /> MP3
                          </a>
                        </Button>
                      </div>
                    )}

                    {/* Research File */}
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileJson className="w-5 h-5 text-purple-400" />
                        <div>
                          <p className="text-zinc-100 font-medium">{result.files.research.filename}</p>
                          <p className="text-sm text-zinc-500">
                            {result.files.research.source_count} sources researched
                          </p>
                        </div>
                      </div>
                      <Button size="sm" asChild>
                        <a href={result.files.research.url} download>
                          <Download className="w-4 h-4 mr-1" /> JSON
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 text-center">
                    <div className="text-2xl font-bold text-yellow-400">{result.supplemental_research.youtube_videos_found}</div>
                    <div className="text-xs text-zinc-500">Videos Found</div>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 text-center">
                    <div className="text-2xl font-bold text-blue-400">{result.supplemental_research.web_results_found}</div>
                    <div className="text-xs text-zinc-500">Web Sources</div>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 text-center">
                    <div className="text-2xl font-bold text-green-400">{result.script.word_count}</div>
                    <div className="text-xs text-zinc-500">Words</div>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {Math.ceil(result.script.estimated_duration_seconds / 60)}
                    </div>
                    <div className="text-xs text-zinc-500">Minutes</div>
                  </div>
                </div>

                {/* Extracted Topic */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Extracted Topic:</h4>
                  <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                    <div className="font-medium">{result.extracted.topic}</div>
                    <div className="text-sm text-zinc-400 mt-1">{result.extracted.summary}</div>
                    {result.extracted.entities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {result.extracted.entities.map((e, i) => (
                          <Badge key={i} variant="secondary">{e}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Generated Script */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Generated Script:</h4>
                  <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-sans">
                      {result.script.content}
                    </pre>
                  </div>
                </div>

                {/* Audio Player */}
                {result.audio && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Generated Audio:</h4>
                    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                      <audio controls className="w-full" src={result.audio.url}>
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => {
                    setCurrentStep(0)
                    setVideoUrl('')
                    setVideoInfo(null)
                    setResult(null)
                    setProgress([])
                    setCopied(false)
                  }}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Repurpose Another
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Topic Context */}
        {selectedTopic && (
          <div className="mt-4 text-sm text-zinc-500 text-center">
            Using niche context: <span className="text-yellow-400">{selectedTopic.name}</span>
          </div>
        )}
      </div>
    </AppShell>
  )
}
