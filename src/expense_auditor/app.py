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
        if "file" not in request.files: return jsonify({"error": "No file"}), 400

        file = request.files["file"]
        stream = TextIOWrapper(file.stream, encoding="utf-8-sig")
        reader = csv.DictReader(stream)

        inserted, skipped = 0, 0
        for row in reader:
            # Robust logic to find the text column
            text = next((val for key, val in row.items() if key and any(x in key.lower() for x in ["text", "body", "sms", "message"])), None)
            if not text and row.items(): text = list(row.values())[0] # Fallback
            
            if not text or not text.strip():
                skipped += 1
                continue

            amount = extract_amount(text)
            category, confidence = classify_sms_with_confidence(text)
            
            sms = SMSMessage(
                user_id=user.id, text=text.strip(), amount=amount,
                category=category, confidence=confidence,
                corrected=False, created_at=datetime.utcnow()
            )
            try:
                session.add(sms)
                session.flush()
                inserted += 1
            except:
                session.rollback()
                skipped += 1

        session.commit()
        return jsonify({"inserted": inserted, "skipped": skipped})
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
                "id": m.id, "text": m.text, "amount": m.amount, 
                "category": m.category, "created_at": m.created_at.isoformat()
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
        sms = session.query(SMSMessage).filter_by(id=sms_id, user_id=user.id).first()
        if not sms: return jsonify({"error": "Not found"}), 404
        
        data = request.get_json()
        sms.category = data.get("category", sms.category)
        sms.amount = data.get("amount", sms.amount)
        sms.corrected = True
        session.commit()
        return jsonify({"status": "success"})
    finally:
        session.close()

@app.route("/api/summary", methods=["GET", "OPTIONS"])
def monthly_summary():
    if request.method == "OPTIONS": return jsonify({}), 200
    session = SessionLocal()
    try:
        user = require_auth(session)
        now = datetime.now()
        month_query = request.args.get("month", f"{now.year}-{now.month:02d}")
        year, month_num = map(int, month_query.split("-"))

        rows = session.query(SMSMessage.category, func.sum(SMSMessage.amount)).filter(
            SMSMessage.user_id == user.id,
            extract("year", SMSMessage.created_at) == year,
            extract("month", SMSMessage.created_at) == month_num
        ).group_by(SMSMessage.category).all()

        summary = {"total_expense": 0, "total_income": 0, "by_category": {}}
        for cat, amt in rows:
            amt = float(amt or 0)
            summary["by_category"][cat] = amt
            if cat == "Income": summary["total_income"] += amt
            else: summary["total_expense"] += amt
        return jsonify(summary)
    finally:
        session.close()

# --- ADMIN ROUTES (Fixed Duplicates) ---

@app.route("/api/model/status", methods=["GET", "OPTIONS"])
def model_status_route(): # Changed name to avoid conflict
    if request.method == "OPTIONS": return jsonify({}), 200
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user or not user.is_admin: return jsonify({"error": "Forbidden"}), 403
        
        total = session.query(SMSMessage).count()
        corrected = session.query(SMSMessage).filter_by(corrected=True).count()
        
        return jsonify({
            "model_version": "v1.0",
            "status": "idle",
            "total_samples": total,
            "corrected_samples": corrected,
            "new_corrections": corrected,
            "accuracy": 0.85
        })
    finally:
        session.close()



@app.route("/api/model/reload", methods=["POST", "OPTIONS"])
def reload_model_route():
    if request.method == "OPTIONS": return jsonify({}), 200
    
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user or not user.is_admin:
            return jsonify({"error": "Forbidden"}), 403

        # Execute the actual training logic
        success = train_and_save()

        if success:
            return jsonify({
                "status": "success", 
                "message": "Model retrained successfully. Corrections processed."
            })
        else:
            return jsonify({"error": "Training failed or no data available"}), 500
    finally:
        session.close()
@app.route("/api/settings", methods=["GET", "PUT", "OPTIONS"])
def user_settings():
    # 1. Immediate response for Preflight
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
        
    session = SessionLocal()
    try:
        # 2. Check Auth
        user = require_auth(session)
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
            
        # 3. Find or Create Settings
        settings = session.query(UserSettings).filter_by(user_id=user.id).first()
        if not settings:
            settings = UserSettings(user_id=user.id)
            session.add(settings)
            session.commit()

        # 4. Handle GET request
        if request.method == "GET":
            return jsonify({
                "enable_confidence": settings.enable_confidence,
                "highlight_low_confidence": settings.highlight_low_confidence,
                "confidence_threshold": settings.confidence_threshold,
                "auto_retrain": settings.auto_retrain,
            })

        # 5. Handle PUT request
        if request.method == "PUT":
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
                
            settings.enable_confidence = data.get("enable_confidence", settings.enable_confidence)
            settings.highlight_low_confidence = data.get("highlight_low_confidence", settings.highlight_low_confidence)
            settings.confidence_threshold = data.get("confidence_threshold", settings.confidence_threshold)
            settings.auto_retrain = data.get("auto_retrain", settings.auto_retrain)
            
            session.commit()
            return jsonify({"status": "saved"})
            
    except Exception as e:
        print(f"Settings Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
    finally:
        session.close()
if __name__ == "__main__":
    app.run(debug=True, port=5000)