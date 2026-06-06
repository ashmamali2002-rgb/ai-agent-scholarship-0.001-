# Scholarship AI Agent

A fully automated AI-powered scholarship discovery and application assistant.

## Features

- **AI-Powered Search**: Uses Groq LLM to generate optimized search queries
- **Smart Matching**: Analyzes scholarships against your profile for compatibility
- **Document Generation**: Creates tailored motivation letters, research proposals, and CV summaries
- **Email Notifications**: Sends scholarship digests and application confirmations via Resend
- **Web Scraping**: Uses Jina.ai to extract scholarship information from websites
- **Database**: SQLite database for storing scholarships, applications, and user profiles
- **Web Dashboard**: Beautiful Flask-based interface for managing your scholarship journey

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Flask App     │────▶│  Database    │────▶│  SQLite         │
│   (app.py)      │     │  (database)  │     │  Storage        │
└────────┬────────┘     └──────────────┘     └─────────────────┘
         │
         ├──────▶┌──────────────┐     ┌─────────────────┐
         │       │  AI Service  │────▶│  Groq API       │
         │       │  (ai_service)│     │  (LLM)          │
         │       └──────────────┘     └─────────────────┘
         │
         ├──────▶┌──────────────┐     ┌─────────────────┐
         │       │  Email Svc   │────▶│  Resend API     │
         │       │  (email_svc) │     │  (Email)        │
         │       └──────────────┘     └─────────────────┘
         │
         └──────▶┌──────────────┐     ┌─────────────────┐
                 │  Web Scraper │────▶│  Jina.ai API    │
                 │  (jina)      │     │  (Content)      │
                 └──────────────┘     └─────────────────┘
```

## Installation

1. Clone the repository:
```bash
cd /workspace/scholarship-agent
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables in `.env` (already configured with your API keys)

4. Run the application:
```bash
python app.py
```

5. Open your browser and navigate to:
```
http://localhost:5000
```

## Usage

### Dashboard
- View matching scholarships
- See application statistics
- Quick access to all features

### Search
- Click "Search Scholarships"
- AI generates optimized queries based on your profile
- Results are automatically added to your dashboard

### Apply
- View scholarship details
- Get AI analysis of match quality
- Generate application documents (motivation letter, research proposal, CV)
- Submit application with one click
- Receive email confirmation

### Profile
- View your academic profile
- All your information is used for smart matching

## API Keys Used

- **Groq**: LLM for AI analysis and document generation
- **Jina.ai**: Web content extraction
- **Resend**: Email notifications
- **Sepper.dev**: Workflow management (optional integration)
- **Cloudflare**: Deployment/hosting (optional)

## Your Profile (Pre-configured)

- **Name**: Syed Ashmam Ali Shah
- **Qualification**: Bachelor's in Biotechnology
- **University**: University of Peshawar
- **CGPA**: 2.75
- **Research Papers**: 3 publications
- **Target Countries**: USA, Canada, Australia, Japan, South Korea, Taiwan, China, Sweden, France, Germany, Saudi Arabia, UAE, Qatar, Kuwait
- **Preferred Fields**: Biotechnology, Molecular Biology, Genetics, Microbiology, Immunology, Cancer Biology, and 20+ more

## File Structure

```
scholarship-agent/
├── app.py                  # Main Flask application
├── database.py             # Database operations
├── ai_service.py           # AI/LLM integration
├── email_service.py        # Email notifications
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (API keys)
├── templates/              # HTML templates
│   ├── dashboard.html
│   ├── search.html
│   ├── applications.html
│   ├── profile.html
│   └── scholarship_detail.html
├── static/                 # CSS, JS, images
├── data/                   # SQLite database
└── logs/                   # Application logs
```

## Human-in-the-Loop Design

This agent uses a **Human-in-the-Loop** approach:
- ✅ AI finds scholarships
- ✅ AI analyzes matches
- ✅ AI generates documents
- ✅ AI prepares applications
- 👤 **You** review and confirm submissions
- 👤 **You** make final decisions

This ensures accuracy while saving you 95% of the work!

## Next Steps

1. Start the application
2. Click "Search Scholarships" to begin
3. Review AI-generated matches
4. Generate application documents
5. Submit applications with confidence!

## Support

For issues or questions, check the logs in `/workspace/scholarship-agent/logs/`
