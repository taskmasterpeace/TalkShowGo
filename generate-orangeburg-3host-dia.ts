/**
 * Generate 3-Host Orangeburg Show Audio using Dia
 *
 * Uses Dia's multi-voice system with [S1]/[S2] tags and emotional markers
 * - Speaker 1: Maya Henderson (Female, Professional Journalist)
 * - Speaker 2: Marcus Williams (Male, Deep, Passionate)
 * - Alternates between S1 and S2 (Dia limitation: only 2 voices per generation)
 *
 * For 3 hosts, we'll generate in segments and vary the seed for the 3rd voice
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { generateDialogue, DialogueSegment, Emotion } from './src/lib/dia'

async function main() {
  console.log('=== Orangeburg 3-Host Show Audio Generator (Dia) ===\n')

  // Read the script (with Dia emotional markers)
  const scriptPath = path.join(process.cwd(), 'orangeburg-3host-script-dia.txt')
  const script = await fs.readFile(scriptPath, 'utf-8')

  // Parse script by speaker
  const lines = script.split('\n').filter(line => line.trim())
  const segments: Array<{ speaker: 'MAYA' | 'MARCUS' | 'SARAH'; text: string }> = []
  let currentSpeaker: 'MAYA' | 'MARCUS' | 'SARAH' | null = null
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

  console.log(`\nFound ${segments.length} dialogue segments`)
  console.log(`MAYA: ${segments.filter(s => s.speaker === 'MAYA').length} segments`)
  console.log(`MARCUS: ${segments.filter(s => s.speaker === 'MARCUS').length} segments`)
  console.log(`SARAH: ${segments.filter(s => s.speaker === 'SARAH').length} segments`)

  // Create output directory
  const audioDir = path.join(process.cwd(), 'orangeburg-3host-dia-audio')
  await fs.mkdir(audioDir, { recursive: true })

  console.log('\n=== Generating Audio with Dia ===')
  console.log('Strategy: Chunked generation with consistent seed (balance of quality & consistency)\n')

  // VOICE MAPPING FOR 2 CONSISTENT VOICES:
  // - S1 = Maya & Sarah (female voice)
  // - S2 = Marcus (male voice)
  // SAME SEED across all chunks = consistent voices

  // Map all segments to Dia format with ALTERNATING S1/S2
  console.log(`Mapping ${segments.length} segments to alternating dialogue format...`)

  const allDiaSegments: DialogueSegment[] = []
  let lastSpeakerSlot = 0

  for (const segment of segments) {
    const speakerSlot = lastSpeakerSlot === 1 ? 2 : 1
    allDiaSegments.push({
      speaker: speakerSlot,
      text: segment.text
    })
    lastSpeakerSlot = speakerSlot
  }

  // Split into chunks (Dia generates ~30 sec per call regardless of content)
  // For 30-min show, we need ~60 chunks, but let's try 15-20 for better consistency
  const CHUNK_SIZE = 2  // Just 2 segments per chunk for ~1 min each
  const chunks: DialogueSegment[][] = []
  for (let i = 0; i < allDiaSegments.length; i += CHUNK_SIZE) {
    chunks.push(allDiaSegments.slice(i, i + CHUNK_SIZE))
  }

  console.log(`  Split into ${chunks.length} chunks of ~${CHUNK_SIZE} segments each`)
  console.log(`\n=== Generating ${chunks.length} Audio Chunks ===`)
  console.log('Using seed 42 for all chunks (consistent voices)\n')

  const audioFiles: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`[Chunk ${i + 1}/${chunks.length}] Generating ${chunk.length} segments...`)

      const audioBuffer = await generateDialogue({
        segments: chunk,
        seed: 42,  // SAME SEED for all chunks
        temperature: 1.8,
        guidance_scale: 3.0,
        max_new_tokens: 25000  // 25K per chunk = ~6-8 min audio each
      })

      const filename = `chunk_${String(i + 1).padStart(2, '0')}.mp3`
      const filepath = path.join(audioDir, filename)
      await fs.writeFile(filepath, audioBuffer)
      audioFiles.push(filepath)

      const size = (audioBuffer.length / 1024).toFixed(1)
      console.log(`✓ Saved: ${filename} (${size} KB)`)

      // Small delay between chunks
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`\n✓ Generated ${audioFiles.length} chunks`)

    // Combine chunks using ffmpeg
    console.log('\n[Combining] Creating full show audio...')

    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execPromise = promisify(exec)

    const fileListPath = path.join(audioDir, 'filelist.txt')
    const fileListContent = audioFiles.map(f => `file '${path.basename(f)}'`).join('\n')
    await fs.writeFile(fileListPath, fileListContent)

    const outputPath = path.join(process.cwd(), 'orangeburg-3host-dia-full.mp3')

    await execPromise(
      `ffmpeg -f concat -safe 0 -i "filelist.txt" -c copy "../orangeburg-3host-dia-full.mp3" -y`,
      { cwd: audioDir }
    )

    const stats = await fs.stat(outputPath)
    console.log(`✓ Full show saved: ${outputPath}`)
    console.log(`  File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Chunks: ${audioFiles.length}`)
    console.log(`  Voices: 2 consistent (same seed throughout)`)
  } catch (error) {
    console.error('✗ Generation failed:', (error as Error).message)
    throw error
  }

  console.log('\n=== Generation Complete ===')
  console.log(`\nScript: orangeburg-3host-script.txt`)
  console.log(`Individual segments: orangeburg-3host-dia-audio/`)
  console.log(`Full show: orangeburg-3host-dia-full.mp3`)
  console.log(`\nPowered by Dia - Multi-Voice Dialogue Generation`)
}

main().catch(console.error)
