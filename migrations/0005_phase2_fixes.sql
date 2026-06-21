-- ============================================================
-- Migration 0005: Phase 2 data repairs
-- - Recompute source_domain (0004 step 8 produced garbage)
-- - Backfill success_probability / recommendation_reason / deadline_type
--   for rows that predate the new insert logic
-- - Fix stale seeded email so it matches the app
-- ============================================================

-- 1) Recompute source_domain cleanly: take the host portion of the URL
--    (everything between "://" and the next "/").
UPDATE scholarships
SET source_domain = substr(
  substr(url, instr(url, '://') + 3),
  1,
  instr(substr(url, instr(url, '://') + 3) || '/', '/') - 1
)
WHERE url IS NOT NULL AND url LIKE '%://%';

-- 2) Backfill success_probability where it was never set (0 or NULL).
UPDATE scholarships
SET success_probability = CASE
  WHEN match_score >= 85 AND is_fully_funded = 1 AND source_trust_level = 'official' THEN 75
  WHEN match_score >= 75 AND is_fully_funded = 1 THEN 65
  WHEN match_score >= 65 AND is_fully_funded = 1 THEN 55
  WHEN match_score >= 65 THEN 45
  WHEN match_score >= 50 THEN 35
  ELSE 25
END
WHERE success_probability IS NULL OR success_probability = 0;

-- 3) Backfill recommendation_reason where missing.
UPDATE scholarships
SET recommendation_reason = CASE
  WHEN lower(country) LIKE '%germany%' AND match_score >= 70 THEN 'Strong biotech research infrastructure; DAAD has dedicated quotas for Pakistani researchers with publications.'
  WHEN lower(country) LIKE '%japan%' AND match_score >= 70 THEN 'MEXT heavily weights research output — 3 undergraduate publications is exceptional by Japanese standards.'
  WHEN lower(country) LIKE '%korea%' AND match_score >= 70 THEN 'GKS strongly considers need-based candidates and actively recruits biotech talent from Pakistan.'
  WHEN lower(country) LIKE '%china%' AND match_score >= 70 THEN 'CSC scholarships have a high acceptance rate for Pakistani applicants with a research background.'
  WHEN match_score >= 70 THEN 'Strong overall fit for your profile — research output and field alignment are well above the typical applicant.'
  WHEN match_score >= 50 THEN 'Reasonable match — review the eligibility criteria carefully before applying.'
  ELSE 'Possible match. Confirm eligibility and funding scope on the official page before investing time.'
END
WHERE recommendation_reason IS NULL OR recommendation_reason = '';

-- 4) Backfill deadline_type buckets for visual badges where unknown.
UPDATE scholarships
SET deadline_type = CASE
  WHEN deadline LIKE 'Annual%' OR deadline LIKE 'Check%' THEN 'check'
  WHEN deadline LIKE '%2027%' THEN 'future'
  WHEN deadline LIKE '%2026%' THEN 'active'
  ELSE 'active'
END
WHERE deadline_type IS NULL OR deadline_type = 'unknown';

-- 5) Fix the stale seeded email so the Data-Preview profile matches the app.
UPDATE user_profile
SET email = 'ashmamali2002@gmail.com'
WHERE id = 1 AND email = 'ashmam@scholarshipagent.com';
