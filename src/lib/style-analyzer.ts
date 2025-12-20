/**
 * Style Analyzer
 *
 * Analyzes YouTube channel content to extract narrative style patterns.
 * Used to learn a creator's style for generating consistent content.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { getFreeYouTubeClient } from './youtube-api'
import { getMultipleTranscripts } from './transcript-fetcher'

// Requesty for Claude API
const REQUESTY_API_KEY = process.env.REQUESTY_API_KEY
const REQUESTY_URL = 'https://router.requesty.ai/v1/chat/completions'

const STYLES_DIR = path.join(process.cwd(), 'data', 'styles')

export interface StyleAnalysis {
  channel_id: string
  channel_name: string
  analyzed_at: string
  videos_analyzed: number

  // Patterns extracted by LLM
  opening_patterns: string[]
  closing_patterns: string[]
  transition_phrases: string[]
  tone_descriptors: string[]
  narrative_structure: string

  // Calculated metrics
  average_word_count: number
  average_sentence_length: number
  vocabulary_complexity: 'simple' | 'moderate' | 'complex'

  // Examples for reference
  example_segments: {
    type: 'opening' | 'transition' | 'closing'
    text: string
    video_title: string
  }[]

  // Raw data
  videos_used: {
    video_id: string
    title: string
    transcript_source: 'youtube_captions' | 'assemblyai'
  }[]
}

export interface StyleAnalysisOptions {
  video_count?: number       // Default 10
  random_selection?: boolean // Default true - random vs most recent
  save_to_file?: boolean     // Default true
}

/**
 * Call Claude API for style analysis
 */
