-- ============================================
-- API USAGE TRACKING
-- ============================================
-- Track all external API calls and costs

CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service VARCHAR(50) NOT NULL, -- 'twitter', 'youtube', 'llm'
    endpoint VARCHAR(100) NOT NULL,
    calls INTEGER DEFAULT 1,
    items_fetched INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10, 6) DEFAULT 0,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast aggregation queries
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_service ON api_usage(service);
CREATE INDEX IF NOT EXISTS idx_api_usage_topic ON api_usage(topic_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_service_date ON api_usage(service, created_at DESC);

-- ============================================
-- PULL HISTORY (Manual & Scheduled)
-- ============================================

CREATE TABLE IF NOT EXISTS pull_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pull_type VARCHAR(50) NOT NULL, -- 'twitter_timeline', 'twitter_search', 'youtube_channel', etc.
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    source_account_id UUID REFERENCES source_accounts(id) ON DELETE SET NULL,
    triggered_by VARCHAR(50) DEFAULT 'manual', -- 'manual', 'scheduled', 'workflow'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    items_found INTEGER DEFAULT 0,
    new_items INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10, 6) DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pull_history_topic ON pull_history(topic_id);
CREATE INDEX IF NOT EXISTS idx_pull_history_status ON pull_history(status);
CREATE INDEX IF NOT EXISTS idx_pull_history_started ON pull_history(started_at DESC);

-- ============================================
-- VIEW: Daily Usage Summary
-- ============================================

CREATE OR REPLACE VIEW daily_usage_summary AS
SELECT
    DATE(created_at) as date,
    service,
    SUM(calls) as total_calls,
    SUM(items_fetched) as total_items,
    SUM(estimated_cost) as total_cost
FROM api_usage
GROUP BY DATE(created_at), service
ORDER BY date DESC, service;

-- ============================================
-- VIEW: Service Usage Totals
-- ============================================

CREATE OR REPLACE VIEW service_usage_totals AS
SELECT
    service,
    endpoint,
    SUM(calls) as total_calls,
    SUM(items_fetched) as total_items,
    SUM(estimated_cost) as total_cost,
    MIN(created_at) as first_call,
    MAX(created_at) as last_call
FROM api_usage
GROUP BY service, endpoint
ORDER BY total_cost DESC;
