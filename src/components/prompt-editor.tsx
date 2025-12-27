'use client'

/**
 * PROMPT EDITOR
 *
 * Tabbed modal interface for editing AI prompts
 * - Tab 1: Edit (split-pane with original vs custom)
 * - Tab 2: Preview (fill with test variables)
 * - Tab 3: History (change log with diffs)
 */

import React, { useState, useEffect } from 'react'
import { PromptDefinition, PromptVariable } from '@/lib/prompt-registry'
import CodeTextarea, { VariableToolbar } from './code-textarea'

interface PromptEditorProps {
  promptId: string
  onClose: () => void
  onSave: () => void
}

type TabType = 'edit' | 'preview' | 'history'

interface PromptData {
  default: PromptDefinition
  custom: {
    id: string
    template: string
    version: number
    notes?: string
  } | null
  active_source: 'default' | 'custom'
}

export default function PromptEditor({ promptId, onClose, onSave }: PromptEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [promptData, setPromptData] = useState<PromptData | null>(null)
  const [customTemplate, setCustomTemplate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  // Load prompt data
  useEffect(() => {
    loadPromptData()
  }, [promptId])

  async function loadPromptData() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/prompts/${promptId}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load prompt')
      }

      setPromptData(data)
      setCustomTemplate(data.custom?.template || data.default.template)
      setNotes(data.custom?.notes || '')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!promptData) return

    try {
      setSaving(true)
      setError('')

      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: customTemplate,
          notes,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to save')
      }

      // Reload prompt data
      await loadPromptData()
      onSave()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!confirm('Reset to default? This will deactivate your custom override.')) {
      return
    }

    try {
      setError('')

      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to reset')
      }

      // Reload prompt data
      await loadPromptData()
      onSave()
    } catch (err) {
      setError(String(err))
    }
  }

  function handleInsertVariable(variable: string) {
    setCustomTemplate(prev => prev + variable)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading prompt...</p>
        </div>
      </div>
    )
  }

  if (!promptData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700">{error || 'Failed to load prompt'}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{promptData.default.name}</h2>
              <p className="text-sm text-gray-600 mt-1">{promptData.default.description}</p>
              <div className="flex gap-2 mt-2">
                <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">{promptData.default.role}</span>
                <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">{promptData.default.category}</span>
                {promptData.custom && (
                  <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-semibold">Custom v{promptData.custom.version}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('edit')}
              className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'edit' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'preview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              History
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'edit' && (
            <EditTab
              defaultTemplate={promptData.default.template}
              customTemplate={customTemplate}
              setCustomTemplate={setCustomTemplate}
              notes={notes}
              setNotes={setNotes}
              variables={promptData.default.variables}
              onInsertVariable={handleInsertVariable}
              error={error}
            />
          )}
          {activeTab === 'preview' && <PreviewTab promptId={promptId} variables={promptData.default.variables} customTemplate={customTemplate} />}
          {activeTab === 'history' && <HistoryTab promptId={promptId} />}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-between items-center">
          <div>
            {promptData.custom && (
              <button onClick={handleReset} className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium">
                Reset to Default
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50" disabled={saving}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              disabled={saving || customTemplate === promptData.default.template}
            >
              {saving ? 'Saving...' : 'Save Custom Prompt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// EDIT TAB
// ============================================

interface EditTabProps {
  defaultTemplate: string
  customTemplate: string
  setCustomTemplate: (value: string) => void
  notes: string
  setNotes: (value: string) => void
  variables: PromptVariable[]
  onInsertVariable: (variable: string) => void
  error: string
}

function EditTab({
  defaultTemplate,
  customTemplate,
  setCustomTemplate,
  notes,
  setNotes,
  variables,
  onInsertVariable,
  error,
}: EditTabProps) {
  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Variable Toolbar */}
      <VariableToolbar variables={variables} onInsert={onInsertVariable} />

      {/* Split Pane */}
      <div className="grid grid-cols-2 gap-6">
        {/* Original (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Original (Default)
            <span className="ml-2 text-xs text-gray-500">Read-only</span>
          </label>
          <CodeTextarea value={defaultTemplate} onChange={() => {}} disabled rows={20} />
        </div>

        {/* Custom (Editable) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Override
            <span className="ml-2 text-xs text-blue-600">Editable</span>
          </label>
          <CodeTextarea value={customTemplate} onChange={setCustomTemplate} placeholder="Edit your custom prompt here..." rows={20} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Why did you customize this prompt?"
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  )
}

// ============================================
// PREVIEW TAB
// ============================================

interface PreviewTabProps {
  promptId: string
  variables: PromptVariable[]
  customTemplate: string
}

function PreviewTab({ promptId, variables, customTemplate }: PreviewTabProps) {
  const [testValues, setTestValues] = useState<Record<string, string>>({})
  const [previewData, setPreviewData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showCustom, setShowCustom] = useState(true)

  async function generatePreview() {
    try {
      setLoading(true)

      const response = await fetch(`/api/prompts/${promptId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables: testValues,
          use_custom: showCustom,
        }),
      })

      const data = await response.json()
      setPreviewData(data)
    } catch (err) {
      console.error('Preview error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Test Variables</h3>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showCustom} onChange={e => setShowCustom(e.target.checked)} className="rounded" />
            Show custom version
          </label>
          <button onClick={generatePreview} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Preview'}
          </button>
        </div>
      </div>

      {/* Variable Inputs */}
      <div className="grid grid-cols-2 gap-4">
        {variables.map(variable => (
          <div key={variable.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {variable.name}
              {variable.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={testValues[variable.name] || ''}
              onChange={e => setTestValues({ ...testValues, [variable.name]: e.target.value })}
              placeholder={variable.example || variable.description}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            />
          </div>
        ))}
      </div>

      {/* Preview Output */}
      {previewData && (
        <div>
          <h3 className="text-lg font-medium mb-2">Filled Prompt</h3>
          <pre className="p-4 bg-gray-50 border border-gray-200 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {showCustom ? previewData.custom?.filled || previewData.default.filled : previewData.default.filled}
          </pre>
          {previewData.custom?.missing_variables?.length > 0 && (
            <p className="mt-2 text-sm text-red-600">Missing variables: {previewData.custom.missing_variables.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// HISTORY TAB
// ============================================

interface HistoryTabProps {
  promptId: string
}

function HistoryTab({ promptId }: HistoryTabProps) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [promptId])

  async function loadHistory() {
    try {
      setLoading(true)
      const response = await fetch(`/api/prompts/${promptId}/history`)
      const data = await response.json()

      if (data.success) {
        setHistory(data.history)
      }
    } catch (err) {
      console.error('History error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-gray-600">Loading history...</div>
  }

  if (history.length === 0) {
    return <div className="text-center text-gray-600">No change history yet. Make your first edit!</div>
  }

  return (
    <div className="space-y-4">
      {history.map(entry => (
        <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-sm font-medium text-gray-900">{entry.changed_by}</p>
              <p className="text-xs text-gray-500">{new Date(entry.changed_at).toLocaleString()}</p>
            </div>
            {entry.change_reason && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{entry.change_reason}</span>}
          </div>
          <div className="mt-3 text-sm">
            <p className="text-gray-600 mb-1">Changed from:</p>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap">{entry.old_template?.substring(0, 200)}...</pre>
          </div>
        </div>
      ))}
    </div>
  )
}
