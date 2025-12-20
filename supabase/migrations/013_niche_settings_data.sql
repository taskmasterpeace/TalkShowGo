-- Migration: Niche Settings Data
-- Configures niche settings for Battle Rap and creates Hood History Club topic

-- Update Battle Rap topic with full niche_settings
UPDATE topics
SET niche_settings = '{
  "name": "Battle Rap",
  "slug": "battle-rap",

  "entity_types": ["battler", "blogger", "league", "media", "host", "commentator", "producer"],

  "research_settings": {
    "interview_search_suffix": "interview",
    "max_interview_lookups": 3,
    "prefer_longest_interviews": true,
    "min_interview_duration_minutes": 5,
    "max_interview_duration_minutes": 60,
    "default_lookback_hours": 24,
    "deep_research_max_rounds": 3,
    "interview_lookup_enabled": true,
    "twitter_enabled": false
  },

  "story_settings": {
    "opening_template": "In the world of battle rap...",
    "default_length": "medium",
    "chapter_structure": ["Hook", "Background", "The Event", "Aftermath", "Conclusion"],
    "long_chapter_structure": ["Hook", "Background", "Build-up", "The Event", "Aftermath", "Reactions", "Conclusion"]
  },

  "audio_settings": {
    "voice_id": "ZJ7BlVZrxZKBDMTIK5c9",
    "model_id": "eleven_turbo_v2_5",
    "style": 0.15
  }
}'::jsonb
WHERE name ILIKE '%battle%rap%';

-- Create Hood History Club topic if it doesn't exist
INSERT INTO topics (name, description, niche_settings)
SELECT
  'Hood History Club',
  'Urban culture stories - animated storytelling (7-18 min)',
  '{
    "name": "Hood History Club",
    "slug": "hood-history-club",

    "entity_types": ["person", "gang", "neighborhood", "event", "victim", "perpetrator"],

    "research_settings": {
      "interview_search_suffix": "documentary OR interview OR story",
      "max_interview_lookups": 5,
      "prefer_longest_interviews": true,
      "min_interview_duration_minutes": 10,
      "max_interview_duration_minutes": 120,
      "default_lookback_hours": 0,
      "deep_research_max_rounds": 4,
      "interview_lookup_enabled": true,
      "twitter_enabled": false
    },

    "story_settings": {
      "opening_template": "This is a story from the streets...",
      "default_length": "long",
      "chapter_structure": ["Hook", "The Scene", "The Players", "What Happened", "The Fallout", "Legacy"],
      "long_chapter_structure": ["Hook", "The Scene", "The Players", "Build-up", "What Happened", "The Fallout", "Community Impact", "Legacy"]
    },

    "audio_settings": {
      "voice_id": "ZJ7BlVZrxZKBDMTIK5c9",
      "model_id": "eleven_turbo_v2_5",
      "style": 0.2
    }
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM topics WHERE name = 'Hood History Club'
);

-- Comments
COMMENT ON COLUMN topics.niche_settings IS 'Niche-specific settings including entity_types, research_settings, story_settings, audio_settings';
