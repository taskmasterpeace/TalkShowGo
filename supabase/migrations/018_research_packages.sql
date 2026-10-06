-- Research Packages Migration
-- Stores complete research bundles for stories and topics

-- Create research_packages table
CREATE TABLE IF NOT EXISTS research_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Associations
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    story_candidate_id UUID REFERENCES story_candidates(id) ON DELETE SET NULL,
    research_run_id UUID,

    -- Query context
    query TEXT NOT NULL,
    interpreted_query TEXT,

    -- The complete package (JSONB for flexibility)
    package_json JSONB NOT NULL,

    -- Computed summaries for quick access (denormalized)
    stats JSONB,
    headline VARCHAR(500),
    story_type VARCHAR(50),

    -- Export tracking
    markdown_path TEXT,
    json_path TEXT,

    -- Metadata
    version VARCHAR(20) DEFAULT '1.0',
    generated_by VARCHAR(50) DEFAULT 'system',
    status VARCHAR(50) DEFAULT 'complete',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_research_packages_topic
    ON research_packages(topic_id);

CREATE INDEX IF NOT EXISTS idx_research_packages_story
    ON research_packages(story_candidate_id);

CREATE INDEX IF NOT EXISTS idx_research_packages_created
    ON research_packages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_packages_status
    ON research_packages(status);

-- GIN index for JSONB queries on package_json
CREATE INDEX IF NOT EXISTS idx_research_packages_json
    ON research_packages USING GIN (package_json);

-- GIN index for stats queries
CREATE INDEX IF NOT EXISTS idx_research_packages_stats
    ON research_packages USING GIN (stats);

-- Updated trigger
CREATE OR REPLACE FUNCTION update_research_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS research_packages_updated_at ON research_packages;
CREATE TRIGGER research_packages_updated_at
    BEFORE UPDATE ON research_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_research_packages_updated_at();

-- Comments
COMMENT ON TABLE research_packages IS 'Complete research bundles for stories and topics';
COMMENT ON COLUMN research_packages.package_json IS 'Full ResearchPackage object as JSONB';
COMMENT ON COLUMN research_packages.stats IS 'Quick access stats (sources_count, entities_count, etc.)';
COMMENT ON COLUMN research_packages.headline IS 'Denormalized headline for quick display';
