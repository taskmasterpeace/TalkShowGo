-- ============================================
-- VOICE SAMPLES SCHEMA
-- ============================================
-- Store custom voice samples for hosts

-- Voice samples table
CREATE TABLE IF NOT EXISTS voice_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Voice identity
  name VARCHAR(100) NOT NULL,
  description TEXT,
  language VARCHAR(10) DEFAULT 'en',

  -- Storage
  sample_url TEXT,           -- URL to audio file if stored externally
  sample_data BYTEA,         -- Or store directly in DB (for small samples)
  file_format VARCHAR(20),   -- wav, mp3, webm, etc.
  duration_seconds FLOAT,
  file_size_bytes INTEGER,

  -- Chatterbox integration
  chatterbox_voice_id VARCHAR(100),  -- ID from Chatterbox server
  is_synced BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT unique_voice_name UNIQUE(name)
);

-- Host voice assignments (many-to-one: each host can have one voice)
-- This allows the same voice to be used by multiple hosts
CREATE TABLE IF NOT EXISTS host_voice_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  voice_sample_id UUID REFERENCES voice_samples(id) ON DELETE SET NULL,

  -- Voice settings for this host
  speed FLOAT DEFAULT 1.0 CHECK (speed >= 0.5 AND speed <= 2.0),
  pitch FLOAT DEFAULT 1.0 CHECK (pitch >= 0.5 AND pitch <= 2.0),

  -- Style tags for this host's use of the voice
  style_tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_host_voice UNIQUE(host_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_samples_active ON voice_samples(is_active);
CREATE INDEX IF NOT EXISTS idx_voice_samples_language ON voice_samples(language);
CREATE INDEX IF NOT EXISTS idx_host_voice_config_host ON host_voice_config(host_id);
CREATE INDEX IF NOT EXISTS idx_host_voice_config_voice ON host_voice_config(voice_sample_id);

-- Trigger for updated_at
CREATE TRIGGER voice_samples_updated_at
  BEFORE UPDATE ON voice_samples
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER host_voice_config_updated_at
  BEFORE UPDATE ON host_voice_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VOICE GENERATION LOG (for tracking TTS usage)
-- ============================================

CREATE TABLE IF NOT EXISTS voice_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  host_id UUID REFERENCES hosts(id) ON DELETE SET NULL,
  voice_sample_id UUID REFERENCES voice_samples(id) ON DELETE SET NULL,

  -- What was generated
  input_text TEXT NOT NULL,
  input_text_length INTEGER,

  -- Output
  output_url TEXT,
  output_duration_seconds FLOAT,

  -- Provider info
  provider VARCHAR(50) DEFAULT 'chatterbox',
  provider_voice_id VARCHAR(100),

  -- Performance
  generation_time_ms INTEGER,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_gen_log_host ON voice_generation_log(host_id);
CREATE INDEX IF NOT EXISTS idx_voice_gen_log_created ON voice_generation_log(created_at DESC);
