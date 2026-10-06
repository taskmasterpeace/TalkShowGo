/**
 * Generate Orangeburg 3-Host Show with VibeVoice
 *
 * Uses VibeVoice-1.5B (90-minute capacity, 4 speakers)
 * - Generates entire 30-minute show in ONE call
 * - Consistent voices throughout
 * - Preserves emotional markers
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'

const execPromise = promisify(exec)

async function main() {
  console.log('=== Orangeburg 3-Host Show - VibeVoice Generation ===\n')

  const scriptPath = path.join(process.cwd(), 'orangeburg-vibevoice.txt')
  const vibevoiceDir = path.join(process.cwd(), 'vibevoice')
  const outputDir = path.join(process.cwd(), 'orangeburg-vibevoice-audio')

  console.log(`Script: ${scriptPath}`)
  console.log(`VibeVoice: ${vibevoiceDir}`)
  console.log(`Output: ${outputDir}\n`)

  console.log('=== Generating Full Show (30 minutes) ===')
  console.log('Model: VibeVoice-1.5B (90-min capacity)')
  console.log('Speakers: Maya Henderson, Marcus Williams, Dr. Sarah Chen')
  console.log('Strategy: Single generation call for entire show\n')

  // Run VibeVoice inference
  const command = [
    'python',
    'demo/inference_from_file.py',
    '--model_path vibevoice/VibeVoice-1.5B',
    `--txt_path "${scriptPath}"`,
    '--speaker_names Maya Marcus Sarah'
  ].join(' ')

  console.log(`[VibeVoice] Generating audio...`)
  console.log(`Command: ${command}\n`)

  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd: vibevoiceDir,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer for output
    })

    if (stdout) console.log(stdout)
    if (stderr) console.error('Warnings:', stderr)

    console.log('\n=== Generation Complete ===')
    console.log(`Audio saved in: ${vibevoiceDir}/outputs/`)
    console.log('\nVibeVoice Features:')
    console.log('  - 3 consistent voices (Maya, Marcus, Sarah)')
    console.log('  - Emotional markers preserved')
    console.log('  - Single generation = no voice drift')
    console.log('  - 30-minute show generated in one pass')
  } catch (error) {
    console.error('✗ Generation failed:', (error as Error).message)
    throw error
  }
}

main().catch(console.error)
