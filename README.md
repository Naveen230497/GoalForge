# GoalForge — No-BS Edition

A production-ready hackathon submission for the Gen AI Academy Ideathon.

GoalForge abandons "AI coaching personas" in favor of an evidence-backed mechanism for behavior change:
1. **Structuring**: You state a vague goal. Gemini breaks it into concrete steps.
2. **Commitment**: You commit to a step.
3. **Factual Accountability**: The system tracks the commitment and forces a binary check-in: *"You said X last week. Did it happen — yes or no?"*

## Hackathon Requirements Met
- ✅ **Firebase Auth**: Google Sign-In with server-side token verification.
- ✅ **Multi-turn AI Interaction**: Real back-and-forth conversation before step generation.
- ✅ **Isolated Firestore Storage**: Every path uses `users/{uid}/`. Default deny-all rules.
- ✅ **Secret Manager**: Gemini API key loaded securely, never hardcoded.
- ✅ **Original Feature Enhancement**: Cross-session accountability engine with binary check-ins.
- ✅ **Cloud Run Deployment**: Containerized Flask app.
- ✅ **AI Studio Custom Instructions**: Configured with explicit security directives.

## Tech Stack
- **Backend**: Python, Flask, Gunicorn
- **Frontend**: Vanilla HTML/JS, Tailwind CSS (CDN)
- **GCP**: Cloud Run, Firestore, Secret Manager, Firebase Auth

## Running Locally

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```
2. Set your Google Cloud project and get default credentials (needed to access Firestore & Secret Manager):
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   gcloud auth application-default login
   ```
3. Update `frontend/js/auth.js` with your Firebase config.
4. Run the Flask server:
   ```bash
   python backend/app.py
   ```
5. Open `http://localhost:8080` in your browser.

## Deployment to Cloud Run
```bash
gcloud run deploy goalforge \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --tag challenge \
  --labels="created-by=ai-studio-challenge"
```
