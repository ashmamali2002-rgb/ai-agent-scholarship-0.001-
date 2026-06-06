# Smart Admission Agent

An intelligent Python agent that automates your graduate school admission process by:
- 📧 Monitoring emails for admission opportunities
- 🎓 Automatically applying to relevant programs
- 👨‍🏫 Contacting professors to notify them of your application
- 📊 Tracking all applications and communications

## Features

1. **Email Monitoring**: Scans your inbox for PhD positions, admission openings, and research opportunities
2. **Smart Application**: Automatically submits applications based on your preferences
3. **Professor Outreach**: Sends personalized emails to professors whose research aligns with your interests
4. **Daily Scheduler**: Runs automatically every day at 9:00 AM
5. **Tracking**: Maintains logs of all applications and professor contacts

## Installation

### Step 1: Install Python Dependencies

```bash
pip install beautifulsoup4 requests schedule
```

### Step 2: Configure the Agent

Edit `config.json` with your information:

```json
{
  "email": {
    "imap_server": "imap.gmail.com",
    "email_address": "your_email@gmail.com",
    "password": "your_app_password"
  },
  "application_preferences": {
    "field_of_study": ["Computer Science", "AI", "Machine Learning"],
    "degree_level": "PhD",
    "preferred_universities": []
  },
  "professor_contact": {
    "my_name": "Your Name",
    "my_interests": "AI and Machine Learning"
  }
}
```

### Important Email Setup

For Gmail:
1. Enable 2-Factor Authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in config.json (not your regular password)

## Usage

### Run Once (Test Mode)
```bash
cd /workspace/admission_agent
python admission_agent.py
```
Select 'n' when prompted to run a single test cycle.

### Run Continuously (Production Mode)
```bash
python admission_agent.py
```
Select 'y' to start the automated daily scheduler.

## Customization

### Add University-Specific Application Logic

The current code uses mock data. To make it production-ready:

1. **Web Scraping**: Add BeautifulSoup code to scrape university websites for professor information
2. **Application Portals**: Integrate with university application systems (some have APIs)
3. **Email Sending**: Replace mock email with real SMTP or SendGrid integration

Example for real email sending:
```python
import smtplib
from email.mime.text import MIMEText

def send_real_email(to_email, subject, message):
    msg = MIMEText(message)
    msg['Subject'] = subject
    msg['From'] = self.config["email"]["email_address"]
    msg['To'] = to_email
    
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login(self.config["email"]["email_address"], 
                self.config["email"]["password"])
    server.send_message(msg)
    server.quit()
```

### Add AI-Powered Professor Matching

Integrate with academic APIs like:
- Semantic Scholar API
- Google Scholar scraping
- University faculty directories

## File Structure

```
admission_agent/
├── admission_agent.py    # Main agent code
├── config.json          # Your configuration
├── README.md           # This file
└── documents/          # Store your CV, transcripts, etc.
    ├── cv.pdf
    ├── statement.pdf
    └── transcripts.pdf
```

## Security Notes

⚠️ **Important**:
- Never commit `config.json` with real credentials to Git
- Use environment variables for sensitive data in production
- Regularly rotate your email app passwords
- Review all automated applications before sending

## Next Steps to Make It Production-Ready

1. **Real Email Integration**: Set up SMTP or use SendGrid/Mailgun API
2. **University Portal Integration**: Research application APIs for target universities
3. **Professor Database**: Build or integrate with academic databases
4. **Error Handling**: Add retry logic and better exception handling
5. **Logging**: Implement proper logging instead of print statements
6. **Testing**: Create unit tests for each component

## Support

This is a framework to get you started. You'll need to customize:
- Email credentials
- Application preferences
- Professor contact templates
- University-specific application processes

Good luck with your admissions! 🎓
