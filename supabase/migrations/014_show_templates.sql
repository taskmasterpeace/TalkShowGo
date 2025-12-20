-- Migration: Show Templates and Daily Show Runs
-- Enables the Battle Rap Daily show system with editable templates

-- ============================================
-- Show Templates Table
-- ============================================

CREATE TABLE IF NOT EXISTS show_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Template type: 'daily' for news shows, 'narrative' for stories
  template_type VARCHAR(50) NOT NULL DEFAULT 'daily',

  -- Editable prompt templates with placeholders
  intro_template TEXT NOT NULL,
  story_template TEXT NOT NULL,
  outro_template TEXT NOT NULL,
  twitter_digest_template TEXT,

  -- Default settings
  default_story_count INTEGER DEFAULT 3,
  default_hours_back INTEGER DEFAULT 24,
  max_duration_minutes INTEGER DEFAULT 15,
  style_tone VARCHAR(50) DEFAULT 'engaging',
  include_twitter_digest BOOLEAN DEFAULT true,
  include_cta BOOLEAN DEFAULT true,

  -- Host preference (optional - can be overridden per show)
  preferred_host_slug VARCHAR(50),

  -- Topic association
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_show_templates_topic ON show_templates(topic_id);
CREATE INDEX idx_show_templates_type ON show_templates(template_type);
CREATE INDEX idx_show_templates_active ON show_templates(is_active);

-- ============================================
-- Daily Show Runs Table
-- Tracks each generated show
-- ============================================

CREATE TABLE IF NOT EXISTS daily_show_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  template_id UUID REFERENCES show_templates(id) ON DELETE SET NULL,
  host_slug VARCHAR(50),

  -- Show metadata
  show_date DATE NOT NULL,
  show_name VARCHAR(200),

  -- Workflow data (stored for debugging/replay)
  topics_proposed JSONB DEFAULT '[]'::jsonb,
  topics_selected JSONB DEFAULT '[]'::jsonb,
  twitter_digest JSONB,

  -- Generated content
  intro_script TEXT,
  story_segments JSONB DEFAULT '[]'::jsonb,
  outro_script TEXT,
  full_script TEXT,

  -- Audio output
  audio_url TEXT,
  audio_path TEXT,
  audio_duration_seconds INTEGER,

  -- Status: draft, generating, ready, published
  status VARCHAR(50) DEFAULT 'draft',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  generated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_daily_show_runs_topic ON daily_show_runs(topic_id);
CREATE INDEX idx_daily_show_runs_date ON daily_show_runs(show_date);
CREATE INDEX idx_daily_show_runs_status ON daily_show_runs(status);

-- ============================================
-- Pronunciation Dictionary Updates
-- Add battle rap specific pronunciations
-- ============================================

-- Insert or update pronunciations for battle rap terms
INSERT INTO pronunciation_dictionary (topic_id, word, phoneme, notes, created_by)
SELECT
  t.id,
  entries.word,
  entries.phoneme,
  entries.notes,
  'system'
FROM topics t
CROSS JOIN (VALUES
  ('AVE', 'Av', 'Battle rapper Aye Verb nickname - pronounced like "have" without the h'),
  ('NOME', 'Gnome', 'Night of Main Events - URL event'),
  ('NWX', 'N-W-X', 'Nu World Xtreme - spell out letters'),
  ('SM', 'S-M', 'Summer Madness - spell out letters'),
  ('EAZY', 'Easy', 'Eazy The Block Captain'),
  ('GEECHI', 'Geechy', 'Geechi Gotti'),
  ('TWORK', 'T-Work', 'Tsu Surf opponent'),
  ('TSU', 'Sue', 'Tsu Surf - pronounced like "sue"'),
  ('JJDD', 'J-J-D-D', 'John John Da Don - spell out'),
  ('JAKKBOY', 'Jack-boy', 'Jakkboy Maine'),
  ('DIZASTER', 'Diz-aster', 'Battle rapper Dizaster'),
  ('CHARRON', 'Sharon', 'Battle rapper Charron - like the name Sharon'),
  ('RONE', 'Roan', 'Battle rapper Rone - rhymes with phone'),
  ('BIGG K', 'Big K', 'Battle rapper Bigg K - just "Big K"'),
  ('CHILLA', 'Chilla', 'Chilla Jones'),
  ('CONCEITED', 'Con-seated', 'Battle rapper Conceited'),
  ('HITMAN', 'Hit-man', 'Hitman Holla'),
  ('VERB', 'Verb', 'Aye Verb'),
  ('DAYLYT', 'Day-lit', 'Battle rapper Daylyt'),
  ('HOLLOW', 'Hollow', 'Hollow Da Don'),
  ('RUM', 'Rum', 'Rum Nitty'),
  ('NITTY', 'Nitty', 'Rum Nitty'),
  ('CORTEZ', 'Cor-tez', 'Battle rapper Cortez'),
  ('REED', 'Reed', 'Reed Dollaz'),
  ('DOLLAZ', 'Dollars', 'Reed Dollaz'),
  ('PAT', 'Pat', 'Pat Stay - RIP'),
  ('SURF', 'Surf', 'Tsu Surf'),
  ('LUX', 'Lux', 'Loaded Lux'),
  ('LOADED', 'Loaded', 'Loaded Lux'),
  ('MOOK', 'Mook', 'Murda Mook'),
  ('MURDA', 'Murder', 'Murda Mook')
) AS entries(word, phoneme, notes)
WHERE t.slug = 'battle-rap' OR t.name ILIKE '%battle%rap%'
ON CONFLICT (topic_id, word) DO UPDATE SET
  phoneme = EXCLUDED.phoneme,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- ============================================
