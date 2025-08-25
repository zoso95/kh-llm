# Mini Care Coordinator Assistant

A take-home interview project that demonstrates a complete healthcare appointment booking system with AI-powered care coordination. The system includes a patient API, ChatGPT-integrated backend service, and an interactive frontend for nurses to manage patient appointments.

## Features

- **Patient Management**: Load and display patient information from EHR system
- **AI Care Coordinator**: ChatGPT-powered assistant for appointment booking guidance
- **Smart Scheduling**: Doctor availability constraints with split schedules
- **Chat-to-Form Integration**: AI can directly populate appointment forms
- **Real-time Validation**: Calendar highlighting and form validation
- **Responsive Design**: Mobile-friendly interface

## Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript with real-time chat interface
- **Backend**: Python Flask services with OpenAI API integration
- **Patient API**: Flask service providing patient data endpoints
- **ChatGPT Service**: Dedicated service for AI interactions and care coordination

## Setup Instructions

### 1. Environment Setup

First, copy the environment template and fill in your OpenAI API key:

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 2. Python Environment

Create and activate a Python virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Start the Patient API

In the first terminal:

```bash
source venv/bin/activate  # On Windows: venv\Scripts\activate
cd api
python flask-app.py
```

The patient API will run on `http://localhost:5000`

### 4. Start the ChatGPT Service

In a second terminal:

```bash
source venv/bin/activate  # On Windows: venv\Scripts\activate
cd backend
python chatgpt_service.py
```

The ChatGPT service will run on `http://localhost:5001`

### 5. Start the Frontend Server

In a third terminal:

```bash
source venv/bin/activate  # On Windows: venv\Scripts\activate
cd frontend
python -m http.server 3000
```

### 6. Access the Application

Open your web browser and navigate to:

**http://localhost:3000/**

## Usage

1. **Load a Patient**: Enter patient ID `1` to load John Doe
2. **Start Conversation**: Chat with the AI care coordinator
3. **Book Appointments**: Use natural language like "Book an appointment with Dr. House for next Tuesday at 2pm"
4. **Smart Features**: 
   - AI automatically populates appointment forms
   - Calendar shows available days for selected doctors
   - Split schedules handled (e.g., Dr. House works at different locations on different days)

## Project Structure

```
MLChallenge/
├── api/                    # Patient API service
│   └── flask-app.py
├── backend/                # ChatGPT service and AI logic
│   ├── chatgpt_service.py
│   ├── care_coordinator_ai.py
│   └── terminal_chat.py
├── frontend/               # Web interface
│   ├── index.html
│   ├── script.js
│   └── style.css
├── data_sheet.txt         # Hospital/provider data
├── requirements.txt       # Python dependencies
├── .env.example          # Environment template
└── README.md
```

## Key Technologies

- **Backend**: Python, Flask, OpenAI API, Flask-CORS
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **AI Integration**: OpenAI GPT models with structured prompts
- **Architecture**: Microservices with RESTful APIs

## Sample Interactions

- "Show me available providers for this patient"
- "Book an appointment with Dr. House for September 5th at 10am"
- "What insurance does this patient have?"
- "I need to schedule an orthopedics consultation"

The AI will guide you through the appointment booking process and automatically populate form fields based on the conversation.

## Development Notes

- Patient data is cached for 5 minutes to reduce API calls
- Form updates use fuzzy matching for location/doctor names
- Conversation history is maintained for context-aware responses
- Smart dependency handling prevents form conflicts during AI updates

---

**Note**: Make sure all three services are running simultaneously for full functionality.