"""
Firebase Authentication middleware.
Verifies the ID token on every protected API request.
"""
import firebase_admin
from firebase_admin import auth, credentials
from flask import request, jsonify
from functools import wraps

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)

def verify_token():
    auth_header = request.headers.get("Authorization", "").strip()

    if not auth_header.startswith("Bearer "):
        return None, (jsonify({"error": "Missing or malformed Authorization header"}), 401)

    id_token = auth_header[7:].strip()
    if not id_token:
        return None, (jsonify({"error": "Missing token"}), 401)

    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token, None
    except auth.ExpiredIdTokenError:
        return None, (jsonify({"error": "Token expired. Please sign in again."}), 401)
    except auth.InvalidIdTokenError:
        return None, (jsonify({"error": "Invalid token."}), 401)
    except Exception:
        # Don't leak internal exceptions to the client
        return None, (jsonify({"error": "Authentication failed"}), 401)

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user, error = verify_token()
        if error:
            return error
        return f(user, *args, **kwargs)
    return decorated
