import pandas as pd
from db import SessionLocal, init_db, SMSMessage
from datetime import datetime
import os

CSV = os.path.join("data", "processed", "auto_dataset_amounts_web.csv")

if not os.path.exists(CSV):
    print("[ERROR] CSV not found:", CSV)
    exit()

init_db()
session = SessionLocal()

df = pd.read_csv(CSV, encoding="ISO-8859-1")

count = 0
for _, row in df.iterrows():
    try:
        dt = None
        if "date" in row and isinstance(row["date"], str):
            try:
                dt = pd.to_datetime(row["date"], errors="coerce")
            except Exception:
                pass

        msg = SMSMessage(
            date=dt,
            text=str(row["source_text"]),
            amount=float(row.get("amount", 0.0)),
            category=str(row.get("predicted_category", "Other")),
            corrected=False,
        )
        session.add(msg)
        count += 1
    except Exception as e:
        print("SKIPPED ROW:", e)

session.commit()
session.close()

print(f"[OK] Imported {count} rows into DB")
