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
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Loader2,
  Eye,
  Copy,
  Star,
  Newspaper,
  BookOpen,
  Zap,
  Info,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface ShowTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  template_type: 'daily' | 'narrative' | 'breaking'
  intro_template: string
  story_template: string
  outro_template: string
  twitter_digest_template: string | null
  default_story_count: number
  default_hours_back: number
  max_duration_minutes: number
  style_tone: string
  include_twitter_digest: boolean
  include_cta: boolean
  preferred_host_slug: string | null
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

// ============================================
// PLACEHOLDER REFERENCE
// ============================================

const PLACEHOLDERS = [
  { key: 'show_name', desc: 'Name of the show' },
  { key: 'date', desc: 'Formatted date' },
  { key: 'topic_count', desc: 'Number of stories' },
  { key: 'host_name', desc: 'Selected host name' },
  { key: 'host_opening', desc: 'Host intro style' },
  { key: 'host_closing', desc: 'Host sign-off' },
  { key: 'headline', desc: 'Story headline' },
  { key: 'story_body', desc: 'Story content' },
  { key: 'transition', desc: 'Transition phrase' },
  { key: 'twitter_trending', desc: 'Twitter trends' },
  { key: 'twitter_reaction', desc: 'Tweet quotes' },
  { key: 'call_to_action', desc: 'CTA text' },
]

// ============================================
// TEMPLATE EDITOR COMPONENT
// ============================================

