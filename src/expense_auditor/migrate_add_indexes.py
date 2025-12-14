# src/expense_auditor/migrate_add_indexes.py
from sqlalchemy import text
from expense_auditor.db import engine

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_sms_user_id ON sms_messages (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_sms_user_created ON sms_messages (user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_sms_user_category ON sms_messages (user_id, category)",
]


def main():
    with engine.connect() as conn:
        for stmt in INDEXES:
            conn.execute(text(stmt))
        conn.commit()

    print("Indexes created successfully")


if __name__ == "__main__":
    main()
