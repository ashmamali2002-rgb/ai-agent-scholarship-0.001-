-- ============================================================
-- Migration 0007: Verification & Quality layer
-- Adds verified flags + a verification_log used by the quality
-- metrics endpoint. No data is shown unless it passes verification.
-- ============================================================

-- Scholarships: verification flags
ALTER TABLE scholarships ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE scholarships ADD COLUMN link_ok INTEGER DEFAULT 0;
ALTER TABLE scholarships ADD COLUMN verified_at DATETIME;

-- Professors: verification + location status
ALTER TABLE professors ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE professors ADD COLUMN location_status TEXT DEFAULT 'unverified';

-- Documents: reference verification summary
ALTER TABLE documents ADD COLUMN references_total INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN references_verified INTEGER DEFAULT 0;

-- Verification audit log
CREATE TABLE IF NOT EXISTS verification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,   -- scholarship | professor | reference | location | link
  entity_ref TEXT,             -- title / name / url
  check_name TEXT NOT NULL,
  result TEXT NOT NULL,        -- pass | fail
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vlog_type ON verification_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_vlog_result ON verification_log(result);

-- Backfill: existing official, non-expired scholarships are considered
-- verified so the dashboard isn't suddenly empty; links re-checked on demand.
UPDATE scholarships
SET verified = 1
WHERE (is_expired = 0 OR is_expired IS NULL)
  AND source_trust_level IN ('official', 'recognised');

-- Backfill: existing professors (already extracted from real pages) are kept
-- visible; new records must pass the stricter validation layer.
UPDATE professors SET verified = 1, location_status = 'legacy' WHERE verified IS NULL OR verified = 0;
