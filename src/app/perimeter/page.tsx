'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { useTopic } from '@/context/topic-context'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui'
import {
  Radar,
  RefreshCw,
  Filter,
  Heart,
  Repeat,
  MessageCircle,
  Eye,
  ExternalLink,
  TrendingUp,
  Clock,
  Loader2,
  AlertCircle,
  Download,
  Twitter,
  Youtube,
  DollarSign,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react'
import { formatNumber, formatRelativeTime } from '@/lib/utils'

interface Tweet {
  id: string
  tweet_id: string
  text: string
  author_handle: string
  author_name: string | null
  author_profile_image: string | null
  tweet_type: string
  metrics_likes: number
  metrics_retweets: number
  metrics_replies: number
  metrics_views: number
  tweet_created_at: string
  engagement_score: number
  source_accounts: {
    handle: string
    display_name: string
    profile_image_url: string | null
    credibility_score: number
  } | null
}

interface TrendingEntity {
  canonical_name: string
  mention_count: number
  entity_type: string
}

interface Stats {
  tweets: {
    total: number
    today: number
    uniqueAuthorsToday: number
    totalEngagementToday: number
  }
  entities: number
  claims: number
  trending: TrendingEntity[]
}

interface PullResult {
  success: boolean
  type: string
  itemsFound: number
  newItems: number
  estimatedCost: number
  durationMs: number
  error?: string
}

export default function PerimeterPage() {
  const [sortBy, setSortBy] = useState('recent')
  const [filterType, setFilterType] = useState('all')
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [dbConnected, setDbConnected] = useState<boolean | null>(null)

  // Force Pull state
  const [showPullPanel, setShowPullPanel] = useState(false)
  const [pullTarget, setPullTarget] = useState('')
  const [pullType, setPullType] = useState<'twitter_timeline' | 'twitter_search' | 'youtube_channel' | 'all_sources'>('twitter_timeline')
  const [pulling, setPulling] = useState(false)
  const [pullResult, setPullResult] = useState<PullResult | null>(null)

  const { selectedTopic } = useTopic()

  // Fetch tweets when topic/filters change
  useEffect(() => {
    if (!selectedTopic) return

    const topicId = selectedTopic.id
    async function fetchTweets() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          sortBy,
          type: filterType,
          limit: '50',
        })
        const res = await fetch(`/api/topics/${topicId}/tweets?${params}`)
        const data = await res.json()
        setTweets(data.tweets || [])
        setLastUpdated(new Date())
        setError(null)
      } catch (err) {
        setError('Failed to fetch tweets')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchTweets()
  }, [selectedTopic, sortBy, filterType])

  // Fetch stats
  useEffect(() => {
    if (!selectedTopic) return

    const topicId = selectedTopic.id
    async function fetchStats() {
      try {
        const res = await fetch(`/api/topics/${topicId}/stats`)
        const data = await res.json()
        setStats(data)
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }
    fetchStats()
  }, [selectedTopic])

  const handleRefresh = async () => {
    if (!selectedTopic) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        sortBy,
        type: filterType,
        limit: '50',
      })
      const res = await fetch(`/api/topics/${selectedTopic.id}/tweets?${params}`)
      const data = await res.json()
      setTweets(data.tweets || [])
      setLastUpdated(new Date())
    } catch (err) {
      setError('Failed to refresh')
    } finally {
      setLoading(false)
    }
  }

  // Force Pull handler
  const handleForcePull = async () => {
    if (!selectedTopic) return

    setPulling(true)
    setPullResult(null)

    try {
      const res = await fetch('/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: pullType,
          topicId: selectedTopic.id,
          target: pullTarget,
        }),
      })

      const data = await res.json()
      setPullResult(data)

      // Refresh tweets if pull was successful
      if (data.success) {
        handleRefresh()
      }
    } catch (err) {
      setPullResult({
        success: false,
        type: pullType,
        itemsFound: 0,
        newItems: 0,
        estimatedCost: 0,
        durationMs: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setPulling(false)
    }
  }

  // Database not connected state
  if (dbConnected === false) {
    return (
      <AppShell topicName={selectedTopic?.name || 'PERIMETER'}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-head text-3xl flex items-center gap-3">
                <Radar className="h-8 w-8 text-primary" />
                PERIMETER
              </h1>
              <p className="text-muted-foreground">
                Real-time signal monitoring from your sources
              </p>
            </div>
          </div>

          <Card className="border-destructive border-2">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-destructive/20 flex items-center justify-center border-2 border-foreground">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="flex-1">
                  <h2 className="font-head text-xl mb-2">Database Not Connected</h2>
                  <p className="text-muted-foreground mb-4">
                    Talk Show Go needs a database to store tweets, entities, and stories.
                    Start the Docker containers to get everything running.
                  </p>
                  <div className="bg-muted p-4 border-2 border-foreground mb-4">
                    <p className="font-mono text-sm mb-2">Run these commands:</p>
                    <code className="block bg-background px-3 py-2 text-sm border border-foreground">
                      docker-compose up -d
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This starts: PostgreSQL (database), Redis (job queue), and Qdrant (vector search)
                  </p>
                  <Button className="mt-4 gap-2" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-4 w-4" />
                    Retry Connection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell topicName={selectedTopic?.name || 'PERIMETER'}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Radar className="h-8 w-8 text-primary" />
              PERIMETER
            </h1>
            <p className="text-muted-foreground text-lg">
              The first line of intelligence gathering - where raw social signals are collected and monitored
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => setShowPullPanel(!showPullPanel)}
            >
              <Download className="h-4 w-4" />
              Force Pull
            </Button>
            <Button className="gap-2" onClick={handleRefresh} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh Feed
            </Button>
          </div>
        </div>

        {/* Force Pull Panel */}
        {showPullPanel && (
          <Card className="border-primary border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Force Pull - Manually Fetch Data
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Bypass automatic scheduling and immediately pull data from sources. Use this to test APIs,
                seed initial data, or grab breaking news quickly.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pull Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Pull Type</label>
                  <Select value={pullType} onValueChange={(v: any) => setPullType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twitter_timeline">
                        <span className="flex items-center gap-2">
                          <Twitter className="h-4 w-4" />
                          Twitter Timeline
                        </span>
                      </SelectItem>
                      <SelectItem value="twitter_search">
                        <span className="flex items-center gap-2">
                          <Twitter className="h-4 w-4" />
                          Twitter Search
                        </span>
                      </SelectItem>
                      <SelectItem value="youtube_channel">
                        <span className="flex items-center gap-2">
                          <Youtube className="h-4 w-4" />
                          YouTube Channel
                        </span>
                      </SelectItem>
                      <SelectItem value="all_sources">
                        <span className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          All Sources
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Target */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {pullType === 'twitter_timeline' && 'Twitter Username'}
                    {pullType === 'twitter_search' && 'Search Query'}
                    {pullType === 'youtube_channel' && 'Channel Handle'}
                    {pullType === 'all_sources' && 'Target (optional)'}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border-2 border-foreground bg-background"
                    placeholder={
                      pullType === 'twitter_timeline' ? '@urltv' :
                      pullType === 'twitter_search' ? '"battle rap" OR @GeechiGotti' :
                      pullType === 'youtube_channel' ? '@urlofficialpage' :
                      'Leave empty for all'
                    }
                    value={pullTarget}
                    onChange={(e) => setPullTarget(e.target.value)}
                    disabled={pullType === 'all_sources'}
                  />
                </div>

                {/* Pull Button */}
                <div className="flex items-end">
                  <Button
                    className="w-full gap-2"
                    onClick={handleForcePull}
                    disabled={pulling || (pullType !== 'all_sources' && !pullTarget)}
                  >
                    {pulling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {pulling ? 'Pulling...' : 'Pull Now'}
                  </Button>
                </div>
              </div>

              {/* Cost Estimate */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Estimated cost:
                </span>
                {pullType === 'youtube_channel' || pullType === 'all_sources' ? (
                  <Badge variant="success">FREE (local scraping)</Badge>
                ) : (
                  <span>~$0.003 per pull (20 tweets)</span>
                )}
              </div>

              {/* Pull Result */}
              {pullResult && (
                <div className={`p-4 border-2 ${pullResult.success ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {pullResult.success ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-semibold">
                      {pullResult.success ? 'Pull Successful!' : 'Pull Failed'}
                    </span>
                  </div>
                  {pullResult.success ? (
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Items Found</span>
                        <p className="font-semibold">{pullResult.itemsFound}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">New Items</span>
                        <p className="font-semibold text-success">{pullResult.newItems}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cost</span>
                        <p className="font-semibold">${pullResult.estimatedCost.toFixed(4)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duration</span>
                        <p className="font-semibold">{(pullResult.durationMs / 1000).toFixed(1)}s</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-destructive">{pullResult.error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-3 space-y-4">
            {/* Feed Controls */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Most Recent</SelectItem>
                        <SelectItem value="engagement">Most Engagement</SelectItem>
                        <SelectItem value="trending">Trending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="original">Original</SelectItem>
                        <SelectItem value="reply">Replies</SelectItem>
                        <SelectItem value="quote">Quotes</SelectItem>
                        <SelectItem value="retweet">Retweets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Last updated: {formatRelativeTime(lastUpdated)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error State */}
            {error && (
              <Card className="border-destructive">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span>{error}</span>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {loading && tweets.length === 0 && (
              <Card>
                <CardContent className="p-8 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!loading && tweets.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Radar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No tweets yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Use the Force Pull button above to fetch tweets from your configured sources.
                  </p>
                  <Button onClick={() => setShowPullPanel(true)} className="gap-2">
                    <Download className="h-4 w-4" />
                    Open Force Pull
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Tweet Feed */}
            <div className="space-y-3">
              {tweets.map((tweet) => (
                <Card key={tweet.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>
                          {(tweet.author_name || tweet.author_handle).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {/* Author info */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">
                            {tweet.author_name || tweet.author_handle}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            @{tweet.author_handle}
                          </span>
                          <span className="text-muted-foreground text-sm">·</span>
                          <span className="text-muted-foreground text-sm">
                            {formatRelativeTime(new Date(tweet.tweet_created_at))}
                          </span>
                          {tweet.source_accounts && (
                            <Badge variant="outline" size="sm">
                              Source: {(tweet.source_accounts.credibility_score * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>

                        {/* Tweet text */}
                        <p className="mb-3 whitespace-pre-wrap">{tweet.text}</p>

                        {/* Tweet type badge */}
                        {tweet.tweet_type !== 'original' && (
                          <Badge variant="secondary" size="sm" className="mb-2">
                            {tweet.tweet_type}
                          </Badge>
                        )}

                        {/* Metrics */}
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5 hover:text-foreground cursor-pointer">
                            <MessageCircle className="h-4 w-4" />
                            {formatNumber(tweet.metrics_replies)}
                          </span>
                          <span className="flex items-center gap-1.5 hover:text-success cursor-pointer">
                            <Repeat className="h-4 w-4" />
                            {formatNumber(tweet.metrics_retweets)}
                          </span>
                          <span className="flex items-center gap-1.5 hover:text-destructive cursor-pointer">
                            <Heart className="h-4 w-4" />
                            {formatNumber(tweet.metrics_likes)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Eye className="h-4 w-4" />
                            {formatNumber(tweet.metrics_views)}
                          </span>
                        </div>
                      </div>

                      {/* Engagement Score */}
                      <div className="text-right">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-1 border-2 border-foreground ${
                            tweet.engagement_score >= 90
                              ? 'bg-success text-success-foreground'
                              : tweet.engagement_score >= 70
                              ? 'bg-warning text-warning-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-sm font-semibold">
                            {tweet.engagement_score}
                          </span>
                        </div>
                        <div className="mt-2">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More */}
            {tweets.length > 0 && (
              <Button variant="outline" className="w-full">
                Load More Tweets
              </Button>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Trending Topics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Trending Now
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Entities mentioned most in recent tweets - people, events, topics gaining attention
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.trending.map((item, index) => (
                  <div
                    key={item.canonical_name}
                    className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer border-2 border-transparent hover:border-foreground transition-all"
                  >
                    <div>
                      <div className="font-medium">{item.canonical_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.mention_count} mentions · {item.entity_type}
                      </div>
                    </div>
                    <Badge variant="success" size="sm">
                      <TrendingUp className="h-3 w-3" />
                    </Badge>
                  </div>
                )) || (
                  <div className="text-sm text-muted-foreground">
                    No trending topics yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Today's Stats</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Data collected since midnight - how much intelligence has flowed through
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tweets Collected</span>
                  <span className="font-semibold">
                    {formatNumber(stats?.tweets.today || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unique Authors</span>
                  <span className="font-semibold">
                    {stats?.tweets.uniqueAuthorsToday || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Engagement</span>
                  <span className="font-semibold">
                    {formatNumber(stats?.tweets.totalEngagementToday || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Tweets</span>
                  <span className="font-semibold">
                    {formatNumber(stats?.tweets.total || 0)}
                  </span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entities Tracked</span>
                    <span className="font-semibold">{stats?.entities || 0}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-muted-foreground">Active Claims</span>
                    <span className="font-semibold">{stats?.claims || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
