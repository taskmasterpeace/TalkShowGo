-- Multi-Host Debate & Discussion System
-- Allows producers to create shows with multiple AI hosts (or eventually real guests)
-- Each host can use different LLM models and have distinct personalities

-- ============================================
-- DROP EXISTING TABLES (if they exist from partial migration)
-- ============================================
DROP TABLE IF EXISTS script_refinements CASCADE;
DROP TABLE IF EXISTS conversation_turns CASCADE;
DROP TABLE IF EXISTS host_model_preferences CASCADE;
DROP TABLE IF EXISTS debate_preparation_runs CASCADE;
DROP TABLE IF EXISTS debate_show_runs CASCADE;
DROP TABLE IF EXISTS host_generation_templates CASCADE;
DROP TABLE IF EXISTS production_strategies CASCADE;
DROP TABLE IF EXISTS show_formats CASCADE;
DROP TABLE IF EXISTS debate_hosts CASCADE;

-- ============================================
-- TABLE 1: debate_hosts
-- Custom host profiles with personality attributes
-- ============================================
CREATE TABLE IF NOT EXISTS debate_hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    archetype VARCHAR(100),  -- "analyst", "comedian", "investigator", etc.
    bio TEXT,

    -- Personality Attributes (0-100 scale)
    opinion_strength INTEGER DEFAULT 50 CHECK (opinion_strength >= 0 AND opinion_strength <= 100),
    aggression INTEGER DEFAULT 50 CHECK (aggression >= 0 AND aggression <= 100),
    humor INTEGER DEFAULT 50 CHECK (humor >= 0 AND humor <= 100),
    analytical_depth INTEGER DEFAULT 50 CHECK (analytical_depth >= 0 AND analytical_depth <= 100),
    empathy INTEGER DEFAULT 50 CHECK (empathy >= 0 AND empathy <= 100),
    speed INTEGER DEFAULT 50 CHECK (speed >= 0 AND speed <= 100),
    formality INTEGER DEFAULT 50 CHECK (formality >= 0 AND formality <= 100),

    -- Behavior Flags (JSONB)
    -- {interrupts: true, uses_catchphrases: true, references_pop_culture: true, ...}
    behaviors JSONB DEFAULT '{}'::jsonb,

    -- LLM Configuration
    preferred_model VARCHAR(100),  -- e.g., "anthropic/claude-opus-4.5"
    fallback_model VARCHAR(100),
    model_selection VARCHAR(20) DEFAULT 'auto' CHECK (model_selection IN ('auto', 'manual')),

    -- Voice Configuration
    elevenlabs_voice_id VARCHAR(100),
    voice_settings JSONB DEFAULT '{}'::jsonb,  -- {stability: 50, similarity_boost: 75, style: "conversational"}

    -- System Prompt
    system_prompt TEXT,  -- LLM instructions for this host
    catchphrases TEXT[],  -- Signature phrases

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(200),
    created_from_template VARCHAR(200),  -- "Stephen A Smith" if AI-generated
    tags TEXT[],

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_debate_hosts_active ON debate_hosts(is_active) WHERE is_active = true;
CREATE INDEX idx_debate_hosts_archetype ON debate_hosts(archetype);
CREATE INDEX idx_debate_hosts_tags ON debate_hosts USING GIN(tags);

