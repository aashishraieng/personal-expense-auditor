import os
import json
import pandas as pd
from flask import Flask, request, render_template_string, redirect, url_for, flash, jsonify
from flask_cors import CORS
from import_android_sms import parse_android_sms_xml
from analyze_sms_file import classify_sms_file
from summarize_expenses import summarize_with_amounts
from datetime import datetime
from db import SessionLocal, init_db, SMSMessage

app = Flask(__name__)
CORS(app) # Enable CORS for all routes
app.secret_key = "dev-secret-key"  # needed for flash messages; change later
init_db()

# Folder to store uploaded files
UPLOAD_FOLDER = os.path.join("data", "raw")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
SUMMARY_JSON = os.path.join("data", "processed", "web_summary.json")
CORRECTIONS_CSV = os.path.join("data", "processed", "corrections_web.csv")


ALLOWED_EXTENSIONS = {"xml", "csv"}
def load_amounts_df():
    """
    Load the amounts CSV (auto_dataset_amounts_web.csv) and return:
    - df (with parsed date column if present)
    - list of available months as strings 'YYYY-MM'
    """
    csv_path = os.path.join("data", "processed", "auto_dataset_amounts_web.csv")
    if not os.path.exists(csv_path):
        return None, []

    try:
        df = pd.read_csv(csv_path, encoding="ISO-8859-1")
    except Exception as e:
        print("[LOAD AMOUNTS][READ ERROR]", e)
        return None, []

    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date"])
        df["year_month"] = df["date"].dt.to_period("M").astype(str)
        months = sorted(df["year_month"].unique().tolist())
    else:
        df["year_month"] = ""
        months = []

    return df, months
