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
)
from flask_cors import CORS

from import_android_sms import parse_android_sms_xml
from analyze_sms_file import classify_sms_file
from summarize_expenses import summarize_with_amounts
from db import SessionLocal, init_db, SMSMessage, User
from auth_utils import hash_password, verify_password, make_token

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

ALLOWED_EXTENSIONS = {"xml", "csv"}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
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
    """
    Return basic info about the currently authenticated user.
    Requires Authorization: Bearer <token> header.
    """
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    session = SessionLocal()
    try:
        user = session.get(User, user_id)
        if not user:
            return jsonify({"error": "unauthorized"}), 401

        return jsonify(
            {
                "id": user.id,
                "email": user.email,
                "created_at": user.created_at.isoformat()
                if user.created_at
                else None,
            }
        )
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


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
