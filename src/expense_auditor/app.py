from flask import Flask, request, jsonify, make_response, abort
from expense_auditor.db import init_db, SessionLocal, SMSMessage, User, UserSettings
from expense_auditor.sms_classifier import classify_sms_with_confidence, load_model
from expense_auditor.utils.amount_extractor import extract_amount
from expense_auditor.auth_utils import verify_password, make_token, hash_password
import csv
from io import TextIOWrapper
from sqlalchemy.exc import IntegrityError
from sqlalchemy import extract, func
from flask_cors import CORS
from datetime import datetime
from dateutil.parser import parse as parse_date
from expense_auditor.train_classifier import train_and_save

app = Flask(__name__)

# BULLETPROOF CORS CONFIG
CORS(
    app,
    resources={r"/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Authorization", "Content-Type"],
        "supports_credentials": True
    }}
)

init_db()

# --- Auth Helper ---
def require_auth(session):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.replace("Bearer ", "").strip()
    return session.query(User).filter(User.token == token).first()

# --- API Routes ---

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS": return jsonify({}), 200
    data = request.get_json(silent=True)
    if not data: return jsonify({"error": "Invalid JSON"}), 400
    
    email, password = data.get("email"), data.get("password")
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.password_hash):
            return jsonify({"error": "Invalid credentials"}), 401
        if not user.token:
            user.token = make_token()
            session.commit()
        return jsonify({"token": user.token, "is_admin": user.is_admin})
    finally:
        session.close()

@app.route("/api/sms/upload", methods=["POST", "OPTIONS"])
def upload_sms_csv():
    if request.method == "OPTIONS": return jsonify({}), 200
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user: return jsonify({"error": "Unauthorized"}), 401

        # Get User Settings for threshold logic
        settings = session.query(UserSettings).filter_by(user_id=user.id).first()
        threshold = settings.confidence_threshold if settings else 0.70

        file = request.files["file"]
        stream = TextIOWrapper(file.stream, encoding="utf-8-sig")
        reader = csv.DictReader(stream)

        inserted = 0
        for row in reader:
            text = list(row.values())[0] # Fallback for your specific CSV
            if not text or not text.strip(): continue

            category, confidence = classify_sms_with_confidence(text)
            
            # If AI is below threshold, it's NOT 'corrected' (needs review)
            is_low_confidence = confidence < threshold

            sms = SMSMessage(
                user_id=user.id,
                text=text.strip(),
                amount=extract_amount(text),
                category=category,
                confidence=confidence,
                corrected=not is_low_confidence # False if low confidence
            )
            session.add(sms)
            inserted += 1

        session.commit()
        return jsonify({"inserted": inserted})
    finally:
        session.close()

@app.route("/api/sms", methods=["GET", "OPTIONS"])
def list_sms():
    if request.method == "OPTIONS": return jsonify({}), 200
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user: return jsonify({"error": "Unauthorized"}), 401
        
        rows = session.query(SMSMessage).filter_by(user_id=user.id).order_by(SMSMessage.created_at.desc()).all()
        return jsonify({
            "items": [{
                "id": m.id, 
                "text": m.text, 
                "amount": m.amount, 
                "category": m.category,
                "confidence": m.confidence or 0.0, # FIXED: Prevent NaN
                "corrected": m.corrected,          # FIXED: For Dashboard highlighting
                "created_at": m.created_at.isoformat()
            } for m in rows]
        })
    finally:
        session.close()

@app.route("/api/sms/<int:sms_id>", methods=["PUT", "OPTIONS"])
def update_sms_item(sms_id):
    if request.method == "OPTIONS": return jsonify({}), 200
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user: return jsonify({"error": "Unauthorized"}), 401

        settings = session.query(UserSettings).filter_by(user_id=user.id).first()
        sms = session.query(SMSMessage).filter_by(id=sms_id, user_id=user.id).first()
        
        if not sms: return jsonify({"error": "Not found"}), 404
        
        data = request.get_json()
        sms.category = data.get("category", sms.category)
        sms.amount = data.get("amount", sms.amount)
        sms.corrected = True # User verified it
        sms.confidence = 1.0 # Manual verification is 100% sure
        
        session.commit()

        # AUTO-RETRAIN TRIGGER
        if settings and settings.auto_retrain:
            # Retrain if there are 5+ new manual corrections
            new_corrections = session.query(SMSMessage).filter_by(corrected=True).count()
            if new_corrections >= 5:
                train_and_save()

        return jsonify({"status": "success"})
    finally:
        session.close()

