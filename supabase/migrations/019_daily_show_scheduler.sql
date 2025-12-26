-- Daily Show Frequency Scheduler - Database Schema
-- Migration: 019_daily_show_scheduler.sql
-- Created: 2025-12-26
-- Purpose: Enable automated recurring daily show generation on schedules

-- Daily Show Schedules Table
CREATE TABLE daily_show_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,

    -- Scheduling Configuration
    schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'interval', 'cron', 'manual')),
    schedule_time TIME,                      -- e.g., '09:00' for 9 AM daily
    schedule_days_of_week INT[],             -- [0,1,2,3,4,5,6] for Sun-Sat, used with 'weekly'
    schedule_interval_hours INT,             -- e.g., 6 for every 6 hours, used with 'interval'
    schedule_cron VARCHAR(100),              -- e.g., '0 9 * * 1-5' for weekdays at 9am, used with 'cron'
    timezone VARCHAR(50) DEFAULT 'UTC',      -- e.g., 'America/New_York'

    -- Show Configuration
    template_id UUID REFERENCES show_templates(id),
    host_slug VARCHAR(50),                   -- Host personality to use
    show_name_prefix VARCHAR(100),           -- e.g., 'Battle Rap' creates 'Battle Rap Daily'
    stories_count INT DEFAULT 3,
    hours_back INT DEFAULT 24,

    -- Content Options
    auto_select_topics BOOLEAN DEFAULT true, -- Auto vs. manual topic selection
    topic_selection_strategy VARCHAR(50) DEFAULT 'engagement',  -- 'engagement', 'recent', 'balanced'
    include_twitter_digest BOOLEAN DEFAULT true,
    production_format VARCHAR(50),           -- talk_show, news_bulletin, investigation, etc.
    use_channel_style BOOLEAN DEFAULT true,
    channel_style_file VARCHAR(100),         -- e.g., 'algorithm-institute-of-battle-rap'

    -- Audio Generation
    generate_audio BOOLEAN DEFAULT true,
    audio_output_path VARCHAR(255),          -- e.g., '/public/audio/daily/'

    -- Scheduling State
    is_active BOOLEAN DEFAULT true,
    last_generated_at TIMESTAMPTZ,
    next_scheduled_at TIMESTAMPTZ,
    last_run_status VARCHAR(50),             -- 'success', 'failed', 'skipped'
    last_run_error TEXT,

    -- Execution Limits
    max_retries INT DEFAULT 3,
    retry_delay_minutes INT DEFAULT 15,
    skip_if_no_content BOOLEAN DEFAULT false,  -- Skip if no new stories found

    -- Metadata
    description TEXT,
    created_by VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Show Run History Table
CREATE TABLE daily_show_run_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES daily_show_schedules(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id),

    -- Execution Details
    scheduled_for TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'retrying')),

    -- Generated Content
    show_date DATE,
    show_name VARCHAR(100),
    script_length INT,                       -- Characters
    duration_seconds INT,
    stories_count INT,
    audio_file_path TEXT,

    -- Metadata
    template_used UUID REFERENCES show_templates(id),
    host_used VARCHAR(50),
    topics_included JSONB,                   -- Array of topic summaries
    error_message TEXT,
    retry_count INT DEFAULT 0,

    -- Costs
    cost_llm_cents INT DEFAULT 0,
    cost_tts_cents INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_schedules_active ON daily_show_schedules(is_active, next_scheduled_at) WHERE is_active = true;
CREATE INDEX idx_schedules_topic ON daily_show_schedules(topic_id);
CREATE INDEX idx_run_history_schedule ON daily_show_run_history(schedule_id, executed_at DESC);
CREATE INDEX idx_run_history_status ON daily_show_run_history(status, executed_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_daily_show_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_show_schedules_updated_at
    BEFORE UPDATE ON daily_show_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_show_schedules_updated_at();

-- Comments for documentation
COMMENT ON TABLE daily_show_schedules IS 'Recurring show generation schedules with cron/interval/daily/weekly support';
COMMENT ON TABLE daily_show_run_history IS 'Execution history for scheduled show generations';
COMMENT ON COLUMN daily_show_schedules.schedule_type IS 'daily=same time daily, weekly=specific days, interval=every X hours, cron=custom expression, manual=no auto-run';
COMMENT ON COLUMN daily_show_schedules.schedule_days_of_week IS 'Array of day numbers (0=Sunday, 6=Saturday) for weekly schedules';
COMMENT ON COLUMN daily_show_schedules.topic_selection_strategy IS 'How to select topics: engagement (most active), recent (newest), balanced (mix)';
