-- ============================================
-- RAG SUPPORT MIGRATION
-- ============================================
-- Adds vector search support using pgvector
-- Adds indexed_for_rag flags to track what's been indexed

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- ADD INDEXED FLAGS
-- ============================================

-- Add indexed_for_rag flag to tweets_raw
ALTER TABLE tweets_raw ADD COLUMN IF NOT EXISTS indexed_for_rag BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_tweets_raw_indexed_rag ON tweets_raw(indexed_for_rag);

-- Add indexed_for_rag flag to claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS indexed_for_rag BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_claims_indexed_rag ON claims(indexed_for_rag);

-- Add indexed_for_rag flag to entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS indexed_for_rag BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_entities_indexed_rag ON entities(indexed_for_rag);

-- ============================================
-- RAG COLLECTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS rag_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    embedding_model VARCHAR(100) DEFAULT 'nomic-embed-text',
    embedding_dimensions INTEGER DEFAULT 768,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RAG DOCUMENTS TABLE (with vector)
-- ============================================

CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID REFERENCES rag_collections(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(768), -- Default for nomic-embed-text, adjust if using different model
    source_type VARCHAR(50), -- 'tweet', 'claim', 'entity', etc.
    source_id UUID, -- Reference to original record
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding ON rag_documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for collection lookups
CREATE INDEX IF NOT EXISTS idx_rag_documents_collection ON rag_documents(collection_id);

-- Index for source lookups
CREATE INDEX IF NOT EXISTS idx_rag_documents_source ON rag_documents(source_type, source_id);

-- ============================================
-- VECTOR SEARCH FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION match_documents (
    query_embedding vector(768),
    match_threshold float,
    match_count int,
    p_collection_id uuid
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        rag_documents.id,
        rag_documents.content,
        rag_documents.metadata,
        1 - (rag_documents.embedding <=> query_embedding) AS similarity
    FROM rag_documents
    WHERE
        rag_documents.collection_id = p_collection_id
        AND 1 - (rag_documents.embedding <=> query_embedding) > match_threshold
    ORDER BY rag_documents.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- ============================================
-- HYBRID SEARCH FUNCTION (vector + text)
-- ============================================

CREATE OR REPLACE FUNCTION hybrid_search (
    query_text text,
    query_embedding vector(768),
    match_count int,
    p_collection_id uuid,
    vector_weight float DEFAULT 0.7,
    text_weight float DEFAULT 0.3
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    similarity float,
    text_rank float,
    combined_score float
)
LANGUAGE sql STABLE
AS $$
    WITH vector_matches AS (
        SELECT
            rag_documents.id,
            rag_documents.content,
            rag_documents.metadata,
            1 - (rag_documents.embedding <=> query_embedding) AS similarity
        FROM rag_documents
        WHERE rag_documents.collection_id = p_collection_id
        ORDER BY rag_documents.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_matches AS (
        SELECT
            rag_documents.id,
            ts_rank(
                to_tsvector('english', rag_documents.content),
                plainto_tsquery('english', query_text)
            ) AS text_rank
        FROM rag_documents
        WHERE
            rag_documents.collection_id = p_collection_id
            AND to_tsvector('english', rag_documents.content) @@ plainto_tsquery('english', query_text)
    )
    SELECT
        vm.id,
        vm.content,
        vm.metadata,
        vm.similarity,
        COALESCE(tm.text_rank, 0) AS text_rank,
        (vm.similarity * vector_weight) + (COALESCE(tm.text_rank, 0) * text_weight) AS combined_score
    FROM vector_matches vm
    LEFT JOIN text_matches tm ON vm.id = tm.id
    ORDER BY combined_score DESC
    LIMIT match_count;
$$;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_rag_collections_updated_at ON rag_collections;
CREATE TRIGGER update_rag_collections_updated_at
    BEFORE UPDATE ON rag_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rag_documents_updated_at ON rag_documents;
CREATE TRIGGER update_rag_documents_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL COLLECTIONS
-- ============================================

INSERT INTO rag_collections (name, description) VALUES
    ('stories_all', 'All story-related content across topics'),
    ('entities_all', 'All entity information across topics'),
    ('claims_all', 'All claims for fact-checking')
ON CONFLICT (name) DO NOTHING;
