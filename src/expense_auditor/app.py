# src/expense_auditor/app.py
from flask import Flask, request, jsonify, abort
from expense_auditor.db import init_db, SessionLocal, SMSMessage, User
from expense_auditor.sms_classifier import classify_sms_with_confidence
from expense_auditor.utils.amount_extractor import extract_amount
from expense_auditor.auth_utils import verify_password, make_token
from expense_auditor.sms_classifier import load_model
from expense_auditor.auth_utils import hash_password
from expense_auditor.db import UserSettings
import csv
from io import TextIOWrapper
from werkzeug.utils import secure_filename
from sqlalchemy.exc import IntegrityError
from sqlalchemy import extract, func
from flask_cors import CORS

from datetime import datetime

app = Flask(__name__)

CORS(
    app,
    resources={r"/*": {"origins": "http://localhost:5173"}},
    allow_headers=["Authorization", "Content-Type"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

init_db()
def require_admin(session):
    user = require_auth(session)
    if not user.is_admin:
        abort(403, description="Admin access required")
    return user

@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(404)
def handle_error(err):
    response = {
        "error": err.name,
        "message": err.description
    }
    return jsonify(response), err.code

# -----------------------
# Public routes
# -----------------------
@app.route("/api/model/status", methods=["GET"])
def model_status():
    session = SessionLocal()
    try:
        user = require_auth(session)
        if not user.is_admin:
            abort(403, description="Admin access required")

        return jsonify({
            "model_version": "v1",
            "last_trained_at": None,
            "training_samples": None,
            "accuracy": None
        })
    finally:
        session.close()

@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}

@app.route("/api/sms/upload", methods=["POST"])
def upload_sms_csv():
    session = SessionLocal()
    try:
        user = require_auth(session)

        if "file" not in request.files:
            abort(400, description="CSV file required")

        file = request.files["file"]
        if not file.filename.endswith(".csv"):
            abort(400, description="Only CSV files allowed")

        import csv
        from io import TextIOWrapper
        from dateutil.parser import parse as parse_date

        try:
            # Detect encoding? default utf-8 usually fine for generated files
            reader = csv.DictReader(TextIOWrapper(file, encoding="utf-8"))
        except Exception:
            abort(400, description="Invalid CSV format")

        inserted = 0
        skipped = 0

        for row in reader:
            # Normalize column names
            text = row.get("text") or row.get("source_text") or row.get("body")
            if not text:
                skipped += 1
                continue

            # Amount logic
            amount = row.get("amount")
            if amount and str(amount).strip():
                try:
                    amount = float(amount)
                except ValueError:
                    amount = extract_amount(text)
            else:
                amount = extract_amount(text)

            # Date logic
            date_str = row.get("date") or row.get("created_at")
            sms_date = None
            if date_str:
                try:
                    sms_date = parse_date(date_str)
                except Exception:
                    sms_date = datetime.utcnow() # Fallback if unparseable
            
            # Category logic
            category = row.get("category") or row.get("probable_category") or "Unknown"

            # Create object
            sms = SMSMessage(
                user_id=user.id,
                text=text.strip(),
                amount=amount,
                category=category,
                corrected=False,
                created_at=sms_date if sms_date else datetime.utcnow()
            )

            try:
                session.add(sms)
                session.flush()        # try insert
                inserted += 1
            except IntegrityError:
                session.rollback()     # rollback only failed row
                skipped += 1
            except Exception as e:
                # Catch other errors per row to continue processing
                session.rollback()
                skipped += 1

        session.commit()  # Commit all successful inserts

        return jsonify({
            "inserted": inserted,
            "skipped": skipped
        })

    finally:
        session.close()


@app.route("/api/model/reload", methods=["POST"])
def reload_model():
    session = SessionLocal()
    try:
        user = require_admin(session)
        # retrain logic here
        return {"status": "model reloaded"}
    finally:
        session.close()


@app.route("/api/summary", methods=["GET"])
def monthly_summary():
    session = SessionLocal()
    try:
        user = require_auth(session)

        month = request.args.get("month")  # YYYY-MM
        if not month or len(month) != 7:
            abort(400, description="Invalid month format. Use YYYY-MM")

        year, month_num = map(int, month.split("-"))

        rows = (
            session.query(
                SMSMessage.category,
                func.sum(SMSMessage.amount).label("total"),
            )
            .filter(
                SMSMessage.user_id == user.id,
                SMSMessage.amount.isnot(None),
                extract("year", SMSMessage.created_at) == year,
                extract("month", SMSMessage.created_at) == month_num,
            )
            .group_by(SMSMessage.category)
            .all()
        )

        by_category = {}
        total_expense = 0
        total_income = 0

        for category, total in rows:
            total = float(total or 0)
            by_category[category] = total

            if category == "Income":
                total_income += total
            elif category != "Unknown":
                total_expense += total

        return jsonify({
            "month": month,
            "total_expense": total_expense,
            "total_income": total_income,
            "by_category": by_category,
        })

    finally:
        session.close()
@app.route("/api/sms/<int:sms_id>", methods=["PUT"])
def update_sms(sms_id):
    session = SessionLocal()
    try:
        user = require_auth(session)

        sms = (
            session.query(SMSMessage)
            .filter(SMSMessage.id == sms_id, SMSMessage.user_id == user.id)
            .first()
        )

        if not sms:
            abort(404, description="SMS not found")

        data = request.get_json()
        sms.category = data.get("category", sms.category)
        sms.amount = data.get("amount", sms.amount)
        sms.corrected = True

        session.commit()
        return {"status": "updated"}

    finally:
        session.close()

@app.route("/api/settings", methods=["GET", "PUT"])
def user_settings():
    session = SessionLocal()
    user = require_auth(session)

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

    data = request.get_json()

    settings.enable_confidence = data.get("enable_confidence", settings.enable_confidence)
    settings.highlight_low_confidence = data.get("highlight_low_confidence", settings.highlight_low_confidence)
    settings.confidence_threshold = data.get("confidence_threshold", settings.confidence_threshold)
    settings.auto_retrain = data.get("auto_retrain", settings.auto_retrain)

    session.commit()
    return jsonify({"status": "saved"})

        
@app.route("/api/export/corrections", methods=["GET"])
def export_corrections():
    session = SessionLocal()
    try:
        user = require_auth(session)

        rows = (
            session.query(SMSMessage)
            .filter(
                SMSMessage.user_id == user.id,
                SMSMessage.corrected == True
            )
            .all()
        )

        return jsonify([
            {
                "text": r.text,
                "amount": r.amount,
                "category": r.category
            }
            for r in rows
        ])

    finally:
        session.close()

@app.route("/", methods=["GET"])
def index():
    return {
        "message": "Personal Expense Auditor API",
        "endpoints": {
            "health": "/health",
            "login": "/login (POST)",
            "ingest_sms": "/api/sms (POST)",
            "list_sms": "/api/sms (GET)"
        }
    }
@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(force=True)

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        abort(400, description="Email and password required")

    session = SessionLocal()
    try:
        existing = session.query(User).filter(User.email == email).first()
        if existing:
            abort(400, description="User already exists")

        user = User(
            email=email,
            password_hash=hash_password(password),
            is_admin=False  # 🔒 IMPORTANT
        )

        session.add(user)
        session.commit()

        return jsonify({
            "message": "Signup successful. Please login."
        })

    finally:
        session.close()



@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not data:
        abort(400, description="Invalid or missing JSON body")

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        abort(400, description="Email and password required")

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()

        if not user or not verify_password(password, user.password_hash):
            abort(401, description="Invalid credentials")

        if not user.token:
            user.token = make_token()
            session.commit()

        return jsonify({
            "token": user.token,
            "is_admin": user.is_admin
        })


    finally:
        session.close()


# -----------------------
# Auth helper
# -----------------------

def require_auth(session):
    auth = request.headers.get("Authorization", "")

    if not auth.startswith("Bearer "):
        abort(401, description="Missing or invalid Authorization header")

    token = auth.replace("Bearer ", "").strip()
    user = session.query(User).filter(User.token == token).first()

    if not user:
        abort(401, description="Invalid token")

    return user

def require_admin(session):
    user = require_auth(session)
    if not user.is_admin:
        abort(403, description="Admin access required")
    return user


# -----------------------
# Protected APIs
# -----------------------

@app.route("/api/sms", methods=["POST"])
def ingest_sms():
    session = SessionLocal()
    try:
        user = require_auth(session)

        data = request.get_json(force=True)
        text = data.get("text", "")

        if not text:
            abort(400, description="SMS text is required")

        category, confidence = classify_sms_with_confidence(text)

        amount = extract_amount(text)

        sms = SMSMessage(
    user_id=user.id,
    text=text,
    amount=amount,
    category=category,
    confidence=confidence,
    corrected=False,
)


        session.add(sms)
        session.commit()

        return jsonify({
            "text": text,
            "amount": amount,
            "category": category
        })

    finally:
        session.close()

@app.route("/api/sms", methods=["GET"])
def list_sms():
    session = SessionLocal()
    try:
        user = require_auth(session)

        # pagination
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))

        if page < 1:
            abort(400, description="page must be >= 1")
        if limit < 1 or limit > 100:
            abort(400, description="limit must be between 1 and 100")

        offset = (page - 1) * limit

        # filters
        category = request.args.get("category")
        from_date = request.args.get("from")
        to_date = request.args.get("to")
        search = request.args.get("search")
        sort = request.args.get("sort", "created_at")
        order = request.args.get("order", "desc")


        query = session.query(SMSMessage).filter(
            SMSMessage.user_id == user.id
        )

        if category:
            query = query.filter(SMSMessage.category == category)
        if search:
            query = query.filter(SMSMessage.text.ilike(f"%{search}%"))


        if from_date:
            try:
                start = datetime.fromisoformat(from_date)
                query = query.filter(SMSMessage.created_at >= start)
            except ValueError:
                abort(400, description="Invalid from date (YYYY-MM-DD)")

        if to_date:
            try:
                end = datetime.fromisoformat(to_date)
                query = query.filter(SMSMessage.created_at <= end)
            except ValueError:
                abort(400, description="Invalid to date (YYYY-MM-DD)")

        total = query.count()

        SORT_FIELDS = {
            "created_at": SMSMessage.created_at,
            "amount": SMSMessage.amount,
            "category": SMSMessage.category,
        }

        if sort not in SORT_FIELDS:
            abort(400, description="Invalid sort field")

        column = SORT_FIELDS[sort]

        if order == "asc":
            query = query.order_by(column.asc())
        elif order == "desc":
            query = query.order_by(column.desc())
        else:
            abort(400, description="order must be asc or desc")


        rows = (
            query
            .offset(offset)
            .limit(limit)
            .all()
        )

        return jsonify({
            "page": page,
            "limit": limit,
            "total": total,
            "items": [
                {
                    "id": m.id,
                    "text": m.text,
                    "amount": m.amount,
                    "category": m.category,
                    "corrected": m.corrected,
                    "created_at": m.created_at.isoformat() if m.created_at else None
                }
                for m in rows
            ]
        })

    finally:
        session.close()

if __name__ == "__main__":
    app.run(debug=True)
