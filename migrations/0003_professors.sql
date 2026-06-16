-- ============================================================
-- GETSCO — Professor Finder & University Intelligence
-- ============================================================

CREATE TABLE IF NOT EXISTS professors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  university TEXT NOT NULL,
  department TEXT,
  country TEXT,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  linkedin_url TEXT,
  profile_url TEXT,
  research_interests TEXT,
  lab_name TEXT,
  accepting_students TEXT DEFAULT 'unknown',
  relevance_score INTEGER DEFAULT 0,
  raw_bio TEXT,
  source_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_professors_university ON professors(university);
CREATE INDEX IF NOT EXISTS idx_professors_country ON professors(country);
CREATE INDEX IF NOT EXISTS idx_professors_relevance ON professors(relevance_score);

-- Scholarship source trust tracking
-- Note: SQLite does not support IF NOT EXISTS on ALTER TABLE
-- These will be skipped if columns already exist
ALTER TABLE scholarships ADD COLUMN source_trust_level TEXT DEFAULT 'unknown';
ALTER TABLE scholarships ADD COLUMN source_domain TEXT;
