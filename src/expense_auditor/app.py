# src/expense_auditor/app.py
from flask import Flask, request, jsonify, abort
from expense_auditor.db import init_db, SessionLocal, SMSMessage, User
from expense_auditor.sms_classifier import classify_sms
from expense_auditor.utils.amount_extractor import extract_amount
from expense_auditor.auth_utils import verify_password, make_token
from expense_auditor.sms_classifier import load_model
from expense_auditor.auth_utils import hash_password
import csv
from io import TextIOWrapper
from werkzeug.utils import secure_filename
from sqlalchemy.exc import IntegrityError

from flask_cors import CORS

from sqlalchemy import func
from datetime import datetime

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])
init_db()

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

@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}

@app.route("/api/sms/upload", methods=["POST"])
def upload_sms_csv():
    session = SessionLocal()
    try:
        # 🔐 auth
        user = require_auth(session)

        if "file" not in request.files:
            abort(400, description="No file uploaded")

        file = request.files["file"]

        if file.filename == "":
            abort(400, description="Empty filename")

        filename = secure_filename(file.filename)

        if not filename.lower().endswith(".csv"):
            abort(400, description="Only CSV files are allowed")

        reader = csv.DictReader(
            file.stream.read().decode("utf-8-sig").splitlines()
        )

        inserted = 0

        for row in reader:
            text = row.get("text") or row.get("message")
            if not text:
                continue

            category = classify_sms(text)
            amount = extract_amount(text)

            sms = SMSMessage(
                user_id=user.id,
                text=text,
                category=category,
                amount=amount,
                corrected=False,
            )

            try:
                session.add(sms)
                session.flush()  # force insert
                inserted += 1
            except IntegrityError:
                session.rollback()

        session.commit()

        return jsonify({
            "message": "SMS uploaded successfully",
            "inserted": inserted
        })

    finally:
        session.close()


@app.route("/api/model/reload", methods=["POST"])
def reload_model():
    session = SessionLocal()
    try:
        user = require_auth(session)

        require_admin(user)


        load_model(force_reload=True)

        return jsonify({
            "status": "model reloaded"
        })

    finally:
        session.close()


@app.route("/api/summary", methods=["GET"])
def monthly_summary():
    session = SessionLocal()
    try:
        user = require_auth(session)

        month = request.args.get("month")
        if not month:
            abort(400, description="month query param required (YYYY-MM)")

        try:
            start = datetime.strptime(month + "-01", "%Y-%m-%d")
        except ValueError:
            abort(400, description="Invalid month format. Use YYYY-MM")

        # end = first day of next month
        if start.month == 12:
            end = datetime(start.year + 1, 1, 1)
        else:
            end = datetime(start.year, start.month + 1, 1)

        rows = (
            session.query(
                SMSMessage.category,
                func.sum(SMSMessage.amount).label("total")
            )
            .filter(
                SMSMessage.user_id == user.id,
                SMSMessage.amount.isnot(None),
                SMSMessage.created_at >= start,
                SMSMessage.created_at < end,
            )
            .group_by(SMSMessage.category)
            .all()
        )

        total_expense = 0.0
        total_income = 0.0
        by_category = {}

        for category, total in rows:
            amount = float(total or 0)
            by_category[category] = amount

            cat = category.lower()

            if cat == "income":
                total_income += amount
            elif cat == "expense":
                total_expense += amount
            # everything else (Unknown, Refund, etc.) is excluded from totals

        return jsonify({
            "month": month,
            "total_expense": round(total_expense, 2),
            "total_income": round(total_income, 2),
            "by_category": by_category
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
            .filter(
                SMSMessage.id == sms_id,
                SMSMessage.user_id == user.id
            )
            .first()
        )

        if not sms:
            abort(404, description="SMS not found")

        data = request.get_json(silent=True)
        if not data:
            abort(400, description="Invalid or missing JSON body")

        updated = False

        if "category" in data:
            sms.category = data["category"]
            updated = True

        if "amount" in data:
            sms.amount = data["amount"]
            updated = True

        if not updated:
            abort(400, description="No valid fields to update")

        sms.corrected = True
        session.commit()

        return jsonify({
            "id": sms.id,
            "category": sms.category,
            "amount": sms.amount,
            "corrected": sms.corrected
        })

    finally:
        session.close()


        
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

def require_admin(user):
    if not user.is_admin:
        abort(403, description="Admin access required")

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

        category = classify_sms(text)
        amount = extract_amount(text)

        sms = SMSMessage(
            user_id=user.id,
            text=text,
            amount=amount,
            category=category,
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
