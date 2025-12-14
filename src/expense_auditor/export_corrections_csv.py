# src/expense_auditor/export_corrections_csv.py
import csv
import os
from expense_auditor.db import SessionLocal, SMSMessage

OUTPUT_PATH = os.path.join("data", "corrections_train.csv")


def main():
    os.makedirs("data", exist_ok=True)

    session = SessionLocal()
    try:
        rows = (
            session.query(SMSMessage)
            .filter(SMSMessage.corrected == True)
            .all()
        )

        if not rows:
            print("No corrected data found.")
            return

        with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["text", "amount", "category"])

            for r in rows:
                writer.writerow([r.text, r.amount, r.category])

        print(f"Exported {len(rows)} rows to {OUTPUT_PATH}")

    finally:
        session.close()


if __name__ == "__main__":
    main()
