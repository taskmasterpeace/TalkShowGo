#!/usr/bin/env node

/**
 * Test Prompt API Endpoints
 */

const API_BASE = 'http://localhost:3000'

async function testSavePrompt() {
  console.log('Testing: Save custom prompt override...\n')

  const response = await fetch(`${API_BASE}/api/prompts/show_intro`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: `Create an exciting intro for "{show_name}" with host {host_name}.

Today we're covering:
{story_list}

Make it punchy and engaging!`,
      notes: 'Simplified intro template for testing custom overrides',
    }),
  })

  const data = await response.json()
  console.log('Response:', JSON.stringify(data, null, 2))

  if (data.success) {
    console.log(`✅ Custom prompt saved! Version ${data.version}`)
  } else {
    console.log(`❌ Failed: ${data.error}`)
  }
}

async function testGetPrompt() {
  console.log('\n\nTesting: Get prompt with override...\n')

  const response = await fetch(`${API_BASE}/api/prompts/show_intro`)
  const data = await response.json()

  console.log('Active source:', data.active_source)
  console.log('Has custom override:', !!data.custom)

  if (data.custom) {
    console.log('Custom version:', data.custom.version)
    console.log('Custom notes:', data.custom.notes)
  }
}

async function testListPrompts() {
  console.log('\n\nTesting: List prompts with stats...\n')

  const response = await fetch(`${API_BASE}/api/prompts`)
  const data = await response.json()

  console.log('Total prompts:', data.stats.total)
  console.log('Customized prompts:', data.stats.customized)

  // Show customized prompts
  const customized = data.prompts.filter(p => p.has_override)
  if (customized.length > 0) {
    console.log('\nCustomized prompts:')
    customized.forEach(p => {
      console.log(`  - ${p.name} (v${p.override_version})`)
    })
  }
}

async function main() {
  console.log('🧪 Prompt API Test Suite\n')
  console.log('='.repeat(60))

  try {
    await testSavePrompt()
    await testGetPrompt()
    await testListPrompts()

    console.log('\n' + '='.repeat(60))
    console.log('✅ All tests completed!')
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

main()