-- ============================================
-- TABLE 2: show_formats
-- Format definitions (Debate, News, Deep Commentary, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS show_formats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    format_type VARCHAR(50) CHECK (format_type IN ('debate', 'news', 'deep_commentary', 'investigative', 'panel')),

    -- Structure
    min_hosts INTEGER DEFAULT 1,
    max_hosts INTEGER DEFAULT 5,
    target_duration_minutes INTEGER DEFAULT 10,

    -- Phase Configuration (JSONB)
    -- [{name: "Opening", duration_pct: 10}, {name: "Main", duration_pct: 80}, ...]
    phases JSONB,

    -- Turn-Taking Rules
    turn_taking_strategy VARCHAR(50) DEFAULT 'dynamic' CHECK (turn_taking_strategy IN ('round_robin', 'dynamic', 'moderated')),
    allow_interruptions BOOLEAN DEFAULT true,

    -- Templates
    intro_template TEXT,
    outro_template TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_show_formats_type ON show_formats(format_type);

-- ============================================
-- TABLE 3: debate_preparation_runs
-- Tracks each host's preparation phase
-- ============================================
CREATE TABLE IF NOT EXISTS debate_preparation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    show_run_id UUID,  -- Links to debate_show_runs (can be NULL during prep)
    host_id UUID REFERENCES debate_hosts(id) ON DELETE CASCADE,

    -- Research Phase
    topic TEXT NOT NULL,
    research_package_id UUID,  -- Optional link to research package (if table exists)

    -- Self-Directed Research
    -- [{request: "Find court documents", sources: [...], reason: "Need legal evidence"}, ...]
    research_requests JSONB,
    research_results JSONB,  -- Collected materials

    -- Stance Formation
    stance TEXT,  -- Host's position after research
    talking_points TEXT[],  -- Key arguments prepared
    questions_for_opponents TEXT[],

    -- LLM Metadata
    model_used VARCHAR(100),
    tokens_used INTEGER,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_debate_prep_show_run ON debate_preparation_runs(show_run_id);
CREATE INDEX idx_debate_prep_host ON debate_preparation_runs(host_id);

-- ============================================
-- TABLE 4: debate_show_runs
-- Complete show generation tracking
-- ============================================
CREATE TABLE IF NOT EXISTS debate_show_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,

    -- Format & Hosts
    show_format_id UUID REFERENCES show_formats(id) ON DELETE SET NULL,
    host_ids UUID[],  -- Array of participating host IDs

    -- Input
    topic TEXT NOT NULL,
    research_package_id UUID,  -- Optional link to research package (if table exists)
    producer_instructions TEXT,

    -- Emotional Beats (Producer-defined emotional journey)
    emotional_beats JSONB,  -- {arc_type: "outrage_revelation", milestones: [...]}

    -- Preparation Phase Results
    preparation_run_ids UUID[],  -- Links to debate_preparation_runs
    preparation_summary JSONB,  -- {host_a_stance: "...", host_b_stance: "...", ...}

    -- Debate Phase Results
    conversation_turns JSONB,  -- [{speaker_id, text, turn_number, timestamp_ms, emotion}, ...]
    full_script TEXT,

    -- Audio
    audio_url TEXT,
    audio_duration_seconds INTEGER,

    -- Costs
    total_tokens_used INTEGER,
    cost_usd DECIMAL(10, 4),
    cost_breakdown JSONB,  -- {prep_phase: 1.20, debate_phase: 2.50, audio: 0.80}

    -- Refinement tracking
    refinement_count INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'prep_pending' CHECK (status IN (
        'prep_pending', 'prep_running', 'debate_pending', 'debate_running',
        'audio_generating', 'completed', 'failed'
    )),
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_debate_show_runs_topic ON debate_show_runs(topic_id);
CREATE INDEX idx_debate_show_runs_status ON debate_show_runs(status);
CREATE INDEX idx_debate_show_runs_created ON debate_show_runs(created_at DESC);

-- ============================================
-- TABLE 5: host_model_preferences
-- Track model performance for each host
-- ============================================
CREATE TABLE IF NOT EXISTS host_model_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID REFERENCES debate_hosts(id) ON DELETE CASCADE,

    -- Model Performance Tracking
    model_name VARCHAR(100) NOT NULL,
    times_used INTEGER DEFAULT 0,
    avg_quality_score DECIMAL(3, 2),  -- Producer ratings 0-5
    avg_tokens_per_turn INTEGER,
    avg_cost_per_show DECIMAL(10, 4),

    -- Optimization
    recommended BOOLEAN DEFAULT false,  -- System recommends this model for this host

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(host_id, model_name)
);

CREATE INDEX idx_host_model_prefs_host ON host_model_preferences(host_id);
CREATE INDEX idx_host_model_prefs_recommended ON host_model_preferences(recommended) WHERE recommended = true;

-- ============================================
-- TABLE 6: conversation_turns
-- Detailed turn data for each show
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    show_run_id UUID REFERENCES debate_show_runs(id) ON DELETE CASCADE,

    turn_number INTEGER NOT NULL,
    speaker_id UUID REFERENCES debate_hosts(id) ON DELETE SET NULL,
    text TEXT NOT NULL,

    -- Context
    responding_to_turn_id UUID REFERENCES conversation_turns(id) ON DELETE SET NULL,
    topic_shift BOOLEAN DEFAULT false,

    -- Emotion/Delivery
    emotion VARCHAR(50),  -- "passionate", "skeptical", "humorous", etc.
    emphasis_words TEXT[],  -- Words to emphasize in audio

    -- Timing (for audio sync)
    audio_start_ms INTEGER,
    audio_end_ms INTEGER,

    -- LLM Metadata
    model_used VARCHAR(100),
    tokens_used INTEGER,
    generation_time_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversation_turns_show ON conversation_turns(show_run_id, turn_number);
CREATE INDEX idx_conversation_turns_speaker ON conversation_turns(speaker_id);

