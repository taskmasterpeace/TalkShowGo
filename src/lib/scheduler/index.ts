/**
 * WORKFLOW SCHEDULER
 *
 * Manages scheduled pipeline runs and workflow execution.
 *
 * Flow:
 * 1. Workflows define WHEN things run (cron, interval, manual, trigger)
 * 2. Scheduler checks which workflows are due
 * 3. Runner executes the workflow using configured LLM
 * 4. Results are logged and next run is calculated
 */

import { supabaseService as supabase } from '@/lib/db'

// ============================================
// TYPES
// ============================================

export interface Workflow {
  id: string
  name: string
  description: string
  pipeline_phase: string
  topic_id: string | null
  schedule_type: 'interval' | 'cron' | 'manual' | 'trigger'
  schedule_interval_minutes: number | null
  schedule_cron: string | null
  schedule_trigger_event: string | null
  config: Record<string, any>
  use_local_llm: boolean
  llm_provider: string
  llm_model: string | null
  is_active: boolean
  last_run_at: Date | null
  next_run_at: Date | null
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: Date | null
  completed_at: Date | null
  duration_ms: number | null
  items_processed: number
  items_created: number
  items_updated: number
  llm_provider_used: string | null
  llm_tokens_used: number
  llm_cost_cents: number
  error_message: string | null
  error_details: Record<string, any> | null
}

export interface SchedulerStatus {
  isRunning: boolean
  lastCheck: Date | null
  workflowsDue: number
  workflowsRunning: number
}

// ============================================
// SCHEDULER CLASS
// ============================================

export class WorkflowScheduler {
  private checkIntervalMs: number = 60000 // Check every minute
  private isRunning: boolean = false
  private intervalId: NodeJS.Timeout | null = null
  private lastCheck: Date | null = null

  /**
   * Get workflows that are due to run
   */
  async getDueWorkflows(): Promise<Workflow[]> {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('is_active', true)
      .in('schedule_type', ['interval', 'cron'])
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at')

    if (error) {
      console.error('Error fetching due workflows:', error)
      return []
    }

    return data || []
  }

  /**
   * Queue a workflow for execution
   */
  async queueWorkflow(workflowId: string): Promise<WorkflowRun | null> {
    const { data, error } = await supabase
      .from('workflow_runs')
      .insert({
        workflow_id: workflowId,
        status: 'queued',
      })
      .select()
      .single()

    if (error) {
      console.error('Error queuing workflow:', error)
      return null
    }

    return data
  }

  /**
   * Calculate next run time for a workflow
   */
  calculateNextRun(workflow: Workflow): Date {
    const now = new Date()

    if (workflow.schedule_type === 'interval' && workflow.schedule_interval_minutes) {
      return new Date(now.getTime() + workflow.schedule_interval_minutes * 60 * 1000)
    }

    if (workflow.schedule_type === 'cron' && workflow.schedule_cron) {
      // For now, simple cron parsing (just intervals)
      // TODO: Implement full cron parsing
      return new Date(now.getTime() + 60 * 60 * 1000) // Default 1 hour
    }

    // Manual workflows don't have a next run
    return now
  }

  /**
   * Update workflow after run
   */
  async updateWorkflowAfterRun(workflow: Workflow): Promise<void> {
    const nextRun = this.calculateNextRun(workflow)

    await supabase
      .from('workflows')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun.toISOString(),
      })
      .eq('id', workflow.id)
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    console.log('Workflow scheduler started')

    this.intervalId = setInterval(async () => {
      await this.tick()
    }, this.checkIntervalMs)

    // Initial tick
    this.tick()
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('Workflow scheduler stopped')
  }

  /**
   * Scheduler tick - check and run due workflows
   */
  async tick(): Promise<void> {
    this.lastCheck = new Date()

    try {
      const dueWorkflows = await this.getDueWorkflows()

      for (const workflow of dueWorkflows) {
        console.log(`Queueing workflow: ${workflow.name}`)
        await this.queueWorkflow(workflow.id)
        await this.updateWorkflowAfterRun(workflow)
      }
    } catch (error) {
      console.error('Scheduler tick error:', error)
    }
  }

  /**
   * Get scheduler status
   */
  async getStatus(): Promise<SchedulerStatus> {
    const dueWorkflows = await this.getDueWorkflows()

    const { count: runningCount } = await supabase
      .from('workflow_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'running')

    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck,
      workflowsDue: dueWorkflows.length,
      workflowsRunning: runningCount || 0,
    }
  }
}

// ============================================
// WORKFLOW RUNNER
// ============================================

