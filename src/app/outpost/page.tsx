'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Textarea,
  Badge,
  Label,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Avatar,
  AvatarFallback,
  ChartContainer,
  RetroBarChart,
  RetroDonutChart,
  RetroAreaChart,
  StatCard,
  ProgressBar,
  CHART_COLORS,
} from '@/components/ui'
import {
  Plus,
  Twitter,
  Youtube,
  Globe,
  Rss,
  Trash2,
  Users,
  Building,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  Upload,
  Folder,
  RefreshCw,
  Search,
  AlertCircle,
  Target,
  BarChart3,
  Sparkles,
  Eye,
  Zap,
  Activity,
} from 'lucide-react'

// Types
interface Topic {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string
}

interface TwitterSource {
  id: string
  handle: string
  display_name: string | null
  description: string | null
  notes: string | null
  status: string
  credibility_score: number
  metadata: Record<string, unknown>
}

interface YouTubeChannel {
  id: string
  channel_name: string
  handle: string | null
  description: string | null
  notes: string | null
  status: string
  credibility_score: number
}

interface RSSFeed {
  id: string
  feed_url: string
  name: string
  status: string
}

interface Entity {
  id: string
  canonical_name: string
  entity_type: string
  description: string | null
  aliases: string[]
}

const twitterTypeOptions = [
  { value: 'media', label: 'Media/Podcast' },
  { value: 'league', label: 'League/Official' },
  { value: 'battler', label: 'Battler' },
  { value: 'fan', label: 'Fan Account' },
  { value: 'other', label: 'Other' },
]

const entityTypeOptions = [
  { value: 'person', label: 'Person', icon: Users },
  { value: 'organization', label: 'Organization', icon: Building },
  { value: 'event', label: 'Event', icon: Calendar },
  { value: 'venue', label: 'Venue', icon: MapPin },
]

