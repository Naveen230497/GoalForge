// Chat interaction

async function openExistingChat(goalId) {
    const goal = typeof globalGoals !== 'undefined' ? globalGoals.find(g => g.id === goalId) : null;
    if (!goal) {
        showToast("Error finding goal.", "error");
        return;
    }
    
    currentGoalId = goal.id;
    currentConvId = goal.conversationId || crypto.randomUUID();
    
    document.getElementById("chatModalOverlay").classList.remove("hidden");
    document.getElementById("chatGoalTitle").textContent = goal.title;
    
    const messagesEl = document.getElementById("chatMessages");
    
    if (!goal.conversationId) {
        messagesEl.innerHTML = '<p class="text-gray-400 text-center py-4">Start chatting to break down this goal.</p>';
        return;
    }
    
    messagesEl.innerHTML = `
        <div class="flex justify-center p-4">
            <div class="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></div>
        </div>
    `;
    
    try {
        const response = await apiCall(`/api/goals/${currentGoalId}/conversations/${currentConvId}/messages`);
        messagesEl.innerHTML = "";
        
        if (response.messages && response.messages.length > 0) {
            response.messages.forEach(msg => {
                appendMessage(msg.role, msg.content);
            });
            setTimeout(() => {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }, 100);
        } else {
            messagesEl.innerHTML = '<p class="text-gray-400 text-center py-4">No messages yet.</p>';
        }
    } catch (err) {
        messagesEl.innerHTML = `<p class="text-rose-500 p-4">Failed to load chat history.</p>`;
    }
}

function openChat(goalTitle, initialReply) {
    document.getElementById("chatModalOverlay").classList.remove("hidden");
    document.getElementById("chatGoalTitle").textContent = goalTitle;

    const messagesEl = document.getElementById("chatMessages");
    messagesEl.innerHTML = "";

    appendMessage("model", initialReply);
    document.getElementById("chatInput").focus();
    
    checkIfStepsExist(initialReply);
}

function closeChat() {
    document.getElementById("chatModalOverlay").classList.add("hidden");
    document.getElementById("saveStepsPanel").classList.add("hidden");
    currentGoalId = null;
    currentConvId = null;
}

async function handleSendMessage(event) {
    event.preventDefault();

    const input = document.getElementById("chatInput");
    const btn = document.getElementById("chatSendBtn");
    const message = input.value.trim();
    if (!message || !currentGoalId || !currentConvId) return;

    appendMessage("user", message);
    input.value = "";
    input.disabled = true;
    btn.disabled = true;

    const typingId = showTypingIndicator();

    try {
        const data = await apiCall(`/api/goals/${currentGoalId}/conversations/${currentConvId}/chat`, {
            method: "POST",
            body: JSON.stringify({ message })
        });

        removeTypingIndicator(typingId);
        appendMessage("model", data.reply);
        checkIfStepsExist(data.reply);
    } catch (error) {
        removeTypingIndicator(typingId);
        appendMessage("model", `Error: ${error.message}. Please try again.`);
    } finally {
        input.disabled = false;
        btn.disabled = false;
        input.focus();
    }
}

function checkIfStepsExist(replyText) {
    const listRegex = /(?:^\s*(?:(?:\*\*)?\d+[\.\)](?:\*\*)?|[\*\-])\s+)/m;
    if (replyText.match(listRegex)) {
        document.getElementById("saveStepsPanel").classList.remove("hidden");
        // Save the raw text on the DOM so we can extract it easily
        document.getElementById("saveStepsPanel").dataset.latestReply = replyText;
    }
}

function appendMessage(role, content) {
    const messagesEl = document.getElementById("chatMessages");
    const isUser = role === "user";

    const bubble = document.createElement("div");
    bubble.className = `flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`;
    
    let htmlContent = isUser ? escapeHtml(content) : marked.parse(content);
    if (!isUser) {
        // Robust XSS Sanitization using DOMPurify
        if (window.DOMPurify) {
            htmlContent = DOMPurify.sanitize(htmlContent, { USE_PROFILES: { html: true } });
        }
    }
    
    bubble.innerHTML = `
        <div class="max-w-[85%] px-5 py-3 rounded-2xl ${
            isUser
                ? "chat-bubble-user rounded-br-sm"
                : "chat-bubble-ai rounded-bl-sm"
        }">
            <div class="text-sm prose prose-sm max-w-none">${htmlContent}</div>
        </div>
    `;

    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTypingIndicator() {
    const messagesEl = document.getElementById("chatMessages");
    const id = "typing-" + Date.now();
    const indicator = document.createElement("div");
    indicator.id = id;
    indicator.className = "flex justify-start animate-fade-in-up";
    indicator.innerHTML = `
        <div class="chat-bubble-ai px-5 py-4 rounded-2xl rounded-bl-sm">
            <div class="flex gap-1.5">
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.15s"></span>
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.3s"></span>
            </div>
        </div>
    `;
    messagesEl.appendChild(indicator);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

async function handleSaveSteps() {
    const panel = document.getElementById("saveStepsPanel");
    const lastModelText = panel.dataset.latestReply;
    if (!lastModelText) return;

    const listRegex = /(?:^\s*(?:(?:\*\*)?\d+[\.\)](?:\*\*)?|[\*\-])\s+)/;

    // Extract numbered lines or bullet points
    const stepLines = lastModelText.split("\n")
        .map(line => line.trim())
        .filter(line => listRegex.test(line))
        .map(line => line.replace(listRegex, "").replace(/\*\*/g, "").trim())
        .filter(line => line.length > 0);

    const finalSteps = stepLines.slice(0, 20); // Prevent backend 400 limit

    if (finalSteps.length === 0) {
        showToast("Couldn't find valid steps in the response.", "warning");
        return;
    }

    try {
        await apiCall(`/api/goals/${currentGoalId}/steps`, {
            method: "POST", 
            body: JSON.stringify({ steps: finalSteps })
        });
        panel.classList.add("hidden");
        showToast(`Saved ${finalSteps.length} steps!`, "success");
        await loadGoals(); 
    } catch (error) {
        showToast(`Failed to save steps: ${error.message}`, "error");
    }
}
