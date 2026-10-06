/**
 * Direct test of content repurposing - bypass broken research workflow
 * Uses the original transcript to generate an engaging documentary script
 */

import * as fs from 'fs'

// Load env vars manually
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const OPENROUTER_API_KEY = envVars.OPENROUTER_API_KEY

async function getTranscript(videoId) {
  const response = await fetch(`http://localhost:3000/api/youtube/video/${videoId}/transcript`)
  const data = await response.json()
  return data.full_text
}

async function generateScript(transcript, title) {
  const prompt = `You are the Algorithm Institute, a documentary narrator for battle rap content. Your style is engaging, dramatic, and knowledgeable - like a sports commentator mixed with a historian.

You're creating a NEW documentary-style show based on this source video: "${title}"

ORIGINAL CONTENT:
${transcript.slice(0, 15000)}

Create a compelling 5-7 minute documentary script (about 800-1000 words) that:
1. Opens with a dramatic hook that grabs attention
2. Provides context and background for viewers who may not know the full story
3. Includes your analysis and expert commentary
4. Uses vivid language and storytelling techniques
5. Ends with a thought-provoking conclusion

Write in first person as the Algorithm Institute host. Make it feel like a premium documentary, not just a summary of the original video.

DO NOT just summarize - ELEVATE the content with your unique perspective and storytelling.`

  console.log('Calling OpenRouter API...')
  console.log('API Key prefix:', OPENROUTER_API_KEY?.slice(0, 10) + '...')

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'TalkShowGo'
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat',
      messages: [
        { role: 'system', content: 'You are the Algorithm Institute, a battle rap documentary narrator. Write engaging, dramatic content.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.8
    })
  })

  const data = await response.json()
  console.log('Response status:', response.status)
  if (!response.ok) {
    console.error('API Error:', JSON.stringify(data, null, 2))
    throw new Error(`API failed: ${data.error?.message || 'Unknown error'}`)
  }
  if (!data.choices || !data.choices[0]) {
    console.error('Unexpected response:', JSON.stringify(data, null, 2))
    throw new Error('No choices in response')
  }
  return data.choices[0].message.content
}

async function main() {
  const videoId = 'UTWxUdK1pQU'
  const title = 'Battle Wrap Up: Top 5 Events Of 2025'

  console.log('Fetching transcript...')
  const transcript = await getTranscript(videoId)
  console.log(`Transcript length: ${transcript.length} chars\n`)

  console.log('Generating documentary script...')
  const script = await generateScript(transcript, title)

  console.log('\n' + '='.repeat(80))
  console.log('GENERATED SCRIPT')
  console.log('='.repeat(80) + '\n')
  console.log(script)
  console.log('\n' + '='.repeat(80))
  console.log(`Word count: ${script.split(/\s+/).length}`)
}

main().catch(console.error)
