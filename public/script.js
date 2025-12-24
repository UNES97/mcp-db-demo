const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const welcomeMessage = document.getElementById('welcomeMessage');

let conversationHistory = [];

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    sendButton.disabled = !this.value.trim();
});

// Check server status on load
async function checkServerStatus() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.status === 'ok') {
            statusDot.className = 'w-1.5 h-1.5 rounded-full bg-green-400';
            statusText.textContent = 'Connected';
            sendButton.disabled = false;
        }
    } catch (error) {
        statusDot.className = 'w-1.5 h-1.5 rounded-full bg-red-400';
        statusText.textContent = 'Connection Failed';
        console.error('Server connection failed:', error);
    }
}

// Format time
function formatTime() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Hide welcome message
function hideWelcomeMessage() {
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }
}

// Add message to UI
function addMessage(content, isUser = false) {
    // Hide welcome message when first message is sent
    hideWelcomeMessage();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'mb-4';

    if (isUser) {
        // User message - using APM navy gradient
        messageDiv.innerHTML = `
            <div class="flex justify-end">
                <div class="max-w-[85%] sm:max-w-3xl">
                    <div class="bg-gradient-to-br from-apm-500 to-apm-600 text-white rounded-2xl rounded-tr-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
                        <p class="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(content)}</p>
                        <div class="flex items-center gap-1.5 mt-1.5 sm:mt-2 text-xs text-white/70">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span>${formatTime()}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Assistant message
        messageDiv.innerHTML = `
            <div class="flex">
                <div class="max-w-[95%] sm:max-w-4xl">
                    <div class="flex gap-2 sm:gap-3">
                        <div class="flex-shrink-0">
                            <div class="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-br from-apm-500 to-apm-600 rounded-lg flex items-center justify-center shadow-sm">
                                <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
                                <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 text-xs">
                                    <span class="font-semibold text-apm-500 text-xs sm:text-sm">APM Operations</span>
                                    <span class="text-gray-400 hidden sm:inline">•</span>
                                    <span class="text-gray-500 hidden sm:inline">${formatTime()}</span>
                                </div>
                                <div class="prose prose-sm max-w-none text-gray-800 text-xs sm:text-sm">
                                    ${formatMessage(content)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
}

// Format message with markdown-like rendering
function formatMessage(text) {
    // Escape HTML first
    text = escapeHtml(text);

    // Convert newlines to <br>
    text = text.replace(/\n/g, '<br>');

    // Bold text **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');

    // Bullet points (lines starting with - or *)
    text = text.replace(/^[•\-\*]\s+(.+)$/gm, '<li class="ml-4">$1</li>');

    // Wrap consecutive <li> in <ul>
    text = text.replace(/(<li.*?<\/li>(?:<br>)?)+/g, '<ul class="list-disc space-y-1 my-2">$&</ul>');
    text = text.replace(/<\/li><br>/g, '</li>');

    // Highlight important metrics
    text = text.replace(/\b(\d+(?:\.\d+)?)\s*(CMPH|containers?|moves?|hours?|TEU|vessels?|days?)\b/gi,
        '<span class="inline-flex items-center px-2 py-0.5 bg-maersk-50 text-maersk-700 rounded font-medium text-sm">$1 $2</span>');

    // Highlight vessel names (all caps words)
    text = text.replace(/\b([A-Z]{3,}(?:\s+[A-Z]{3,})?)\b/g,
        '<span class="font-semibold text-apm-600">$1</span>');

    // Highlight status keywords
    text = text.replace(/\b(INBOUND|OPERATIONAL|COMPLETED|SCHEDULED|IN PROGRESS|ACTIVE)\b/g,
        '<span class="inline-flex items-center px-2 py-0.5 bg-apm-50 text-apm-700 rounded font-medium text-xs uppercase">$1</span>');

    return text;
}

// Show loading indicator
function showLoading() {
    // Hide welcome message when loading
    hideWelcomeMessage();

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'mb-4';
    loadingDiv.id = 'loading-message';

    loadingDiv.innerHTML = `
        <div class="flex">
            <div class="max-w-[95%] sm:max-w-4xl">
                <div class="flex gap-2 sm:gap-3">
                    <div class="flex-shrink-0">
                        <div class="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-br from-apm-500 to-apm-600 rounded-lg flex items-center justify-center shadow-sm">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
                            <div class="flex items-center gap-2 sm:gap-3">
                                <div class="flex gap-1.5">
                                    <div class="w-2 h-2 bg-apm-500 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                                    <div class="w-2 h-2 bg-apm-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                                    <div class="w-2 h-2 bg-apm-500 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                                </div>
                                <span class="text-xs sm:text-sm text-gray-500">Analyzing your query...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return loadingDiv;
}

// Remove loading indicator
function removeLoading() {
    const loading = document.getElementById('loading-message');
    if (loading) {
        loading.remove();
    }
}

// Send message to API
async function sendMessage(message) {
    // Add user message to history and UI
    conversationHistory.push({
        role: 'user',
        content: message
    });

    addMessage(message, true);

    // Show loading
    showLoading();

    // Disable input while processing
    messageInput.disabled = true;
    sendButton.disabled = true;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: conversationHistory
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Remove loading
        removeLoading();

        // Add assistant response to history and UI
        conversationHistory.push({
            role: 'assistant',
            content: data.message
        });

        addMessage(data.message, false);

    } catch (error) {
        removeLoading();
        console.error('Error sending message:', error);

        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mb-4';
        errorDiv.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <div class="flex items-start gap-2 sm:gap-3">
                    <svg class="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div>
                        <p class="text-xs sm:text-sm font-semibold text-red-900">Connection Error</p>
                        <p class="text-xs sm:text-sm text-red-700 mt-1">Unable to process your request. Please check your connection and try again.</p>
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(errorDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;

    // Send message
    await sendMessage(message);
});

// Handle suggestion buttons
function sendSuggestion(message) {
    messageInput.value = message;
    sendButton.disabled = false;
    chatForm.dispatchEvent(new Event('submit'));
}

// Handle Enter key (Shift+Enter for newline)
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (messageInput.value.trim()) {
            chatForm.dispatchEvent(new Event('submit'));
        }
    }
});

// Initialize
checkServerStatus();
