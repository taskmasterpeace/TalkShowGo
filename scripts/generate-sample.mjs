/**
 * Generate Algorithm Institute Sample Narration
 * Using ElevenLabs API
 */

import fs from 'fs'
import path from 'path'

const ELEVENLABS_API_KEY = 'sk_eb2920aa8ad1feccdfbff3e2ce2fca633806b73c69d0b93a'
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

// Sample narration script - Algorithm Institute style
const SCRIPT = `In the world of battle rap, legends aren't born. They're forged in the fire of verbal combat, tested by the culture, and remembered by the streets.

This is the Algorithm Institute of Battle Rap.

Every week, we break down the moments that shaped the culture. The battles that became legendary. The bars that still echo through the community. And the stories that the mainstream media will never tell you.

We don't make up facts. We investigate. We analyze. We present the truth, no matter who it makes uncomfortable.

Because in battle rap, your legacy isn't determined by your record deal or your social media following. It's determined by what happens on that stage, in front of that crowd, when the cameras are rolling and there's nowhere to hide.

The algorithm never lies. And neither do we.

Welcome to the Algorithm Institute.`

async function listVoices() {
  console.log('Fetching available ElevenLabs voices...\n')

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.statusText}`)
  }

  const data = await response.json()

  console.log('Available voices:')
  console.log('=================')
  for (const voice of data.voices) {
    console.log(`- ${voice.name} (${voice.voice_id})`)
    console.log(`  Category: ${voice.category}`)
    if (voice.labels) {
      console.log(`  Labels: ${JSON.stringify(voice.labels)}`)
    }
    console.log('')
  }

  return data.voices
}

async function generateSpeech(text, voiceId) {
  console.log(`\nGenerating speech with voice ${voiceId}...`)

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.8,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Speech generation failed: ${error}`)
  }

  return response.arrayBuffer()
}

async function main() {
  try {
    // List available voices
    const voices = await listVoices()

    // Find a good narrator voice (deep, male, narrative style)
    // Common good ones: Adam, Josh, Antoni, or any with "narrative" label
    let selectedVoice = voices.find(v =>
      v.name.toLowerCase().includes('adam') ||
      v.name.toLowerCase().includes('josh') ||
      (v.labels && v.labels.accent === 'american' && v.labels.gender === 'male')
    )

    if (!selectedVoice) {
      // Just use the first available voice
      selectedVoice = voices[0]
    }

    console.log(`\nSelected voice: ${selectedVoice.name} (${selectedVoice.voice_id})`)

    // Generate the narration
    const audioBuffer = await generateSpeech(SCRIPT, selectedVoice.voice_id)

    // Save to public folder for UI access
    const outputDir = path.join(process.cwd(), 'public', 'audio')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const outputPath = path.join(outputDir, 'algorithm-institute-intro.mp3')
    fs.writeFileSync(outputPath, Buffer.from(audioBuffer))

    console.log(`\n✅ Audio saved to: ${outputPath}`)
    console.log(`\nYou can listen to it at: /audio/algorithm-institute-intro.mp3`)

    // Also save voice info for later
    const voiceInfoPath = path.join(outputDir, 'voice-info.json')
    fs.writeFileSync(voiceInfoPath, JSON.stringify({
      voice_id: selectedVoice.voice_id,
      voice_name: selectedVoice.name,
      generated_at: new Date().toISOString(),
      script_length: SCRIPT.length,
    }, null, 2))

    console.log('\nDone!')

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
