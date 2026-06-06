import os
import requests
from dotenv import load_dotenv

load_dotenv()

class EmailService:
    def __init__(self):
        self.resend_api_key = os.getenv('RESEND_API_KEY')
        self.from_email = "Scholarship Agent <onboarding@resend.dev>"
        self.to_email = os.getenv('USER_EMAIL', 'ashmamali2002@gmail.com')
    
    def send_scholarship_digest(self, scholarships):
        """Send daily/weekly digest of found scholarships"""
        
        if not scholarships:
            return False
        
        subject = f"🎓 {len(scholarships)} New Scholarship Opportunities Found!"
        
        html_content = """
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">New Scholarship Opportunities</h2>
            <p>Dear Syed Ashmam Ali Shah,</p>
            <p>Our AI agent has found <strong>{count}</strong> new scholarship opportunities that match your profile.</p>
            
            <div style="margin: 20px 0;">
        """.format(count=len(scholarships))
        
        for idx, scholarship in enumerate(scholarships[:10], 1):  # Limit to top 10
            html_content += """
                <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; background-color: #f9fafb;">
                    <h3 style="color: #1f2937; margin-top: 0;">{idx}. {title}</h3>
                    <p><strong>University:</strong> {university}</p>
                    <p><strong>Country:</strong> {country}</p>
                    <p><strong>Field:</strong> {field}</p>
                    <p><strong>Deadline:</strong> {deadline}</p>
                    <p><strong>Funding:</strong> {funding_type}</p>
                    <p><strong>Match Score:</strong> <span style="color: {score_color}; font-weight: bold;">{match_score}%</span></p>
                    <p><a href="{application_url}" style="display: inline-block; background-color: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Details & Apply</a></p>
                </div>
            """.format(
                idx=idx,
                title=scholarship[1],
                university=scholarship[2] or 'Not specified',
                country=scholarship[3] or 'Not specified',
                field=scholarship[4] or 'Not specified',
                deadline=scholarship[5] or 'Not specified',
                funding_type=scholarship[6] or 'Not specified',
                score_color='#16a34a' if scholarship[10] >= 80 else '#ca8a04' if scholarship[10] >= 60 else '#dc2626',
                match_score=round(scholarship[10], 1) if scholarship[10] else 0,
                application_url=scholarship[8] or '#'
            )
        
        if len(scholarships) > 10:
            html_content += f"""
                <p style="text-align: center; color: #6b7280;">... and {len(scholarships) - 10} more scholarships available in your dashboard</p>
            """
        
        html_content += """
            </div>
            
            <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <h3 style="color: #1e40af; margin-top: 0;">Next Steps:</h3>
                <ol>
                    <li>Review the scholarships above</li>
                    <li>Click on any scholarship to view full details</li>
                    <li>Use the "Generate Application Documents" feature in your dashboard</li>
                    <li>Submit your applications before deadlines</li>
                </ol>
            </div>
            
            <p style="margin-top: 20px;">Best of luck with your applications!</p>
            <p><strong>Scholarship AI Agent</strong></p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="font-size: 12px; color: #6b7280;">
                This is an automated message from your Scholarship AI Agent. 
                You're receiving this because you're actively searching for scholarships.
            </p>
        </body>
        </html>
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.resend_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "from": self.from_email,
                "to": [self.to_email],
                "subject": subject,
                "html": html_content
            }
            
            response = requests.post(
                "https://api.resend.com/emails",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"✓ Email sent successfully: {subject}")
                return True
            else:
                print(f"✗ Email failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"✗ Email error: {str(e)}")
            return False
    
    def send_application_confirmation(self, scholarship_title, university, application_id):
        """Send confirmation when an application is submitted"""
        
        subject = f"✓ Application Submitted: {scholarship_title}"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #16a34a;">Application Submitted Successfully!</h2>
            
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #16a34a; margin: 20px 0;">
                <p><strong>Scholarship:</strong> {scholarship_title}</p>
                <p><strong>University:</strong> {university}</p>
                <p><strong>Application ID:</strong> #{application_id}</p>
                <p><strong>Date:</strong> {requests.get('https://worldtimeapi.org/api/timezone/Asia/Karachi').json().get('datetime', 'Today')[:10]}</p>
            </div>
            
            <h3>What's Next?</h3>
            <ul>
                <li>Save your application ID for reference</li>
                <li>Check your email for confirmation from the university</li>
                <li>Prepare for potential interviews</li>
                <li>Gather original documents for verification</li>
            </ul>
            
            <p style="margin-top: 20px;">Track your application status in your dashboard.</p>
            <p><strong>Best of luck! 🍀</strong></p>
            
            <p style="margin-top: 30px;"><strong>Scholarship AI Agent</strong></p>
        </body>
        </html>
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.resend_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "from": self.from_email,
                "to": [self.to_email],
                "subject": subject,
                "html": html_content
            }
            
            response = requests.post(
                "https://api.resend.com/emails",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"✓ Confirmation email sent for application #{application_id}")
                return True
            else:
                return False
                
        except Exception as e:
            print(f"✗ Confirmation email error: {str(e)}")
            return False
    
    def send_weekly_summary(self, stats):
        """Send weekly activity summary"""
        
        subject = "📊 Weekly Scholarship Search Summary"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">Weekly Activity Summary</h2>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
                <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="color: #1e40af; margin: 0; font-size: 24px;">{stats.get('found', 0)}</h3>
                    <p style="margin: 5px 0 0 0; color: #1e40af;">Scholarships Found</p>
                </div>
                <div style="background-color: #dcfce7; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="color: #166534; margin: 0; font-size: 24px;">{stats.get('applied', 0)}</h3>
                    <p style="margin: 5px 0 0 0; color: #166534;">Applications Submitted</p>
                </div>
                <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="color: #92400e; margin: 0; font-size: 24px;">{stats.get('total_searches', 0)}</h3>
                    <p style="margin: 5px 0 0 0; color: #92400e;">Searches Performed</p>
                </div>
                <div style="background-color: #f3e8ff; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="color: #6b21a8; margin: 0; font-size: 24px;">{stats.get('pending', 0)}</h3>
                    <p style="margin: 5px 0 0 0; color: #6b21a8;">Pending Review</p>
                </div>
            </div>
            
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <h3 style="color: #374151; margin-top: 0;">Recommendations:</h3>
                <ul>
                    <li>Review pending scholarships in your dashboard</li>
                    <li>Prioritize applications with approaching deadlines</li>
                    <li>Use AI document generation for faster applications</li>
                </ul>
            </div>
            
            <p style="margin-top: 20px;">Keep up the great work!</p>
            <p><strong>Scholarship AI Agent</strong></p>
        </body>
        </html>
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.resend_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "from": self.from_email,
                "to": [self.to_email],
                "subject": subject,
                "html": html_content
            }
            
            response = requests.post(
                "https://api.resend.com/emails",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            return response.status_code == 200
                
        except Exception as e:
            print(f"✗ Weekly summary error: {str(e)}")
            return False
