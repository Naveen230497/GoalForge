// Common utilities

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    
    const bgColors = {
        'success': 'border-l-emerald-500',
        'error': 'border-l-rose-500',
        'info': 'border-l-blue-500',
        'warning': 'border-l-amber-500'
    };
    const borderColor = bgColors[type] || bgColors.info;
    
    toast.className = `glass-panel text-white px-6 py-4 rounded-xl shadow-2xl text-sm font-medium border-l-4 ${borderColor} transform transition-all duration-300 translate-y-full opacity-0 flex items-center gap-3`;
    toast.innerHTML = escapeHtml(message);
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-full', 'opacity-0');
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function enableBrowserPush() {
    if (!('Notification' in window)) {
        showToast('Browser does not support notifications.', 'error');
        return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        showToast('Push notifications enabled!', 'success');
        document.getElementById('toggleBrowserPush').textContent = 'Enabled';
        document.getElementById('toggleBrowserPush').classList.replace('text-blue-400', 'text-emerald-400');
        new Notification('GoalForge', { body: 'Notifications are now enabled! We will remind you about pending goals.' });
    } else {
        showToast('Permission denied.', 'error');
    }
}

async function testEmailNotification() {
    const btn = document.getElementById('testEmailBtn');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    try {
        const data = await apiCall('/api/notify/email', {
            method: 'POST',
            body: JSON.stringify({
                subject: 'GoalForge Test Notification',
                body: 'This is a test notification from GoalForge to confirm your email reminders are working perfectly!'
            })
        });
        showToast(data.status || 'Email sent!', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.textContent = 'Test Email';
        btn.disabled = false;
    }
}

let recognition;
let isRecording = false;

function toggleVoiceInput() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        showToast('Voice input is not supported in this browser.', 'error');
        return;
    }
    
    if (isRecording) {
        if (recognition) recognition.stop();
        return;
    }

    if (!recognition) {
        recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = true;
    }

    const micBtn = document.getElementById('micBtn');
    const input = document.getElementById('goalInput');

    recognition.onstart = function() {
        isRecording = true;
        micBtn.classList.add('text-rose-500', 'animate-pulse');
        micBtn.classList.remove('text-gray-400');
        input.placeholder = 'Listening...';
    };

    recognition.onresult = function(event) {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript) {
            input.value = finalTranscript;
        }
    };

    recognition.onerror = function(event) {
        showToast('Microphone error: ' + event.error, 'error');
        stopRecordingUI();
    };

    recognition.onend = function() {
        stopRecordingUI();
    };

    recognition.start();

    function stopRecordingUI() {
        isRecording = false;
        micBtn.classList.remove('text-rose-500', 'animate-pulse');
        micBtn.classList.add('text-gray-400');
        input.placeholder = 'What do you want to achieve?';
    }
}

async function enhanceGoalInput() {
    const input = document.getElementById('goalInput');
    const magicBtn = document.getElementById('magicBtn');
    const text = input.value.trim();
    if (!text) {
        showToast('Type a vague goal first, then click Magic Enhance!', 'warning');
        return;
    }

    magicBtn.disabled = true;
    magicBtn.classList.add('animate-spin', 'text-purple-400');
    try {
        const data = await apiCall('/api/enhance', {
            method: 'POST',
            body: JSON.stringify({ text })
        });
        if (data.enhanced) {
            input.value = data.enhanced;
            // Add a brief glow effect
            input.classList.add('text-purple-300');
            setTimeout(() => input.classList.remove('text-purple-300'), 1000);
        }
    } catch (e) {
        showToast('Enhance failed: ' + e.message, 'error');
    } finally {
        magicBtn.disabled = false;
        magicBtn.classList.remove('animate-spin', 'text-purple-400');
    }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