export default function OutpostPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [twitterSources, setTwitterSources] = useState<TwitterSource[]>([])
  const [youtubeSources, setYoutubeSources] = useState<YouTubeChannel[]>([])
  const [rssFeeds, setRssFeeds] = useState<RSSFeed[]>([])
  const [entities, setEntities] = useState<Entity[]>([])

  const [activeTab, setActiveTab] = useState('overview')
  const [addTwitterOpen, setAddTwitterOpen] = useState(false)
  const [addYoutubeOpen, setAddYoutubeOpen] = useState(false)
  const [addWebsiteOpen, setAddWebsiteOpen] = useState(false)
  const [addEntityOpen, setAddEntityOpen] = useState(false)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [createTopicOpen, setCreateTopicOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set())

  const [newTwitter, setNewTwitter] = useState({ handle: '', displayName: '', description: '', notes: '', type: 'media' })
  const [newYoutube, setNewYoutube] = useState({ channelName: '', channelUrl: '', description: '', notes: '' })
  const [newWebsite, setNewWebsite] = useState({ name: '', feedUrl: '' })
  const [newEntity, setNewEntity] = useState({ name: '', type: 'person', description: '', aliases: '' })
  const [bulkHandles, setBulkHandles] = useState('')
  const [newTopic, setNewTopic] = useState({ name: '', description: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // RSS Discovery
  const [discoverRssOpen, setDiscoverRssOpen] = useState(false)
  const [discoveredFeeds, setDiscoveredFeeds] = useState<any[]>([])
  const [discoveringRss, setDiscoveringRss] = useState(false)
  const [rssDiscoveryNiche, setRssDiscoveryNiche] = useState('')
  const [rssDiscoveryKeywords, setRssDiscoveryKeywords] = useState('')
  const [selectedDiscoveredFeeds, setSelectedDiscoveredFeeds] = useState<Set<number>>(new Set())
  const [rssDiscoveryStatus, setRssDiscoveryStatus] = useState<{configured: boolean, credits_remaining: number} | null>(null)
  const [addingDiscoveredFeeds, setAddingDiscoveredFeeds] = useState(false)

  useEffect(() => { fetchTopics() }, [])
  useEffect(() => { if (selectedTopicId) fetchTopicData(selectedTopicId) }, [selectedTopicId])

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setTopics(data)
      if (data.length > 0 && !selectedTopicId) setSelectedTopicId(data[0].id)
      setLoading(false)
    } catch { setError('Failed to load topics'); setLoading(false) }
  }

  const fetchTopicData = async (topicId: string) => {
    setLoading(true)
    try {
      const [sourcesRes, youtubeRes, rssRes, entitiesRes] = await Promise.all([
        fetch(`/api/topics/${topicId}/sources?platform=twitter`),
        fetch(`/api/topics/${topicId}/youtube`),
        fetch(`/api/topics/${topicId}/rss`),
        fetch(`/api/topics/${topicId}/entities`),
      ])
      const [sources, youtube, rss, ents] = await Promise.all([
        sourcesRes.json(), youtubeRes.json(), rssRes.json(), entitiesRes.json(),
      ])
      setTwitterSources(Array.isArray(sources) ? sources : [])
      setYoutubeSources(Array.isArray(youtube) ? youtube : [])
      setRssFeeds(Array.isArray(rss) ? rss : [])
      setEntities(Array.isArray(ents) ? ents : [])
      setError(null)
    } catch { setError('Failed to load data') }
    setLoading(false)
  }

  const handleCreateTopic = async () => {
    if (!newTopic.name) return
    try {
      const res = await fetch('/api/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTopic) })
      if (!res.ok) throw new Error()
      const topic = await res.json()
      setTopics([topic, ...topics]); setSelectedTopicId(topic.id); setNewTopic({ name: '', description: '' }); setCreateTopicOpen(false)
    } catch { setError('Failed to create topic') }
  }

  const handleAddTwitter = async () => {
    if (!newTwitter.handle || !selectedTopicId) return
    try {
      const handle = newTwitter.handle.startsWith('@') ? newTwitter.handle : `@${newTwitter.handle}`
      const res = await fetch(`/api/topics/${selectedTopicId}/sources`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'twitter', handle, display_name: newTwitter.displayName || handle.replace('@', ''), description: newTwitter.description, notes: newTwitter.notes, metadata: { type: newTwitter.type } }),
      })
      if (!res.ok) throw new Error()
      const source = await res.json()
      setTwitterSources([...twitterSources, source]); setNewTwitter({ handle: '', displayName: '', description: '', notes: '', type: 'media' }); setAddTwitterOpen(false)
    } catch { setError('Failed to add source') }
  }

  const handleBulkAdd = async () => {
    if (!selectedTopicId) return
    const handles = bulkHandles.split(/[\n,]+/).map(h => h.trim()).filter(h => h.length > 0)
    for (const handle of handles) {
      try {
        const res = await fetch(`/api/topics/${selectedTopicId}/sources`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'twitter', handle: handle.startsWith('@') ? handle : `@${handle}`, display_name: handle.replace('@', '') }),
        })
        if (res.ok) { const source = await res.json(); setTwitterSources(prev => [...prev, source]) }
      } catch {}
    }
    setBulkHandles(''); setBulkAddOpen(false)
  }

  const handleAddYoutube = async () => {
    if (!newYoutube.channelName || !selectedTopicId) return
    try {
      const res = await fetch(`/api/topics/${selectedTopicId}/youtube`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_name: newYoutube.channelName, handle: newYoutube.channelUrl, description: newYoutube.description, notes: newYoutube.notes }),
      })
      if (!res.ok) throw new Error()
      const channel = await res.json()
      setYoutubeSources([...youtubeSources, channel]); setNewYoutube({ channelName: '', channelUrl: '', description: '', notes: '' }); setAddYoutubeOpen(false)
    } catch { setError('Failed to add channel') }
  }

  const handleAddWebsite = async () => {
    if (!newWebsite.feedUrl || !selectedTopicId) return
    try {
      const res = await fetch(`/api/topics/${selectedTopicId}/rss`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_url: newWebsite.feedUrl, name: newWebsite.name || new URL(newWebsite.feedUrl).hostname }),
      })
      if (!res.ok) throw new Error()
      const feed = await res.json()
      setRssFeeds([...rssFeeds, feed]); setNewWebsite({ name: '', feedUrl: '' }); setAddWebsiteOpen(false)
    } catch { setError('Failed to add feed') }
  }

  const handleAddEntity = async () => {
    if (!newEntity.name || !selectedTopicId) return
    try {
      const aliases = newEntity.aliases.split(',').map(a => a.trim()).filter(a => a.length > 0)
      const res = await fetch(`/api/topics/${selectedTopicId}/entities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEntity.name, type: newEntity.type, description: newEntity.description, aliases }),
      })
      if (!res.ok) throw new Error()
      const entity = await res.json()
      setEntities([...entities, { ...entity, aliases }]); setNewEntity({ name: '', type: 'person', description: '', aliases: '' }); setAddEntityOpen(false)
    } catch { setError('Failed to add entity') }
  }

  const deleteTwitter = async (id: string) => { await fetch(`/api/topics/${selectedTopicId}/sources?sourceId=${id}`, { method: 'DELETE' }); setTwitterSources(twitterSources.filter(s => s.id !== id)) }
  const deleteYoutube = async (id: string) => { await fetch(`/api/topics/${selectedTopicId}/youtube?channelId=${id}`, { method: 'DELETE' }); setYoutubeSources(youtubeSources.filter(s => s.id !== id)) }
  const deleteRss = async (id: string) => { await fetch(`/api/topics/${selectedTopicId}/rss?feedId=${id}`, { method: 'DELETE' }); setRssFeeds(rssFeeds.filter(f => f.id !== id)) }
  const deleteEntity = async (id: string) => { await fetch(`/api/topics/${selectedTopicId}/entities?entityId=${id}`, { method: 'DELETE' }); setEntities(entities.filter(e => e.id !== id)) }

  const handleSearch = async () => {
    if (!searchQuery) return
    setSearching(true)
    try {
      const res = await fetch(`/api/search/website?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch { setError('Search failed') }
    setSearching(false)
  }

  // RSS Discovery functions
  const checkRssDiscoveryStatus = async () => {
    try {
      const res = await fetch('/api/rss/discover')
      if (res.ok) {
        const data = await res.json()
        setRssDiscoveryStatus({ configured: data.configured, credits_remaining: data.credits_remaining })
      }
    } catch { /* ignore */ }
  }

  const openRssDiscovery = () => {
    checkRssDiscoveryStatus()
    setRssDiscoveryNiche(selectedTopic?.name || '')
    setRssDiscoveryKeywords('')
    setDiscoveredFeeds([])
    setSelectedDiscoveredFeeds(new Set())
    setDiscoverRssOpen(true)
  }

  const handleDiscoverRss = async () => {
    if (!rssDiscoveryNiche) return
    setDiscoveringRss(true)
    setDiscoveredFeeds([])
    try {
      const existingFeedNames = rssFeeds.map(f => f.name)
      const keywords = rssDiscoveryKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
      const res = await fetch('/api/rss/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: rssDiscoveryNiche, keywords, existingSources: existingFeedNames }),
      })
      const data = await res.json()
      if (data.success) {
        setDiscoveredFeeds(data.feeds || [])
        setRssDiscoveryStatus(prev => prev ? { ...prev, credits_remaining: data.credits_remaining } : null)
      } else {
        setError(data.error || 'Discovery failed')
      }
    } catch { setError('RSS discovery failed') }
    setDiscoveringRss(false)
  }

  const toggleDiscoveredFeed = (index: number) => {
    const newSelected = new Set(selectedDiscoveredFeeds)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedDiscoveredFeeds(newSelected)
  }

  const handleAddDiscoveredFeeds = async () => {
    if (!selectedTopicId || selectedDiscoveredFeeds.size === 0) return
    setAddingDiscoveredFeeds(true)
    const feedsToAdd = discoveredFeeds.filter((_, i) => selectedDiscoveredFeeds.has(i))
    for (const feed of feedsToAdd) {
      try {
        const res = await fetch(`/api/topics/${selectedTopicId}/rss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feed_url: feed.feed_url, name: feed.site_name }),
        })
        if (res.ok) {
          const newFeed = await res.json()
          setRssFeeds(prev => [...prev, newFeed])
        }
      } catch { /* ignore individual failures */ }
    }
    setAddingDiscoveredFeeds(false)
    setDiscoverRssOpen(false)
    setSelectedDiscoveredFeeds(new Set())
    setDiscoveredFeeds([])
  }

  const toggleEntity = (id: string) => {
    const newExp = new Set(expandedEntities); newExp.has(id) ? newExp.delete(id) : newExp.add(id); setExpandedEntities(newExp)
  }

  // Chart Data
  const sourceDistributionData = [
    { name: 'Twitter', value: twitterSources.length },
    { name: 'YouTube', value: youtubeSources.length },
    { name: 'RSS', value: rssFeeds.length },
  ]
  const entityTypeData = entityTypeOptions.map(t => ({ name: t.label, value: entities.filter(e => e.entity_type === t.value).length })).filter(d => d.value > 0)
  const twitterTypeData = twitterTypeOptions.map(t => ({ name: t.label, value: twitterSources.filter(s => (s.metadata?.type || 'other') === t.value).length })).filter(d => d.value > 0)
  const credibilityData = [
    { name: 'High (0.8+)', value: twitterSources.filter(s => s.credibility_score >= 0.8).length },
    { name: 'Medium', value: twitterSources.filter(s => s.credibility_score >= 0.5 && s.credibility_score < 0.8).length },
    { name: 'Low (<0.5)', value: twitterSources.filter(s => s.credibility_score < 0.5).length },
  ].filter(d => d.value > 0)
  // Activity data will come from real pipeline runs once the system is active
  const activityData: { name: string; tweets: number; videos: number; articles: number }[] = []

  const selectedTopic = topics.find(t => t.id === selectedTopicId)
  const totalSources = twitterSources.length + youtubeSources.length + rssFeeds.length

  const getStatusBadge = (status: string) => {
    const v: Record<string, 'primary' | 'success' | 'warning' | 'secondary'> = { seed: 'primary', verified: 'success', trusted: 'success', active: 'success', pending: 'warning' }
    return <Badge variant={v[status] || 'secondary'} size="sm">{status}</Badge>
  }
  const getTypeBadge = (metadata: Record<string, unknown>) => {
    const type = (metadata?.type as string) || 'other'
    const c: Record<string, string> = { media: 'bg-purple-100 text-purple-800 border-purple-400', league: 'bg-blue-100 text-blue-800 border-blue-400', battler: 'bg-orange-100 text-orange-800 border-orange-400', fan: 'bg-green-100 text-green-800 border-green-400', other: 'bg-gray-100 text-gray-800 border-gray-400' }
    return <span className={`px-2 py-0.5 text-xs font-bold border-2 ${c[type]}`}>{type}</span>
  }

  if (loading && topics.length === 0) {
    return <AppShell topicName=""><div className="flex items-center justify-center h-64"><RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" /></div></AppShell>
  }

  return (
    <AppShell topicName={selectedTopic?.name || 'Select Topic'}>
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border-4 border-red-500 p-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <span className="font-bold text-red-700">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">Dismiss</Button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-300 border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Target className="h-8 w-8" />
            </div>
            <div>
              <h1 className="font-black text-4xl tracking-tight">OUTPOST</h1>
              <p className="text-muted-foreground font-medium">Intelligence Source Configuration</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedTopicId || ''} onValueChange={setSelectedTopicId}>
              <SelectTrigger className="w-[200px] border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><SelectValue placeholder="Select topic..." /></SelectTrigger>
              <SelectContent>{topics.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Dialog open={createTopicOpen} onOpenChange={setCreateTopicOpen}>
              <DialogTrigger asChild><Button variant="outline" className="gap-2 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Plus className="h-4 w-4" />New Topic</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="text-2xl font-black">Create New Topic</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label className="font-bold">Topic Name *</Label><Input placeholder="e.g., Battle Rap" value={newTopic.name} onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })} className="border-2" /></div>
                  <div className="space-y-2"><Label className="font-bold">Description</Label><Textarea placeholder="What does this topic cover?" value={newTopic.description} onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })} className="border-2" /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setCreateTopicOpen(false)}>Cancel</Button><Button onClick={handleCreateTopic}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
              <DialogTrigger asChild><Button variant="outline" className="gap-2 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Search className="h-4 w-4" />Search Sites</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle className="text-2xl font-black">Search Websites</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex gap-2">
                    <Input placeholder="Search battlers, events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="border-2" />
                    <Button onClick={handleSearch} disabled={searching}>{searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Search'}</Button>
                  </div>
                  {searchResults.length > 0 && <div className="max-h-96 overflow-y-auto space-y-2">{searchResults.map((r, i) => <div key={i} className="p-3 border-2 hover:bg-yellow-50"><a href={r.url} target="_blank" className="font-bold hover:underline">{r.title}</a>{r.date && <span className="text-xs text-muted-foreground ml-2">{r.date}</span>}<p className="text-sm text-muted-foreground mt-1">{r.excerpt}</p></div>)}</div>}
                </div>
              </DialogContent>
            </Dialog>
            <Button className="gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" onClick={() => selectedTopicId && fetchTopicData(selectedTopicId)}><RefreshCw className="h-4 w-4" />Refresh</Button>
          </div>
        </div>

        {!selectedTopicId && topics.length === 0 && (
          <Card className="border-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-16 text-center">
              <div className="p-4 bg-yellow-300 border-4 border-foreground w-fit mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"><Sparkles className="h-12 w-12" /></div>
              <h3 className="text-3xl font-black mb-2">Welcome to OUTPOST</h3>
              <p className="text-muted-foreground mb-6">Create your first topic to start monitoring</p>
              <Button onClick={() => setCreateTopicOpen(true)} className="gap-2 text-lg px-8 py-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"><Plus className="h-5 w-5" />Create Topic</Button>
            </CardContent>
          </Card>
        )}

        {selectedTopicId && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start bg-transparent border-b-4 border-foreground rounded-none p-0">
              {[
                { value: 'overview', label: 'Overview', icon: BarChart3 },
                { value: 'twitter', label: `Twitter (${twitterSources.length})`, icon: Twitter },
                { value: 'youtube', label: `YouTube (${youtubeSources.length})`, icon: Youtube },
                { value: 'rss', label: `RSS (${rssFeeds.length})`, icon: Rss },
                { value: 'entities', label: `Entities (${entities.length})`, icon: Users },
              ].map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2 rounded-none border-b-4 border-transparent data-[state=active]:border-yellow-400 data-[state=active]:bg-yellow-50 px-6 py-3 font-bold">
                  <tab.icon className="h-4 w-4" />{tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Sources" value={totalSources} change={12} changeLabel="this week" icon={<Target className="h-5 w-5" />} color="info" sparklineData={[5, 8, 12, 15, 18, 22, totalSources]} />
                <StatCard title="Twitter" value={twitterSources.length} icon={<Twitter className="h-5 w-5" />} color="info" />
                <StatCard title="Entities" value={entities.length} change={8} changeLabel="new" icon={<Users className="h-5 w-5" />} color="success" />
                <StatCard title="Active Feeds" value={rssFeeds.length + youtubeSources.length} icon={<Activity className="h-5 w-5" />} color="warning" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartContainer title="Source Distribution" description="By platform">
                  {sourceDistributionData.some(d => d.value > 0) ? <RetroDonutChart data={sourceDistributionData} height={250} /> : <div className="h-[250px] flex items-center justify-center text-muted-foreground">No sources yet</div>}
                </ChartContainer>
                <ChartContainer title="Entity Types" description="Distribution">
                  {entityTypeData.length > 0 ? <RetroBarChart data={entityTypeData} height={250} color="#8b5cf6" /> : <div className="h-[250px] flex items-center justify-center text-muted-foreground">No entities yet</div>}
                </ChartContainer>
              </div>
              <ChartContainer title="Weekly Activity" description="Content from all sources">
                {activityData.length > 0 ? (
                  <RetroAreaChart data={activityData} areas={[{ dataKey: 'tweets', name: 'Tweets', color: '#3b82f6' }, { dataKey: 'videos', name: 'Videos', color: '#ef4444' }, { dataKey: 'articles', name: 'Articles', color: '#22c55e' }]} height={300} stacked />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">Run the pipeline to see activity data</div>
                )}
              </ChartContainer>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Twitter className="h-4 w-4 text-blue-500" />Twitter by Type</CardTitle></CardHeader>
                  <CardContent>{twitterTypeData.length > 0 ? <div className="space-y-2">{twitterTypeData.map((item, i) => <ProgressBar key={item.name} label={item.name} value={item.value} max={twitterSources.length} color={CHART_COLORS[i % CHART_COLORS.length]} size="sm" />)}</div> : <p className="text-sm text-muted-foreground">No data</p>}</CardContent>
                </Card>
                <Card className="border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" />Credibility</CardTitle></CardHeader>
                  <CardContent>{credibilityData.length > 0 ? <div className="space-y-2">{credibilityData.map((item, i) => <ProgressBar key={item.name} label={item.name} value={item.value} max={twitterSources.length} color={i === 0 ? '#22c55e' : i === 1 ? '#f97316' : '#ef4444'} size="sm" />)}</div> : <p className="text-sm text-muted-foreground">No data</p>}</CardContent>
                </Card>
                <Card className="border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Eye className="h-4 w-4 text-purple-500" />Top Entities</CardTitle></CardHeader>
                  <CardContent>{entities.length > 0 ? <div className="space-y-2">{entities.slice(0, 5).map(e => <div key={e.id} className="flex items-center justify-between text-sm"><span className="font-medium truncate">{e.canonical_name}</span><Badge variant="secondary" size="sm">{e.entity_type}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">No entities</p>}</CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Twitter */}
            <TabsContent value="twitter" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <div><h2 className="text-2xl font-black">Twitter/X Sources</h2><p className="text-muted-foreground">Accounts to monitor</p></div>
                <div className="flex gap-2">
                  <Dialog open={bulkAddOpen} onOpenChange={setBulkAddOpen}>
                    <DialogTrigger asChild><Button variant="outline" className="gap-2 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Upload className="h-4 w-4" />Bulk Add</Button></DialogTrigger>
                    <DialogContent><DialogHeader><DialogTitle className="font-black">Bulk Add</DialogTitle></DialogHeader><Textarea placeholder="@handle1&#10;@handle2" rows={8} value={bulkHandles} onChange={(e) => setBulkHandles(e.target.value)} className="border-2" /><DialogFooter><Button variant="outline" onClick={() => setBulkAddOpen(false)}>Cancel</Button><Button onClick={handleBulkAdd}>Add All</Button></DialogFooter></DialogContent>
                  </Dialog>
                  <Dialog open={addTwitterOpen} onOpenChange={setAddTwitterOpen}>
                    <DialogTrigger asChild><Button className="gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Plus className="h-4 w-4" />Add Account</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle className="font-black">Add Twitter Account</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label className="font-bold">Handle *</Label><Input placeholder="@username" value={newTwitter.handle} onChange={(e) => setNewTwitter({ ...newTwitter, handle: e.target.value })} className="border-2" /></div>
                          <div className="space-y-2"><Label className="font-bold">Display Name</Label><Input placeholder="Name" value={newTwitter.displayName} onChange={(e) => setNewTwitter({ ...newTwitter, displayName: e.target.value })} className="border-2" /></div>
                        </div>
                        <div className="space-y-2"><Label className="font-bold">Type</Label><Select value={newTwitter.type} onValueChange={(v) => setNewTwitter({ ...newTwitter, type: v })}><SelectTrigger className="border-2"><SelectValue /></SelectTrigger><SelectContent>{twitterTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label className="font-bold">Description</Label><Input placeholder="What do they cover?" value={newTwitter.description} onChange={(e) => setNewTwitter({ ...newTwitter, description: e.target.value })} className="border-2" /></div>
                        <div className="space-y-2"><Label className="font-bold">Notes</Label><Textarea placeholder="Notes..." rows={2} value={newTwitter.notes} onChange={(e) => setNewTwitter({ ...newTwitter, notes: e.target.value })} className="border-2" /></div>
                      </div>
                      <DialogFooter><Button variant="outline" onClick={() => setAddTwitterOpen(false)}>Cancel</Button><Button onClick={handleAddTwitter}>Add</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="grid gap-3">
                {twitterSources.length === 0 ? <Card className="border-2 border-dashed"><CardContent className="p-12 text-center"><Twitter className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-muted-foreground">No Twitter accounts</p></CardContent></Card> : twitterSources.map(s => (
                  <Card key={s.id} className="border-2 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <CardContent className="p-4"><div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2"><AvatarFallback className="bg-blue-100 text-blue-800 font-black">{(s.display_name || s.handle).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="flex-1"><div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-lg">{s.display_name || s.handle}</span><span className="text-muted-foreground">{s.handle}</span>{getTypeBadge(s.metadata || {})}{getStatusBadge(s.status)}</div>{s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}{s.notes && <p className="text-xs text-muted-foreground mt-1 italic">Note: {s.notes}</p>}</div>
                      <div className="text-right mr-4"><div className="text-xs text-muted-foreground">Credibility</div><div className="font-bold">{(s.credibility_score * 100).toFixed(0)}%</div></div>
                      <Button variant="ghost" size="icon" onClick={() => deleteTwitter(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div></CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* YouTube */}
            <TabsContent value="youtube" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <div><h2 className="text-2xl font-black">YouTube Channels</h2><p className="text-muted-foreground">Video content sources</p></div>
                <Dialog open={addYoutubeOpen} onOpenChange={setAddYoutubeOpen}>
                  <DialogTrigger asChild><Button className="gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Plus className="h-4 w-4" />Add Channel</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-black">Add YouTube Channel</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label className="font-bold">Channel Name *</Label><Input placeholder="Name" value={newYoutube.channelName} onChange={(e) => setNewYoutube({ ...newYoutube, channelName: e.target.value })} className="border-2" /></div>
                      <div className="space-y-2"><Label className="font-bold">Handle/URL</Label><Input placeholder="@channel" value={newYoutube.channelUrl} onChange={(e) => setNewYoutube({ ...newYoutube, channelUrl: e.target.value })} className="border-2" /></div>
                      <div className="space-y-2"><Label className="font-bold">Description</Label><Input placeholder="Content type" value={newYoutube.description} onChange={(e) => setNewYoutube({ ...newYoutube, description: e.target.value })} className="border-2" /></div>
                      <div className="space-y-2"><Label className="font-bold">Notes</Label><Textarea placeholder="Notes..." rows={2} value={newYoutube.notes} onChange={(e) => setNewYoutube({ ...newYoutube, notes: e.target.value })} className="border-2" /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setAddYoutubeOpen(false)}>Cancel</Button><Button onClick={handleAddYoutube}>Add</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="grid gap-3">
                {youtubeSources.length === 0 ? <Card className="border-2 border-dashed"><CardContent className="p-12 text-center"><Youtube className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-muted-foreground">No YouTube channels</p></CardContent></Card> : youtubeSources.map(c => (
                  <Card key={c.id} className="border-2 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <CardContent className="p-4"><div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2"><AvatarFallback className="bg-red-100 text-red-800 font-black">{c.channel_name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="flex-1"><div className="flex items-center gap-2"><span className="font-bold text-lg">{c.channel_name}</span>{getStatusBadge(c.status)}</div>{c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}{c.notes && <p className="text-xs text-muted-foreground mt-1 italic">Note: {c.notes}</p>}</div>
                      <Button variant="ghost" size="icon" onClick={() => deleteYoutube(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div></CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* RSS */}
            <TabsContent value="rss" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <div><h2 className="text-2xl font-black">RSS Feeds</h2><p className="text-muted-foreground">News and blog sources</p></div>
                <div className="flex gap-2">
                  <Dialog open={discoverRssOpen} onOpenChange={setDiscoverRssOpen}>
                    <DialogTrigger asChild><Button variant="outline" onClick={openRssDiscovery} className="gap-2 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Sparkles className="h-4 w-4" />Discover Feeds</Button></DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-black flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" />Discover RSS Feeds</DialogTitle>
                        <DialogDescription>Use AI to find RSS feeds for your niche. Powered by Perplexity Sonar.</DialogDescription>
                      </DialogHeader>
                      {!rssDiscoveryStatus?.configured ? (
                        <div className="py-8 text-center">
                          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                          <p className="font-bold mb-2">Perplexity API Key Required</p>
                          <p className="text-muted-foreground mb-4">Go to Settings &gt; API Keys to add your Perplexity API key.</p>
                          <Button variant="outline" onClick={() => window.location.href = '/settings/api-keys'}>Configure API Keys</Button>
                        </div>
                      ) : rssDiscoveryStatus?.credits_remaining <= 0 ? (
                        <div className="py-8 text-center">
                          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                          <p className="font-bold mb-2">No Credits Remaining</p>
                          <p className="text-muted-foreground">You've used all 5 Perplexity credits this month. Credits reset on the 1st.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 py-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Perplexity Credits</span>
                            <Badge variant="secondary">{rssDiscoveryStatus.credits_remaining}/5 remaining</Badge>
                          </div>
                          <div className="space-y-2">
                            <Label className="font-bold">Niche/Topic *</Label>
                            <Input placeholder="e.g., battle rap, tech news, crypto" value={rssDiscoveryNiche} onChange={(e) => setRssDiscoveryNiche(e.target.value)} className="border-2" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-bold">Keywords (optional)</Label>
                            <Input placeholder="e.g., URL, KOTD, battles" value={rssDiscoveryKeywords} onChange={(e) => setRssDiscoveryKeywords(e.target.value)} className="border-2" />
                            <p className="text-xs text-muted-foreground">Comma-separated keywords to focus the search</p>
                          </div>
                          <Button onClick={handleDiscoverRss} disabled={discoveringRss || !rssDiscoveryNiche} className="w-full gap-2">
                            {discoveringRss ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {discoveringRss ? 'Discovering...' : 'Discover Feeds'}
                          </Button>
                          {discoveredFeeds.length > 0 && (
                            <div className="space-y-3 mt-4">
                              <div className="flex items-center justify-between">
                                <Label className="font-bold">Discovered Feeds ({discoveredFeeds.length})</Label>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedDiscoveredFeeds(new Set(discoveredFeeds.map((_, i) => i)))}>Select All</Button>
                              </div>
                              <div className="max-h-64 overflow-y-auto space-y-2">
                                {discoveredFeeds.map((feed, index) => (
                                  <div key={index} onClick={() => toggleDiscoveredFeed(index)} className={`p-3 border-2 cursor-pointer transition-all ${selectedDiscoveredFeeds.has(index) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                                    <div className="flex items-start gap-3">
                                      <input type="checkbox" checked={selectedDiscoveredFeeds.has(index)} onChange={() => {}} className="mt-1" />
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold">{feed.site_name}</span>
                                          <Badge variant="secondary" size="sm">{feed.category}</Badge>
                                        </div>
                                        {feed.description && <p className="text-sm text-muted-foreground mt-1">{feed.description}</p>}
                                        <p className="text-xs text-muted-foreground mt-1 truncate">{feed.feed_url}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDiscoverRssOpen(false)}>Cancel</Button>
                        {discoveredFeeds.length > 0 && selectedDiscoveredFeeds.size > 0 && (
                          <Button onClick={handleAddDiscoveredFeeds} disabled={addingDiscoveredFeeds}>
                            {addingDiscoveredFeeds ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Add {selectedDiscoveredFeeds.size} Feed{selectedDiscoveredFeeds.size !== 1 ? 's' : ''}
                          </Button>
                        )}
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={addWebsiteOpen} onOpenChange={setAddWebsiteOpen}>
                    <DialogTrigger asChild><Button className="gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Plus className="h-4 w-4" />Add Feed</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-black">Add RSS Feed</DialogTitle><DialogDescription>Most WordPress sites: /feed</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label className="font-bold">Site Name</Label><Input placeholder="Let's Talk Battle Rap" value={newWebsite.name} onChange={(e) => setNewWebsite({ ...newWebsite, name: e.target.value })} className="border-2" /></div>
                      <div className="space-y-2"><Label className="font-bold">Feed URL *</Label><Input placeholder="https://example.com/feed" value={newWebsite.feedUrl} onChange={(e) => setNewWebsite({ ...newWebsite, feedUrl: e.target.value })} className="border-2" /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setAddWebsiteOpen(false)}>Cancel</Button><Button onClick={handleAddWebsite}>Add</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="grid gap-3">
                {rssFeeds.length === 0 ? <Card className="border-2 border-dashed"><CardContent className="p-12 text-center"><Rss className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-muted-foreground">No RSS feeds</p></CardContent></Card> : rssFeeds.map(f => (
                  <Card key={f.id} className="border-2 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <CardContent className="p-4"><div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 border-2 border-green-400"><Rss className="h-6 w-6 text-green-700" /></div>
                      <div className="flex-1"><div className="flex items-center gap-2"><span className="font-bold text-lg">{f.name}</span>{getStatusBadge(f.status)}</div><p className="text-sm text-muted-foreground truncate">{f.feed_url}</p></div>
                      <Button variant="ghost" size="icon" onClick={() => deleteRss(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div></CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Entities */}
            <TabsContent value="entities" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <div><h2 className="text-2xl font-black">Known Entities</h2><p className="text-muted-foreground">People, orgs, events</p></div>
                <Dialog open={addEntityOpen} onOpenChange={setAddEntityOpen}>
                  <DialogTrigger asChild><Button className="gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Plus className="h-4 w-4" />Add Entity</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-black">Add Entity</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label className="font-bold">Name *</Label><Input placeholder="Geechi Gotti" value={newEntity.name} onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })} className="border-2" /></div>
                      <div className="space-y-2"><Label className="font-bold">Type</Label><Select value={newEntity.type} onValueChange={(v) => setNewEntity({ ...newEntity, type: v })}><SelectTrigger className="border-2"><SelectValue /></SelectTrigger><SelectContent>{entityTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label className="font-bold">Description</Label><Textarea placeholder="Who is this?" rows={2} value={newEntity.description} onChange={(e) => setNewEntity({ ...newEntity, description: e.target.value })} className="border-2" /></div>
                      <div className="space-y-2"><Label className="font-bold">Aliases</Label><Input placeholder="Geechi, @GeechiGotti" value={newEntity.aliases} onChange={(e) => setNewEntity({ ...newEntity, aliases: e.target.value })} className="border-2" /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setAddEntityOpen(false)}>Cancel</Button><Button onClick={handleAddEntity}>Add</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {entityTypeOptions.map(o => {
                  const count = entities.filter(e => e.entity_type === o.value).length
                  return <Button key={o.value} variant="outline" size="sm" className="gap-2 border-2"><o.icon className="h-4 w-4" />{o.label} <Badge variant="secondary" size="sm">{count}</Badge></Button>
                })}
              </div>
              <div className="grid gap-3">
                {entities.length === 0 ? <Card className="border-2 border-dashed"><CardContent className="p-12 text-center"><Users className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-muted-foreground">No entities</p></CardContent></Card> : entities.map(e => {
                  const Icon = entityTypeOptions.find(o => o.value === e.entity_type)?.icon || Users
                  const isExp = expandedEntities.has(e.id)
                  const colors: Record<string, string> = { person: 'bg-purple-100 border-purple-400', organization: 'bg-blue-100 border-blue-400', event: 'bg-orange-100 border-orange-400', venue: 'bg-green-100 border-green-400' }
                  return (
                    <Card key={e.id} className="border-2 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => toggleEntity(e.id)}>
                          <div className={`p-3 border-2 ${colors[e.entity_type] || 'bg-gray-100 border-gray-400'}`}><Icon className="h-6 w-6" /></div>
                          <div className="flex-1"><div className="flex items-center gap-2"><span className="font-bold text-lg">{e.canonical_name}</span><Badge variant="secondary" size="sm">{e.entity_type}</Badge>{e.aliases?.length > 0 && <span className="text-xs text-muted-foreground">+{e.aliases.length} aliases</span>}</div><p className="text-sm text-muted-foreground">{e.description}</p></div>
                          <div className="flex items-center gap-2">{isExp ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}<Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); deleteEntity(e.id) }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                        </div>
                        {isExp && <div className="px-4 pb-4 border-t-2 bg-muted/30"><div className="mt-3"><Label className="text-xs text-muted-foreground font-bold">ALIASES</Label><div className="flex flex-wrap gap-2 mt-2">{e.aliases?.length > 0 ? e.aliases.map((a, i) => <Badge key={i} variant="outline" className="border-2">{a}</Badge>) : <span className="text-sm text-muted-foreground">None</span>}<Button variant="ghost" size="sm" className="h-6 px-2 text-xs"><Plus className="h-3 w-3 mr-1" />Add</Button></div></div></div>}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  )
}
