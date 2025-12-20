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
  Badge,
} from '@/components/ui'
import {
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Eye,
  RefreshCw,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface ExportRecord {
  id: string
  story_id: string
  story_headline: string
  destination: string
  status: string
  created_at: string
  version: number
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'acknowledged':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Acknowledged
        </Badge>
      )
    case 'sent':
      return (
        <Badge variant="primary" className="gap-1">
          <Send className="h-3 w-3" />
          Sent
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function SignalPage() {
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExports()
  }, [])

  const fetchExports = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exports')
      if (res.ok) {
        const data = await res.json()
        setExports(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch exports:', error)
    }
    setLoading(false)
  }

  const statusCounts = {
    acknowledged: exports.filter(e => e.status === 'acknowledged').length,
    pending: exports.filter(e => e.status === 'pending').length,
    failed: exports.filter(e => e.status === 'failed').length,
  }

  return (
    <AppShell topicName="Battle Rap">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Send className="h-8 w-8 text-primary" />
              SIGNAL
            </h1>
            <p className="text-muted-foreground">
              Export center - packages sent to Director's Palette and production systems
            </p>
          </div>
          <Button variant="outline" onClick={fetchExports} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Exports</p>
              <p className="font-head text-3xl">{loading ? '-' : exports.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Acknowledged</p>
              <p className="font-head text-3xl text-success">
                {loading ? '-' : statusCounts.acknowledged}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="font-head text-3xl text-warning">
                {loading ? '-' : statusCounts.pending}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="font-head text-3xl text-destructive">
                {loading ? '-' : statusCounts.failed}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Export List */}
        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>
              All story packages sent to production systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : exports.length === 0 ? (
              <div className="text-center py-16">
                <Send className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-bold mb-2">No Exports Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Export stories from the SANCTION workbench to see them here.
                </p>
                <Button onClick={() => window.location.href = '/sanction'}>
                  Go to SANCTION
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {exports.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center gap-4 p-4 border-2 border-foreground hover:bg-muted transition-colors"
                  >
                    <div className="p-3 border-2 border-foreground bg-muted">
                      <Send className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{exp.story_headline || 'Untitled Export'}</h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span>
                          Destination:{' '}
                          {exp.destination === 'both'
                            ? "Director's Palette + Voice"
                            : exp.destination || "Director's Palette"}
                        </span>
                        <span>Version {exp.version || 1}</span>
                        {exp.created_at && <span>{formatRelativeTime(new Date(exp.created_at))}</span>}
                      </div>
                    </div>
                    {getStatusBadge(exp.status)}
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Preview package">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Download JSON">
                        <Download className="h-4 w-4" />
                      </Button>
                      {exp.status === 'failed' && (
                        <Button variant="ghost" size="icon" title="Retry">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
