# src/expense_auditor/create_admin.py
import os
from expense_auditor.db import init_db, SessionLocal, User
from expense_auditor.auth_utils import hash_password, make_token
from dotenv import load_dotenv

load_dotenv()


def main():
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")

    if not admin_email or not admin_password:
        raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be set")

    init_db()
    session = SessionLocal()

    try:
        user = session.query(User).filter(User.email == admin_email).first()

        if user:
            # ensure token exists
            if not user.token:
                user.token = make_token()
                session.commit()
                print("Admin token regenerated:", user.token)
            else:
                print("Admin already exists. Token:", user.token)
            return

        user = User(
            email=admin_email,
            password_hash=hash_password(admin_password),
            is_admin=True,
            token=make_token()
        )

        session.add(user)
        session.commit()

        print("Admin created")
        print("EMAIL:", admin_email)
        print("TOKEN:", user.token)

    finally:
        session.close()


if __name__ == "__main__":
    main()
