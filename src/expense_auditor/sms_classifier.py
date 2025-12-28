# src/expense_auditor/sms_classifier.py
import os
from joblib import load
import numpy as np

MODEL_PATH = os.path.join("models", "category_model.joblib")
_MODEL = None


def load_model(force_reload: bool = False):
    global _MODEL

    if _MODEL is not None and not force_reload:
        return _MODEL

    if not os.path.exists(MODEL_PATH):
        print("[WARN] ML model not found.")
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


def classify_sms_with_confidence(text: str):
    """
    Returns: (category, confidence)
    confidence is between 0 and 1
    """

    if not text:
        return "Unknown", 0.0

    t = text.lower()

    # ------------------
    # Rule-based first
    # ------------------
    if any(w in t for w in ["debited", "spent", "paid", "purchase"]):
        return "Expense", 0.95

    if any(w in t for w in ["credited", "received"]):
        if "refund" in t:
            return "Refund", 0.95
        return "Income", 0.95

    if any(w in t for w in [
        "otp", "one time password", "verification code",
        "login", "authentication"
    ]):
        return "Account/Service", 0.99

    # ------------------
    # ML fallback
    # ------------------
    model = load_model()
    if model and hasattr(model, "predict_proba"):
        try:
            probs = model.predict_proba([text])[0]
            idx = int(np.argmax(probs))
            return model.classes_[idx], float(probs[idx])
        except Exception as e:
            print("[WARN] ML prediction failed:", e)

    return "Unknown", 0.0
