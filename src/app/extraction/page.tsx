'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui'
import {
  Network,
  User,
  MapPin,
  Calendar,
  Building,
  Package,
  Search,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  ExternalLink,
  Twitter,
  Loader2,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Minus,
  HelpCircle,
} from 'lucide-react'
import { formatNumber, formatRelativeTime } from '@/lib/utils'

interface EntityMention {
  sentiment: string
  context: string | null
  tweet: {
    text: string
    author: string
    date: string
    likes: number
  } | null
}

interface Entity {
  id: string
  canonical_name: string
  entity_type: string
  description: string | null
  mention_count: number
  first_seen: string
  last_mentioned: string
  notes: string | null
  aliases: string[]
  overallSentiment?: string
  sentimentBreakdown?: {
    positive: number
    negative: number
    neutral: number
    mixed: number
  }
  recentMentions?: EntityMention[]
}

interface Claim {
  id: string
  claim_text: string
  claim_type: string
  mention_count: number
  first_seen: string
  status: string
  confidence_score: number | null
}

const getEntityIcon = (type: string) => {
  switch (type) {
    case 'person':
      return User
    case 'organization':
      return Building
    case 'place':
      return MapPin
    case 'event':
      return Calendar
    default:
      return Package
  }
}

const getSentimentIcon = (sentiment: string) => {
  switch (sentiment) {
    case 'positive':
      return ThumbsUp
    case 'negative':
      return ThumbsDown
    case 'mixed':
      return HelpCircle
    default:
      return Minus
  }
}

const getSentimentColor = (sentiment: string) => {
  switch (sentiment) {
    case 'positive':
      return 'success'
    case 'negative':
      return 'destructive'
    case 'mixed':
      return 'warning'
    default:
      return 'secondary'
  }
}

// TODO: Get from context or URL
const TOPIC_ID = 'battle-rap'

