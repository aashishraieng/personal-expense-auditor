import sqlite3
from pathlib import Path

DB_PATH = Path("expenses.db")

def main():
    if not DB_PATH.exists():
        raise FileNotFoundError(f"{DB_PATH} not found. Run save_to_db.py first.")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("\n📌 Total transactions:")
    cur.execute("SELECT COUNT(*) FROM transactions;")
    print(" ", cur.fetchone()[0])

    print("\n📌 Flow breakdown (IN / OUT / REFUND / OTHER):")
    cur.execute("""
        SELECT flow, COUNT(*), SUM(amount)
        FROM transactions
        GROUP BY flow;
    """)
    for flow, count, total in cur.fetchall():
        print(f"  {flow:7}  | count = {count:3} | sum = {total}")

    print("\n📌 Expense breakdown by sub_category (OUT only):")
    cur.execute("""
        SELECT sub_category, COUNT(*), SUM(amount)
        FROM transactions
        WHERE flow = 'OUT'
        GROUP BY sub_category
        ORDER BY SUM(amount) DESC;
    """)
    rows = cur.fetchall()
    if not rows:
        print("  (no OUT transactions yet)")
    else:
        for subcat, count, total in rows:
            print(f"  {subcat:20} | count = {count:3} | sum = {total}")

    conn.close()

if __name__ == "__main__":
    main()





