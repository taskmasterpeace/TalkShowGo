-- YouTube Comments Table
-- Stores comments from YouTube videos for engagement analysis

CREATE TABLE IF NOT EXISTS youtube_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
  comment_id VARCHAR(100) UNIQUE NOT NULL,
  author_name VARCHAR(255),
  author_channel_id VARCHAR(100),
  text TEXT,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE,
  is_reply BOOLEAN DEFAULT FALSE,
  parent_comment_id VARCHAR(100),
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_youtube_comments_video_id ON youtube_comments(video_id);
CREATE INDEX idx_youtube_comments_like_count ON youtube_comments(like_count DESC);
CREATE INDEX idx_youtube_comments_author_channel ON youtube_comments(author_channel_id);
CREATE INDEX idx_youtube_comments_parent ON youtube_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;

-- Grant permissions
GRANT ALL ON youtube_comments TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON youtube_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON youtube_comments TO authenticated;

-- Add comments_fetched flag to youtube_videos
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS comments_fetched BOOLEAN DEFAULT FALSE;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS comments_fetched_at TIMESTAMP WITH TIME ZONE;

COMMENT ON TABLE youtube_comments IS 'YouTube video comments with engagement metrics for consensus analysis';
COMMENT ON COLUMN youtube_comments.like_count IS 'Number of likes - higher likes indicate stronger community opinion';
COMMENT ON COLUMN youtube_comments.is_reply IS 'True if this is a reply to another comment';
