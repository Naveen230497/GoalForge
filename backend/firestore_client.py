"""
Firestore data access layer for GoalForge.
"""
from firebase_admin import firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from google.cloud.firestore_v1.base_query import FieldFilter
import uuid

def _db():
    return firestore.client()

# --- USER PROFILE ---
def ensure_user_profile(uid: str, email: str, display_name: str):
    doc_ref = _db().collection("users").document(uid).collection("profile").document("info")
    doc_ref.set({
        "email": email,
        "displayName": display_name or "",
        "lastLoginAt": SERVER_TIMESTAMP,
    }, merge=True)

# --- GOALS ---
def create_goal(uid: str, title: str) -> str:
    goal_id = str(uuid.uuid4())
    doc_ref = _db().collection("users").document(uid).collection("goals").document(goal_id)
    doc_ref.set({
        "title": title,
        "status": "active",
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
    })
    return goal_id

import concurrent.futures

def _enrich_goal(uid, doc):
    data = doc.to_dict()
    data["id"] = doc.id
    
    # We fetch steps and conversation parallelized across all goals
    data["steps"] = get_steps(uid, data["id"])
    
    convs = doc.reference.collection("conversations").limit(1).get()
    if convs:
        data["conversationId"] = convs[0].id
    else:
        data["conversationId"] = None
        
    return data

def get_goals(uid: str) -> list:
    goals_ref = _db().collection("users").document(uid)\
                   .collection("goals")\
                   .order_by("createdAt", direction=firestore.Query.DESCENDING)\
                   .limit(100)
    docs = list(goals_ref.stream())
    
    if not docs:
        return []
        
    # N+1 Optimization: Fetch all steps and conversations for all goals in parallel
    result = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        # Submit all tasks
        future_to_doc = {executor.submit(_enrich_goal, uid, doc): doc for doc in docs}
        # We need to maintain the descending order they were fetched in, so we process them in the original docs list order.
        # Wait for all to finish, then build the result list in the same order as 'docs'
        enriched_results = {}
        for future in concurrent.futures.as_completed(future_to_doc):
            doc = future_to_doc[future]
            try:
                enriched_results[doc.id] = future.result()
            except Exception as e:
                print(f"Error enriching goal {doc.id}: {e}")
                
        # Re-assemble in correct order
        for doc in docs:
            if doc.id in enriched_results:
                result.append(enriched_results[doc.id])
                
    return result

def update_goal_status(uid: str, goal_id: str, status: str):
    doc_ref = _db().collection("users").document(uid).collection("goals").document(goal_id)
    if not doc_ref.get().exists:
        raise ValueError("Goal not found")
    doc_ref.update({
        "status": status,
        "updatedAt": SERVER_TIMESTAMP,
    })

def delete_goal(uid: str, goal_id: str):
    doc_ref = _db().collection("users").document(uid).collection("goals").document(goal_id)
    if not doc_ref.get().exists:
        raise ValueError("Goal not found")
        
    # Delete steps (Directly to avoid Firestore 500-batch limit crash)
    steps = doc_ref.collection("steps").stream()
    for doc in steps:
        doc.reference.delete()
        
    # Delete conversations and nested messages
    convs = doc_ref.collection("conversations").stream()
    for conv in convs:
        msgs = conv.reference.collection("messages").stream()
        for msg in msgs:
            msg.reference.delete()
        conv.reference.delete()
        
    # Delete associated check-ins
    checkins = _db().collection("users").document(uid).collection("checkIns").where(filter=FieldFilter("goalId", "==", goal_id)).stream()
    for checkin in checkins:
        checkin.reference.delete()
        
    # Delete the goal itself
    doc_ref.delete()

# --- STEPS ---
def save_steps(uid: str, goal_id: str, steps: list[str]):
    batch = _db().batch()
    coll_ref = _db().collection("users").document(uid).collection("goals").document(goal_id).collection("steps")
    
    # Delete existing steps first to prevent duplication
    for doc in coll_ref.stream():
        batch.delete(doc.reference)
    
    for i, step_text in enumerate(steps):
        step_id = str(uuid.uuid4())
        doc_ref = coll_ref.document(step_id)
        batch.set(doc_ref, {
            "text": step_text,
            "order": i + 1,
            "isCompleted": False,
            "completedAt": None,
        })
    batch.commit()

