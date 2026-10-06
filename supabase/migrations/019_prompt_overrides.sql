-- Migration 019: Prompt Override System
-- Enables live editing of AI prompts through the UI

-- ============================================
-- PROMPT OVERRIDES TABLE
-- ============================================
-- Stores custom prompt versions that override hardcoded defaults

CREATE TABLE IF NOT EXISTS prompt_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which prompt this overrides (matches ID from prompt-registry.ts)
    prompt_id VARCHAR(100) NOT NULL,

    -- Optional topic-specific override (NULL = global override)
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,

    -- Custom prompt template
    template TEXT NOT NULL,

    -- Required variables for this prompt (JSONB array)
    variables JSONB DEFAULT '[]'::jsonb,

    -- Version tracking (auto-incremented on updates)
    version INTEGER NOT NULL DEFAULT 1,

    -- Is this override currently active?
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Producer notes explaining why this was customized
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT prompt_overrides_unique_active UNIQUE (prompt_id, topic_id, is_active)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_overrides_prompt_id ON prompt_overrides(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_overrides_topic_id ON prompt_overrides(topic_id);
CREATE INDEX IF NOT EXISTS idx_prompt_overrides_active ON prompt_overrides(is_active) WHERE is_active = true;

-- ============================================
-- PROMPT CHANGE HISTORY TABLE
-- ============================================
-- Audit trail of all prompt modifications

CREATE TABLE IF NOT EXISTS prompt_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which override was changed
    prompt_override_id UUID NOT NULL REFERENCES prompt_overrides(id) ON DELETE CASCADE,

    -- Before and after snapshots
    old_template TEXT,
    new_template TEXT NOT NULL,

    -- Who made the change (future: user authentication)
    changed_by VARCHAR(255) DEFAULT 'system',

    -- Why was this changed?
    change_reason TEXT,

    -- When did this happen?
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching history
CREATE INDEX IF NOT EXISTS idx_prompt_history_override_id ON prompt_change_history(prompt_override_id);
CREATE INDEX IF NOT EXISTS idx_prompt_history_changed_at ON prompt_change_history(changed_at DESC);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_prompt_override_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_override_updated_at
    BEFORE UPDATE ON prompt_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_prompt_override_timestamp();

-- ============================================
-- TRIGGER: Auto-log changes to history
-- ============================================

CREATE OR REPLACE FUNCTION log_prompt_override_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if template actually changed
    IF (TG_OP = 'UPDATE' AND OLD.template IS DISTINCT FROM NEW.template) THEN
        INSERT INTO prompt_change_history (
            prompt_override_id,
            old_template,
            new_template,
            changed_by,
            change_reason
        ) VALUES (
            NEW.id,
            OLD.template,
            NEW.template,
            'system',  -- Will be replaced with actual user in future
            'Prompt updated via UI'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_override_log_changes
    AFTER UPDATE ON prompt_overrides
    FOR EACH ROW
    EXECUTE FUNCTION log_prompt_override_change();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get active override for a specific prompt (with optional topic filter)
CREATE OR REPLACE FUNCTION get_active_prompt_override(
    p_prompt_id VARCHAR(100),
    p_topic_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    template TEXT,
    variables JSONB,
    version INTEGER,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        po.id,
        po.template,
        po.variables,
        po.version,
        po.notes
    FROM prompt_overrides po
    WHERE po.prompt_id = p_prompt_id
        AND po.is_active = true
        AND (
            (p_topic_id IS NULL AND po.topic_id IS NULL) OR
            po.topic_id = p_topic_id
        )
    ORDER BY
        -- Topic-specific overrides take precedence over global
        CASE WHEN po.topic_id IS NOT NULL THEN 1 ELSE 2 END,
        po.updated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERMISSIONS
-- ============================================

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON prompt_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON prompt_overrides TO authenticated;
GRANT SELECT ON prompt_change_history TO anon;
GRANT SELECT ON prompt_change_history TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_active_prompt_override TO anon;
GRANT EXECUTE ON FUNCTION get_active_prompt_override TO authenticated;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE prompt_overrides IS 'Stores custom AI prompts that override hardcoded defaults from prompt-registry.ts. Enables live editing through UI.';
COMMENT ON TABLE prompt_change_history IS 'Audit trail of all prompt modifications for compliance and rollback.';
COMMENT ON COLUMN prompt_overrides.prompt_id IS 'Matches prompt ID from src/lib/prompt-registry.ts (e.g., "story_generation", "dialogue_creation")';
COMMENT ON COLUMN prompt_overrides.topic_id IS 'NULL = global override, UUID = topic-specific override';
COMMENT ON COLUMN prompt_overrides.version IS 'Auto-incremented on each update for version tracking';
COMMENT ON COLUMN prompt_overrides.is_active IS 'Only one active override per (prompt_id, topic_id) combination allowed';
