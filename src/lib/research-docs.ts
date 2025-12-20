/**
 * Research Documentation Generator
 *
 * Generates Markdown and JSON documentation from research results.
 * Saves to data/research/{topic}/{date}/ directory.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type { WorkflowResult, ResearchSource } from './research-workflow'

const RESEARCH_DIR = path.join(process.cwd(), 'data', 'research')

export interface ResearchDocumentation {
  run_id: string
  query: string
  timestamp: string
  topic_id?: string

  // Summary stats
  videos_found: number
  transcripts_obtained: number
  transcripts_from_youtube: number
  transcripts_from_assemblyai: number

  // Sources with transcripts
  sources: SourceInfo[]

  // Entities mentioned across all transcripts
  entities_mentioned?: EntityMention[]

  // Errors encountered
  errors: string[]
}

export interface SourceInfo {
  video_id: string
  title: string
  channel: string
  url: string
  views?: number
  published_at?: string
  duration_seconds?: number
  transcript_source?: string
  transcript_confidence?: number
  transcript_length?: number
  relevance_score?: number
}

export interface EntityMention {
  name: string
  count: number
  sources: string[]  // video_ids where mentioned
}

/**
 * Create a slug from the query for use in filenames
 */
function createSlug(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

/**
 * Get today's date as YYYY-MM-DD
 */
function getDateString(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Extract entity mentions from transcripts
 */
function extractEntityMentions(sources: ResearchSource[]): EntityMention[] {
  const entityCounts = new Map<string, { count: number; sources: Set<string> }>()

  // Common battle rap entities to look for
  const knownEntities = [
    'URL', 'KOTD', 'RBE', 'Ultimate Rap League', 'King of the Dot', 'Rare Breed',
    'Smack', 'Beasley', 'Organik', 'ARP', 'Champion', 'Hollow',
    // Add more as needed - this is a basic list
  ]

  for (const source of sources) {
    if (!source.transcript) continue

    const transcript = source.transcript.toLowerCase()

    // Count known entities
    for (const entity of knownEntities) {
      const count = (transcript.match(new RegExp(entity.toLowerCase(), 'gi')) || []).length
      if (count > 0) {
        const existing = entityCounts.get(entity) || { count: 0, sources: new Set() }
        existing.count += count
        existing.sources.add(source.video_id)
        entityCounts.set(entity, existing)
      }
    }

    // Also look for capitalized words that might be names (simple heuristic)
    const potentialNames = source.transcript.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || []
    for (const name of potentialNames) {
      if (name.length > 3 && !['The', 'This', 'That', 'When', 'What', 'Where'].includes(name)) {
        const existing = entityCounts.get(name) || { count: 0, sources: new Set() }
        existing.count += 1
        existing.sources.add(source.video_id)
        entityCounts.set(name, existing)
      }
    }
  }

  // Convert to array and sort by count
  return Array.from(entityCounts.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      sources: Array.from(data.sources)
    }))
    .filter(e => e.count >= 3)  // Only include entities mentioned 3+ times
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)  // Top 50 entities
}

/**
 * Generate Markdown documentation
 */
