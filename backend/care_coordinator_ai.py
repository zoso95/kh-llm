#!/usr/bin/env python3
"""
Care Coordinator AI Library
Handles OpenAI API interactions for care coordination assistance
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
load_dotenv()

try:
    import openai
    openai.api_key = os.getenv("OPENAI_API_KEY")
except ImportError:
    print("Warning: OpenAI library not installed. Run: pip install openai")
    openai = None


CHAT_MODEL = os.getenv("CHAT_MODEL")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CareCoordinatorAI:
    """
    AI assistant for care coordination tasks
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Care Coordinator AI
        
        Args:
            api_key: OpenAI API key. If None, will try to get from environment
        """
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not self.api_key:
            logger.warning("No OpenAI API key provided. Set OPENAI_API_KEY environment variable.")
        
        if openai:
            openai.api_key = self.api_key
            self.client = openai.OpenAI(api_key=self.api_key)
        else:
            self.client = None
        
        logger.info("Care Coordinator AI initialized")
    
    def format_patient_data(self, patient_record: Dict[str, Any]) -> str:
        """
        Format patient record into a readable string for the prompt
        """
        if not patient_record:
            return "No patient data available"
        
        formatted = f"""
Patient Information:
- Name: {patient_record.get('name', 'Unknown')}
- Date of Birth: {patient_record.get('dob', 'Unknown')}
- Primary Care Provider: {patient_record.get('pcp', 'Unknown')}
- EHR ID: {patient_record.get('ehrId', 'Unknown')}

Referred Providers:
"""
        
        for provider in patient_record.get('referred_providers', []):
            provider_name = provider.get('provider', 'Unknown Provider')
            specialty = provider.get('specialty', 'Unknown Specialty')
            formatted += f"- {provider_name} ({specialty})\n"
        
        formatted += "\nAppointment History:\n"
        for apt in patient_record.get('appointments', []):
            date = apt.get('date', 'Unknown')
            time = apt.get('time', 'Unknown')
            provider = apt.get('provider', 'Unknown')
            status = apt.get('status', 'Unknown')
            formatted += f"- {date} at {time} with {provider} - Status: {status}\n"
        
        return formatted.strip()
    
    def format_data_sheet(self, data_sheet_path: str) -> str:
        """
        Read and format the hospital data sheet
        """
        try:
            with open(data_sheet_path, 'r') as file:
                content = file.read()
            return content
        except FileNotFoundError:
            logger.error(f"Data sheet not found at {data_sheet_path}")
            return "Data sheet not available"
        except Exception as e:
            logger.error(f"Error reading data sheet: {e}")
            return "Error loading data sheet"
    
    def create_system_prompt(self, patient_data: str, hospital_data: str) -> str:
        """
        Create the system prompt for the care coordinator assistant
        """
        current_date = datetime.now().strftime("%Y-%m-%d")
        current_day = datetime.now().strftime("%A")
        
        return f"""You are a Care Coordinator Assistant helping a nurse book appointments and coordinate patient care. Your role is to guide the nurse through the appointment booking process and answer questions about providers, insurance, and scheduling.

Current Date: {current_date} ({current_day})

{patient_data}

Hospital System Information:
{hospital_data}

Key Responsibilities:
1. Help book appointments by gathering required information:
   - Patient first name, last name, and DOB
   - Provider/doctor for the appointment
   - Type of appointment (NEW or ESTABLISHED)
   - Location of the appointment
   - Date and time

2. Answer questions about:
   - Provider availability and alternatives
   - Insurance acceptance and costs
   - Patient history with providers
   - Appointment scheduling requirements

