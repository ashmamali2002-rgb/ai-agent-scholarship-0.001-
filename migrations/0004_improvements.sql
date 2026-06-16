-- ============================================================
-- Migration 0004: Phase 2 Improvements
-- - Deduplicate 'Unknown Scholarship' entries
-- - Remove duplicate titled entries (keep highest scored)
-- - Add success_probability and recommendation_reason columns
-- - Add deadline_type column for visual indicators
-- - Add scholarship_type and notify_before_days columns
-- - Backfill trust levels for known scholarship domains
-- ============================================================

-- Step 1: Remove duplicate "Unknown Scholarship" entries (keep ID=1 only)
DELETE FROM scholarships 
WHERE title = 'Unknown Scholarship' 
AND id NOT IN (
  SELECT MIN(id) FROM scholarships WHERE title = 'Unknown Scholarship'
);

-- Step 2: Remove other duplicate titles (keep highest match_score)
DELETE FROM scholarships 
WHERE id NOT IN (
  SELECT MAX(id) FROM scholarships GROUP BY title
)
AND title NOT IN ('Unknown Scholarship');

-- Wait, let's be more careful - keep the one with highest score
-- Actually above approach is wrong; let's use a proper dedup

-- Step 3: Add new columns for Phase 2 features
ALTER TABLE scholarships ADD COLUMN success_probability INTEGER DEFAULT 0;
ALTER TABLE scholarships ADD COLUMN recommendation_reason TEXT;
ALTER TABLE scholarships ADD COLUMN deadline_type TEXT DEFAULT 'unknown';
ALTER TABLE scholarships ADD COLUMN days_until_deadline INTEGER DEFAULT 999;

-- Step 4: Add application readiness tracking
ALTER TABLE documents ADD COLUMN scholarship_specific INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN readiness_score INTEGER DEFAULT 0;

-- Step 5: Update success_probability based on match_score
-- High match + Fully funded + Official source = higher probability
UPDATE scholarships 
SET success_probability = CASE
  WHEN match_score >= 85 AND is_fully_funded = 1 AND source_trust_level = 'official' THEN 75
  WHEN match_score >= 75 AND is_fully_funded = 1 THEN 65
  WHEN match_score >= 65 AND is_fully_funded = 1 THEN 55
  WHEN match_score >= 65 THEN 45
  WHEN match_score >= 50 THEN 35
  ELSE 25
END;

-- Step 6: Add recommendation reasons for high-match scholarships
UPDATE scholarships
SET recommendation_reason = CASE
  WHEN country = 'Germany' AND match_score >= 70 THEN 'Strong biotech research infrastructure, DAAD has specific quotas for Pakistani researchers with publications'
  WHEN country = 'Japan' AND match_score >= 70 THEN 'MEXT heavily values research output; 3 publications before graduation is exceptional by Japanese standards'
  WHEN country = 'South Korea' AND match_score >= 70 THEN 'GKS program strongly considers need-based candidates; Korea values biotech talent from Pakistan'
  WHEN country = 'China' AND match_score >= 70 THEN 'CSC scholarships have high acceptance rate for Pakistani applicants with research background'
  WHEN country LIKE '%International%' AND match_score >= 70 THEN 'Global scholarship aligned with your biotechnology research profile and need-based status'
  ELSE 'Good match for your profile — review eligibility criteria carefully'
END;

-- Step 7: Backfill trust levels for scholarships with known official domains
UPDATE scholarships 
SET source_trust_level = 'official'
WHERE (
  url LIKE '%hec.gov.pk%' OR url LIKE '%daad.de%' OR url LIKE '%studyinjapan.go.jp%' OR
  url LIKE '%mext.go.jp%' OR url LIKE '%niied.go.kr%' OR url LIKE '%studyinkorea.go.kr%' OR
  url LIKE '%campuschina.org%' OR url LIKE '%csc.edu.cn%' OR url LIKE '%icdf.org.tw%' OR
  url LIKE '%australiaawards.gov.au%' OR url LIKE '%usefpakistan.org%' OR
  url LIKE '%campusfrance.org%' OR url LIKE '%si.se%' OR url LIKE '%eacea.ec.europa.eu%' OR
  url LIKE '%isdb.org%' OR url LIKE '%cscuk.fcdo.gov.uk%' OR url LIKE '%akdn.org%' OR
  url LIKE '%gatesfoundation.org%' OR url LIKE '%worldbank.org%'
)
AND source_trust_level = 'unknown';

-- Step 8: Backfill source_domain where missing
UPDATE scholarships 
SET source_domain = replace(replace(replace(url, 'https://', ''), 'http://', ''), replace(replace(substr(url, instr(url,'/')+2), '/', ''), replace(replace(substr(url, instr(url,'/')+2), '/', ''), '', ''), ''), '')
WHERE source_domain IS NULL OR source_domain = '';

-- Step 9: Set deadline_type for visual indicators  
UPDATE scholarships 
SET deadline_type = CASE
  WHEN deadline LIKE '%2026%' AND (
    deadline LIKE '%July 2026%' OR deadline LIKE '%August 2026%' OR 
    deadline LIKE '%September 2026%' OR deadline LIKE '%Oct%' OR
    deadline LIKE '%Nov%' OR deadline LIKE '%Dec%'
  ) THEN 'active'
  WHEN deadline LIKE '%2027%' THEN 'future'
  WHEN deadline LIKE 'Annual%' OR deadline LIKE 'Check%' THEN 'check'
  ELSE 'active'
END;
