'use client'

/**
 * Multi-Host Show Wizard
 *
 * 7-step wizard for creating multi-host conversations:
 * 1. Select Format
 * 2. Configure Show
 * 3. Select Hosts
 * 4. Customize Hosts (optional)
 * 5. Review Prep Plan
 * 6. Monitor Prep
 * 7. Generate & Preview
 */

import { useState, useEffect } from 'react'
import type { DebateHost, ShowFormat, EmotionalBeat } from '@/lib/debate/types'

export default function MultiHostShowPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Form state
  const [selectedFormat, setSelectedFormat] = useState<ShowFormat | null>(null)
  const [topic, setTopic] = useState('')
  const [targetDuration, setTargetDuration] = useState(10)
  const [emotionalBeats, setEmotionalBeats] = useState<EmotionalBeat[]>([])
  const [selectedHosts, setSelectedHosts] = useState<DebateHost[]>([])
  const [showRunId, setShowRunId] = useState<string | null>(null)
  const [generatedScript, setGeneratedScript] = useState('')

  // Available data
  const [formats, setFormats] = useState<ShowFormat[]>([])
  const [availableHosts, setAvailableHosts] = useState<DebateHost[]>([])

  // Load formats and hosts on mount
  useEffect(() => {
    loadFormats()
    loadHosts()
  }, [])

  async function loadFormats() {
    const res = await fetch('/api/debate/formats')
    const data = await res.json()
    if (data.success) {
      setFormats(data.formats)
    }
  }

  async function loadHosts() {
    const res = await fetch('/api/debate/hosts?active_only=true')
    const data = await res.json()
    if (data.success) {
      setAvailableHosts(data.hosts)
    }
  }

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/debate/show/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          host_ids: selectedHosts.map(h => h.id),
          show_format_id: selectedFormat!.id,
          emotional_beats: emotionalBeats,
          target_duration_minutes: targetDuration
        })
      })

      const data = await res.json()
      if (data.success) {
        setShowRunId(data.show_run_id)
        setGeneratedScript(data.conversation.map((t: any) =>
          `[${t.speaker_name}]: ${t.text}`
        ).join('\n\n'))
        setStep(7)
      }
    } catch (error) {
      console.error('Error generating show:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Multi-Host Show Creator</h1>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5, 6, 7].map(s => (
            <div
              key={s}
              className={`flex-1 h-2 mx-1 rounded ${
                s <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="text-center mt-2 text-sm text-gray-600">
          Step {step} of 7
        </div>
      </div>

      {/* Step 1: Select Format */}
      {step === 1 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Select Format</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formats.map(format => (
              <div
                key={format.id}
                onClick={() => {
                  setSelectedFormat(format)
                  setStep(2)
                }}
                className={`p-6 border-2 rounded-lg cursor-pointer hover:border-blue-500 ${
                  selectedFormat?.id === format.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <h3 className="text-xl font-bold mb-2">{format.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{format.description}</p>
                <div className="text-xs text-gray-500">
                  <div>Type: {format.format_type}</div>
                  <div>Hosts: {format.min_hosts}-{format.max_hosts}</div>
                  <div>Duration: ~{format.target_duration_minutes} min</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Configure Show */}
      {step === 2 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Configure Show</h2>
          <div className="max-w-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Topic</label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                rows={3}
                placeholder="What should this show be about?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Target Duration: {targetDuration} minutes
              </label>
              <input
                type="range"
                min="5"
                max="30"
                value={targetDuration}
                onChange={e => setTargetDuration(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Emotional Journey (Optional)</label>
              <select
                onChange={e => {
                  const value = e.target.value
                  if (value === 'outrage_revelation') {
                    setEmotionalBeats([
                      { type: 'outrage', percent: 20, host_preference: 'aggressive' },
                      { type: 'investigation', percent: 60, host_preference: 'analytical' },
                      { type: 'revelation', percent: 80, host_preference: 'analytical' },
                      { type: 'resolution', percent: 100, host_preference: 'empathetic' }
                    ])
                  } else if (value === 'confusion_clarity') {
                    setEmotionalBeats([
                      { type: 'tension', percent: 20 },
                      { type: 'investigation', percent: 60 },
                      { type: 'clarity', percent: 100 }
                    ])
                  } else {
                    setEmotionalBeats([])
                  }
                }}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">None (natural flow)</option>
                <option value="outrage_revelation">Outrage → Revelation</option>
                <option value="confusion_clarity">Confusion → Clarity</option>
              </select>
              {emotionalBeats.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  Arc: {emotionalBeats.map(b => b.type).join(' → ')}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!topic.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Select Hosts */}
      {step === 3 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Select Hosts</h2>
          <div className="mb-4 text-sm text-gray-600">
            Select {selectedFormat?.min_hosts}-{selectedFormat?.max_hosts} hosts for this show
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableHosts.map(host => {
              const isSelected = selectedHosts.some(h => h.id === host.id)
              return (
                <div
                  key={host.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedHosts(selectedHosts.filter(h => h.id !== host.id))
                    } else if (selectedHosts.length < (selectedFormat?.max_hosts || 5)) {
                      setSelectedHosts([...selectedHosts, host])
                    }
                  }}
                  className={`p-4 border-2 rounded-lg cursor-pointer ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <h3 className="font-bold mb-1">{host.name}</h3>
                  <div className="text-sm text-gray-600 mb-2">{host.archetype}</div>
                  <div className="text-xs space-y-1">
                    <div>Opinion: {host.opinion_strength}/100</div>
                    <div>Aggression: {host.aggression}/100</div>
                    <div>Analytical: {host.analytical_depth}/100</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={selectedHosts.length < (selectedFormat?.min_hosts || 2)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Show'}
            </button>
          </div>
        </div>
      )}

      {/* Step 7: Preview & Export */}
      {step === 7 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Show Generated!</h2>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="font-bold mb-4">Script Preview</h3>
            <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
              {generatedScript}
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => {
                setStep(1)
                setShowRunId(null)
                setGeneratedScript('')
                setSelectedHosts([])
                setTopic('')
              }}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50"
            >
              Start New Show
            </button>
            <button
              onClick={() => {
                // TODO: Navigate to refinement page
                alert('Script refinement coming soon!')
              }}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Punch-Up Script
            </button>
            <button
              onClick={() => {
                // TODO: Generate audio
                alert('Audio generation coming soon!')
              }}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Generate Audio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
