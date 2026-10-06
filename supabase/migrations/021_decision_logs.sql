-- Decision Logs for Daily Show Proposals
-- Tracks the reasoning path behind topic proposals for auditing

CREATE TABLE IF NOT EXISTS proposal_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  proposed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- The full decision log as JSONB
  decision_log JSONB NOT NULL,

  -- Quick access fields for querying
  topics_proposed INTEGER DEFAULT 0,
  videos_found INTEGER DEFAULT 0,
  tweets_found INTEGER DEFAULT 0,
  transcripts_fetched INTEGER DEFAULT 0,
  clusters_created INTEGER DEFAULT 0,
  clusters_rejected INTEGER DEFAULT 0,

  -- Processing metadata
  processing_time_ms INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by topic
CREATE INDEX IF NOT EXISTS idx_decision_logs_topic ON proposal_decision_logs(topic_id);

-- Index for querying by date (for historical comparison)
CREATE INDEX IF NOT EXISTS idx_decision_logs_date ON proposal_decision_logs(proposed_at DESC);

-- Index for JSONB queries on decision_log
CREATE INDEX IF NOT EXISTS idx_decision_logs_jsonb ON proposal_decision_logs USING GIN (decision_log);

-- Comment explaining the table
COMMENT ON TABLE proposal_decision_logs IS 'Tracks the reasoning path behind Daily Show topic proposals for auditing and performance analysis';
COMMENT ON COLUMN proposal_decision_logs.decision_log IS 'Full decision log including searches, analysis, decisions, topics_selected, and topics_rejected';

-- Grant permissions for PostgREST/Supabase access
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_decision_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_decision_logs TO authenticated;