-- ============================================
-- TABLE 7: host_generation_templates
-- Pre-built templates for AI host generation
-- ============================================
CREATE TABLE IF NOT EXISTS host_generation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(200) NOT NULL UNIQUE,  -- "Stephen A Smith", "Rachel Maddow", etc.
    category VARCHAR(100),  -- "Sports Commentator", "News Anchor", "Podcaster"

    -- Generated Profile (used as starting point)
    profile_json JSONB NOT NULL,  -- Complete host profile

    -- Metadata
    times_used INTEGER DEFAULT 0,
    avg_rating DECIMAL(3, 2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_host_templates_category ON host_generation_templates(category);

-- ============================================
-- TABLE 8: production_strategies
-- Professional production techniques library
-- ============================================
CREATE TABLE IF NOT EXISTS production_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('pacing', 'emotion', 'structure', 'character')),
    description TEXT,
    when_to_use TEXT,
    prompt_template TEXT NOT NULL,
    examples TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_production_strategies_category ON production_strategies(category);
CREATE INDEX idx_production_strategies_active ON production_strategies(is_active) WHERE is_active = true;

-- ============================================
-- TABLE 9: script_refinements
-- Track producer punch-up passes
-- ============================================
CREATE TABLE IF NOT EXISTS script_refinements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    show_run_id UUID REFERENCES debate_show_runs(id) ON DELETE CASCADE,
    refinement_number INTEGER NOT NULL,  -- 1st pass, 2nd pass, etc.

    -- What producer wants to change
    -- [{strategy_id, target_host_id, time_range, custom_notes}, ...]
    strategies_applied JSONB NOT NULL,

    -- Results
    original_script TEXT NOT NULL,
    refined_script TEXT NOT NULL,
    changes_summary TEXT,  -- LLM summary of what changed

    -- Cost
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 4),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_script_refinements_show ON script_refinements(show_run_id, refinement_number);

-- ============================================
-- FOREIGN KEY: Link debate_preparation_runs to debate_show_runs
-- ============================================
ALTER TABLE debate_preparation_runs
ADD CONSTRAINT fk_debate_prep_show_run
FOREIGN KEY (show_run_id) REFERENCES debate_show_runs(id) ON DELETE CASCADE;

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON debate_hosts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON debate_hosts TO authenticated;

GRANT SELECT ON show_formats TO anon;
GRANT SELECT ON show_formats TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON debate_preparation_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON debate_preparation_runs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON debate_show_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON debate_show_runs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON host_model_preferences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON host_model_preferences TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_turns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_turns TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON host_generation_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON host_generation_templates TO authenticated;

GRANT SELECT ON production_strategies TO anon;
GRANT SELECT ON production_strategies TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON script_refinements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON script_refinements TO authenticated;

-- ============================================
-- SEED DATA: Production Strategies
-- ============================================
INSERT INTO production_strategies (name, category, description, when_to_use, prompt_template, examples) VALUES
('Increase Conflict', 'character', 'Add more disagreement and friction between hosts', 'When debate feels too agreeable or lacking tension',
'Review the conversation between {host_a} and {host_b} from {start_time} to {end_time}.
Add more direct disagreement. Have them challenge each other''s points more forcefully.
Increase confrontation while staying in character.

Producer notes: {custom_notes}',
ARRAY['Debate felt too polite', 'Need stronger opposing viewpoints']),

('Heighten Stakes', 'emotion', 'Emphasize consequences and urgency', 'When topic feels abstract or low-impact',
'In {time_range}, emphasize why this matters.
Add urgency. Highlight real-world consequences. Make the audience care MORE.

Producer notes: {custom_notes}',
ARRAY['Topic feels academic', 'Need emotional investment']),

('Add Callback', 'structure', 'Reference an earlier moment to create cohesion', 'To tie the show together, create "full circle" moments',
'Have {host} reference what {other_host} said earlier about "{topic}".
Create a callback that connects to the opening or an earlier beat.

Producer notes: {custom_notes}',
ARRAY['Answer opening question', 'Circle back to intro theme']),

('Stronger Close', 'structure', 'Punch up final statements for impact', 'When closing feels weak or trails off',
'Rewrite {host}''s closing statement to be more impactful.
Make it memorable. Give a strong final message. Stick the landing.

Producer notes: {custom_notes}',
ARRAY['Ending feels flat', 'Need quotable finish']),

('Build Suspense', 'pacing', 'Slow the reveal, withhold information', 'Before a revelation or when pacing feels rushed',
'In {time_range}, slow down the reveal of "{revelation}".
Build anticipation. Tease it. Make the audience lean in.
Don''t give it away too early.

Producer notes: {custom_notes}',
ARRAY['Big reveal came too fast', 'Need more buildup']),

('Lighten Mood', 'emotion', 'Add humor to break tension', 'When show feels too heavy or intense',
'In {time_range}, add a humor beat.
Have {host} lighten the mood without undermining the topic.
Brief moment of levity.

Producer notes: {custom_notes}',
ARRAY['Too dark for too long', 'Need comedic relief']),

