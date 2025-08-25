#!/usr/bin/env python3
"""
ChatGPT Service for Care Coordinator Assistant
Handles all LLM interactions and conversation flow logic
"""

import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import requests
from datetime import datetime, timedelta
from care_coordinator_ai import CareCoordinatorAI

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize AI service
ai_service = CareCoordinatorAI()
data_sheet_path = "../data_sheet.txt"

# Configuration
PATIENT_API_URL = os.getenv('PATIENT_API_URL', 'http://localhost:5000')

# Patient data cache
patient_cache = {}
CACHE_EXPIRY_MINUTES = 5  # Cache patient data for 5 minutes

def parse_form_updates(ai_response):
    """
    Parse form updates from AI response
    Returns: (form_updates_dict, clean_response)
    """
    try:
        import re
        
        # First, try to find FORM_UPDATE: {json} pattern
        form_update_pattern = r'FORM_UPDATE:\s*(\{[^}]*\})'
        match = re.search(form_update_pattern, ai_response)
        
        if match:
            json_str = match.group(1)
            clean_response = re.sub(form_update_pattern, '', ai_response).strip()
            form_updates = json.loads(json_str)
            logger.info(f"Parsed FORM_UPDATE pattern: {form_updates}")
            return form_updates, clean_response
        
        # If no FORM_UPDATE found, look for JSON code blocks
        json_block_pattern = r'```json\s*(\{.*?\})\s*```'
        match = re.search(json_block_pattern, ai_response, re.DOTALL)
        
        if match:
            json_str = match.group(1).strip()
            clean_response = re.sub(json_block_pattern, '', ai_response, flags=re.DOTALL).strip()
            form_updates = json.loads(json_str)
            logger.info(f"Parsed JSON code block: {form_updates}")
            return form_updates, clean_response
        
        # Look for any JSON object in the response (fallback)
        json_pattern = r'(\{[^{}]*"(?:doctor|appointment-[^"]*)"[^{}]*\})'
        match = re.search(json_pattern, ai_response)
        
        if match:
            json_str = match.group(1)
            form_updates = json.loads(json_str)
            logger.info(f"Parsed fallback JSON: {form_updates}")
            return form_updates, ai_response
        
        return None, ai_response
        
    except Exception as e:
        logger.warning(f"Error parsing form updates: {e}")
        return None, ai_response

def fetch_patient_data(patient_id):
    """
    Fetch patient data from the patient API with caching
    """
    # Check cache first
    cache_key = f"patient_{patient_id}"
    now = datetime.now()
    
    if cache_key in patient_cache:
        cache_entry = patient_cache[cache_key]
        cache_time = cache_entry['timestamp']
        
        # Check if cache is still valid
        if now - cache_time < timedelta(minutes=CACHE_EXPIRY_MINUTES):
            logger.info(f"Using cached patient data for ID: {patient_id}")
            return cache_entry['data']
        else:
            # Cache expired, remove it
            logger.info(f"Cache expired for patient ID: {patient_id}")
            del patient_cache[cache_key]
    
    # Cache miss or expired, fetch from API
    try:
        url = f"{PATIENT_API_URL}/patient/{patient_id}"
        logger.info(f"Fetching patient data from API: {url}")
        
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        
        patient_data = response.json()
        
        # Cache the data
        patient_cache[cache_key] = {
            'data': patient_data,
            'timestamp': now
        }
        
        logger.info(f"Successfully fetched and cached patient data for ID: {patient_id}")
        return patient_data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch patient data for ID {patient_id}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error processing patient data for ID {patient_id}: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    logger.info("ChatGPT service health check")
    return jsonify({
        "status": "healthy", 
        "service": "chatgpt_service",
        "patient_api": PATIENT_API_URL,
        "ai_initialized": ai_service is not None,
        "cache_stats": {
            "cached_patients": len(patient_cache),
            "cache_expiry_minutes": CACHE_EXPIRY_MINUTES
        }
    })

