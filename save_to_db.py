import sqlite3
from pathlib import Path
import pandas as pd

DB_PATH = Path("expenses.db")
CSV_PATH = Path("auto_dataset_from_sms.csv")

def init_db(conn):
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_text TEXT NOT NULL,
            amount REAL,
            merchant TEXT,
            category TEXT,
            sub_category TEXT,
            flow TEXT,
            date TEXT
        );
        """
    )
    conn.commit()

def save_csv_to_db(conn, df: pd.DataFrame):
    cur = conn.cursor()

    # Optional: clear old data so we always mirror current CSV
    cur.execute("DELETE FROM transactions;")

    rows = df.to_dict(orient="records")
    for row in rows:
        cur.execute(
            """
            INSERT INTO transactions
            (source_text, amount, merchant, category, sub_category, flow, date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row.get("source_text"),
                row.get("amount"),
                row.get("merchant"),
                row.get("category"),
                row.get("sub_category"),
                row.get("flow"),
                row.get("date"),
            )
        )

    conn.commit()
    print(f"Inserted {len(rows)} rows into database.")

def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"{CSV_PATH} not found. Run build_dataset_from_sms.py first.")

    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} rows from {CSV_PATH}")

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    save_csv_to_db(conn, df)
    conn.close()
    print(f"Saved to SQLite DB at: {DB_PATH}")

if __name__ == "__main__":
    main()
