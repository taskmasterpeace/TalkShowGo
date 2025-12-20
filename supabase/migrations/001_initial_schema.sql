-- Talk Show Go Database Schema
-- Version: 1.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- PHASE 1: OUTPOST - Topics & Sources
-- ============================================

-- Topics table
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source accounts (Twitter, YouTube, RSS)
CREATE TABLE source_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('twitter', 'youtube', 'rss')),
    handle VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    notes TEXT,
    profile_image_url TEXT,
    follower_count INTEGER DEFAULT 0,
    credibility_score FLOAT DEFAULT 0.5,
    status VARCHAR(50) DEFAULT 'seed' CHECK (status IN ('seed', 'nominated', 'verified', 'banned')),
    last_checked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(topic_id, platform, handle)
);

-- Credibility profiles (per-topic thresholds)
CREATE TABLE credibility_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE UNIQUE,
    youtube_min_subscribers INTEGER DEFAULT 10000,
    youtube_min_views INTEGER DEFAULT 1000,
    youtube_verified_bonus FLOAT DEFAULT 0.2,
    twitter_min_followers INTEGER DEFAULT 1000,
    twitter_verified_bonus FLOAT DEFAULT 0.1,
    engagement_weight FLOAT DEFAULT 0.5,
    recency_weight FLOAT DEFAULT 0.3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PHASE 2: PERIMETER - Twitter Data
-- ============================================

