import os
from sqlalchemy import (
    create_engine,
    Boolean,

    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    ForeignKey,
)

from sqlalchemy.orm import declarative_base, sessionmaker,relationship
from datetime import datetime
from sqlalchemy.sql import func

DB_PATH = os.path.join("data", "expense_db.sqlite")
os.makedirs("data", exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class SMSMessage(Base):
    __tablename__ = "sms_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)  # NEW: owner of this SMS
    date = Column(DateTime, nullable=True)
    text = Column(String, nullable=False)
    amount = Column(Float, nullable=True)
    category = Column(String, nullable=False)
    corrected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    token = Column(String, unique=True, nullable=True, index=True)

    # NEW:
    is_admin = Column(Boolean, default=False, nullable=False)





class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    monthly_limit = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="budgets")


def init_db():
    Base.metadata.create_all(bind=engine)