async function callClaudeForStyleAnalysis(transcripts: string[]): Promise<any> {
  if (!REQUESTY_API_KEY) {
    throw new Error('REQUESTY_API_KEY is not configured')
  }

  const combinedTranscripts = transcripts
    .map((t, i) => `--- Video ${i + 1} ---\n${t.substring(0, 5000)}`)
    .join('\n\n')

  const prompt = `Analyze these video transcripts from a single YouTube channel and extract the creator's unique style patterns.

TRANSCRIPTS:
${combinedTranscripts}

Analyze the style and respond with JSON only:
{
  "opening_patterns": ["List 3-5 common ways the creator starts videos"],
  "closing_patterns": ["List 2-4 common ways videos end"],
  "transition_phrases": ["List 4-6 phrases used to transition between topics"],
  "tone_descriptors": ["List 3-5 words that describe the overall tone"],
  "narrative_structure": "Describe the typical structure in one sentence (e.g., 'Hook → Context → Main story → Analysis → Conclusion')",
  "vocabulary_complexity": "simple | moderate | complex",
  "style_summary": "2-3 sentence summary of the creator's unique voice and approach"
}

Focus on:
- Distinctive phrases and catchphrases
- How they address the audience
- Their storytelling approach
- Recurring language patterns
- Energy level and pacing cues`

  const response = await fetch(REQUESTY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${REQUESTY_API_KEY}`
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    })
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  return JSON.parse(jsonMatch[0])
}

/**
 * Calculate text metrics
 */
function calculateTextMetrics(transcripts: string[]): {
  average_word_count: number
  average_sentence_length: number
} {
  const wordCounts: number[] = []
  const sentenceLengths: number[] = []

  for (const transcript of transcripts) {
    // Word count per transcript
    const words = transcript.split(/\s+/).filter(w => w.length > 0)
    wordCounts.push(words.length)

    // Sentence lengths
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0)
    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0)
      sentenceLengths.push(sentenceWords.length)
    }
  }

  return {
    average_word_count: Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length),
    average_sentence_length: Math.round(sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length)
  }
}

/**
 * Extract example segments from transcripts
 */
function extractExampleSegments(
  transcripts: { text: string; title: string }[]
): StyleAnalysis['example_segments'] {
  const examples: StyleAnalysis['example_segments'] = []

  for (const { text, title } of transcripts.slice(0, 3)) {
    // Get opening (first ~100 words)
    const words = text.split(/\s+/)
    const opening = words.slice(0, 100).join(' ')
    if (opening) {
      examples.push({
        type: 'opening',
        text: opening,
        video_title: title
      })
    }

    // Get closing (last ~80 words)
    const closing = words.slice(-80).join(' ')
    if (closing && closing !== opening) {
      examples.push({
        type: 'closing',
        text: closing,
        video_title: title
      })
    }
  }

  return examples
}

/**
 * Main function - analyze a channel's style
 */
export async function analyzeChannelStyle(
  channelIdOrHandle: string,
  options?: StyleAnalysisOptions
): Promise<StyleAnalysis> {
  const videoCount = options?.video_count || 10
  const randomSelection = options?.random_selection ?? true
  const saveToFile = options?.save_to_file ?? true

  console.log(`[StyleAnalyzer] Analyzing channel: ${channelIdOrHandle}`)

  // 1. Get channel videos
  const youtube = getFreeYouTubeClient()
  const channelInfo = await youtube.getChannel(channelIdOrHandle)

  if (!channelInfo) {
    throw new Error(`Channel not found: ${channelIdOrHandle}`)
  }

  console.log(`[StyleAnalyzer] Found channel: ${channelInfo.title}`)

  // Get videos (more than needed for random selection)
  const videos = await youtube.getChannelVideos(channelIdOrHandle, videoCount * 2)

  if (videos.length === 0) {
    throw new Error(`No videos found for channel: ${channelInfo.title}`)
  }

  // Select videos (random or most recent)
  let selectedVideos = videos
  if (randomSelection && videos.length > videoCount) {
    // Shuffle and take N
    selectedVideos = [...videos]
      .sort(() => Math.random() - 0.5)
      .slice(0, videoCount)
  } else {
    selectedVideos = videos.slice(0, videoCount)
  }

  console.log(`[StyleAnalyzer] Selected ${selectedVideos.length} videos for analysis`)

  // 2. Get transcripts
  const videoIds = selectedVideos.map(v => v.id)
  const transcriptResults = await getMultipleTranscripts(videoIds, {
    prefer_youtube: true,
    enable_download: true
  })

  const successfulTranscripts = transcriptResults.filter(r => r.success && r.text)
  console.log(`[StyleAnalyzer] Got ${successfulTranscripts.length} transcripts`)

  if (successfulTranscripts.length < 3) {
    throw new Error(`Not enough transcripts for analysis (got ${successfulTranscripts.length}, need at least 3)`)
  }

  // 3. Analyze with LLM
  console.log('[StyleAnalyzer] Analyzing style with Claude...')
  const llmAnalysis = await callClaudeForStyleAnalysis(
    successfulTranscripts.map(t => t.text!)
  )

  // 4. Calculate metrics
  const metrics = calculateTextMetrics(successfulTranscripts.map(t => t.text!))

  // 5. Extract examples
  const examples = extractExampleSegments(
    successfulTranscripts.map((t, i) => ({
      text: t.text!,
      title: selectedVideos[i]?.title || 'Unknown'
    }))
  )

  // 6. Build result
  const analysis: StyleAnalysis = {
    channel_id: channelInfo.id,
    channel_name: channelInfo.title,
    analyzed_at: new Date().toISOString(),
    videos_analyzed: successfulTranscripts.length,

    opening_patterns: llmAnalysis.opening_patterns || [],
    closing_patterns: llmAnalysis.closing_patterns || [],
    transition_phrases: llmAnalysis.transition_phrases || [],
    tone_descriptors: llmAnalysis.tone_descriptors || [],
    narrative_structure: llmAnalysis.narrative_structure || '',
    vocabulary_complexity: llmAnalysis.vocabulary_complexity || 'moderate',

    average_word_count: metrics.average_word_count,
    average_sentence_length: metrics.average_sentence_length,

    example_segments: examples,

    videos_used: successfulTranscripts.map((t, i) => ({
      video_id: t.video_id,
      title: selectedVideos.find(v => v.id === t.video_id)?.title || 'Unknown',
      transcript_source: (t.source === 'assemblyai' ? 'assemblyai' : 'youtube_captions') as 'youtube_captions' | 'assemblyai'
    }))
  }

  // 7. Save to file
  if (saveToFile) {
    await fs.mkdir(STYLES_DIR, { recursive: true })
    const slug = channelInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)
    const filePath = path.join(STYLES_DIR, `${slug}.json`)
    await fs.writeFile(filePath, JSON.stringify(analysis, null, 2))
    console.log(`[StyleAnalyzer] Saved style profile to: ${filePath}`)
  }

  console.log(`[StyleAnalyzer] Analysis complete for ${channelInfo.title}`)

  return analysis
}

/**
 * Load a saved style profile
 */
export async function loadStyleProfile(channelSlug: string): Promise<StyleAnalysis | null> {
  try {
    const filePath = path.join(STYLES_DIR, `${channelSlug}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as StyleAnalysis
  } catch {
    return null
  }
}

/**
 * List available style profiles
 */
export async function listStyleProfiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(STYLES_DIR)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  } catch {
    return []
  }
}

/**
 * Generate a style prompt for story generation
 */
export function generateStylePrompt(style: StyleAnalysis): string {
  return `STYLE GUIDE for ${style.channel_name}:

TONE: ${style.tone_descriptors.join(', ')}
STRUCTURE: ${style.narrative_structure}
COMPLEXITY: ${style.vocabulary_complexity}

OPENING PATTERNS (use one of these styles):
${style.opening_patterns.map(p => `- "${p}"`).join('\n')}

TRANSITION PHRASES (use naturally throughout):
${style.transition_phrases.map(p => `- "${p}"`).join('\n')}

CLOSING PATTERNS (end with one of these):
${style.closing_patterns.map(p => `- "${p}"`).join('\n')}

EXAMPLE OPENINGS:
${style.example_segments.filter(e => e.type === 'opening').map(e => `"${e.text.substring(0, 200)}..."`).join('\n')}

Match this style in your writing. Be authentic to the creator's voice.`
}
