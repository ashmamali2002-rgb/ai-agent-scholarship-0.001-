"""
Smart Admission Agent

This agent:
1. Monitors your email for admission-related messages
2. Automatically applies to programs based on your criteria
3. Contacts relevant professors to notify them of your application
4. Tracks application status and follows up

Requirements:
- Python 3.8+
- Install dependencies: pip install imaplib2 email beautifulsoup4 requests schedule
- Configure your email credentials and preferences in config.json
"""

import json
import imaplib
import email
from email.header import decode_header
from bs4 import BeautifulSoup
import requests
import schedule
import time
from datetime import datetime
import os

class AdmissionAgent:
    def __init__(self, config_file="config.json"):
        self.config = self.load_config(config_file)
        self.applied_programs = []
        self.contact_log = []
        
    def load_config(self, config_file):
        """Load configuration from JSON file"""
        default_config = {
            "email": {
                "imap_server": "imap.gmail.com",
                "email_address": "your_email@gmail.com",
                "password": "your_app_password"
            },
            "application_preferences": {
                "field_of_study": ["Computer Science", "AI", "Machine Learning"],
                "degree_level": "PhD",
                "preferred_universities": [],
                "application_deadline_buffer_days": 7
            },
            "professor_contact": {
                "template": "Dear Professor {name},\n\nI hope this message finds you well. I am writing to inform you that I have recently applied to the {program} program at {university}. Your research in {research_area} aligns closely with my interests in {my_interests}.\n\nI would be honored to discuss potential opportunities to work under your supervision.\n\nBest regards,\n{my_name}",
                "my_name": "Your Name",
                "my_interests": "AI and Machine Learning"
            },
            "application_data": {
                "cv_path": "path/to/your/cv.pdf",
                "statement_path": "path/to/statement.pdf",
                "transcripts_path": "path/to/transcripts.pdf",
                "gpa": "3.8",
                "gre_score": "320"
            }
        }
        
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config = json.load(f)
                # Merge with defaults
                for key in default_config:
                    if key not in config:
                        config[key] = default_config[key]
                return config
        else:
            # Create default config file
            with open(config_file, 'w') as f:
                json.dump(default_config, f, indent=2)
            print(f"Created default config file: {config_file}")
            print("Please update the config file with your information before running.")
            return default_config
    
    def check_emails(self):
        """Check inbox for admission-related emails"""
        print(f"\n[{datetime.now()}] Checking emails...")
        
        try:
            mail = imaplib.IMAP4_SSL(self.config["email"]["imap_server"])
            mail.login(self.config["email"]["email_address"], 
                      self.config["email"]["password"])
            mail.select("inbox")
            
            # Search for admission-related emails
            status, messages = mail.search(None, '(OR OR SUBJECT "admission" SUBJECT "application" SUBJECT "university")')
            
            email_ids = messages[0].split()
            new_opportunities = []
            
            for email_id in email_ids[-10:]:  # Check last 10 emails
                status, msg = mail.fetch(email_id, "(RFC822)")
                for response in msg:
                    if isinstance(response, tuple):
                        email_message = email.message_from_bytes(response[1])
                        subject = self.decode_email_header(email_message["subject"])
                        
                        if any(keyword.lower() in subject.lower() 
                              for keyword in ["phd position", "admission", "opening", "opportunity"]):
                            new_opportunities.append({
                                "subject": subject,
                                "from": email_message["from"],
                                "date": email_message["date"]
                            })
            
            mail.close()
            mail.logout()
            
            if new_opportunities:
                print(f"Found {len(new_opportunities)} potential opportunities")
                return new_opportunities
            else:
                print("No new opportunities found")
                return []
                
        except Exception as e:
            print(f"Error checking emails: {e}")
            return []
    
    def decode_email_header(self, header):
        """Decode email header"""
        decoded = decode_header(header)
        return ''.join([str(part, encoding) if encoding else part 
                       for part, encoding in decoded])
    
    def find_relevant_professors(self, opportunity):
        """Find professors relevant to the opportunity"""
        # This is a placeholder - in reality, you'd scrape university websites
        # or use an API to find professors
        print(f"\nSearching for professors related to: {opportunity['subject']}")
        
        # Mock data - replace with actual web scraping or API calls
        mock_professors = [
            {
                "name": "Dr. Smith",
                "university": "Stanford University",
                "program": "Computer Science PhD",
                "research_area": "Machine Learning",
                "email": "smith@stanford.edu"
            },
            {
                "name": "Dr. Johnson",
                "university": "MIT",
                "program": "AI PhD",
                "research_area": "Deep Learning",
                "email": "johnson@mit.edu"
            }
        ]
        
        return mock_professors
    
    def submit_application(self, opportunity, professor):
        """Submit application to the program"""
        print(f"\nSubmitting application to {professor['university']}...")
        
        # This is a placeholder - actual implementation depends on the university's application system
        # Some universities have APIs, others require web form automation
        
        application_data = {
            "program": professor["program"],
            "university": professor["university"],
            "professor": professor["name"],
            "submitted_at": datetime.now().isoformat(),
            "status": "submitted"
        }
        
        # Mock submission - replace with actual application logic
        self.applied_programs.append(application_data)
        print(f"✓ Application submitted to {professor['university']}")
        
        return application_data
    
    def contact_professor(self, professor, application_data):
        """Contact professor to notify about application"""
        print(f"\nContacting Professor {professor['name']}...")
        
        template = self.config["professor_contact"]["template"]
        message = template.format(
            name=professor["name"].split()[-1],  # Last name
            program=professor["program"],
            university=professor["university"],
            research_area=professor["research_area"],
            my_interests=self.config["professor_contact"]["my_interests"],
            my_name=self.config["professor_contact"]["my_name"]
        )
        
        # Mock email sending - replace with actual email API (SendGrid, SMTP, etc.)
        print(f"Sending email to {professor['email']}")
        print(f"Subject: Application Notification - {self.config['professor_contact']['my_name']}")
        print(f"Message preview: {message[:100]}...")
        
        contact_record = {
            "professor": professor["name"],
            "email": professor["email"],
            "sent_at": datetime.now().isoformat(),
            "message": message
        }
        
        self.contact_log.append(contact_record)
        print(f"✓ Contacted Professor {professor['name']}")
        
        return contact_record
    
    def run_daily_task(self):
        """Run daily admission agent tasks"""
        print("\n" + "="*60)
        print(f"Starting Daily Admission Agent Task - {datetime.now()}")
        print("="*60)
        
        # Step 1: Check for new opportunities
        opportunities = self.check_emails()
        
        # Step 2: For each opportunity, find professors and apply
        for opp in opportunities:
            professors = self.find_relevant_professors(opp)
            
            for prof in professors:
                # Check if already applied
                if not any(app["university"] == prof["university"] 
                          for app in self.applied_programs):
                    
                    # Submit application
                    app_data = self.submit_application(opp, prof)
                    
                    # Contact professor
                    self.contact_professor(prof, app_data)
        
        # Step 3: Generate summary
        print("\n" + "="*60)
        print("Daily Summary:")
        print(f"Applications submitted today: {len([a for a in self.applied_programs if 'today' in a['submitted_at']])}")
        print(f"Professors contacted today: {len([c for c in self.contact_log if 'today' in c['sent_at']])}")
        print(f"Total applications: {len(self.applied_programs)}")
        print(f"Total contacts: {len(self.contact_log)}")
        print("="*60)
    
    def start_scheduler(self):
        """Start the daily scheduler"""
        print("Starting Admission Agent Scheduler...")
        print("Running daily task at 9:00 AM")
        
        schedule.every().day.at("09:00").do(self.run_daily_task)
        
        # Run once immediately for testing
        self.run_daily_task()
        
        while True:
            schedule.run_pending()
            time.sleep(60)

def main():
    """Main entry point"""
    print("🎓 Smart Admission Agent")
    print("="*40)
    
    # Initialize agent
    agent = AdmissionAgent()
    
    # Check if config needs updating
    if agent.config["email"]["email_address"] == "your_email@gmail.com":
        print("\n⚠️  WARNING: Please update config.json with your actual email and preferences!")
        print("Default config file created. Update it before running the agent.")
        return
    
    # Start the agent
    choice = input("\nStart the automated scheduler? (y/n): ").lower()
    if choice == 'y':
        agent.start_scheduler()
    else:
        # Run single task
        agent.run_daily_task()

if __name__ == "__main__":
    main()
