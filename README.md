<div align="center">
  <h1>GoalForge 🔥</h1>
  <p><em>An AI-powered goal tracking application built with Google Cloud Run, Firebase, Firestore, and the Gemini API.</em></p>
</div>

---

## 🚀 Overview

GoalForge is a smart, AI-powered goal tracking application that stops procrastination by transforming vague ambitions into highly specific, actionable habits. 

Built specifically for the **Gen AI Academy APAC Ideathon**, this application abandons generic "AI chatbot" personas in favor of an evidence-backed mechanism for behavior change. It utilizes a fully serverless, containerized architecture on Google Cloud to deliver a seamless, scalable Progressive Web App (PWA) experience.

## ✨ Key Features & AI Integration

1. **The AI Breakdown Coach (Gemini API):** A multi-turn chat interface where Gemini acts as an accountability coach, helping users break down massive, overwhelming goals into 3-5 concrete, manageable steps.
2. **Magic Enhance (Gemini API):** Users can type a vague goal (e.g., "read more") and click the ✨ button to have Gemini instantly rewrite it into a highly specific, measurable SMART goal.
3. **Factual Accountability Engine:** The system tracks daily commitments and forces a binary check-in: *"You said you would do X. Did it happen — yes or no?"*
4. **Smart Insights (Gemini API):** Gemini analyzes the user's historical check-in statistics to generate personalized, dynamic motivational insights on the dashboard.

## 🏗️ Architecture & Google Cloud Infrastructure

GoalForge relies on a robust, highly scalable serverless architecture:

*   **Frontend:** Vanilla HTML/JS, Tailwind CSS (CDN). Fully functional Progressive Web App (PWA) with Service Worker caching for instant load times.
*   **Backend:** Python (Flask, Gunicorn).
*   **Google Cloud Run:** The backend is fully containerized via Docker and deployed on Cloud Run, providing a scalable, serverless API.
*   **Firebase Authentication:** Ensures secure, user-specific sessions and identity verification via Google Sign-In with server-side token verification.
*   **Cloud Firestore:** All user data (goals, steps, check-ins, and AI conversation histories) is securely stored in user-isolated Firestore documents (`users/{uid}/...`) to guarantee complete privacy. Default deny-all security rules are implemented.
*   **Secret Manager (via Cloud Run Env Vars):** The Gemini API key is loaded securely and never hardcoded in the application.
*   **LLM Fallback Chain:** The backend implements a robust multi-model fallback chain (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`) to gracefully bypass strict free-tier rate limits and ensure 100% uptime, adhering exactly to the advanced configuration instructions.

## 🛠️ Local Development

1. **Clone and Install Dependencies**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Google Cloud Authentication**
   (Required to access Firestore locally)
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   gcloud auth application-default login
   ```

3. **Run the Backend**
   ```bash
   export GOOGLE_API_KEY="your-gemini-api-key"
   python backend/app.py
   ```
   Open `http://localhost:8080` in your browser.

## ☁️ Deployment

GoalForge is deployed to Cloud Run using the following configuration:
```bash
gcloud run deploy goalforge \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --update-env-vars="GOOGLE_API_KEY=your-api-key"
```