def get_steps(uid: str, goal_id: str) -> list:
    steps_ref = _db().collection("users").document(uid).collection("goals").document(goal_id).collection("steps").order_by("order").limit(50)
    result = []
    for doc in steps_ref.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    return result

def complete_step(uid: str, goal_id: str, step_id: str, is_completed: bool = True):
    doc_ref = _db().collection("users").document(uid).collection("goals").document(goal_id).collection("steps").document(step_id)
    if not doc_ref.get().exists:
        # Step might have been deleted/overwritten if the user re-generated steps.
        # Don't throw an error, otherwise the check-in can never be resolved.
        print(f"Warning: Step {step_id} not found when completing. It may have been deleted.")
        return
    doc_ref.update({
        "isCompleted": is_completed,
        "completedAt": SERVER_TIMESTAMP if is_completed else None,
    })

# --- CONVERSATION MESSAGES ---
def create_conversation(uid: str, goal_id: str) -> str:
    conv_id = str(uuid.uuid4())
    doc_ref = _db().collection("users").document(uid).collection("goals").document(goal_id).collection("conversations").document(conv_id)
    doc_ref.set({"createdAt": SERVER_TIMESTAMP})
    return conv_id

def add_message(uid: str, goal_id: str, conv_id: str, role: str, content: str):
    msg_id = str(uuid.uuid4())
    doc_ref = _db().collection("users").document(uid).collection("goals").document(goal_id).collection("conversations").document(conv_id).collection("messages").document(msg_id)
    doc_ref.set({
        "role": role,
        "content": content,
        "timestamp": SERVER_TIMESTAMP,
    })

def get_messages(uid: str, goal_id: str, conv_id: str, limit: int = 200) -> list:
    msgs_ref = _db().collection("users").document(uid).collection("goals").document(goal_id).collection("conversations").document(conv_id).collection("messages").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit)
    result = []
    for doc in msgs_ref.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    result.reverse() # chronological order
    return result

# --- CHECK-INS ---
def create_checkin(uid: str, goal_id: str, step_id: str, step_text: str) -> str:
    checkin_id = str(uuid.uuid4())
    doc_ref = _db().collection("users").document(uid).collection("checkIns").document(checkin_id)
    doc_ref.set({
        "goalId": goal_id,
        "stepId": step_id,
        "stepText": step_text,
        "committedAt": SERVER_TIMESTAMP,
        "result": None,
        "resultAt": None,
    })
    return checkin_id

def get_pending_checkins(uid: str) -> list:
    # Notice: removing order_by("committedAt") to fix the missing composite index bug!
    # We will just sort in memory since there should only be a few pending check-ins.
    checkins_ref = _db().collection("users").document(uid).collection("checkIns").where(filter=FieldFilter("result", "==", None)).limit(50)
    result = []
    for doc in checkins_ref.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    
    # Sort in memory by committedAt
    result.sort(key=lambda x: x.get("committedAt").timestamp() if x.get("committedAt") else 0)
    return result

def resolve_checkin(uid: str, checkin_id: str, result: str):
    doc_ref = _db().collection("users").document(uid).collection("checkIns").document(checkin_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise ValueError("Check-in not found")
    
    doc_ref.update({
        "result": result,
        "resultAt": SERVER_TIMESTAMP,
    })
    
    # Mark step as completed if user says yes
    if result == "yes":
        data = doc.to_dict()
        goal_id = data.get("goalId")
        step_id = data.get("stepId")
        if goal_id and step_id:
            complete_step(uid, goal_id, step_id)

def get_checkin_stats(uid: str) -> dict:
    coll_ref = _db().collection("users").document(uid).collection("checkIns")
    
    try:
        total = coll_ref.where(filter=FieldFilter("result", "!=", None)).count().get()[0][0].value
        completed = coll_ref.where(filter=FieldFilter("result", "==", "yes")).count().get()[0][0].value
    except Exception:
        # Fallback to streaming if aggregation fails or composite index is missing
        docs = list(coll_ref.where(filter=FieldFilter("result", "!=", None)).limit(1000).stream())
        total = len(docs)
        completed = sum(1 for d in docs if d.to_dict().get("result") == "yes")

    missed = total - completed

    return {
        "total": total,
        "completed": completed,
        "missed": missed,
        "completionRate": round(completed / total * 100) if total > 0 else 0,
    }
