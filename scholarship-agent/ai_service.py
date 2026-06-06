import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

class AIService:
    def __init__(self):
        self.groq_api_key = os.getenv('GROQ_API_KEY')
        self.jina_api_key = os.getenv('JINA_API_KEY')
        self.groq_base_url = "https://api.groq.com/openai/v1"
        self.jina_base_url = "https://r.jina.ai/"
    
    def analyze_scholarship_match(self, user_profile, scholarship_info):
        """Use Groq to analyze how well a scholarship matches the user profile"""
        
        prompt = f"""
        Analyze this scholarship opportunity for the following candidate:
        
        CANDIDATE PROFILE:
        - Name: {user_profile.get('name')}
        - Qualification: {user_profile.get('qualification')}
        - University: {user_profile.get('university')}
        - CGPA: {user_profile.get('cgpa')}
        - Nationality: {user_profile.get('nationality')}
        - Research Papers: {user_profile.get('research_papers')}
        - Financial Status: {user_profile.get('financial_status')}
        - Preferred Fields: {user_profile.get('preferred_fields')}
        - Target Countries: {user_profile.get('target_countries')}
        
        SCHOLARSHIP DETAILS:
        {scholarship_info}
        
        Provide a JSON response with:
        1. match_score (0-100): How well does this scholarship match the candidate?
        2. strengths: List of matching factors
        3. weaknesses: List of potential gaps
        4. recommendation: "highly_recommended", "recommended", or "consider"
        5. application_strategy: Brief advice on how to approach this application
        
        Return ONLY valid JSON, no other text.
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama-3.1-70b-versatile",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert scholarship advisor. Analyze scholarships and provide JSON responses only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 1024
            }
            
            response = requests.post(
                f"{self.groq_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Extract JSON from response
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                
                if start_idx >= 0 and end_idx > start_idx:
                    json_str = content[start_idx:end_idx]
                    return json.loads(json_str)
                else:
                    return {"error": "Could not parse JSON response"}
            else:
                return {"error": f"Groq API error: {response.status_code}"}
                
        except Exception as e:
            return {"error": str(e)}
    
    def browse_scholarship_website(self, url):
        """Use Jina.ai to extract content from scholarship websites"""
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jina_api_key}",
                "X-With-Links-Summary": "true"
            }
            
            response = requests.get(
                f"{self.jina_base_url}{url}",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.text[:10000]  # Limit to first 10k characters
            else:
                return None
                
        except Exception as e:
            return None
    
    def generate_search_queries(self, user_profile):
        """Generate optimized search queries for scholarship discovery"""
        
        prompt = f"""
        Based on this candidate profile, generate 10 specific search queries to find relevant scholarships:
        
        CANDIDATE:
        - Field: {user_profile.get('qualification')} in Biotechnology
        - Preferred Master's Fields: {user_profile.get('preferred_fields')}
        - Target Countries: {user_profile.get('target_countries')}
        - Need: Fully funded scholarships (tuition + stipend + accommodation)
        - Profile: Pakistani student, CGPA 2.75, 3 research papers
        
        Generate search queries that would find:
        1. Government-funded international scholarships
        2. University-specific graduate assistantships
        3. Research-based funding opportunities
        4. Country-specific scholarship programs for Pakistani students
        5. Field-specific opportunities in biotechnology/life sciences
        
        Return a JSON array of 10 search query strings only.
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama-3.1-70b-versatile",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a scholarship search expert. Generate precise search queries. Return JSON array only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.5,
                "max_tokens": 512
            }
            
            response = requests.post(
                f"{self.groq_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Extract JSON array
                start_idx = content.find('[')
                end_idx = content.rfind(']') + 1
                
                if start_idx >= 0 and end_idx > start_idx:
                    json_str = content[start_idx:end_idx]
                    return json.loads(json_str)
                else:
                    return []
            else:
                return []
                
        except Exception as e:
            return []
    
    def generate_application_documents(self, user_profile, scholarship_info, doc_type):
        """Generate tailored application documents using Groq"""
        
        prompts = {
            "motivation_letter": f"""
            Write a compelling motivation letter for this scholarship application:
            
            CANDIDATE: {user_profile.get('name')}
            BACKGROUND: {user_profile.get('qualification')} from {user_profile.get('university')}
            CGPA: {user_profile.get('cgpa')}
            RESEARCH: {user_profile.get('research_papers')} published papers
            CAREER_GOAL: {user_profile.get('career_goal')}
            
            SCHOLARSHIP: {scholarship_info}
            
            Write a 500-word motivation letter that:
            1. Introduces the candidate strongly
            2. Connects their background to the scholarship
            3. Highlights research experience
            4. Explains career goals and how this scholarship helps
            5. Shows commitment to contributing to society
            
            Make it personal, passionate, and professional.
            """,
            
            "research_proposal_outline": f"""
            Create a research proposal outline for this scholarship:
            
            CANDIDATE BACKGROUND:
            - Field: Biotechnology
            - Research Experience: 3 published papers in computational biology and genetics
            - Interests: Molecular Biology, Genetics, Cancer Biology, AI in Healthcare
            
            SCHOLARSHIP: {scholarship_info}
            
            Provide a structured research proposal outline with:
            1. Title
            2. Abstract (150 words)
            3. Research Questions (3-4)
            4. Methodology Overview
            5. Expected Outcomes
            6. Relevance to host country/institution
            
            Focus on biotechnology applications for healthcare in developing countries.
            """,
            
            "cv_summary": f"""
            Create a professional CV summary/profile section:
            
            NAME: {user_profile.get('name')}
            EDUCATION: {user_profile.get('qualification')}, {user_profile.get('university')}, CGPA {user_profile.get('cgpa')}
            RESEARCH: {user_profile.get('research_papers')} publications
            NATIONALITY: {user_profile.get('nationality')}
            GOAL: {user_profile.get('career_goal')}
            
            Write a 4-5 line professional summary that highlights:
            - Academic background
            - Research achievements
            - Career aspirations
            - Unique value proposition
            
            Make it impactful for scholarship applications.
            """
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama-3.1-70b-versatile",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a professional academic writer. Create compelling application documents."
                    },
                    {
                        "role": "user",
                        "content": prompts.get(doc_type, prompts["motivation_letter"])
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 2048
            }
            
            response = requests.post(
                f"{self.groq_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=45
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content']
            else:
                return None
                
        except Exception as e:
            return None
    
    def extract_scholarship_details(self, webpage_content):
        """Extract structured scholarship information from webpage content"""
        
        prompt = f"""
        Extract scholarship information from this webpage content:
        
        {webpage_content[:5000]}
        
        Return a JSON object with these fields:
        - title: Scholarship name
        - university: Institution name
        - country: Country
        - field: Field of study
        - deadline: Application deadline
        - funding_type: Type of funding (fully/partially funded)
        - requirements: Key requirements (as array)
        - benefits: What is covered (as array)
        - application_url: URL to apply
        
        If information is not found, use null for that field.
        Return ONLY valid JSON.
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama-3.1-70b-versatile",
                "messages": [
                    {
                        "role": "system",
                        "content": "Extract scholarship data accurately. Return JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.2,
                "max_tokens": 1024
            }
            
            response = requests.post(
                f"{self.groq_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                
                if start_idx >= 0 and end_idx > start_idx:
                    json_str = content[start_idx:end_idx]
                    return json.loads(json_str)
                else:
                    return None
            else:
                return None
                
        except Exception as e:
            return None
