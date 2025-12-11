import os
import json
from datetime import datetime

import pandas as pd
from flask import (
    Flask,
    request,
    render_template_string,
    redirect,
    url_for,
    flash,
    jsonify,
    Response,
)

from flask_cors import CORS

from import_android_sms import parse_android_sms_xml
from analyze_sms_file import classify_sms_file
from summarize_expenses import summarize_with_amounts
from db import SessionLocal, init_db, SMSMessage, User, Budget
from auth_utils import hash_password, verify_password, make_token
from sms_classifier import classify_sms_text, extract_amount
from sqlalchemy import func
import secrets
from sqlalchemy.exc import NoResultFound
import subprocess
import json
import shlex
from datetime import datetime

from joblib import load
import re

# Load ML model once at startup
CATEGORY_MODEL = load("models/category_model.joblib")

# Amount extraction regex ( INR / Rs / AED / ₹ )
AMOUNT_REGEX = re.compile(
    r'(?i)(?:rs|inr|aed|₹)\s*[\.:]?\s*([0-9,]+(?:\.\d+)?)'
)

# -----------------------------------------------------------------------------
# Flask app setup
# -----------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
app.secret_key = "dev-secret-key"  # needed for flash messages; change later
init_db()

# -----------------------------------------------------------------------------
# Paths / constants
# -----------------------------------------------------------------------------
UPLOAD_FOLDER = os.path.join("data", "raw")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

SUMMARY_JSON = os.path.join("data", "processed", "web_summary.json")
CORRECTIONS_CSV = os.path.join("data", "processed", "corrections_web.csv")
RETRAIN_STATUS_PATH = os.path.join("data", "processed", "retrain_status.json")