-- Raw tweets
CREATE TABLE tweets_raw (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(100) NOT NULL UNIQUE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    source_account_id UUID REFERENCES source_accounts(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    author_handle VARCHAR(255) NOT NULL,
    author_name VARCHAR(255),
    author_profile_image TEXT,
    tweet_type VARCHAR(50) DEFAULT 'original' CHECK (tweet_type IN ('original', 'reply', 'quote', 'retweet')),
    reply_to_tweet_id VARCHAR(100),
    quote_of_tweet_id VARCHAR(100),
    metrics_likes INTEGER DEFAULT 0,
    metrics_retweets INTEGER DEFAULT 0,
    metrics_replies INTEGER DEFAULT 0,
    metrics_views INTEGER DEFAULT 0,
    media_urls JSONB DEFAULT '[]'::jsonb,
    links JSONB DEFAULT '[]'::jsonb,
    tweet_created_at TIMESTAMP WITH TIME ZONE,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    raw_payload JSONB
);

CREATE INDEX idx_tweets_topic ON tweets_raw(topic_id);
CREATE INDEX idx_tweets_author ON tweets_raw(author_handle);
CREATE INDEX idx_tweets_created ON tweets_raw(tweet_created_at DESC);

-- Tweet threads
CREATE TABLE tweet_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    root_tweet_id UUID REFERENCES tweets_raw(id) ON DELETE CASCADE,
    tweet_id UUID REFERENCES tweets_raw(id) ON DELETE CASCADE,
    thread_position INTEGER DEFAULT 0,
    relationship VARCHAR(50) CHECK (relationship IN ('reply', 'quote', 'retweet')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PHASE 3: EXTRACTION - Entities & Claims
-- ============================================

-- Entities (people, places, things)
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    canonical_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) CHECK (entity_type IN ('person', 'organization', 'place', 'event', 'product', 'other')),
    description TEXT,
    notes TEXT,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mention_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_entities_topic ON entities(topic_id);
CREATE INDEX idx_entities_name ON entities(canonical_name);

-- Entity aliases
CREATE TABLE entity_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    source VARCHAR(50) DEFAULT 'extracted' CHECK (source IN ('extracted', 'manual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_aliases_entity ON entity_aliases(entity_id);
CREATE INDEX idx_aliases_alias ON entity_aliases(alias);

-- Entity mentions (links entities to tweets)
CREATE TABLE entity_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    tweet_id UUID REFERENCES tweets_raw(id) ON DELETE CASCADE,
    mention_type VARCHAR(50) CHECK (mention_type IN ('subject', 'object', 'reference')),
    sentiment VARCHAR(50) CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    context_snippet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX idx_mentions_tweet ON entity_mentions(tweet_id);

-- Claims
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,
    claim_type VARCHAR(50) CHECK (claim_type IN ('factual', 'opinion', 'prediction', 'rumor')),
    cluster_id UUID,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mention_count INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'emerging' CHECK (status IN ('emerging', 'active', 'stale')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_claims_topic ON claims(topic_id);
CREATE INDEX idx_claims_cluster ON claims(cluster_id);

-- Claim mentions (links claims to tweets)
CREATE TABLE claim_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    tweet_id UUID REFERENCES tweets_raw(id) ON DELETE CASCADE,
    stance VARCHAR(50) CHECK (stance IN ('supports', 'denies', 'neutral', 'questions')),
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_claim_mentions_claim ON claim_mentions(claim_id);
CREATE INDEX idx_claim_mentions_tweet ON claim_mentions(tweet_id);

-- ============================================
-- PHASE 4 & 5: RELAY & RECON - YouTube
-- ============================================

-- YouTube channels
CREATE TABLE youtube_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    channel_id VARCHAR(100) NOT NULL,
    channel_name VARCHAR(255),
    handle VARCHAR(255),
    subscriber_count INTEGER DEFAULT 0,
    description TEXT,
    notes TEXT,
    credibility_score FLOAT DEFAULT 0.5,
    status VARCHAR(50) DEFAULT 'trusted' CHECK (status IN ('trusted', 'monitoring', 'banned')),
    last_checked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(topic_id, channel_id)
);

-- YouTube videos
CREATE TABLE youtube_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES youtube_channels(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    video_id VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(500),
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    published_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    transcript TEXT,
    thumbnail_url TEXT,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_videos_channel ON youtube_videos(channel_id);
CREATE INDEX idx_videos_topic ON youtube_videos(topic_id);
CREATE INDEX idx_videos_published ON youtube_videos(published_at DESC);

-- Video-Entity links
CREATE TABLE video_entity_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES youtube_videos(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    relevance_score FLOAT DEFAULT 0.5,
    context_snippet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PHASE 6: AUDIT - Credibility & Consensus
-- ============================================

-- Consensus scores for claims
CREATE TABLE consensus_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE UNIQUE,
    consensus FLOAT DEFAULT 0 CHECK (consensus >= -1 AND consensus <= 1),
    contention FLOAT DEFAULT 0 CHECK (contention >= 0 AND contention <= 1),
    confidence FLOAT DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
    source_count INTEGER DEFAULT 0,
    engagement_total INTEGER DEFAULT 0,
    evidence_summary TEXT,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Claim verdicts
CREATE TABLE claim_verdicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE UNIQUE,
    verdict VARCHAR(50) CHECK (verdict IN ('confirmed', 'likely', 'uncertain', 'disputed', 'debunked')),
    reasoning TEXT,
    evidence_for JSONB DEFAULT '[]'::jsonb,
    evidence_against JSONB DEFAULT '[]'::jsonb,
    requires_editorial BOOLEAN DEFAULT FALSE,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source credibility log
CREATE TABLE source_credibility_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_account_id UUID REFERENCES source_accounts(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    claims_made INTEGER DEFAULT 0,
    claims_verified INTEGER DEFAULT 0,
    claims_disputed INTEGER DEFAULT 0,
    engagement_generated INTEGER DEFAULT 0,
    credibility_delta FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PHASE 7: TRIBUNAL - Nominations
-- ============================================

CREATE TABLE nominations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('twitter', 'youtube', 'website')),
    identifier VARCHAR(500) NOT NULL,
    discovered_via TEXT,
    discovery_context TEXT,
    preliminary_score FLOAT DEFAULT 0.5,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deferred')),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_nominations_topic ON nominations(topic_id);
CREATE INDEX idx_nominations_status ON nominations(status);

-- ============================================
-- PHASE 8: INTEL - Web Sources
-- ============================================

CREATE TABLE web_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    domain VARCHAR(255),
    title VARCHAR(500),
    content_extract TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    linked_claim_ids UUID[] DEFAULT '{}'::uuid[]
);

CREATE TABLE rss_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    feed_url TEXT NOT NULL,
    name VARCHAR(255),
    last_fetched TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(topic_id, feed_url)
);

-- ============================================
-- PHASE 10 & 11: NEXUS & SANCTION - Stories
-- ============================================

-- Story candidates
CREATE TABLE story_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    bucket VARCHAR(50) CHECK (bucket IN ('breaking', 'developing', 'background', 'recurring', 'feature')),
    headline VARCHAR(500),
    summary TEXT,
    primary_entities UUID[] DEFAULT '{}'::uuid[],
    primary_claims UUID[] DEFAULT '{}'::uuid[],
    evidence_package JSONB DEFAULT '{}'::jsonb,
    confidence_score FLOAT DEFAULT 0.5,
    engagement_total INTEGER DEFAULT 0,
    priority_rank INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'candidate' CHECK (status IN ('candidate', 'reviewing', 'greenlit', 'killed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_story_candidates_topic ON story_candidates(topic_id);
CREATE INDEX idx_story_candidates_bucket ON story_candidates(bucket);
CREATE INDEX idx_story_candidates_status ON story_candidates(status);

-- Story drafts
CREATE TABLE story_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_candidate_id UUID REFERENCES story_candidates(id) ON DELETE CASCADE,
    angle VARCHAR(100),
    tone VARCHAR(100),
    length VARCHAR(50) CHECK (length IN ('short', 'medium', 'long')),
    format TEXT,
    draft_content TEXT,
    revision_number INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Greenlit stories
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_candidate_id UUID REFERENCES story_candidates(id) ON DELETE CASCADE,
    final_headline VARCHAR(500),
    final_content TEXT,
    greenlit_by VARCHAR(255),
    greenlit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    integrity_checklist JSONB DEFAULT '{}'::jsonb,
    production_status VARCHAR(50) DEFAULT 'pending' CHECK (production_status IN ('pending', 'in_production', 'published')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PHASE 12: SIGNAL - Exports
-- ============================================

CREATE TABLE export_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    package_json JSONB NOT NULL,
    destination VARCHAR(50) CHECK (destination IN ('directors_palette', '11labs', 'both')),
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'failed')),
    response JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SYSTEM TABLES
-- ============================================

-- Notes (user annotations)
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('entity', 'source', 'claim', 'story')),
    target_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notes_target ON notes(target_type, target_id);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(255) DEFAULT 'system',
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Job runs
CREATE TABLE job_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(100) NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    items_processed INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_runs_type ON job_runs(job_type);
CREATE INDEX idx_job_runs_status ON job_runs(status);

-- LLM Prompt templates
CREATE TABLE prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    template TEXT NOT NULL,
    model VARCHAR(100) DEFAULT 'gpt-4o',
    version INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limits tracking
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255),
    requests_remaining INTEGER,
    reset_at TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, endpoint)
);

