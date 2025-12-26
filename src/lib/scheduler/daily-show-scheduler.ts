import cron from 'node-cron'
import cronParser from 'cron-parser'
import { createClient } from '@supabase/supabase-js'

interface DailyShowSchedule {
  id: string
  topic_id: string
  schedule_type: 'daily' | 'weekly' | 'interval' | 'cron' | 'manual'
  schedule_time?: string           // HH:MM
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
  skip_if_no_content: boolean
  max_retries: number
}

export class DailyShowScheduler {
  private supabase: any
  private cronJobs: Map<string, any> = new Map()
  private intervalJobs: Map<string, NodeJS.Timeout> = new Map()
  private checkIntervalMs: number = 60000  // Check every 60 seconds
  private mainInterval?: NodeJS.Timeout
  private isRunning: boolean = false

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.isRunning) {
      console.log('[DailyShowScheduler] Already running')
      return
    }

    console.log('[DailyShowScheduler] Starting...')
    this.isRunning = true

    // Load all active schedules
    await this.loadSchedules()

    // Check for due schedules every minute
    this.mainInterval = setInterval(() => this.tick(), this.checkIntervalMs)

    console.log('[DailyShowScheduler] Started successfully')
  }

  /**
   * Stop the scheduler
   */
  stop() {
    console.log('[DailyShowScheduler] Stopping...')
    this.isRunning = false

    // Clear main interval
    if (this.mainInterval) {
      clearInterval(this.mainInterval)
    }

    // Stop all cron jobs
    this.cronJobs.forEach(job => job.stop())
    this.cronJobs.clear()

    // Stop all interval jobs
    this.intervalJobs.forEach(interval => clearInterval(interval))
    this.intervalJobs.clear()

    console.log('[DailyShowScheduler] Stopped')
  }

  /**
   * Load all active schedules from database
   */
  async loadSchedules() {
    const { data: schedules, error } = await this.supabase
      .from('daily_show_schedules')
      .select('*')
      .eq('is_active', true)

    if (error) {
      console.error('[DailyShowScheduler] Error loading schedules:', error)
      return
    }

    console.log(`[DailyShowScheduler] Loaded ${schedules?.length || 0} active schedules`)

    // Set up each schedule
    for (const schedule of schedules || []) {
      await this.setupSchedule(schedule)
    }
  }

  /**
   * Set up a single schedule (cron job or interval)
   */
  private async setupSchedule(schedule: DailyShowSchedule) {
    // Remove existing job if any
    this.removeSchedule(schedule.id)

    switch (schedule.schedule_type) {
      case 'cron':
        this.setupCronSchedule(schedule)
        break
      case 'daily':
        this.setupDailySchedule(schedule)
        break
      case 'weekly':
        this.setupWeeklySchedule(schedule)
        break
      case 'interval':
        this.setupIntervalSchedule(schedule)
        break
      case 'manual':
        // Manual schedules don't auto-run
        break
    }

    // Calculate and update next_scheduled_at
    await this.updateNextScheduledAt(schedule)
  }

  /**
   * Set up cron-based schedule
   */
  private setupCronSchedule(schedule: DailyShowSchedule) {
    if (!schedule.schedule_cron) return

    // Validate cron expression
    if (!cron.validate(schedule.schedule_cron)) {
      console.error(`[DailyShowScheduler] Invalid cron expression for schedule ${schedule.id}: ${schedule.schedule_cron}`)
      return
    }

    const job = cron.schedule(schedule.schedule_cron, () => {
      this.executeSchedule(schedule)
    }, {
      timezone: schedule.timezone || 'UTC'
    })

    this.cronJobs.set(schedule.id, job)
    console.log(`[DailyShowScheduler] Set up cron schedule: ${schedule.id} - ${schedule.schedule_cron}`)
  }

  /**
   * Set up daily schedule (every day at specific time)
   */
  private setupDailySchedule(schedule: DailyShowSchedule) {
    if (!schedule.schedule_time) return

    const [hour, minute] = schedule.schedule_time.split(':')
    const cronExpression = `${minute} ${hour} * * *`

    const job = cron.schedule(cronExpression, () => {
      this.executeSchedule(schedule)
    }, {
      timezone: schedule.timezone || 'UTC'
    })

    this.cronJobs.set(schedule.id, job)
    console.log(`[DailyShowScheduler] Set up daily schedule: ${schedule.id} - ${cronExpression}`)
  }

  /**
   * Set up weekly schedule (specific days at specific time)
   */
  private setupWeeklySchedule(schedule: DailyShowSchedule) {
    if (!schedule.schedule_time || !schedule.schedule_days_of_week) return

    const [hour, minute] = schedule.schedule_time.split(':')
    const daysStr = schedule.schedule_days_of_week.join(',')
    const cronExpression = `${minute} ${hour} * * ${daysStr}`

    const job = cron.schedule(cronExpression, () => {
      this.executeSchedule(schedule)
    }, {
      timezone: schedule.timezone || 'UTC'
    })

    this.cronJobs.set(schedule.id, job)
    console.log(`[DailyShowScheduler] Set up weekly schedule: ${schedule.id} - ${cronExpression}`)
  }

  /**
   * Set up interval schedule (every X hours)
   */
  private setupIntervalSchedule(schedule: DailyShowSchedule) {
    if (!schedule.schedule_interval_hours) return

    const intervalMs = schedule.schedule_interval_hours * 60 * 60 * 1000

    const interval = setInterval(() => {
      this.executeSchedule(schedule)
    }, intervalMs)

    this.intervalJobs.set(schedule.id, interval)
    console.log(`[DailyShowScheduler] Set up interval schedule: ${schedule.id} - every ${schedule.schedule_interval_hours}h`)
  }

  /**
   * Remove a schedule (stop cron/interval)
   */
  private removeSchedule(scheduleId: string) {
    const cronJob = this.cronJobs.get(scheduleId)
    if (cronJob) {
      cronJob.stop()
      this.cronJobs.delete(scheduleId)
    }

    const intervalJob = this.intervalJobs.get(scheduleId)
    if (intervalJob) {
      clearInterval(intervalJob)
      this.intervalJobs.delete(scheduleId)
    }
  }

  /**
   * Execute a scheduled show generation
   */
  private async executeSchedule(schedule: DailyShowSchedule) {
    console.log(`[DailyShowScheduler] Executing schedule: ${schedule.id}`)

    try {
      // Call the daily show API endpoint
      const response = await fetch(`http://localhost:3000/api/stories/daily-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: schedule.topic_id,
          template_id: schedule.template_id,
          host_slug: schedule.host_slug,
          show_name: schedule.show_name_prefix ? `${schedule.show_name_prefix} Daily` : undefined,
          stories_count: schedule.stories_count,
          hours_back: schedule.hours_back,
          auto_select_topics: schedule.auto_select_topics,
          topic_selection_strategy: schedule.topic_selection_strategy,
          include_twitter_digest: schedule.include_twitter_digest,
          production_format: schedule.production_format,
          use_channel_style: schedule.use_channel_style,
          channel_style_file: schedule.channel_style_file,
          generate_audio: schedule.generate_audio,
          _scheduled: true,  // Flag to indicate this is a scheduled run
          _schedule_id: schedule.id
        })
      })

      const result = await response.json()

      if (response.ok) {
        // Log successful run
        await this.logRun(schedule.id, 'success', result)

        // Update schedule
        await this.supabase
          .from('daily_show_schedules')
          .update({
            last_generated_at: new Date().toISOString(),
            last_run_status: 'success',
            last_run_error: null
          })
          .eq('id', schedule.id)

        console.log(`[DailyShowScheduler] Successfully generated show for schedule: ${schedule.id}`)
      } else {
        throw new Error(result.error || 'Show generation failed')
      }
    } catch (error: any) {
      console.error(`[DailyShowScheduler] Error executing schedule ${schedule.id}:`, error)

      // Log failed run
      await this.logRun(schedule.id, 'failed', null, error.message)

      // Update schedule with error
      await this.supabase
        .from('daily_show_schedules')
        .update({
          last_run_status: 'failed',
          last_run_error: error.message
        })
        .eq('id', schedule.id)
    }

    // Update next_scheduled_at
    await this.updateNextScheduledAt(schedule)
  }

  /**
   * Calculate and update next_scheduled_at
   */
  private async updateNextScheduledAt(schedule: DailyShowSchedule) {
    let nextRun: Date | null = null

    try {
      switch (schedule.schedule_type) {
        case 'cron':
          if (schedule.schedule_cron) {
            const interval = cronParser.parseExpression(schedule.schedule_cron, {
              tz: schedule.timezone || 'UTC'
            })
            nextRun = interval.next().toDate()
          }
          break

        case 'daily':
          if (schedule.schedule_time) {
            const [hour, minute] = schedule.schedule_time.split(':')
            const cronExpression = `${minute} ${hour} * * *`
            const interval = cronParser.parseExpression(cronExpression, {
              tz: schedule.timezone || 'UTC'
            })
            nextRun = interval.next().toDate()
          }
          break

        case 'weekly':
          if (schedule.schedule_time && schedule.schedule_days_of_week) {
            const [hour, minute] = schedule.schedule_time.split(':')
            const daysStr = schedule.schedule_days_of_week.join(',')
            const cronExpression = `${minute} ${hour} * * ${daysStr}`
            const interval = cronParser.parseExpression(cronExpression, {
              tz: schedule.timezone || 'UTC'
            })
            nextRun = interval.next().toDate()
          }
          break

        case 'interval':
          if (schedule.schedule_interval_hours) {
            const now = new Date()
            nextRun = new Date(now.getTime() + (schedule.schedule_interval_hours * 60 * 60 * 1000))
          }
          break
      }

      if (nextRun) {
        await this.supabase
          .from('daily_show_schedules')
          .update({ next_scheduled_at: nextRun.toISOString() })
          .eq('id', schedule.id)
      }
    } catch (error) {
      console.error(`[DailyShowScheduler] Error updating next_scheduled_at for ${schedule.id}:`, error)
    }
  }

  /**
   * Log a show run to history
   */
  private async logRun(scheduleId: string, status: string, result: any, errorMessage?: string) {
    await this.supabase
      .from('daily_show_run_history')
      .insert({
        schedule_id: scheduleId,
        topic_id: result?.topic_id,
        scheduled_for: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        status,
        show_date: result?.show?.date,
        show_name: result?.show?.name,
        script_length: result?.full_script?.length,
        duration_seconds: result?.show?.total_duration_seconds,
        stories_count: result?.show?.stories_count,
        audio_file_path: result?.audio_url,
        template_used: result?.template_id,
        host_used: result?.host?.name,
        topics_included: result?.segments?.stories,
        error_message: errorMessage,
        cost_llm_cents: result?.costs?.llm_cents || 0,
        cost_tts_cents: result?.costs?.tts_cents || 0
      })
  }

  /**
   * Periodic tick to check for manual updates
   */
  private async tick() {
    // This runs every minute to check if schedules were added/updated
    // Could reload schedules or use a pub/sub mechanism
  }

  /**
   * Reload a specific schedule (after update)
   */
  async reloadSchedule(scheduleId: string) {
    const { data: schedule } = await this.supabase
      .from('daily_show_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (schedule) {
      await this.setupSchedule(schedule)
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cronJobsCount: this.cronJobs.size,
      intervalJobsCount: this.intervalJobs.size
    }
  }
}

// Singleton instance
let schedulerInstance: DailyShowScheduler | null = null

export function getDailyShowScheduler(): DailyShowScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DailyShowScheduler()
  }
  return schedulerInstance
}
