// Firebase Authentication

const firebaseConfig = {
    apiKey: "AIzaSyBMl2wYuPdNxk7PAsjtZIHsOQnXOlR0jTg",
    authDomain: "goalforge-app-61523.firebaseapp.com",
    projectId: "goalforge-app-61523",
    storageBucket: "goalforge-app-61523.firebasestorage.app",
    messagingSenderId: "47239585848",
    appId: "1:47239585848:web:764dffec94b3d4206586cd"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

async function signInWithGoogle() {
    const btn = document.getElementById("signInBtn");
    const loading = document.getElementById("authLoading");
    const errorEl = document.getElementById("authError");

    btn.classList.add("hidden");
    loading.classList.remove("hidden");
    errorEl.classList.add("hidden");

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const idToken = await result.user.getIdToken();

        const response = await fetch("/api/auth/verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            throw new Error("Backend verification failed.");
        }

        window.location.href = "/dashboard";
    } catch (error) {
        console.error("Sign-in error:", error);
        errorEl.textContent = `Sign-in failed: ${error.message}`;
        errorEl.classList.remove("hidden");
        btn.classList.remove("hidden");
        loading.classList.add("hidden");
    }
}

async function signOut() {
    await auth.signOut();
    window.location.href = "/";
}
