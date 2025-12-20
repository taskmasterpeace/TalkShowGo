/**
 * VECTOR STORE
 *
 * Manages vector storage and retrieval using pgvector.
 * Indexes tweets, claims, entities for semantic search.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { embeddings, EmbeddingClient } from './embeddings'

// ============================================
// TYPES
// ============================================

export interface Document {
  id: string
  content: string
  metadata: Record<string, any>
  embedding?: number[]
}

export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, any>
  similarity: number
}

export interface Collection {
  id: string
  name: string
  description?: string
  documentCount: number
}

// ============================================
// VECTOR STORE CLASS
// ============================================

export class VectorStore {
  private supabase: SupabaseClient
  private embeddingClient: EmbeddingClient | null = null
  private collectionId: string | null = null

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  /**
   * Initialize with a specific collection
   */
  async useCollection(name: string, description?: string): Promise<void> {
    // Get or create collection
    const { data: existing } = await this.supabase
      .from('rag_collections')
      .select('id')
      .eq('name', name)
      .single()

    if (existing) {
      this.collectionId = existing.id
    } else {
      const { data: created, error } = await this.supabase
        .from('rag_collections')
        .insert({ name, description })
        .select('id')
        .single()

      if (error) throw error
      this.collectionId = created.id
    }

    // Initialize embedding client
    this.embeddingClient = await embeddings.getAvailableClient()
  }

  /**
   * Add a document to the collection
   */
  async addDocument(doc: Omit<Document, 'embedding'>): Promise<string> {
    if (!this.collectionId) throw new Error('No collection selected')
    if (!this.embeddingClient) throw new Error('No embedding client available')

    // Generate embedding
    const embedding = await this.embeddingClient.embed(doc.content)

    // Store document
    const { data, error } = await this.supabase
      .from('rag_documents')
      .insert({
        collection_id: this.collectionId,
        content: doc.content,
        metadata: doc.metadata,
        embedding: embedding,
        source_type: doc.metadata.type || 'unknown',
        source_id: doc.id,
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  }

  /**
   * Add multiple documents (batch)
   */
  async addDocuments(docs: Omit<Document, 'embedding'>[]): Promise<string[]> {
    if (!this.collectionId) throw new Error('No collection selected')
    if (!this.embeddingClient) throw new Error('No embedding client available')

    const ids: string[] = []

    // Process in batches of 10
    const batchSize = 10
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize)
      const contents = batch.map(d => d.content)

      // Generate embeddings
      const embeddingResults = await this.embeddingClient.embedBatch(contents)

      // Prepare records
      const records = batch.map((doc, idx) => ({
        collection_id: this.collectionId,
        content: doc.content,
        metadata: doc.metadata,
        embedding: embeddingResults[idx],
        source_type: doc.metadata.type || 'unknown',
        source_id: doc.id,
      }))

      // Insert batch
      const { data, error } = await this.supabase
        .from('rag_documents')
        .insert(records)
        .select('id')

      if (error) throw error
      ids.push(...data.map(d => d.id))
    }

    return ids
  }

  /**
   * Search for similar documents
   */
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.collectionId) throw new Error('No collection selected')
    if (!this.embeddingClient) throw new Error('No embedding client available')

    // Generate query embedding
    const queryEmbedding = await this.embeddingClient.embed(query)

    // Search using pgvector
    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
      p_collection_id: this.collectionId,
    })

    if (error) {
      // Fallback to basic search if RPC not available
      console.warn('Vector search RPC not available, using fallback')
      return this.fallbackSearch(query, limit)
    }

    return data.map((d: any) => ({
      id: d.id,
      content: d.content,
      metadata: d.metadata,
      similarity: d.similarity,
    }))
  }

  /**
   * Fallback text search (no vectors)
   */
  private async fallbackSearch(query: string, limit: number): Promise<SearchResult[]> {
    const { data, error } = await this.supabase
      .from('rag_documents')
      .select('id, content, metadata')
      .eq('collection_id', this.collectionId)
      .textSearch('content', query.split(' ').join(' | '))
      .limit(limit)

    if (error) {
      // Last resort: basic LIKE search
      const { data: likeData } = await this.supabase
        .from('rag_documents')
        .select('id, content, metadata')
        .eq('collection_id', this.collectionId)
        .ilike('content', `%${query}%`)
        .limit(limit)

      return (likeData || []).map((d: any) => ({
        id: d.id,
        content: d.content,
        metadata: d.metadata,
        similarity: 0.5, // Unknown similarity
      }))
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      content: d.content,
      metadata: d.metadata,
      similarity: 0.7, // Approximate
    }))
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('rag_documents')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  /**
   * Get collection stats
   */
  async getStats(): Promise<{ documentCount: number; collections: Collection[] }> {
    const { data: collections } = await this.supabase
      .from('rag_collections')
      .select(`
        id,
        name,
        description,
        rag_documents(count)
      `)

    const collectionList: Collection[] = (collections || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      documentCount: c.rag_documents?.[0]?.count || 0,
    }))

    const totalDocs = collectionList.reduce((sum, c) => sum + c.documentCount, 0)

    return {
      documentCount: totalDocs,
      collections: collectionList,
    }
  }

  /**
   * Clear all documents in collection
   */
  async clearCollection(): Promise<void> {
    if (!this.collectionId) throw new Error('No collection selected')

    const { error } = await this.supabase
      .from('rag_documents')
      .delete()
      .eq('collection_id', this.collectionId)

    if (error) throw error
  }
}

// ============================================
// SINGLETON
// ============================================

export const vectorStore = new VectorStore()
