import sqlite3
import os
from datetime import datetime

class ScholarshipDatabase:
    def __init__(self, db_path):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.init_db()
    
    def init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create scholarships table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scholarships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                university TEXT,
                country TEXT,
                field TEXT,
                deadline TEXT,
                funding_type TEXT,
                requirements TEXT,
                application_url TEXT,
                status TEXT DEFAULT 'found',
                match_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create applications table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scholarship_id INTEGER,
                application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending',
                documents_submitted TEXT,
                notes TEXT,
                FOREIGN KEY (scholarship_id) REFERENCES scholarships(id)
            )
        ''')
        
        # Create user_profile table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT,
                phone TEXT,
                nationality TEXT,
                age INTEGER,
                qualification TEXT,
                university TEXT,
                cgpa REAL,
                financial_status TEXT,
                research_papers INTEGER,
                preferred_fields TEXT,
                target_countries TEXT,
                career_goal TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create search_logs table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS search_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                search_query TEXT,
                results_count INTEGER,
                search_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                source TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def add_scholarship(self, title, university, country, field, deadline, 
                       funding_type, requirements, application_url, match_score):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO scholarships (title, university, country, field, deadline, 
                                     funding_type, requirements, application_url, match_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (title, university, country, field, deadline, funding_type, 
              requirements, application_url, match_score))
        
        scholarship_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return scholarship_id
    
    def get_matching_scholarships(self, limit=50):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM scholarships 
            WHERE status = 'found' 
            ORDER BY match_score DESC, deadline ASC
            LIMIT ?
        ''', (limit,))
        
        scholarships = cursor.fetchall()
        conn.close()
        return scholarships
    
    def update_scholarship_status(self, scholarship_id, status):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE scholarships SET status = ? WHERE id = ?
        ''', (status, scholarship_id))
        
        conn.commit()
        conn.close()
    
    def add_application(self, scholarship_id, documents_submitted='', notes=''):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO applications (scholarship_id, documents_submitted, notes)
            VALUES (?, ?, ?)
        ''', (scholarship_id, documents_submitted, notes))
        
        application_id = cursor.lastrowid
        
        # Update scholarship status
        self.update_scholarship_status(scholarship_id, 'applied')
        
        conn.commit()
        conn.close()
        return application_id
    
    def get_applications(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT a.*, s.title, s.university, s.country, s.status as scholarship_status
            FROM applications a
            JOIN scholarships s ON a.scholarship_id = s.id
            ORDER BY a.application_date DESC
        ''')
        
        applications = cursor.fetchall()
        conn.close()
        return applications
    
    def save_user_profile(self, profile_data):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check if profile exists
        cursor.execute('SELECT COUNT(*) FROM user_profile')
        count = cursor.fetchone()[0]
        
        if count == 0:
            cursor.execute('''
                INSERT INTO user_profile (name, email, phone, nationality, age, 
                                         qualification, university, cgpa, 
                                         financial_status, research_papers,
                                         preferred_fields, target_countries, career_goal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (profile_data.get('name'), profile_data.get('email'), 
                  profile_data.get('phone'), profile_data.get('nationality'),
                  profile_data.get('age'), profile_data.get('qualification'),
                  profile_data.get('university'), profile_data.get('cgpa'),
                  profile_data.get('financial_status'), profile_data.get('research_papers'),
                  profile_data.get('preferred_fields'), profile_data.get('target_countries'),
                  profile_data.get('career_goal')))
        else:
            cursor.execute('''
                UPDATE user_profile SET 
                    name=?, email=?, phone=?, nationality=?, age=?,
                    qualification=?, university=?, cgpa=?,
                    financial_status=?, research_papers=?,
                    preferred_fields=?, target_countries=?, career_goal=?,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=1
            ''', (profile_data.get('name'), profile_data.get('email'), 
                  profile_data.get('phone'), profile_data.get('nationality'),
                  profile_data.get('age'), profile_data.get('qualification'),
                  profile_data.get('university'), profile_data.get('cgpa'),
                  profile_data.get('financial_status'), profile_data.get('research_papers'),
                  profile_data.get('preferred_fields'), profile_data.get('target_countries'),
                  profile_data.get('career_goal')))
        
        conn.commit()
        conn.close()
    
    def get_user_profile(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM user_profile LIMIT 1')
        profile = cursor.fetchone()
        conn.close()
        return profile
    
    def log_search(self, query, results_count, source):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO search_logs (search_query, results_count, source)
            VALUES (?, ?, ?)
        ''', (query, results_count, source))
        
        conn.commit()
        conn.close()
    
    def get_stats(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        stats = {}
        
        cursor.execute('SELECT COUNT(*) FROM scholarships WHERE status="found"')
        stats['found'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM scholarships WHERE status="applied"')
        stats['applied'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM applications')
        stats['total_applications'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM search_logs')
        stats['total_searches'] = cursor.fetchone()[0]
        
        conn.close()
        return stats
