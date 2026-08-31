'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Key,
  Check,
  X,
  AlertCircle,
  Loader2,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Twitter,
  Mic,
  Brain,
  RefreshCw,
  Shield,
  Database,
  Server,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// TYPES
// ============================================

interface APIKeyStatus {
  service: string
  displayName: string
  description: string
  configured: boolean
  source: 'database' | 'environment' | 'none'
  lastVerified?: string
  verificationStatus: 'pending' | 'valid' | 'invalid' | 'not_configured'
  masked?: string
  docsUrl?: string
  placeholder?: string
}

// ============================================
// SERVICE ICONS
// ============================================

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  perplexity: <Search className="h-5 w-5" />,
  twitter: <Twitter className="h-5 w-5" />,
  openai: <Brain className="h-5 w-5" />,
  anthropic: <Brain className="h-5 w-5" />,
}

const SERVICE_COLORS: Record<string, string> = {
  perplexity: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  twitter: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  openai: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  anthropic: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
}

// ============================================
// COMPONENT
// ============================================

export default function APIKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKeyStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [editingService, setEditingService] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const fetchApiKeys = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.apiKeys || [])
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const handleSaveKey = async (service: string) => {
    if (!newKey.trim()) {
      toast.error('Please enter an API key')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, apiKey: newKey.trim() }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        setEditingService(null)
        setNewKey('')
        fetchApiKeys()
      } else {
        toast.error(data.error || 'Failed to save API key')
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      toast.error('Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const handleVerifyKey = async (service: string) => {
    if (!newKey.trim()) {
      toast.error('Please enter an API key')
      return
    }

    setVerifying(true)
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, apiKey: newKey.trim() }),
      })

      const data = await response.json()

      if (data.valid) {
        toast.success('API key is valid!')
      } else {
        toast.error('API key verification failed')
      }
    } catch (error) {
      console.error('Error verifying API key:', error)
      toast.error('Failed to verify API key')
    } finally {
      setVerifying(false)
    }
  }

  const handleDeleteKey = async (service: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return
    }

    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        fetchApiKeys()
      } else {
        toast.error(data.error || 'Failed to delete API key')
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast.error('Failed to delete API key')
    }
  }

  const startEditing = (service: string) => {
    setEditingService(service)
    setNewKey('')
    setShowKey(false)
  }

  const cancelEditing = () => {
    setEditingService(null)
    setNewKey('')
    setShowKey(false)
  }

  const getStatusBadge = (status: APIKeyStatus) => {
    if (!status.configured) {
      return <Badge variant="outline" className="text-muted-foreground">Not Configured</Badge>
    }

    switch (status.verificationStatus) {
      case 'valid':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><Check className="h-3 w-3 mr-1" />Valid</Badge>
      case 'invalid':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><X className="h-3 w-3 mr-1" />Invalid</Badge>
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'database':
        return <span title="Stored in database"><Database className="h-4 w-4" /></span>
      case 'environment':
        return <span title="From environment variable"><Server className="h-4 w-4" /></span>
      default:
        return null
    }
  }

  return (
    <AppShell topicName="Settings">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Key className="h-8 w-8 text-primary" />
              API KEYS
            </h1>
            <p className="text-muted-foreground">
              Manage API keys for external services
            </p>
          </div>
          <Button onClick={fetchApiKeys} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Security Notice */}
        <Card className="border-2 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700">Security Note</p>
                <p className="text-sm text-muted-foreground">
                  API keys are stored securely in the database. Keys from environment variables take precedence and cannot be edited here.
                  For production, consider using encrypted storage or a secrets manager.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys List */}
        <div className="space-y-4">
          {loading ? (
            <Card className="border-2">
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading API keys...</p>
              </CardContent>
            </Card>
          ) : (
            apiKeys.map((keyStatus) => (
              <Card key={keyStatus.service} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg border ${SERVICE_COLORS[keyStatus.service] || 'bg-gray-100'}`}>
                        {SERVICE_ICONS[keyStatus.service] || <Key className="h-5 w-5" />}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{keyStatus.displayName}</CardTitle>
                        <CardDescription>{keyStatus.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(keyStatus)}
                      {keyStatus.configured && getSourceIcon(keyStatus.source)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingService === keyStatus.service ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showKey ? 'text' : 'password'}
                              value={newKey}
                              onChange={(e) => setNewKey(e.target.value)}
                              placeholder={keyStatus.placeholder || 'Enter API key'}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKey(!showKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerifyKey(keyStatus.service)}
                            disabled={verifying || !newKey.trim()}
                          >
                            {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Test Key
                          </Button>
                          {keyStatus.docsUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(keyStatus.docsUrl, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Docs
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelEditing}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveKey(keyStatus.service)}
                            disabled={saving || !newKey.trim()}
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Save Key
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center justify-between">
                      <div>
                        {keyStatus.configured ? (
                          <div className="space-y-1">
                            <p className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                              {keyStatus.masked}
                            </p>
                            {keyStatus.lastVerified && (
                              <p className="text-xs text-muted-foreground">
                                Last verified: {new Date(keyStatus.lastVerified).toLocaleDateString()}
                              </p>
                            )}
                            {keyStatus.source === 'environment' && (
                              <p className="text-xs text-muted-foreground">
                                Set via environment variable (read-only)
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            No API key configured. Add one to enable this service.
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {keyStatus.configured && keyStatus.source === 'database' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteKey(keyStatus.service)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {keyStatus.source !== 'environment' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(keyStatus.service)}
                          >
                            <Key className="h-4 w-4 mr-2" />
                            {keyStatus.configured ? 'Update Key' : 'Add Key'}
                          </Button>
                        )}
                        {keyStatus.docsUrl && !keyStatus.configured && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(keyStatus.docsUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Get API Key
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Help Section */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Perplexity:</strong> Get an API key from{' '}
              <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                perplexity.ai/settings/api
              </a>. Free tier includes 5 searches per month.
            </p>
            <p>
              <strong>Twitter (twitterapi.io):</strong> Sign up at{' '}
              <a href="https://twitterapi.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                twitterapi.io
              </a>. This is NOT the official Twitter API.
            </p>
            <p>
              <strong>OpenAI:</strong> Get your API key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                platform.openai.com/api-keys
              </a>.
            </p>
            <p>
              <strong>Anthropic:</strong> Get your API key from{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                console.anthropic.com
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