export class WorkflowRunner {
  /**
   * Execute a queued workflow run
   */
  async executeRun(runId: string): Promise<void> {
    // Get run details
    const { data: run, error: runError } = await supabase
      .from('workflow_runs')
      .select(`
        *,
        workflows (*)
      `)
      .eq('id', runId)
      .single()

    if (runError || !run) {
      console.error('Error fetching run:', runError)
      return
    }

    const workflow = run.workflows

    // Update status to running
    await supabase
      .from('workflow_runs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', runId)

    const startTime = Date.now()
    let itemsProcessed = 0
    let itemsCreated = 0
    let itemsUpdated = 0
    let tokensUsed = 0
    let errorMessage: string | null = null

    try {
      // Execute based on pipeline phase
      const result = await this.executePipelinePhase(workflow)
      itemsProcessed = result.processed
      itemsCreated = result.created
      itemsUpdated = result.updated
      tokensUsed = result.tokens
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Workflow run ${runId} failed:`, error)
    }

    const duration = Date.now() - startTime

    // Update run with results
    await supabase
      .from('workflow_runs')
      .update({
        status: errorMessage ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        items_processed: itemsProcessed,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        llm_provider_used: workflow.llm_provider,
        llm_tokens_used: tokensUsed,
        error_message: errorMessage,
      })
      .eq('id', runId)
  }

  /**
   * Execute a specific pipeline phase
   */
  private async executePipelinePhase(workflow: Workflow): Promise<{
    processed: number
    created: number
    updated: number
    tokens: number
  }> {
    switch (workflow.pipeline_phase) {
      case 'perimeter':
        return this.runPerimeterSweep(workflow)
      case 'extraction':
        return this.runExtraction(workflow)
      case 'audit':
        return this.runAudit(workflow)
      case 'nexus':
        return this.runNexus(workflow)
      default:
        console.log(`Unknown pipeline phase: ${workflow.pipeline_phase}`)
        return { processed: 0, created: 0, updated: 0, tokens: 0 }
    }
  }

  private async runPerimeterSweep(workflow: Workflow): Promise<{
    processed: number
    created: number
    updated: number
    tokens: number
  }> {
    // TODO: Implement actual perimeter sweep
    console.log(`Running perimeter sweep for topic: ${workflow.topic_id}`)
    return { processed: 0, created: 0, updated: 0, tokens: 0 }
  }

  private async runExtraction(workflow: Workflow): Promise<{
    processed: number
    created: number
    updated: number
    tokens: number
  }> {
    // TODO: Implement extraction using local/remote LLM
    console.log(`Running extraction for topic: ${workflow.topic_id}`)
    return { processed: 0, created: 0, updated: 0, tokens: 0 }
  }

  private async runAudit(workflow: Workflow): Promise<{
    processed: number
    created: number
    updated: number
    tokens: number
  }> {
    // TODO: Implement audit/consensus calculation
    console.log(`Running audit for topic: ${workflow.topic_id}`)
    return { processed: 0, created: 0, updated: 0, tokens: 0 }
  }

  private async runNexus(workflow: Workflow): Promise<{
    processed: number
    created: number
    updated: number
    tokens: number
  }> {
    // TODO: Implement story threading
    console.log(`Running nexus for topic: ${workflow.topic_id}`)
    return { processed: 0, created: 0, updated: 0, tokens: 0 }
  }
}

// ============================================
// DEFAULT WORKFLOWS
// ============================================

export const DEFAULT_WORKFLOWS = [
  {
    name: 'Perimeter Sweep - Twitter',
    description: 'Fetch new tweets from monitored accounts',
    pipeline_phase: 'perimeter',
    schedule_type: 'interval',
    schedule_interval_minutes: 15,
    use_local_llm: false,
    llm_provider: 'none',
    config: { sources: ['twitter'] },
  },
  {
    name: 'Perimeter Sweep - YouTube',
    description: 'Check for new videos from tracked channels',
    pipeline_phase: 'perimeter',
    schedule_type: 'interval',
    schedule_interval_minutes: 60,
    use_local_llm: false,
    llm_provider: 'none',
    config: { sources: ['youtube'] },
  },
  {
    name: 'Entity Extraction',
    description: 'Extract entities and claims from new content',
    pipeline_phase: 'extraction',
    schedule_type: 'interval',
    schedule_interval_minutes: 30,
    use_local_llm: true,
    llm_provider: 'local',
    config: {},
  },
  {
    name: 'Consensus Audit',
    description: 'Calculate consensus scores for claims',
    pipeline_phase: 'audit',
    schedule_type: 'interval',
    schedule_interval_minutes: 60,
    use_local_llm: true,
    llm_provider: 'local',
    config: {},
  },
  {
    name: 'Story Threading',
    description: 'Connect claims into story threads',
    pipeline_phase: 'nexus',
    schedule_type: 'interval',
    schedule_interval_minutes: 120,
    use_local_llm: true,
    llm_provider: 'local',
    config: {},
  },
]

// ============================================
// SINGLETON INSTANCES
// ============================================

export const scheduler = new WorkflowScheduler()
export const runner = new WorkflowRunner()
