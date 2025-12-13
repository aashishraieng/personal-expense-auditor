import bcrypt
import uuid

def hash_password(password: str) -> str:
    """
    Hash password using bcrypt.
    Stored format: bcrypt_hash (utf-8 string)
    """
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify password against bcrypt hash.
    """
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8")
        )
    except Exception:
        return False


def make_token() -> str:
    """
    Generate random session/token id.
    """
    return uuid.uuid4().hex
