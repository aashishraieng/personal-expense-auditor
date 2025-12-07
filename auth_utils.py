import hashlib
import uuid

def hash_password(password: str) -> str:
    salt = uuid.uuid4().hex
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${hashed}"

def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, hashed = password_hash.split("$")
    except ValueError:
        return False
    check = hashlib.sha256((password + salt).encode()).hexdigest()
    return check == hashed

def make_token() -> str:
    return uuid.uuid4().hex