('Deepen Analysis', 'character', 'Add more detail and depth to a point', 'When coverage feels superficial',
'Have {host} go deeper on "{topic}" from {start_time} to {end_time}.
More detail. More context. More expertise.

Producer notes: {custom_notes}',
ARRAY['Glossed over important point', 'Need expert depth']),

('Pace Up', 'pacing', 'Tighten dialogue, remove filler', 'When section drags or feels repetitive',
'Tighten {time_range}. Cut to the core.
Remove repetition, tangents, filler. Keep only what matters.

Producer notes: {custom_notes}',
ARRAY['Section feels slow', 'Hosts repeating themselves']),

('Emotional Peak', 'emotion', 'Amplify the emotional moment', 'At climax or revelation beat',
'At {time}, amplify the emotional impact.
This is the peak. Make it hit harder.

Producer notes: {custom_notes}',
ARRAY['Big moment needs more weight', 'Climax feels muted']),

('Plant/Payoff', 'structure', 'Set up something early, deliver later', 'To create satisfying structure',
'Plant "{setup}" early (around {plant_time}).
Pay it off at {payoff_time}.
Make the callback satisfying.

Producer notes: {custom_notes}',
ARRAY['Create mystery to solve', 'Foreshadow revelation']);

-- ============================================
-- SEED DATA: Show Formats
-- ============================================
INSERT INTO show_formats (name, description, format_type, min_hosts, max_hosts, target_duration_minutes, phases, turn_taking_strategy, intro_template, outro_template) VALUES
('Debate', 'Structured argumentation with opposing viewpoints', 'debate', 2, 4, 10,
'[{"name": "Opening Statements", "duration_pct": 15}, {"name": "Cross-Examination", "duration_pct": 60}, {"name": "Rebuttals", "duration_pct": 15}, {"name": "Closing Arguments", "duration_pct": 10}]'::jsonb,
'dynamic',
'Welcome to tonight''s debate on {topic}. {host_introductions}',
'That concludes our debate. Thanks for watching.'),

('News Roundup', 'Multiple stories with deep context and analysis', 'news', 2, 3, 15,
'[{"name": "Intro", "duration_pct": 5}, {"name": "Stories", "duration_pct": 80}, {"name": "Twitter Digest", "duration_pct": 10}, {"name": "Outro", "duration_pct": 5}]'::jsonb,
'dynamic',
'{date} - Here''s what happened. {host_introductions}',
'That''s all for today. We''ll see you next time.'),

('Deep Commentary', 'Single topic deep dive with historical context', 'deep_commentary', 1, 2, 20,
'[{"name": "Introduction", "duration_pct": 10}, {"name": "Historical Context", "duration_pct": 20}, {"name": "Analysis", "duration_pct": 50}, {"name": "Implications", "duration_pct": 15}, {"name": "Takeaways", "duration_pct": 5}]'::jsonb,
'round_robin',
'Today we''re diving deep into {topic}. {host_introductions}',
'Thanks for joining us for this deep dive.'),

('Investigative', 'Evidence-based research presentation', 'investigative', 1, 1, 25,
'[{"name": "Mystery", "duration_pct": 10}, {"name": "Evidence", "duration_pct": 50}, {"name": "Analysis", "duration_pct": 25}, {"name": "Conclusions", "duration_pct": 10}, {"name": "Questions", "duration_pct": 5}]'::jsonb,
'moderated',
'We investigated {topic}. Here''s what we found.',
'Those are our findings. Some questions remain unanswered.'),

('Panel Discussion', 'Collaborative exploration with multiple perspectives', 'panel', 3, 5, 15,
'[{"name": "Introduction", "duration_pct": 5}, {"name": "Initial Takes", "duration_pct": 20}, {"name": "Open Discussion", "duration_pct": 60}, {"name": "Consensus", "duration_pct": 10}, {"name": "Takeaways", "duration_pct": 5}]'::jsonb,
'dynamic',
'Welcome to our panel discussion on {topic}. {host_introductions}',
'Thanks to our panelists. See you next time.');

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE debate_hosts IS 'AI host profiles with personality attributes (or future real human guests)';
COMMENT ON TABLE show_formats IS 'Show format definitions (Debate, News, Deep Commentary, Investigative, Panel)';
COMMENT ON TABLE debate_preparation_runs IS 'Tracks each host''s independent research and stance formation';
COMMENT ON TABLE debate_show_runs IS 'Complete show generation runs with all phases';
COMMENT ON TABLE production_strategies IS 'Professional TV production techniques for script refinement';
COMMENT ON TABLE script_refinements IS 'Producer punch-up passes applied to scripts';
