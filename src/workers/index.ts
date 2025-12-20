import { Worker, Queue } from 'bullmq'
import IORedis from 'ioredis'

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

// Define queues
export const ingestionQueue = new Queue('ingestion', { connection })
export const processingQueue = new Queue('processing', { connection })
export const editorialQueue = new Queue('editorial', { connection })

// Import job handlers
import { perimeterSweep } from './jobs/perimeter-sweep'
import { relayFetch } from './jobs/relay-fetch'
import { reconSearch } from './jobs/recon-search'
import { extractionRun } from './jobs/extraction-run'
import { auditScore } from './jobs/audit-score'
import { tribunalDiscover } from './jobs/tribunal-discover'
import { nexusBucket } from './jobs/nexus-bucket'
import { signalExport } from './jobs/signal-export'
import { transcriptFetch } from './jobs/transcript-fetch'

// Ingestion worker
const ingestionWorker = new Worker(
  'ingestion',
  async (job) => {
    console.log(`Processing ingestion job: ${job.name}`)

    switch (job.name) {
      case 'perimeter_sweep':
        return perimeterSweep(job.data)
      case 'relay_fetch':
        return relayFetch(job.data)
      case 'recon_search':
        return reconSearch(job.data)
      default:
        throw new Error(`Unknown job: ${job.name}`)
    }
  },
  { connection }
)

// Processing worker
const processingWorker = new Worker(
  'processing',
  async (job) => {
    console.log(`Processing processing job: ${job.name}`)

    switch (job.name) {
      case 'extraction_run':
        return extractionRun(job.data)
      case 'audit_score':
        return auditScore(job.data)
      case 'tribunal_discover':
        return tribunalDiscover(job.data)
      case 'transcript_fetch':
        return transcriptFetch(job.data)
      default:
        throw new Error(`Unknown job: ${job.name}`)
    }
  },
  { connection }
)

// Editorial worker
const editorialWorker = new Worker(
  'editorial',
  async (job) => {
    console.log(`Processing editorial job: ${job.name}`)

    switch (job.name) {
      case 'nexus_bucket':
        return nexusBucket(job.data)
      case 'signal_export':
        return signalExport(job.data)
      default:
        throw new Error(`Unknown job: ${job.name}`)
    }
  },
  { connection }
)

// Event handlers
const workers = [ingestionWorker, processingWorker, editorialWorker]

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err)
  })
})

console.log('Workers started')
