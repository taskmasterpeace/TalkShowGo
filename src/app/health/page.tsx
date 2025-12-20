'use client'

import { AppShell } from '@/components/layout'
import { NicheHealthDashboard } from '@/components/niche-health'
import { PipelineGuide } from '@/components/pipeline-guide'
import { Activity } from 'lucide-react'

// TODO: Get from URL/context
const TOPIC_ID = 'battle-rap'

export default function HealthPage() {
  return (
    <AppShell topicName="Battle Rap">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="font-head text-3xl flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            SYSTEM HEALTH
          </h1>
          <p className="text-muted-foreground">
            Monitor your niche configuration and pipeline status
          </p>
        </div>

        {/* Health Dashboard */}
        <NicheHealthDashboard topicId={TOPIC_ID} />

        {/* Pipeline Guide */}
        <PipelineGuide />
      </div>
    </AppShell>
  )
}
