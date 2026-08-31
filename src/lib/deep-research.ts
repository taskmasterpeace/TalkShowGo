/**
 * Deep Research Library
 *
 * Adapted from dzhng/deep-research (18.2k stars)
 * Uses iterative research: search → analyze → refine → search again
 *
 * Uses:
 * - SearXNG for web search (self-hosted)
 * - Presidium/Ollama for LLM (local, uses 4090)
 */

import { searchWeb, WebSearchResult } from './web-search'
import { supabase } from './db'

// Configuration
const LLM_ENDPOINT = process.env.DEEP_RESEARCH_LLM_ENDPOINT || process.env.PRESIDIUM_URL || 'http://localhost:11434'
const LLM_MODEL = process.env.DEEP_RESEARCH_MODEL || 'qwen3:14b'

export interface DeepResearchConfig {
  topic_id?: string
  query: string
  depth?: number      // How many iterations (default 3)
  breadth?: number    // Queries per iteration (default 3)
}

export interface DeepResearchProgress {
  currentDepth: number
  totalDepth: number
  currentBreadth: number
  totalBreadth: number
  currentQuery?: string
  totalQueries: number
  completedQueries: number
  learnings: string[]
}

export interface DeepResearchResult {
  run_id?: string
  query: string
  report: string           // Generated markdown report
  learnings: string[]      // All extracted learnings
  sources: string[]        // All visited URLs
  iterations: number
  total_queries: number
}

interface ResearchState {
  learnings: string[]
  visitedUrls: string[]
}

/**
 * Main deep research function
 * Recursively searches and learns about a topic
 */
export async function runDeepResearch(
  config: DeepResearchConfig,
  onProgress?: (progress: DeepResearchProgress) => void
): Promise<DeepResearchResult> {
  const { topic_id, query, depth = 3, breadth = 3 } = config

  // Create run record if topic_id provided
  let run_id: string | undefined
  if (topic_id) {
    const { data: run } = await supabase
      .from('intelligence_runs')
      .insert({
        topic_id,
        run_type: 'deep_research',
        query,
        status: 'running',
        metadata: { depth, breadth }
      })
      .select()
      .single()
    run_id = run?.id
  }

  try {
    // Run the recursive research
    const result = await deepResearch({
      query,
      breadth,
      depth,
      learnings: [],
      visitedUrls: [],
      onProgress
    })

    // Generate final report
    const report = await writeFinalReport({
      prompt: query,
      learnings: result.learnings,
      visitedUrls: result.visitedUrls
    })

    // Update run record
    if (run_id) {
      await supabase
        .from('intelligence_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: {
            depth,
            breadth,
            learnings_count: result.learnings.length,
            sources_count: result.visitedUrls.length
          }
        })
        .eq('id', run_id)
    }

    return {
      run_id,
      query,
      report,
      learnings: result.learnings,
      sources: result.visitedUrls,
      iterations: depth,
      total_queries: result.visitedUrls.length
    }
  } catch (error) {
    // Update run as failed
    if (run_id) {
      await supabase
        .from('intelligence_runs')
        .update({
          status: 'failed',
          metadata: { error: String(error) }
        })
        .eq('id', run_id)
    }
    throw error
  }
}

/**
 * Recursive research function
 */
async function deepResearch({
  query,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
  onProgress
}: {
  query: string
  breadth: number
  depth: number
  learnings?: string[]
  visitedUrls?: string[]
  onProgress?: (progress: DeepResearchProgress) => void
}): Promise<ResearchState> {
  // Generate search queries based on the topic and learnings so far
  const searchQueries = await generateSearchQueries({
    query,
    numQueries: breadth,
    learnings
  })

  const allLearnings = [...learnings]
  const allUrls = [...visitedUrls]

  // Process each search query
  for (const searchQuery of searchQueries) {
    onProgress?.({
      currentDepth: depth,
      totalDepth: depth,
      currentBreadth: breadth,
      totalBreadth: breadth,
      currentQuery: searchQuery.query,
      totalQueries: searchQueries.length,
      completedQueries: allUrls.length,
      learnings: allLearnings
    })

    try {
      // Search using SearXNG
      const results = await searchWeb(searchQuery.query, {
        max_results: 5,
        categories: ['general', 'news']
      })

      // Extract learnings from results
      const newLearnings = await extractLearnings({
        query: searchQuery.query,
        results,
        numLearnings: 3
      })

      // Add to our collection
      allLearnings.push(...newLearnings.learnings)
      allUrls.push(...results.map(r => r.url))

      // Recurse if we have more depth
      if (depth > 1 && newLearnings.followUpQuestions.length > 0) {
        const nextQuery = `
          Previous research: ${searchQuery.researchGoal}
          Follow-up questions: ${newLearnings.followUpQuestions.join(', ')}
        `.trim()

        const deeperResult = await deepResearch({
          query: nextQuery,
          breadth: Math.ceil(breadth / 2),
          depth: depth - 1,
          learnings: allLearnings,
          visitedUrls: allUrls,
          onProgress
        })

        allLearnings.push(...deeperResult.learnings)
        allUrls.push(...deeperResult.visitedUrls)
      }
    } catch (error) {
      console.error(`Error researching "${searchQuery.query}":`, error)
    }
  }

  // Deduplicate
  return {
    learnings: Array.from(new Set(allLearnings)),
    visitedUrls: Array.from(new Set(allUrls))
  }
}

