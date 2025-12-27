/**
 * Research Package Markdown Generator
 *
 * Converts a ResearchPackage to a well-organized Markdown document
 * for human consumption.
 */

import type {
  ResearchPackage,
  YouTubeSourceItem,
  TweetSourceItem,
  ProcessedEntity,
  ProcessedClaim,
  KeyFact,
  QuoteItem,
  ProducerWarning,
  ScriptSection,
  TalkingPoint,
  InterviewItem,
} from '@/types/research-package'

export interface MarkdownOptions {
  includeTranscripts?: boolean
  transcriptPreviewLength?: number
  includeRawSources?: boolean
  includeHostMaterials?: boolean
  collapsibleSections?: boolean
}

/**
 * Generate complete Markdown from a ResearchPackage
 */
export function generateMarkdown(
  pkg: ResearchPackage,
  options: MarkdownOptions = {}
): string {
  const {
    includeTranscripts = true,
    transcriptPreviewLength = 500,
    includeRawSources = true,
    includeHostMaterials = true,
    collapsibleSections = true,
  } = options

  const sections: string[] = []

  // Header
  sections.push(generateHeader(pkg))

  // Quick Stats
  sections.push(generateQuickStats(pkg))

  // Executive Summary
  sections.push(generateExecutiveSummary(pkg))

  // Key Facts
  sections.push(generateKeyFacts(pkg.producer.key_facts))

  // Entity Glossary
  sections.push(generateEntityGlossary(pkg.intelligence.entities))

  // Producer Warnings
  if (pkg.producer.warnings.length > 0) {
    sections.push(generateWarnings(pkg.producer.warnings))
  }

  // Quotes to Use
  if (pkg.producer.quotes_to_use.length > 0) {
    sections.push(generateQuotes(pkg.producer.quotes_to_use))
  }

  // Host Materials (Script Outline, Talking Points)
  if (includeHostMaterials) {
    sections.push(generateHostMaterials(pkg))
  }

  // Interviews
  if (pkg.interviews.interviews.length > 0) {
    sections.push(
      generateInterviews(pkg.interviews.interviews, includeTranscripts, transcriptPreviewLength, collapsibleSections)
    )
  }

  // Twitter Reactions
  if (pkg.twitter) {
    sections.push(generateTwitterSection(pkg))
  }

  // Claims & Verdicts
  if (pkg.intelligence.claims.length > 0) {
    sections.push(generateClaims(pkg.intelligence.claims))
  }

  // Source Transcripts
  if (includeTranscripts && pkg.raw_sources.youtube_videos.some(v => v.transcript_text)) {
    sections.push(
      generateTranscripts(pkg.raw_sources.youtube_videos, transcriptPreviewLength, collapsibleSections)
    )
  }

  // Raw Source List
  if (includeRawSources) {
    sections.push(generateRawSourceList(pkg))
  }

  // Footer
  sections.push(generateFooter(pkg))

  return sections.join('\n\n---\n\n')
}

// ========== SECTION GENERATORS ==========

function generateHeader(pkg: ResearchPackage): string {
  return `# Research Package: ${pkg.producer.story_summary.headline}

**Package ID:** \`${pkg.metadata.package_id}\`
**Generated:** ${new Date(pkg.metadata.generated_at).toLocaleString()}
**Query:** "${pkg.metadata.original_query}"
${pkg.metadata.interpreted_query ? `**Interpreted as:** "${pkg.metadata.interpreted_query}"` : ''}`
}

function generateQuickStats(pkg: ResearchPackage): string {
  const stats = pkg.metadata.stats
  return `## Quick Stats

| Metric | Value |
|--------|-------|
| Sources | ${stats.sources_count} |
| Transcripts | ${stats.transcripts_count} (${stats.total_transcript_words.toLocaleString()} words) |
| Entities | ${stats.entities_count} |
| Claims | ${stats.claims_count} |
| Interviews | ${stats.interviews_count} |
| Documents | ${stats.documents_count} |
| Twitter | ${stats.twitter_tweets_count} tweets |
${stats.research_cost_cents ? `| Cost | $${(stats.research_cost_cents / 100).toFixed(2)} |` : ''}`
}

