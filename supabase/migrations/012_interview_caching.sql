-- Migration: Interview Caching Support
-- Adds columns for caching interview videos during research

-- Add is_interview flag to youtube_videos
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS is_interview BOOLEAN DEFAULT FALSE;

-- Add channel_title for videos fetched during interview lookup (no channel_id link)
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS channel_title VARCHAR(255);

-- Create index for interview lookups
CREATE INDEX IF NOT EXISTS idx_youtube_videos_interview
ON youtube_videos(is_interview, topic_id) WHERE is_interview = true;

-- Create index for title search during cache lookup
CREATE INDEX IF NOT EXISTS idx_youtube_videos_title_lower
ON youtube_videos(LOWER(title) text_pattern_ops);

-- Comments
COMMENT ON COLUMN youtube_videos.is_interview IS 'Whether this video is an interview (used for entity enrichment caching)';
COMMENT ON COLUMN youtube_videos.channel_title IS 'Channel name for videos without channel_id linkage';
