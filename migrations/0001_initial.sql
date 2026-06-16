-- ============================================
-- AI Scholarship Agent - Complete Database Schema
-- ============================================

-- User Profile Table
CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  age INTEGER,
  nationality TEXT,
  country_of_residence TEXT,
  phone TEXT,
  current_qualification TEXT,
  university TEXT,
  cgpa REAL,
  field_of_study TEXT,
  graduation_year INTEGER,
  financial_status TEXT,
  family_background TEXT,
  career_goal TEXT,
  languages TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Academic Records
CREATE TABLE IF NOT EXISTS academic_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  level TEXT NOT NULL,
  institution TEXT NOT NULL,
  field TEXT,
  marks_obtained TEXT,
  total_marks TEXT,
  year INTEGER,
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- Research Publications
CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  journal TEXT,
  url TEXT,
  year INTEGER,
  description TEXT,
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- Achievements & Extracurriculars
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  year INTEGER,
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- Target Countries
CREATE TABLE IF NOT EXISTS target_countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  country TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- Preferred Fields of Study
CREATE TABLE IF NOT EXISTS preferred_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- Scholarships Found
CREATE TABLE IF NOT EXISTS scholarships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  organization TEXT,
  country TEXT,
  field TEXT,
  level TEXT,
  amount TEXT,
  deadline TEXT,
  description TEXT,
  requirements TEXT,
  url TEXT UNIQUE,
  covers TEXT,
  match_score REAL DEFAULT 0,
  is_fully_funded INTEGER DEFAULT 0,
  status TEXT DEFAULT 'found',
  source TEXT,
  raw_content TEXT,
  is_expired INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Applications Table
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  scholarship_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  applied_at DATETIME,
  deadline TEXT,
  notes TEXT,
  documents_generated TEXT,
  email_sent INTEGER DEFAULT 0,
  email_sent_at DATETIME,
  response_received INTEGER DEFAULT 0,
  response_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profile(id),
  FOREIGN KEY (scholarship_id) REFERENCES scholarships(id)
);

-- Generated Documents
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  application_id INTEGER,
  scholarship_id INTEGER,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profile(id),
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

-- AI Memory / Learnings
CREATE TABLE IF NOT EXISTS ai_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Search History
CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scholarships_country ON scholarships(country);
CREATE INDEX IF NOT EXISTS idx_scholarships_match_score ON scholarships(match_score);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON scholarships(deadline);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
