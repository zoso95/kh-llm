// Care Coordinator Assistant Frontend Script

class CareCoordinatorApp {
    constructor() {
        this.currentPatient = null;
        this.conversationHistory = [];
        this.conversationId = null;
        this.chatServiceUrl = 'http://localhost:5001'; // ChatGPT service URL
        this.patientApiUrl = 'http://localhost:5000'; // Patient API URL
        
        // Doctor availability data from data sheet
        this.doctorAvailability = {
            'Grey, Meredith': {
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], // M-F
                hours: { start: '09:00', end: '17:00' },
                location: 'Sloan Primary Care'
            },
            'House, Gregory': {
                schedule: [
                    {
                        days: ['monday', 'tuesday', 'wednesday'], // M-W at PPTH
                        hours: { start: '09:00', end: '17:00' },
                        location: 'PPTH Orthopedics'
                    },
                    {
                        days: ['thursday', 'friday'], // Th-F at Jefferson
                        hours: { start: '09:00', end: '17:00' },
                        location: 'Jefferson Hospital'
                    }
                ],
                // Combined days for easy access
                get days() {
                    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
                }
            },
            'Yang, Cristina': {
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], // M-F
                hours: { start: '09:00', end: '17:00' },
                location: 'Seattle Grace Cardiac Surgery'
            },
            'Perry, Chris': {
                days: ['monday', 'tuesday', 'wednesday'], // M-W
                hours: { start: '09:00', end: '17:00' },
                location: 'Sacred Heart Surgical Department'
            },
            'Brennan, Temperance': {
                days: ['tuesday', 'wednesday', 'thursday'], // Tu-Th
                hours: { start: '10:00', end: '16:00' },
                location: 'Jefferson Hospital'
            }
        };
        
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

        // Date selection change handler for time slots
        document.getElementById('appointment-date').addEventListener('change', () => {
            this.handleDateSelection();
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
            
            this.logActivity(`Raw response object: ${JSON.stringify(response)}`);
            
            if (response.error) {
                this.addMessage('assistant', `Sorry, I encountered an error: ${response.error}`);
            } else {
                this.addMessage('assistant', response.response);
                this.logActivity(`Assistant response received (${response.tokens_used || 'unknown'} tokens)`);
                
                // Handle form updates from AI
                if (response.form_updates) {
                    this.logActivity(`Form updates detected: ${JSON.stringify(response.form_updates)}`);
                    this.updateAppointmentForm(response.form_updates);
                } else {
                    this.logActivity("No form updates found in response");
                }
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
            this.logActivity(`Response has form_updates: ${!!data.form_updates}`);
            if (data.form_updates) {
                this.logActivity(`Form updates in response: ${JSON.stringify(data.form_updates)}`);
            }
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
                var duration = "15";
                if(formData.appointmentType === 'NEW'){
                    duration = "30";
                }
                this.addMessage('assistant', `Great! I've successfully booked a ${formData.appointmentType} appointment for ${formData.firstName} ${formData.lastName} with ${formData.doctor} at ${formData.location} on ${formData.date} at ${formData.time} for ${duration} minutes.`);
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
        
        // Reset disabled states
        document.getElementById('appointment-date').disabled = true;
        document.getElementById('appointment-time').disabled = true;
        document.getElementById('appointment-time').innerHTML = '<option value="">Select time</option>';
        
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
        const dateInput = document.getElementById('appointment-date');
        const timeSelect = document.getElementById('appointment-time');
        
        if (!selectedDoctor) {
            // Reset if no doctor selected
            dateInput.disabled = true;
            timeSelect.disabled = true;
            dateInput.value = '';
            timeSelect.innerHTML = '<option value="">Select time</option>';
            return;
        }

        this.logActivity(`Doctor selected: ${selectedDoctor}`);

        // Auto-set appointment type based on patient history
        this.autoSetAppointmentType(selectedDoctor);
        
        // Auto-set location based on doctor
        this.autoSetLocation(selectedDoctor);
        
        // Enable and set up date restrictions
        this.setupDateRestrictions(selectedDoctor);
        
        // Enable date picker
        dateInput.disabled = false;
        
        // Reset time dropdown
        timeSelect.innerHTML = '<option value="">Select a date first</option>';
        timeSelect.disabled = true;
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
        } else {
            appointmentTypeSelect.value = 'NEW';
        }

        this.logActivity(`Auto-set appointment type: ${appointmentTypeSelect.value} based on patient history`);
    }

    autoSetLocation(doctorName) {
        const locationSelect = document.getElementById('appointment-location');
        
        // Handle Gregory House's split schedule - don't auto-set location
        if (doctorName === 'House, Gregory') {
            locationSelect.value = ''; // Clear selection
            this.logActivity(`Location not auto-set for ${doctorName} due to split schedule`);
            return;
        }
        
        // Map other doctors to their primary locations
        const doctorLocationMap = {
            'Grey, Meredith': 'Sloan Primary Care',
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

    setupDateRestrictions(doctorName) {
        const dateInput = document.getElementById('appointment-date');
        const availability = this.doctorAvailability[doctorName];
        
        if (!availability) {
            this.logActivity(`No availability data for doctor: ${doctorName}`);
            return;
        }

        // Set minimum date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.min = tomorrow.toISOString().split('T')[0];

        // Set maximum date to 3 months from now
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3);
        dateInput.max = maxDate.toISOString().split('T')[0];

        // Add custom validation for available days
        this.addDateValidation(dateInput, availability.days);

        // Update help text to show available days and suggest next available date
        const helpText = dateInput.parentNode.querySelector('.help-text');
        if (helpText) {
            const nextAvailable = this.getNextAvailableDate(availability.days);
            helpText.innerHTML = `Available: ${availability.days.map(day => 
                day.charAt(0).toUpperCase() + day.slice(1)
            ).join(', ')}<br><small>Next available: ${nextAvailable}</small>`;
        }

        this.logActivity(`Date restrictions set for ${doctorName}: available ${availability.days.join(', ')}`);
    }

    addDateValidation(dateInput, availableDays) {
        // Remove existing validation
        dateInput.removeEventListener('input', this.validateDate);
        
        // Add new validation
        this.validateDate = (event) => {
            const selectedDate = new Date(event.target.value);
            const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            
            if (!availableDays.includes(dayName)) {
                event.target.setCustomValidity(`Doctor not available on ${dayName}s`);
                event.target.style.borderColor = '#e53e3e';
                event.target.style.backgroundColor = '#fed7d7';
            } else {
                event.target.setCustomValidity('');
                event.target.style.borderColor = '#38b2ac';
                event.target.style.backgroundColor = '#e6fffa';
            }
        };
        
        dateInput.addEventListener('input', this.validateDate);
    }

    handleDateSelection() {
        const doctorSelect = document.getElementById('doctor');
        const dateInput = document.getElementById('appointment-date');
        const timeSelect = document.getElementById('appointment-time');
        const locationSelect = document.getElementById('appointment-location');
        
        const selectedDoctor = doctorSelect.value;
        const selectedDate = dateInput.value;
        
        if (!selectedDoctor || !selectedDate) {
            return;
        }

        // Check if selected date is valid for this doctor
        const selectedDateObj = new Date(selectedDate);
        const dayName = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        const availability = this.doctorAvailability[selectedDoctor];
        
        if (!availability.days.includes(dayName)) {
            this.showError(`${selectedDoctor} is not available on ${dayName}s. Available days: ${availability.days.join(', ')}`);
            dateInput.value = '';
            timeSelect.disabled = true;
            return;
        }

        this.logActivity(`Valid date selected for ${selectedDoctor}: ${selectedDate} (${dayName})`);
        
        // Handle Gregory House's split schedule location setting
        if (selectedDoctor === 'House, Gregory') {
            const houseAvailability = this.doctorAvailability[selectedDoctor];
            const scheduleForDay = houseAvailability.schedule.find(s => s.days.includes(dayName));
            
            if (scheduleForDay) {
                locationSelect.value = scheduleForDay.location;
                this.logActivity(`Auto-set location for House on ${dayName}: ${scheduleForDay.location}`);
            }
        }
        
        // Generate time slots
        this.generateTimeSlots(selectedDoctor, dayName);
    }

    generateTimeSlots(doctorName, dayName) {
        const timeSelect = document.getElementById('appointment-time');
        const availability = this.doctorAvailability[doctorName];
        
        if (!availability) return;

        // Clear existing options
        timeSelect.innerHTML = '<option value="">Select time</option>';

        let hours;
        
        // Handle Gregory House's split schedule
        if (doctorName === 'House, Gregory' && dayName) {
            const scheduleForDay = availability.schedule.find(s => s.days.includes(dayName));
            hours = scheduleForDay ? scheduleForDay.hours : availability.schedule[0].hours;
        } else {
            hours = availability.hours || availability.schedule[0].hours;
        }

        // Generate time slots (30-minute intervals)
        const startTime = this.parseTime(hours.start);
        const endTime = this.parseTime(hours.end);
        
        const slots = [];
        let currentTime = startTime;
        
        while (currentTime < endTime) {
            const timeString = this.formatTime(currentTime);
            slots.push(timeString);
            currentTime += 30; // 30-minute intervals
        }

        // Add time slots to dropdown
        slots.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = slot;
            timeSelect.appendChild(option);
        });

        timeSelect.disabled = false;
        this.logActivity(`Generated ${slots.length} time slots for ${doctorName} (${hours.start}-${hours.end})`);
    }

    parseTime(timeString) {
        // Convert "09:00" to minutes since midnight
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    formatTime(minutes) {
        // Convert minutes since midnight to "09:00" format
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    getNextAvailableDate(availableDays) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Find the next available day
        for (let i = 0; i < 14; i++) { // Check next 2 weeks
            const checkDate = new Date(tomorrow);
            checkDate.setDate(tomorrow.getDate() + i);
            const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            
            if (availableDays.includes(dayName)) {
                return checkDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                });
            }
        }
        
        return 'Check calendar';
    }

    updateAppointmentForm(formUpdates) {
        this.logActivity(`Updating appointment form: ${JSON.stringify(formUpdates)}`);
        
        let updatedFields = [];
        let needsDoctorHandler = false;
        let needsDateHandler = false;
        
        // First pass: Update all field values without triggering handlers
        Object.entries(formUpdates).forEach(([field, value]) => {
            this.logActivity(`Trying to update field "${field}" with value "${value}"`);
            const element = document.getElementById(field);
            
            if (element) {
                this.logActivity(`Found element for field "${field}", current value: "${element.value}"`);
                
                // Handle special cases for different field types
                if (element.tagName === 'SELECT' && (field === 'appointment-location' || field === 'doctor')) {
                    const matchedOption = this.findMatchingOption(element, value);
                    if (matchedOption) {
                        element.value = matchedOption.value;
                        this.logActivity(`Fuzzy matched "${value}" to "${matchedOption.value}"`);
                    } else {
                        element.value = value; // Try exact match as fallback
                        this.logActivity(`No fuzzy match found, using exact value: "${value}"`);
                    }
                } else if (field === 'appointment-date') {
                    // Special handling for date fields
                    if (element.disabled) {
                        element.disabled = false;
                        this.logActivity('Enabled appointment-date field for AI update');
                    }
                    element.value = value;
                    this.logActivity(`Date field set to: "${element.value}", disabled: ${element.disabled}`);
                } else {
                    element.value = value;
                }
                
                // Enable time field if it's being set
                if (field === 'appointment-time' && element.disabled) {
                    element.disabled = false;
                    this.logActivity('Enabled appointment-time field for AI update');
                }
                
                updatedFields.push(field);
                this.logActivity(`Updated field "${field}" to "${element.value}"`);
                
                // Mark handlers needed but don't trigger yet
                if (field === 'doctor') {
                    needsDoctorHandler = true;
                } else if (field === 'appointment-date') {
                    needsDateHandler = true;
                }
                
                // Visual feedback - flash green
                const originalBg = element.style.backgroundColor || '';
                element.style.backgroundColor = '#c6f6d5';
                element.style.transition = 'background-color 0.3s ease';
                
                setTimeout(() => {
                    element.style.backgroundColor = originalBg;
                    setTimeout(() => {
                        element.style.transition = '';
                    }, 300);
                }, 1000);
            } else {
                this.logActivity(`ERROR: Form field not found: "${field}" - Available elements: ${Array.from(document.querySelectorAll('[id]')).map(el => el.id).join(', ')}`);
            }
        });
        
        // Second pass: Trigger handlers only if needed, after all values are set
        if (needsDoctorHandler && !formUpdates['appointment-location']) {
            // Only trigger doctor handler if location wasn't explicitly set by AI
            this.logActivity('Triggering doctor selection handler (no location override)');
            this.handleDoctorSelection();
        } else if (needsDoctorHandler) {
            this.logActivity('Skipping doctor selection handler - location was explicitly set by AI');
            // Still need to enable date field and set up restrictions
            const doctorSelect = document.getElementById('doctor');
            if (doctorSelect.value) {
                this.setupDateRestrictions(doctorSelect.value);
                document.getElementById('appointment-date').disabled = false;
            }
        }
        
        if (needsDateHandler) {
            this.logActivity('Triggering date selection handler');
            // Store the AI-set time value before date handler overwrites it
            const aiSetTime = formUpdates['appointment-time'];
            this.handleDateSelection();
            
            // Restore AI-set time after time slots are generated
            if (aiSetTime) {
                const timeElement = document.getElementById('appointment-time');
                if (timeElement) {
                    timeElement.value = aiSetTime;
                    this.logActivity(`Restored AI-set time: ${aiSetTime}`);
                }
            }
        }
        
        if (updatedFields.length > 0) {
            this.showFormUpdateNotification(updatedFields);
            this.logActivity(`Updated form fields: ${updatedFields.join(', ')}`);
        }
    }

    findMatchingOption(selectElement, searchValue) {
        // Try to find an option that contains the search value as a substring
        const options = Array.from(selectElement.options);
        
        // First try exact match
        let match = options.find(option => option.value === searchValue || option.textContent === searchValue);
        if (match) {
            this.logActivity(`Exact match found: "${searchValue}"`);
            return match;
        }
        
        // Then try case-insensitive exact match
        match = options.find(option => 
            option.value.toLowerCase() === searchValue.toLowerCase() || 
            option.textContent.toLowerCase() === searchValue.toLowerCase()
        );
        if (match) {
            this.logActivity(`Case-insensitive exact match found: "${searchValue}"`);
            return match;
        }
        
        // Then try substring match (AI value contained in option)
        match = options.find(option => 
            option.value.toLowerCase().includes(searchValue.toLowerCase()) || 
            option.textContent.toLowerCase().includes(searchValue.toLowerCase())
        );
        if (match) {
            this.logActivity(`Substring match found: "${searchValue}" in "${match.textContent}"`);
            return match;
        }
        
        // Finally try reverse substring (option contained in AI value)
        match = options.find(option => 
            searchValue.toLowerCase().includes(option.value.toLowerCase()) ||
            searchValue.toLowerCase().includes(option.textContent.toLowerCase())
        );
        if (match) {
            this.logActivity(`Reverse substring match found: "${match.textContent}" in "${searchValue}"`);
            return match;
        }
        
        this.logActivity(`No match found for: "${searchValue}" in options: ${options.map(o => o.textContent).join(', ')}`);
        return null;
    }

    showFormUpdateNotification(updatedFields) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = 'form-update-notification';
        notification.innerHTML = `
            <strong>✓ Form Updated:</strong> ${updatedFields.map(field => 
                field.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
            ).join(', ')}
        `;
        
        // Add to form
        const formElement = document.getElementById('appointment-form');
        formElement.insertBefore(notification, formElement.firstChild);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
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