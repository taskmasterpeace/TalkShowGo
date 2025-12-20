-- ============================================
-- HOSTS & PRODUCERS SYSTEM
-- Version: 2.0
--
-- This migration adds:
-- 1. Hosts - AI personalities that PRESENT content
-- 2. Producers - Agents that GATHER and CURATE content
-- 3. Workflows - Scheduled pipeline runs
-- 4. Productions - Track what's being produced
-- ============================================

-- ============================================
-- HOSTS - The Presenters
-- ============================================

CREATE TABLE hosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    archetype VARCHAR(100) NOT NULL,
    tagline VARCHAR(500),
    description TEXT,
    avatar_url TEXT,

    -- Voice characteristics
    voice_tone TEXT[] DEFAULT '{}',
    voice_pace VARCHAR(50) CHECK (voice_pace IN ('slow', 'moderate', 'fast', 'variable')),
    voice_energy VARCHAR(50) CHECK (voice_energy IN ('calm', 'moderate', 'high', 'explosive')),
    voice_formality VARCHAR(50) CHECK (voice_formality IN ('casual', 'conversational', 'professional', 'street')),

    -- Content style
    style_uses_humor BOOLEAN DEFAULT FALSE,
    style_uses_analogy BOOLEAN DEFAULT FALSE,
    style_rhetorical_questions BOOLEAN DEFAULT FALSE,
    style_breaks_fourth_wall BOOLEAN DEFAULT FALSE,
    style_includes_opinion BOOLEAN DEFAULT FALSE,
    style_confrontational BOOLEAN DEFAULT FALSE,
    style_uses_slang BOOLEAN DEFAULT FALSE,
    style_profanity_level VARCHAR(50) DEFAULT 'none' CHECK (style_profanity_level IN ('none', 'mild', 'moderate', 'heavy')),

    -- Delivery patterns
    delivery_opening_style TEXT,
    delivery_transition_phrases TEXT[] DEFAULT '{}',
    delivery_emphasis_technique TEXT,
    delivery_closing_style TEXT,
    delivery_catchphrases TEXT[] DEFAULT '{}',

    -- Best suited formats
    best_for_formats TEXT[] DEFAULT '{}',

    -- TTS configuration
    tts_provider VARCHAR(50) DEFAULT '11labs',
    tts_voice_id VARCHAR(100),
    tts_settings JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hosts_slug ON hosts(slug);
CREATE INDEX idx_hosts_archetype ON hosts(archetype);
CREATE INDEX idx_hosts_active ON hosts(is_active);

-- ============================================
-- PRODUCERS - The Gatherers
-- ============================================

CREATE TABLE producers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    archetype VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,

    -- Personality attributes (0-1 scale)
    attr_verification_rigor FLOAT DEFAULT 0.5 CHECK (attr_verification_rigor >= 0 AND attr_verification_rigor <= 1),
    attr_rabbit_hole_depth FLOAT DEFAULT 0.5,
    attr_controversy_affinity FLOAT DEFAULT 0.5,
    attr_speed_priority FLOAT DEFAULT 0.5,
    attr_narrative_focus FLOAT DEFAULT 0.5,
    attr_web_research_intensity FLOAT DEFAULT 0.5,

    -- Search behavior
    search_always_check_web BOOLEAN DEFAULT FALSE,
    search_verify_official_sources BOOLEAN DEFAULT TRUE,
    search_check_comments BOOLEAN DEFAULT FALSE,
    search_look_for_contrast BOOLEAN DEFAULT FALSE,
    search_cross_reference_twitter BOOLEAN DEFAULT FALSE,
    search_max_sources_before_decision INTEGER DEFAULT 5,

    -- Best suited formats
    best_for_formats TEXT[] DEFAULT '{}',

    -- What triggers this producer
    trigger_opportunity_types TEXT[] DEFAULT '{}',

    -- LLM configuration for this producer
    llm_provider VARCHAR(50) DEFAULT 'local',  -- 'local', 'openai', 'anthropic'
    llm_model VARCHAR(100),
    llm_temperature FLOAT DEFAULT 0.7,
    llm_system_prompt TEXT,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_producers_slug ON producers(slug);
