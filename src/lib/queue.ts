import { Queue } from 'bullmq'
import IORedis from 'ioredis'

// Create a connection for queue operations (not workers)
const getConnection = () => {
  return new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  })
}

// Job type to queue mapping
const JOB_QUEUE_MAP: Record<string, string> = {
  // Ingestion jobs
  perimeter_sweep: 'ingestion',
  relay_fetch: 'ingestion',
  recon_search: 'ingestion',
  // Processing jobs
  extraction_run: 'processing',
  audit_score: 'processing',
  tribunal_discover: 'processing',
  transcript_fetch: 'processing',
  // Editorial jobs
  nexus_bucket: 'editorial',
  signal_export: 'editorial',
}

// Queue instances (lazy-loaded)
let queues: Record<string, Queue> = {}

export function getQueue(queueName: string): Queue {
  if (!queues[queueName]) {
    queues[queueName] = new Queue(queueName, { connection: getConnection() })
  }
  return queues[queueName]
}

export interface JobData {
  job_run_id: string
  topic_id: string
  [key: string]: unknown
}

/**
 * Add a job to the appropriate queue
 */
export async function addJob(jobType: string, data: JobData): Promise<string> {
  const queueName = JOB_QUEUE_MAP[jobType]
  if (!queueName) {
    throw new Error(`Unknown job type: ${jobType}`)
  }

  const queue = getQueue(queueName)
  const job = await queue.add(jobType, data, {
    removeOnComplete: 100,
    removeOnFail: 50,
  })

  console.log(`Added job ${jobType} to ${queueName} queue: ${job.id}`)
  return job.id || ''
}

/**
 * Get all valid job types
 */
export function getValidJobTypes(): string[] {
  return Object.keys(JOB_QUEUE_MAP)
}

/**
 * Check if a job type is valid
 */
export function isValidJobType(jobType: string): boolean {
  return jobType in JOB_QUEUE_MAP
}
