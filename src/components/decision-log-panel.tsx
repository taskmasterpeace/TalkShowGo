'use client'

import { useState } from 'react'
import { ProposalDecisionLog, TranscriptLog, Decision, TopicSummary, RejectedTopic } from '@/lib/decision-logger'
import { ChevronDown, ChevronRight, Search, FileText, Filter, Trophy, XCircle, Clock } from 'lucide-react'

interface DecisionLogPanelProps {
  log: ProposalDecisionLog
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string | number
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-zinc-900 hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs bg-zinc-700 rounded-full">
            {badge}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="p-3 bg-zinc-950 border-t border-zinc-800">
          {children}
        </div>
      )}
    </div>
  )
}

function SearchesSection({ log }: { log: ProposalDecisionLog }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-400 mb-2">YouTube Channels</h4>
        <div className="flex flex-wrap gap-2">
          {log.searches.youtube.channels_queried.length > 0 ? (
            log.searches.youtube.channels_queried.map((channel, i) => (
              <span key={i} className="px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded">
                {channel}
              </span>
            ))
          ) : (
            <span className="text-zinc-500 text-sm">No channels configured</span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          Found {log.searches.youtube.videos_found} videos
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-zinc-400 mb-2">Twitter Accounts</h4>
        <div className="flex flex-wrap gap-2">
          {log.searches.twitter.accounts_queried.length > 0 ? (
            log.searches.twitter.accounts_queried.map((account, i) => (
              <span key={i} className="px-2 py-1 text-xs bg-blue-900/30 text-blue-300 rounded">
                {account}
              </span>
            ))
          ) : (
            <span className="text-zinc-500 text-sm">No accounts configured</span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          Found {log.searches.twitter.tweets_found} tweets
        </p>
      </div>

      <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
        Date range: {new Date(log.searches.youtube.date_range.start).toLocaleDateString()} - {new Date(log.searches.youtube.date_range.end).toLocaleDateString()}
      </div>
    </div>
  )
}

function AnalysisSection({ log }: { log: ProposalDecisionLog }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-400 mb-2">Entities Detected</h4>
        <div className="flex flex-wrap gap-2">
          {log.analysis.entities_detected.map((entity, i) => (
            <span key={i} className="px-2 py-1 text-xs bg-purple-900/30 text-purple-300 rounded">
              {entity}
            </span>
          ))}
        </div>
      </div>

      {log.analysis.transcripts_fetched.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Transcripts Analyzed</h4>
          <div className="space-y-2">
            {log.analysis.transcripts_fetched.map((t: TranscriptLog, i) => (
              <div key={i} className="p-2 bg-zinc-900 rounded text-sm">
                <div className="font-medium text-zinc-200">{t.title}</div>
                <div className="text-xs text-zinc-500">{t.channel}</div>
                <div className="text-xs text-green-400 mt-1">{t.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DecisionsSection({ decisions }: { decisions: Decision[] }) {
  return (
    <div className="space-y-2">
      {decisions.map((decision, i) => (
        <div key={i} className="flex items-start gap-3 p-2 bg-zinc-900 rounded">
          <div className="w-20 shrink-0">
            <span className={`px-2 py-0.5 text-xs rounded ${
              decision.step === 'fetch' ? 'bg-blue-900/50 text-blue-300' :
              decision.step === 'entity_extraction' ? 'bg-purple-900/50 text-purple-300' :
              decision.step === 'clustering' ? 'bg-yellow-900/50 text-yellow-300' :
              decision.step === 'scoring' ? 'bg-green-900/50 text-green-300' :
              decision.step === 'filtering' ? 'bg-orange-900/50 text-orange-300' :
              'bg-zinc-700 text-zinc-300'
            }`}>
              {decision.step}
            </span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-zinc-200">{decision.action}</div>
            <div className="text-xs text-zinc-500">{decision.details}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SelectedTopicsSection({ topics }: { topics: TopicSummary[] }) {
  return (
    <div className="space-y-2">
      {topics.map((topic, i) => (
        <div key={i} className="p-3 bg-zinc-900 rounded border-l-2 border-green-500">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-green-400">#{topic.rank}</span>
            <span className="text-xs text-zinc-500">
              {topic.engagement_score.toLocaleString()} engagement
            </span>
          </div>
          <div className="font-medium text-zinc-200 text-sm">{topic.headline}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {topic.source_count} sources | {topic.primary_reason}
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            Freshest: {new Date(topic.freshest_content).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

function RejectedTopicsSection({ topics }: { topics: RejectedTopic[] }) {
  if (topics.length === 0) {
    return <p className="text-sm text-zinc-500">No topics were rejected</p>
  }

  return (
    <div className="space-y-2">
      {topics.map((topic, i) => (
        <div key={i} className="p-2 bg-zinc-900 rounded border-l-2 border-red-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">{topic.headline}</span>
            <span className="text-xs text-zinc-600">
              {topic.engagement_score.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-red-400 mt-1">{topic.rejection_reason}</div>
        </div>
      ))}
    </div>
  )
}

export function DecisionLogPanel({ log }: DecisionLogPanelProps) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between text-zinc-400 text-xs pb-2 border-b border-zinc-800">
        <span>Generated: {new Date(log.proposed_at).toLocaleString()}</span>
        {log.processing_time_ms && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {log.processing_time_ms}ms
          </span>
        )}
      </div>

      <CollapsibleSection
        title="Searches"
        icon={<Search className="w-4 h-4 text-blue-400" />}
        badge={`${log.searches.youtube.videos_found} videos, ${log.searches.twitter.tweets_found} tweets`}
        defaultOpen={true}
      >
        <SearchesSection log={log} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Analysis"
        icon={<FileText className="w-4 h-4 text-purple-400" />}
        badge={`${log.analysis.entities_detected.length} entities`}
      >
        <AnalysisSection log={log} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Decisions"
        icon={<Filter className="w-4 h-4 text-yellow-400" />}
        badge={log.decisions.length}
      >
        <DecisionsSection decisions={log.decisions} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Selected Topics"
        icon={<Trophy className="w-4 h-4 text-green-400" />}
        badge={log.topics_selected.length}
        defaultOpen={true}
      >
        <SelectedTopicsSection topics={log.topics_selected} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Rejected Topics"
        icon={<XCircle className="w-4 h-4 text-red-400" />}
        badge={log.topics_rejected.length}
      >
        <RejectedTopicsSection topics={log.topics_rejected} />
      </CollapsibleSection>
    </div>
  )
}

export default DecisionLogPanel