function TemplateEditor({
  template,
  onSave,
  onCancel,
  isNew = false
}: {
  template?: ShowTemplate
  onSave: (data: Partial<ShowTemplate>) => Promise<void>
  onCancel: () => void
  isNew?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    template_type: template?.template_type || 'daily',
    intro_template: template?.intro_template || 'What\'s good everybody, welcome back to {show_name}! It\'s {date}.\nWe got {topic_count} stories today. Let\'s get into it.',
    story_template: template?.story_template || '{transition}\n\n{headline}\n\n{story_body}\n\n{twitter_reaction}',
    outro_template: template?.outro_template || 'That\'s all for today\'s {show_name}.\n{host_closing}',
    twitter_digest_template: template?.twitter_digest_template || 'Let\'s see what\'s popping on Twitter.\n{twitter_trending}',
    default_story_count: template?.default_story_count || 3,
    default_hours_back: template?.default_hours_back || 24,
    style_tone: template?.style_tone || 'engaging',
    include_twitter_digest: template?.include_twitter_digest ?? true,
    is_active: template?.is_active ?? true,
    is_default: template?.is_default ?? false,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Template Name</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Battle Rap Daily"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <Select
            value={formData.template_type}
            onValueChange={(value) => setFormData({ ...formData, template_type: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily News</SelectItem>
              <SelectItem value="narrative">Narrative Story</SelectItem>
              <SelectItem value="breaking">Breaking News</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this template"
        />
      </div>

      {/* Templates */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Intro Template
            <span className="text-muted-foreground ml-2 font-normal">Opening of the show</span>
          </label>
          <Textarea
            value={formData.intro_template}
            onChange={(e) => setFormData({ ...formData, intro_template: e.target.value })}
            rows={4}
            className="font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Story Template
            <span className="text-muted-foreground ml-2 font-normal">Format for each story</span>
          </label>
          <Textarea
            value={formData.story_template}
            onChange={(e) => setFormData({ ...formData, story_template: e.target.value })}
            rows={4}
            className="font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Outro Template
            <span className="text-muted-foreground ml-2 font-normal">Closing of the show</span>
          </label>
          <Textarea
            value={formData.outro_template}
            onChange={(e) => setFormData({ ...formData, outro_template: e.target.value })}
            rows={3}
            className="font-mono text-sm"
          />
        </div>

        {formData.include_twitter_digest && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Twitter Digest Template
              <span className="text-muted-foreground ml-2 font-normal">Twitter section</span>
            </label>
            <Textarea
              value={formData.twitter_digest_template || ''}
              onChange={(e) => setFormData({ ...formData, twitter_digest_template: e.target.value })}
              rows={3}
              className="font-mono text-sm"
            />
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Stories per show</label>
          <Input
            type="number"
            value={formData.default_story_count}
            onChange={(e) => setFormData({ ...formData, default_story_count: parseInt(e.target.value) || 3 })}
            min={1}
            max={10}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hours lookback</label>
          <Input
            type="number"
            value={formData.default_hours_back}
            onChange={(e) => setFormData({ ...formData, default_hours_back: parseInt(e.target.value) || 24 })}
            min={1}
            max={168}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Style/Tone</label>
          <Select
            value={formData.style_tone}
            onValueChange={(value) => setFormData({ ...formData, style_tone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engaging">Engaging</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="hype">Hype</SelectItem>
              <SelectItem value="dramatic">Dramatic</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.include_twitter_digest}
            onChange={(e) => setFormData({ ...formData, include_twitter_digest: e.target.checked })}
            className="h-4 w-4"
          />
          Include Twitter digest
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_default}
            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
            className="h-4 w-4"
          />
          Set as default
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isNew ? 'Create Template' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ShowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<ShowTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showPlaceholders, setShowPlaceholders] = useState(false)

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (data: Partial<ShowTemplate>) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (res.ok) {
      setIsCreating(false)
      fetchTemplates()
    } else {
      const error = await res.json()
      alert(`Failed to create template: ${error.error}`)
    }
  }

  const handleUpdate = async (data: Partial<ShowTemplate>) => {
    if (!editingTemplate) return

    const res = await fetch(`/api/templates/${editingTemplate.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (res.ok) {
      setEditingTemplate(null)
      fetchTemplates()
    } else {
      const error = await res.json()
      alert(`Failed to update template: ${error.error}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    const res = await fetch(`/api/templates/${id}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      fetchTemplates()
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'daily': return <Newspaper className="h-5 w-5" />
      case 'narrative': return <BookOpen className="h-5 w-5" />
      case 'breaking': return <Zap className="h-5 w-5" />
      default: return <FileText className="h-5 w-5" />
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'daily': return <Badge variant="secondary">Daily News</Badge>
      case 'narrative': return <Badge variant="outline">Narrative</Badge>
      case 'breaking': return <Badge variant="destructive">Breaking</Badge>
      default: return <Badge>{type}</Badge>
    }
  }

  if (loading) {
    return (
      <AppShell topicName="Studio">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell topicName="Studio">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              Show Templates
            </h1>
            <p className="text-muted-foreground">
              Create and manage templates for different show types
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPlaceholders(true)}>
              <Info className="h-4 w-4 mr-2" />
              Placeholders
            </Button>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className={template.is_default ? 'border-primary' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(template.template_type)}
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  {template.is_default && (
                    <Star className="h-4 w-4 text-primary fill-primary" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getTypeBadge(template.template_type)}
                  <Badge variant="outline">{template.style_tone}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {template.description || 'No description'}
                </p>
                <div className="text-xs text-muted-foreground mb-4">
                  {template.default_story_count} stories | {template.default_hours_back}h lookback
                  {template.include_twitter_digest && ' | Twitter'}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {templates.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No templates yet. Create your first one!</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Create Dialog */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
            </DialogHeader>
            <TemplateEditor
              onSave={handleCreate}
              onCancel={() => setIsCreating(false)}
              isNew
            />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Template: {editingTemplate?.name}</DialogTitle>
            </DialogHeader>
            {editingTemplate && (
              <TemplateEditor
                template={editingTemplate}
                onSave={handleUpdate}
                onCancel={() => setEditingTemplate(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Placeholders Reference Dialog */}
        <Dialog open={showPlaceholders} onOpenChange={setShowPlaceholders}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Template Placeholders</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                Use these placeholders in your templates. They will be replaced with actual values when generating a show.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PLACEHOLDERS.map((p) => (
                  <div key={p.key} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <code className="text-xs bg-background px-1 py-0.5 rounded">{`{${p.key}}`}</code>
                    <span className="text-xs text-muted-foreground">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
