-- Migration: Audio Download and Transcription Tracking
-- Track audio downloads and transcription source for YouTube videos

-- Track audio downloads and transcription source
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_downloaded BOOLEAN DEFAULT false;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_path TEXT;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_downloaded_at TIMESTAMPTZ;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS transcript_source TEXT;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS transcript_confidence FLOAT;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS transcript_status TEXT DEFAULT 'pending';
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS speaker_segments JSONB;

-- Index for finding videos that need processing
CREATE INDEX IF NOT EXISTS idx_youtube_videos_transcript_status
ON youtube_videos(transcript_status) WHERE transcript_status = 'pending';

-- Index for finding videos with downloaded audio
CREATE INDEX IF NOT EXISTS idx_youtube_videos_audio_downloaded
ON youtube_videos(audio_downloaded) WHERE audio_downloaded = true;

-- Comment on columns
COMMENT ON COLUMN youtube_videos.audio_downloaded IS 'Whether audio has been downloaded for this video';
COMMENT ON COLUMN youtube_videos.audio_path IS 'Local path to downloaded audio file';
COMMENT ON COLUMN youtube_videos.audio_downloaded_at IS 'When audio was downloaded';
COMMENT ON COLUMN youtube_videos.transcript_source IS 'Source of transcript: youtube_captions or assemblyai';
COMMENT ON COLUMN youtube_videos.transcript_confidence IS 'Confidence score for transcription (0-1)';
COMMENT ON COLUMN youtube_videos.transcript_status IS 'Status: pending, has_youtube_captions, has_assemblyai, download_failed, transcription_failed, skipped_too_long, skipped_too_short';
COMMENT ON COLUMN youtube_videos.speaker_segments IS 'Speaker diarization data from AssemblyAI';
