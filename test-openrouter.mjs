/**
 * Test OpenRouter connection and model selection
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

console.log('Testing OpenRouter API...')
console.log('API Key present:', !!OPENROUTER_API_KEY)

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found in .env.local')
  process.exit(1)
}

// Test 1: Simple completion with free model
console.log('\n📝 Test 1: Simple completion with Gemini 2.0 Flash (free)')
try {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://talkshowgo.com',
      'X-Title': 'Talk Show Go Test'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{
        role: 'user',
        content: 'Say "Hello from Talk Show Go!" in exactly 5 words.'
      }],
      max_tokens: 50
    })
  })

  const data = await response.json()

  if (data.error) {
    console.error('❌ Error:', data.error.message)
  } else {
    console.log('✅ Success!')
    console.log('Model:', data.model)
    console.log('Response:', data.choices[0].message.content)
    console.log('Tokens used:', data.usage.total_tokens)
  }
} catch (error) {
  console.error('❌ Error:', error.message)
}

// Test 2: Model selection simulation
console.log('\n🎭 Test 2: Model selection based on host personality')

const testHosts = [
  {
    name: 'Analytical Alex',
    opinion_strength: 85,
    analytical_depth: 90,
    aggression: 30,
    humor: 40,
    empathy: 60,
    speed: 50,
    formality: 80
  },
  {
    name: 'Quick Wit Quinn',
    opinion_strength: 70,
    analytical_depth: 50,
    aggression: 40,
    humor: 95,
    empathy: 60,
    speed: 90,
    formality: 30
  },
  {
    name: 'Aggressive Andy',
    opinion_strength: 90,
    analytical_depth: 40,
    aggression: 95,
    humor: 30,
    empathy: 20,
    speed: 80,
    formality: 40
  }
]

function selectModelForHost(host) {
  const { analytical_depth, opinion_strength, speed, humor, aggression } = host

  if (analytical_depth > 80 && opinion_strength > 70) {
    return 'anthropic/claude-opus-4.5'
  }
  if (speed > 80 && humor > 60) {
    return 'openai/gpt-4o'
  }
  if (aggression > 75) {
    return 'deepseek/deepseek-chat'
  }
  return 'google/gemini-2.0-flash-exp:free'
}

for (const host of testHosts) {
  const model = selectModelForHost(host)
  console.log(`${host.name}: ${model}`)
}

// Test 3: Fetch available models
console.log('\n📚 Test 3: Fetching available models...')
try {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  const models = data.data || []

  console.log(`✅ Found ${models.length} available models`)
  console.log('\nKey models for Talk Show Go:')

  const keyModels = [
    'anthropic/claude-opus-4.5',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'deepseek/deepseek-chat',
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3.3-70b-instruct'
  ]

  for (const modelId of keyModels) {
    const model = models.find(m => m.id === modelId || m.id.includes(modelId.split('/')[1]))
    if (model) {
      console.log(`  ✓ ${model.id}`)
      console.log(`    Context: ${model.context_length} tokens`)
      if (model.pricing) {
        console.log(`    Cost: $${model.pricing.prompt}/1K prompt, $${model.pricing.completion}/1K completion`)
      }
    } else {
      console.log(`  ? ${modelId} (checking...)`)
    }
  }
} catch (error) {
  console.error('❌ Error fetching models:', error.message)
}

console.log('\n✨ OpenRouter tests complete!')
