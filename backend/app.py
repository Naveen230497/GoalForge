"""
GoalForge Flask Application.
All routes serve as a REST API for the frontend.
"""
import os
import traceback
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from backend.auth import require_auth
from backend.firestore_client import (
    create_goal, get_goals, update_goal_status, delete_goal,
    save_steps, get_steps, complete_step,
    create_conversation, add_message, get_messages,
    create_checkin, get_pending_checkins, resolve_checkin, get_checkin_stats,
    ensure_user_profile,
)
from backend.llm_client import LLMClient

app = Flask(__name__, static_folder="../frontend")
# Disable static file caching entirely to avoid service worker trap
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.after_request
def add_header(response):
    # Force no caching on static files and API responses to prevent SW poisoning
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

api_key = os.environ.get("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY environment variable not set")
llm = LLMClient(api_key)


# --- Global Error Handlers ---
@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Bad Request", "details": str(error)}), 400

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not Found"}), 404

@app.errorhandler(500)
def internal_server_error(error):
    # Log the traceback to Cloud Run logs
    traceback.print_exc()
    return jsonify({"error": "Internal Server Error"}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    # Catch-all for uncaught exceptions like ValueErrors from Firestore
    traceback.print_exc()
    if isinstance(e, ValueError):
        return jsonify({"error": str(e)}), 400
    return jsonify({"error": "An unexpected error occurred."}), 500


# --- Static Routes ---
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/dashboard")
def serve_dashboard():
    return send_from_directory(app.static_folder, "dashboard.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)


# --- Auth Routes ---
@app.route("/api/auth/verify", methods=["POST"])
@require_auth
def verify_auth(user):
    ensure_user_profile(
        uid=user["uid"],
        email=user.get("email", ""),
        display_name=user.get("name", ""),
    )
    return jsonify({"uid": user["uid"], "email": user.get("email", "")})


# --- Goal Routes ---
@app.route("/api/goals", methods=["GET"])
@require_auth
def list_goals(user):
    goals = get_goals(user["uid"])
    return jsonify({"goals": goals})

@app.route("/api/goals", methods=["POST"])
@require_auth
def new_goal(user):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400
        
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Goal title is required."}), 400
    if len(title) > 500:
        return jsonify({"error": "Goal title must be under 500 characters."}), 400

    goal_id = create_goal(user["uid"], title)
    conv_id = create_conversation(user["uid"], goal_id)
    user_message = f"My goal: {title}"
    add_message(user["uid"], goal_id, conv_id, "user", user_message)

    try:
        gemini_response = llm.chat([], user_message)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to communicate with LLM provider."}), 502

    add_message(user["uid"], goal_id, conv_id, "model", gemini_response)

    return jsonify({
        "goalId": goal_id,
        "conversationId": conv_id,
        "reply": gemini_response,
    }), 201

@app.route("/api/goals/<goal_id>/status", methods=["PATCH"])
@require_auth
def change_goal_status(user, goal_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400
        
    status = data.get("status")
    if status not in ["active", "completed", "abandoned"]:
        return jsonify({"error": "Invalid status."}), 400

    update_goal_status(user["uid"], goal_id, status)
    return jsonify({"status": status})

@app.route("/api/goals/<goal_id>", methods=["DELETE"])
@require_auth
def remove_goal(user, goal_id):
    try:
        delete_goal(user["uid"], goal_id)
        return jsonify({"status": "deleted"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# --- Chat Routes ---
@app.route("/api/goals/<goal_id>/conversations/<conv_id>/messages", methods=["GET"])
@require_auth
def list_messages(user, goal_id, conv_id):
    messages = get_messages(user["uid"], goal_id, conv_id)
    return jsonify({"messages": messages})

@app.route("/api/goals/<goal_id>/conversations/<conv_id>/chat", methods=["POST"])
@require_auth
def send_chat(user, goal_id, conv_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400
        
    user_message = data.get("message", "").strip()
    if not user_message:
        return jsonify({"error": "Message is required."}), 400
    if len(user_message) > 2000:
        return jsonify({"error": "Message must be under 2000 characters."}), 400

    # Fetch only the last 15 messages from the database to prevent LLM context limit crashes
    history = get_messages(user["uid"], goal_id, conv_id, limit=15)
    
    # Anti-Hallucination Fix: If there is no history, the LLM won't know what the goal is.
    # We must inject the goal title into the first message.
    if not history:
        goal_doc = _db().collection("users").document(user["uid"]).collection("goals").document(goal_id).get()
        if goal_doc.exists:
            title = goal_doc.to_dict().get("title", "Unknown Goal")
            user_message = f"My goal: {title}\nUser says: {user_message}"
    
    history_for_gemini = [
        {"role": m["role"], "content": m["content"]}
        for m in history
    ]

    add_message(user["uid"], goal_id, conv_id, "user", user_message)

    try:
        gemini_response = llm.chat(history_for_gemini, user_message)
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Failed to communicate with LLM provider."}), 502

    add_message(user["uid"], goal_id, conv_id, "model", gemini_response)
    return jsonify({"reply": gemini_response})


# --- Steps Routes ---
@app.route("/api/goals/<goal_id>/steps", methods=["GET"])
@require_auth
def list_steps(user, goal_id):
    steps = get_steps(user["uid"], goal_id)
    return jsonify({"steps": steps})

@app.route("/api/goals/<goal_id>/steps", methods=["POST"])
@require_auth
def add_steps(user, goal_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
        
    steps = data.get("steps", [])
    if not steps or not isinstance(steps, list) or len(steps) > 20:
        return jsonify({"error": "Steps array must be provided (max 20)."}), 400
        
    for step in steps:
        if not isinstance(step, str) or len(step) > 500:
            return jsonify({"error": "Invalid step content."}), 400

    save_steps(user["uid"], goal_id, steps)
    return jsonify({"saved": len(steps)}), 201

@app.route("/api/goals/<goal_id>/steps/<step_id>/complete", methods=["POST"])
@require_auth
def mark_step_complete(user, goal_id, step_id):
    data = request.get_json(silent=True)
    is_completed = True
    if data and "isCompleted" in data:
        is_completed = bool(data["isCompleted"])
        
    complete_step(user["uid"], goal_id, step_id, is_completed)
    return jsonify({"completed": is_completed})


# --- Check-In Routes ---
@app.route("/api/checkins", methods=["GET"])
@require_auth
def list_pending_checkins(user):
    pending = get_pending_checkins(user["uid"])
    return jsonify({"pending": pending})

@app.route("/api/checkins", methods=["POST"])
@require_auth
def new_checkin(user):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
        
    goal_id = data.get("goalId", "")
    step_id = data.get("stepId", "")
    step_text = data.get("stepText", "").strip()

    if not goal_id or not step_id or not step_text:
        return jsonify({"error": "goalId, stepId, and stepText are required."}), 400

    checkin_id = create_checkin(user["uid"], goal_id, step_id, step_text)
    return jsonify({"checkInId": checkin_id}), 201

@app.route("/api/checkins/<checkin_id>/resolve", methods=["POST"])
@require_auth
def resolve(user, checkin_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
        
    result = data.get("result", "")
    if result not in ("yes", "no"):
        return jsonify({"error": "Result must be 'yes' or 'no'."}), 400

    resolve_checkin(user["uid"], checkin_id, result)
    return jsonify({"resolved": True})

@app.route("/api/checkins/stats", methods=["GET"])
@require_auth
def checkin_statistics(user):
    stats = get_checkin_stats(user["uid"])
    return jsonify(stats)


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/enhance", methods=["POST"])
@require_auth
def enhance_goal(user):
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400
        
    # Prevent massive prompt injection payloads
    safe_text = text[:500].replace('\n', ' ')
        
    prompt = f"Rewrite this vague user goal into a single, highly specific, measurable, and achievable (SMART) sentence. Do not use markdown. Do not include any introductory text. Do not add steps. Just output the single optimized goal sentence: '{safe_text}'"
    
    try:
        gemini_response = llm.generate(prompt)
        return jsonify({"enhanced": gemini_response.strip()})
    except Exception as e:
        return jsonify({"error": "Failed to enhance goal"}), 500


@app.route("/api/insights", methods=["GET"])
@require_auth
def smart_insights(user):
    stats = get_checkin_stats(user["uid"])
    
    # If they have no stats yet, give a generic welcome message
    if stats.get("total", 0) == 0:
        return jsonify({"insight": "Welcome to GoalForge! Add your first goal and commit to a step to start building momentum."})
        
    prompt = f"The user has {stats.get('total')} total commitments. They have completed {stats.get('completed')} and missed {stats.get('missed')}. Their follow-through rate is {stats.get('completionRate')}%. Write a single, short, personalized 1-sentence motivational insight or tip based on these specific numbers. Be encouraging. Do not use asterisks or markdown. Do not sound like a robot."
    
    try:
        gemini_response = llm.generate(prompt)
        return jsonify({"insight": gemini_response.strip()})
    except Exception as e:
        return jsonify({"insight": "Keep pushing forward! Consistency is the key to achieving your goals."})

# --- Notification Routes ---
@app.route("/api/notify/email", methods=["POST"])
@require_auth
def send_email_notification(user):
    data = request.get_json(silent=True) or {}
    subject = data.get("subject", "GoalForge Reminder")
    body = data.get("body", "It's time to check in on your goals!")
    
    sender_email = os.environ.get("GMAIL_USER")
    sender_password = os.environ.get("GMAIL_APP_PASSWORD")
    
    if not sender_email or not sender_password:
        return jsonify({"error": "Email system is not configured on the server."}), 500
        
    recipient_email = user.get("email")
    if not recipient_email:
        return jsonify({"error": "User does not have an email address."}), 400
        
    try:
        msg = MIMEMultipart()
        msg['From'] = f"GoalForge <{sender_email}>"
        msg['To'] = recipient_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        # Clean the password of any spaces
        clean_password = sender_password.replace(" ", "")
        server.login(sender_email, clean_password)
        server.send_message(msg)
        server.quit()
        
        return jsonify({"status": "Email sent successfully"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
