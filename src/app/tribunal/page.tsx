'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Twitter,
  Youtube,
  Globe,
  TrendingUp,
  MessageSquare,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { formatNumber, formatRelativeTime } from '@/lib/utils'

interface Nomination {
  id: string
  topic_id: string
  platform: 'twitter' | 'youtube' | 'website'
  identifier: string
  discovered_via: string | null
  discovery_context: string | null
  preliminary_score: number
  status: 'pending' | 'approved' | 'rejected' | 'deferred'
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

export default function TribunalPage() {
  const [activeTab, setActiveTab] = useState('pending')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedNomination, setSelectedNomination] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [nominations, setNominations] = useState<Nomination[]>([])
  const [approvedSources, setApprovedSources] = useState<Nomination[]>([])
  const [rejectedSources, setRejectedSources] = useState<Nomination[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchNominations = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch('/api/nominations?status=pending'),
        fetch('/api/nominations?status=approved'),
        fetch('/api/nominations?status=rejected'),
      ])

      const [pending, approved, rejected] = await Promise.all([
        pendingRes.json(),
        approvedRes.json(),
        rejectedRes.json(),
      ])

      setNominations(Array.isArray(pending) ? pending : [])
      setApprovedSources(Array.isArray(approved) ? approved : [])
      setRejectedSources(Array.isArray(rejected) ? rejected : [])
    } catch (error) {
      console.error('Error fetching nominations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNominations()
  }, [fetchNominations])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      const response = await fetch(`/api/nominations/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (response.ok) {
        await fetchNominations()
      }
    } catch (error) {
      console.error('Error approving nomination:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = (id: string) => {
    setSelectedNomination(id)
    setRejectDialogOpen(true)
  }

  const submitReject = async () => {
    if (!selectedNomination) return
    setActionLoading(selectedNomination)
    try {
      const response = await fetch(`/api/nominations/${selectedNomination}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      })
      if (response.ok) {
        setRejectDialogOpen(false)
        setRejectReason('')
        setSelectedNomination(null)
        await fetchNominations()
      }
    } catch (error) {
      console.error('Error rejecting nomination:', error)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <AppShell topicName="Battle Rap">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              TRIBUNAL
            </h1>
            <p className="text-muted-foreground">
              Review and approve nominated sources discovered by the pipeline
            </p>
          </div>
          <Button variant="outline" onClick={fetchNominations} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="font-head text-3xl">{nominations.length}</p>
                </div>
                <Clock className="h-8 w-8 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="font-head text-3xl text-success">
                    {approvedSources.length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="font-head text-3xl text-destructive">
                    {rejectedSources.length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approval Rate</p>
                  <p className="font-head text-3xl">
                    {(
                      (approvedSources.length /
                        (approvedSources.length + rejectedSources.length)) *
                      100
                    ).toFixed(0)}
                    %
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending ({nominations.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved ({approvedSources.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              Rejected ({rejectedSources.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="space-y-4">
              {!loading && nominations.map((nom) => (
                <Card key={nom.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Platform Icon */}
                      <div className="p-3 border-2 border-foreground bg-muted">
                        {nom.platform === 'twitter' ? (
                          <Twitter className="h-6 w-6" />
                        ) : nom.platform === 'youtube' ? (
                          <Youtube className="h-6 w-6" />
                        ) : (
                          <Globe className="h-6 w-6" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg">
                            {nom.identifier}
                          </span>
                          <Badge variant="outline">{nom.platform}</Badge>
                        </div>

                        {(nom.discovered_via || nom.discovery_context) && (
                          <div className="p-2 bg-muted border-2 border-foreground mb-2">
                            {nom.discovered_via && (
                              <p className="text-sm font-medium">
                                Discovered via: {nom.discovered_via}
                              </p>
                            )}
                            {nom.discovery_context && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {nom.discovery_context}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatRelativeTime(new Date(nom.created_at))}
                          </span>
                        </div>
                      </div>

                      {/* Score & Actions */}
                      <div className="text-right space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Preliminary Score
                          </p>
                          <div
                            className={`font-head text-2xl ${
                              nom.preliminary_score >= 0.7
                                ? 'text-success'
                                : nom.preliminary_score >= 0.5
                                ? 'text-warning'
                                : 'text-destructive'
                            }`}
                          >
                            {(nom.preliminary_score * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(nom.id)}
                            disabled={actionLoading === nom.id}
                          >
                            <ThumbsDown className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-success hover:bg-success/90"
                            onClick={() => handleApprove(nom.id)}
                            disabled={actionLoading === nom.id}
                          >
                            {actionLoading === nom.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <ThumbsUp className="h-4 w-4 mr-1" />
                            )}
                            Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" />
                  <p>Loading nominations...</p>
                </div>
              )}

              {!loading && nominations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending nominations</p>
                  <p className="text-sm mt-2">
                    Sources will appear here when discovered by the pipeline
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            <Card>
              <CardContent className="p-4">
                {approvedSources.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No approved sources yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvedSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 border-2 border-foreground"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-success" />
                          <div>
                            <span className="font-semibold">{source.identifier}</span>
                            <Badge variant="outline" className="ml-2">{source.platform}</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {source.reviewed_at
                            ? `Approved ${formatRelativeTime(new Date(source.reviewed_at))}`
                            : 'Approved'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            <Card>
              <CardContent className="p-4">
                {rejectedSources.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No rejected sources</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rejectedSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 border-2 border-foreground"
                      >
                        <div className="flex items-center gap-3">
                          <XCircle className="h-5 w-5 text-destructive" />
                          <div>
                            <span className="font-semibold">{source.identifier}</span>
                            <Badge variant="outline" className="ml-2">{source.platform}</Badge>
                            {source.rejection_reason && (
                              <p className="text-sm text-muted-foreground">
                                Reason: {source.rejection_reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {source.reviewed_at
                            ? `Rejected ${formatRelativeTime(new Date(source.reviewed_at))}`
                            : 'Rejected'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Nomination</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this source nomination.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={submitReject}
                disabled={actionLoading !== null}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Reject Source
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
