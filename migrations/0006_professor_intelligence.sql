-- ============================================================
-- Migration 0006: Professor Intelligence upgrade
-- Adds research-compatibility breakdown + richer verified data
-- fields to the professors table. relevance_score is reused as
-- the 0-100 compatibility score.
-- ============================================================

ALTER TABLE professors ADD COLUMN field TEXT;
ALTER TABLE professors ADD COLUMN matched_topics TEXT;
ALTER TABLE professors ADD COLUMN matched_keywords TEXT;
ALTER TABLE professors ADD COLUMN recommendation_reason TEXT;
ALTER TABLE professors ADD COLUMN google_scholar_url TEXT;
ALTER TABLE professors ADD COLUMN recent_publications TEXT;
ALTER TABLE professors ADD COLUMN lab_website TEXT;
ALTER TABLE professors ADD COLUMN scholarship_id INTEGER;
ALTER TABLE professors ADD COLUMN recommendation_type TEXT DEFAULT 'university';
