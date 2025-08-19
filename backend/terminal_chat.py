#!/usr/bin/env python3
"""
Terminal Chat Application for Care Coordinator AI
Simple command-line interface for testing care coordination without frontend
"""

import os
import sys
import json
from typing import List, Dict, Any
from care_coordinator_ai import CareCoordinatorAI, load_sample_patient
from dotenv import load_dotenv
load_dotenv()

class TerminalChat:
    """
    Terminal-based chat interface for care coordinator testing
    """
    
    def __init__(self):
        self.ai = CareCoordinatorAI()
        self.patient_record = None
        self.data_sheet_path = "../data_sheet.txt"
        self.conversation_history: List[Dict[str, str]] = []
        
    def print_banner(self):
        """Print welcome banner"""
        print("=" * 60)
        print("   CARE COORDINATOR AI - TERMINAL CHAT")
        print("=" * 60)
        print("Type 'help' for commands, 'quit' to exit")
        print()
    
    def print_help(self):
        """Print available commands"""
        print("\nAvailable Commands:")
        print("  load <patient_id>  - Load patient (1 for John Doe)")
        print("  patient           - Show current patient info")
        print("  clear             - Clear conversation history")
        print("  history           - Show conversation history")
        print("  data              - Show hospital data sheet")
        print("  help              - Show this help")
        print("  quit              - Exit the application")
        print("\nOr just type your question about care coordination!\n")
    
    def load_patient(self, patient_id: str):
        """Load patient data"""
        if patient_id == "1":
            self.patient_record = load_sample_patient()
            print(f"✓ Loaded patient: {self.patient_record['name']}")
            print(f"  DOB: {self.patient_record['dob']}")
            print(f"  PCP: {self.patient_record['pcp']}")
            self.conversation_history = []  # Reset conversation for new patient
        else:
            print(f"✗ Patient ID '{patient_id}' not found. Only patient ID '1' (John Doe) is available.")
    
    def show_patient_info(self):
        """Display current patient information"""
        if not self.patient_record:
            print("No patient loaded. Use 'load 1' to load John Doe.")
            return
        
        patient = self.patient_record
        print(f"\nCurrent Patient: {patient['name']}")
        print(f"DOB: {patient['dob']}")
        print(f"PCP: {patient['pcp']}")
        print(f"EHR ID: {patient['ehrId']}")
        
        print("\nReferred Providers:")
        for provider in patient.get('referred_providers', []):
            provider_name = provider.get('provider', 'Unknown')
            specialty = provider.get('specialty', 'Unknown')
            print(f"  - {provider_name} ({specialty})")
        
        print("\nAppointment History:")
        for apt in patient.get('appointments', []):
            date = apt.get('date', 'Unknown')
            time = apt.get('time', 'Unknown')
            provider = apt.get('provider', 'Unknown')
            status = apt.get('status', 'Unknown')
            print(f"  - {date} at {time} with {provider} - {status}")
        print()
    
    def show_conversation_history(self):
        """Display conversation history"""
        if not self.conversation_history:
            print("No conversation history.")
            return
        
        print("\nConversation History:")
        print("-" * 40)
        for i, msg in enumerate(self.conversation_history, 1):
            role = "You" if msg['role'] == 'user' else "Assistant"
            print(f"{i}. {role}: {msg['content']}")
        print("-" * 40)
        print()
    
    def show_data_sheet(self):
        """Display hospital data sheet"""
        try:
            with open(self.data_sheet_path, 'r') as file:
                content = file.read()
            print("\nHospital Data Sheet:")
            print("-" * 40)
            print(content)
            print("-" * 40)
            print()
        except FileNotFoundError:
            print(f"✗ Data sheet not found at {self.data_sheet_path}")
        except Exception as e:
            print(f"✗ Error reading data sheet: {e}")
    
    def ask_question(self, question: str):
        """Ask a question to the AI"""
        if not self.patient_record:
            print("✗ No patient loaded. Use 'load 1' to load a patient first.")
            return
        
        print(f"\nYou: {question}")
        print("Assistant: ", end="", flush=True)
        
        # Get AI response
        result = self.ai.ask_question(
            patient_record=self.patient_record,
            data_sheet_path=self.data_sheet_path,
            question=question,
            conversation_history=self.conversation_history
        )
        
        if 'error' in result:
            print(f"✗ Error: {result['error']}")
            return
        
        response = result['response']
        print(response)
        
        # Add to conversation history
        self.conversation_history.append({"role": "user", "content": question})
        self.conversation_history.append({"role": "assistant", "content": response})
        
        # Show token usage if available
        if 'tokens_used' in result and result['tokens_used']:
            print(f"\n(Tokens used: {result['tokens_used']})")
        
        print()
    
    def run(self):
        """Main chat loop"""
        self.print_banner()
        
        # Check if OpenAI API key is set
        if not os.getenv('OPENAI_API_KEY'):
            print("⚠️  Warning: OPENAI_API_KEY environment variable not set.")
            print("   Set it with: export OPENAI_API_KEY='your-api-key-here'")
            print("   You can still test commands, but AI responses won't work.\n")
        
        while True:
            try:
                user_input = input(">> ").strip()
                
                if not user_input:
                    continue
                
                # Handle commands
                if user_input.lower() in ['quit', 'exit', 'q']:
                    print("Goodbye!")
                    break
                
                elif user_input.lower() == 'help':
                    self.print_help()
                
                elif user_input.lower().startswith('load '):
                    patient_id = user_input.split(' ', 1)[1]
                    self.load_patient(patient_id)
                
                elif user_input.lower() == 'patient':
                    self.show_patient_info()
                
                elif user_input.lower() == 'clear':
                    self.conversation_history = []
                    print("✓ Conversation history cleared.")
                
                elif user_input.lower() == 'history':
                    self.show_conversation_history()
                
                elif user_input.lower() == 'data':
                    self.show_data_sheet()
                
                else:
                    # Treat as a question
                    self.ask_question(user_input)
            
            except KeyboardInterrupt:
                print("\n\nGoodbye!")
                break
            except EOFError:
                print("\n\nGoodbye!")
                break
            except Exception as e:
                print(f"\n✗ Error: {e}")

def main():
    """Entry point"""
    chat = TerminalChat()
    chat.run()

if __name__ == "__main__":
    main()