-- Seed Default Templates
-- ============================================

-- Battle Rap Daily template (news format)
INSERT INTO show_templates (
  name, slug, description, template_type,
  intro_template, story_template, outro_template, twitter_digest_template,
  default_story_count, default_hours_back, style_tone, include_twitter_digest
)
SELECT
  'Battle Rap Daily',
  'battle-rap-daily',
  'Daily news briefing covering the last 24 hours in battle rap',
  'daily',
  E'What''s good everybody, welcome back to {show_name}! It''s {date}, and I''m your host.\nWe got {topic_count} stories to get through today.\n{twitter_trending}\nLet''s get right into it.',
  E'{transition}\n\n{headline}\n\n{story_body}\n\n{twitter_reaction}',
  E'That''s all for today''s {show_name}. Make sure you''re following for daily updates on everything battle rap.\n\n{host_closing}\n\nPeace.',
  E'Before we get into the stories, let''s see what''s popping on Twitter.\n{trending_summary}\n{top_tweets}',
  3, -- default_story_count
  24, -- default_hours_back
  'engaging',
  true
WHERE NOT EXISTS (SELECT 1 FROM show_templates WHERE slug = 'battle-rap-daily');

-- Battle Rap Story template (narrative/documentary format)
INSERT INTO show_templates (
  name, slug, description, template_type,
  intro_template, story_template, outro_template, twitter_digest_template,
  default_story_count, default_hours_back, style_tone, include_twitter_digest
)
SELECT
  'Battle Rap Story',
  'battle-rap-story',
  'Deep dive narrative documentary on a specific topic',
  'narrative',
  E'{host_opening}\n\n{dramatic_hook}',
  E'{chapter_title}\n\n{narrative_content}\n\n{quote}',
  E'{conclusion}\n\n{host_closing}',
  NULL, -- No Twitter digest for narrative stories
  1, -- Single story focus
  168, -- Look back 7 days
  'dramatic',
  false
WHERE NOT EXISTS (SELECT 1 FROM show_templates WHERE slug = 'battle-rap-story');

-- Breaking News template (urgent format)
INSERT INTO show_templates (
  name, slug, description, template_type,
  intro_template, story_template, outro_template, twitter_digest_template,
  default_story_count, default_hours_back, style_tone, include_twitter_digest
)
SELECT
  'Breaking News',
  'breaking-news',
  'Urgent breaking news format for major developments',
  'breaking',
  E'BREAKING NEWS from {show_name}!\n\n{headline}\n\nThis just in...',
  E'{story_body}\n\n{twitter_reaction}',
  E'We''ll have more on this story as it develops. Stay tuned to {show_name} for updates.\n\n{call_to_action}',
  E'The streets are reacting:\n{top_tweets}',
  1,
  6, -- Last 6 hours
  'urgent',
  true
WHERE NOT EXISTS (SELECT 1 FROM show_templates WHERE slug = 'breaking-news');

-- ============================================
-- Update trigger for timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_show_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_show_templates_timestamp ON show_templates;
CREATE TRIGGER update_show_templates_timestamp
  BEFORE UPDATE ON show_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_show_templates_timestamp();
