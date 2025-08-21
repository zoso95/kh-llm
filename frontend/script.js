// Care Coordinator Assistant Frontend Script

class CareCoordinatorApp {
    constructor() {
        this.currentPatient = null;
        this.conversationHistory = [];
        this.conversationId = null;
        this.chatServiceUrl = 'http://localhost:5001'; // ChatGPT service URL
        this.patientApiUrl = 'http://localhost:5000'; // Patient API URL
        this.initializeEventListeners();
        this.logActivity('Application initialized');
    }

    initializeEventListeners() {
        // Patient loading
        document.getElementById('load-patient-btn').addEventListener('click', () => {
            this.loadPatient();
        });

        document.getElementById('patient-id').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadPatient();
            }
        });

        // Chat functionality
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });

        // Appointment booking form
        document.getElementById('appointment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.bookAppointment();
        });

        document.getElementById('clear-form-btn').addEventListener('click', () => {
            this.clearAppointmentForm();
        });

        // Doctor selection change handler for smart defaults
        document.getElementById('doctor').addEventListener('change', () => {
            this.handleDoctorSelection();
        });

        this.logActivity('Event listeners initialized');
    }

    async loadPatient() {
        const patientId = document.getElementById('patient-id').value.trim();
        
        if (!patientId) {
            this.showError('Please enter a patient ID');
            return;
        }

        this.logActivity(`Loading patient with ID: ${patientId}`);
        
        try {
            // Load patient from real API
            const response = await this.loadPatientFromAPI(patientId);
            
            if (response.error) {
                this.showError(response.error);
                return;
            }

            this.currentPatient = response;
            this.displayPatientInfo(response);
            this.clearChatMessages();
            await this.initializeConversation(patientId);
            this.enableChatInterface();
            this.logActivity(`Patient loaded successfully: ${response.name}`);

        } catch (error) {
            this.logActivity(`Error loading patient: ${error.message}`);
            this.showError('Failed to load patient data');
        }
    }

    async loadPatientFromAPI(patientId) {
        // Call real patient API
        this.logActivity(`Loading patient ${patientId} from API`);
        
        try {
            const response = await fetch(`${this.patientApiUrl}/patient/${patientId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { error: "Patient not found" };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const patientData = await response.json();
            this.logActivity(`Successfully loaded patient: ${patientData.name}`);
            return patientData;
            
        } catch (error) {
            this.logActivity(`Error loading patient: ${error.message}`);
            return { error: `Failed to load patient: ${error.message}` };
        }
    }

    displayPatientInfo(patient) {
        const patientInfoDiv = document.getElementById('patient-info');
        patientInfoDiv.innerHTML = `
            <h3>Patient Information</h3>
            <p><strong>Name:</strong> ${patient.name}</p>
            <p><strong>DOB:</strong> ${patient.dob}</p>
            <p><strong>PCP:</strong> ${patient.pcp}</p>
            <p><strong>EHR ID:</strong> ${patient.ehrId}</p>
            <p><strong>Referrals:</strong> ${patient.referred_providers.map(r => r.specialty).join(', ')}</p>
        `;
        patientInfoDiv.classList.remove('hidden');
        
        this.logActivity(`Patient info displayed for ${patient.name}`);
    }

    clearChatMessages() {
        const messagesDiv = document.getElementById('chat-messages');
        messagesDiv.innerHTML = '';
        this.conversationHistory = [];
        this.conversationId = null;
        this.logActivity('Chat messages cleared');
    }

    async initializeConversation(patientId) {
        try {
            this.logActivity(`Initializing conversation for patient ${patientId}`);
            
            const response = await fetch(`${this.chatServiceUrl}/conversation/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ patient_id: patientId })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.conversationId = data.conversation_id;
            this.conversationHistory = []; // Reset for new patient
            
            // Add AI welcome message
            this.addMessage('assistant', data.message);
            
            this.logActivity(`Conversation initialized: ${this.conversationId}`);
            
        } catch (error) {
            this.logActivity(`Error initializing conversation: ${error.message}`);
            // Fall back to default welcome message
            this.addMessage('assistant', `Patient ${this.currentPatient.name} loaded. How can I help you coordinate their care? (Note: AI service may be unavailable)`);
        }
    }

    enableChatInterface() {
        document.getElementById('chat-input').disabled = false;
        document.getElementById('send-btn').disabled = false;
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.disabled = false;
        });

        // Enable appointment booking form
        document.getElementById('book-appointment-btn').disabled = false;
        
        // Pre-fill patient info if available
        if (this.currentPatient) {
            this.prefillPatientInfo();
        }
        
        this.logActivity('Chat interface enabled');
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        if (!this.currentPatient) {
            this.showError('Please load a patient first');
            return;
        }

        this.addMessage('user', message);
        input.value = '';
        
        // Show typing indicator
        const typingId = this.showTypingIndicator();
        
        this.logActivity(`User message sent: ${message}`);

        try {
            const response = await this.sendChatMessage(message);
            this.removeTypingIndicator(typingId);
            
            if (response.error) {
                this.addMessage('assistant', `Sorry, I encountered an error: ${response.error}`);
            } else {
                this.addMessage('assistant', response.response);
                this.logActivity(`Assistant response received (${response.tokens_used || 'unknown'} tokens)`);
            }
            
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.logActivity(`Error in chat: ${error.message}`);
            this.addMessage('assistant', 'Sorry, I encountered a connection error. Please try again.');
        }
    }

    async sendChatMessage(message) {
        this.logActivity(`Sending message to ChatGPT service: ${message}`);
        
        try {
            const response = await fetch(`${this.chatServiceUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    patient_id: this.currentPatient.id.toString(),
                    message: message,
                    conversation_history: this.conversationHistory
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.logActivity(`ChatGPT service response received`);
            return data;
            
        } catch (error) {
            this.logActivity(`Error calling ChatGPT service: ${error.message}`);
            return { error: error.message };
        }
    }

    showTypingIndicator() {
        const messagesDiv = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        const typingId = `typing-${Date.now()}`;
        
        typingDiv.id = typingId;
        typingDiv.className = 'message assistant-message typing-indicator';
        typingDiv.innerHTML = '<strong>Assistant:</strong> <span class="typing-dots">●●●</span>';
        
        messagesDiv.appendChild(typingDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        return typingId;
    }

    removeTypingIndicator(typingId) {
        const typingDiv = document.getElementById(typingId);
        if (typingDiv) {
            typingDiv.remove();
        }
    }

    addMessage(sender, content) {
        const messagesDiv = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.innerHTML = `<strong>${sender === 'user' ? 'Nurse' : 'Assistant'}:</strong> ${content}`;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // Update conversation history (only for actual chat messages, not system messages)
        if (this.currentPatient && this.conversationId) {
            this.conversationHistory.push({
                role: sender === 'user' ? 'user' : 'assistant',
                content: content
            });
        }
    }

    handleQuickAction(action) {
        this.logActivity(`Quick action triggered: ${action}`);
        
        const actionMessages = {
            'providers': 'Show me available providers for this patient',
            'insurance': 'What insurance does this patient have and what do we accept?',
            'history': 'Show me this patient\'s appointment history',
            'book': 'I need to book an appointment for this patient'
        };

        const message = actionMessages[action];
        if (message) {
            document.getElementById('chat-input').value = message;
            this.sendMessage();
        }
    }

    showError(message) {
        this.logActivity(`Error displayed: ${message}`);
        alert(message); // TODO: Replace with better error display
    }

    prefillPatientInfo() {
        if (this.currentPatient) {
            const [firstName, lastName] = this.currentPatient.name.split(' ');
            document.getElementById('first-name').value = firstName || '';
            document.getElementById('last-name').value = lastName || '';
            
            // Convert DOB from MM/DD/YYYY to YYYY-MM-DD for date input
            const dob = this.currentPatient.dob;
            if (dob) {
                const [month, day, year] = dob.split('/');
                document.getElementById('dob').value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            this.logActivity('Patient info pre-filled in appointment form');
        }
    }

    async bookAppointment() {
        const formData = this.getAppointmentFormData();
        
        if (!this.validateAppointmentForm(formData)) {
            return;
        }

        this.logActivity(`Booking appointment: ${JSON.stringify(formData)}`);

        try {
            // TODO: Replace with actual API call to backend
            const response = await this.mockBookingAPI(formData);
            
            if (response.success) {
                this.showSuccessMessage(`Appointment booked successfully! Appointment ID: ${response.appointmentId}`);
                this.addMessage('assistant', `Great! I've successfully booked a ${formData.appointmentType} appointment for ${formData.firstName} ${formData.lastName} with ${formData.doctor} at ${formData.location} on ${formData.date} at ${formData.time} for ${formData.appointmentType} minutes.`);
                this.clearAppointmentForm();
            } else {
                this.showError(response.error || 'Failed to book appointment');
            }

        } catch (error) {
            this.logActivity(`Error booking appointment: ${error.message}`);
            this.showError('Failed to book appointment. Please try again.');
        }
    }

    getAppointmentFormData() {
        return {
            firstName: document.getElementById('first-name').value.trim(),
            lastName: document.getElementById('last-name').value.trim(),
            dob: document.getElementById('dob').value,
            doctor: document.getElementById('doctor').value,
            appointmentType: document.getElementById('appointment-type').value,
            location: document.getElementById('appointment-location').value,
            date: document.getElementById('appointment-date').value,
            time: document.getElementById('appointment-time').value
        };
    }

    validateAppointmentForm(data) {
        const required = ['firstName', 'lastName', 'dob', 'doctor', 'appointmentType', 'location', 'date', 'time'];
        const missing = required.filter(field => !data[field]);
        
        if (missing.length > 0) {
            this.showError(`Please fill in all required fields: ${missing.join(', ')}`);
            return false;
        }

        // Validate appointment date is not in the past
        const appointmentDate = new Date(data.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (appointmentDate < today) {
            this.showError('Appointment date cannot be in the past');
            return false;
        }

        return true;
    }

    async mockBookingAPI(appointmentData) {
        // Mock booking API - TODO: Replace with actual backend call
        this.logActivity(`Mock booking API call: ${JSON.stringify(appointmentData)}`);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate success/failure
                const success = Math.random() > 0.1; // 90% success rate
                
                if (success) {
                    resolve({
                        success: true,
                        appointmentId: `APT-${Date.now()}`,
                        message: 'Appointment booked successfully'
                    });
                } else {
                    resolve({
                        success: false,
                        error: 'Doctor not available at selected time'
                    });
                }
            }, 1000);
        });
    }

    clearAppointmentForm() {
        document.getElementById('appointment-form').reset();
        this.logActivity('Appointment form cleared');
    }

    showSuccessMessage(message) {
        this.logActivity(`Success message: ${message}`);
        // TODO: Replace with better success display
        alert(message);
    }

    handleDoctorSelection() {
        const doctorSelect = document.getElementById('doctor');
        const selectedDoctor = doctorSelect.value;
        
        if (!selectedDoctor) {
            return;
        }

        this.logActivity(`Doctor selected: ${selectedDoctor}`);

        // Auto-set appointment type based on patient history
        this.autoSetAppointmentType(selectedDoctor);
        
        // Auto-set location based on doctor
        this.autoSetLocation(selectedDoctor);
    }

    autoSetAppointmentType(doctorName) {
        const appointmentTypeSelect = document.getElementById('appointment-type');
        
        if (!this.currentPatient) {
            return;
        }

        // Check if patient has seen this doctor before within 5 years
        const hasSeenDoctor = this.currentPatient.appointments?.some(apt => {
            const aptDate = new Date(apt.date);
            const fiveYearsAgo = new Date();
            fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
            
            return apt.provider.includes(doctorName.split(',')[0]) && aptDate >= fiveYearsAgo;
        });

        if (hasSeenDoctor) {
            appointmentTypeSelect.value = 'ESTABLISHED';
            document.getElementById('appointment-length').value = '15';
        } else {
            appointmentTypeSelect.value = 'NEW';
            document.getElementById('appointment-length').value = '30';
        }

        this.logActivity(`Auto-set appointment type: ${appointmentTypeSelect.value} based on patient history`);
    }

    autoSetLocation(doctorName) {
        const locationSelect = document.getElementById('appointment-location');
        
        // Map doctors to their primary locations based on data sheet
        const doctorLocationMap = {
            'Grey, Meredith': 'Sloan Primary Care',
            'House, Gregory': 'PPTH Orthopedics',
            'Yang, Cristina': 'Seattle Grace Cardiac Surgery',
            'Perry, Chris': 'Sacred Heart Surgical Department',
            'Brennan, Temperance': 'Jefferson Hospital'
        };

        const location = doctorLocationMap[doctorName];
        if (location) {
            locationSelect.value = location;
            this.logActivity(`Auto-set location: ${location} for doctor ${doctorName}`);
        }
    }

    logActivity(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
        
        // TODO: Send logs to backend for monitoring
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.careCoordinatorApp = new CareCoordinatorApp();
});