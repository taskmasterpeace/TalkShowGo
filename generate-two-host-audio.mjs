#!/usr/bin/env node

/**
 * Generate Two-Host Audio for Orangeburg Show
 *
 * This script:
 * 1. Reads the dialogue script
 * 2. Splits it by speaker (SARAH vs MARCUS)
 * 3. Generates audio for each line with the correct voice
 * 4. Saves individual segments (can be combined later)
 */

import { promises as fs } from 'fs'
import fetch from 'node-fetch'
import path from 'path'

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

// Voice IDs for our two hosts
const VOICES = {
  SARAH: 'EXAVITQu4vr4xnSDxMaL', // Sarah - female, warm
  MARCUS: 'TxGEqnHWrfWFTfGW9XjX'  // Josh - male, deep
}

async function parseScript(scriptPath) {
  const content = await fs.readFile(scriptPath, 'utf-8')
  const lines = content.split('\n')

  const segments = []

  for (const line of lines) {
    if (line.startsWith('SARAH:')) {
      segments.push({
        speaker: 'SARAH',
        voice_id: VOICES.SARAH,
        text: line.replace('SARAH:', '').trim()
      })
    } else if (line.startsWith('MARCUS:')) {
      segments.push({
        speaker: 'MARCUS',
        voice_id: VOICES.MARCUS,
        text: line.replace('MARCUS:', '').trim()
      })
    }
  }

  return segments
}

async function generateSpeech(text, voiceId, outputPath) {
  if (!ELEVENLABS_API_KEY) {
    console.log('⚠️  ELEVENLABS_API_KEY not set - skipping audio generation')
    console.log(`   Would generate: "${text.substring(0, 50)}..."`)
    return false
  }

  const response = await fetch(`${API_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  })

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.statusText}`)
  }

  const audioBuffer = await response.arrayBuffer()
  await fs.writeFile(outputPath, Buffer.from(audioBuffer))
  return true
}

async function main() {
  const scriptPath = 'orangeburg-show-script.txt'

  console.log('🎙️  GENERATING TWO-HOST AUDIO\n')
  console.log('='.repeat(60))
  console.log()

  // Parse script
  console.log('📖 Reading script...')
  const segments = await parseScript(scriptPath)
  console.log(`   Found ${segments.length} dialogue segments`)
  console.log()

  // Create output directory
  const outputDir = 'orangeburg-show-audio'
  await fs.mkdir(outputDir, { recursive: true })

  // Generate audio for each segment
  console.log('🔊 Generating audio segments...')
  console.log()

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const filename = `${String(i + 1).padStart(2, '0')}-${segment.speaker}.mp3`
    const outputPath = path.join(outputDir, filename)

    console.log(`   [${i + 1}/${segments.length}] ${segment.speaker}: ${segment.text.substring(0, 60)}...`)

    try {
      const success = await generateSpeech(segment.text, segment.voice_id, outputPath)
      if (success) {
        console.log(`       ✅ Saved to ${filename}`)
      }
    } catch (error) {
      console.log(`       ❌ Error: ${error.message}`)
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log()
  console.log('✅ Audio generation complete!')
  console.log()
  console.log('OUTPUT:')
  console.log(`   Directory: ${outputDir}/`)
  console.log(`   Files: ${segments.length} audio segments`)
  console.log()
  console.log('NEXT STEPS:')
  console.log('   1. Listen to individual segments in order')
  console.log('   2. Combine them using ffmpeg:')
  console.log('      ffmpeg -f concat -i filelist.txt -c copy orangeburg-show-full.mp3')
  console.log('   3. Or use audio editing software to combine and adjust')
  console.log()
}

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})
