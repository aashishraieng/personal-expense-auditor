import sqlite3, os, textwrap
db = os.path.join("data", "expense_db.sqlite")
print("Checking DB:", db)
if not os.path.exists(db):
    print("DB not found. Files in data/:", os.listdir("data"))
    raise SystemExit(1)
conn = sqlite3.connect(db)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cur.fetchall()]
print("Tables found:", tables)
if "users" in tables:
    print("\nusers table schema (PRAGMA table_info(users)):")
    cur.execute("PRAGMA table_info(users);")
    for r in cur.fetchall():
        # print (cid, name, type, notnull, dflt_value, pk)
        print(r)
else:
    print("\nNo users table found in this DB.")
conn.close()