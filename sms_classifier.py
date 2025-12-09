import os
import re
from joblib import load

# Path to the saved model
MODEL_PATH = os.path.join("models", "category_model.joblib")

# Lazy-loaded global model
_MODEL = None

def _get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = load(MODEL_PATH)
    return _MODEL


# Same idea as your summarize code: Rs/INR/AED/₹ + number
AMOUNT_REGEX = re.compile(
    r'(?i)(?:rs|inr|aed|₹|amt|amount)\s*[\.:]?\s*([0-9,]+(?:\.\d+)?)'
)


def extract_amount(text: str) -> float:
    """Extract numeric amount from an SMS text. Returns 0.0 if not found."""
    if not text:
        return 0.0
    m = AMOUNT_REGEX.search(text)
    if not m:
        return 0.0
    try:
        return float(m.group(1).replace(",", ""))
    except Exception:
        return 0.0


def classify_sms_text(text: str) -> str:
    """
    Unified classifier:
      - uses ML model
      - then applies rule-based overrides for Refund / Travel / Debit / UPI / Service.
    Returns one of:
      'Account/Service', 'Credit', 'Debit', 'Other',
      'Refund', 'Shopping/UPI', 'Travel'
    """
    if not text:
        return "Other"

    model = _get_model()
    base = model.predict([text])[0]

    t = text.lower()

    # --- Strong overrides ---

    # Travel (train / PNR / ticket)
    if "pnr" in t or "train no" in t or "boarding allowed" in t or "coach position" in t or "chart prepared" in t:
        # If also clearly cancelled + refund, we will override to Refund below
        if "cancelled" in t or "tkt cancelled" in t or "ticket cancelled" in t:
            if "refund" in t or "refunded" in t or "will be refunded" in t or "amt" in t:
                return "Refund"
        return "Travel"

    # Refund / reversal / cashback
    if any(w in t for w in ["refund", "refunded", "cashback", "reversal", "chargeback"]):
        return "Refund"

    # Ticket cancelled with refund-like wording
    if ("ticket cancelled" in t or "tkt cancelled" in t) and ("amt" in t or "amount" in t):
        return "Refund"

    # Debit / cash out
    if "debited" in t or "cash withdrawal" in t or "withdrawn" in t or "spent" in t or "sent from a/c" in t:
        # UPI / merchant shopping cases
        if "upi" in t or "phonepe" in t or "gpay" in t or "google pay" in t or "paytm" in t or "swiggy" in t or "zomato" in t or "amazon" in t:
            return "Shopping/UPI"
        return "Debit"

    # Credit / incoming money
    if "credited" in t or "received" in t or "has been added" in t or "deposit" in t:
        if "refund" not in t:
            return "Credit"

    # Account / service / OTP / login etc.
    if any(w in t for w in [
        "otp", "one time password", "login", "verification code",
        "upi registration", "set up autopay", "statement is ready",
        "thank you for using", "service request", "has started"
    ]):
        if "debited" not in t and "credited" not in t:
            return "Account/Service"

    # If no rule triggered, fall back to model prediction
    return base
