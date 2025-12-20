/**
 * RAG SYSTEM
 *
 * Retrieval Augmented Generation for Talk Show Go.
 * Chat with your data using local LLMs!
 *
 * Features:
 * - Vector search using pgvector
 * - Local embeddings via Ollama
 * - Smart retrieval with relevance scoring
 * - Specialized RAG clients for different use cases
 */

// Embeddings
export {
  EmbeddingClient,
  SmartEmbeddingClient,
  embeddings,
  type EmbeddingConfig,
  DEFAULT_EMBEDDING_CONFIGS,
} from './embeddings'

// Vector Store
export {
  VectorStore,
  vectorStore,
  type Document,
  type SearchResult,
  type Collection,
} from './vectorstore'

// RAG Client
export {
  RAGClient,
  StoryResearchRAG,
  EntityResearchRAG,
  FactCheckRAG,
  type RAGConfig,
  type RAGResponse,
  type ChatMessage,
} from './client'

// Indexer
export {
  RAGIndexer,
  ragIndexer,
  type IndexStats,
  type IndexOptions,
} from './indexer'
