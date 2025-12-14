# src/expense_auditor/sms_classifier.py
import os
from joblib import load

MODEL_PATH = os.path.join("models", "category_model.joblib")
_MODEL = None


def load_model(force_reload: bool = False):
    global _MODEL

    if _MODEL is not None and not force_reload:
        return _MODEL

    if not os.path.exists(MODEL_PATH):
        print("[WARN] ML model not found. Using rule-based classification.")
        _MODEL = None
        return None

    try:
        _MODEL = load(MODEL_PATH)
        print("[INFO] ML model loaded")
        return _MODEL
    except Exception as e:
        print("[WARN] Failed to load ML model:", e)
        _MODEL = None
        return None


def classify_sms(text: str) -> str:
    if not text:
        return "Unknown"

    t = text.lower()

    # Rule-based first
    if any(w in t for w in ["debited", "spent", "paid", "purchase"]):
        return "Expense"

    if any(w in t for w in ["credited", "received"]):
        if "refund" in t:
            return "Refund"
        return "Income"

    if any(w in t for w in [
        "otp", "one time password", "verification code",
        "login", "authentication"
    ]):
        return "Account/Service"

    # ML fallback
    model = load_model()
    if model:
        try:
            return model.predict([text])[0]
        except Exception as e:
            print("[WARN] ML prediction failed:", e)

    return "Unknown"
