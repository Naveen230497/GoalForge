// Goals management

let globalGoals = [];
let currentGoalId = null;
let currentConvId = null;

async function loadGoals() {
    const loadingEl = document.getElementById("loadingState");
    const emptyEl = document.getElementById("emptyState");
    const listEl = document.getElementById("goalsList");

    try {
        const data = await apiCall("/api/goals");
        loadingEl.classList.add("hidden");

        if (!data || !data.goals || data.goals.length === 0) {
            emptyEl.classList.remove("hidden");
            listEl.innerHTML = "";
            return;
        }

        emptyEl.classList.add("hidden");
        globalGoals = data.goals;
        
        listEl.innerHTML = data.goals.map(goal => renderGoalCard(goal, goal.steps || [])).join("");
    } catch (error) {
        loadingEl.innerHTML = `<p class="text-rose-500 font-medium">Failed to load goals: ${escapeHtml(error.message)}</p>`;
    }
}

function renderGoalCard(goal, steps) {
    const isCompleted = goal.status === 'completed';
    const isAbandoned = goal.status === 'abandoned';
    
    let statusBadge = `<span class="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full font-medium border border-blue-500/20">Active</span>`;
    if (isCompleted) statusBadge = `<span class="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-500/20">Completed</span>`;
    if (isAbandoned) statusBadge = `<span class="bg-rose-500/10 text-rose-400 text-xs px-2.5 py-1 rounded-full font-medium border border-rose-500/20">Abandoned</span>`;

    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.isCompleted).length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const stepsHtml = steps.length > 0
        ? steps.map(s => `
            <div class="flex items-start gap-3 py-2.5 group">
                <input type="checkbox" 
                       ${s.isCompleted ? "checked" : ""} 
                       onchange="toggleStepCompletion('${goal.id}', '${s.id}', this.checked)"
                       class="mt-1" aria-label="Step status">
                <span class="flex-1 text-sm ${s.isCompleted ? "line-through text-gray-500" : "text-gray-300"} leading-snug">${window.DOMPurify ? DOMPurify.sanitize(marked.parseInline(escapeHtml(s.text)), { USE_PROFILES: { html: true } }) : marked.parseInline(escapeHtml(s.text))}</span>
                ${!s.isCompleted ? `
                    <button data-goal-id="${goal.id}" data-step-id="${s.id}" data-step-text="${escapeHtml(s.text)}"
                            onclick="handleCommitToStep(this)"
                            class="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-xs btn-secondary text-gray-300 px-3 py-1 rounded font-medium shadow-sm whitespace-nowrap">
                        Commit
                    </button>
                ` : ""}
            </div>
        `).join("")
        : '<p class="text-gray-500 text-sm italic mt-2">No steps yet. Open chat to break this down.</p>';

    // Truncate the title to max 50 characters for the image generation prompt to prevent API timeouts or URI length errors
    const shortTitle = goal.title.length > 50 ? goal.title.substring(0, 50) + "..." : goal.title;
    const bgPrompt = "cinematic aesthetic photo representing goal: " + shortTitle;
    const bgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(bgPrompt)}?width=600&height=400&nologo=true`;

    return `
        <div class="premium-card rounded-2xl p-6 flex flex-col h-full relative overflow-hidden group border border-white/5 shadow-2xl">
            <!-- Dynamic Vision Board Background -->
            <div class="absolute inset-0 z-0 opacity-40 group-hover:opacity-60 transition-opacity duration-700 bg-cover bg-center bg-no-repeat" 
                 style="background-image: url('${bgUrl}');">
            </div>
            <!-- Dark overlay to ensure text readability -->
            <div class="absolute inset-0 z-0 bg-gradient-to-t from-[#13161f] via-[#13161f]/80 to-[#13161f]/40"></div>
            
            <div class="relative z-10 flex flex-col h-full">
                <div class="flex justify-between items-start mb-4 gap-3">
                <h3 class="font-bold text-lg text-white leading-tight">${escapeHtml(goal.title)}</h3>
                <div class="flex items-center gap-2 flex-shrink-0">
                    ${statusBadge}
                    <button onclick="syncToCalendar('${goal.id}')" class="text-gray-500 hover:text-blue-400 transition-colors p-1" title="Sync to Google Calendar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </button>
                    <button onclick="deleteGoal('${goal.id}')" class="text-gray-500 hover:text-rose-500 transition-colors p-1" title="Delete Goal">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
            
            ${totalSteps > 0 ? `
            <div class="mb-5">
                <div class="flex justify-between text-xs text-gray-400 mb-1.5 font-medium">
                    <span>Progress</span>
                    <span>${progress}%</span>
                </div>
                <div class="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full" style="width: ${progress}%"></div>
                </div>
            </div>
            ` : ''}
            
            <div class="border-t border-white/5 pt-3 mb-6 flex-1 space-y-1">
                ${stepsHtml}
            </div>
            
            <div class="pt-4 border-t border-white/5 flex flex-col gap-2 mt-auto">
                <button onclick="openExistingChat('${goal.id}')" class="w-full btn-ai text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    Chat with AI
                </button>
                <select onchange="updateGoalStatus('${goal.id}', this.value)" class="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 outline-none font-medium appearance-none cursor-pointer text-center">
                    <option value="active" ${goal.status === 'active' ? 'selected' : ''}>Status: Active</option>
                    <option value="completed" ${goal.status === 'completed' ? 'selected' : ''}>Status: Done</option>
                    <option value="abandoned" ${goal.status === 'abandoned' ? 'selected' : ''}>Status: Drop</option>
                </select>
            </div>
            </div>
        </div>
    `;
}

async function updateGoalStatus(goalId, newStatus) {
    try {
        await apiCall(`/api/goals/${goalId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus })
        });
        showToast("Goal status updated", "success");
    } catch (error) {
        showToast(error.message, "error");
        loadGoals(); // Revert UI
    }
}

