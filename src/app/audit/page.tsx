'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { useTopic } from '@/context/topic-context'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui'
import {
  Shield,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Twitter,
  Youtube,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface SourceAccount {
  id: string
  platform: string
  handle: string
  display_name: string | null
  status: string
  credibility_score: number
  metadata: Record<string, any>
}

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-success" />
    case 'down':
      return <TrendingDown className="h-4 w-4 text-destructive" />
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />
  }
}

const getCredibilityColor = (score: number) => {
  if (score >= 0.9) return 'text-success'
  if (score >= 0.75) return 'text-primary'
  if (score >= 0.6) return 'text-warning'
  return 'text-destructive'
}

const getCredibilityBadge = (score: number) => {
  if (score >= 0.9) return { label: 'Excellent', variant: 'success' }
  if (score >= 0.75) return { label: 'Good', variant: 'primary' }
  if (score >= 0.6) return { label: 'Fair', variant: 'warning' }
  return { label: 'Poor', variant: 'destructive' }
}

export default function AuditPage() {
  const [sources, setSources] = useState<SourceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('credibility')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { selectedTopic, topics } = useTopic()

  useEffect(() => {
    fetchSources()
  }, [selectedTopic])

  const fetchSources = async () => {
    if (!selectedTopic) return

    setLoading(true)
    try {
      // Fetch sources for ONLY the selected topic
      const res = await fetch(`/api/topics/${selectedTopic.id}/sources`)
      if (res.ok) {
        const data = await res.json()
        setSources(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error)
    }
    setLoading(false)
  }

  const filteredSources = sources
    .filter((source) => {
      if (filterPlatform !== 'all' && source.platform !== filterPlatform) return false
      if (
        searchQuery &&
        !(source.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) &&
        !source.handle.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'credibility':
          return b.credibility_score - a.credibility_score
        case 'name':
          return (a.display_name || a.handle).localeCompare(b.display_name || b.handle)
        default:
          return 0
      }
    })

  const avgCredibility = sources.length > 0
    ? sources.reduce((acc, s) => acc + s.credibility_score, 0) / sources.length
    : 0

  const platformCounts = {
    twitter: sources.filter(s => s.platform === 'twitter').length,
    youtube: sources.filter(s => s.platform === 'youtube').length,
  }

  return (
    <AppShell topicName={selectedTopic?.name || 'AUDIT'}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              AUDIT
            </h1>
            <p className="text-muted-foreground">
              Source credibility ledger and verification metrics
            </p>
          </div>
          <Button variant="outline" onClick={fetchSources} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg Credibility</p>
              <p className={`font-head text-3xl ${getCredibilityColor(avgCredibility)}`}>
                {loading ? '-' : `${(avgCredibility * 100).toFixed(0)}%`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Sources</p>
              <p className="font-head text-3xl">{loading ? '-' : sources.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Twitter</p>
              <p className="font-head text-3xl">{loading ? '-' : platformCounts.twitter}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">YouTube</p>
              <p className="font-head text-3xl">{loading ? '-' : platformCounts.youtube}</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sources..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credibility">Credibility</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Source Ledger */}
        <Card>
          <CardHeader>
            <CardTitle>Credibility Ledger</CardTitle>
            <CardDescription>
              All sources ranked by credibility score
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSources.length === 0 ? (
              <div className="text-center py-16">
                <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-bold mb-2">No Sources Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'No sources match your search.' : 'Add sources in OUTPOST to see them here.'}
                </p>
                <Button onClick={() => window.location.href = '/outpost'}>
                  Go to OUTPOST
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSources.map((source, index) => {
                  const credBadge = getCredibilityBadge(source.credibility_score)
                  const sourceType = source.metadata?.type || 'other'
                  return (
                    <div
                      key={source.id}
                      className="flex items-center gap-4 p-4 border-2 border-foreground hover:bg-muted transition-colors"
                    >
                      {/* Rank */}
                      <div className="w-8 h-8 flex items-center justify-center border-2 border-foreground font-bold">
                        {index + 1}
                      </div>

                      {/* Platform Icon */}
                      <div className="p-2 border-2 border-foreground bg-muted">
                        {source.platform === 'twitter' ? (
                          <Twitter className="h-5 w-5" />
                        ) : (
                          <Youtube className="h-5 w-5" />
                        )}
                      </div>

                      {/* Source Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{source.display_name || source.handle}</span>
                          <span className="text-muted-foreground">
                            {source.handle}
                          </span>
                          <Badge variant={credBadge.variant as any} size="sm">
                            {credBadge.label}
                          </Badge>
                          <Badge variant="secondary" size="sm">
                            {sourceType}
                          </Badge>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span>Status: {source.status}</span>
                        </div>
                      </div>

                      {/* Credibility Score */}
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span
                            className={`font-head text-2xl ${getCredibilityColor(
                              source.credibility_score
                            )}`}
                          >
                            {(source.credibility_score * 100).toFixed(0)}%
                          </span>
                          {getTrendIcon('stable')}
                        </div>
                      </div>

                      {/* Actions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const url = source.platform === 'twitter'
                            ? `https://twitter.com/${source.handle.replace('@', '')}`
                            : `https://youtube.com/${source.handle}`
                          window.open(url, '_blank')
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
