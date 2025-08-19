// Care Coordinator Assistant Frontend Script

class CareCoordinatorApp {
    constructor() {
        this.currentPatient = null;
        this.conversationHistory = [];
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
            // TODO: Replace with actual API call to flask-app.py
            const response = await this.mockPatientAPI(patientId);
            
            if (response.error) {
                this.showError(response.error);
                return;
            }

            this.currentPatient = response;
            this.displayPatientInfo(response);
            this.enableChatInterface();
            this.logActivity(`Patient loaded successfully: ${response.name}`);

        } catch (error) {
            this.logActivity(`Error loading patient: ${error.message}`);
            this.showError('Failed to load patient data');
        }
    }

    async mockPatientAPI(patientId) {
        // Mock API response - TODO: Replace with actual fetch to flask-app.py
        this.logActivity(`Mock API call for patient ${patientId}`);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                if (patientId === '1') {
                    resolve({
                        id: 1,
                        name: "John Doe",
                        dob: "01/01/1975",
                        pcp: "Dr. Meredith Grey",
                        ehrId: "1234abcd",
                        referred_providers: [
                            {"provider": "House, Gregory MD", "specialty": "Orthopedics"},
                            {"specialty": "Primary Care"}
                        ],
                        appointments: [
                            {"date": "3/05/18", "time": "9:15am", "provider": "Dr. Meredith Grey", "status": "completed"},
                            {"date": "8/12/24", "time": "2:30pm", "provider": "Dr. Gregory House", "status": "completed"},
                            {"date": "9/17/24", "time": "10:00am", "provider": "Dr. Meredith Grey", "status": "noshow"},
                            {"date": "11/25/24", "time": "11:30am", "provider": "Dr. Meredith Grey", "status": "cancelled"}
                        ]
                    });
                } else {
                    resolve({error: "Patient not found"});
                }
            }, 500);
        });
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

        // Add welcome message
        this.addMessage('assistant', `Patient ${this.currentPatient.name} loaded. How can I help you coordinate their care?`);
        
        this.logActivity('Chat interface enabled');
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        this.addMessage('user', message);
        input.value = '';
        
        this.logActivity(`User message sent: ${message}`);

        try {
            // TODO: Replace with actual API call to chatgpt_service.py
            const response = await this.mockChatAPI(message);
            this.addMessage('assistant', response.response);
            
            this.logActivity(`Assistant response received: ${response.response}`);
            
        } catch (error) {
            this.logActivity(`Error in chat: ${error.message}`);
            this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        }
    }

    async mockChatAPI(message) {
        // Mock ChatGPT API response - TODO: Replace with actual fetch to chatgpt_service.py
        this.logActivity(`Mock ChatGPT API call with message: ${message}`);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    response: `I received your message: "${message}". This is a mock response. To book an appointment for ${this.currentPatient?.name || 'the patient'}, I need to know the provider, appointment type, and location. How can I help you with that?`,
                    timestamp: new Date().toISOString()
                });
            }, 1000);
        });
    }

    addMessage(sender, content) {
        const messagesDiv = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.innerHTML = `<strong>${sender === 'user' ? 'Nurse' : 'Assistant'}:</strong> ${content}`;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // Update conversation history
        this.conversationHistory.push({
            role: sender === 'user' ? 'user' : 'assistant',
            content: content,
            timestamp: new Date().toISOString()
        });
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
                this.addMessage('assistant', `Great! I've successfully booked a ${formData.appointmentType} appointment for ${formData.firstName} ${formData.lastName} with ${formData.doctor} at ${formData.location} on ${formData.date} at ${formData.time} for ${formData.duration} minutes.`);
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
            duration: document.getElementById('appointment-length').value,
            doctor: document.getElementById('doctor').value,
            appointmentType: document.getElementById('appointment-type').value,
            location: document.getElementById('appointment-location').value,
            date: document.getElementById('appointment-date').value,
            time: document.getElementById('appointment-time').value
        };
    }

    validateAppointmentForm(data) {
        const required = ['firstName', 'lastName', 'dob', 'duration', 'doctor', 'appointmentType', 'location', 'date', 'time'];
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