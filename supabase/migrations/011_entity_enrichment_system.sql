-- 011_entity_enrichment_system.sql
-- Entity Context Injection & Research Transparency System

-- ============================================
-- RESEARCH RUNS (Transparency Dashboard)
-- ============================================

-- Track research runs for full transparency
CREATE TABLE IF NOT EXISTS research_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',

    -- Query interpretation
    query_plan JSONB,  -- The interpreted query plan from LLM

    -- Search phase
    queries_executed JSONB DEFAULT '[]',  -- All search queries run
    videos_found INTEGER DEFAULT 0,
    videos_filtered INTEGER DEFAULT 0,
    filter_reasons JSONB DEFAULT '{}',  -- {video_id: "reason"}

    -- Selection phase
    selected_videos JSONB DEFAULT '[]',  -- [{id, title, score, reason}]

    -- Transcript phase
    transcripts_youtube INTEGER DEFAULT 0,
    transcripts_assemblyai INTEGER DEFAULT 0,
    transcripts_failed INTEGER DEFAULT 0,
    transcript_details JSONB DEFAULT '[]',  -- [{video_id, source, confidence, length}]

    -- Entity extraction
    entities_extracted JSONB DEFAULT '[]',  -- [{name, count, sources}]

    -- Output files
    output_markdown_path TEXT,
    output_json_path TEXT,

    -- Costs
    cost_assemblyai_cents INTEGER DEFAULT 0,
    cost_llm_tokens INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Errors
    errors JSONB DEFAULT '[]',  -- [{stage, message, video_id}]

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup by topic
CREATE INDEX IF NOT EXISTS idx_research_runs_topic ON research_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_research_runs_created ON research_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_runs_status ON research_runs(status);

-- ============================================
-- ENTITY ENRICHMENT RUNS
-- ============================================

-- Track YouTube interview enrichment for entities
CREATE TABLE IF NOT EXISTS entity_enrichment_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,

    -- Search
    search_query TEXT NOT NULL,
    search_suffix TEXT DEFAULT 'interview',

    -- Status
    status VARCHAR(50) DEFAULT 'pending',

    -- Results
    videos_found INTEGER DEFAULT 0,
    videos_considered JSONB DEFAULT '[]',  -- Top candidates considered
    best_video_id VARCHAR(100),
    best_video_title TEXT,
    best_video_url TEXT,
    best_video_duration_seconds INTEGER,
    best_video_channel TEXT,

    -- Transcript
    transcript_text TEXT,
    transcript_source VARCHAR(50),  -- 'youtube_captions' or 'assemblyai'
    transcript_confidence DECIMAL(5,4),

    -- Extracted context
    extracted_context JSONB,  -- Partial EntityContext from LLM

    -- Costs
    cost_cents INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Error
    error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrichment_runs_entity ON entity_enrichment_runs(entity_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_runs_topic ON entity_enrichment_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_runs_status ON entity_enrichment_runs(status);

-- ============================================
-- PRONUNCIATION DICTIONARY
-- ============================================

-- Per-topic pronunciation dictionary for TTS
CREATE TABLE IF NOT EXISTS pronunciation_dictionary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,

    -- The word/name to pronounce
    word TEXT NOT NULL,

    -- How to pronounce it
    phoneme TEXT NOT NULL,  -- Phonetic spelling: "DAYLYT" -> "Day-lit"
    ipa TEXT,               -- IPA notation (optional)

    -- Context
    notes TEXT,             -- Additional notes
    example_sentence TEXT,  -- Example usage

    -- Metadata
    created_by TEXT DEFAULT 'manual',  -- 'manual', 'ai_extracted', 'imported'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(topic_id, word)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_pronunciation_topic ON pronunciation_dictionary(topic_id);
CREATE INDEX IF NOT EXISTS idx_pronunciation_word ON pronunciation_dictionary(word);

-- ============================================
-- EXTEND TOPICS WITH NICHE SETTINGS
-- ============================================

-- Add niche_settings column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'topics' AND column_name = 'niche_settings'
    ) THEN
        ALTER TABLE topics ADD COLUMN niche_settings JSONB DEFAULT '{}';
    END IF;
END $$;

-- Comment explaining niche_settings structure
COMMENT ON COLUMN topics.niche_settings IS 'Niche-specific settings: {
  "default_voice_id": "string - ElevenLabs voice ID",
  "entity_extraction_prompt": "string - Custom extraction prompt",
  "known_entity_types": ["battler", "blogger", "league"],
  "auto_enrich_threshold": 3,
  "interview_search_suffix": "interview",
  "style_profile_slug": "string - reference to style profile"
}';

-- ============================================
-- ENTITY CONTEXT CACHE
-- ============================================