CREATE INDEX idx_producers_archetype ON producers(archetype);
CREATE INDEX idx_producers_active ON producers(is_active);

-- ============================================
-- WORKFLOWS - Scheduled Pipeline Runs
-- ============================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- What this workflow does
    pipeline_phase VARCHAR(100) NOT NULL,  -- 'perimeter', 'extraction', 'audit', etc.

    -- Scope
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,  -- NULL = all topics

    -- Schedule (cron-like)
    schedule_type VARCHAR(50) CHECK (schedule_type IN ('interval', 'cron', 'manual', 'trigger')),
    schedule_interval_minutes INTEGER,  -- For 'interval' type
    schedule_cron VARCHAR(100),         -- For 'cron' type
    schedule_trigger_event VARCHAR(100), -- For 'trigger' type (e.g., 'new_tweet', 'claim_threshold')

    -- Configuration
    config JSONB DEFAULT '{}',

    -- LLM settings for this workflow
    use_local_llm BOOLEAN DEFAULT TRUE,
    llm_provider VARCHAR(50) DEFAULT 'local',
    llm_model VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflows_phase ON workflows(pipeline_phase);
CREATE INDEX idx_workflows_topic ON workflows(topic_id);
CREATE INDEX idx_workflows_active ON workflows(is_active);
CREATE INDEX idx_workflows_next_run ON workflows(next_run_at);

-- Workflow run history
CREATE TABLE workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,

    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,

    -- Results
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,

    -- LLM usage
    llm_provider_used VARCHAR(50),
    llm_tokens_used INTEGER DEFAULT 0,
    llm_cost_cents INTEGER DEFAULT 0,

    -- Errors
    error_message TEXT,
    error_details JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_started ON workflow_runs(started_at DESC);

-- ============================================
-- PRODUCTIONS - What's Being Produced
-- ============================================

