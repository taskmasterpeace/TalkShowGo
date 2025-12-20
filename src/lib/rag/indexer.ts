/**
 * RAG INDEXER
 *
 * Indexes content from the database into vector collections.
 * Handles tweets, claims, entities, and stories.
 */

import { createClient } from '@supabase/supabase-js'
import { VectorStore, Document } from './vectorstore'

// ============================================
// TYPES
// ============================================

export interface IndexStats {
  tweetsIndexed: number
  claimsIndexed: number
  entitiesIndexed: number
  errors: string[]
}

export interface IndexOptions {
  topicId?: string
  since?: Date
  batchSize?: number
  onProgress?: (progress: { current: number; total: number; type: string }) => void
}

// ============================================
// RAG INDEXER CLASS
// ============================================

export class RAGIndexer {
  private supabase
  private vectorStore: VectorStore

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    this.vectorStore = new VectorStore()
  }

  /**
   * Index all content for a topic
   */
  async indexTopic(topicSlug: string, options: IndexOptions = {}): Promise<IndexStats> {
    const stats: IndexStats = {
      tweetsIndexed: 0,
      claimsIndexed: 0,
      entitiesIndexed: 0,
      errors: [],
    }

    // Get topic ID
    const { data: topic } = await this.supabase
      .from('topics')
      .select('id')
      .eq('slug', topicSlug)
      .single()

    if (!topic) {
      stats.errors.push(`Topic not found: ${topicSlug}`)
      return stats
    }

    const topicId = topic.id

    // Index tweets
    try {
      await this.vectorStore.useCollection(`tweets_${topicSlug}`, `Tweets for ${topicSlug}`)
      const tweetCount = await this.indexTweets(topicId, options)
      stats.tweetsIndexed = tweetCount
    } catch (error) {
      stats.errors.push(`Tweet indexing error: ${error}`)
    }

    // Index claims
    try {
      await this.vectorStore.useCollection(`claims_${topicSlug}`, `Claims for ${topicSlug}`)
      const claimCount = await this.indexClaims(topicId, options)
      stats.claimsIndexed = claimCount
    } catch (error) {
      stats.errors.push(`Claim indexing error: ${error}`)
    }

    // Index entities
    try {
      await this.vectorStore.useCollection(`entities_${topicSlug}`, `Entities for ${topicSlug}`)
      const entityCount = await this.indexEntities(topicId, options)
      stats.entitiesIndexed = entityCount
    } catch (error) {
      stats.errors.push(`Entity indexing error: ${error}`)
    }

    // Also add to "all" collections for cross-topic search
    await this.indexToAllCollections(topicId, options)

    return stats
  }

  /**
   * Index tweets from database
   */
  private async indexTweets(topicId: string, options: IndexOptions): Promise<number> {
    let query = this.supabase
      .from('tweets_raw')
      .select(`
        id,
        tweet_id,
        author_username,
        author_display_name,
        text,
        created_at,
        metrics,
        source_accounts!inner(topic_id)
      `)
      .eq('source_accounts.topic_id', topicId)
      .eq('indexed_for_rag', false)
      .order('created_at', { ascending: false })
      .limit(options.batchSize || 100)

    if (options.since) {
      query = query.gte('created_at', options.since.toISOString())
    }

    const { data: tweets, error } = await query

    if (error || !tweets) return 0

    const documents: Omit<Document, 'embedding'>[] = tweets.map(tweet => ({
      id: tweet.id,
      content: this.formatTweetForIndexing(tweet),
      metadata: {
        type: 'tweet',
        tweetId: tweet.tweet_id,
        author: tweet.author_username,
        authorName: tweet.author_display_name,
        date: tweet.created_at,
        likes: tweet.metrics?.like_count || 0,
        retweets: tweet.metrics?.retweet_count || 0,
        replies: tweet.metrics?.reply_count || 0,
      },
    }))

    if (documents.length > 0) {
      await this.vectorStore.addDocuments(documents)

      // Mark as indexed
      await this.supabase
        .from('tweets_raw')
        .update({ indexed_for_rag: true })
        .in('id', tweets.map(t => t.id))
    }

    options.onProgress?.({
      current: documents.length,
      total: documents.length,
      type: 'tweets',
    })

    return documents.length
  }

  /**
   * Index claims from database
   */
  private async indexClaims(topicId: string, options: IndexOptions): Promise<number> {
    const { data: claims, error } = await this.supabase
      .from('claims')
      .select(`
        id,
        claim_text,
        claim_type,
        subject,
        confidence_score,
        first_seen_at,
        consensus_scores(consensus_score, contention_score)
      `)
      .eq('topic_id', topicId)
      .eq('indexed_for_rag', false)
      .order('first_seen_at', { ascending: false })
      .limit(options.batchSize || 100)

    if (error || !claims) return 0

    const documents: Omit<Document, 'embedding'>[] = claims.map(claim => ({
      id: claim.id,
      content: this.formatClaimForIndexing(claim),
      metadata: {
        type: 'claim',
        claimType: claim.claim_type,
        subject: claim.subject,
        confidence: claim.confidence_score,
        consensus: claim.consensus_scores?.[0]?.consensus_score,
        contention: claim.consensus_scores?.[0]?.contention_score,
        date: claim.first_seen_at,
      },
    }))

    if (documents.length > 0) {
      await this.vectorStore.addDocuments(documents)

      await this.supabase
        .from('claims')
        .update({ indexed_for_rag: true })
        .in('id', claims.map(c => c.id))
    }

    options.onProgress?.({
      current: documents.length,
      total: documents.length,
      type: 'claims',
    })

    return documents.length
  }

  /**
   * Index entities from database
   */
  private async indexEntities(topicId: string, options: IndexOptions): Promise<number> {
    const { data: entities, error } = await this.supabase
      .from('entities')
      .select(`
        id,
        name,
        entity_type,
        description,
        aliases,
        metadata,
        entity_mentions(count),
        avg_sentiment:entity_mentions(sentiment_score)
      `)
      .eq('topic_id', topicId)
      .eq('indexed_for_rag', false)
      .limit(options.batchSize || 100)

    if (error || !entities) return 0

    const documents: Omit<Document, 'embedding'>[] = entities.map(entity => ({
      id: entity.id,
      content: this.formatEntityForIndexing(entity),
      metadata: {
        type: 'entity',
        entityType: entity.entity_type,
        name: entity.name,
        aliases: entity.aliases,
        mentionCount: entity.entity_mentions?.[0]?.count || 0,
      },
    }))

    if (documents.length > 0) {
      await this.vectorStore.addDocuments(documents)

      await this.supabase
        .from('entities')
        .update({ indexed_for_rag: true })
        .in('id', entities.map(e => e.id))
    }

    options.onProgress?.({
      current: documents.length,
      total: documents.length,
      type: 'entities',
    })

    return documents.length
  }

  /**
   * Index to "all" collections for cross-topic search
   */
  private async indexToAllCollections(topicId: string, options: IndexOptions): Promise<void> {
    // This runs after topic-specific indexing
    // Could be optimized to avoid re-embedding, but keeping simple for now
  }

  // ============================================
  // FORMATTERS
  // ============================================

  private formatTweetForIndexing(tweet: any): string {
    const parts = [
      `Tweet by @${tweet.author_username} (${tweet.author_display_name})`,
      `Date: ${new Date(tweet.created_at).toLocaleDateString()}`,
      `Content: ${tweet.text}`,
    ]

    if (tweet.metrics) {
      const metrics = []
      if (tweet.metrics.like_count) metrics.push(`${tweet.metrics.like_count} likes`)
      if (tweet.metrics.retweet_count) metrics.push(`${tweet.metrics.retweet_count} retweets`)
      if (tweet.metrics.reply_count) metrics.push(`${tweet.metrics.reply_count} replies`)
      if (metrics.length > 0) {
        parts.push(`Engagement: ${metrics.join(', ')}`)
      }
    }

    return parts.join('\n')
  }

  private formatClaimForIndexing(claim: any): string {
    const parts = [
      `Claim: ${claim.claim_text}`,
      `Type: ${claim.claim_type}`,
    ]

    if (claim.subject) {
      parts.push(`Subject: ${claim.subject}`)
    }

    if (claim.consensus_scores?.[0]) {
      const consensus = claim.consensus_scores[0]
      parts.push(`Consensus: ${(consensus.consensus_score * 100).toFixed(0)}%`)
      parts.push(`Contention: ${(consensus.contention_score * 100).toFixed(0)}%`)
    }

    return parts.join('\n')
  }

  private formatEntityForIndexing(entity: any): string {
    const parts = [
      `Entity: ${entity.name}`,
      `Type: ${entity.entity_type}`,
    ]

    if (entity.description) {
      parts.push(`Description: ${entity.description}`)
    }

    if (entity.aliases?.length > 0) {
      parts.push(`Also known as: ${entity.aliases.join(', ')}`)
    }

    const mentionCount = entity.entity_mentions?.[0]?.count || 0
    if (mentionCount > 0) {
      parts.push(`Mentioned ${mentionCount} times`)
    }

    return parts.join('\n')
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Get indexing status for a topic
   */
  async getIndexStatus(topicSlug: string): Promise<{
    tweets: { indexed: number; pending: number }
    claims: { indexed: number; pending: number }
    entities: { indexed: number; pending: number }
  }> {
    const { data: topic } = await this.supabase
      .from('topics')
      .select('id')
      .eq('slug', topicSlug)
      .single()

    if (!topic) {
      return {
        tweets: { indexed: 0, pending: 0 },
        claims: { indexed: 0, pending: 0 },
        entities: { indexed: 0, pending: 0 },
      }
    }

    // Get counts
    const [tweetsIndexed, tweetsPending, claimsIndexed, claimsPending, entitiesIndexed, entitiesPending] =
      await Promise.all([
        this.supabase
          .from('tweets_raw')
          .select('id', { count: 'exact', head: true })
          .eq('indexed_for_rag', true),
        this.supabase
          .from('tweets_raw')
          .select('id', { count: 'exact', head: true })
          .eq('indexed_for_rag', false),
        this.supabase
          .from('claims')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', topic.id)
          .eq('indexed_for_rag', true),
        this.supabase
          .from('claims')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', topic.id)
          .eq('indexed_for_rag', false),
        this.supabase
          .from('entities')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', topic.id)
          .eq('indexed_for_rag', true),
        this.supabase
          .from('entities')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', topic.id)
          .eq('indexed_for_rag', false),
      ])

    return {
      tweets: {
        indexed: tweetsIndexed.count || 0,
        pending: tweetsPending.count || 0,
      },
      claims: {
        indexed: claimsIndexed.count || 0,
        pending: claimsPending.count || 0,
      },
      entities: {
        indexed: entitiesIndexed.count || 0,
        pending: entitiesPending.count || 0,
      },
    }
  }

  /**
   * Reindex everything (clear and rebuild)
   */
  async reindexTopic(topicSlug: string): Promise<IndexStats> {
    // Reset indexed flags
    const { data: topic } = await this.supabase
      .from('topics')
      .select('id')
      .eq('slug', topicSlug)
      .single()

    if (topic) {
      await Promise.all([
        this.supabase
          .from('tweets_raw')
          .update({ indexed_for_rag: false })
          .not('id', 'is', null),
        this.supabase
          .from('claims')
          .update({ indexed_for_rag: false })
          .eq('topic_id', topic.id),
        this.supabase
          .from('entities')
          .update({ indexed_for_rag: false })
          .eq('topic_id', topic.id),
      ])
    }

    // Clear collections
    await this.vectorStore.useCollection(`tweets_${topicSlug}`)
    await this.vectorStore.clearCollection()

    await this.vectorStore.useCollection(`claims_${topicSlug}`)
    await this.vectorStore.clearCollection()

    await this.vectorStore.useCollection(`entities_${topicSlug}`)
    await this.vectorStore.clearCollection()

    // Reindex
    return this.indexTopic(topicSlug)
  }
}

// ============================================
// SINGLETON
// ============================================

export const ragIndexer = new RAGIndexer()
