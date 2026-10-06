/**
 * Generate 3-Host Orangeburg Show Audio
 *
 * Uses ElevenLabs to create audio with 3 distinct voices:
 * - Maya Henderson (Female, Professional Journalist)
 * - Marcus Williams (Male, Deep, Passionate)
 * - Dr. Sarah Chen (Female, Analytical, Measured)
 */

import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env file manually
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env')
    const envContent = fsSync.readFileSync(envPath, 'utf-8')
    const envVars = {}

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          envVars[key] = valueParts.join('=')
        }
      }
    }

    return envVars
  } catch (error) {
    return {}
  }
}

const env = loadEnv()

// ElevenLabs API Configuration
const ELEVEN_API_KEY = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY
const ELEVEN_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

if (!ELEVEN_API_KEY) {
  console.error('ERROR: ELEVENLABS_API_KEY not found')
  console.error('Check .env file or environment variables')
  process.exit(1)
}

console.log(`✓ API key loaded: ${ELEVEN_API_KEY.substring(0, 8)}...`)

// Voice IDs for our 3 hosts
const VOICES = {
  MAYA: 'EXAVITQu4vr4xnSDxMaL',      // Sarah - warm female voice
  MARCUS: 'TxGEqnHWrfWFTfGW9XjX',    // Marcus - deep male voice
  SARAH: '21m00Tcm4TlvDq8ikWAM',     // Rachel - analytical female voice
}

// Voice settings for each host
const VOICE_SETTINGS = {
  MAYA: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true
  },
  MARCUS: {
    stability: 0.6,
    similarity_boost: 0.8,
    style: 0.2,  // More expressive
    use_speaker_boost: true
  },
  SARAH: {
    stability: 0.7,  // More stable/consistent
    similarity_boost: 0.7,
    style: 0.0,
    use_speaker_boost: true
  }
}

async function generateSpeech(text, voiceId, voiceName, settings) {
  console.log(`\n[${voiceName}] Generating audio (${text.length} chars)...`)

  const response = await fetch(`${ELEVEN_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVEN_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: settings
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`ElevenLabs API error for ${voiceName}: ${response.status} - ${error}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

async function main() {
  console.log('=== Orangeburg 3-Host Show Audio Generator ===\n')

  // Read the script
  const scriptPath = path.join(__dirname, 'orangeburg-3host-script.txt')
  const script = await fs.readFile(scriptPath, 'utf-8')

  // Parse script by speaker
  const lines = script.split('\n').filter(line => line.trim())
  const segments = []
  let currentSpeaker = null
  let currentText = []

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
  const audioDir = path.join(__dirname, 'orangeburg-3host-audio')
  await fs.mkdir(audioDir, { recursive: true })

  // Generate audio for each segment
  const audioFiles = []
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const voiceId = VOICES[segment.speaker]
    const settings = VOICE_SETTINGS[segment.speaker]
    const filename = `${String(i + 1).padStart(3, '0')}_${segment.speaker}.mp3`
    const filepath = path.join(audioDir, filename)

    try {
      const audioBuffer = await generateSpeech(
        segment.text,
        voiceId,
        segment.speaker,
        settings
      )
      await fs.writeFile(filepath, audioBuffer)
      audioFiles.push(filepath)
      console.log(`✓ Saved: ${filename}`)
    } catch (error) {
      console.error(`✗ Failed: ${filename}`, error.message)
    }

    // Rate limiting - wait 500ms between requests
    if (i < segments.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  console.log(`\n✓ Generated ${audioFiles.length} audio segments`)

  // Combine all segments using ffmpeg
  console.log('\n[Combining] Creating full show audio...')

  const fileListPath = path.join(audioDir, 'filelist.txt')
  const fileListContent = audioFiles.map(f => `file '${path.basename(f)}'`).join('\n')
  await fs.writeFile(fileListPath, fileListContent)

  const outputPath = path.join(__dirname, 'orangeburg-3host-full.mp3')

  try {
    await execPromise(
      `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputPath}" -y`,
      { cwd: audioDir }
    )
    console.log(`✓ Full show saved: ${outputPath}`)

    // Get file stats
    const stats = await fs.stat(outputPath)
    console.log(`  File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  } catch (error) {
    console.error('✗ Failed to combine audio:', error.message)
  }

  console.log('\n=== Generation Complete ===')
  console.log(`\nScript: orangeburg-3host-script.txt`)
  console.log(`Individual segments: orangeburg-3host-audio/`)
  console.log(`Full show: orangeburg-3host-full.mp3`)
}

main().catch(console.error)
