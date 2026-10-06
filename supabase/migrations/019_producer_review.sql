-- Add review status to story_candidates
ALTER TABLE story_candidates
ADD COLUMN IF NOT EXISTS script_review_status VARCHAR(20) DEFAULT 'pending_review';

ALTER TABLE story_candidates
ADD COLUMN IF NOT EXISTS script_reviewed_by VARCHAR(255);

ALTER TABLE story_candidates
ADD COLUMN IF NOT EXISTS script_reviewed_at TIMESTAMP;

ALTER TABLE story_candidates
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Create enum constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_review_status'
    ) THEN
        ALTER TABLE story_candidates
        ADD CONSTRAINT check_review_status
        CHECK (script_review_status IN ('pending_review', 'approved', 'rejected', 'revision_requested'));
    END IF;
END $$;