CREATE TABLE productions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- What story this is based on
    story_candidate_id UUID REFERENCES story_candidates(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,

    -- Format
    format VARCHAR(100) NOT NULL,  -- 'talk_show_debate', 'news_bulletin', etc.

    -- Assigned team
    producer_id UUID REFERENCES producers(id) ON DELETE SET NULL,
    host_ids UUID[] DEFAULT '{}',

    -- Production brief (from producer)
    headline VARCHAR(500),
    angle TEXT,
    tone VARCHAR(100),
    target_duration_minutes INTEGER,

    -- The 5Ws
    story_who TEXT[] DEFAULT '{}',
    story_what TEXT,
    story_where TEXT,
    story_when TEXT,
    story_why TEXT,

    -- For debate formats
    perspectives JSONB,  -- { sideA: {...}, sideB: {...} }

    -- Sources gathered
    sources JSONB DEFAULT '[]',

    -- Readiness
    readiness_score FLOAT DEFAULT 0,
    readiness_has_enough_sources BOOLEAN DEFAULT FALSE,
    readiness_has_conflict BOOLEAN DEFAULT FALSE,
    readiness_has_5ws BOOLEAN DEFAULT FALSE,
    readiness_is_verified BOOLEAN DEFAULT FALSE,

    -- Generated content
    script TEXT,
    script_segments JSONB DEFAULT '[]',

    -- Audio/Video
    audio_url TEXT,
    video_url TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'briefing' CHECK (status IN (
        'briefing',      -- Producer is gathering info
        'researching',   -- Active research phase
        'ready',         -- Ready for script generation
        'scripting',     -- Generating script
        'review',        -- Human review
        'recording',     -- TTS generation
        'editing',       -- Post-production
        'published',     -- Done
        'killed'         -- Cancelled
    )),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_productions_topic ON productions(topic_id);
CREATE INDEX idx_productions_producer ON productions(producer_id);
CREATE INDEX idx_productions_status ON productions(status);
CREATE INDEX idx_productions_format ON productions(format);

-- Production sources (detailed)
CREATE TABLE production_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_id UUID REFERENCES productions(id) ON DELETE CASCADE,

    source_type VARCHAR(50) CHECK (source_type IN ('tweet', 'video', 'article', 'comment', 'official', 'web')),
    url TEXT,
    content TEXT,
    author VARCHAR(255),
    credibility FLOAT DEFAULT 0.5,
    timestamp TIMESTAMP WITH TIME ZONE,
    sentiment VARCHAR(50),
    stance VARCHAR(50),

    -- Which side of debate (if applicable)
    perspective_side VARCHAR(10),  -- 'A', 'B', or NULL

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_production_sources_production ON production_sources(production_id);

-- ============================================
-- LLM CONFIGURATION
-- ============================================

CREATE TABLE llm_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(100) NOT NULL UNIQUE,
    provider_type VARCHAR(50) NOT NULL,  -- 'local', 'openai', 'anthropic', 'ollama'

    -- Connection
    base_url TEXT,
    api_key_env_var VARCHAR(100),  -- Name of env var holding API key

    -- Available models
    models JSONB DEFAULT '[]',  -- [{name, context_length, supports_vision, etc.}]

    -- Default model
    default_model VARCHAR(100),

    -- Cost tracking (for paid providers)
    cost_per_1k_input_tokens FLOAT DEFAULT 0,
    cost_per_1k_output_tokens FLOAT DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_health_check TIMESTAMP WITH TIME ZONE,
    health_status VARCHAR(50) DEFAULT 'unknown',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LLM usage tracking
CREATE TABLE llm_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    provider_id UUID REFERENCES llm_providers(id) ON DELETE SET NULL,
    model VARCHAR(100),

    -- What used it
    workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    production_id UUID REFERENCES productions(id) ON DELETE SET NULL,
    purpose VARCHAR(100),  -- 'extraction', 'script_generation', 'research', etc.

    -- Usage
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    -- Cost (for paid providers)
    cost_cents INTEGER DEFAULT 0,

    -- Timing
    duration_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_llm_usage_provider ON llm_usage_log(provider_id);
CREATE INDEX idx_llm_usage_created ON llm_usage_log(created_at DESC);

-- ============================================
-- RAG CONFIGURATION
-- ============================================

CREATE TABLE rag_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Scope
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,  -- NULL = global

    -- Vector DB configuration
    vector_db_type VARCHAR(50) DEFAULT 'pgvector',  -- 'pgvector', 'chroma', 'pinecone', etc.
    embedding_model VARCHAR(100) DEFAULT 'local',
    embedding_dimensions INTEGER DEFAULT 1536,

    -- What's indexed
    source_types TEXT[] DEFAULT '{}',  -- ['tweets', 'videos', 'claims', 'entities']

    -- Status
    document_count INTEGER DEFAULT 0,
    last_indexed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RAG document chunks (for pgvector)
CREATE TABLE rag_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID REFERENCES rag_collections(id) ON DELETE CASCADE,

    -- Source reference
    source_type VARCHAR(50),
    source_id UUID,

    -- Content
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',

    -- Vector embedding (using pgvector)
    embedding vector(1536),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rag_documents_collection ON rag_documents(collection_id);
CREATE INDEX idx_rag_documents_embedding ON rag_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_hosts_timestamp BEFORE UPDATE ON hosts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_producers_timestamp BEFORE UPDATE ON producers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_workflows_timestamp BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_productions_timestamp BEFORE UPDATE ON productions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_llm_providers_timestamp BEFORE UPDATE ON llm_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_rag_collections_timestamp BEFORE UPDATE ON rag_collections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
