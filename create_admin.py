# create_admin.py
import os
from db import init_db, SessionLocal, User
from auth_utils import hash_password
from dotenv import load_dotenv
load_dotenv()


def main():
    # Read from environment variables
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")

    if not admin_email or not admin_password:
        raise RuntimeError(
            "ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set"
        )

    # Ensure tables exist
    init_db()

    session = SessionLocal()

    try:
        user = session.query(User).filter(User.email == admin_email).first()

        if user:
            print("Admin already exists:", admin_email)
            return

        user = User(
            email=admin_email,
            password_hash=hash_password(admin_password),
            is_admin=True
        )

        session.add(user)
        session.commit()
        print("Admin user created:", admin_email)

    finally:
        session.close()

if __name__ == "__main__":
    main()
