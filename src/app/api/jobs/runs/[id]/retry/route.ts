/**
 * Job Retry API
 *
 * POST /api/jobs/[id]/retry
 * Retries a failed job run with the same parameters
 *
 * Use cases:
 * - Retry after temporary API failure
 * - Retry after fixing configuration
 * - Retry after rate limit cooldown
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getQueue } from '@/lib/queue'

// Map job types to queue names
const JOB_QUEUES: Record<string, string> = {
  perimeter_sweep: 'ingestion',
  relay_fetch: 'ingestion',
  recon_search: 'ingestion',
  extraction_run: 'processing',
  audit_score: 'processing',
  tribunal_discover: 'processing',
  nexus_bucket: 'editorial',
  signal_export: 'editorial',
  transcript_fetch: 'processing',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get the failed job run
    const { data: jobRun, error: jobError } = await supabase
      .from('job_runs')
      .select('*')
      .eq('id', id)
      .single()

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Job run not found' }, { status: 404 })
      }
      throw jobError
    }

    // Check if job is in a retryable state
    if (jobRun.status === 'running') {
      return NextResponse.json(
        { error: 'Job is still running. Wait for completion or cancel first.' },
        { status: 400 }
      )
    }

    if (jobRun.status === 'completed') {
      return NextResponse.json(
        { error: 'Job already completed successfully. Use force=true to re-run anyway.' },
        { status: 400 }
      )
    }

    // Get queue for this job type
    const queueName = JOB_QUEUES[jobRun.job_type]
    if (!queueName) {
      return NextResponse.json(
        { error: `Unknown job type: ${jobRun.job_type}` },
        { status: 400 }
      )
    }

    console.log(`[JobRetry] Retrying job ${id} (${jobRun.job_type}) for topic ${jobRun.topic_id}`)

    // Create a new job run record
    const { data: newJobRun, error: createError } = await supabase
      .from('job_runs')
      .insert({
        job_type: jobRun.job_type,
        topic_id: jobRun.topic_id,
        status: 'queued',
        metadata: {
          ...jobRun.metadata,
          retry_of: id,
          retry_count: (jobRun.metadata?.retry_count || 0) + 1,
          original_error: jobRun.errors?.[0]?.error || 'Unknown error',
        }
      })
      .select()
      .single()

    if (createError) throw createError

    // Queue the job
    const queue = getQueue(queueName)
    await queue.add(jobRun.job_type, {
      job_run_id: newJobRun.id,
      topic_id: jobRun.topic_id,
      // Include any original parameters
      ...jobRun.metadata?.params,
    })

    // Mark original job as "retried"
    await supabase
      .from('job_runs')
      .update({
        metadata: {
          ...jobRun.metadata,
          retried_at: new Date().toISOString(),
          retry_job_id: newJobRun.id,
        }
      })
      .eq('id', id)

    console.log(`[JobRetry] Created new job run ${newJobRun.id} as retry of ${id}`)

    return NextResponse.json({
      success: true,
      original_job_id: id,
      new_job_id: newJobRun.id,
      job_type: jobRun.job_type,
      topic_id: jobRun.topic_id,
      retry_count: (jobRun.metadata?.retry_count || 0) + 1,
      message: `Job queued for retry. New job ID: ${newJobRun.id}`,
    })

  } catch (error) {
    console.error('[JobRetry] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Failed to retry job. Check logs for details.'
      },
      { status: 500 }
    )
  }
}

// GET - Check if job is retryable
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: jobRun, error } = await supabase
      .from('job_runs')
      .select('id, job_type, status, errors, metadata, created_at')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Job run not found' }, { status: 404 })
      }
      throw error
    }

    const isRetryable = jobRun.status === 'failed'
    const retryCount = jobRun.metadata?.retry_count || 0
    const lastError = jobRun.errors?.[0]?.error || 'No error message'

    return NextResponse.json({
      id: jobRun.id,
      job_type: jobRun.job_type,
      status: jobRun.status,
      is_retryable: isRetryable,
      retry_count: retryCount,
      last_error: lastError,
      created_at: jobRun.created_at,
      message: isRetryable
        ? 'Job can be retried'
        : `Job is ${jobRun.status} and cannot be retried`,
    })

  } catch (error) {
    console.error('[JobRetry] GET Error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
