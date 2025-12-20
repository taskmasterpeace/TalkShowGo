'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Settings,
  Mic,
  FileText,
  Tv,
  Save,
  RotateCcw,
  ExternalLink,
  Info,
  Volume2,
  Check,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { SHOW_TYPES, SHOW_TYPE_COLORS, type ShowType } from '@/lib/show-types'
import { PROMPT_ROLES, getPromptStats } from '@/lib/prompt-registry'
import { HOSTS } from '@/lib/hosts/types'
import { HOST_VOICE_MAP } from '@/lib/elevenlabs'

interface VoiceSettings {
  voiceId: string
  voiceName: string
  modelId: string
  stability: number
  similarityBoost: number
  style: number
}

export default function StudioSettingsPage() {
  const [activeTab, setActiveTab] = useState('show-types')
  const [enabledShowTypes, setEnabledShowTypes] = useState<Set<string>>(
    new Set(Object.keys(SHOW_TYPES).filter(id => SHOW_TYPES[id].isEnabled))
  )
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceId: 'ZJ7BlVZrxZKBDMTIK5c9',
    voiceName: 'Battlerap Algorithm',
    modelId: 'eleven_turbo_v2_5',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.15,
  })
  const [hasChanges, setHasChanges] = useState(false)

  const promptStats = getPromptStats()

  const toggleShowType = (id: string) => {
    const newEnabled = new Set(enabledShowTypes)
    if (newEnabled.has(id)) {
      newEnabled.delete(id)
    } else {
      newEnabled.add(id)
    }
    setEnabledShowTypes(newEnabled)
    setHasChanges(true)
  }

  const handleSave = () => {
    // In a real app, this would save to the database
    console.log('Saving settings...', { enabledShowTypes: Array.from(enabledShowTypes), voiceSettings })
    setHasChanges(false)
  }

  const handleReset = () => {
    setEnabledShowTypes(new Set(Object.keys(SHOW_TYPES).filter(id => SHOW_TYPES[id].isEnabled)))
    setVoiceSettings({
      voiceId: 'ZJ7BlVZrxZKBDMTIK5c9',
      voiceName: 'Battlerap Algorithm',
      modelId: 'eleven_turbo_v2_5',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.15,
    })
    setHasChanges(false)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            STUDIO SETTINGS
          </h1>
          <p className="text-muted-foreground">
            Configure show types, voices, and global settings
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="show-types" className="flex items-center gap-2">
            <Tv className="h-4 w-4" />
            Show Types
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice Settings
          </TabsTrigger>
          <TabsTrigger value="hosts" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Hosts
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Prompts
          </TabsTrigger>
        </TabsList>

        {/* Show Types Tab */}
        <TabsContent value="show-types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Show Types</CardTitle>
              <CardDescription>
                Enable or disable show types for your workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.values(SHOW_TYPES).map(showType => {
                  const colors = SHOW_TYPE_COLORS[showType.id]
                  const isEnabled = enabledShowTypes.has(showType.id)

                  return (
                    <div
                      key={showType.id}
                      className={`border rounded-lg p-4 transition-all ${
                        isEnabled ? `${colors.border} ${colors.bg}` : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{showType.icon}</span>
                          <div>
                            <h3 className="font-semibold">{showType.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {showType.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleShowType(showType.id)}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {showType.defaultDurationMinutes} min
                        </Badge>
                        <Badge variant="outline">
                          {showType.storyCount.min}-{showType.storyCount.max} stories
                        </Badge>
                        <Badge variant="outline">
                          {showType.segments.length} segments
                        </Badge>
                        {showType.supportsMultiVoice && (
                          <Badge variant="secondary">Multi-voice</Badge>
                        )}
                        {showType.supportsTwitter && (
                          <Badge variant="secondary">Twitter</Badge>
                        )}
                        {showType.supportsDocuments && (
                          <Badge variant="secondary">Documents</Badge>
                        )}
                      </div>

                      <div className="mt-3 text-xs text-muted-foreground">
                        Recommended hosts: {showType.recommendedHosts.map(h => {
                          const host = HOSTS[h]
                          return host?.name || h
                        }).join(', ')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Settings Tab */}
        <TabsContent value="voice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Default Voice Settings</CardTitle>
              <CardDescription>
                Configure the default ElevenLabs voice for audio generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Voice ID</Label>
                  <Input
                    value={voiceSettings.voiceId}
                    onChange={e => {
                      setVoiceSettings({ ...voiceSettings, voiceId: e.target.value })
                      setHasChanges(true)
                    }}
                    placeholder="ElevenLabs Voice ID"
                  />
                  <p className="text-xs text-muted-foreground">
                    Current: Battlerap Algorithm (ZJ7BlVZrxZKBDMTIK5c9)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={voiceSettings.modelId}
                    onValueChange={v => {
                      setVoiceSettings({ ...voiceSettings, modelId: v })
                      setHasChanges(true)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eleven_turbo_v2_5">
                        Turbo v2.5 (Fast, Good Quality)
                      </SelectItem>
                      <SelectItem value="eleven_multilingual_v2">
                        Multilingual v2 (Best Quality)
                      </SelectItem>
                      <SelectItem value="eleven_monolingual_v1">
                        Monolingual v1 (Legacy)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Stability</Label>
                    <span className="text-sm text-muted-foreground">
                      {voiceSettings.stability}
                    </span>
                  </div>
                  <Slider
                    value={[voiceSettings.stability]}
                    onValueChange={v => {
                      setVoiceSettings({ ...voiceSettings, stability: v[0] })
                      setHasChanges(true)
                    }}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher = more consistent, Lower = more expressive
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Similarity Boost</Label>
                    <span className="text-sm text-muted-foreground">
                      {voiceSettings.similarityBoost}
                    </span>
                  </div>
                  <Slider
                    value={[voiceSettings.similarityBoost]}
                    onValueChange={v => {
                      setVoiceSettings({ ...voiceSettings, similarityBoost: v[0] })
                      setHasChanges(true)
                    }}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher = closer to original voice
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Style</Label>
                    <span className="text-sm text-muted-foreground">
                      {voiceSettings.style}
                    </span>
                  </div>
                  <Slider
                    value={[voiceSettings.style]}
                    onValueChange={v => {
                      setVoiceSettings({ ...voiceSettings, style: v[0] })
                      setHasChanges(true)
                    }}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher = more exaggerated expression
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hosts Tab */}
        <TabsContent value="hosts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Host Voice Assignments</CardTitle>
              <CardDescription>
                Each host can have different voice settings for their personality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.values(HOSTS).map(host => {
                  const voiceConfig = HOST_VOICE_MAP[host.id]

                  return (
                    <div
                      key={host.id}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{host.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {host.tagline}
                          </p>
                          <Badge variant="secondary" className="mt-2">
                            {host.archetype.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                          Configure
                        </Button>
                      </div>

                      <div className="mt-4 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Voice:</span>
                          <span>{voiceConfig?.name || 'Default'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stability:</span>
                          <span>{voiceConfig?.settings.stability || 0.5}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Style:</span>
                          <span>{voiceConfig?.settings.style || 0}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Registry</CardTitle>
              <CardDescription>
                All AI prompts that drive Talk Show Go
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {PROMPT_ROLES.map(({ role, label, icon }) => (
                  <div key={role} className="border rounded-lg p-4 text-center">
                    <span className="text-3xl">{icon}</span>
                    <h3 className="font-semibold mt-2">{label}</h3>
                    <p className="text-2xl font-bold text-primary">
                      {promptStats.byRole[role]}
                    </p>
                    <p className="text-sm text-muted-foreground">prompts</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Total: {promptStats.total} prompts</p>
                  <p className="text-sm text-muted-foreground">
                    {promptStats.editable} editable
                  </p>
                </div>
                <Link href="/studio/prompts">
                  <Button>
                    View All Prompts
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