async function toggleStepCompletion(goalId, stepId, isCompleted) {
    try {
        await apiCall(`/api/goals/${goalId}/steps/${stepId}/complete`, {
            method: "POST",
            body: JSON.stringify({ isCompleted })
        });
        loadGoals();
    } catch (error) {
        showToast(error.message, "error");
        loadGoals();
    }
}

async function handleNewGoal(event) {
    event.preventDefault();

    const input = document.getElementById("goalInput");
    const btn = document.getElementById("goalSubmitBtn");
    const title = input.value.trim();
    if (!title) return;

    btn.disabled = true;
    btn.innerHTML = `<div class="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>`;

    try {
        const data = await apiCall("/api/goals", {
            method: "POST", 
            body: JSON.stringify({ title })
        });

        currentGoalId = data.goalId;
        currentConvId = data.conversationId;

        // Reset UI
        input.value = "";

        // Open chat with initial response
        openChat(title, data.reply);
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        await loadGoals(); 
        btn.disabled = false;
        btn.textContent = "Start";
    }
}

async function handleCommitToStep(btnElement) {
    const goalId = btnElement.getAttribute("data-goal-id");
    const stepId = btnElement.getAttribute("data-step-id");
    const stepText = btnElement.getAttribute("data-step-text");

    // Replace native confirm with a quick toast prompt, or just commit directly for better UX
    try {
        await apiCall("/api/checkins", {
            method: "POST", 
            body: JSON.stringify({ goalId, stepId, stepText })
        });
        showToast("Commitment recorded! You'll be asked about this later.", "success");
        loadPendingCheckins(); // Refresh banner immediately
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to permanently delete this goal?')) return;
    try {
        await apiCall('/api/goals/' + goalId, { method: 'DELETE' });
        showToast('Goal deleted.', 'success');
        loadGoals();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function syncToCalendar(goalId) {
    const goal = globalGoals.find(g => g.id === goalId);
    if (!goal) return;
    
    const steps = goal.steps || [];
    if (steps.length === 0) {
        showToast('You need to add steps via AI chat first!', 'warning');
        return;
    }
    
    const title = encodeURIComponent('Goal: ' + goal.title);
    const detailsStr = steps.map((s, i) => (i + 1) + '. ' + s.text).join('\n');
    const details = encodeURIComponent('Steps to achieve this goal:\n' + detailsStr + '\n\n Generated by GoalForge AI');
    
    const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + title + '&details=' + details;
    window.open(url, '_blank');
}
