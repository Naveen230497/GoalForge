// Accountability Check-In System

async function loadPendingCheckins() {
    try {
        const data = await apiCall("/api/checkins");
        const pending = data.pending || [];

        if (pending.length === 0) {
            document.getElementById("checkinBanner").classList.add("hidden");
            return;
        }

        document.getElementById("checkinBanner").classList.remove("hidden");
        const listEl = document.getElementById("checkinList");
        listEl.innerHTML = "";

        for (const checkin of pending) {
            listEl.innerHTML += `
                <div class="flex items-center justify-between glass-panel rounded-lg px-5 py-4 border border-blue-500/20 shadow-sm transition hover:shadow-md bg-gradient-to-r from-blue-900/20 to-purple-900/20">
                    <div>
                        <p class="text-white font-medium">${escapeHtml(checkin.stepText)}</p>
                        <p class="text-blue-200/70 text-xs mt-0.5">
                            You committed to this. Did you follow through?
                        </p>
                    </div>
                    <div class="flex gap-2 ml-4 flex-shrink-0">
                        <button onclick="handleCheckinResolve('${checkin.id}', 'yes')"
                                class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition shadow-sm">
                            Yes ✨
                        </button>
                        <button onclick="handleCheckinResolve('${checkin.id}', 'no')"
                                class="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-500/30 transition shadow-sm">
                            No 🔄
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        showToast("Failed to load check-ins", "error");
    }
}

async function handleCheckinResolve(checkinId, result) {
    try {
        await apiCall(`/api/checkins/${checkinId}/resolve`, {
            method: "POST", 
            body: JSON.stringify({ result })
        });

        showToast(result === 'yes' ? 'Great job!' : 'Next time for sure.', result === 'yes' ? 'success' : 'info');
        
        await loadPendingCheckins();
        await loadCheckinStats();
        // Since resolving a checkin to "yes" now auto-completes the step on backend, reload goals too
        if (result === 'yes') {
            await loadGoals();
        }
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function loadCheckinStats() {
    try {
        const stats = await apiCall("/api/checkins/stats");

        document.getElementById("statsBar").classList.remove("hidden");
        document.getElementById("statsBar").classList.add("grid");
        document.getElementById("statTotal").textContent = stats.total || 0;
        document.getElementById("statTotal").textContent = stats.total || 0;
        document.getElementById("statCompleted").textContent = stats.completed || 0;
        document.getElementById("statMissed").textContent = stats.missed || 0;
        document.getElementById("statRate").textContent = (stats.completionRate || 0) + "%";
        
        // Calculate Gamification Level (1 level per 5 completions)
        const completed = stats.completed || 0;
        const level = Math.floor(completed / 5) + 1;
        const xp = completed % 5;
        const xpPercent = (xp / 5) * 100;
        
        const badge = document.getElementById("userLevelBadge");
        const bar = document.getElementById("userXpBar");
        if (badge) badge.textContent = "Lvl " + level;
        if (bar) bar.style.width = xpPercent + "%";
        
        // Fetch AI Insight asynchronously so it doesn't block the dashboard load
        apiCall("/api/insights").then(data => {
            if (data.insight) {
                document.getElementById("insightsBanner").classList.remove("hidden");
                document.getElementById("insightsText").textContent = data.insight;
            }
        }).catch(err => console.log("Failed to load insight", err));
        
    } catch (error) {
        // silently fail stats if needed
    }
}
