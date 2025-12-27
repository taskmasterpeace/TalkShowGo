'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  PROMPT_REGISTRY,
  PROMPT_ROLES,
  getPromptsByRole,
  getPromptStats,
  type PromptDefinition,
  type PromptRole,
} from '@/lib/prompt-registry'
import PromptEditor from '@/components/prompt-editor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Eye,
  Edit2,
  Copy,
  FileCode,
  Info,
  Settings,
  Mic,
  Scissors,
  ClipboardList,
} from 'lucide-react'

// Role icons mapping
const ROLE_ICONS: Record<PromptRole, React.ReactNode> = {
  studio: <Settings className="h-4 w-4" />,
  producer: <ClipboardList className="h-4 w-4" />,
  host: <Mic className="h-4 w-4" />,
  editor: <Scissors className="h-4 w-4" />,
}

// Role colors
const ROLE_COLORS: Record<PromptRole, string> = {
  studio: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  producer: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  host: 'bg-green-500/10 text-green-500 border-green-500/20',
  editor: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
}

type EnrichedPrompt = PromptDefinition & {
  has_override: boolean
  override_version?: number
  override_notes?: string
}

export default function PromptsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<PromptRole | 'all'>('all')
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())
  const [viewingPrompt, setViewingPrompt] = useState<PromptDefinition | null>(null)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [enrichedPrompts, setEnrichedPrompts] = useState<EnrichedPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [customizedOnly, setCustomizedOnly] = useState(false)

  // Load enriched prompts from API
  useEffect(() => {
    loadEnrichedPrompts()
  }, [])

  async function loadEnrichedPrompts() {
    try {
      setLoading(true)
      const response = await fetch('/api/prompts')
      const data = await response.json()
      if (data.success) {
        setEnrichedPrompts(data.prompts)
      }
    } catch (error) {
      console.error('Failed to load prompts:', error)
      // Fallback to registry
      setEnrichedPrompts(
        PROMPT_REGISTRY.map(p => ({ ...p, has_override: false }))
      )
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (enrichedPrompts.length === 0) return getPromptStats()

    const byRole: Record<PromptRole, number> = {
      studio: 0,
      producer: 0,
      host: 0,
      editor: 0,
    }

    for (const prompt of enrichedPrompts) {
      byRole[prompt.role]++
    }

    return {
      total: enrichedPrompts.length,
      byRole,
      byCategory: {},
      editable: enrichedPrompts.filter(p => p.editable).length,
      customized: enrichedPrompts.filter(p => p.has_override).length,
    }
  }, [enrichedPrompts])

  // Filter prompts based on search and role
  const filteredPrompts = useMemo(() => {
    let prompts = enrichedPrompts

    if (selectedRole !== 'all') {
      prompts = prompts.filter(p => p.role === selectedRole)
    }

    if (customizedOnly) {
      prompts = prompts.filter(p => p.has_override)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      prompts = prompts.filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.template.toLowerCase().includes(query)
      )
    }

    return prompts
  }, [searchQuery, selectedRole, enrichedPrompts, customizedOnly])

  // Group prompts by category
  const promptsByCategory = useMemo(() => {
    const grouped: Record<string, PromptDefinition[]> = {}
    for (const prompt of filteredPrompts) {
      if (!grouped[prompt.category]) {
        grouped[prompt.category] = []
      }
      grouped[prompt.category].push(prompt)
    }
    return grouped
  }, [filteredPrompts])

  const togglePromptExpand = (id: string) => {
    const newExpanded = new Set(expandedPrompts)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedPrompts(newExpanded)
  }

  const copyPrompt = (prompt: PromptDefinition) => {
    navigator.clipboard.writeText(prompt.template)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PROMPT REGISTRY</h1>
          <p className="text-muted-foreground">
            All AI prompts that drive Talk Show Go, organized by role
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-1">
          {stats.total} Prompts
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {PROMPT_ROLES.map(({ role, label, icon }) => (
          <Card
            key={role}
            className={`cursor-pointer transition-all ${
              selectedRole === role ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedRole(selectedRole === role ? 'all' : role)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.byRole[role]} prompts
                    </p>
                  </div>
                </div>
                {ROLE_ICONS[role]}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts by name, description, or content..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={selectedRole}
          onValueChange={(v: PromptRole | 'all') => setSelectedRole(v)}
        >
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {PROMPT_ROLES.map(({ role, label, icon }) => (
              <SelectItem key={role} value={role}>
                {icon} {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={customizedOnly ? 'default' : 'outline'}
          onClick={() => setCustomizedOnly(!customizedOnly)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Customized Only {stats.customized > 0 && `(${stats.customized})`}
        </Button>
      </div>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredPrompts.length} of {stats.total} prompts
        {selectedRole !== 'all' && ` in ${selectedRole}`}
      </p>

      {/* Prompts by Category */}
      <div className="space-y-6">
        {Object.entries(promptsByCategory).map(([category, prompts]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-xl font-semibold border-b pb-2">{category}</h2>
            <div className="space-y-3">
              {prompts.map(prompt => (
                <Card key={prompt.id} className="overflow-hidden">
                  <Collapsible
                    open={expandedPrompts.has(prompt.id)}
                    onOpenChange={() => togglePromptExpand(prompt.id)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {expandedPrompts.has(prompt.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">
                                  {prompt.name}
                                </CardTitle>
                                <Badge
                                  variant="outline"
                                  className={ROLE_COLORS[prompt.role]}
                                >
                                  {prompt.role}
                                </Badge>
                                {prompt.editable && !prompt.has_override && (
                                  <Badge variant="secondary">Editable</Badge>
                                )}
                                {prompt.has_override && (
                                  <Badge variant="default" className="bg-blue-600">
                                    Custom v{prompt.override_version}
                                  </Badge>
                                )}
                              </div>
                              <CardDescription className="mt-1">
                                {prompt.description}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              v{prompt.version}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        {/* Variables */}
                        {prompt.variables.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                              <Info className="h-3 w-3" /> Variables
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {prompt.variables.map(v => (
                                <Badge
                                  key={v.name}
                                  variant={v.required ? 'default' : 'secondary'}
                                  className="font-mono text-xs"
                                >
                                  {'{'}
                                  {v.name}
                                  {'}'}
                                  {!v.required && ' (optional)'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Used In */}
                        {prompt.usedIn.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                              <FileCode className="h-3 w-3" /> Used In
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {prompt.usedIn.map(file => (
                                <Badge
                                  key={file}
                                  variant="outline"
                                  className="font-mono text-xs"
                                >
                                  {file}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Template Preview */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">
                            Prompt Template
                          </h4>
                          <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                            {prompt.template}
                          </pre>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingPrompt(prompt)}
                              >
                                <Eye className="h-4 w-4 mr-1" /> View Full
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  {prompt.name}
                                  <Badge className={ROLE_COLORS[prompt.role]}>
                                    {prompt.role}
                                  </Badge>
                                </DialogTitle>
                                <DialogDescription>
                                  {prompt.description}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                {/* Variables Section */}
                                {prompt.variables.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-2">
                                      Variables
                                    </h4>
                                    <div className="space-y-2">
                                      {prompt.variables.map(v => (
                                        <div
                                          key={v.name}
                                          className="flex items-start gap-2 text-sm"
                                        >
                                          <Badge
                                            variant="outline"
                                            className="font-mono"
                                          >
                                            {'{'}
                                            {v.name}
                                            {'}'}
                                          </Badge>
                                          <span className="text-muted-foreground">
                                            {v.description}
                                            {v.example && (
                                              <span className="ml-2 text-xs">
                                                (e.g., "{v.example}")
                                              </span>
                                            )}
                                          </span>
                                          {v.required && (
                                            <Badge variant="destructive" className="text-xs">
                                              Required
                                            </Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Full Template */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold">
                                      Full Template
                                    </h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyPrompt(prompt)}
                                    >
                                      <Copy className="h-4 w-4 mr-1" /> Copy
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={prompt.template}
                                    readOnly
                                    className="font-mono text-sm min-h-[300px]"
                                  />
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyPrompt(prompt)}
                          >
                            <Copy className="h-4 w-4 mr-1" /> Copy
                          </Button>

                          {prompt.editable && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPromptId(prompt.id)}
                            >
                              <Edit2 className="h-4 w-4 mr-1" /> Edit
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredPrompts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No prompts found matching your search.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('')
              setSelectedRole('all')
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Prompt Editor Modal */}
      {editingPromptId && (
        <PromptEditor
          promptId={editingPromptId}
          onClose={() => setEditingPromptId(null)}
          onSave={() => {
            setEditingPromptId(null)
            loadEnrichedPrompts()
          }}
        />
      )}
    </div>
  )
}
