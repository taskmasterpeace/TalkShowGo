/**
 * VibeVoice Benchmark Suite
 *
 * Tests generation performance for different content lengths:
 * - Short: 1-2 minutes
 * - Medium: 5-7 minutes
 * - Long: 10-14 minutes
 *
 * Metrics tracked:
 * - Generation time (seconds)
 * - RTF (Real-Time Factor)
 * - Audio duration
 * - Token counts
 */

import * as fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

interface BenchmarkResult {
  content_length: '1-2min' | '5-7min' | '10-14min'
  script_chars: number
  audio_duration_seconds: number
  generation_time_seconds: number
  rtf: number // Real-Time Factor (gen_time / audio_duration)
  tokens_generated: number
  timestamp: string
}

async function runBenchmark(
  scriptPath: string,
  contentLength: string
): Promise<BenchmarkResult> {
  const startTime = Date.now()

  // Run VibeVoice generation
  const { stdout, stderr } = await execPromise(
    `cd vibevoice && python demo/inference_from_file.py ` +
    `--model_path vibevoice/VibeVoice-1.5B ` +
    `--txt_path ../${scriptPath} ` +
    `--speaker_names Maya Marcus Sarah`
  )

  const endTime = Date.now()
  const generationTime = (endTime - startTime) / 1000

  // Parse output for metrics
  const durationMatch = stdout.match(/Audio duration: ([\d.]+) seconds/)
  const tokensMatch = stdout.match(/Generated tokens: (\d+)/)

  const audioDuration = parseFloat(durationMatch?.[1] || '0')
  const tokens = parseInt(tokensMatch?.[1] || '0')

  return {
    content_length: contentLength as any,
    script_chars: (await fs.readFile(scriptPath, 'utf-8')).length,
    audio_duration_seconds: audioDuration,
    generation_time_seconds: generationTime,
    rtf: generationTime / audioDuration,
    tokens_generated: tokens,
    timestamp: new Date().toISOString()
  }
}

async function main() {
  console.log('=== VibeVoice Benchmark Suite ===\n')

  const results: BenchmarkResult[] = []

  // Test 1: Short clip (1-2 min)
  console.log('[1/3] Testing 1-2 minute clip...')
  const short = await runBenchmark('test-clips/short-1min.txt', '1-2min')
  results.push(short)

  // Test 2: Medium clip (5-7 min)
  console.log('[2/3] Testing 5-7 minute clip...')
  const medium = await runBenchmark('test-clips/medium-5min.txt', '5-7min')
  results.push(medium)

  // Test 3: Long clip (10-14 min)
  console.log('[3/3] Testing 10-14 minute clip...')
  const long = await runBenchmark('test-clips/long-10min.txt', '10-14min')
  results.push(long)

  // Save results
  await fs.writeFile(
    'vibevoice-benchmarks.json',
    JSON.stringify(results, null, 2)
  )

  // Print summary
  console.log('\n=== Benchmark Results ===')
  for (const r of results) {
    console.log(`\n${r.content_length}:`)
    console.log(`  Audio: ${r.audio_duration_seconds}s`)
    console.log(`  Generation: ${r.generation_time_seconds}s`)
    console.log(`  RTF: ${r.rtf.toFixed(2)}x`)
    console.log(`  Tokens: ${r.tokens_generated}`)
  }
}

main().catch(console.error)