/**
 * Generate search queries using LLM
 */
async function generateSearchQueries({
  query,
  numQueries = 3,
  learnings = []
}: {
  query: string
  numQueries?: number
  learnings?: string[]
}): Promise<Array<{ query: string; researchGoal: string }>> {
  const learningsContext = learnings.length > 0
    ? `\n\nPrevious learnings:\n${learnings.slice(-10).join('\n')}`
    : ''

  const prompt = `Given this research topic: "${query}"${learningsContext}

Generate ${numQueries} specific search queries to research this topic. Each query should explore a different aspect.

Respond in JSON format:
{
  "queries": [
    {"query": "search query 1", "researchGoal": "what we hope to learn"},
    {"query": "search query 2", "researchGoal": "what we hope to learn"}
  ]
}`

  try {
    const response = await callLLM(prompt)
    const parsed = JSON.parse(response)
    if (!parsed.queries || !Array.isArray(parsed.queries)) {
      console.warn('[DeepResearch] LLM response missing required "queries" array, falling back to simple query')
      return [{ query, researchGoal: 'General research on the topic' }]
    }
    return parsed.queries.slice(0, numQueries)
  } catch (error) {
    console.error('[DeepResearch] Failed to generate queries (invalid JSON from LLM):', error)
    // Fallback to simple query
    return [{ query, researchGoal: 'General research on the topic' }]
  }
}

/**
 * Extract learnings from search results using LLM
 */
async function extractLearnings({
  query,
  results,
  numLearnings = 3
}: {
  query: string
  results: WebSearchResult[]
  numLearnings?: number
}): Promise<{ learnings: string[]; followUpQuestions: string[] }> {
  if (results.length === 0) {
    return { learnings: [], followUpQuestions: [] }
  }

  const contents = results
    .map(r => `Title: ${r.title}\nSnippet: ${r.content}\nURL: ${r.url}`)
    .join('\n\n---\n\n')

  const prompt = `Analyze these search results for the query: "${query}"

Search Results:
${contents}

Extract key learnings and follow-up questions. Be specific and include names, dates, facts.

Respond in JSON format:
{
  "learnings": ["learning 1", "learning 2", "learning 3"],
  "followUpQuestions": ["follow up 1", "follow up 2"]
}`

  try {
    const response = await callLLM(prompt)
    const parsed = JSON.parse(response)
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[DeepResearch] LLM returned non-object JSON when extracting learnings, returning empty')
      return { learnings: [], followUpQuestions: [] }
    }
    return {
      learnings: Array.isArray(parsed.learnings) ? parsed.learnings.slice(0, numLearnings) : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.slice(0, 3) : []
    }
  } catch (error) {
    console.error('[DeepResearch] Failed to extract learnings (invalid JSON from LLM):', error)
    return { learnings: [], followUpQuestions: [] }
  }
}

/**
 * Write final report from all learnings
 */
async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls
}: {
  prompt: string
  learnings: string[]
  visitedUrls: string[]
}): Promise<string> {
  const learningsText = learnings
    .map((l, i) => `${i + 1}. ${l}`)
    .join('\n')

  const reportPrompt = `Write a comprehensive research report on: "${prompt}"

Based on these learnings from research:
${learningsText}

Write a detailed markdown report that:
1. Summarizes the key findings
2. Organizes information by topic/theme
3. Includes specific facts, names, and dates
4. Notes any conflicting information
5. Suggests areas for further research

Format the report with proper markdown headings and sections.`

  try {
    const report = await callLLM(reportPrompt)

    // Add sources section
    const sourcesSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`

    return report + sourcesSection
  } catch (error) {
    console.error('Failed to write report:', error)
    return `# Research Report: ${prompt}\n\n## Learnings\n\n${learningsText}\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`
  }
}

/**
 * Call local LLM (Presidium/Ollama)
 */
async function callLLM(prompt: string): Promise<string> {
  const response = await fetch(`${LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant. Respond in the exact JSON format requested. Be concise and factual.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4096
    })
  })

  if (!response.ok) {
    throw new Error(`LLM error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  // Try to extract JSON from the response if wrapped in markdown
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    return jsonMatch[1].trim()
  }

  return content.trim()
}

/**
 * Check if LLM is available
 */
export async function checkLLMHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${LLM_ENDPOINT}/v1/models`)
    return response.ok
  } catch {
    return false
  }
}