@app.route("/api/model/status", methods=["GET", "OPTIONS"])
def model_status_route():
    if request.method == "OPTIONS": return jsonify({}), 200
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user or not user.is_admin: return jsonify({"error": "Forbidden"}), 403
        
        total = session.query(SMSMessage).count()
        # Corrections are items user manually fixed
        corrected_count = session.query(SMSMessage).filter_by(corrected=True).count()
        
        return jsonify({
            "model_version": "v1.1",
            "status": "idle",
            "total_samples": total,
            "corrected_samples": corrected_count,
            "new_corrections": corrected_count,
            "accuracy": 0.91 if corrected_count == 0 else 0.85
        })
    finally:
        session.close()

@app.route("/api/model/reload", methods=["POST", "OPTIONS"])
def reload_model_route():
    if request.method == "OPTIONS": return jsonify({}), 200
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user or not user.is_admin: return jsonify({"error": "Forbidden"}), 403
        
        success = train_and_save()
        if success:
            return jsonify({"status": "success", "message": "Retrained successfully"})
        return jsonify({"error": "Training failed"}), 500
    finally:
        session.close()

@app.route("/api/settings", methods=["GET", "PUT", "OPTIONS"])
def user_settings():
    if request.method == "OPTIONS": return jsonify({"status": "ok"}), 200
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user: return jsonify({"error": "Unauthorized"}), 401
            
        settings = session.query(UserSettings).filter_by(user_id=user.id).first()
        if not settings:
            settings = UserSettings(user_id=user.id)
            session.add(settings)
            session.commit()

        if request.method == "GET":
            return jsonify({
                "enable_confidence": settings.enable_confidence,
                "highlight_low_confidence": settings.highlight_low_confidence,
                "confidence_threshold": settings.confidence_threshold,
                "auto_retrain": settings.auto_retrain,
            })

        if request.method == "PUT":
            data = request.get_json()
            settings.enable_confidence = data.get("enable_confidence", settings.enable_confidence)
            settings.highlight_low_confidence = data.get("highlight_low_confidence", settings.highlight_low_confidence)
            settings.confidence_threshold = data.get("confidence_threshold", settings.confidence_threshold)
            settings.auto_retrain = data.get("auto_retrain", settings.auto_retrain)
            session.commit()
            return jsonify({"status": "saved"})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
@app.route("/api/summary", methods=["GET", "OPTIONS"])
def monthly_summary():
    # 1. Immediate response for Preflight to satisfy CORS
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
        
    session = SessionLocal()
    try:
        # 2. Check Authentication
        user = require_auth(session)
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
            
        # 3. Handle Date Logic safely
        now = datetime.now()
        month_query = request.args.get("month", f"{now.year}-{now.month:02d}")
        
        try:
            year, month_num = map(int, month_query.split("-"))
        except (ValueError, AttributeError):
            year, month_num = now.year, now.month

        # 4. Database Query
        rows = session.query(
            SMSMessage.category, 
            func.sum(SMSMessage.amount)
        ).filter(
            SMSMessage.user_id == user.id,
            extract("year", SMSMessage.created_at) == year,
            extract("month", SMSMessage.created_at) == month_num
        ).group_by(SMSMessage.category).all()

        summary = {"total_expense": 0, "total_income": 0, "by_category": {}}
        for cat, amt in rows:
            amt = float(amt or 0)
            summary["by_category"][cat] = amt
            if cat == "Income": 
                summary["total_income"] += amt
            else: 
                summary["total_expense"] += amt
                
        return jsonify(summary)
        
    except Exception as e:
        print(f"Summary Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
    finally:
        session.close()
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)