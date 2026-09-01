// Central API client

async function apiCall(endpoint, options = {}) {
    // Await Firebase auth state initialization before making calls
    await new Promise(resolve => {
        const unsubscribe = firebase.auth().onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
        });
    });

    const user = firebase.auth().currentUser;
    if (!user) {
        window.location.href = "/";
        throw new Error("Unauthenticated");
    }

    const token = await user.getIdToken();

    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    try {
        const response = await fetch(endpoint, {
            ...options,
            headers
        });

        if (response.status === 401) {
            firebase.auth().signOut();
            window.location.href = "/";
            throw new Error("Session expired");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        
        // Handle browser network errors
        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('NetworkError'))) {
            throw new Error("Network error. Please check your connection.");
        }
        
        throw error;
    }
}