function generateExecutiveSummary(pkg: ResearchPackage): string {
  const summary = pkg.producer.story_summary
  return `## Executive Summary

${summary.full_summary}

| Attribute | Value |
|-----------|-------|
| **Story Type** | ${formatStoryType(summary.story_type)} |
| **Timeliness** | ${formatTimeliness(summary.timeliness)} |
| **Interest Level** | ${formatInterestLevel(summary.estimated_interest_level)} |`
}

function generateKeyFacts(facts: KeyFact[]): string {
  if (facts.length === 0) return '## Key Facts\n\n*No key facts extracted.*'

  const lines = ['## Key Facts', '']
  for (const fact of facts) {
    const badge = getConfidenceBadge(fact.confidence)
    lines.push(`- ${badge} **${fact.fact}**`)
    lines.push(`  - Sources: ${fact.source_count}`)
    if (fact.primary_source) {
      lines.push(`  - Primary: ${fact.primary_source}`)
    }
    if (fact.contradictions?.length) {
      lines.push(`  - Contradictions: ${fact.contradictions.join(', ')}`)
    }
  }
  return lines.join('\n')
}

function generateEntityGlossary(entities: ProcessedEntity[]): string {
  if (entities.length === 0) return '## Entity Glossary\n\n*No entities identified.*'

  const lines = ['## Entity Glossary', '']

  // Group by type
  const people = entities.filter(e => e.type === 'person')
  const orgs = entities.filter(e => e.type === 'organization' || e.type === 'league')
  const others = entities.filter(e => e.type !== 'person' && e.type !== 'organization' && e.type !== 'league')

  if (people.length > 0) {
    lines.push('### People', '')
    for (const entity of people) {
      lines.push(formatEntity(entity))
    }
    lines.push('')
  }

  if (orgs.length > 0) {
    lines.push('### Organizations', '')
    for (const entity of orgs) {
      lines.push(formatEntity(entity))
    }
    lines.push('')
  }

  if (others.length > 0) {
    lines.push('### Other Entities', '')
    for (const entity of others) {
      lines.push(formatEntity(entity))
    }
  }

  return lines.join('\n')
}

function formatEntity(entity: ProcessedEntity): string {
  let line = `- **${entity.name}**`
  if (entity.aliases?.length) {
    line += ` (aka ${entity.aliases.join(', ')})`
  }
  line += ': '

  const details = []
  if (entity.role) details.push(entity.role)
  if (entity.type && entity.type !== 'person') details.push(entity.type)
  if (entity.affiliations?.length) {
    details.push(entity.affiliations.map(a => `${a.name} (${a.status})`).join(', '))
  }

  line += details.join(' | ')

  const flags = []
  if (entity.is_primary_source) flags.push('PRIMARY SOURCE')
  if (entity.is_commentator) flags.push('COMMENTATOR')
  if (entity.gender_needs_review) flags.push('GENDER UNVERIFIED')
  if (entity.bias_indicators?.length) flags.push(`BIAS: ${entity.bias_indicators.join(', ')}`)

  if (flags.length > 0) {
    line += ` [${flags.join(' | ')}]`
  }

  return line
}

