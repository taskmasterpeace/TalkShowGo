'use client'

import { useState, useEffect, useRef } from 'react'
import { AppShell } from '@/components/layout'
import { useTopic, Topic } from '@/context/topic-context'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ProgressBar,
} from '@/components/ui'
import {
  Users,
  BarChart3,
  Upload,
  Download,
  Filter,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Twitter,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  MessageCircle,
  Heart,
  Repeat,
  Shield,
  Star,
  ArrowUpDown,
  Grid,
  List,
  FileSpreadsheet,
  Plus,
  Trash2,
  ExternalLink,
  Zap,
} from 'lucide-react'
import { formatNumber } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

interface TwitterSource {
  id: string
  handle: string
  display_name: string | null
  description: string | null
  notes: string | null
  status: string
  credibility_score: number
  metadata: {
    type?: string
    followers_count?: number
    following_count?: number
    tweet_count?: number
    verified?: boolean
    profile_image_url?: string
    last_tweet_date?: string
  }
  // Calculated metrics
  tweets_collected?: number
  total_engagement?: number
  avg_engagement?: number
  last_active?: string
}


// ============================================
// SOURCE CARD COMPONENT
// ============================================

function SourceCard({
  source,
  viewMode,
  selected,
  onSelect,
  onDelete,
}: {
  source: TwitterSource
  viewMode: 'grid' | 'list'
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const credibilityColor = source.credibility_score >= 0.8
    ? 'text-green-600 bg-green-100 border-green-500'
    : source.credibility_score >= 0.5
    ? 'text-yellow-600 bg-yellow-100 border-yellow-500'
    : 'text-red-600 bg-red-100 border-red-500'

  const typeColors: Record<string, string> = {
    media: 'bg-purple-100 text-purple-800 border-purple-400',
    league: 'bg-blue-100 text-blue-800 border-blue-400',
    battler: 'bg-orange-100 text-orange-800 border-orange-400',
    fan: 'bg-green-100 text-green-800 border-green-400',
    other: 'bg-gray-100 text-gray-800 border-gray-400',
  }

  const type = source.metadata?.type || 'other'

  if (viewMode === 'list') {
    return (
      <div
        className={`flex items-center gap-4 p-4 border-2 transition-all cursor-pointer ${
          selected ? 'border-primary bg-primary/5' : 'border-foreground/20 hover:border-foreground/40'
        }`}
        onClick={onSelect}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-5 w-5"
          onClick={(e) => e.stopPropagation()}
        />
        <Avatar className="h-10 w-10 border-2">
          <AvatarFallback className="bg-blue-100 text-blue-800 font-bold">
            {(source.display_name || source.handle).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{source.display_name || source.handle}</span>
            <span className="text-sm text-muted-foreground">{source.handle}</span>
            <span className={`px-2 py-0.5 text-xs font-bold border ${typeColors[type]}`}>
              {type}
            </span>
          </div>
          {source.description && (
            <p className="text-sm text-muted-foreground truncate">{source.description}</p>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Tweets</p>
            <p className="font-semibold">{source.tweets_collected || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Engagement</p>
            <p className="font-semibold">{formatNumber(source.total_engagement || 0)}</p>
          </div>
          <div className={`px-3 py-1 font-bold border-2 ${credibilityColor}`}>
            {(source.credibility_score * 100).toFixed(0)}%
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    )
  }

  return (
    <Card
      className={`relative overflow-hidden cursor-pointer transition-all ${
        selected ? 'ring-2 ring-primary' : 'hover:shadow-lg'
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Selection checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="absolute top-3 right-3 h-5 w-5"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar className="h-14 w-14 border-2">
            <AvatarFallback className="bg-blue-100 text-blue-800 font-bold text-lg">
              {(source.display_name || source.handle).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold truncate">{source.display_name || source.handle}</h3>
            <p className="text-sm text-muted-foreground">{source.handle}</p>
            <div className="flex gap-1 mt-1">
              <span className={`px-2 py-0.5 text-xs font-bold border ${typeColors[type]}`}>
                {type}
              </span>
            </div>
          </div>
        </div>

        {/* Credibility Score */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Credibility</span>
            <span className={`font-bold ${credibilityColor.split(' ')[0]}`}>
              {(source.credibility_score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                source.credibility_score >= 0.8
                  ? 'bg-green-500'
                  : source.credibility_score >= 0.5
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${source.credibility_score * 100}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-2 bg-muted rounded">
            <p className="text-xs text-muted-foreground">Tweets</p>
            <p className="font-bold">{source.tweets_collected || 0}</p>
          </div>
          <div className="p-2 bg-muted rounded">
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className="font-bold">{formatNumber(source.total_engagement || 0)}</p>
          </div>
        </div>

        {/* Description */}
        {source.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{source.description}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              window.open(`https://twitter.com/${source.handle.replace('@', '')}`, '_blank')
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// CSV IMPORT MODAL
// ============================================

function CSVImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (sources: Partial<TwitterSource>[]) => void
}) {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<Partial<TwitterSource>[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      setError('CSV must have a header row and at least one data row')
      return []
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const handleIndex = headers.findIndex(h => h === 'handle' || h === 'username' || h === 'twitter')
    const nameIndex = headers.findIndex(h => h === 'name' || h === 'display_name' || h === 'displayname')
    const typeIndex = headers.findIndex(h => h === 'type' || h === 'category')
    const descIndex = headers.findIndex(h => h === 'description' || h === 'desc' || h === 'bio')
    const notesIndex = headers.findIndex(h => h === 'notes' || h === 'note')

    if (handleIndex === -1) {
      setError('CSV must have a "handle" or "username" column')
      return []
    }

    const sources: Partial<TwitterSource>[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''))
      const handle = values[handleIndex]
      if (!handle) continue

      sources.push({
        handle: handle.startsWith('@') ? handle : `@${handle}`,
        display_name: nameIndex >= 0 ? values[nameIndex] : undefined,
        metadata: { type: typeIndex >= 0 ? values[typeIndex] : 'other' },
        description: descIndex >= 0 ? values[descIndex] : undefined,
        notes: notesIndex >= 0 ? values[notesIndex] : undefined,
      })
    }

    return sources
  }

  const handleTextChange = (text: string) => {
    setCsvText(text)
    setError(null)
    if (text.trim()) {
      const parsed = parseCSV(text)
      setPreview(parsed)
    } else {
      setPreview([])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        handleTextChange(text)
      }
      reader.readAsText(file)
    }
  }

  const handleImport = () => {
    if (preview.length > 0) {
      onImport(preview)
      setCsvText('')
      setPreview([])
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Import Sources from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Instructions */}
          <div className="p-4 bg-muted border-2 border-foreground/20">
            <h4 className="font-semibold mb-2">CSV Format</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Required column: <code className="bg-background px-1">handle</code> or{' '}
              <code className="bg-background px-1">username</code>
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Optional columns: <code className="bg-background px-1">name</code>,{' '}
              <code className="bg-background px-1">type</code>,{' '}
              <code className="bg-background px-1">description</code>,{' '}
              <code className="bg-background px-1">notes</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Example: handle,name,type,description<br />
              @urltv,URL TV,media,Battle rap media platform
            </p>
          </div>

          {/* File Upload */}
          <div
            className="p-6 border-4 border-dashed border-foreground/30 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="font-semibold">Click to upload CSV file</p>
            <p className="text-sm text-muted-foreground">or drag and drop</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Or paste text */}
          <div className="text-center text-sm text-muted-foreground">or paste CSV text below</div>

          {/* Text Input */}
          <Textarea
            placeholder="handle,name,type,description&#10;@urltv,URL TV,media,Battle rap media"
            value={csvText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={6}
            className="font-mono text-sm"
          />

          {/* Error */}
          {error && (
            <div className="p-3 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">{error}</span>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Preview ({preview.length} sources)
              </h4>
              <div className="max-h-48 overflow-y-auto border-2 border-foreground/20">
                {preview.slice(0, 10).map((source, i) => (
                  <div key={i} className="p-2 border-b border-foreground/10 text-sm flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold">{source.handle}</span>
                    {source.display_name && (
                      <span className="text-muted-foreground">({source.display_name})</span>
                    )}
                    {source.metadata?.type && (
                      <Badge variant="secondary" size="sm">{source.metadata.type}</Badge>
                    )}
                  </div>
                ))}
                {preview.length > 10 && (
                  <div className="p-2 text-sm text-muted-foreground">
                    ...and {preview.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={preview.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Import {preview.length} Sources
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

export default function SourcePoolPage() {
  const { topics, selectedTopic, selectTopic } = useTopic()
  const [sources, setSources] = useState<TwitterSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'credibility' | 'engagement' | 'tweets' | 'name'>('credibility')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())

  const [importOpen, setImportOpen] = useState(false)

  // Fetch sources when topic changes
  useEffect(() => {
    if (!selectedTopic) {
      setLoading(false)
      return
    }

    const topicId = selectedTopic.id
    async function fetchSources() {
      setLoading(true)
      try {
        const res = await fetch(`/api/topics/${topicId}/sources?platform=twitter`)
        const data = await res.json()
        setSources(Array.isArray(data) ? data : [])
        setError(null)
      } catch {
        setError('Failed to load sources')
      } finally {
        setLoading(false)
      }
    }
    fetchSources()
  }, [selectedTopic?.id])

  // Filter and sort sources
  const filteredSources = sources
    .filter(s => {
      if (filterType !== 'all' && (s.metadata?.type || 'other') !== filterType) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          s.handle.toLowerCase().includes(q) ||
          s.display_name?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'credibility':
          cmp = a.credibility_score - b.credibility_score
          break
        case 'engagement':
          cmp = (a.total_engagement || 0) - (b.total_engagement || 0)
          break
        case 'tweets':
          cmp = (a.tweets_collected || 0) - (b.tweets_collected || 0)
          break
        case 'name':
          cmp = (a.display_name || a.handle).localeCompare(b.display_name || b.handle)
          break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

  const handleSelectSource = (id: string) => {
    const newSelected = new Set(selectedSources)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedSources(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedSources.size === filteredSources.length) {
      setSelectedSources(new Set())
    } else {
      setSelectedSources(new Set(filteredSources.map(s => s.id)))
    }
  }

  const handleDeleteSource = async (id: string) => {
    if (!selectedTopic || !confirm('Delete this source?')) return
    try {
      await fetch(`/api/topics/${selectedTopic.id}/sources?sourceId=${id}`, { method: 'DELETE' })
      setSources(sources.filter(s => s.id !== id))
      selectedSources.delete(id)
      setSelectedSources(new Set(selectedSources))
    } catch {
      setError('Failed to delete source')
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedTopic || !confirm(`Delete ${selectedSources.size} selected sources?`)) return
    for (const id of Array.from(selectedSources)) {
      await fetch(`/api/topics/${selectedTopic.id}/sources?sourceId=${id}`, { method: 'DELETE' })
    }
    setSources(sources.filter(s => !selectedSources.has(s.id)))
    setSelectedSources(new Set())
  }

  const handleImport = async (newSources: Partial<TwitterSource>[]) => {
    if (!selectedTopic) return

    for (const source of newSources) {
      try {
        const res = await fetch(`/api/topics/${selectedTopic.id}/sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'twitter',
            handle: source.handle,
            display_name: source.display_name || source.handle?.replace('@', ''),
            description: source.description,
            notes: source.notes,
            metadata: source.metadata,
          }),
        })
        if (res.ok) {
          const created = await res.json()
          setSources(prev => [...prev, created])
        }
      } catch {
        // Continue with next
      }
    }
  }

  // Stats
  const stats = {
    total: sources.length,
    highCredibility: sources.filter(s => s.credibility_score >= 0.8).length,
    mediumCredibility: sources.filter(s => s.credibility_score >= 0.5 && s.credibility_score < 0.8).length,
    lowCredibility: sources.filter(s => s.credibility_score < 0.5).length,
    totalEngagement: sources.reduce((sum, s) => sum + (s.total_engagement || 0), 0),
    totalTweets: sources.reduce((sum, s) => sum + (s.tweets_collected || 0), 0),
  }

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'media', label: 'Media' },
    { value: 'league', label: 'League' },
    { value: 'battler', label: 'Battler' },
    { value: 'fan', label: 'Fan' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <AppShell topicName="Studio">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              SOURCE POOL
            </h1>
            <p className="text-muted-foreground text-lg">
              Compare and manage your Twitter intelligence sources
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedTopic?.id || ''}
              onValueChange={(id) => {
                const topic = topics.find(t => t.id === id)
                if (topic) selectTopic(topic)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select topic..." />
              </SelectTrigger>
              <SelectContent>
                {topics.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Source
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-6 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Sources</p>
          </Card>
          <Card className="p-4 text-center border-green-500">
            <p className="text-2xl font-bold text-green-600">{stats.highCredibility}</p>
            <p className="text-sm text-muted-foreground">High Cred (80%+)</p>
          </Card>
          <Card className="p-4 text-center border-yellow-500">
            <p className="text-2xl font-bold text-yellow-600">{stats.mediumCredibility}</p>
            <p className="text-sm text-muted-foreground">Medium (50-79%)</p>
          </Card>
          <Card className="p-4 text-center border-red-500">
            <p className="text-2xl font-bold text-red-600">{stats.lowCredibility}</p>
            <p className="text-sm text-muted-foreground">Low (&lt;50%)</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{formatNumber(stats.totalTweets)}</p>
            <p className="text-sm text-muted-foreground">Total Tweets</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{formatNumber(stats.totalEngagement)}</p>
            <p className="text-sm text-muted-foreground">Total Engagement</p>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search sources..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>

                {/* Filter */}
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-36">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-40">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credibility">Credibility</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="tweets">Tweet Count</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                >
                  {sortDir === 'desc' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex items-center gap-3">
                {/* Bulk Actions */}
                {selectedSources.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedSources.size} selected
                    </span>
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}

                {/* Select All */}
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedSources.size === filteredSources.length ? 'Deselect All' : 'Select All'}
                </Button>

                {/* View Toggle */}
                <div className="flex border-2 border-foreground">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="p-4 border-2 border-destructive bg-destructive/10 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && filteredSources.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Twitter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No sources found</h3>
              <p className="text-muted-foreground mb-4">
                {sources.length === 0
                  ? 'Add Twitter accounts to start monitoring'
                  : 'No sources match your filters'}
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => setImportOpen(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Import from CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Source Grid/List */}
        {!loading && filteredSources.length > 0 && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-2'}>
            {filteredSources.map(source => (
              <SourceCard
                key={source.id}
                source={source}
                viewMode={viewMode}
                selected={selectedSources.has(source.id)}
                onSelect={() => handleSelectSource(source.id)}
                onDelete={() => handleDeleteSource(source.id)}
              />
            ))}
          </div>
        )}

        {/* CSV Import Modal */}
        <CSVImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={handleImport}
        />
      </div>
    </AppShell>
  )
}
