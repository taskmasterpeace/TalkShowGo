/**
 * Generate Algorithm Institute Sample with YOUR cloned voice
 */

import fs from 'fs'
import path from 'path'

const ELEVENLABS_API_KEY = 'sk_eb2920aa8ad1feccdfbff3e2ce2fca633806b73c69d0b93a'
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

// YOUR cloned voice!
const BATTLERAP_ALGORITHM_VOICE_ID = 'ZJ7BlVZrxZKBDMTIK5c9'

// Sample narration script - Algorithm Institute style
const SCRIPT = `In the world of battle rap, legends aren't born. They're forged in the fire of verbal combat, tested by the culture, and remembered by the streets.

This is the Algorithm Institute of Battle Rap.

Every week, we break down the moments that shaped the culture. The battles that became legendary. The bars that still echo through the community. And the stories that the mainstream media will never tell you.

We don't make up facts. We investigate. We analyze. We present the truth, no matter who it makes uncomfortable.

Because in battle rap, your legacy isn't determined by your record deal or your social media following. It's determined by what happens on that stage, in front of that crowd, when the cameras are rolling and there's nowhere to hide.

The algorithm never lies. And neither do we.

Welcome to the Algorithm Institute.`

async function generateSpeech(text, voiceId) {
  console.log(`Generating speech with Battlerap Algorithm voice...`)

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
          similarity_boost: 0.85,
          style: 0.1,
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
    console.log('Using YOUR cloned voice: Battlerap Algorithm')
    console.log('Voice ID:', BATTLERAP_ALGORITHM_VOICE_ID)
    console.log('')

    // Generate the narration
    const audioBuffer = await generateSpeech(SCRIPT, BATTLERAP_ALGORITHM_VOICE_ID)

    // Save to public folder for UI access
    const outputDir = path.join(process.cwd(), 'public', 'audio')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const outputPath = path.join(outputDir, 'algorithm-institute-intro.mp3')
    fs.writeFileSync(outputPath, Buffer.from(audioBuffer))

    console.log(`\n✅ Audio saved to: ${outputPath}`)
    console.log(`\nYou can listen to it at: /audio/algorithm-institute-intro.mp3`)

    // Save voice info
    const voiceInfoPath = path.join(outputDir, 'voice-info.json')
    fs.writeFileSync(voiceInfoPath, JSON.stringify({
      voice_id: BATTLERAP_ALGORITHM_VOICE_ID,
      voice_name: 'Battlerap Algorithm (YOUR VOICE)',
      generated_at: new Date().toISOString(),
      script_length: SCRIPT.length,
    }, null, 2))

    console.log('\n🎤 Done! Your Algorithm Institute intro is ready.')

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