-- ============================================
-- TALK SHOW EXPRESSIONS TABLES
-- ============================================

-- Personality prints
CREATE TABLE personality_prints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    voice_profile_id VARCHAR(100),
    communication_style JSONB DEFAULT '{}'::jsonb,
    interests TEXT[] DEFAULT '{}'::text[],
    hot_takes JSONB DEFAULT '{}'::jsonb,
    interview_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Show formats
CREATE TABLE show_formats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    participant_count INTEGER DEFAULT 2,
    structure JSONB DEFAULT '{}'::jsonb,
    question_templates JSONB DEFAULT '[]'::jsonb,
    duration_target_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interview sessions
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personality_print_id UUID REFERENCES personality_prints(id) ON DELETE CASCADE,
    show_id UUID,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    interviewer_voice_id VARCHAR(100),
    questions_asked JSONB DEFAULT '[]'::jsonb,
    responses JSONB DEFAULT '[]'::jsonb,
    audio_recording_url TEXT,
    transcript TEXT,
    extracted_opinions JSONB DEFAULT '{}'::jsonb,
    call_duration_seconds INTEGER,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shows
CREATE TABLE shows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    format_id UUID REFERENCES show_formats(id) ON DELETE SET NULL,
    title VARCHAR(500),
    participants UUID[] DEFAULT '{}'::uuid[],
    source_stories UUID[] DEFAULT '{}'::uuid[],
    script TEXT,
    audio_url TEXT,
    video_url TEXT,
    status VARCHAR(50) DEFAULT 'drafting' CHECK (status IN ('drafting', 'recording', 'editing', 'published')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_topics_timestamp BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_source_accounts_timestamp BEFORE UPDATE ON source_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_entities_timestamp BEFORE UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_claims_timestamp BEFORE UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_story_candidates_timestamp BEFORE UPDATE ON story_candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_notes_timestamp BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_personality_prints_timestamp BEFORE UPDATE ON personality_prints FOR EACH ROW EXECUTE FUNCTION update_updated_at();
