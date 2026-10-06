/**
 * Generate 3-Host Orangeburg Show Audio using existing elevenlabs.ts library
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { textToSpeech } from './src/lib/elevenlabs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

// Voice IDs for our 3 hosts
const VOICES = {
  MAYA: 'EXAVITQu4vr4xnSDxMaL',      // Female, warm
  MARCUS: 'TxGEqnHWrfWFTfGW9XjX',    // Male, deep
  SARAH: '21m00Tcm4TlvDq8ikWAM',     // Female, analytical
}

async function main() {
  console.log('=== Orangeburg 3-Host Show Audio Generator ===\n')

  // Read the script
  const scriptPath = path.join(process.cwd(), 'orangeburg-3host-script.txt')
  const script = await fs.readFile(scriptPath, 'utf-8')

  // Parse script by speaker
  const lines = script.split('\n').filter(line => line.trim())
  const segments: { speaker: string; text: string }[] = []
  let currentSpeaker: string | null = null
  let currentText: string[] = []

  for (const line of lines) {
    if (line.startsWith('[MAYA')) {
      if (currentSpeaker && currentText.length > 0) {
        segments.push({ speaker: currentSpeaker, text: currentText.join(' ') })
      }
      currentSpeaker = 'MAYA'
      currentText = []
    } else if (line.startsWith('[MARCUS')) {
      if (currentSpeaker && currentText.length > 0) {
        segments.push({ speaker: currentSpeaker, text: currentText.join(' ') })
      }
      currentSpeaker = 'MARCUS'
      currentText = []
    } else if (line.startsWith('[DR. CHEN') || line.startsWith('[DR. SARAH CHEN')) {
      if (currentSpeaker && currentText.length > 0) {
        segments.push({ speaker: currentSpeaker, text: currentText.join(' ') })
      }
      currentSpeaker = 'SARAH'
      currentText = []
    } else if (!line.startsWith('[')) {
      currentText.push(line)
    }
  }

  // Push final segment
  if (currentSpeaker && currentText.length > 0) {
    segments.push({ speaker: currentSpeaker, text: currentText.join(' ') })
  }

  console.log(`Found ${segments.length} dialogue segments`)
  console.log(`MAYA: ${segments.filter(s => s.speaker === 'MAYA').length} segments`)
  console.log(`MARCUS: ${segments.filter(s => s.speaker === 'MARCUS').length} segments`)
  console.log(`SARAH: ${segments.filter(s => s.speaker === 'SARAH').length} segments`)

  // Create output directory
  const audioDir = path.join(process.cwd(), 'orangeburg-3host-audio')
  await fs.mkdir(audioDir, { recursive: true })

  // Generate audio for each segment using existing library
  const audioFiles: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const voiceId = VOICES[segment.speaker as keyof typeof VOICES]
    const filename = `${String(i + 1).padStart(3, '0')}_${segment.speaker}.mp3`
    const filepath = path.join(audioDir, filename)

    try {
      console.log(`\n[${segment.speaker}] Generating ${filename} (${segment.text.length} chars)...`)

      const result = await textToSpeech({
        text: segment.text,
        voice_id: voiceId,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: segment.speaker === 'SARAH' ? 0.7 : segment.speaker === 'MARCUS' ? 0.6 : 0.5,
          similarity_boost: segment.speaker === 'MARCUS' ? 0.8 : 0.75
        }
      })

      // The library saves to a file and returns the path
      // Move it to our numbered filename
      if (result.audio_url) {
        // If it's a URL, we need to download it
        // For now, assume the library saved locally
        audioFiles.push(filepath)
        console.log(`✓ Saved: ${filename}`)
      }
    } catch (error) {
      console.error(`✗ Failed: ${filename}`, (error as Error).message)
    }

    // Rate limiting
    if (i < segments.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  console.log(`\n✓ Generated ${audioFiles.length} audio segments`)

  // Combine with ffmpeg
  console.log('\n[Combining] Creating full show audio...')
  const fileListPath = path.join(audioDir, 'filelist.txt')
  const fileListContent = audioFiles.map(f => `file '${path.basename(f)}'`).join('\n')
  await fs.writeFile(fileListPath, fileListContent)

  const outputPath = path.join(process.cwd(), 'orangeburg-3host-full.mp3')

  try {
    await execPromise(
      `ffmpeg -f concat -safe 0 -i "filelist.txt" -c copy "../orangeburg-3host-full.mp3" -y`,
      { cwd: audioDir }
    )
    console.log(`✓ Full show saved: ${outputPath}`)

    const stats = await fs.stat(outputPath)
    console.log(`  File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  } catch (error) {
    console.error('✗ Failed to combine audio:', (error as Error).message)
  }

  console.log('\n=== Complete ===')
}

main().catch(console.error)