ALLOWED_EXTENSIONS = {"xml", "csv"}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def _get_user_by_id(session, user_id):
    try:
        return session.get(User, int(user_id))
    except Exception:
        return None
    

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def load_summary():
    if os.path.exists(SUMMARY_JSON):
        try:
            with open(SUMMARY_JSON, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        except Exception as e:
            print("[SUMMARY][LOAD][ERROR]", e)
    return None


def sync_amounts_csv_to_db(user_id: int):
    """
    Read auto_dataset_amounts_web.csv and insert ONLY NEW rows for this user
    into sms_messages table.

    "New" is defined as (same user_id, text, amount, date) not already present.
    """
    csv_path = os.path.join("data", "processed", "auto_dataset_amounts_web.csv")
    if not os.path.exists(csv_path):
        print("[SYNC DB] CSV not found, skipping DB sync.")
        return

    try:
        df = pd.read_csv(csv_path, encoding="ISO-8859-1")
    except Exception as e:
        print("[SYNC DB] Failed to read CSV:", e)
        return

    required_cols = {"source_text", "predicted_category", "amount"}
    if not required_cols.issubset(df.columns):
        print("[SYNC DB] CSV missing required columns, skipping.")
        return

    session = SessionLocal()
    try:
        # Existing rows for this user
        existing = session.query(SMSMessage).filter(
            SMSMessage.user_id == user_id
        ).all()

        existing_keys = set()
        for msg in existing:
            key = (
                msg.text,
                float(msg.amount or 0.0),
                msg.date.date().isoformat() if msg.date else None,
            )
            existing_keys.add(key)

        count = 0
        for _, row in df.iterrows():
            try:
                dt = None
                if "date" in df.columns and isinstance(row.get("date"), str):
                    try:
                        dt = pd.to_datetime(row["date"], errors="coerce")
                    except Exception:
                        dt = None

                amt = float(row.get("amount", 0.0))
                text = str(row["source_text"])
                cat = str(row.get("predicted_category", "Other"))

                key = (
                    text,
                    amt,
                    dt.date().isoformat() if dt is not None else None,
                )

                if key in existing_keys:
                    # Already stored for this user → skip
                    continue

                msg = SMSMessage(
                    user_id=user_id,
                    date=dt,
                    text=text,
                    amount=amt,
                    category=cat,
                    corrected=False,
                )
                session.add(msg)
                existing_keys.add(key)
                count += 1

            except Exception as e:
                print("[SYNC DB] Skipped row:", e)

        session.commit()
        print(f"[SYNC DB] Inserted {count} NEW rows for user_id={user_id}.")
    except Exception as e:
        session.rollback()
        print("[SYNC DB] DB error:", e)
    finally:
        session.close()


def get_user_id_from_request():
    """
    Read token from Authorization header and map it to user_id
    using data/tokens.json created at login.
    Returns user_id (int) or None if invalid/missing.
    """
    auth_header = request.headers.get("Authorization", "").strip()
    if not auth_header:
        return None

    # Expect "Bearer <token>" or just "<token>"
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    else:
        token = auth_header

    tokens_file = os.path.join("data", "tokens.json")
    if not os.path.exists(tokens_file):
        return None

    try:
        with open(tokens_file, "r") as f:
            tokens = json.load(f)
    except Exception:
        return None

    user_id = tokens.get(token)
    return user_id


def _get_months_for_user(session, user_id: int):
    """
    Return sorted list of 'YYYY-MM' strings where this user has dated messages.
    """
    dates = (
        session.query(SMSMessage.date)
        .filter(SMSMessage.user_id == user_id, SMSMessage.date.isnot(None))
        .all()
    )
    ym = set()
    for (dt,) in dates:
        if dt:
            ym.add(dt.strftime("%Y-%m"))
    return sorted(ym)


# -----------------------------------------------------------------------------
# HTML upload page (for manual testing in browser)
# -----------------------------------------------------------------------------
UPLOAD_PAGE = """
<!doctype html>
<html>
  <head>
    <title>Personal Expense Auditor</title>
  </head>
  <body>
    <h1>Personal Expense Auditor</h1>

    {% with messages = get_flashed_messages() %}
      {% if messages %}
        <ul>
        {% for msg in messages %}
          <li>{{ msg }}</li>
        {% endfor %}
        </ul>
      {% endif %}
    {% endwith %}

    <h2>1. Upload SMS Backup File</h2>
    <form method="post" action="{{ url_for('upload') }}" enctype="multipart/form-data">
      <p>
        <label>Select XML (SMS Backup) or CSV file:</label><br>
        <input type="file" name="file">
      </p>
      <p>
        <button type="submit">Upload & Process</button>
      </p>
    </form>

    {% if summary %}
      <hr>
      <h2>2. Current Summary</h2>
      <p><b>Total spent (Debit + Shopping/UPI):</b> ₹{{ "%.2f"|format(summary.total_spent) }}</p>
      <p><b>Total in (Credit + Refund):</b> ₹{{ "%.2f"|format(summary.total_income) }}</p>
      <p><b>Net (in - spent):</b> ₹{{ "%.2f"|format(summary.net) }}</p>

      <h3>Category-wise totals</h3>
      <table border="1" cellpadding="4" cellspacing="0">
        <tr>
          <th>Category</th>
          <th>Amount (₹)</th>
        </tr>
        {% for cat, amt in category_totals.items() %}
        <tr>
          <td>{{ cat }}</td>
          <td>{{ "%.2f"|format(amt) }}</td>
        </tr>
        {% endfor %}
      </table>
    {% else %}
      <p>No processed data yet. Upload a file to see your summary.</p>
    {% endif %}
  </body>
</html>
"""

# -----------------------------------------------------------------------------
# Auth routes
# -----------------------------------------------------------------------------
def _save_retrain_status(status: dict):
    os.makedirs(os.path.dirname(RETRAIN_STATUS_PATH), exist_ok=True)
    with open(RETRAIN_STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=2)

def _load_retrain_status():
    if not os.path.exists(RETRAIN_STATUS_PATH):
        return None
    try:
        return json.load(open(RETRAIN_STATUS_PATH, "r", encoding="utf-8"))
    except Exception:
        return None

@app.route("/api/retrain", methods=["POST"])
def api_retrain():
    """
    Admin-only: trigger model retraining.
    Runs the existing training script as a subprocess.
    Returns start/end time, success flag and captured logs.
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        caller = session.get(User, user_id)
        if not caller or not getattr(caller, "is_admin", False):
            return jsonify({"error": "forbidden"}), 403
    finally:
        session.close()

    start_ts = datetime.utcnow().isoformat()
    status = {
        "status": "running",
        "started_at": start_ts,
        "finished_at": None,
        "success": False,
        "message": None,
        "stdout": "",
        "stderr": "",
    }
    _save_retrain_status(status)

    # Compose command to run your training script. Adjust if script name differs.
    # Using shlex for safe tokenization; use full python path if needed
    cmd = "python train_category_model.py"

    try:
        # Run synchronously and capture output
        proc = subprocess.run(
            shlex.split(cmd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=os.getcwd(),
            timeout=60*60  # 1 hour timeout (adjust if necessary)
        )
        stdout = proc.stdout.decode("utf-8", errors="replace")
        stderr = proc.stderr.decode("utf-8", errors="replace")
        success = proc.returncode == 0

        status.update({
            "status": "finished",
            "finished_at": datetime.utcnow().isoformat(),
            "success": success,
            "message": "completed" if success else f"failed (code {proc.returncode})",
            "stdout": stdout[-20000:],   # keep last N chars to avoid huge JSON
            "stderr": stderr[-20000:],
        })
        _save_retrain_status(status)

        return jsonify({
            "status": status["status"],
            "success": status["success"],
            "message": status["message"],
            "started_at": status["started_at"],
            "finished_at": status["finished_at"],
        })

    except subprocess.TimeoutExpired as te:
        status.update({
            "status": "timeout",
            "finished_at": datetime.utcnow().isoformat(),
            "success": False,
            "message": "timeout",
            "stdout": "",
            "stderr": str(te),
        })
        _save_retrain_status(status)
        return jsonify({"error": "timeout"}), 500
    except Exception as e:
        status.update({
            "status": "error",
            "finished_at": datetime.utcnow().isoformat(),
            "success": False,
            "message": str(e),
        })
        _save_retrain_status(status)
        return jsonify({"error": "server", "details": str(e)}), 500


@app.route("/api/retrain/status", methods=["GET"])
def api_retrain_status():
    """
    Return last retrain status JSON (or 404 if never run).
    """
    st = _load_retrain_status()
    if not st:
        return jsonify({"status": "never_run"}), 404
    return jsonify(st)




@app.route("/admin/users", methods=["GET"])
def admin_list_users():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        caller = _get_user_by_id(session, user_id)
        if not caller or not getattr(caller, "is_admin", False):
            return jsonify({"error": "forbidden"}), 403

        users = session.query(User).order_by(User.id.asc()).all()
        items = []
        for u in users:
            items.append({
                "id": u.id,
                "email": u.email,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "is_admin": bool(u.is_admin),
            })
        return jsonify({"items": items})
    except Exception as e:
        print("[ADMIN USERS][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()

@app.route("/auth/grant-admin", methods=["POST"])
def auth_grant_admin():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        caller = _get_user_by_id(session, user_id)
        if not caller or not getattr(caller, "is_admin", False):
            return jsonify({"error": "forbidden"}), 403

        data = request.json or {}
        target_email = (data.get("email") or "").strip().lower()
        if not target_email:
            return jsonify({"error": "missing_email"}), 400

        target = session.query(User).filter_by(email=target_email).first()
        if not target:
            # create placeholder with random password
            from auth_utils import hash_password
            placeholder_password = secrets.token_urlsafe(16)
            target = User(email=target_email, password_hash=hash_password(placeholder_password), is_admin=True)
            session.add(target)
            session.commit()
            return jsonify({"status": "created_and_promoted", "email": target_email})
        else:
            if target.is_admin:
                return jsonify({"status": "already_admin", "email": target_email})
            target.is_admin = True
            session.commit()
            return jsonify({"status": "promoted", "email": target_email})
    except Exception as e:
        session.rollback()
        print("[GRANT ADMIN][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()
@app.route("/auth/signup", methods=["POST"])
def signup():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "missing_fields"}), 400

    session = SessionLocal()
    try:
        existing = session.query(User).filter_by(email=email).first()
        if existing:
            return jsonify({"error": "email_exists"}), 409

        user = User(
            email=email,
            password_hash=hash_password(password),
        )
        session.add(user)
        session.commit()

        return jsonify({"status": "ok"})
    except Exception as e:
        print("[SIGNUP ERROR]", e)
        session.rollback()
        return jsonify({"error": "server"}), 500
    finally:
        session.close()


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    session = SessionLocal()
    try:
        user = session.query(User).filter_by(email=email).first()
        if not user or not verify_password(password, user.password_hash):
            return jsonify({"error": "invalid_credentials"}), 401

        token = make_token()

        tokens_file = os.path.join("data", "tokens.json")
        os.makedirs("data", exist_ok=True)
        if os.path.exists(tokens_file):
            tokens = json.load(open(tokens_file))
        else:
            tokens = {}

        tokens[token] = user.id
        json.dump(tokens, open(tokens_file, "w"))

        return jsonify({"status": "ok", "token": token})
    except Exception as e:
        print("[LOGIN ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()


@app.route("/auth/me", methods=["GET"])
def auth_me():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        user = session.get(User, user_id)
        if not user:
            return jsonify({"error": "unauthorized"}), 401

        return jsonify({
            "id": user.id,
            "email": user.email,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "is_admin": bool(getattr(user, "is_admin", False)),
        })
    except Exception as e:
        print("[AUTH ME ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()


# -----------------------------------------------------------------------------
# API routes
# -----------------------------------------------------------------------------
@app.route("/api/summary", methods=["GET"])
def api_summary():
    """
    Return summary (spent/income/net + category totals) for the current user.
    Optional: month=YYYY-MM filter.
    """
    user_id = get_user_id_from_request()
    if not user_id:
        user_id = 1  # default single-user mode

    month = request.args.get("month")

    session = SessionLocal()
    try:
        q = session.query(SMSMessage).filter(
            SMSMessage.user_id == user_id,
            SMSMessage.amount.isnot(None),
            SMSMessage.amount > 0,
        )

        if month:
            try:
                year, mon = month.split("-")
                q = q.filter(
                    SMSMessage.date.isnot(None),
                    SMSMessage.date.like(f"{year}-{mon}-%"),
                )
            except Exception:
                pass

        rows = q.all()

        if not rows:
            months_available = _get_months_for_user(session, user_id)
            return jsonify(
                {
                    "total_spent": 0.0,
                    "total_income": 0.0,
                    "net": 0.0,
                    "category_totals": {},
                    "months_available": months_available,
                }
            )

        category_totals = {}
        for msg in rows:
            cat = msg.category
            amt = float(msg.amount or 0.0)
            category_totals[cat] = category_totals.get(cat, 0.0) + amt

        spent = 0.0
        income = 0.0
        for cat, amt in category_totals.items():
            if cat in ["Debit", "Shopping/UPI"]:
                spent += amt
            elif cat in ["Credit", "Refund"]:
                income += amt

        months_available = _get_months_for_user(session, user_id)

        return jsonify(
            {
                "total_spent": float(spent),
                "total_income": float(income),
                "net": float(income - spent),
                "category_totals": category_totals,
                "months_available": months_available,
            }
        )
    except Exception as e:
        print("[API SUMMARY][DB ERROR]", e)
        return jsonify({"error": "db_error"}), 500
    finally:
        session.close()


@app.route("/api/transactions", methods=["GET"])
def api_transactions():
    """
    Return recent transactions for current user from SQLite (sms_messages),
    optionally filtered by month=YYYY-MM.
    """
    user_id = get_user_id_from_request()
    if not user_id:
        user_id = 1  # default user until frontend sends token

    session = SessionLocal()
    try:
        month = request.args.get("month")

        query = session.query(SMSMessage).filter(
            SMSMessage.user_id == user_id,
            SMSMessage.amount.isnot(None),
            SMSMessage.amount > 0,
        )

        if month:
            try:
                year, mon = month.split("-")
                query = query.filter(
                    SMSMessage.date.isnot(None),
                    SMSMessage.date.like(f"{year}-{mon}-%"),
                )
            except Exception:
                pass

        query = query.order_by(
            SMSMessage.date.desc().nullslast(), SMSMessage.id.desc()
        )

        try:
            limit = int(request.args.get("limit", "50"))
        except ValueError:
            limit = 50

        rows = query.limit(limit).all()

        items = []
        for msg in rows:
            items.append(
                {
                    "id": msg.id,
                    "date": msg.date.isoformat(sep=" ") if msg.date else "",
                    "text": msg.text,
                    "category": msg.category,
                    "amount": float(msg.amount or 0.0),
                }
            )

        months_available = _get_months_for_user(session, user_id)

        return jsonify({"items": items, "months_available": months_available})
    except Exception as e:
        print("[API TRANSACTIONS][DB ERROR]", e)
        return jsonify({"error": "db_error"}), 500
    finally:
        session.close()


@app.route("/api/transactions/<int:row_id>", methods=["PATCH"])
def api_update_transaction(row_id: int):
    """
    Update the predicted category for a single transaction row
    and recompute summary + amounts file.
    row_id is the stable ID column in the classified CSV.
    """
    data = request.get_json(silent=True) or {}
    new_category = data.get("category")
    if not new_category:
        return jsonify({"error": "missing_category"}), 400

    classified_csv = os.path.join(
        "data", "processed", "auto_dataset_classified_web.csv"
    )
    amounts_csv = os.path.join(
        "data", "processed", "auto_dataset_amounts_web.csv"
    )

    if not os.path.exists(classified_csv):
        return jsonify({"error": "no_classified_data"}), 404

    try:
        df = pd.read_csv(classified_csv, encoding="ISO-8859-1")
    except Exception as e:
        print("[API TX PATCH][READ ERROR]", e)
        return jsonify({"error": "failed_to_read_classified"}), 500

    if "row_id" not in df.columns:
        return jsonify({"error": "no_row_id_column"}), 500

    match = df.index[df["row_id"] == row_id]
    if len(match) == 0:
        return jsonify({"error": "row_not_found"}), 404

    idx = match[0]

    old_category = str(df.loc[idx, "predicted_category"])
    text = str(df.loc[idx, "source_text"])

    if old_category == new_category:
        return jsonify({"message": "no_change"}), 200

    df.loc[idx, "predicted_category"] = new_category

    try:
        df.to_csv(classified_csv, index=False, encoding="ISO-8859-1")

        summary = summarize_with_amounts(classified_csv, amounts_csv)

        os.makedirs(os.path.dirname(SUMMARY_JSON), exist_ok=True)
        with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
            json.dump(summary, f)

        corr_row = {
            "row_id": row_id,
            "timestamp": datetime.utcnow().isoformat(),
            "text": text,
            "old_category": old_category,
            "new_category": new_category,
        }
        corr_df = pd.DataFrame([corr_row])
        corr_df.to_csv(
            CORRECTIONS_CSV,
            mode="a",
            header=not os.path.exists(CORRECTIONS_CSV),
            index=False,
            encoding="utf-8",
        )

    except Exception as e:
        print("[API TX PATCH][WRITE ERROR]", e)
        return jsonify({"error": "update_failed", "details": str(e)}), 500

    return jsonify(
        {
            "message": "updated",
            "row_id": row_id,
            "old_category": old_category,
            "new_category": new_category,
            "summary": summary,
        }
    )

@app.route("/auth/delete-account", methods=["DELETE"])
def delete_account():
    """
    Delete the current user account AND all their SMS data.
    Requires Authorization: Bearer <token>.
    After this, the token is invalid.
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        # Delete SMS for this user
        sms_deleted = (
            session.query(SMSMessage)
            .filter(SMSMessage.user_id == user_id)
            .delete(synchronize_session=False)
        )

        # Delete user row
        user = session.get(User, user_id)
        if user:
            session.delete(user)

        session.commit()

        # Remove any tokens for this user from tokens.json
        tokens_file = os.path.join("data", "tokens.json")
        if os.path.exists(tokens_file):
            try:
                with open(tokens_file, "r") as f:
                    tokens = json.load(f)
            except Exception:
                tokens = {}

            # Drop all tokens that point to this user_id
            tokens = {
                t: uid for t, uid in tokens.items() if uid != user_id
            }

            with open(tokens_file, "w") as f:
                json.dump(tokens, f)

        print(
            f"[DELETE ACCOUNT] user_id={user_id}, sms_deleted={sms_deleted}"
        )

        return jsonify({
            "status": "ok",
            "sms_deleted": int(sms_deleted),
        })

    except Exception as e:
        session.rollback()
        print("[DELETE ACCOUNT][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()

@app.route("/api/my-data", methods=["DELETE"])
def api_delete_my_data():
    """
    Delete ALL SMS/transactions for the current user.
    Requires Authorization header (token). If no token -> 401.
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        deleted = (
            session.query(SMSMessage)
            .filter(SMSMessage.user_id == user_id)
            .delete(synchronize_session=False)
        )
        session.commit()
        print(f"[DELETE MY DATA] user_id={user_id}, deleted_rows={deleted}")
        return jsonify({"status": "ok", "deleted": int(deleted)})
    except Exception as e:
        session.rollback()
        print("[DELETE MY DATA][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()



@app.route("/api/upload", methods=["POST"])
def api_upload():
    # Try to get user_id from token; fallback to 1 for now if not logged in
    user_id = get_user_id_from_request()
    if not user_id:
        user_id = 1

    if "file" not in request.files:
        return jsonify({"error": "no_file"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "empty_filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "invalid_type"}), 400

    filename = file.filename
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(save_path)
    print(f"[API UPLOAD] Saved file to: {save_path}")

    result_summary = None

    if filename.lower().endswith(".xml"):
        output_csv = os.path.join(
            "data", "processed", "auto_dataset_from_sms_web.csv"
        )
        try:
            parse_android_sms_xml(save_path, output_csv)

            classified_csv = os.path.join(
                "data", "processed", "auto_dataset_classified_web.csv"
            )
            summarized_csv = os.path.join(
                "data", "processed", "auto_dataset_amounts_web.csv"
            )

            classify_sms_file(output_csv, classified_csv)
            result_summary = summarize_with_amounts(
                classified_csv, summarized_csv
            )

            os.makedirs(os.path.dirname(SUMMARY_JSON), exist_ok=True)
            with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
                json.dump(result_summary, f)

            # Sync CSV -> DB for THIS user only
            sync_amounts_csv_to_db(user_id)
        except Exception as e:
            print("[API UPLOAD][ERROR]", e)
            return jsonify(
                {"error": "processing_failed", "details": str(e)}
            ), 500
    else:
        result_summary = None

    return jsonify({"message": "uploaded", "summary": result_summary})


@app.route("/api/ingest-sms", methods=["POST"])
def api_ingest_sms():
    """
    Ingest SMS from mobile app.
    Body: JSON array of { "text": "...", "timestamp": "..." }.
    Requires Authorization: Bearer <token>.
    For each SMS:
      - classify via shared rules + model
      - extract amount
      - parse timestamp
      - insert into DB (if not duplicate)
    Returns:
      - inserted count
      - skipped (duplicates) count
      - updated overall summary for this user
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, list):
        return jsonify(
            {"error": "invalid_payload", "detail": "expected JSON array"}
        ), 400

    session = SessionLocal()
    inserted = 0
    skipped = 0

    try:
        # ---------- load existing keys for this user ----------
        existing_msgs = session.query(SMSMessage).filter(
            SMSMessage.user_id == user_id
        ).all()

        existing_keys = set()
        for m in existing_msgs:
            key = (
                (m.text or "").strip(),
                float(m.amount or 0.0),
                m.date.date().isoformat() if m.date else None,
            )
            existing_keys.add(key)

        # ---------- process incoming messages ----------
        for i, item in enumerate(data):
            if not isinstance(item, dict):
                return jsonify({"error": "invalid_item", "index": i}), 400

            text = str(item.get("text", "")).strip()
            ts_str = item.get("timestamp")

            if not text:
                return jsonify({"error": "missing_text", "index": i}), 400

            # Parse timestamp
            dt = None
            if ts_str:
                try:
                    dt = pd.to_datetime(ts_str, errors="coerce")
                except Exception:
                    dt = None

            # Classify + amount
            predicted = classify_sms_text(text)
            amt = extract_amount(text)

            key = (
                text,
                float(amt),
                dt.date().isoformat() if dt is not None else None,
            )

            # Duplicate check
            if key in existing_keys:
                skipped += 1
                continue

            msg = SMSMessage(
                user_id=user_id,
                date=dt,
                text=text,
                category=predicted,
                amount=amt,
                corrected=False,
            )
            session.add(msg)
            inserted += 1
            existing_keys.add(key)

        session.commit()

        # ---------- compute updated summary from DB ----------
        rows = session.query(SMSMessage).filter(
            SMSMessage.user_id == user_id,
            SMSMessage.amount.isnot(None),
            SMSMessage.amount > 0,
        ).all()

        category_totals = {}
        for msg in rows:
            cat = msg.category
            amt = float(msg.amount or 0.0)
            category_totals[cat] = category_totals.get(cat, 0.0) + amt

        spent = 0.0
        income = 0.0
        for cat, amt in category_totals.items():
            if cat in ["Debit", "Shopping/UPI"]:
                spent += amt
            elif cat in ["Credit", "Refund"]:
                income += amt

        summary = {
            "total_spent": float(spent),
            "total_income": float(income),
            "net": float(income - spent),
            "category_totals": category_totals,
        }

        print(
            f"[INGEST SMS] user_id={user_id}, inserted={inserted}, skipped={skipped}"
        )
        return jsonify(
            {
                "status": "ok",
                "inserted": inserted,
                "skipped": skipped,
                "summary": summary,
            }
        )

    except Exception as e:
        session.rollback()
        print("[INGEST SMS][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()


# -----------------------------------------------------------------------------
# HTML upload routes (for manual testing in browser)
# -----------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def index():
    data = load_summary()
    if data:
        summary = {
            "total_spent": data.get("total_spent", 0.0),
            "total_income": data.get("total_income", 0.0),
            "net": data.get("net", 0.0),
        }
        category_totals = data.get("category_totals", {})
    else:
        summary = None
        category_totals = {}

    return render_template_string(
        UPLOAD_PAGE, summary=summary, category_totals=category_totals
    )


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        flash("No file part in request.")
        return redirect(url_for("index"))

    file = request.files["file"]
    if file.filename == "":
        flash("No file selected.")
        return redirect(url_for("index"))

    if not allowed_file(file.filename):
        flash("Invalid file type. Only XML and CSV are allowed.")
        return redirect(url_for("index"))

    filename = file.filename
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(save_path)

    print(f"[UPLOAD] Saved file to: {save_path}")

    if filename.lower().endswith(".xml"):
        output_csv = os.path.join(
            "data", "processed", "auto_dataset_from_sms_web.csv"
        )
        try:
            parse_android_sms_xml(save_path, output_csv)
            flash(f"XML imported and converted to: {output_csv}")
            classified_csv = os.path.join(
                "data", "processed", "auto_dataset_classified_web.csv"
            )
            summarized_csv = os.path.join(
                "data", "processed", "auto_dataset_amounts_web.csv"
            )

            classify_sms_file(output_csv, classified_csv)
            summary = summarize_with_amounts(classified_csv, summarized_csv)

            flash(
                f"Processed! Total spent: ₹{summary['total_spent']:.2f}, "
                f"Total income: ₹{summary['total_income']:.2f}, "
                f"Net: ₹{summary['net']:.2f}"
            )
            print(f"[IMPORT] Parsed XML -> {output_csv}")
            print("[SUMMARY]", summary)

            try:
                os.makedirs(os.path.dirname(SUMMARY_JSON), exist_ok=True)
                with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
                    json.dump(summary, f)
            except Exception as e:
                print("[SUMMARY][SAVE][ERROR]", e)
        except Exception as e:
            flash(f"Error while parsing XML: {e}")
            print(f"[IMPORT][ERROR] {e}")
    else:
        flash(f"File uploaded (CSV). Saved as: {save_path}")

    return redirect(url_for("index"))


@app.route("/api/stats", methods=["GET"])
def api_stats():
    """
    Return basic data stats for current user:
      - total number of transaction rows
      - first transaction date
      - last transaction date
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        base_q = session.query(SMSMessage).filter(
            SMSMessage.user_id == user_id,
            SMSMessage.amount.isnot(None),
            SMSMessage.amount > 0,
        )

        total = base_q.count()

        first_row = (
            base_q.order_by(SMSMessage.date.asc().nullslast()).first()
        )
        last_row = (
            base_q.order_by(SMSMessage.date.desc().nullslast()).first()
        )

        def fmt_date(row):
            if not row or not row.date:
                return None
            # isoformat without timezone is fine here
            return row.date.date().isoformat()

        return jsonify(
            {
                "count": total,
                "first_date": fmt_date(first_row),
                "last_date": fmt_date(last_row),
            }
        )
    except Exception as e:
        print("[API STATS][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()

@app.route("/api/export", methods=["GET"])
def api_export():
    """
    Export all transactions for the current user as a CSV file.

    Columns: id, date, category, amount, text
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        rows = (
            session.query(SMSMessage)
            .filter(
                SMSMessage.user_id == user_id,
                SMSMessage.amount.isnot(None),
                SMSMessage.amount > 0,
            )
            .order_by(SMSMessage.date.asc().nullslast(), SMSMessage.id.asc())
            .all()
        )

        if not rows:
            # Still return a CSV header, but empty body
            header = "id,date,category,amount,text\n"
            return Response(
                header,
                mimetype="text/csv",
                headers={
                    "Content-Disposition": 'attachment; filename="transactions_export.csv"'
                },
            )

        # Build CSV lines manually (avoid needing pandas just for this)
        lines = ["id,date,category,amount,text"]
        for msg in rows:
            msg_id = msg.id
            date_str = msg.date.isoformat(sep=" ") if msg.date else ""
            category = msg.category or ""
            amount = float(msg.amount or 0.0)
            text = msg.text or ""

            # Escape double quotes in text
            safe_text = text.replace('"', '""')

            line = f'{msg_id},"{date_str}","{category}",{amount},"{safe_text}"'
            lines.append(line)

        csv_content = "\n".join(lines) + "\n"

        return Response(
            csv_content,
            mimetype="text/csv",
            headers={
                "Content-Disposition": 'attachment; filename="transactions_export.csv"'
            },
        )

    except Exception as e:
        print("[API EXPORT][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()
@app.route("/api/monthly-summary", methods=["GET"])
def api_monthly_summary():
    """
    Return per-month totals for current user:
      - spent (Debit + Shopping/UPI)
      - income (Credit + Refund)
      - net (income - spent)

    Response:
    {
      "items": [
        { "month": "2025-05", "spent": 123.0, "income": 456.0, "net": 333.0 },
        ...
      ]
    }
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        # SQLite: use strftime to group by YYYY-MM
        q = (
            session.query(
                func.strftime("%Y-%m", SMSMessage.date).label("ym"),
                SMSMessage.category,
                func.sum(SMSMessage.amount).label("total"),
            )
            .filter(
                SMSMessage.user_id == user_id,
                SMSMessage.amount.isnot(None),
                SMSMessage.amount > 0,
                SMSMessage.date.isnot(None),
            )
            .group_by("ym", SMSMessage.category)
        )

        rows = q.all()
        if not rows:
            return jsonify({"items": []})

        # Aggregate into per-month spent/income
        month_map = {}  # ym -> {"spent": x, "income": y}
        for ym, category, total in rows:
            if ym is None:
                continue
            amt = float(total or 0.0)
            if ym not in month_map:
                month_map[ym] = {"spent": 0.0, "income": 0.0}

            if category in ["Debit", "Shopping/UPI"]:
                month_map[ym]["spent"] += amt
            elif category in ["Credit", "Refund"]:
                month_map[ym]["income"] += amt
            else:
                # Other / Account/Service / Travel don't affect spent/income here
                pass

        # Build sorted list
        items = []
        for ym in sorted(month_map.keys()):
            spent = month_map[ym]["spent"]
            income = month_map[ym]["income"]
            items.append(
                {
                    "month": ym,
                    "spent": float(spent),
                    "income": float(income),
                    "net": float(income - spent),
                }
            )

        return jsonify({"items": items})

    except Exception as e:
        print("[API MONTHLY SUMMARY][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()
@app.route("/api/insights", methods=["GET"])
def api_insights():
    """
    Return simple insights for a given month (or latest month if not provided).

    Query params:
      - month=YYYY-MM (optional). If omitted, use latest month in DB.

    Response example:
    {
      "month": "2025-09",
      "total_spent": 86247.02,
      "total_income": 61615.62,
      "net": -24631.40,
      "top_category": {
        "category": "Shopping/UPI",
        "amount": 45000.0
      },
      "spikes": [
        {
          "category": "Travel",
          "current": 8000.0,
          "avg_previous": 2000.0,
          "ratio": 4.0
        }
      ]
    }
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        # 1) Determine month to use
        month = request.args.get("month")

        if not month:
            # Find latest month with transactions for this user
            latest = (
                session.query(func.strftime("%Y-%m", SMSMessage.date))
                .filter(
                    SMSMessage.user_id == user_id,
                    SMSMessage.amount.isnot(None),
                    SMSMessage.amount > 0,
                    SMSMessage.date.isnot(None),
                )
                .order_by(SMSMessage.date.desc())
                .first()
            )
            if not latest or not latest[0]:
                return jsonify(
                    {
                        "month": None,
                        "total_spent": 0.0,
                        "total_income": 0.0,
                        "net": 0.0,
                        "top_category": None,
                        "spikes": [],
                    }
                )
            month = latest[0]

        # 2) Get all rows for this user & this month
        cur_rows = (
            session.query(SMSMessage)
            .filter(
                SMSMessage.user_id == user_id,
                SMSMessage.amount.isnot(None),
                SMSMessage.amount > 0,
                SMSMessage.date.isnot(None),
                SMSMessage.date.like(f"{month}-%"),
            )
            .all()
        )

        if not cur_rows:
            return jsonify(
                {
                    "month": month,
                    "total_spent": 0.0,
                    "total_income": 0.0,
                    "net": 0.0,
                    "top_category": None,
                    "spikes": [],
                }
            )

        # 3) Compute totals + category spend for this month
        total_spent = 0.0
        total_income = 0.0
        cat_totals = {}  # category -> amount (for "spent" categories only)

        for msg in cur_rows:
            cat = msg.category
            amt = float(msg.amount or 0.0)

            if cat in ["Debit", "Shopping/UPI"]:
                total_spent += amt
                cat_totals[cat] = cat_totals.get(cat, 0.0) + amt
            elif cat in ["Credit", "Refund"]:
                total_income += amt

        net = total_income - total_spent

        # 4) Top spend category (within spend categories)
        top_category = None
        if cat_totals:
            cat_name, cat_amt = max(cat_totals.items(), key=lambda kv: kv[1])
            top_category = {"category": cat_name, "amount": float(cat_amt)}

        # 5) Spike detection: compare this month vs average of previous months
        #    per category among spend categories only.
        #    We'll consider it a "spike" if current >= 1.5 * avg_previous
        #    and avg_previous > 0.
        # Get past months aggregated by category
        past_q = (
            session.query(
                func.strftime("%Y-%m", SMSMessage.date).label("ym"),
                SMSMessage.category,
                func.sum(SMSMessage.amount).label("total"),
            )
            .filter(
                SMSMessage.user_id == user_id,
                SMSMessage.amount.isnot(None),
                SMSMessage.amount > 0,
                SMSMessage.date.isnot(None),
                func.strftime("%Y-%m", SMSMessage.date) < month,
                SMSMessage.category.in_(["Debit", "Shopping/UPI"]),
            )
            .group_by("ym", SMSMessage.category)
        )

        past_rows = past_q.all()

        # Build: cat -> [month_totals...]
        past_by_cat = {}
        for ym, cat, total in past_rows:
            if ym is None or cat is None:
                continue
            amt = float(total or 0.0)
            lst = past_by_cat.setdefault(cat, [])
            lst.append(amt)

        spikes = []
        for cat, cur_amt in cat_totals.items():
            past_vals = past_by_cat.get(cat, [])
            if not past_vals:
                continue  # no history, can't detect spike
            avg_prev = sum(past_vals) / len(past_vals)
            if avg_prev <= 0:
                continue
            ratio = cur_amt / avg_prev
            if ratio >= 1.5:
                spikes.append(
                    {
                        "category": cat,
                        "current": float(cur_amt),
                        "avg_previous": float(avg_prev),
                        "ratio": float(round(ratio, 2)),
                    }
                )

        # Sort spikes by ratio descending
        spikes.sort(key=lambda x: x["ratio"], reverse=True)

        return jsonify(
            {
                "month": month,
                "total_spent": float(total_spent),
                "total_income": float(total_income),
                "net": float(net),
                "top_category": top_category,
                "spikes": spikes,
            }
        )

    except Exception as e:
        print("[API INSIGHTS][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()
@app.route("/api/budgets", methods=["GET"])
def api_get_budgets():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        budgets = (
            session.query(Budget)
            .filter(Budget.user_id == user_id)
            .order_by(Budget.category.asc())
            .all()
        )

        items = []
        for b in budgets:
            items.append({
                "id": b.id,
                "category": b.category,
                "monthly_limit": float(b.monthly_limit),
            })

        return jsonify({"items": items})
    except Exception as e:
        print("[API BUDGETS][GET ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()

@app.route("/api/budgets", methods=["POST"])
def api_set_budgets():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    items = data.get("items")
    if not isinstance(items, list):
        return jsonify({"error": "invalid_payload"}), 400

    cleaned = []
    for item in items:
        cat = str(item.get("category", "")).strip()
        try:
            limit = float(item.get("monthly_limit", 0.0))
        except:
            limit = 0.0

        if not cat or limit <= 0:
            continue

        cleaned.append({"category": cat, "monthly_limit": limit})

    session = SessionLocal()
    try:
        session.query(Budget).filter(Budget.user_id == user_id).delete()
        for b in cleaned:
            session.add(Budget(
                user_id=user_id,
                category=b["category"],
                monthly_limit=b["monthly_limit"],
            ))
        session.commit()
        return jsonify({"status": "ok", "count": len(cleaned)})
    except Exception as e:
        print("[API BUDGETS][POST ERROR]", e)
        session.rollback()
        return jsonify({"error": "server"}), 500
    finally:
        session.close()
@app.route("/api/recurring", methods=["GET"])
def api_recurring():
    """
    Detect simple recurring payments for the current user.

    Logic:
      - consider only Debit + Shopping/UPI
      - group by (category, rounded amount)
      - if there are >= 3 payments and span between first/last is >= 60 days,
        treat as a probable recurring payment.

    Response:
    {
      "items": [
        {
          "category": "Debit",
          "amount": 499.0,
          "count": 6,
          "first_date": "2025-05-01 10:30:00",
          "last_date": "2025-10-01 10:30:00",
          "span_days": 153
        },
        ...
      ]
    }
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        rows = (
            session.query(SMSMessage)
            .filter(
                SMSMessage.user_id == user_id,
                SMSMessage.amount.isnot(None),
                SMSMessage.amount > 0,
                SMSMessage.date.isnot(None),
                SMSMessage.category.in_(["Debit", "Shopping/UPI"]),
            )
            .order_by(SMSMessage.date.asc())
            .all()
        )

        if not rows:
            return jsonify({"items": []})

        # Build groups: key = (category, rounded_amount)
        groups = {}
        for msg in rows:
            amt = float(msg.amount or 0.0)
            # round to nearest rupee to avoid tiny differences
            rounded = round(amt)
            key = (msg.category, rounded)
            lst = groups.setdefault(key, [])
            lst.append(msg)

        candidates = []
        for (cat, rounded_amount), msgs in groups.items():
            if len(msgs) < 3:
                continue

            # sort by date
            msgs_sorted = sorted(msgs, key=lambda m: m.date)
            first_date = msgs_sorted[0].date
            last_date = msgs_sorted[-1].date
            span_days = (last_date - first_date).days if first_date and last_date else 0

            # Require at least ~2 months span
            if span_days < 60:
                continue

            candidates.append(
                {
                    "category": cat,
                    "amount": float(rounded_amount),
                    "count": len(msgs_sorted),
                    "first_date": first_date.isoformat(sep=" ") if first_date else None,
                    "last_date": last_date.isoformat(sep=" ") if last_date else None,
                    "span_days": span_days,
                }
            )

        # Sort by count desc, then amount desc
        candidates.sort(key=lambda x: (-x["count"], -x["amount"]))

        return jsonify({"items": candidates})

    except Exception as e:
        print("[API RECURRING][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()
@app.route("/api/current-month-totals", methods=["GET"])
def api_current_month_totals():
    """
    Return total spent per category for a given month (or latest month if none provided).
    Query params:
      - month=YYYY-MM   (optional) — if omitted, backend uses the latest month available for user
    Response:
    {
      "month": "2025-12",
      "totals": {
        "Debit": 14500.50,
        "Shopping/UPI": 3200.00,
        "Travel": 500.00,
        "Other": 0.0
      }
    }
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    month = request.args.get("month")
    session = SessionLocal()
    try:
        # If month not provided, pick the latest month that the user has data for
        if not month:
            latest = (
                session.query(func.strftime("%Y-%m", SMSMessage.date))
                .filter(
                    SMSMessage.user_id == user_id,
                    SMSMessage.amount.isnot(None),
                    SMSMessage.amount > 0,
                    SMSMessage.date.isnot(None),
                )
                .order_by(SMSMessage.date.desc())
                .first()
            )
            if not latest or not latest[0]:
                return jsonify({"month": None, "totals": {}})

            month = latest[0]

        # Aggregate sums grouped by category for that month
        q = (
            session.query(
                SMSMessage.category,
                func.sum(SMSMessage.amount).label("total"),
            )
            .filter(
                SMSMessage.user_id == user_id,
                SMSMessage.amount.isnot(None),
                SMSMessage.amount > 0,
                SMSMessage.date.isnot(None),
                func.strftime("%Y-%m", SMSMessage.date) == month,
            )
            .group_by(SMSMessage.category)
        )

        rows = q.all()

        totals = {}
        for category, total in rows:
            totals[category] = float(total or 0.0)

        # Ensure common categories exist (so frontend doesn't crash)
        common = ["Debit", "Shopping/UPI", "Credit", "Refund", "Travel", "Account/Service", "Other"]
        for c in common:
            totals.setdefault(c, 0.0)

        return jsonify({"month": month, "totals": totals})

    except Exception as e:
        print("[API CURRENT MONTH TOTALS][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()
@app.route("/api/alerts", methods=["GET"])
def api_alerts():
    """
    Return active alerts for the current user:
      - budget warnings/overages (uses budgets + current month totals)
      - recurring payments (informational)

    Response:
    {
      "items": [
        {
          "id": "budget-Shopping/UPI-warning",
          "type": "budget",
          "category": "Shopping/UPI",
          "message": "You have used 78% of your Shopping/UPI budget (₹7800 / ₹10000).",
          "severity": "warning",
          "created_at": "2025-12-09T12:34:56Z"
        },
        {
          "id": "recurring-Debit-499",
          "type": "recurring",
          "category": "Debit",
          "message": "Probable recurring payment: Debit ₹499 seen 5 times (first: 2025-05-01, last: 2025-10-01).",
          "severity": "info",
          "created_at": "2025-12-09T12:34:56Z"
        }
      ]
    }
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        # 1) Load budgets for this user
        budgets = (
            session.query(Budget)
            .filter(Budget.user_id == user_id)
            .all()
        )

        # 2) Determine month to use (latest with data) — reuse logic
        latest = (
            session.query(func.strftime("%Y-%m", SMSMessage.date))
            .filter(
                SMSMessage.user_id == user_id,
                SMSMessage.amount.isnot(None),
                SMSMessage.amount > 0,
                SMSMessage.date.isnot(None),
            )
            .order_by(SMSMessage.date.desc())
            .first()
        )
        month = latest[0] if latest and latest[0] else None

        # 3) Get current-month totals grouped by category
        month_totals = {}
        if month:
            q = (
                session.query(
                    SMSMessage.category,
                    func.sum(SMSMessage.amount).label("total"),
                )
                .filter(
                    SMSMessage.user_id == user_id,
                    SMSMessage.amount.isnot(None),
                    SMSMessage.amount > 0,
                    SMSMessage.date.isnot(None),
                    func.strftime("%Y-%m", SMSMessage.date) == month,
                )
                .group_by(SMSMessage.category)
            )
            for cat, total in q.all():
                month_totals[cat] = float(total or 0.0)

        # Ensure budgets list is iterable
        budget_items = budgets or []

        alerts = []
        now_iso = datetime.utcnow().isoformat() + "Z"

        # 4) Budget alerts
        for b in budget_items:
            cat = b.category
            limit = float(b.monthly_limit or 0.0)
            spent = float(month_totals.get(cat, 0.0))
            if limit <= 0:
                continue
            ratio = spent / limit
            # warning threshold (>=0.75)
            if ratio >= 1.0:
                severity = "critical"
                msg = f"You have exceeded your {cat} budget: ₹{spent:.2f} / ₹{limit:.2f}."
            elif ratio >= 0.75:
                severity = "warning"
                msg = f"You have used {ratio*100:.0f}% of your {cat} budget (₹{spent:.2f} / ₹{limit:.2f})."
            else:
                continue

            alerts.append({
                "id": f"budget-{cat}-{ 'over' if ratio>=1.0 else 'warn' }",
                "type": "budget",
                "category": cat,
                "message": msg,
                "severity": severity,
                "created_at": now_iso,
            })

        # 5) Recurring payment alerts (informational)
        # Reuse the simple recurring detection logic inline (group by rounded amount)
        rows = (
            session.query(SMSMessage)
            .filter(
                SMSMessage.user_id == user_id,
                SMSMessage.amount.isnot(None),
                SMSMessage.amount > 0,
                SMSMessage.date.isnot(None),
                SMSMessage.category.in_(["Debit", "Shopping/UPI"]),
            )
            .order_by(SMSMessage.date.asc())
            .all()
        )

        groups = {}
        for msg in rows:
            rounded = round(float(msg.amount or 0.0))
            key = (msg.category, rounded)
            groups.setdefault(key, []).append(msg)

        for (cat, amt), msgs in groups.items():
            if len(msgs) < 3:
                continue
            msgs_sorted = sorted(msgs, key=lambda m: m.date)
            first_date = msgs_sorted[0].date
            last_date = msgs_sorted[-1].date
            span_days = (last_date - first_date).days if first_date and last_date else 0
            if span_days < 60:
                continue
            # Make an informational alert
            msg_text = f"Probable recurring payment: {cat} ₹{amt} seen {len(msgs_sorted)} times (first: {first_date.strftime('%Y-%m-%d')}, last: {last_date.strftime('%Y-%m-%d')})."
            alerts.append({
                "id": f"recurring-{cat}-{amt}",
                "type": "recurring",
                "category": cat,
                "message": msg_text,
                "severity": "info",
                "created_at": now_iso,
            })

        # Optional: sort alerts by severity then created_at (critical -> warning -> info)
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        alerts.sort(key=lambda a: (severity_order.get(a.get("severity"), 3), a.get("created_at")), reverse=False)

        return jsonify({"items": alerts})

    except Exception as e:
        print("[API ALERTS][ERROR]", e)
        return jsonify({"error": "server"}), 500
    finally:
        session.close()


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

@app.route("/__routes__", methods=["GET"])
def __routes__():
    lines = []
    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
        methods = ",".join(sorted(rule.methods - {"HEAD","OPTIONS"}))
        lines.append(f"{rule.rule:40}  ->  {methods}")
    return "<pre>" + "\n".join(lines) + "</pre>"


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
