# add_is_admin_column.py
import sqlite3, os, sys
DB = os.path.join("data", "expense_db.sqlite")
if not os.path.exists(DB):
    print("DB not found:", DB)
    sys.exit(1)

conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.execute("PRAGMA table_info(users);")
cols = [r[1] for r in cur.fetchall()]
print("users columns BEFORE:", cols)
if "is_admin" in cols:
    print("is_admin already present — nothing to do.")
else:
    try:
        cur.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;")
        conn.commit()
        print("Added is_admin column to users.")
    except Exception as e:
        print("ALTER TABLE failed:", e)
        conn.rollback()
cur.execute("PRAGMA table_info(users);")
print("users columns AFTER:")
for r in cur.fetchall():
    print(r)
conn.close()
