# create_admin.py
from db import init_db, SessionLocal, User
from auth_utils import hash_password
import os

# ensure tables exist
init_db()

session = SessionLocal()
email = "ashishrai6387@gmail.com"
password = "AshishAdmin123"  # change after login

u = session.query(User).filter(User.email == email).first()
if u:
    u.is_admin = True
    session.commit()
    print("Existing user promoted to admin:", email)
else:
    new = User(email=email, password_hash=hash_password(password), is_admin=True)
    session.add(new)
    session.commit()
    print("Created new admin user.")
    print("Email:", email)
    print("Password:", password)

session.close()
