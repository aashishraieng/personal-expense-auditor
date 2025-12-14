# import_csv_to_db.py
import pandas as pd
from expense_auditor.db import init_db, SessionLocal, SMSMessage
from expense_auditor.utils.amount_extractor import extract_amount

CSV_PATH = "auto_dataset_from_sms.csv"


def main():
    init_db()
    session = SessionLocal()

    try:
        df = pd.read_csv(CSV_PATH)
        print(f"Loaded {len(df)} rows from {CSV_PATH}")

        inserted = 0

        for _, row in df.iterrows():
            text = row["source_text"]
            amount = row.get("amount")

            # 🔑 Single source of truth
            if pd.isna(amount):
                amount = extract_amount(text)

            sms = SMSMessage(
                user_id=None,
                date=_parse_date(row.get("date")),
                text=text,
                amount=amount,
                category=row.get("category", "Unknown"),
                corrected=False,
            )

            session.add(sms)
            inserted += 1

        session.commit()
        print(f"Inserted {inserted} rows into database")

    except Exception as e:
        session.rollback()
        print("ERROR:", e)

    finally:
        session.close()


def _parse_date(value):
    if pd.isna(value):
        return None
    try:
        return pd.to_datetime(value)
    except Exception:
        return None


if __name__ == "__main__":
    main()