function generateWarnings(warnings: ProducerWarning[]): string {
  const lines = ['## Producer Warnings', '']

  for (const warning of warnings) {
    const icon = getSeverityIcon(warning.severity)
    lines.push(`### ${icon} ${formatWarningType(warning.type)}`)
    lines.push('')
    lines.push(warning.message)
    if (warning.recommendation) {
      lines.push('')
      lines.push(`**Recommendation:** ${warning.recommendation}`)
    }
    if (warning.affected_items?.length) {
      lines.push('')
      lines.push(`*Affected: ${warning.affected_items.length} items*`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function generateQuotes(quotes: QuoteItem[]): string {
  const lines = ['## Quotes to Use', '']

  for (let i = 0; i < quotes.length; i++) {
    const quote = quotes[i]
    lines.push(`### Quote ${i + 1}`)
    lines.push('')
    lines.push(`> "${quote.quote}"`)
    lines.push('>')
    lines.push(`> — **${quote.speaker}**${quote.speaker_role ? ` (${quote.speaker_role})` : ''}`)
    lines.push('')
    lines.push(`- Source: [${quote.source_title}](${quote.source_url})`)
    lines.push(`- Type: ${quote.source_type}`)
    if (quote.engagement) {
      lines.push(`- Engagement: ${quote.engagement.toLocaleString()}`)
    }
    if (quote.recommended_use) {
      lines.push(`- Suggested use: *${quote.recommended_use}*`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function generateHostMaterials(pkg: ResearchPackage): string {
  const lines = ['## Host Materials', '']

  // Script Outline
  const outline = pkg.host.script_outline
  lines.push(`### Script Outline: ${outline.title}`)
  lines.push('')
  lines.push(`**Estimated Duration:** ${outline.estimated_duration_minutes} minutes`)
  lines.push('')

  for (const section of outline.sections) {
    lines.push(`#### ${section.name} (${section.estimated_duration_seconds}s)`)
    lines.push('')
    lines.push(`**Purpose:** ${section.purpose}`)
    lines.push('')
    if (section.suggested_content) {
      lines.push(section.suggested_content)
      lines.push('')
    }
    if (section.key_points.length > 0) {
      lines.push('**Key Points:**')
      for (const point of section.key_points) {
        lines.push(`- ${point}`)
      }
      lines.push('')
    }
    if (section.quotes_to_include?.length) {
      lines.push('**Include quotes:**')
      for (const quote of section.quotes_to_include) {
        lines.push(`- "${quote}"`)
      }
      lines.push('')
    }
  }

  // Talking Points
  if (pkg.host.talking_points.length > 0) {
    lines.push('### Talking Points')
    lines.push('')
    for (let i = 0; i < pkg.host.talking_points.length; i++) {
      const point = pkg.host.talking_points[i]
      const cutNote = point.can_be_cut ? ' *(can be cut for time)*' : ''
      lines.push(`${i + 1}. **${point.point}**${cutNote}`)
      if (point.supporting_facts.length > 0) {
        for (const fact of point.supporting_facts) {
          lines.push(`   - ${fact}`)
        }
      }
      lines.push(`   - *Source: ${point.source_reference}*`)
      lines.push('')
    }
  }

  // Pronunciation Guide
  if (pkg.host.pronunciation_guide.length > 0) {
    lines.push('### Pronunciation Guide')
    lines.push('')
    lines.push('| Term | Pronunciation | Notes |')
    lines.push('|------|---------------|-------|')
    for (const entry of pkg.host.pronunciation_guide) {
      lines.push(`| ${entry.term} | ${entry.pronunciation} | ${entry.notes || '-'} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function generateInterviews(
  interviews: InterviewItem[],
  includeTranscripts: boolean,
  transcriptPreviewLength: number,
  collapsible: boolean
): string {
  const lines = ['## Interview Transcripts', '']

  for (const interview of interviews) {
    lines.push(`### Interview: ${interview.entity_name}`)
    lines.push('')
    lines.push(`- **Video:** [${interview.video_title}](${interview.url})`)
    lines.push(`- **Channel:** ${interview.channel}`)
    lines.push(`- **Duration:** ${Math.round(interview.duration_seconds / 60)} minutes`)
    lines.push(`- **Cache:** ${interview.from_cache ? 'Yes (saved cost)' : 'Fresh fetch'}`)
    if (interview.cost_cents > 0) {
      lines.push(`- **Cost:** $${(interview.cost_cents / 100).toFixed(2)}`)
    }
    lines.push('')

    if (includeTranscripts && interview.transcript_text) {
      if (collapsible) {
        lines.push('<details>')
        lines.push('<summary>View transcript</summary>')
        lines.push('')
      }
      lines.push('```')
      lines.push(interview.transcript_text.slice(0, transcriptPreviewLength))
      if (interview.transcript_text.length > transcriptPreviewLength) {
        lines.push('...[truncated]')
      }
      lines.push('```')
      if (collapsible) {
        lines.push('</details>')
      }
      lines.push('')
    }

    if (interview.key_quotes?.length) {
      lines.push('**Key Quotes:**')
      for (const quote of interview.key_quotes) {
        lines.push(`> "${quote}"`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

function generateTwitterSection(pkg: ResearchPackage): string {
  if (!pkg.twitter) return ''

  const twitter = pkg.twitter
  const lines = ['## Twitter Reactions', '']

  lines.push(`**Event Date:** ${twitter.event_timeframe.event_date}`)
  lines.push(`**Confidence:** ${twitter.event_timeframe.confidence}`)
  lines.push(`**Tweets Found:** ${twitter.tweets_found}`)
  lines.push('')

  lines.push('### Sentiment Breakdown')
  lines.push('')
  const total = twitter.sentiment.positive + twitter.sentiment.negative + twitter.sentiment.neutral
  if (total > 0) {
    const pos = Math.round((twitter.sentiment.positive / total) * 100)
    const neg = Math.round((twitter.sentiment.negative / total) * 100)
    const neu = Math.round((twitter.sentiment.neutral / total) * 100)
    lines.push(`- Positive: ${pos}%`)
    lines.push(`- Negative: ${neg}%`)
    lines.push(`- Neutral: ${neu}%`)
  }
  lines.push('')

  if (twitter.top_reactions.length > 0) {
    lines.push('### Top Reactions')
    lines.push('')
    for (const tweet of twitter.top_reactions.slice(0, 5)) {
      lines.push(`> "${tweet.text}"`)
      lines.push('>')
      lines.push(`> — @${tweet.author_handle} (${tweet.likes} likes, ${tweet.retweets} RTs)`)
      lines.push('')
    }
  }

  if (twitter.key_quotes.length > 0) {
    lines.push('### Key Quotes from Twitter')
    lines.push('')
    for (const quote of twitter.key_quotes) {
      lines.push(`- "${quote}"`)
    }
  }

  return lines.join('\n')
}

function generateClaims(claims: ProcessedClaim[]): string {
  const lines = ['## Claims & Verdicts', '']

  for (const claim of claims) {
    lines.push(`### Claim: "${claim.claim_text}"`)
    lines.push('')
    lines.push(`- **Type:** ${claim.claim_type}`)
    lines.push(`- **Verdict:** ${getVerdictBadge(claim.verdict)}`)
    lines.push(`- **Confidence:** ${Math.round(claim.confidence_score * 100)}%`)
    lines.push(`- **Sources:** ${claim.source_count}`)
    lines.push(`- **Total Engagement:** ${claim.engagement_total.toLocaleString()}`)
    lines.push('')

    if (claim.evidence_for.length > 0) {
      lines.push('**Evidence For:**')
      for (const ev of claim.evidence_for) {
        lines.push(`- [${ev.source_title}]: "${ev.snippet}"`)
      }
      lines.push('')
    }

    if (claim.evidence_against.length > 0) {
      lines.push('**Evidence Against:**')
      for (const ev of claim.evidence_against) {
        lines.push(`- [${ev.source_title}]: "${ev.snippet}"`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

function generateTranscripts(
  videos: YouTubeSourceItem[],
  previewLength: number,
  collapsible: boolean
): string {
  const videosWithTranscripts = videos.filter(v => v.transcript_text)
  if (videosWithTranscripts.length === 0) return ''

  const lines = ['## Source Transcripts', '']

  if (collapsible) {
    lines.push(`<details>`)
    lines.push(`<summary>Click to expand (${videosWithTranscripts.length} sources)</summary>`)
    lines.push('')
  }

  for (const video of videosWithTranscripts) {
    lines.push(`### ${video.title}`)
    lines.push('')
    lines.push(`- **Channel:** ${video.channel}`)
    lines.push(`- **URL:** ${video.url}`)
    if (video.duration_seconds) {
      lines.push(`- **Duration:** ${Math.round(video.duration_seconds / 60)} min`)
    }
    if (video.view_count) {
      lines.push(`- **Views:** ${video.view_count.toLocaleString()}`)
    }
    lines.push(`- **Source:** ${video.transcript_source}`)
    if (video.relevance_score !== undefined) {
      lines.push(`- **Relevance:** ${Math.round(video.relevance_score * 100)}%`)
    }
    lines.push('')
    lines.push('```')
    lines.push(video.transcript_text!.slice(0, previewLength))
    if (video.transcript_text!.length > previewLength) {
      lines.push('...[truncated]')
    }
    lines.push('```')
    lines.push('')
  }

  if (collapsible) {
    lines.push('</details>')
  }

  return lines.join('\n')
}

function generateRawSourceList(pkg: ResearchPackage): string {
  const lines = ['## Raw Source List', '']

  // YouTube
  if (pkg.raw_sources.youtube_videos.length > 0) {
    lines.push(`### YouTube Videos (${pkg.raw_sources.youtube_videos.length})`)
    lines.push('')
    lines.push('| Title | Channel | Views | Duration | Transcript |')
    lines.push('|-------|---------|-------|----------|------------|')
    for (const video of pkg.raw_sources.youtube_videos) {
      const duration = video.duration_seconds
        ? `${Math.round(video.duration_seconds / 60)}m`
        : '-'
      const views = video.view_count?.toLocaleString() || '-'
      const hasTranscript = video.has_transcript ? '✓' : '✗'
      lines.push(`| [${truncate(video.title, 40)}](${video.url}) | ${video.channel} | ${views} | ${duration} | ${hasTranscript} |`)
    }
    lines.push('')
  }

  // Tweets
  if (pkg.raw_sources.tweets.length > 0) {
    lines.push(`### Tweets (${pkg.raw_sources.tweets.length})`)
    lines.push('')
    lines.push('| Author | Text | Likes | Sentiment |')
    lines.push('|--------|------|-------|-----------|')
    for (const tweet of pkg.raw_sources.tweets.slice(0, 20)) {
      lines.push(`| @${tweet.author_handle} | ${truncate(tweet.text, 50)} | ${tweet.likes} | ${tweet.sentiment || '-'} |`)
    }
    lines.push('')
  }

  // Documents
  if (pkg.raw_sources.web_documents.length > 0) {
    lines.push(`### Documents (${pkg.raw_sources.web_documents.length})`)
    lines.push('')
    lines.push('| Title | Type | Domain | Relevance |')
    lines.push('|-------|------|--------|-----------|')
    for (const doc of pkg.raw_sources.web_documents) {
      lines.push(`| [${truncate(doc.title, 40)}](${doc.url}) | ${doc.document_type} | ${doc.domain} | ${Math.round(doc.relevance_score * 100)}% |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function generateFooter(pkg: ResearchPackage): string {
  return `---

*Generated by Talk Show Go Research Package System*
*Package Version: ${pkg.metadata.version}*
*Export Formats: ${pkg.export_formats_available.join(', ')}*`
}

// ========== FORMATTING HELPERS ==========

function getConfidenceBadge(confidence: string): string {
  switch (confidence) {
    case 'confirmed': return '✅'
    case 'likely': return '🔵'
    case 'unverified': return '⚠️'
    default: return '❓'
  }
}

function getVerdictBadge(verdict?: string): string {
  switch (verdict) {
    case 'confirmed': return '✅ Confirmed'
    case 'likely': return '🔵 Likely'
    case 'uncertain': return '⚠️ Uncertain'
    case 'disputed': return '🔴 Disputed'
    case 'debunked': return '❌ Debunked'
    default: return '❓ Unknown'
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'high': return '🔴'
    case 'medium': return '🟡'
    case 'low': return '🟢'
    default: return '⚪'
  }
}

function formatWarningType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatStoryType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function formatTimeliness(timeliness: string): string {
  const map: Record<string, string> = {
    breaking: '🔴 Breaking',
    developing: '🟡 Developing',
    background: '🔵 Background',
    evergreen: '🟢 Evergreen',
  }
  return map[timeliness] || timeliness
}

function formatInterestLevel(level: string): string {
  const map: Record<string, string> = {
    high: '🔥 High',
    medium: '📊 Medium',
    low: '📉 Low',
  }
  return map[level] || level
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
