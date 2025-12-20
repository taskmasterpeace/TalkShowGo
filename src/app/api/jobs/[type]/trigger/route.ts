import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { addJob, isValidJobType, getValidJobTypes } from '@/lib/queue'

// POST /api/jobs/[type]/trigger - Manually trigger a job
export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const body = await request.json()
    const { topic_id } = body

    if (!topic_id) {
      return NextResponse.json(
        { error: 'topic_id is required' },
        { status: 400 }
      )
    }

    if (!isValidJobType(params.type)) {
      return NextResponse.json(
        { error: `Invalid job type. Valid types: ${getValidJobTypes().join(', ')}` },
        { status: 400 }
      )
    }

    // Create job run entry
    const { data: jobRun, error } = await supabase
      .from('job_runs')
      .insert({
        job_type: params.type,
        topic_id,
        status: 'queued',
      })
      .select()
      .single()

    if (error) throw error

    // Add to BullMQ queue
    const queueJobId = await addJob(params.type, {
      job_run_id: jobRun.id,
      topic_id,
    })

    return NextResponse.json({
      message: `Job ${params.type} queued`,
      job_run: jobRun,
      queue_job_id: queueJobId,
    })
  } catch (error) {
    console.error('Error triggering job:', error)
    return NextResponse.json(
      { error: 'Failed to trigger job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
