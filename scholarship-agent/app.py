from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
from dotenv import load_dotenv
from database import ScholarshipDatabase
from ai_service import AIService
from email_service import EmailService

load_dotenv()

app = Flask(__name__)

# Initialize services
db_path = os.getenv('DATABASE_PATH', '/workspace/scholarship-agent/data/scholarships.db')
db = ScholarshipDatabase(db_path)
ai = AIService()
email = EmailService()

# Initialize user profile on first run
def init_user_profile():
    profile_data = {
        'name': os.getenv('USER_NAME'),
        'email': os.getenv('USER_EMAIL'),
        'phone': os.getenv('USER_PHONE'),
        'nationality': os.getenv('USER_NATIONALITY'),
        'age': int(os.getenv('USER_AGE', 23)),
        'qualification': os.getenv('USER_QUALIFICATION'),
        'university': os.getenv('USER_UNIVERSITY'),
        'cgpa': float(os.getenv('USER_CGPA', 2.75)),
        'financial_status': os.getenv('USER_FINANCIAL_STATUS'),
        'research_papers': int(os.getenv('USER_RESEARCH_PAPERS', 3)),
        'preferred_fields': os.getenv('PREFERRED_FIELDS'),
        'target_countries': os.getenv('TARGET_COUNTRIES'),
        'career_goal': """Coming from a developing country where access to advanced healthcare and scientific facilities is still limited for many people, I have always believed that biotechnology is not only a field of science but also a way to serve humanity. My long-term career goal is to become a biotechnology researcher dedicated to improving human health through meaningful scientific innovation and medical research."""
    }
    db.save_user_profile(profile_data)

@app.route('/')
def dashboard():
    """Main dashboard showing scholarships and stats"""
    user_profile = db.get_user_profile()
    scholarships = db.get_matching_scholarships(limit=20)
    applications = db.get_applications()
    stats = db.get_stats()
    
    return render_template('dashboard.html', 
                         user=user_profile,
                         scholarships=scholarships,
                         applications=applications,
                         stats=stats)

@app.route('/search', methods=['GET', 'POST'])
def search_scholarships():
    """Manual trigger for scholarship search"""
    if request.method == 'POST':
        query = request.form.get('query', '')
        
        # Use AI to generate search queries based on user profile
        user_profile = db.get_user_profile()
        profile_dict = {
            'name': user_profile[1] if user_profile else '',
            'qualification': user_profile[6] if user_profile else '',
            'university': user_profile[7] if user_profile else '',
            'cgpa': user_profile[8] if user_profile else 2.75,
            'nationality': user_profile[4] if user_profile else '',
            'research_papers': user_profile[10] if user_profile else 3,
            'financial_status': user_profile[9] if user_profile else '',
            'preferred_fields': user_profile[11] if user_profile else '',
            'target_countries': user_profile[12] if user_profile else '',
            'career_goal': user_profile[13] if user_profile else ''
        }
        
        # Generate optimized search queries
        search_queries = ai.generate_search_queries(profile_dict)
        
        results = []
        for query in search_queries[:5]:  # Limit to 5 queries for demo
            # Simulate search results (in production, this would use actual web search)
            # For now, we'll create sample scholarships
            sample_scholarship = {
                'title': f"Graduate Research Assistantship - {query.split()[0] if query else 'Biotechnology'}",
                'university': f"University of {query.split()[-1] if len(query.split()) > 1 else 'Research'}",
                'country': query.split()[-1] if query else 'USA',
                'field': 'Biotechnology',
                'deadline': '2025-06-30',
                'funding_type': 'Fully Funded',
                'requirements': 'Bachelor\'s degree, Research experience, English proficiency',
                'application_url': 'https://example.com/apply',
                'match_score': 85.5
            }
            
            # Add to database
            db.add_scholarship(
                title=sample_scholarship['title'],
                university=sample_scholarship['university'],
                country=sample_scholarship['country'],
                field=sample_scholarship['field'],
                deadline=sample_scholarship['deadline'],
                funding_type=sample_scholarship['funding_type'],
                requirements=sample_scholarship['requirements'],
                application_url=sample_scholarship['application_url'],
                match_score=sample_scholarship['match_score']
            )
            
            db.log_search(query, 1, 'manual')
            results.append(sample_scholarship)
        
        return jsonify({'status': 'success', 'results': results, 'queries': search_queries})
    
    return render_template('search.html')

@app.route('/scholarship/<int:scholarship_id>')
def view_scholarship(scholarship_id):
    """View detailed scholarship information"""
    conn = db.db_path
    import sqlite3
    conn_sqlite = sqlite3.connect(conn)
    cursor = conn_sqlite.cursor()
    
    cursor.execute('SELECT * FROM scholarships WHERE id = ?', (scholarship_id,))
    scholarship = cursor.fetchone()
    conn_sqlite.close()
    
    if not scholarship:
        return "Scholarship not found", 404
    
    return render_template('scholarship_detail.html', scholarship=scholarship)