@app.route('/chat', methods=['POST'])
def chat_with_assistant():
    """
    Main chat endpoint for care coordinator assistant
    Expected payload:
    {
        "patient_id": "1",
        "message": "What providers are available?",
        "conversation_history": [...]  # optional
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        user_message = data.get('message', '').strip()
        patient_id = data.get('patient_id')
        conversation_history = data.get('conversation_history', [])
        
        # Validate required fields
        if not user_message:
            return jsonify({"error": "Message is required"}), 400
        
        if not patient_id:
            return jsonify({"error": "Patient ID is required"}), 400
        
        logger.info(f"Processing message for patient {patient_id}: {user_message}")
        
        # Fetch patient data from API
        patient_data = fetch_patient_data(patient_id)
        if not patient_data:
            return jsonify({
                "error": f"Could not fetch patient data for ID: {patient_id}"
            }), 404
        
        # Use AI service to generate response
        ai_result = ai_service.ask_question(
            patient_record=patient_data,
            data_sheet_path=data_sheet_path,
            question=user_message,
            conversation_history=conversation_history
        )
        
        if 'error' in ai_result:
            logger.error(f"AI service error: {ai_result['error']}")
            return jsonify({
                "error": "AI service unavailable",
                "details": ai_result['error']
            }), 503
        
        logger.info(f"Generated AI response for patient {patient_id}")
        
        # Parse form updates from AI response
        form_updates, clean_response = parse_form_updates(ai_result['response'])
        
        response_data = {
            "response": clean_response,
            "timestamp": ai_result['timestamp'],
            "patient_id": patient_id,
            "model": ai_result.get('model'),
            "tokens_used": ai_result.get('tokens_used')
        }
        
        # Add form updates if present
        if form_updates:
            response_data["form_updates"] = form_updates
            logger.info(f"Form updates extracted: {form_updates}")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/conversation/start', methods=['POST'])
def start_conversation():
    """
    Initialize a new conversation for a patient
    Expected payload: {"patient_id": "1"}
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        patient_id = data.get('patient_id')
        if not patient_id:
            return jsonify({"error": "Patient ID is required"}), 400
        
        logger.info(f"Starting new conversation for patient {patient_id}")
        
        # Fetch patient data to validate patient exists
        patient_data = fetch_patient_data(patient_id)
        if not patient_data:
            return jsonify({
                "error": f"Patient not found: {patient_id}"
            }), 404
        
        # Generate welcome message using AI
        welcome_result = ai_service.start_conversation(
            patient_record=patient_data,
            data_sheet_path=data_sheet_path
        )
        
        conversation_id = f"conv_{patient_id}_{int(datetime.now().timestamp())}"
        
        return jsonify({
            "conversation_id": conversation_id,
            "patient_id": patient_id,
            "patient_name": patient_data.get('name', 'Unknown'),
            "message": welcome_result.get('response', 'How can I help you with this patient\'s care coordination?'),
            "timestamp": welcome_result.get('timestamp', datetime.now().isoformat())
        })
        
    except Exception as e:
        logger.error(f"Error starting conversation: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/patient/<patient_id>/summary', methods=['GET'])
def get_patient_summary():
    """
    Get a care coordination summary for a patient
    """
    try:
        logger.info(f"Generating summary for patient {patient_id}")
        
        # Fetch patient data
        patient_data = fetch_patient_data(patient_id)
        if not patient_data:
            return jsonify({
                "error": f"Patient not found: {patient_id}"
            }), 404
        
        # Generate summary using AI
        summary_question = "Please provide a brief care coordination summary for this patient, including recent appointments, referrals, and any scheduling considerations."
        
        ai_result = ai_service.ask_question(
            patient_record=patient_data,
            data_sheet_path=data_sheet_path,
            question=summary_question
        )
        
        if 'error' in ai_result:
            return jsonify({
                "error": "AI service unavailable",
                "details": ai_result['error']
            }), 503
        
        return jsonify({
            "patient_id": patient_id,
            "summary": ai_result['response'],
            "timestamp": ai_result['timestamp']
        })
        
    except Exception as e:
        logger.error(f"Error generating patient summary: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """
    Clear the patient data cache
    """
    try:
        cache_size = len(patient_cache)
        patient_cache.clear()
        logger.info(f"Cleared patient cache ({cache_size} entries)")
        
        return jsonify({
            "status": "cache_cleared",
            "entries_cleared": cache_size,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/cache/stats', methods=['GET'])
def cache_stats():
    """
    Get detailed cache statistics
    """
    try:
        now = datetime.now()
        cache_details = {}
        
        for key, entry in patient_cache.items():
            age_minutes = (now - entry['timestamp']).total_seconds() / 60
            cache_details[key] = {
                "age_minutes": round(age_minutes, 2),
                "expires_in_minutes": round(CACHE_EXPIRY_MINUTES - age_minutes, 2),
                "patient_name": entry['data'].get('name', 'Unknown')
            }
        
        return jsonify({
            "cache_expiry_minutes": CACHE_EXPIRY_MINUTES,
            "total_entries": len(patient_cache),
            "entries": cache_details,
            "timestamp": now.isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

if __name__ == '__main__':
    logger.info("Starting ChatGPT Service on port 5001")
    app.run(debug=True, host='0.0.0.0', port=5001)