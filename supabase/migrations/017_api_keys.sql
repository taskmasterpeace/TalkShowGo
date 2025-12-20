-- ================================================
-- API KEYS MANAGEMENT
-- Secure storage for user-configured API keys
-- ================================================

-- Store API keys securely (in production, use pgcrypto for encryption)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL UNIQUE,  -- 'perplexity', 'twitter', 'elevenlabs', 'openai', 'anthropic'
  api_key TEXT NOT NULL,         -- In production, this should be encrypted
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  verification_status TEXT DEFAULT 'pending',  -- 'pending', 'valid', 'invalid'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick service lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS api_keys_updated_at ON api_keys;
CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- Add comment for documentation
COMMENT ON TABLE api_keys IS 'Stores API keys for external services. Keys can be entered via UI or set via environment variables.';
COMMENT ON COLUMN api_keys.service IS 'Service identifier: perplexity, twitter, elevenlabs, openai, anthropic';
COMMENT ON COLUMN api_keys.verification_status IS 'pending = not yet verified, valid = key works, invalid = key rejected by service';