@app.route('/analyze/<int:scholarship_id>')
def analyze_scholarship(scholarship_id):
    """AI analysis of scholarship match"""
    import sqlite3
    conn_sqlite = sqlite3.connect(db.db_path)
    cursor = conn_sqlite.cursor()
    
    cursor.execute('SELECT * FROM scholarships WHERE id = ?', (scholarship_id,))
    scholarship = cursor.fetchone()
    cursor.execute('SELECT * FROM user_profile LIMIT 1')
    user_profile = cursor.fetchone()
    conn_sqlite.close()
    
    if not scholarship or not user_profile:
        return jsonify({'error': 'Data not found'}), 404
    
    profile_dict = {
        'name': user_profile[1],
        'qualification': user_profile[6],
        'university': user_profile[7],
        'cgpa': user_profile[8],
        'nationality': user_profile[4],
        'research_papers': user_profile[10],
        'financial_status': user_profile[9],
        'preferred_fields': user_profile[11],
        'target_countries': user_profile[12]
    }
    
    scholarship_info = f"""
    Title: {scholarship[1]}
    University: {scholarship[2]}
    Country: {scholarship[3]}
    Field: {scholarship[4]}
    Deadline: {scholarship[5]}
    Funding: {scholarship[6]}
    Requirements: {scholarship[7]}
    """
    
    analysis = ai.analyze_scholarship_match(profile_dict, scholarship_info)
    
    return jsonify(analysis)

@app.route('/generate-document', methods=['POST'])
def generate_document():
    """Generate application documents using AI"""
    data = request.json
    scholarship_id = data.get('scholarship_id')
    doc_type = data.get('doc_type', 'motivation_letter')
    
    import sqlite3
    conn_sqlite = sqlite3.connect(db.db_path)
    cursor = conn_sqlite.cursor()
    
    cursor.execute('SELECT * FROM scholarships WHERE id = ?', (scholarship_id,))
    scholarship = cursor.fetchone()
    cursor.execute('SELECT * FROM user_profile LIMIT 1')
    user_profile = cursor.fetchone()
    conn_sqlite.close()
    
    if not scholarship or not user_profile:
        return jsonify({'error': 'Data not found'}), 404
    
    profile_dict = {
        'name': user_profile[1],
        'qualification': user_profile[6],
        'university': user_profile[7],
        'cgpa': user_profile[8],
        'research_papers': user_profile[10],
        'career_goal': user_profile[13]
    }
    
    scholarship_info = f"{scholarship[1]} at {scholarship[2]}, {scholarship[3]}"
    
    document = ai.generate_application_documents(profile_dict, scholarship_info, doc_type)
    
    return jsonify({'document': document, 'type': doc_type})

@app.route('/apply/<int:scholarship_id>', methods=['POST'])
def submit_application(scholarship_id):
    """Submit application (creates record and sends confirmation)"""
    notes = request.form.get('notes', '')
    
    application_id = db.add_application(scholarship_id, notes=notes)
    
    # Get scholarship details for email
    import sqlite3
    conn_sqlite = sqlite3.connect(db.db_path)
    cursor = conn_sqlite.cursor()
    cursor.execute('SELECT title, university FROM scholarships WHERE id = ?', (scholarship_id,))
    scholarship = cursor.fetchone()
    conn_sqlite.close()
    
    # Send confirmation email
    if scholarship:
        email.send_application_confirmation(scholarship[0], scholarship[1], application_id)
    
    return redirect(url_for('dashboard'))

@app.route('/applications')
def view_applications():
    """View all submitted applications"""
    applications = db.get_applications()
    return render_template('applications.html', applications=applications)

@app.route('/send-digest')
def send_digest():
    """Manually trigger scholarship digest email"""
    scholarships = db.get_matching_scholarships(limit=10)
    success = email.send_scholarship_digest(scholarships)
    
    if success:
        return jsonify({'status': 'success', 'message': 'Digest sent successfully'})
    else:
        return jsonify({'status': 'error', 'message': 'Failed to send digest'}), 500

@app.route('/profile')
def view_profile():
    """View and edit user profile"""
    user_profile = db.get_user_profile()
    return render_template('profile.html', user=user_profile)

if __name__ == '__main__':
    # Initialize user profile
    init_user_profile()
    
    # Create templates directory
    os.makedirs('/workspace/scholarship-agent/templates', exist_ok=True)
    os.makedirs('/workspace/scholarship-agent/static', exist_ok=True)
    
    # Run the app without debug mode to avoid reloader issues
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