export default function ExtractionPage() {
  const [activeTab, setActiveTab] = useState('entities')
  const [searchQuery, setSearchQuery] = useState('')
  const [entities, setEntities] = useState<Entity[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch entities with context
      const entitiesRes = await fetch(`/api/topics/${TOPIC_ID}/entities?withContext=true`)
      if (entitiesRes.ok) {
        const entitiesData = await entitiesRes.json()
        setEntities(entitiesData)
      }

      // Fetch claims
      const claimsRes = await fetch(`/api/topics/${TOPIC_ID}/claims`)
      if (claimsRes.ok) {
        const claimsData = await claimsRes.json()
        setClaims(claimsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEntities = entities.filter(
    (e) =>
      e.canonical_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredClaims = claims.filter(
    (c) => c.claim_text.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const showEntityDetails = (entity: Entity) => {
    setSelectedEntity(entity)
    setDialogOpen(true)
  }

  return (
    <AppShell topicName="Battle Rap">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Network className="h-8 w-8 text-primary" />
              EXTRACTION
            </h1>
            <p className="text-muted-foreground">
              Entities and claims extracted from your intelligence sources
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Entities</p>
                  <p className="font-head text-2xl">{entities.length}</p>
                </div>
                <Network className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Claims</p>
                  <p className="font-head text-2xl">{claims.length}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Confirmed</p>
                  <p className="font-head text-2xl">
                    {claims.filter((c) => c.status === 'confirmed').length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Disputed</p>
                  <p className="font-head text-2xl">
                    {claims.filter((c) => c.status === 'disputed').length}
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entities and claims..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin mr-3" />
              <span>Loading extraction data...</span>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="entities">
                Entities ({filteredEntities.length})
              </TabsTrigger>
              <TabsTrigger value="claims">Claims ({filteredClaims.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="entities" className="mt-4">
              {filteredEntities.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No entities found</p>
                    <p className="text-sm">Run the extraction pipeline to discover entities</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredEntities.map((entity) => {
                    const Icon = getEntityIcon(entity.entity_type)
                    const sentiment = entity.overallSentiment || 'neutral'
                    const SentimentIcon = getSentimentIcon(sentiment)

                    return (
                      <Card
                        key={entity.id}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => showEntityDetails(entity)}
                      >
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="p-3 border-2 border-foreground bg-muted">
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-lg">
                                  {entity.canonical_name}
                                </span>
                                <Badge
                                  variant={getSentimentColor(sentiment) as any}
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <SentimentIcon className="h-3 w-3" />
                                  {sentiment}
                                </Badge>
                              </div>
                              {entity.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {entity.description}
                                </p>
                              )}

                              {/* Sentiment Breakdown */}
                              {entity.sentimentBreakdown && (
                                <div className="flex gap-2 mb-2 text-xs">
                                  {entity.sentimentBreakdown.positive > 0 && (
                                    <span className="text-success flex items-center gap-1">
                                      <ThumbsUp className="h-3 w-3" />
                                      {entity.sentimentBreakdown.positive}
                                    </span>
                                  )}
                                  {entity.sentimentBreakdown.negative > 0 && (
                                    <span className="text-destructive flex items-center gap-1">
                                      <ThumbsDown className="h-3 w-3" />
                                      {entity.sentimentBreakdown.negative}
                                    </span>
                                  )}
                                  {entity.sentimentBreakdown.neutral > 0 && (
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <Minus className="h-3 w-3" />
                                      {entity.sentimentBreakdown.neutral}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Recent Mention Preview */}
                              {entity.recentMentions && entity.recentMentions.length > 0 && (
                                <div className="p-2 bg-muted/50 border border-foreground/10 mb-2 text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                    <Twitter className="h-3 w-3" />
                                    Recent mention:
                                  </div>
                                  <p className="line-clamp-2">
                                    {entity.recentMentions[0].tweet?.text ||
                                      entity.recentMentions[0].context ||
                                      'No context available'}
                                  </p>
                                </div>
                              )}

                              {entity.aliases && entity.aliases.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {entity.aliases.slice(0, 3).map((alias) => (
                                    <Badge key={alias} variant="outline" size="sm">
                                      {alias}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {entity.notes && (
                                <p className="text-xs text-muted-foreground italic">
                                  Note: {entity.notes}
                                </p>
                              )}
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>
                                  <strong>{entity.mention_count || 0}</strong> mentions
                                </span>
                                {entity.last_mentioned && (
                                  <span>
                                    Last: {formatRelativeTime(new Date(entity.last_mentioned))}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="claims" className="mt-4">
              {filteredClaims.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No claims found</p>
                    <p className="text-sm">Run the extraction pipeline to discover claims</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredClaims.map((claim) => (
                    <Card key={claim.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={
                                  claim.status === 'confirmed'
                                    ? 'success'
                                    : claim.status === 'emerging'
                                    ? 'primary'
                                    : claim.status === 'disputed'
                                    ? 'destructive'
                                    : 'warning'
                                }
                              >
                                {claim.status?.toUpperCase() || 'UNKNOWN'}
                              </Badge>
                              <Badge variant="outline" size="sm">
                                {claim.claim_type}
                              </Badge>
                            </div>
                            <p className="font-medium mb-2">{claim.claim_text}</p>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span>
                                <strong>{claim.mention_count || 0}</strong> mentions
                              </span>
                              {claim.confidence_score !== null && (
                                <span>
                                  Confidence:{' '}
                                  <strong
                                    className={
                                      claim.confidence_score > 0.7
                                        ? 'text-success'
                                        : claim.confidence_score > 0.4
                                        ? 'text-warning'
                                        : 'text-destructive'
                                    }
                                  >
                                    {(claim.confidence_score * 100).toFixed(0)}%
                                  </strong>
                                </span>
                              )}
                              {claim.first_seen && (
                                <span>
                                  First seen: {formatRelativeTime(new Date(claim.first_seen))}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Entity Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedEntity && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {(() => {
                      const Icon = getEntityIcon(selectedEntity.entity_type)
                      return <Icon className="h-5 w-5" />
                    })()}
                    {selectedEntity.canonical_name}
                    <Badge
                      variant={getSentimentColor(selectedEntity.overallSentiment || 'neutral') as any}
                      size="sm"
                    >
                      {selectedEntity.overallSentiment || 'neutral'}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>
                    {selectedEntity.description || `${selectedEntity.entity_type} in Battle Rap`}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Sentiment Breakdown */}
                  {selectedEntity.sentimentBreakdown && (
                    <div>
                      <h4 className="font-semibold mb-2">Sentiment Breakdown</h4>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="p-2 border-2 text-center bg-success/10 border-success">
                          <p className="font-head text-xl text-success">
                            {selectedEntity.sentimentBreakdown.positive}
                          </p>
                          <p className="text-xs">Positive</p>
                        </div>
                        <div className="p-2 border-2 text-center bg-destructive/10 border-destructive">
                          <p className="font-head text-xl text-destructive">
                            {selectedEntity.sentimentBreakdown.negative}
                          </p>
                          <p className="text-xs">Negative</p>
                        </div>
                        <div className="p-2 border-2 text-center bg-muted border-foreground/20">
                          <p className="font-head text-xl">
                            {selectedEntity.sentimentBreakdown.neutral}
                          </p>
                          <p className="text-xs">Neutral</p>
                        </div>
                        <div className="p-2 border-2 text-center bg-warning/10 border-warning">
                          <p className="font-head text-xl text-warning">
                            {selectedEntity.sentimentBreakdown.mixed}
                          </p>
                          <p className="text-xs">Mixed</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent Mentions - THE KEY PART FOR CONTEXT */}
                  <div>
                    <h4 className="font-semibold mb-2">Why This Sentiment?</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Here are the tweets that contributed to this entity's sentiment:
                    </p>

                    {selectedEntity.recentMentions && selectedEntity.recentMentions.length > 0 ? (
                      <div className="space-y-3">
                        {selectedEntity.recentMentions.map((mention, idx) => (
                          <div
                            key={idx}
                            className={`p-3 border-2 ${
                              mention.sentiment === 'positive'
                                ? 'border-success bg-success/5'
                                : mention.sentiment === 'negative'
                                ? 'border-destructive bg-destructive/5'
                                : 'border-foreground/20'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={getSentimentColor(mention.sentiment || 'neutral') as any}
                                size="sm"
                              >
                                {mention.sentiment || 'neutral'}
                              </Badge>
                              {mention.tweet && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Twitter className="h-3 w-3" />@{mention.tweet.author}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">
                              {mention.tweet?.text || mention.context || 'No context available'}
                            </p>
                            {mention.tweet && (
                              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                                <span>{mention.tweet.likes} likes</span>
                                {mention.tweet.date && (
                                  <span>{formatRelativeTime(new Date(mention.tweet.date))}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-dashed text-center text-muted-foreground">
                        <p>No tweet mentions found for this entity yet.</p>
                        <p className="text-sm">Run the extraction pipeline to analyze tweets.</p>
                      </div>
                    )}
                  </div>

                  {/* Aliases */}
                  {selectedEntity.aliases && selectedEntity.aliases.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Also Known As</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedEntity.aliases.map((alias) => (
                          <Badge key={alias} variant="outline">
                            {alias}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedEntity.notes && (
                    <div>
                      <h4 className="font-semibold mb-2">Notes</h4>
                      <p className="text-sm p-2 bg-muted border-2 border-foreground/10">
                        {selectedEntity.notes}
                      </p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex gap-4 text-sm text-muted-foreground border-t pt-4">
                    <span>
                      <strong>{selectedEntity.mention_count || 0}</strong> total mentions
                    </span>
                    {selectedEntity.first_seen && (
                      <span>
                        First seen: {formatRelativeTime(new Date(selectedEntity.first_seen))}
                      </span>
                    )}
                    {selectedEntity.last_mentioned && (
                      <span>
                        Last mentioned:{' '}
                        {formatRelativeTime(new Date(selectedEntity.last_mentioned))}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
