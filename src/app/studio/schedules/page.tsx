'use client'

import { useState, useEffect } from 'react'
import { useTopic } from '@/context/topic-context'
import { AppShell } from '@/components/layout'
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle
} from 'lucide-react'

interface DailyShowSchedule {
  id: string
  topic_id: string
  schedule_type: 'daily' | 'weekly' | 'interval' | 'cron' | 'manual'
  schedule_time?: string
  schedule_days_of_week?: number[]
  schedule_interval_hours?: number
  schedule_cron?: string
  timezone: string
  template_id?: string
  host_slug?: string
  show_name_prefix?: string
  stories_count: number
  hours_back: number
  auto_select_topics: boolean
  topic_selection_strategy: string
  include_twitter_digest: boolean
  production_format?: string
  use_channel_style: boolean
  channel_style_file?: string
  generate_audio: boolean
  audio_output_path?: string
  is_active: boolean
  last_generated_at?: string
  next_scheduled_at?: string
  last_run_status?: string
  last_run_error?: string
  description?: string
  created_at: string
}

interface RunHistoryItem {
  id: string
  schedule_id: string
  scheduled_for: string
  executed_at: string
  status: 'success' | 'failed' | 'skipped' | 'retrying'
  show_name?: string
  duration_seconds?: number
  stories_count?: number
  error_message?: string
  cost_llm_cents: number
  cost_tts_cents: number
}

interface ShowTemplate {
  id: string
  name: string
  slug: string
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SchedulesPage() {
  const { selectedTopic, isLoading: topicLoading } = useTopic()
  const [schedules, setSchedules] = useState<DailyShowSchedule[]>([])
  const [templates, setTemplates] = useState<ShowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null)
  const [runHistory, setRunHistory] = useState<Record<string, RunHistoryItem[]>>({})