function generateMarkdown(result: WorkflowResult, entities: EntityMention[]): string {
  const transcriptCount = result.transcripts_from_youtube + result.transcripts_from_assemblyai
  const sourcesWithTranscripts = result.sources.filter(s => s.transcript)

  let md = `# Research: ${result.query}

**Run ID:** ${result.run_id}
**Date:** ${new Date(result.started_at).toLocaleString()}
**Query:** ${result.query}
${result.query_plan ? `**Interpreted as:** ${result.query_plan.interpreted_as}` : ''}

---

## Summary

| Metric | Value |
|--------|-------|
| Videos Found | ${result.videos_found} |
| Videos Analyzed | ${result.videos_filtered} |
| Transcripts Obtained | ${transcriptCount} |
| From YouTube Captions | ${result.transcripts_from_youtube} |
| From AssemblyAI | ${result.transcripts_from_assemblyai} |
| Failed | ${result.transcripts_failed} |
| Success Rate | ${((transcriptCount / result.videos_filtered) * 100).toFixed(1)}% |

---

## Sources

`

  // Add each source
  for (let i = 0; i < sourcesWithTranscripts.length; i++) {
    const source = sourcesWithTranscripts[i]
    const wordCount = source.transcript?.split(/\s+/).length || 0

    md += `### ${i + 1}. ${source.title}

- **Channel:** ${source.channel}
- **URL:** ${source.url}
- **Views:** ${source.views?.toLocaleString() || 'Unknown'}
- **Published:** ${source.published_at || 'Unknown'}
- **Duration:** ${source.duration_seconds ? `${Math.round(source.duration_seconds / 60)} min` : 'Unknown'}
- **Transcript Source:** ${source.transcript_source || 'Unknown'}${source.transcript_confidence ? ` (confidence: ${(source.transcript_confidence * 100).toFixed(1)}%)` : ''}
- **Word Count:** ${wordCount.toLocaleString()}
- **Relevance Score:** ${source.relevance_score || 0}

`
  }

  // Add entities section
  if (entities.length > 0) {
    md += `---

## Entities Mentioned

| Entity | Mentions | Sources |
|--------|----------|---------|
`
    for (const entity of entities.slice(0, 20)) {
      md += `| ${entity.name} | ${entity.count} | ${entity.sources.length} videos |\n`
    }
  }

  // Add search queries used
  if (result.query_plan) {
    md += `
---

## Search Queries Used

### Primary Queries
${result.query_plan.primary_queries.map(q => `- ${q}`).join('\n')}

### Secondary Queries
${result.query_plan.secondary_queries.map(q => `- ${q}`).join('\n')}
`
  }

  // Add errors if any
  if (result.errors.length > 0) {
    md += `
---

## Errors

${result.errors.map(e => `- [${e.stage}] ${e.video_id ? `(${e.video_id}) ` : ''}${e.message}`).join('\n')}
`
  }

  // Add transcripts section
  md += `
---

## Transcripts

<details>
<summary>Click to expand full transcripts</summary>

`

  for (const source of sourcesWithTranscripts) {
    md += `### ${source.title}

\`\`\`
${source.transcript?.substring(0, 5000)}${source.transcript && source.transcript.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`

`
  }

  md += `</details>

---

*Generated by Talk Show Go Research Pipeline*
`

  return md
}

/**
 * Generate JSON documentation
 */
function generateJSON(result: WorkflowResult, entities: EntityMention[]): ResearchDocumentation {
  return {
    run_id: result.run_id,
    query: result.query,
    timestamp: result.started_at,

    videos_found: result.videos_found,
    transcripts_obtained: result.transcripts_from_youtube + result.transcripts_from_assemblyai,
    transcripts_from_youtube: result.transcripts_from_youtube,
    transcripts_from_assemblyai: result.transcripts_from_assemblyai,

    sources: result.sources.map(s => ({
      video_id: s.video_id,
      title: s.title,
      channel: s.channel,
      url: s.url,
      views: s.views,
      published_at: s.published_at,
      duration_seconds: s.duration_seconds,
      transcript_source: s.transcript_source,
      transcript_confidence: s.transcript_confidence,
      transcript_length: s.transcript?.length,
      relevance_score: s.relevance_score
    })),

    entities_mentioned: entities,

    errors: result.errors.map(e => `[${e.stage}] ${e.message}`)
  }
}

/**
 * Main function - generate and save research documentation
 */
export async function generateResearchDocs(
  result: WorkflowResult,
  topicId?: string
): Promise<{ markdown_path: string; json_path: string }> {
  const dateStr = getDateString()
  const slug = createSlug(result.query)

  // Create output directory
  const topicDir = topicId || 'general'
  const outputDir = path.join(RESEARCH_DIR, topicDir, dateStr)
  await fs.mkdir(outputDir, { recursive: true })

  // Extract entities from transcripts
  const entities = extractEntityMentions(result.sources)

  // Generate markdown
  const markdown = generateMarkdown(result, entities)
  const mdPath = path.join(outputDir, `${slug}.md`)
  await fs.writeFile(mdPath, markdown, 'utf-8')
  console.log(`[ResearchDocs] Saved markdown: ${mdPath}`)

  // Generate JSON
  const json = generateJSON(result, entities)
  const jsonPath = path.join(outputDir, `${slug}.json`)
  await fs.writeFile(jsonPath, JSON.stringify(json, null, 2), 'utf-8')
  console.log(`[ResearchDocs] Saved JSON: ${jsonPath}`)

  // Also save full transcripts separately (they can be large)
  const transcriptsPath = path.join(outputDir, `${slug}-transcripts.json`)
  const transcripts = result.sources
    .filter(s => s.transcript)
    .map(s => ({
      video_id: s.video_id,
      title: s.title,
      transcript: s.transcript
    }))
  await fs.writeFile(transcriptsPath, JSON.stringify(transcripts, null, 2), 'utf-8')
  console.log(`[ResearchDocs] Saved transcripts: ${transcriptsPath}`)

  return {
    markdown_path: mdPath,
    json_path: jsonPath
  }
}
