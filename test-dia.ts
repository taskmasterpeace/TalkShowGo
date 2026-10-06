/**
 * Test Dia Multi-Voice TTS Service
 *
 * Quick test to verify Dia is working and demonstrate features
 */

import { generateDialogue, checkHealth, Emotion } from './src/lib/dia'
import * as fs from 'fs/promises'

async function main() {
  console.log('=== Dia Multi-Voice TTS Test ===\n')

  // 1. Check health
  console.log('[1] Checking Dia service health...')
  try {
    const health = await checkHealth()
    console.log(`✓ Status: ${health.status}`)
    console.log(`✓ Model: ${health.model}`)
    console.log(`✓ Device: ${health.device}`)
    console.log(`✓ Multi-voice: ${health.supports_multi_voice}`)
    console.log(`✓ Emotions: ${health.supported_emotions.length} supported`)
  } catch (error) {
    console.error('✗ Dia service not available:', (error as Error).message)
    console.error('\nMake sure Dia is running:')
    console.error('  docker compose up dia --build -d')
    process.exit(1)
  }

  // 2. Simple 2-voice test
  console.log('\n[2] Testing basic 2-voice dialogue...')
  try {
    const audio1 = await generateDialogue({
      segments: [
        { speaker: 1, text: 'Welcome to the test!' },
        { speaker: 2, text: 'Thanks for having me.' }
      ],
      seed: 42
    })
    await fs.writeFile('test-dia-basic.mp3', audio1)
    console.log(`✓ Generated: test-dia-basic.mp3 (${audio1.length} bytes)`)
  } catch (error) {
    console.error('✗ Failed:', (error as Error).message)
  }

  // 3. Emotional markers test
  console.log('\n[3] Testing emotional markers...')
  try {
    const audio2 = await generateDialogue({
      segments: [
        { speaker: 1, text: `Hey there! ${Emotion.laughs} This is incredible!` },
        { speaker: 2, text: `I know right? ${Emotion.whispers} This changes everything.` },
        { speaker: 1, text: `${Emotion.gasps} We can finally do multi-voice shows!` },
        { speaker: 2, text: `${Emotion.chuckle} About time!` }
      ],
      seed: 100
    })
    await fs.writeFile('test-dia-emotions.mp3', audio2)
    console.log(`✓ Generated: test-dia-emotions.mp3 (${audio2.length} bytes)`)
  } catch (error) {
    console.error('✗ Failed:', (error as Error).message)
  }

  // 4. Longer dialogue test
  console.log('\n[4] Testing longer dialogue...')
  try {
    const audio3 = await generateDialogue({
      segments: [
        {
          speaker: 1,
          text: `Good evening. I'm Maya Henderson, and you're listening to Orangeburg This Week. ${Emotion.chuckle} We've got some major news to cover today.`
        },
        {
          speaker: 2,
          text: `Thanks Maya. Marcus Williams here. ${Emotion.sighs} And honestly, this week showed us both the best and worst of our community.`
        },
        {
          speaker: 1,
          text: `Let's start with the good news. MCIS Manufacturing is bringing nearly 400 jobs to Orangeburg County.`
        },
        {
          speaker: 2,
          text: `400 jobs! ${Emotion.laughs} That's transformative. But we need to ask the tough questions about wages and local hiring.`
        }
      ],
      seed: 200
    })
    await fs.writeFile('test-dia-long.mp3', audio3)
    console.log(`✓ Generated: test-dia-long.mp3 (${audio3.length} bytes)`)
  } catch (error) {
    console.error('✗ Failed:', (error as Error).message)
  }

  // 5. Voice consistency test (same seed = same voices)
  console.log('\n[5] Testing voice consistency (same seed)...')
  try {
    const audio4a = await generateDialogue({
      segments: [
        { speaker: 1, text: 'Testing voice consistency.' },
        { speaker: 2, text: 'Should sound the same.' }
      ],
      seed: 999
    })

    const audio4b = await generateDialogue({
      segments: [
        { speaker: 1, text: 'Second generation with same seed.' },
        { speaker: 2, text: 'Should be same voices.' }
      ],
      seed: 999
    })

    await fs.writeFile('test-dia-consistent-1.mp3', audio4a)
    await fs.writeFile('test-dia-consistent-2.mp3', audio4b)
    console.log(`✓ Generated: test-dia-consistent-1.mp3 (${audio4a.length} bytes)`)
    console.log(`✓ Generated: test-dia-consistent-2.mp3 (${audio4b.length} bytes)`)
    console.log('  ℹ Listen to both - voices should match!')
  } catch (error) {
    console.error('✗ Failed:', (error as Error).message)
  }

  console.log('\n=== All Tests Complete ===')
  console.log('\nGenerated files:')
  console.log('  test-dia-basic.mp3       - Simple 2-voice dialogue')
  console.log('  test-dia-emotions.mp3    - Emotional markers demo')
  console.log('  test-dia-long.mp3        - Longer conversation')
  console.log('  test-dia-consistent-1.mp3')
  console.log('  test-dia-consistent-2.mp3')
  console.log('\nDia is ready to use! 🎉')
}

main().catch(console.error)