  useEffect(() => {
    if (selectedTopic) {
      loadSchedules()
      loadTemplates()
    }
  }, [selectedTopic])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/schedules/daily-show?topic_id=${selectedTopic?.id}`)
      const data = await res.json()
      setSchedules(data.schedules || [])
    } catch (error) {
      console.error('Failed to load schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const loadHistory = async (scheduleId: string) => {
    try {
      const res = await fetch(`/api/schedules/daily-show/${scheduleId}/history?limit=10`)
      const data = await res.json()
      setRunHistory(prev => ({ ...prev, [scheduleId]: data.history || [] }))
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  const toggleSchedule = async (schedule: DailyShowSchedule) => {
    try {
      await fetch(`/api/schedules/daily-show/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !schedule.is_active })
      })
      loadSchedules()
    } catch (error) {
      console.error('Failed to toggle schedule:', error)
    }
  }

  const runNow = async (scheduleId: string) => {
    try {
      await fetch(`/api/schedules/daily-show/${scheduleId}/run-now`, {
        method: 'POST'
      })
      alert('Show generation started! Check history in a moment.')
      setTimeout(() => loadHistory(scheduleId), 3000)
    } catch (error) {
      console.error('Failed to run schedule:', error)
      alert('Failed to start show generation')
    }
  }

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('Delete this schedule?')) return
    try {
      await fetch(`/api/schedules/daily-show/${scheduleId}`, { method: 'DELETE' })
      loadSchedules()
    } catch (error) {
      console.error('Failed to delete schedule:', error)
    }
  }

  const formatSchedule = (schedule: DailyShowSchedule) => {
    switch (schedule.schedule_type) {
      case 'daily':
        return `Daily at ${schedule.schedule_time} ${schedule.timezone}`
      case 'weekly':
        const days = schedule.schedule_days_of_week?.map(d => DAYS_OF_WEEK[d]).join(', ')
        return `${days} at ${schedule.schedule_time} ${schedule.timezone}`
      case 'interval':
        return `Every ${schedule.schedule_interval_hours} hours`
      case 'cron':
        return `Cron: ${schedule.schedule_cron} (${schedule.timezone})`
      case 'manual':
        return 'Manual only'
      default:
        return 'Unknown'
    }
  }

  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return 'Not scheduled'
    const date = new Date(nextRun)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 0) return 'Overdue'
    if (diffMins < 60) return `In ${diffMins}m`
    if (diffMins < 1440) return `In ${Math.floor(diffMins / 60)}h`
    return `In ${Math.floor(diffMins / 1440)}d`
  }

  const toggleExpanded = (scheduleId: string) => {
    if (expandedSchedule === scheduleId) {
      setExpandedSchedule(null)
    } else {
      setExpandedSchedule(scheduleId)
      if (!runHistory[scheduleId]) {
        loadHistory(scheduleId)
      }
    }
  }

  // Show loading state while topics are being fetched
  if (topicLoading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-300 animate-spin" />
              <p className="text-blue-300">Loading topics...</p>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  // Show warning if no topic selected after loading
  if (!selectedTopic) {
    return (
      <AppShell>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
              <p className="text-yellow-300">Please select a topic first</p>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Daily Show Schedules</h1>
              <p className="text-gray-400">Automated recurring show generation</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Schedule
            </button>
          </div>
        </div>

        {/* Schedules List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
            <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Schedules Yet</h3>
            <p className="text-gray-400 mb-6">Create your first automated show schedule</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Schedule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map(schedule => (
              <div
                key={schedule.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Schedule Row */}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-xl font-semibold text-white">
                          {schedule.show_name_prefix || 'Untitled'} Daily
                        </h3>
                        {schedule.is_active ? (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Active
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-sm rounded-full flex items-center gap-1">
                            <Pause className="w-4 h-4" />
                            Paused
                          </span>
                        )}
                        {schedule.last_run_status === 'success' && (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
                            Last: Success
                          </span>
                        )}
                        {schedule.last_run_status === 'failed' && (
                          <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded-full">
                            Last: Failed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-6 text-sm text-gray-400">
                        <span className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {formatSchedule(schedule)}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Next: {formatNextRun(schedule.next_scheduled_at)}
                        </span>
                        <span>
                          {schedule.stories_count} stories · {schedule.hours_back}h lookback
                        </span>
                        {schedule.host_slug && (
                          <span>Host: {schedule.host_slug}</span>
                        )}
                      </div>

                      {schedule.description && (
                        <p className="text-gray-500 text-sm mt-2">{schedule.description}</p>
                      )}

                      {schedule.last_run_error && (
                        <div className="mt-2 flex items-start gap-2 text-red-400 text-sm">
                          <AlertCircle className="w-4 h-4 mt-0.5" />
                          <span>{schedule.last_run_error}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runNow(schedule.id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-blue-400 hover:text-blue-300"
                        title="Run Now"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleSchedule(schedule)}
                        className={`p-2 hover:bg-gray-700 rounded-lg transition-colors ${
                          schedule.is_active ? 'text-yellow-400' : 'text-green-400'
                        }`}
                        title={schedule.is_active ? 'Pause' : 'Activate'}
                      >
                        {schedule.is_active ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleExpanded(schedule.id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400"
                        title="View History"
                      >
                        {expandedSchedule === schedule.id ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-red-400 hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Execution History */}
                {expandedSchedule === schedule.id && (
                  <div className="border-t border-gray-700 bg-gray-900/50 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white">Execution History</h4>
                      <button
                        onClick={() => loadHistory(schedule.id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    {!runHistory[schedule.id] ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      </div>
                    ) : runHistory[schedule.id].length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No execution history yet</p>
                    ) : (
                      <div className="space-y-3">
                        {runHistory[schedule.id].map(run => (
                          <div
                            key={run.id}
                            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                {run.status === 'success' ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : run.status === 'failed' ? (
                                  <XCircle className="w-5 h-5 text-red-400" />
                                ) : (
                                  <Loader2 className="w-5 h-5 text-yellow-400" />
                                )}
                                <div>
                                  <div className="text-white font-medium">
                                    {run.show_name || 'Show Generation'}
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {new Date(run.executed_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-sm text-gray-400">
                                {run.duration_seconds && (
                                  <div>{Math.floor(run.duration_seconds / 60)}m {run.duration_seconds % 60}s</div>
                                )}
                                {run.stories_count && (
                                  <div>{run.stories_count} stories</div>
                                )}
                                {(run.cost_llm_cents > 0 || run.cost_tts_cents > 0) && (
                                  <div className="text-green-400">
                                    ${((run.cost_llm_cents + run.cost_tts_cents) / 100).toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>
                            {run.error_message && (
                              <div className="mt-2 text-red-400 text-sm flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{run.error_message}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <CreateScheduleModal
            topicId={selectedTopic?.id}
            templates={templates}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false)
              loadSchedules()
            }}
          />
        )}
      </div>
    </div>
    </AppShell>
  )
}

// Create Schedule Modal Component
function CreateScheduleModal({
  topicId,
  templates,
  onClose,
  onCreated
}: {
  topicId: string
  templates: ShowTemplate[]
  onClose: () => void
  onCreated: () => void
}) {
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'interval' | 'cron'>('daily')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon-Fri
  const [intervalHours, setIntervalHours] = useState(6)
  const [cronExpression, setCronExpression] = useState('0 9 * * *')
  const [timezone, setTimezone] = useState('America/New_York')
  const [templateId, setTemplateId] = useState('')
  const [hostSlug, setHostSlug] = useState('marcus-blaze')
  const [showNamePrefix, setShowNamePrefix] = useState('Battle Rap')
  const [storiesCount, setStoriesCount] = useState(3)
  const [hoursBack, setHoursBack] = useState(24)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day))
    } else {
      setSelectedDays([...selectedDays, day].sort())
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const body: any = {
        topic_id: topicId,
        schedule_type: scheduleType,
        timezone,
        template_id: templateId || null,
        host_slug: hostSlug,
        show_name_prefix: showNamePrefix,
        stories_count: storiesCount,
        hours_back: hoursBack,
        auto_select_topics: true,
        topic_selection_strategy: 'engagement',
        include_twitter_digest: true,
        use_channel_style: true,
        channel_style_file: 'algorithm-institute-of-battle-rap',
        generate_audio: true,
        description
      }

      if (scheduleType === 'daily') {
        body.schedule_time = scheduleTime
      } else if (scheduleType === 'weekly') {
        body.schedule_time = scheduleTime
        body.schedule_days_of_week = selectedDays
      } else if (scheduleType === 'interval') {
        body.schedule_interval_hours = intervalHours
      } else if (scheduleType === 'cron') {
        body.schedule_cron = cronExpression
      }

      const res = await fetch('/api/schedules/daily-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create schedule')
      }

      onCreated()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Create New Schedule</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Schedule Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['daily', 'weekly', 'interval', 'cron'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setScheduleType(type)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    scheduleType === type
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Configuration */}
          {scheduleType === 'daily' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Time</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
          )}

          {scheduleType === 'weekly' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Days of Week</label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        selectedDays.includes(idx)
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            </>
          )}

          {scheduleType === 'interval' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Interval (hours)</label>
              <input
                type="number"
                min="1"
                max="24"
                value={intervalHours}
                onChange={(e) => setIntervalHours(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
          )}

          {scheduleType === 'cron' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cron Expression</label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 9 * * 1-5"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Format: minute hour day month weekday</p>
            </div>
          )}

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          {/* Show Configuration */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Show Configuration</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Show Name Prefix</label>
                <input
                  type="text"
                  value={showNamePrefix}
                  onChange={(e) => setShowNamePrefix(e.target.value)}
                  placeholder="Battle Rap"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Will create "{showNamePrefix} Daily"</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Stories Count</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={storiesCount}
                    onChange={(e) => setStoriesCount(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Hours Lookback</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={hoursBack}
                    onChange={(e) => setHoursBack(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Host</label>
                <select
                  value={hostSlug}
                  onChange={(e) => setHostSlug(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="marcus-blaze">Marcus Blaze (Hot Take King)</option>
                  <option value="maya-sterling">Maya Sterling (Investigative)</option>
                  <option value="devon-sharp">Devon Sharp (Witty Satirist)</option>
                  <option value="tasha-raw">Tasha Raw (Unfiltered)</option>
                  <option value="james-noble">James Noble (Documentary)</option>
                  <option value="dj-momentum">DJ Momentum (High Energy)</option>
                  <option value="king-knowledge">King Knowledge (Street Analyst)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes about this schedule..."
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
