# src/expense_auditor/migrate_add_user_token.py
from sqlalchemy import text
from expense_auditor.db import engine

def main():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN token TEXT"))
            conn.commit()
            print("✅ Column 'token' added to users table")
        except Exception as e:
            print("⚠️ Migration skipped or already applied:", e)

if __name__ == "__main__":
    main()