-- Cache resolved entity context for prompts
CREATE TABLE IF NOT EXISTS entity_context_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,

    -- The resolved context
    resolved_context JSONB NOT NULL,
    source VARCHAR(50) NOT NULL,  -- 'database', 'web_search', 'enrichment', 'manual'

    -- Formatting
    glossary_entry TEXT NOT NULL,  -- Pre-formatted for prompt injection

    -- Validity
    resolved_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- NULL = never expires

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(entity_id, topic_id)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_context_cache_entity ON entity_context_cache(entity_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_topic ON entity_context_cache(topic_id);

-- ============================================
-- INITIAL DATA: Battle Rap Pronunciation
-- ============================================

-- Insert common battle rap pronunciations for the battle rap topic
-- These will be inserted only if the topic exists
INSERT INTO pronunciation_dictionary (topic_id, word, phoneme, ipa, notes)
SELECT
    '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'::uuid,
    word,
    phoneme,
    ipa,
    notes
FROM (VALUES
    ('DAYLYT', 'Day-lit', 'deɪ.lɪt', 'Battle rapper from Watts, CA'),
    ('QOTR', 'Q-O-T-R', 'kjuː.oʊ.tiː.ɑːr', 'Queen of the Ring - spell out'),
    ('URL', 'U-R-L', 'juː.ɑːr.ɛl', 'Ultimate Rap League - spell out'),
    ('RBE', 'R-B-E', 'ɑːr.biː.iː', 'Rare Breed Entertainment - spell out'),
    ('KOTD', 'K-O-T-D', 'keɪ.oʊ.tiː.diː', 'King of the Dot - spell out'),
    ('UM3', 'U-M-3', 'juː.ɛm.θriː', 'Ultimate Madness 3 - spell out'),
    ('HHIR', 'H-H-I-R', 'eɪtʃ.eɪtʃ.aɪ.ɑːr', 'Hip Hop Is Real - spell out'),
    ('15MOFE', 'Fifteen Mofay', 'fɪfˈtiːn moʊˈfeɪ', '15 Minutes of Fame Entertainment'),
    ('K-SHINE', 'Kay-Shine', 'keɪ.ʃaɪn', 'Battle rapper'),
    ('T-TOP', 'Tee-Top', 'tiː.tɒp', 'Battle rapper'),
    ('NJT', 'N-J-T', 'ɛn.dʒeɪ.tiː', 'New Jersey Twork - spell out'),
    ('JC', 'Jay-See', 'dʒeɪ.siː', 'Battle rapper'),
    ('JJDD', 'J-J-D-D', 'dʒeɪ.dʒeɪ.diː.diː', 'John John Da Don - spell out'),
    ('DNA', 'D-N-A', 'diː.ɛn.eɪ', 'Battle rapper - spell out')
) AS v(word, phoneme, ipa, notes)
WHERE EXISTS (
    SELECT 1 FROM topics WHERE id = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'::uuid
)
ON CONFLICT (topic_id, word) DO NOTHING;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get pronunciation dictionary for a topic
CREATE OR REPLACE FUNCTION get_pronunciation_dictionary(p_topic_id UUID)
RETURNS TABLE (
    word TEXT,
    phoneme TEXT,
    ipa TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT pd.word, pd.phoneme, pd.ipa
    FROM pronunciation_dictionary pd
    WHERE pd.topic_id = p_topic_id
    ORDER BY LENGTH(pd.word) DESC;  -- Longer words first for replacement
END;
$$ LANGUAGE plpgsql;

-- Function to get entity context for prompt injection
CREATE OR REPLACE FUNCTION get_entity_context_for_prompt(
    p_entity_names TEXT[],
    p_topic_id UUID
)
RETURNS TABLE (
    entity_name TEXT,
    entity_type TEXT,
    glossary_entry TEXT,
    source VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.name,
        e.type,
        COALESCE(
            ecc.glossary_entry,
            -- Fallback: generate basic entry from entity data
            e.name || ': ' || COALESCE(e.type, 'Unknown type') || '. ' ||
            COALESCE(e.metadata->>'role', '') ||
            CASE WHEN e.metadata->>'gender' IS NOT NULL
                 THEN ' (' || (e.metadata->>'gender') || ')'
                 ELSE '' END
        ) AS glossary_entry,
        COALESCE(ecc.source, 'database') AS source
    FROM entities e
    LEFT JOIN entity_context_cache ecc ON e.id = ecc.entity_id AND ecc.topic_id = p_topic_id
    WHERE e.name = ANY(p_entity_names)
      AND e.topic_id = p_topic_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANTS (for PostgREST)
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON research_runs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON entity_enrichment_runs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pronunciation_dictionary TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON entity_context_cache TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
