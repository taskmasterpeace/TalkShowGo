/**
 * Quick Dia Test - Simple 2-voice dialogue
 *
 * Tests Dia immediately when service is ready
 */

import fs from 'fs/promises'

const DIA_URL = 'http://localhost:8765'

async function main() {
  console.log('=== Quick Dia Test ===\n')

  // 1. Check health
  console.log('[1] Checking Dia health...')
  try {
    const healthRes = await fetch(`${DIA_URL}/health`)
    if (!healthRes.ok) {
      console.error('✗ Dia not ready yet')
      console.error('  Run: npm run dia:logs')
      process.exit(1)
    }
    const health = await healthRes.json()
    console.log(`✓ Status: ${health.status}`)
    console.log(`✓ Model: ${health.model}`)
    console.log(`✓ Device: ${health.device}`)
  } catch (error) {
    console.error('✗ Cannot connect to Dia at', DIA_URL)
    console.error('  Make sure Docker is running: npm run dia:logs')
    process.exit(1)
  }

  // 2. Generate simple dialogue
  console.log('\n[2] Generating 2-voice dialogue...')
  const text = '[S1] Welcome to the test! (laughs) This is Dia in action. [S2] Thanks for having me. (chuckle) This sounds incredible!'

  try {
    const response = await fetch(`${DIA_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        seed: 42,
        temperature: 1.8,
        guidance_scale: 3.0,
        output_format: 'mp3'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Dia error: ${response.status} - ${error}`)
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())
    await fs.writeFile('quick-dia-test.mp3', audioBuffer)

    console.log(`✓ Generated: quick-dia-test.mp3 (${audioBuffer.length} bytes)`)
    console.log('  Listen to verify quality!')
  } catch (error) {
    console.error('✗ Generation failed:', error.message)
    process.exit(1)
  }

  console.log('\n=== Test Complete ===')
  console.log('Dia is ready for production use! 🎉')
}

main().catch(console.error)