def sync_amounts_csv_to_db():
    """
    Read auto_dataset_amounts_web.csv and replace contents of sms_messages table.
    This keeps DB in sync with latest processed SMS data.
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
        # Clear old data
        deleted = session.query(SMSMessage).delete()
        print(f"[SYNC DB] Deleted {deleted} old rows from sms_messages.")

        # Insert new data
        count = 0
        for _, row in df.iterrows():
            try:
                dt = None
                if "date" in df.columns and isinstance(row.get("date"), str):
                    try:
                        dt = pd.to_datetime(row["date"], errors="coerce")
                    except Exception:
                        dt = None

                # Use row_id from CSV as the primary key ID in DB (if present)
                rid = None
                try:
                    rid = int(row.get("row_id"))
                except Exception:
                    rid = None  # DB will autoincrement if this is None

                msg = SMSMessage(
                    id=rid,
                    date=dt,
                    text=str(row["source_text"]),
                    amount=float(row.get("amount", 0.0)),
                    category=str(row.get("predicted_category", "Other")),
                    corrected=False,
                )
                session.add(msg)
                count += 1
            except Exception as e:
                print("[SYNC DB] Skipped row:", e)


        session.commit()
        print(f"[SYNC DB] Inserted {count} rows into sms_messages.")

    except Exception as e:
        session.rollback()
        print("[SYNC DB] DB error:", e)
    finally:
        session.close()


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# Simple HTML template for testing upload in browser
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
def load_summary():
    if os.path.exists(SUMMARY_JSON):
        try:
            with open(SUMMARY_JSON, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        except Exception as e:
            print("[SUMMARY][LOAD][ERROR]", e)
    return None

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

    classified_csv = os.path.join("data", "processed", "auto_dataset_classified_web.csv")
    amounts_csv = os.path.join("data", "processed", "auto_dataset_amounts_web.csv")

    if not os.path.exists(classified_csv):
        return jsonify({"error": "no_classified_data"}), 404

    try:
        df = pd.read_csv(classified_csv, encoding="ISO-8859-1")
    except Exception as e:
        print("[API TX PATCH][READ ERROR]", e)
        return jsonify({"error": "failed_to_read_classified"}), 500

    if "row_id" not in df.columns:
        return jsonify({"error": "no_row_id_column"}), 500

    # Find the row by row_id
    match = df.index[df["row_id"] == row_id]
    if len(match) == 0:
        return jsonify({"error": "row_not_found"}), 404

    idx = match[0]

    old_category = str(df.loc[idx, "predicted_category"])
    text = str(df.loc[idx, "source_text"])

    if old_category == new_category:
        return jsonify({"message": "no_change"}), 200

    # Update category in classified CSV
    df.loc[idx, "predicted_category"] = new_category

    try:
        df.to_csv(classified_csv, index=False, encoding="ISO-8859-1")

        # Recompute amounts + summary from updated classified CSV
        summary = summarize_with_amounts(classified_csv, amounts_csv)

        # Save updated summary JSON
        os.makedirs(os.path.dirname(SUMMARY_JSON), exist_ok=True)
        with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
            json.dump(summary, f)

        # Log correction for future retraining
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

    return jsonify({
        "message": "updated",
        "row_id": row_id,
        "old_category": old_category,
        "new_category": new_category,
        "summary": summary,
    })

@app.route("/api/summary", methods=["GET"])
def api_summary():
    """
    If no month is specified: return overall summary from summary JSON (if exists),
    plus list of available months.
    If month=YYYY-MM is specified: compute summary for that month from amounts CSV.
    """
    month = request.args.get("month")

    df, months_available = load_amounts_df()

    # If a specific month is requested and we have data
    if month and df is not None:
        df_month = df[df["year_month"] == month].copy()
        if df_month.empty:
            return jsonify({
                "total_spent": 0.0,
                "total_income": 0.0,
                "net": 0.0,
                "category_totals": {},
                "months_available": months_available,
            })

        # Compute category totals
        cat_totals = df_month.groupby("predicted_category")["amount"].sum().to_dict()

        spend = df_month[df_month["predicted_category"].isin(["Debit", "Shopping/UPI"])]["amount"].sum()
        income = df_month[df_month["predicted_category"].isin(["Credit", "Refund"])]["amount"].sum()

        return jsonify({
            "total_spent": float(spend),
            "total_income": float(income),
            "net": float(income - spend),
            "category_totals": cat_totals,
            "months_available": months_available,
        })

    # No specific month requested: use overall summary JSON if available
    data = load_summary()
    if not data:
        # Fallback: compute from df if we have it
        if df is None:
            return jsonify({"error": "no_data"}), 404

        cat_totals = df.groupby("predicted_category")["amount"].sum().to_dict()
        spend = df[df["predicted_category"].isin(["Debit", "Shopping/UPI"])]["amount"].sum()
        income = df[df["predicted_category"].isin(["Credit", "Refund"])]["amount"].sum()

        data = {
            "category_totals": cat_totals,
            "total_spent": float(spend),
            "total_income": float(income),
            "net": float(income - spend),
        }

    # Always attach months_available
    data["months_available"] = months_available
    return jsonify(data)



@app.route("/api/upload", methods=["POST"])
def api_upload():
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
        output_csv = os.path.join("data", "processed", "auto_dataset_from_sms_web.csv")
        try:
            parse_android_sms_xml(save_path, output_csv)

            classified_csv = os.path.join("data", "processed", "auto_dataset_classified_web.csv")
            summarized_csv = os.path.join("data", "processed", "auto_dataset_amounts_web.csv")

            classify_sms_file(output_csv, classified_csv)
            result_summary = summarize_with_amounts(classified_csv, summarized_csv)

            # Save summary JSON for /api/summary and HTML page
            os.makedirs(os.path.dirname(SUMMARY_JSON), exist_ok=True)
            with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
                json.dump(result_summary, f)
            # After summarizing, sync CSV -> DB so API uses fresh data
            sync_amounts_csv_to_db()


        except Exception as e:
            print("[API UPLOAD][ERROR]", e)
            return jsonify({"error": "processing_failed", "details": str(e)}), 500
    else:
        # CSV branch – for now we just save it
        result_summary = None

    return jsonify({
        "message": "uploaded",
        "summary": result_summary
    })
@app.route("/api/transactions", methods=["GET"])
def api_transactions():
    """
    Return recent transactions from SQLite (sms_messages table),
    optionally filtered by month=YYYY-MM.
    """
    session = SessionLocal()

    try:
        # Get distinct year-months (for UI dropdown)
        months_available = []
        dates = (
            session.query(SMSMessage.date)
            .filter(SMSMessage.date.isnot(None))
            .all()
        )
        # dates is list of tuples: [(datetime,), ...]
        ym_set = set()
        for (dt,) in dates:
            if dt:
                ym_set.add(dt.strftime("%Y-%m"))
        months_available = sorted(ym_set)

        # Optional month filter
        month = request.args.get("month")
        query = session.query(SMSMessage)

        if month:
            year, mon = month.split("-")
            # Filter by year and month in SQLAlchemy
            query = query.filter(
                SMSMessage.date.isnot(None),
                SMSMessage.date.like(f"{year}-{mon}-%"),
            )

        # Sort by date desc, then id desc
        query = query.order_by(SMSMessage.date.desc().nullslast(), SMSMessage.id.desc())

        # Limit
        try:
            limit = int(request.args.get("limit", "50"))
        except ValueError:
            limit = 50

        rows = query.limit(limit).all()

        items = []
        for msg in rows:
            items.append({
                "id": msg.id,
                "date": msg.date.isoformat(sep=" ") if msg.date else "",
                "text": msg.text,
                "category": msg.category,
                "amount": float(msg.amount or 0.0),
            })

        return jsonify({
            "items": items,
            "months_available": months_available,
        })

    except Exception as e:
        print("[API TRANSACTIONS][DB ERROR]", e)
        return jsonify({"error": "db_error"}), 500
    finally:
        session.close()


@app.route("/", methods=["GET"])
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

    return render_template_string(UPLOAD_PAGE, summary=summary, category_totals=category_totals)

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

    # If XML, convert to CSV using your existing importer
    if filename.lower().endswith(".xml"):
        output_csv = os.path.join("data", "processed", "auto_dataset_from_sms_web.csv")
        try:
            parse_android_sms_xml(save_path, output_csv)
            flash(f"XML imported and converted to: {output_csv}")
            classified_csv = os.path.join("data", "processed", "auto_dataset_classified_web.csv")
            summarized_csv = os.path.join("data", "processed", "auto_dataset_amounts_web.csv")

            classify_sms_file(output_csv, classified_csv)
            summary = summarize_with_amounts(classified_csv, summarized_csv)

            flash(f"Processed! Total spent: ₹{summary['total_spent']:.2f}, Total income: ₹{summary['total_income']:.2f}, Net: ₹{summary['net']:.2f}")
            print(f"[IMPORT] Parsed XML -> {output_csv}")
            print("[SUMMARY]", summary)
            # Save summary to JSON so the dashboard can show it
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


if __name__ == "__main__":
    # For local development only
    app.run(host="127.0.0.1", port=5000, debug=True)
