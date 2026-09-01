<div align="center">
  
  <img src="https://img.icons8.com/color/120/000000/google-cloud.png" alt="Google Cloud Logo" width="80"/>
  <h1>🔥 GoalForge</h1>
  <p><em>An AI-Powered Accountability & Goal Tracking Engine</em></p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/Google%20Cloud%20Run-Serverless-blue?style=for-the-badge&logo=googlecloud" alt="Cloud Run" />
    <img src="https://img.shields.io/badge/Google%20Gemini-AI%20Integration-orange?style=for-the-badge&logo=google" alt="Gemini" />
    <img src="https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
    <img src="https://img.shields.io/badge/Python-Flask-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  </p>

  <p>
    <b>Built for the Gen AI Academy APAC Ideathon</b>
  </p>
</div>

---

## 📑 Table of Contents
- [About The Project](#-about-the-project)
- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Gemini AI Integration Details](#-gemini-ai-integration-details)
- [Getting Started (Local Development)](#-getting-started)
- [Cloud Run Deployment](#-cloud-run-deployment)
- [Security](#-security)

---

## 💡 About The Project

**GoalForge** isn't just another task manager. It is a smart, AI-driven behavioral engine designed to defeat procrastination by transforming vague, overwhelming ambitions into hyper-specific, actionable daily habits. 

Rather than relying on a generic "AI chatbot" persona, GoalForge utilizes the **Google Gemini API** as a factual, multi-turn accountability coach. The system is deployed as a highly scalable Progressive Web App (PWA) on **Google Cloud Run**.

---

## ✨ Key Features

*   🎯 **AI Breakdown Coach:** Chat with Gemini to deconstruct massive goals into 3-5 concrete, manageable steps.
*   ✨ **Magic Enhance:** Enter a vague goal (e.g., "read more") and the system instantly rewrites it into a highly specific, measurable SMART goal.
*   ✅ **Binary Accountability Engine:** The app tracks your commitments and forces factual check-ins: *"You said you would do X. Did it happen — yes or no?"*
*   📊 **Smart Dashboard Insights:** Gemini analyzes your historical check-in data to generate personalized, dynamic motivational insights on your dashboard.
*   ⚡ **Progressive Web App (PWA):** Full Service Worker integration for offline caching, instant load times, and a native app-like experience.

---

## 🏗 Architecture & Tech Stack

GoalForge relies on a robust, highly scalable serverless architecture entirely powered by Google Cloud:

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | HTML/Vanilla JS, Tailwind CSS | Lightweight, cache-optimized PWA avoiding heavy frameworks. |
| **Backend** | Python (Flask / Gunicorn) | Containerized REST API handling all core business and AI logic. |
| **Compute** | Google Cloud Run | Fully managed, serverless execution environment ensuring zero-downtime scaling. |
| **Database** | Cloud Firestore | Real-time NoSQL database. All user data is isolated via `users/{uid}/...` architecture. |
| **Identity** | Firebase Authentication | Secure Google Sign-In with robust server-side token verification via the Firebase Admin SDK. |

---

## 🧠 Gemini AI Integration Details

GoalForge leverages the **Gemini 1.5 Flash** model for its extreme speed and low latency. 

**Advanced LLM Engineering:**
To ensure 100% uptime and gracefully bypass strict free-tier rate limits, the backend implements a custom **Multi-Model Fallback Chain**. If the primary model hits a quota limit, the `LLMClient` seamlessly cascades the request (`gemini-3.6-flash` ➡️ `3.7-flash` ➡️ `3.5-flash`), guaranteeing uninterrupted AI service for the user.

---

## 🛠 Getting Started

To run GoalForge locally for development or testing:

### Prerequisites
* Python 3.10+
* Google Cloud CLI (`gcloud`) installed and authenticated

### 1. Installation
Clone the repo, set up a virtual environment, and install dependencies:
```bash
git clone https://github.com/YourUsername/GoalForge.git
cd GoalForge
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

 Google Cloud Authentication
Authenticate your local environment to access Firestore securely:

bash


gcloud config set project YOUR_PROJECT_ID
gcloud auth application-default login
3. Run the Server
Set your Gemini API key and boot the Flask server:

bash


export GOOGLE_API_KEY="your-gemini-api-key"
python backend/app.py
Navigate to http://localhost:8080 to view the application.

☁️ Cloud Run Deployment
GoalForge is production-ready. To deploy the containerized application directly to Google Cloud Run, execute:

bash


gcloud run deploy goalforge \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --update-env-vars="GOOGLE_API_KEY=your-api-key"
🔒 Security
API Key Protection: The Gemini API key is injected via Cloud Run Environment Variables and is never exposed to the client side.
Database Rules: Firestore is configured with default deny-all security rules. All database operations are handled strictly on the server-side (firebase-admin) after rigorous JWT token verification.
XSS Prevention: All AI-generated markdown and user inputs are aggressively sanitized on the frontend using DOMPurify before rendering.
Submitted for the Gen AI Academy APAC Ideathon..