3. Apply hospital rules:
   - NEW appointments are 30 minutes (patient hasn't seen provider in 5+ years)
   - ESTABLISHED appointments are 15 minutes (patient seen within 5 years)
   - Appointments only during office hours
   - New patients arrive 30 minutes early, established patients 10 minutes early

4. Be helpful, professional, and guide the conversation systematically to ensure all required information is collected for successful appointment booking.

5. When you have enough information to help fill out appointment booking fields, include a JSON object at the END of your response with the format:
   FORM_UPDATE: {{"field_name": "value", "field_name": "value"}}
   
   Available form fields:
   - "doctor": Doctor name (e.g., "House, Gregory")
   - "appointment-type": "NEW" or "ESTABLISHED" 
   - "appointment-location": Location name (e.g., "PPTH Orthopedics")
   - "appointment-date": Date in YYYY-MM-DD format
   - "appointment-time": Time in HH:MM format (24-hour)
   
   Example: "I'll help you book with Dr. House for next Tuesday at 2pm. FORM_UPDATE: {{"doctor": "House, Gregory", "appointment-date": "2024-01-23", "appointment-time": "14:00"}}"

Always reference the specific patient data and hospital information provided when making recommendations or answering questions."""

    def ask_question(self, 
                    patient_record: Dict[str, Any], 
                    data_sheet_path: str, 
                    question: str,
                    conversation_history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Ask a question to the care coordinator AI
        
        Args:
            patient_record: Patient data dictionary
            data_sheet_path: Path to hospital data sheet file
            question: User's question
            conversation_history: Previous conversation messages
            
        Returns:
            Dictionary with response and metadata
        """
        
        if not openai:
            return {
                "response": "OpenAI library not available. Please install it with: pip install openai",
                "error": "OpenAI not installed",
                "timestamp": datetime.now().isoformat()
            }
        
        if not self.api_key:
            return {
                "response": "OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable.",
                "error": "No API key",
                "timestamp": datetime.now().isoformat()
            }
        
        try:
            # Format the context data
            patient_data = self.format_patient_data(patient_record)
            hospital_data = self.format_data_sheet(data_sheet_path)
            system_prompt = self.create_system_prompt(patient_data, hospital_data)
            
            # Build conversation messages
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history if provided
            if conversation_history:
                messages.extend(conversation_history)
            
            # Add current question
            messages.append({"role": "user", "content": question})
            
            logger.info(f"Sending question to OpenAI with {len(messages)} messages")

            # Make API call using current chat completions API
            response = self.client.chat.completions.create(
                model=CHAT_MODEL,
                messages=messages,
                max_tokens=500,
                temperature=0.7
            )
            
            assistant_response = response.choices[0].message.content
            
            logger.info(f"Received response from OpenAI: {assistant_response[:100]}...")
            
            return {
                "response": assistant_response,
                "timestamp": datetime.now().isoformat(),
                "model": CHAT_MODEL,
                "tokens_used": response.usage.total_tokens if response.usage else None
            }
            
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {e}")
            return {
                "response": f"Sorry, I encountered an error: {str(e)}",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def start_conversation(self, patient_record: Dict[str, Any], data_sheet_path: str) -> Dict[str, Any]:
        """
        Start a new conversation for a patient
        """
        welcome_question = f"I'm ready to help coordinate care for {patient_record.get('name', 'this patient')}. How can I assist you today?"
        
        return self.ask_question(
            patient_record=patient_record,
            data_sheet_path=data_sheet_path,
            question=welcome_question
        )

def load_sample_patient() -> Dict[str, Any]:
    """
    Load sample patient data for testing
    """
    return {
        "id": 1,
        "name": "John Doe",
        "dob": "01/01/1975",
        "pcp": "Dr. Meredith Grey",
        "ehrId": "1234abcd",
        "referred_providers": [
            {"provider": "House, Gregory MD", "specialty": "Orthopedics"},
            {"specialty": "Primary Care"},
        ],
        "appointments": [
            {"date": "3/05/18", "time": "9:15am", "provider": "Dr. Meredith Grey", "status": "completed"},
            {"date": "8/12/24", "time": "2:30pm", "provider": "Dr. Gregory House", "status": "completed"},
            {"date": "9/17/24", "time": "10:00am", "provider": "Dr. Meredith Grey", "status": "noshow"},
            {"date": "11/25/24", "time": "11:30am", "provider": "Dr. Meredith Grey", "status": "cancelled"}
        ]
    }

if __name__ == "__main__":
    # Simple test
    ai = CareCoordinatorAI()
    patient = load_sample_patient()
    
    print("Testing Care Coordinator AI...")
    result = ai.ask_question(
        patient_record=patient,
        data_sheet_path="../data_sheet.txt",
        question="What providers are available for orthopedics appointments?"
    )
    
    print(f"Response: {result['response']}")