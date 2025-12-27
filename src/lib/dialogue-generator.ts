/**
 * AI Dialogue Generator
 *
 * Generates natural multi-speaker dialogue from news stories
 * Uses LLM to create engaging conversation between co-hosts
 */

import { chat } from './presidium-ai'

export interface DialogueLine {
  speaker: string
  text: string
  emotion?: string  // 'excited', 'laughs', 'serious', 'interrupting', 'thoughtful'
}

export interface Speaker {
  name: string
  personality: string
  voice_id: string
  archetype: string  // 'anchor', 'analyst', 'hype', 'narrator', etc.
}

const DIALOGUE_PROMPT = `You are a professional dialogue writer for news talk shows.

TASK: Write a natural, engaging conversation between {speaker_count} co-hosts discussing the following news stories.

SPEAKERS:
{speaker_details}

STORIES:
{stories}

REQUIREMENTS:
1. Target length: {target_minutes} minutes (~{target_words} words)
2. Natural back-and-forth - not just taking turns
3. Include interruptions, agreements, follow-up questions
4. Show personality through dialogue
5. Use emotions: [excited], [laughs], [serious], [interrupting], [thoughtful]
6. Each speaker should talk 2-4 times per story minimum
7. Opening: Greet audience, introduce show and hosts
8. Story coverage: Discuss each story with depth and personality
9. Closing: Wrap up, sign off

FORMAT:
Return JSON array of dialogue lines:
[
  {"speaker": "sarah", "text": "Good evening everyone!", "emotion": "excited"},
  {"speaker": "marcus", "text": "Great to be here, Sarah.", "emotion": null},
  ...
]

IMPORTANT:
- Write natural conversation, not a script
- Include cross-talk and reactions
- Show chemistry between hosts
- Make it {target_minutes} minutes worth of dialogue
- Each line should be 1-3 sentences max
- Use the EXACT speaker names provided above`

/**
 * Generate AI dialogue for a multi-speaker show
 *
 * @param speakers - Array of speaker configurations with personalities
 * @param stories - Array of news stories to discuss
 * @param targetMinutes - Target show length in minutes (default: 5)
 * @returns Array of dialogue lines with speaker and text
 */
export async function generateDialogue(
  speakers: Speaker[],
  stories: Array<{ headline: string; summary: string }>,
  targetMinutes: number = 5
): Promise<DialogueLine[]> {
  const targetWords = targetMinutes * 150  // 150 words per minute

  // Format speaker details for the prompt
  const speakerDetails = speakers
    .map((s, i) => `${i + 1}. ${s.name} (${s.archetype}): ${s.personality}`)
    .join('\n')

  // Format stories for the prompt
  const storiesList = stories
    .map((s, i) => `Story ${i + 1}: ${s.headline}\n${s.summary}`)
    .join('\n\n')

  // Build the prompt
  const prompt = DIALOGUE_PROMPT
    .replace(/{speaker_count}/g, String(speakers.length))
    .replace('{speaker_details}', speakerDetails)
    .replace('{stories}', storiesList)
    .replace(/{target_minutes}/g, String(targetMinutes))
    .replace('{target_words}', String(targetWords))

  console.log(`[DialogueGenerator] Generating ${targetMinutes}-minute dialogue for ${speakers.length} speakers`)

  // Call LLM to generate dialogue
  const response = await chat(
    [
      {
        role: 'system',
        content: 'You are an expert dialogue writer. Return only valid JSON array of dialogue lines.',
      },
      { role: 'user', content: prompt },
    ],
    {
      temperature: 0.8,  // Higher temperature for creative dialogue
      max_tokens: 4000,
    }
  )

  // Parse JSON response
  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.error('[DialogueGenerator] Failed to parse LLM response:', response)
    throw new Error('Failed to parse dialogue from LLM response')
  }

  const dialogue: DialogueLine[] = JSON.parse(jsonMatch[0])

  console.log(`[DialogueGenerator] Generated ${dialogue.length} dialogue lines`)

  // Validate dialogue
  const unknownSpeakers = dialogue.filter(
    line => !speakers.some(s => s.name === line.speaker)
  )
  if (unknownSpeakers.length > 0) {
    console.warn(
      `[DialogueGenerator] Warning: Unknown speakers found:`,
      unknownSpeakers.map(l => l.speaker)
    )
  }

  return dialogue
}

/**
 * Generate a quick dialogue for testing
 * Uses placeholder data when stories aren't available
 */
export async function generateTestDialogue(
  speakers: Speaker[]
): Promise<DialogueLine[]> {
  const testStories = [
    {
      headline: 'Breaking News: Major Development in Local Community',
      summary: 'Community leaders announced a significant update today that will impact residents across the area.',
    },
    {
      headline: 'Weather Update: Conditions Improving',
      summary: 'After recent storms, weather conditions are expected to improve over the weekend.',
    },
  ]

  return generateDialogue(speakers, testStories, 3)  // 3-minute test show
}
