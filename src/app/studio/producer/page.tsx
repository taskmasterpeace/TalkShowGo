'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Loader2,
  Search,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  Plus,
  Calendar as CalendarIcon,
  FileText,
  Twitter,
  Youtube,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
} from 'lucide-react'
import { format } from 'date-fns'
import { SHOW_TYPES, getEnabledShowTypes, type ShowType } from '@/lib/show-types'

interface ProposedStory {
  id: string
  headline: string
  summary: string
  reason: string  // Why this story was proposed
  sources: {
    type: 'youtube' | 'twitter' | 'web'
    title: string
    url: string
    engagement?: number
  }[]
  selected: boolean
  confidence: 'high' | 'medium' | 'low'
}

interface ScanResult {
  twitterAccounts: number
  youtubeChannels: number
  videosFound: number
  videosAnalyzed: number
  tweetsFound: number
  scanDuration: number
  timestamp: string
}

export default function ProducerPage() {
  const router = useRouter()

  // State
  const [showType, setShowType] = useState<string>('daily')
  const [targetDate, setTargetDate] = useState<Date>(new Date())
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [stories, setStories] = useState<ProposedStory[]>([])
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [researchPrompt, setResearchPrompt] = useState<string>('')

  const enabledShowTypes = getEnabledShowTypes()
  const selectedShowType = SHOW_TYPES[showType]

  // Simulate scanning sources
  const handleScan = async () => {
    setIsScanning(true)
    setScanResult(null)
    setStories([])

    // In reality, this would call the API
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Simulated results
    setScanResult({
      twitterAccounts: 16,
      youtubeChannels: 6,
      videosFound: 127,
      videosAnalyzed: 10,
      tweetsFound: 45,
      scanDuration: 12.5,
      timestamp: new Date().toISOString(),
    })

    // Simulated story proposals
    setStories([
      {
        id: '1',
        headline: 'Swamp Announces Retirement (January 2026)',
        summary: 'Battle rap veteran Swamp has announced his retirement, setting January 2026 as his final battles.',
        reason: 'Mentioned by 4 sources, high engagement on Twitter, trending topic',
        sources: [
          { type: 'twitter', title: '@SwampBR Tweet', url: '#', engagement: 1200 },
          { type: 'youtube', title: 'Jayblac Reacts to Swamp Retirement', url: '#', engagement: 15000 },
        ],
        selected: true,
        confidence: 'high',
      },
      {
        id: '2',
        headline: 'Nu Jerzey Twork Chain Incident Goes Viral',
        summary: 'Twork\'s explosive reaction after opponent touched his chain during a battle has gone viral.',
        reason: 'Viral video, 50k+ views in 24 hours, 3 sources covering',
        sources: [
          { type: 'youtube', title: 'Battle Rap Fight Compilation', url: '#', engagement: 50000 },
          { type: 'twitter', title: 'Multiple tweets with video', url: '#', engagement: 2500 },
        ],
        selected: true,
        confidence: 'high',
      },
      {
        id: '3',
        headline: 'Joe Budden Says Battle Rappers Aren\'t Paid Enough',
        summary: 'Joe Budden sparked controversy on his podcast discussing battle rap earnings.',
        reason: 'Podcast clip trending, controversial take sparking debate',
        sources: [
          { type: 'youtube', title: 'Joe Budden Podcast Clip', url: '#', engagement: 25000 },
        ],
        selected: false,
        confidence: 'medium',
      },
      {
        id: '4',
        headline: 'URL Announces New York Volume 15',
        summary: 'URL has officially announced their next major event in New York.',
        reason: 'Official announcement, lower engagement than other stories',
        sources: [
          { type: 'twitter', title: '@urltv Official', url: '#', engagement: 800 },
        ],
        selected: false,
        confidence: 'low',
      },
    ])

    // Simulated research prompt
    setResearchPrompt(`You are a news producer for Battle Rap Daily.

Analyze these sources from the last 48 hours and find the top 3-5 trending stories:

SOURCES:
- Twitter: @urltv, @jayblac1615, @AveBattles, @15MOFE, @RapGrid, @KOTD...
- YouTube: URLTV (3 new videos), King Of The Dot (2 new), Jayblac1615 (5 new)

KNOWN ENTITIES: Cassidy, Loaded Lux, URL, KOTD, Swamp, Nu Jerzey Twork, Joe Budden...

Return stories with:
- headline
- why_trending (source count, engagement metrics)
- key_sources
- confidence_level`)

    setIsScanning(false)
  }

  const toggleStorySelection = (id: string) => {
    setStories(stories.map(s =>
      s.id === id ? { ...s, selected: !s.selected } : s
    ))
  }

  const removeStory = (id: string) => {
    setStories(stories.filter(s => s.id !== id))
  }

  const selectedCount = stories.filter(s => s.selected).length

  const handleContinue = () => {
    const selectedStories = stories.filter(s => s.selected)
    // Store in session storage or state management
    sessionStorage.setItem('producerStories', JSON.stringify(selectedStories))
    sessionStorage.setItem('showType', showType)
    sessionStorage.setItem('targetDate', targetDate.toISOString())
    router.push('/studio/daily-show?step=2')  // Go to host selection
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PRODUCER DASHBOARD</h1>
          <p className="text-muted-foreground">
            Research sources, find stories, decide what to cover
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-1">
          Producer Role
        </Badge>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Show Configuration</CardTitle>
          <CardDescription>Select show type and target date for research</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Show Type</label>
              <Select value={showType} onValueChange={setShowType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledShowTypes.map(st => (
                    <SelectItem key={st.id} value={st.id}>
                      <div className="flex items-center gap-2">
                        <span>{st.icon}</span>
                        <span>{st.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({st.storyCount.min}-{st.storyCount.max} stories)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Target Date</label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={format(targetDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const d = new Date(e.target.value + 'T00:00:00')
                    if (!isNaN(d.getTime())) setTargetDate(d)
                  }}
                  className="w-[200px]"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button onClick={handleScan} disabled={isScanning}>
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Scan Sources
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scanResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Source Scan Complete
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleScan}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Rescan
                </Button>
                <Dialog open={showPromptModal} onOpenChange={setShowPromptModal}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-1" />
                      See Research Prompt
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Research Prompt Used</DialogTitle>
                      <DialogDescription>
                        This is the exact prompt sent to the AI to find stories
                      </DialogDescription>
                    </DialogHeader>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                      {researchPrompt}
                    </pre>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => navigator.clipboard.writeText(researchPrompt)}>
                        Copy Prompt
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Twitter className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-sm font-medium">{scanResult.twitterAccounts} accounts</p>
                  <p className="text-xs text-muted-foreground">{scanResult.tweetsFound} tweets</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Youtube className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium">{scanResult.youtubeChannels} channels</p>
                  <p className="text-xs text-muted-foreground">{scanResult.videosFound} videos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Search className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">{scanResult.videosAnalyzed} analyzed</p>
                  <p className="text-xs text-muted-foreground">Transcripts fetched</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">{stories.length} stories</p>
                  <p className="text-xs text-muted-foreground">Proposed</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Info className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">{scanResult.scanDuration}s</p>
                  <p className="text-xs text-muted-foreground">Scan time</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proposed Stories */}
      {stories.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Proposed Stories</CardTitle>
                <CardDescription>
                  Select {selectedShowType?.storyCount.min}-{selectedShowType?.storyCount.max} stories for your show
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={selectedCount >= (selectedShowType?.storyCount.min || 3) ? 'default' : 'secondary'}>
                  {selectedCount} selected
                </Badge>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Custom Story
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stories.map((story, index) => (
              <div
                key={story.id}
                className={`border rounded-lg p-4 transition-all ${
                  story.selected ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={story.selected}
                    onCheckedChange={() => toggleStorySelection(story.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {story.headline}
                          <Badge
                            variant={
                              story.confidence === 'high'
                                ? 'default'
                                : story.confidence === 'medium'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {story.confidence} confidence
                          </Badge>
                        </h3>
                        <p className="text-muted-foreground mt-1">{story.summary}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStory(story.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Why proposed */}
                    <div className="mt-3 p-2 bg-muted rounded text-sm">
                      <span className="font-medium">Why: </span>
                      <span className="text-muted-foreground">{story.reason}</span>
                    </div>

                    {/* Sources */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {story.sources.map((source, i) => (
                        <Badge key={i} variant="outline" className="flex items-center gap-1">
                          {source.type === 'youtube' && <Youtube className="h-3 w-3" />}
                          {source.type === 'twitter' && <Twitter className="h-3 w-3" />}
                          {source.title}
                          {source.engagement && (
                            <span className="text-muted-foreground">
                              ({source.engagement.toLocaleString()})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      {stories.length > 0 && (
        <div className="flex justify-between items-center pt-4">
          <p className="text-sm text-muted-foreground">
            {selectedCount < (selectedShowType?.storyCount.min || 3) && (
              <span className="text-orange-500">
                Select at least {selectedShowType?.storyCount.min} stories to continue
              </span>
            )}
          </p>
          <Button
            size="lg"
            disabled={selectedCount < (selectedShowType?.storyCount.min || 3)}
            onClick={handleContinue}
          >
            Continue to Host Selection
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!scanResult && !isScanning && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Click "Scan Sources" to research trending stories</p>
        </div>
      )}
    </div>
  )
}
